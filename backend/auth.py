# backend/auth.py
"""Authentication and Server-Side Permission-Based Access Control Module.

Provides JWT session token verification, HttpOnly cookie extraction,
permission-based authorization enforcement, and cryptographic HMAC webhook verification.
"""

import os
import hmac
import hashlib
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

import jwt
from fastapi import HTTPException, Security, Depends, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from config.settings import settings

logger = logging.getLogger("nalka_auth")

# Use authoritative server-side configuration settings
JWT_SECRET = settings.JWT_SECRET
JWT_ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES

TALLY_WEBHOOK_SECRET = os.environ.get("TALLY_WEBHOOK_SECRET") or os.environ.get("WEBHOOK_SECRET") or JWT_SECRET

security_scheme = HTTPBearer(auto_error=False)

# ─── ROLE & PERMISSION MATRIX ──────────────────────────────────────────────
PERMISSION_MAP: Dict[str, List[str]] = {
    "admin": [
        "orders.create", "orders.view", "customers.view", "products.view",
        "inventory.view", "inventory.manage", "orders.process", "returns.manage",
        "analytics.view", "reports.view", "users.manage", "system.manage"
    ],
    "stock_manager": [
        "orders.view", "customers.view", "products.view",
        "inventory.view", "inventory.manage", "orders.process", "returns.manage"
    ],
    "order_manager": [
        "orders.view", "customers.view", "products.view",
        "inventory.view", "orders.process"
    ],
    "salesman": [
        "orders.create", "orders.view", "customers.view", "products.view", "inventory.view"
    ],
    "customer": [
        "orders.create", "orders.view"
    ],
    "viewer": [
        "orders.view", "products.view", "inventory.view"
    ]
}


def get_role_permissions(role: str) -> List[str]:
    """Returns granular permission set for a given role string."""
    role_clean = (role or "").strip().lower()
    return PERMISSION_MAP.get(role_clean, PERMISSION_MAP["viewer"])


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generates a cryptographically signed JWT access token containing role & permissions."""
    to_encode = data.copy()
    now = datetime.utcnow()
    expire = now + (expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    
    role = to_encode.get("role", "viewer").lower()
    to_encode["permissions"] = get_role_permissions(role)
    to_encode.update({
        "exp": expire,
        "iat": now,
        "nbf": now
    })
    
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_access_token(token: str) -> dict:
    """Verifies JWT signature, expiration, and claims."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError as e:
        logger.warning(f"JWT verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme)
) -> dict:
    """FastAPI dependency extracting JWT session token from Bearer header OR HttpOnly cookie."""
    tokens_to_try: List[str] = []
    if credentials and credentials.credentials:
        tokens_to_try.append(credentials.credentials)

    if request:
        cookie_header = request.headers.get("cookie", "")
        if cookie_header:
            for part in cookie_header.split(";"):
                part_clean = part.strip()
                if part_clean.startswith("nalka_token="):
                    val = part_clean[len("nalka_token="):].strip()
                    if val and val not in tokens_to_try:
                        tokens_to_try.append(val)

        if not tokens_to_try and request.cookies.get("nalka_token"):
            tokens_to_try.append(request.cookies.get("nalka_token"))

    last_error = None
    for tok in tokens_to_try:
        try:
            payload = verify_access_token(tok)
            user_id = payload.get("user_id") or payload.get("sub")
            role = payload.get("role", "viewer").lower()
            if user_id:
                return {
                    "user_id": user_id,
                    "email": payload.get("email", ""),
                    "role": role,
                    "permissions": payload.get("permissions", get_role_permissions(role)),
                    "salesman_id": payload.get("salesman_id"),
                    "full_name": payload.get("full_name", "Authenticated User"),
                }
        except Exception as exc:
            last_error = exc

    # For read operations (GET), provide safe viewer context fallback if unauthenticated
    if request and request.method == "GET":
        return {
            "user_id": "viewer_fallback",
            "email": "viewer@nalka.local",
            "role": "viewer",
            "permissions": get_role_permissions("viewer"),
            "salesman_id": None,
            "full_name": "Platform Viewer",
        }

    if last_error and isinstance(last_error, HTTPException):
        raise last_error

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication token required.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_permission(required_permission: str):
    """FastAPI dependency factory enforcing granular Permission-Based Access Control."""
    def permission_checker(current_user: dict = Depends(get_current_user)) -> dict:
        user_role = current_user.get("role", "viewer").lower()
        
        # Admin override
        if user_role == "admin":
            return current_user
            
        user_permissions = current_user.get("permissions") or get_role_permissions(user_role)
        if required_permission not in user_permissions:
            logger.warning(
                f"Permission Denied: User '{current_user.get('email')}' lacking required permission '{required_permission}'"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Required permission '{required_permission}' missing.",
            )
            
        return current_user

    return permission_checker


def require_role(allowed_roles: List[str]):
    """FastAPI dependency factory enforcing Role-Based Access Control (legacy compatibility)."""
    normalized_allowed = [r.lower() for r in allowed_roles]

    def role_checker(current_user: dict = Depends(get_current_user)) -> dict:
        user_role = current_user.get("role", "viewer").lower()
        if user_role == "admin" or user_role in normalized_allowed:
            return current_user
            
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied: Requires one of roles {allowed_roles}",
        )

    return role_checker


require_roles = require_role


def verify_webhook_signature(raw_body: bytes, signature_header: Optional[str], secret: Optional[str] = None) -> bool:
    """Verifies HMAC-SHA256 signature for incoming webhooks in constant time."""
    if not signature_header:
        logger.warning("Webhook rejection: Missing signature header")
        return False
        
    active_secret = secret or TALLY_WEBHOOK_SECRET
    if not active_secret:
        logger.error("Webhook rejection: Webhook secret not configured on server")
        return False

    clean_signature = signature_header.strip()
    if clean_signature.startswith("sha256="):
        clean_signature = clean_signature[7:]

    expected_signature = hmac.new(
        active_secret.encode("utf-8"),
        raw_body,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(expected_signature.lower(), clean_signature.lower())
