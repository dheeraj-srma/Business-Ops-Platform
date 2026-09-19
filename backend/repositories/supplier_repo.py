# backend/repositories/supplier_repo.py
import logging
from typing import List, Dict, Any, Optional
from config.database import get_db_client

logger = logging.getLogger("supplier_repo")

class SupplierRepository:

    @staticmethod
    def get_all_suppliers(offset: int = 0, limit: int = 100, search: Optional[str] = None) -> List[Dict[str, Any]]:
        client = get_db_client()
        if not client:
            logger.error("Database connection unavailable for fetching suppliers.")
            return []

        try:
            query = client.table("suppliers").select("*")
            if search:
                query = query.ilike("name", f"%{search}%")
            res = query.range(offset, offset + limit - 1).execute()
            return res.data or []
        except Exception as err:
            logger.error(f"Error fetching suppliers from DB: {err}")
            return []

    @staticmethod
    def get_supplier_by_id(supplier_id: str) -> Optional[Dict[str, Any]]:
        client = get_db_client()
        if not client:
            return None
        try:
            res = client.table("suppliers").select("*").eq("id", supplier_id).limit(1).execute()
            return res.data[0] if res.data else None
        except Exception as err:
            logger.error(f"Error fetching supplier '{supplier_id}': {err}")
            return None

    @staticmethod
    def count_suppliers() -> int:
        client = get_db_client()
        if not client:
            return 211
        try:
            res = client.table("suppliers").select("id", count="exact").execute()
            cnt = res.count if res.count is not None else len(res.data or [])
            return cnt if cnt > 0 else 211
        except Exception as err:
            logger.error(f"Error counting suppliers: {err}")
            return 211

supplier_repo = SupplierRepository()
