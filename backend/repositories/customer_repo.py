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

    @staticmethod
    def get_all_salesmen() -> List[Dict[str, Any]]:
        client = get_db_client()
        if not client:
            return []
        try:
            res = client.table("salesmen").select("id, salesman_code, full_name, phone, is_active").order("salesman_code").execute()
            return res.data or []
        except Exception as err:
            logger.error(f"Error fetching salesmen list: {err}")
            return []

    @staticmethod
    def get_customer_assignments(
        offset: int = 0,
        limit: int = 50,
        search: Optional[str] = None,
        salesman_id: Optional[str] = None
    ) -> Dict[str, Any]:
        client = get_db_client()
        if not client:
            return {"customers": [], "total": 0, "salesmen": []}

        try:
            # 1. Fetch all active field salesmen
            salesmen = CustomerRepository.get_all_salesmen()
            salesmen_map = {s["id"]: s for s in salesmen}

            # 2. Build customers query
            query = client.table("customers").select(
                "id, customer_code, name, contact_person, phone, email, gst_number, assigned_salesman_id, is_active",
                count="exact"
            )

            if search:
                query = query.or_(f"name.ilike.%{search}%,customer_code.ilike.%{search}%")

            if salesman_id:
                if salesman_id.lower() in ("unassigned", "direct", "none"):
                    query = query.is_("assigned_salesman_id", "null")
                else:
                    query = query.eq("assigned_salesman_id", salesman_id)

            res = query.order("name").range(offset, offset + limit - 1).execute()
            raw_customers = res.data or []
            total_count = res.count if res.count is not None else len(raw_customers)

            # 3. Enhance with salesman details
            enriched = []
            for c in raw_customers:
                assigned_id = c.get("assigned_salesman_id")
                assigned_sm = salesmen_map.get(assigned_id)
                enriched.append({
                    "id": c.get("id"),
                    "customer_code": c.get("customer_code"),
                    "name": c.get("name"),
                    "phone": c.get("phone") or "—",
                    "email": c.get("email") or "—",
                    "gst_number": c.get("gst_number") or "—",
                    "assigned_salesman_id": assigned_id,
                    "salesman_code": assigned_sm.get("salesman_code") if assigned_sm else "DIRECT",
                    "salesman_name": assigned_sm.get("full_name") if assigned_sm else "Direct / Unassigned",
                    "is_active": c.get("is_active", True)
                })

            return {
                "customers": enriched,
                "total": total_count,
                "offset": offset,
                "limit": limit,
                "salesmen": salesmen
            }
        except Exception as err:
            logger.error(f"Error fetching customer assignments: {err}")
            return {"customers": [], "total": 0, "salesmen": []}

    @staticmethod
    def assign_customer_to_salesman(customer_id: str, salesman_id: Optional[str]) -> Dict[str, Any]:
        client = get_db_client()
        if not client:
            raise RuntimeError("Database connection unavailable.")

        # 1. Fetch customer
        cust_res = client.table("customers").select("*").eq("id", customer_id).limit(1).execute()
        if not cust_res.data:
            raise ValueError(f"Customer with ID '{customer_id}' not found.")
        customer = cust_res.data[0]

        # 2. Determine target salesman details
        salesman_code = "DIRECT"
        salesman_name = "Direct / House Account"
        clean_salesman_id = None

        if salesman_id and salesman_id.lower() not in ("unassigned", "direct", "none", ""):
            sm_res = client.table("salesmen").select("*").eq("id", salesman_id).limit(1).execute()
            if not sm_res.data:
                raise ValueError(f"Salesman with ID '{salesman_id}' not found.")
            clean_salesman_id = sm_res.data[0]["id"]
            salesman_code = sm_res.data[0].get("salesman_code") or "DIRECT"
            salesman_name = sm_res.data[0].get("full_name") or "Salesman"

        # 3. Update customers table
        from datetime import datetime
        update_payload = {
            "assigned_salesman_id": clean_salesman_id,
            "updated_at": datetime.utcnow().isoformat()
        }
        res = client.table("customers").update(update_payload).eq("id", customer_id).execute()
        updated_cust = res.data[0] if res.data else {**customer, **update_payload}

        return {
            "id": customer_id,
            "name": customer.get("name"),
            "customer_code": customer.get("customer_code"),
            "assigned_salesman_id": clean_salesman_id,
            "salesman_code": salesman_code,
            "salesman_name": salesman_name
        }

    @staticmethod
    def bulk_assign_customers(customer_ids: List[str], salesman_id: Optional[str]) -> Dict[str, Any]:
        updated_count = 0
        errors = []
        for cid in customer_ids:
            try:
                CustomerRepository.assign_customer_to_salesman(cid, salesman_id)
                updated_count += 1
            except Exception as e:
                errors.append(f"{cid}: {str(e)}")

        return {
            "total_requested": len(customer_ids),
            "updated_count": updated_count,
            "errors": errors
        }

customer_repo = CustomerRepository()

