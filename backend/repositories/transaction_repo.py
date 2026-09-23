# backend/repositories/transaction_repo.py
import logging
from typing import List, Dict, Any, Optional
from supabase_client import get_supabase_client
from services.snapshot_service import SnapshotService

logger = logging.getLogger("transaction_repo")

_IN_MEMORY_TRANSACTIONS: List[Dict[str, Any]] = []
_IN_MEMORY_RETURNS: List[Dict[str, Any]] = []

def is_valid_uuid(val: Any) -> bool:
    if not val or not isinstance(val, str):
        return False
    try:
        import uuid
        uuid.UUID(val)
        return True
    except (ValueError, AttributeError):
        return False

class TransactionRepository:

    @staticmethod
    def get_transactions(
        limit: int = 1000,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        transaction_type: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        client = get_supabase_client()
        if client:
            try:
                query = (
                    client.table("inventory_transactions")
                    .select("id, transaction_type, product_id, location_id, quantity, unit_cost, reference_type, reference_id, client_reference, performed_by, transaction_date, notes, created_at, products(id, sku, name, brand, unit_of_measure)")
                )
                if start_date:
                    sd = start_date if "T" in start_date else f"{start_date}T00:00:00+00:00"
                    query = query.gte("transaction_date", sd)
                if end_date:
                    ed = end_date if "T" in end_date else f"{end_date}T23:59:59+00:00"
                    query = query.lte("transaction_date", ed)
                if transaction_type and transaction_type.lower() != "all":
                    tt_clean = transaction_type.lower().strip()
                    if tt_clean in ("inward", "stock_in"):
                        query = query.in_("transaction_type", ["inward", "return_in"])
                    elif tt_clean in ("sale", "stock_out"):
                        query = query.in_("transaction_type", ["sale", "return_out"])
                    elif tt_clean in ("adjustment", "adjustment_increase", "adjustment_decrease"):
                        query = query.eq("transaction_type", "adjustment")
                    elif tt_clean in ("return", "customer_return", "return_in"):
                        query = query.eq("transaction_type", "return_in")
                    else:
                        query = query.eq("transaction_type", tt_clean)

                res = query.order("transaction_date", desc=True).limit(limit).execute()
                if res.data is not None:
                    data = res.data
                    if search and search.strip():
                        s_term = search.strip().lower()
                        filtered = []
                        for row in data:
                            p = row.get("products") or {}
                            sku = str(p.get("sku") or "").lower()
                            name = str(p.get("name") or "").lower()
                            notes = str(row.get("notes") or "").lower()
                            ref = str(row.get("client_reference") or row.get("reference_id") or "").lower()
                            if s_term in sku or s_term in name or s_term in notes or s_term in ref:
                                filtered.append(row)
                        data = filtered

                    # Persist successful read snapshot for offline resilience
                    try:
                        SnapshotService.record_successful_read("inventory_transactions", data)
                    except Exception as snap_err:
                        logger.debug(f"Snapshot record error: {snap_err}")

                    return data
            except Exception as exc:
                logger.warning(f"Supabase transaction read failed: {exc}")
                SnapshotService.record_db_failure("inventory_transactions", exc)

        # READ_ONLY / SNAPSHOT fallback if DB is unreachable
        snap = SnapshotService.get_last_known_snapshot("inventory_transactions")
        if snap and isinstance(snap.get("data"), list):
            logger.info("Serving inventory transactions from authoritative disk snapshot (READ-ONLY mode).")
            return snap["data"][:limit]

        return _IN_MEMORY_TRANSACTIONS[:limit]

    list_transactions = get_transactions

    @staticmethod
    def record_stock_transaction(transaction_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Authoritative transaction creation.
        Enforces unsigned magnitude quantity (quantity >= 0), DB enum alignment,
        atomic snapshot invalidation on success, and failure propagation.
        """
        from datetime import datetime, timezone
        now_iso = datetime.now(timezone.utc).isoformat()
        if not transaction_data.get("transaction_date"):
            transaction_data["transaction_date"] = now_iso
        if not transaction_data.get("created_at"):
            transaction_data["created_at"] = now_iso

        # Map input transaction types to valid PostgreSQL enum values
        raw_tt = str(transaction_data.get("transaction_type") or "adjustment").lower().strip()
        if raw_tt in ("inward", "stock_in", "initial_stock"):
            transaction_data["transaction_type"] = "inward"
        elif raw_tt in ("sale", "sales", "stock_out", "dispatch"):
            transaction_data["transaction_type"] = "sale"
        elif raw_tt in ("customer_return", "return_in", "return"):
            transaction_data["transaction_type"] = "return_in"
        elif raw_tt in ("supplier_return", "return_out"):
            transaction_data["transaction_type"] = "return_out"
        elif "adjustment" in raw_tt:
            transaction_data["transaction_type"] = "adjustment"
        else:
            transaction_data["transaction_type"] = raw_tt

        # Map input reference types to valid database check constraints
        raw_ref = str(transaction_data.get("reference_type") or "order").lower().strip()
        if raw_ref in ("order_rollback", "order_reopen", "customer_return", "return_in", "return_out", "return"):
            transaction_data["reference_type"] = "return"
        elif raw_ref in ("order", "sale", "sales", "dispatch"):
            transaction_data["reference_type"] = "order"
        elif raw_ref in ("inward", "purchase_order", "po", "initial"):
            transaction_data["reference_type"] = "inward"
        elif "adjustment" in raw_ref:
            transaction_data["reference_type"] = "adjustment"
        else:
            transaction_data["reference_type"] = raw_ref

        # Enforce non-negative quantity magnitude
        raw_qty = float(transaction_data.get("quantity") or 0.0)
        transaction_data["quantity"] = abs(raw_qty)

        # Sanitize UUID columns (reference_id, client_reference, performed_by) to prevent Postgres type errors
        for ref_col in ("client_reference", "reference_id"):
            val = transaction_data.get(ref_col)
            if val is not None:
                if not is_valid_uuid(str(val)):
                    # Human reference string: preserve in notes if not already there
                    ref_str = str(val)
                    cur_notes = str(transaction_data.get("notes") or "")
                    if ref_str not in cur_notes:
                        transaction_data["notes"] = f"Ref: {ref_str} | {cur_notes}".strip(" |")
                    transaction_data[ref_col] = None

        perf_by = transaction_data.get("performed_by")
        if perf_by is not None and not is_valid_uuid(str(perf_by)):
            cur_notes = str(transaction_data.get("notes") or "")
            actor_str = str(perf_by)
            if actor_str not in cur_notes:
                transaction_data["notes"] = f"By: {actor_str} | {cur_notes}".strip(" |")
            transaction_data["performed_by"] = None

        client = get_supabase_client()
        if client:
            try:
                res = client.table("inventory_transactions").insert(transaction_data).execute()
                if res.data:
                    # Invalidate cached transaction snapshot on mutation
                    SnapshotService.invalidate("inventory_transactions")
                    return res.data[0]
            except Exception as err:
                logger.error(f"Authoritative Supabase transaction insert failed: {err}")
                raise RuntimeError(f"Failed to record inventory transaction in authoritative database: {err}")

        # In-memory test environment fallback
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
        from datetime import datetime, timezone
        now_iso = datetime.now(timezone.utc).isoformat()
        tx_data = {
            "id": str(uuid.uuid4()),
            "product_id": product_id,
            "transaction_type": transaction_type,
            "quantity": abs(quantity),
            "notes": f"{reason} | {supplier_or_recipient} | Ref: {reference_number} | {notes or ''}",
            "transaction_date": now_iso,
            "created_at": now_iso
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
        return list(_IN_MEMORY_RETURNS)[:limit]

    @staticmethod
    def insert_return(return_data: Dict[str, Any]) -> Dict[str, Any]:
        client = get_supabase_client()
        if client:
            try:
                res = client.table("returns").insert(return_data).execute()
                if res.data:
                    return res.data[0]
            except Exception as e:
                logger.warning(f"Supabase return insert failed: {e}")
        _IN_MEMORY_RETURNS.append(return_data)
        return return_data



transaction_repository = TransactionRepository()
transaction_repo = TransactionRepository()

