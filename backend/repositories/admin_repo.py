# backend/repositories/admin_repo.py
import logging
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from config.database import get_db_client

logger = logging.getLogger("admin_repo")

class AdminRepository:

    @staticmethod
    def get_users_list(offset: int = 0, limit: int = 100, role_filter: Optional[str] = None, search: Optional[str] = None) -> List[Dict[str, Any]]:
        client = get_db_client()
        if not client:
            raise RuntimeError("Database connection unavailable.")
        try:
            query = client.table("users").select("id, email, full_name, username, role, is_active, phone, created_at, updated_at")
            if role_filter:
                db_role = "stock_manager" if role_filter.lower() == "warehouse_manager" else role_filter.lower()
                query = query.eq("role", db_role)
            if search:
                # Search by email or full_name
                query = query.or_(f"email.ilike.%{search}%,full_name.ilike.%{search}%")
            res = query.range(offset, offset + limit - 1).execute()
            users = res.data or []

            # Map linked salesman_code from salesmen table if available
            try:
                salesmen_res = client.table("salesmen").select("id, user_id, salesman_code").execute()
                salesmen_by_user_id = {s["user_id"]: s["salesman_code"] for s in (salesmen_res.data or []) if s.get("user_id")}

                for u in users:
                    u_id = u.get("id")
                    u["salesman_ref"] = salesmen_by_user_id.get(u_id) or "—"
                    if u.get("role") == "stock_manager":
                        u["role"] = "warehouse_manager"
            except Exception as sm_err:
                logger.warning(f"Could not map salesmen records: {sm_err}")
            ROLE_PRIORITY = {
                "admin": 1,
                "warehouse_manager": 2,
                "stock_manager": 2,
                "manager": 3,
                "salesman": 4,
                "viewer": 5,
            }
            users.sort(key=lambda u: (
                ROLE_PRIORITY.get(str(u.get("role")).lower(), 99),
                str(u.get("full_name") or u.get("email")).lower()
            ))

            return users
        except Exception as err:
            logger.error(f"Error fetching admin users list from PostgreSQL: {err}")
            raise RuntimeError(f"Database error fetching users: {err}")

    @staticmethod
    def create_user_account(user_data: Dict[str, Any]) -> Dict[str, Any]:
        client = get_db_client()
        if not client:
            raise RuntimeError("Database connection unavailable.")
        
        payload = dict(user_data)
        if "id" not in payload or not payload["id"]:
            payload["id"] = str(uuid.uuid4())
        
        raw_password = payload.pop("password", None)
        if "password_hash" not in payload and raw_password:
            try:
                import bcrypt
                payload["password_hash"] = bcrypt.hashpw(raw_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            except Exception:
                payload["password_hash"] = raw_password
        elif "password_hash" not in payload:
            payload["password_hash"] = "password123"

        role_raw = str(payload.get("role") or "").strip().lower()
        if role_raw in ("warehouse_manager", "warehouse manager", "stock_manager"):
            payload["role"] = "stock_manager"
        elif role_raw:
            payload["role"] = role_raw

        payload["created_at"] = datetime.utcnow().isoformat()

        if "email" in payload and payload["email"]:
            payload["email"] = str(payload["email"]).strip().lower()

        # Filter only valid columns for users table
        valid_cols = {"id", "email", "full_name", "role", "is_active", "phone", "password_hash", "username", "created_at", "updated_at"}
        clean_payload = {k: v for k, v in payload.items() if k in valid_cols and v is not None}

        try:
            res = client.table("users").insert(clean_payload).execute()
            rec = res.data[0] if res.data else clean_payload
            if rec.get("role") == "stock_manager":
                rec["role"] = "warehouse_manager"
            return rec
        except Exception as err:
            err_str = str(err)
            if "23505" in err_str or "users_email_key" in err_str:
                raise ValueError(f"A user account with email '{clean_payload.get('email')}' already exists.")
            logger.error(f"Error creating user account: {err}")
            raise RuntimeError(f"Database error creating user: {err}")

    @staticmethod
    def update_user_account(user_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        client = get_db_client()
        if not client:
            raise RuntimeError("Database connection unavailable.")
        
        payload = dict(updates)
        payload.pop("password", None) # Remove non-column field password if present

        if "role" in payload and payload["role"]:
            role_raw = str(payload["role"]).strip().lower()
            if role_raw in ("warehouse_manager", "warehouse manager", "stock_manager"):
                payload["role"] = "stock_manager"
            else:
                payload["role"] = role_raw

        if "email" in payload and payload["email"]:
            payload["email"] = str(payload["email"]).strip().lower()

        payload["updated_at"] = datetime.utcnow().isoformat()

        valid_cols = {"email", "full_name", "role", "is_active", "phone", "password_hash", "username", "updated_at"}
        clean_payload = {k: v for k, v in payload.items() if k in valid_cols and v is not None}

        try:
            res = client.table("users").update(clean_payload).eq("id", user_id).execute()
            rec = res.data[0] if res.data else None
            if rec and rec.get("role") == "stock_manager":
                rec["role"] = "warehouse_manager"
            return rec
        except Exception as err:
            err_str = str(err)
            if "23505" in err_str or "users_email_key" in err_str:
                raise ValueError(f"A user account with email '{clean_payload.get('email')}' already exists.")
            logger.error(f"Error updating user account '{user_id}': {err}")
            raise RuntimeError(f"Database error updating user: {err}")

    @staticmethod
    def set_user_active_status(user_id: str, is_active: bool) -> Optional[Dict[str, Any]]:
        return AdminRepository.update_user_account(user_id, {"is_active": is_active})

    @staticmethod
    def delete_user_account(user_id: str) -> bool:
        client = get_db_client()
        if not client:
            raise RuntimeError("Database connection unavailable.")
        res = client.table("users").delete().eq("id", user_id).execute()
        return True

    @staticmethod
    def get_system_settings() -> List[Dict[str, Any]]:
        client = get_db_client()
        if not client:
            raise RuntimeError("Database connection unavailable.")
        try:
            res = client.table("system_settings").select("*").execute()
            return res.data or []
        except Exception as err:
            logger.error(f"Error fetching system settings from PostgreSQL: {err}")
            raise RuntimeError(f"Database error fetching system settings: {err}")

    @staticmethod
    def update_system_setting(setting_key: str, setting_value: str, updated_by: str = "admin") -> Dict[str, Any]:
        client = get_db_client()
        if not client:
            raise RuntimeError("Database connection unavailable.")

        payload = {
            "setting_key": setting_key,
            "setting_value": setting_value,
            "updated_at": datetime.utcnow().isoformat()
        }
        res = client.table("system_settings").upsert(payload, on_conflict="setting_key").execute()
        return res.data[0] if res.data else payload

    @staticmethod
    def get_audit_logs(offset: int = 0, limit: int = 50, action: Optional[str] = None) -> List[Dict[str, Any]]:
        client = get_db_client()
        if not client:
            raise RuntimeError("Database connection unavailable.")
        try:
            # Query actual PostgreSQL audit_log table
            query = client.table("audit_log").select("*").order("changed_at", desc=True)
            if action:
                query = query.eq("action", action.lower())
            res = query.range(offset, offset + limit - 1).execute()
            return res.data or []
        except Exception as err:
            logger.error(f"Error fetching audit logs from PostgreSQL: {err}")
            raise RuntimeError(f"Database error fetching audit logs: {err}")

admin_repo = AdminRepository()
