# backend/routers/auth_router.py
import uuid
import logging
from fastapi import APIRouter, HTTPException, Depends, status, Response
from schemas.auth import LoginRequestSchema, TokenResponseSchema, UserProfileSchema
from auth import create_access_token, get_current_user
from supabase_client import get_supabase_client

logger = logging.getLogger("auth_router")
router = APIRouter(prefix="/api/auth", tags=["Authentication"])

def verify_password(plain_password: str, stored_pass_or_hash: str) -> bool:
    """Verifies plain password against stored hash or credential string."""
    if not stored_pass_or_hash:
        return False
    # Bcrypt format check
    if stored_pass_or_hash.startswith("$2b$") or stored_pass_or_hash.startswith("$2a$"):
        try:
            import bcrypt
            return bcrypt.checkpw(plain_password.encode('utf-8'), stored_pass_or_hash.encode('utf-8'))
        except Exception as e:
            logger.warning(f"Bcrypt password check failed: {e}")
            return False
    # Direct string match for pre-seeded or standard passwords
    return plain_password == stored_pass_or_hash

@router.post("/login", response_model=TokenResponseSchema)
def login(credentials: LoginRequestSchema, response: Response):
    """
    Authenticates user credentials against Supabase Auth & Users Database table.
    Sets HttpOnly, SameSite=Lax cookie and mints cryptographically signed JWT token.
    """
    try:
        email_clean = credentials.email.strip().lower()
        password_clean = credentials.password

        if not email_clean or not password_clean:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email and password are required."
            )

        # 1. Fast path: Pre-seeded development / testing accounts (strictly validated against known password)
        SEED_USERS = {
            "admin@nalkametals.com": {
                "id": "usr-admin-001",
                "email": "admin@nalkametals.com",
                "full_name": "System Administrator",
                "role": "admin",
                "is_active": True,
                "salesman_id": None,
                "password": "password123"
            },
            "manager@nalkametals.com": {
                "id": "usr-mgr-001",
                "email": "manager@nalkametals.com",
                "full_name": "Operations & Stock Manager",
                "role": "stock_manager",
                "is_active": True,
                "salesman_id": None,
                "password": "password123"
            },
            "stock@nalkametals.com": {
                "id": "usr-stk-001",
                "email": "stock@nalkametals.com",
                "full_name": "Operations & Stock Manager",
                "role": "stock_manager",
                "is_active": True,
                "salesman_id": None,
                "password": "password123"
            },
            "sales@nalkametals.com": {
                "id": "usr-sls-001",
                "email": "sales@nalkametals.com",
                "full_name": "Sales Representative",
                "role": "salesman",
                "is_active": True,
                "salesman_id": "TLY-SLM-003",
                "password": "password123"
            }
        }

        if email_clean in SEED_USERS:
            seed = SEED_USERS[email_clean]
            if password_clean == seed["password"]:
                authenticated = True
                user_data = {k: v for k, v in seed.items() if k != "password"}
            else:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid email or password.",
                    headers={"WWW-Authenticate": "Bearer"}
                )

        client = get_supabase_client()

        if not authenticated and client is not None:
            # 2. Attempt Supabase Auth sign-in with password
            try:
                auth_res = client.auth.sign_in_with_password({
                    "email": email_clean,
                    "password": password_clean
                })
                if auth_res and auth_res.user:
                    authenticated = True
                    auth_user_id = auth_res.user.id
                    # Retrieve full database profile from users table
                    try:
                        user_res = client.table("users").select("*").eq("id", auth_user_id).limit(1).execute()
                        if not user_res.data:
                            user_res = client.table("users").select("*").eq("email", email_clean).limit(1).execute()
                        if user_res.data:
                            user_data = user_res.data[0]
                    except Exception as db_err:
                        logger.warning(f"Could not fetch user profile from DB: {db_err}")

                    if not user_data:
                        meta = getattr(auth_res.user, "user_metadata", {}) or {}
                        user_data = {
                            "id": auth_res.user.id,
                            "email": auth_res.user.email,
                            "full_name": meta.get("full_name") or email_clean.split("@")[0].title(),
                            "role": meta.get("role", "viewer"),
                            "is_active": True,
                            "salesman_id": meta.get("salesman_id")
                        }
            except Exception as auth_err:
                logger.info(f"Supabase Auth sign_in_with_password attempt failed for {email_clean}: {auth_err}")

            # 3. Fallback: Query users database table directly and verify stored password/hash
            if not authenticated:
                try:
                    user_res = client.table("users").select("*").eq("email", email_clean).limit(1).execute()
                    if user_res and user_res.data:
                        candidate = user_res.data[0]
                        stored_pass = candidate.get("password") or candidate.get("password_hash")
                        if stored_pass and verify_password(password_clean, stored_pass):
                            authenticated = True
                            user_data = candidate
                except Exception as db_err:
                    logger.warning(f"Database password check failed: {db_err}")

        # Reject invalid credentials or non-existent users with 401 Unauthorized
        if not authenticated or not user_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
                headers={"WWW-Authenticate": "Bearer"}
            )

        # Enforce account activation status
        if not user_data.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is deactivated. Please contact an administrator."
            )

        # Mint JWT access token
        token_payload = {
            "user_id": user_data["id"],
            "email": user_data["email"],
            "role": user_data.get("role", "viewer").lower(),
            "full_name": user_data.get("full_name", "User"),
            "salesman_id": user_data.get("salesman_id")
        }

        token = create_access_token(token_payload)

        # Set secure HttpOnly cookie for server-side Next.js Edge Middleware inspection
        response.set_cookie(
            key="nalka_token",
            value=token,
            httponly=True,
            samesite="lax",
            max_age=86400,
            path="/"
        )

        # Set client-readable profile cookie for client UI components
        user_profile_data = {
            "id": user_data["id"],
            "email": user_data["email"],
            "role": user_data.get("role", "viewer").lower(),
            "full_name": user_data.get("full_name", "User"),
            "salesman_id": user_data.get("salesman_id")
        }
        import json
        import urllib.parse
        response.set_cookie(
            key="nalka_user",
            value=urllib.parse.quote(json.dumps(user_profile_data)),
            httponly=False,
            samesite="lax",
            max_age=86400,
            path="/"
        )

        return TokenResponseSchema(
            access_token=token,
            token_type="bearer",
            user=UserProfileSchema(
                id=user_data["id"],
                email=user_data["email"],
                role=user_data.get("role", "viewer").lower(),
                full_name=user_data.get("full_name", "User"),
                salesman_id=user_data.get("salesman_id")
            )
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error authenticating user: {exc}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

@router.post("/logout")
def logout(response: Response):
    """Clears HttpOnly auth cookie and client profile cookie upon logout."""
    response.delete_cookie(key="nalka_token", path="/", httponly=True, samesite="lax")
    response.delete_cookie(key="nalka_user", path="/", httponly=False, samesite="lax")
    return {"message": "Logged out successfully."}

@router.get("/me")
def get_auth_me(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}
