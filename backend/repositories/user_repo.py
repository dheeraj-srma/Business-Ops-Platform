# backend/repositories/user_repo.py
import logging
from typing import List, Dict, Any, Optional
from config.database import get_db_client

logger = logging.getLogger("user_repo")

class UserRepository:

    @staticmethod
    def get_all_users(offset: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        client = get_db_client()
        if not client:
            return []
        try:
            res = client.table("users").select("id, email, full_name, role, is_active, phone, created_at").range(offset, offset + limit - 1).execute()
            return res.data or []
        except Exception as err:
            logger.error(f"Error fetching users: {err}")
            return []

    @staticmethod
    def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
        client = get_db_client()
        if not client:
            return None
        try:
            res = client.table("users").select("*").eq("email", email.strip().lower()).limit(1).execute()
            return res.data[0] if res.data else None
        except Exception as err:
            logger.error(f"Error fetching user by email '{email}': {err}")
            return None

    @staticmethod
    def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
        client = get_db_client()
        if not client:
            return None
        try:
            res = client.table("users").select("*").eq("id", user_id).limit(1).execute()
            return res.data[0] if res.data else None
        except Exception as err:
            logger.error(f"Error fetching user by ID '{user_id}': {err}")
            return None

user_repo = UserRepository()
