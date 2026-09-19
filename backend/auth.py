# backend/auth.py
"""Authentication and Server-Side Role-Based Access Control (RBAC) Module.

Provides JWT session token verification, role permission enforcement,
and cryptographic HMAC signature verification for external webhooks.
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

# ─── ROLE & PERMISSION DEFINITIONS ──────────────────────────────────────────
ROLE_HIERARCHY = {
    "admin": ["admin", "stock_manager", "order_manager", "salesman", "customer", "viewer"],
    "stock_manager": ["stock_manager", "viewer"],
    "order_manager": ["order_manager", "viewer"],
    "salesman": ["salesman", "viewer"],
    "customer": ["customer", "viewer"],
    "viewer": ["viewer"],
}


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generates a cryptographically signed JWT access token."""
    to_encode = data.copy()
    now = datetime.utcnow()
    expire = now + (expires_delta if expires_delta else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    
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
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme)
) -> dict:
    """FastAPI dependency extracting and verifying the authenticated user session."""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    payload = verify_access_token(token)
    
    user_id = payload.get("user_id") or payload.get("sub")
    role = payload.get("role", "viewer").lower()
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing user identity claim.",
        )
        
    return {
        "user_id": user_id,
        "email": payload.get("email", ""),
        "role": role,
        "salesman_id": payload.get("salesman_id"),
        "full_name": payload.get("full_name", "Authenticated User"),
    }


def require_role(allowed_roles: List[str]):
    """FastAPI dependency factory enforcing server-side Role-Based Access Control (RBAC)."""
    normalized_allowed = [r.lower() for r in allowed_roles]

    def role_checker(current_user: dict = Depends(get_current_user)) -> dict:
        user_role = current_user.get("role", "viewer").lower()
        
        # Admin override
        if user_role == "admin":
            return current_user
            
        if user_role not in normalized_allowed:
            logger.warning(
                f"RBAC Access Denied: User '{current_user.get('email')}' with role '{user_role}' "
                f"attempted to access endpoint requiring {allowed_roles}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Requires one of roles {allowed_roles}",
            )
            
        return current_user

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

    # Normalize signature header format (support hex signature or 'sha256=...' prefix)
    clean_signature = signature_header.strip()
    if clean_signature.startswith("sha256="):
        clean_signature = clean_signature[7:]

    expected_signature = hmac.new(
        active_secret.encode("utf-8"),
        raw_body,
        hashlib.sha256
    ).hexdigest()

    # Constant-time string comparison to prevent timing attacks
    is_valid = hmac.compare_digest(expected_signature.lower(), clean_signature.lower())
    if not is_valid:
        logger.warning("Webhook rejection: Invalid cryptographic signature match")
        
    return is_valid
