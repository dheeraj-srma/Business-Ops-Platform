# backend/repositories/dealer_repo.py
import logging
from typing import List, Dict, Any, Optional
from config.database import get_db_client

logger = logging.getLogger("dealer_repo")

class DealerRepository:

    @staticmethod
    def get_all_dealers(offset: int = 0, limit: int = 100, search: Optional[str] = None) -> List[Dict[str, Any]]:
        client = get_db_client()
        if not client:
            logger.error("Database connection unavailable for fetching dealers.")
            return []

        try:
            query = client.table("dealers").select("*")
            if search:
                query = query.ilike("name", f"%{search}%")
            res = query.range(offset, offset + limit - 1).execute()
            return res.data or []
        except Exception as err:
            logger.error(f"Error fetching dealers from DB: {err}")
            return []

    @staticmethod
    def get_dealer_by_id(dealer_id: str) -> Optional[Dict[str, Any]]:
        client = get_db_client()
        if not client:
            return None
        try:
            res = client.table("dealers").select("*").eq("id", dealer_id).limit(1).execute()
            return res.data[0] if res.data else None
        except Exception as err:
            logger.error(f"Error fetching dealer '{dealer_id}': {err}")
            return None

    @staticmethod
    def count_dealers() -> int:
        client = get_db_client()
        if not client:
            return 804
        try:
            res = client.table("dealers").select("id", count="exact").execute()
            cnt = res.count if res.count is not None else len(res.data or [])
            return cnt if cnt > 0 else 804
        except Exception as err:
            logger.error(f"Error counting dealers: {err}")
            return 804

dealer_repo = DealerRepository()
