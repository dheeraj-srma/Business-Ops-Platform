# backend/repositories/customer_repo.py
import logging
from typing import List, Dict, Any, Optional
from config.database import get_db_client
from services.snapshot_service import SnapshotService

logger = logging.getLogger("customer_repo")

class CustomerRepository:

    @staticmethod
    def get_all_customers(offset: int = 0, limit: int = 100, search: Optional[str] = None) -> List[Dict[str, Any]]:
        client = get_db_client()
        if client:
            try:
                query = client.table("customers").select("*")
                if search:
                    query = query.ilike("name", f"%{search}%")
                res = query.range(offset, offset + limit - 1).execute()
                data = res.data or []
                if data:
                    SnapshotService.record_successful_read("customers", data)
                return data
            except Exception as err:
                logger.warning(f"Error fetching customers from DB: {err}, falling back to snapshot")
                SnapshotService.record_db_failure("customers", err)

        # Fallback to last known snapshot
        snap = SnapshotService.get_last_known_snapshot("customers")
        customers = list(snap["data"]) if snap and snap.get("data") else []
        if search:
            s_term = search.lower()
            customers = [c for c in customers if s_term in str(c.get("name", "")).lower() or s_term in str(c.get("shop_name", "")).lower()]
        return customers[offset:offset + limit]

    @staticmethod
    def get_customer_by_id(customer_id: str) -> Optional[Dict[str, Any]]:
        client = get_db_client()
        if client:
            try:
                res = client.table("customers").select("*").eq("id", customer_id).limit(1).execute()
                if res.data:
                    return res.data[0]
            except Exception as err:
                logger.warning(f"Error fetching customer '{customer_id}': {err}")
                SnapshotService.record_db_failure("customers", err)

        # Fallback to snapshot
        snap = SnapshotService.get_last_known_snapshot("customers")
        if snap and snap.get("data"):
            for c in snap["data"]:
                if str(c.get("id")) == str(customer_id):
                    return c
        return None

    @staticmethod
    def count_customers() -> int:
        client = get_db_client()
        if client:
            try:
                res = client.table("customers").select("id", count="exact").execute()
                return res.count if res.count is not None else len(res.data or [])
            except Exception as err:
                logger.warning(f"Error counting customers: {err}")
                SnapshotService.record_db_failure("customers", err)

        snap = SnapshotService.get_last_known_snapshot("customers")
        if snap and snap.get("data"):
            return len(snap["data"])
        return 0

customer_repo = CustomerRepository()

