# backend/repositories/customer_repo.py
import logging
from typing import List, Dict, Any, Optional
from config.database import get_db_client

logger = logging.getLogger("customer_repo")

class CustomerRepository:

    @staticmethod
    def get_all_customers(offset: int = 0, limit: int = 100, search: Optional[str] = None) -> List[Dict[str, Any]]:
        client = get_db_client()
        if not client:
            logger.error("Database connection unavailable for fetching customers.")
            return []

        try:
            query = client.table("customers").select("*")
            if search:
                query = query.ilike("name", f"%{search}%")
            res = query.range(offset, offset + limit - 1).execute()
            return res.data or []
        except Exception as err:
            logger.error(f"Error fetching customers from DB: {err}")
            return []

    @staticmethod
    def get_customer_by_id(customer_id: str) -> Optional[Dict[str, Any]]:
        client = get_db_client()
        if not client:
            return None
        try:
            res = client.table("customers").select("*").eq("id", customer_id).limit(1).execute()
            return res.data[0] if res.data else None
        except Exception as err:
            logger.error(f"Error fetching customer '{customer_id}': {err}")
            return None

    @staticmethod
    def count_customers() -> int:
        client = get_db_client()
        if not client:
            return 0
        try:
            res = client.table("customers").select("id", count="exact").execute()
            return res.count if res.count is not None else len(res.data or [])
        except Exception as err:
            logger.error(f"Error counting customers: {err}")
            return 0

customer_repo = CustomerRepository()
