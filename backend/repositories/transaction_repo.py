# backend/repositories/transaction_repo.py
import logging
from typing import List, Dict, Any, Optional
from supabase_client import get_supabase_client

logger = logging.getLogger("transaction_repo")

_IN_MEMORY_TRANSACTIONS: List[Dict[str, Any]] = []

class TransactionRepository:

    @staticmethod
    def get_transactions(limit: int = 1000, start_date: str = None, end_date: str = None) -> List[Dict[str, Any]]:
        client = get_supabase_client()
        if client:
            try:
                query = (
                    client.table("inventory_transactions")
                    .select("id, transaction_type, quantity, unit_cost, reference_type, transaction_date, notes, created_at, products(sku, name, brand)")
                )
                if start_date:
                    query = query.gte("transaction_date", f"{start_date}T00:00:00+00:00")
                if end_date:
                    query = query.lte("transaction_date", f"{end_date}T23:59:59+00:00")
                res = query.order("transaction_date", desc=True).limit(limit).execute()
                if res.data is not None:
                    return res.data
            except Exception:
                pass
        return _IN_MEMORY_TRANSACTIONS[:limit]

    @staticmethod
    def record_stock_transaction(transaction_data: Dict[str, Any]) -> Dict[str, Any]:
        client = get_supabase_client()
        if client:
            try:
                res = client.table("inventory_transactions").insert(transaction_data).execute()
                if res.data:
                    return res.data[0]
            except Exception as err:
                logger.warning(f"Supabase transaction insert failed, using fallback: {err}")

        _IN_MEMORY_TRANSACTIONS.insert(0, transaction_data)
        return transaction_data

    @staticmethod
    def record_transaction(
        product_id: str,
        transaction_type: str,
        quantity: float,
        reason: str = "Stock Movement",
        supplier_or_recipient: str = "-",
        reference_number: str = "-",
        notes: str = None
    ) -> Dict[str, Any]:
        import uuid
        from datetime import datetime
        tx_data = {
            "id": str(uuid.uuid4()),
            "product_id": product_id,
            "transaction_type": transaction_type,
            "quantity": quantity,
            "notes": f"{reason} | {supplier_or_recipient} | Ref: {reference_number} | {notes or ''}",
            "created_at": datetime.utcnow().isoformat()
        }
        return TransactionRepository.record_stock_transaction(tx_data)

    @staticmethod
    def get_returns(limit: int = 500) -> List[Dict[str, Any]]:
        client = get_supabase_client()
        if client:
            try:
                res = client.table("returns").select("*").order("created_at", desc=True).limit(limit).execute()
                if res.data is not None:
                    return res.data
            except Exception:
                pass
        return []

    @staticmethod
    def insert_return(return_data: Dict[str, Any]) -> Dict[str, Any]:
        client = get_supabase_client()
        if client:
            try:
                res = client.table("returns").insert(return_data).execute()
                if res.data:
                    return res.data[0]
            except Exception:
                pass
        return return_data



transaction_repository = TransactionRepository()
transaction_repo = TransactionRepository()

