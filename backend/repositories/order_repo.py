import logging
import uuid
from typing import List, Dict, Any, Optional, Tuple
from supabase_client import get_supabase_client
from services.snapshot_service import SnapshotService

logger = logging.getLogger("order_repo")

def is_valid_uuid(val: Any) -> bool:
    if not val or not isinstance(val, str):
        return False
    try:
        uuid.UUID(val)
        return True
    except (ValueError, AttributeError):
        return False

RESERVATION_ELIGIBLE_STATUSES = {"pending", "processing", "reserved", "approved"}

SORT_ALLOWLIST = {"created_at", "order_id", "status", "total_amount", "shop_name", "salesman_name"}

_IN_MEMORY_ORDERS: List[Dict[str, Any]] = []

class OrderRepository:

    @staticmethod
    def get_orders(limit: int = 500) -> List[Dict[str, Any]]:
        client = get_supabase_client()
        orders = []
        if client:
            try:
                res = client.table("orders").select("*").order("created_at", desc=True).limit(limit).execute()
                if res.data:
                    orders.extend(res.data)
                    SnapshotService.record_successful_read("orders", res.data)
            except Exception as err:
                SnapshotService.record_db_failure("orders", err)

        # Fallback to last known snapshot if DB returned no orders
        if not orders:
            snap = SnapshotService.get_last_known_snapshot("orders")
            if snap and snap.get("data"):
                orders = list(snap["data"])

        # Add in-memory orders avoiding duplicates
        existing_ids = {o.get("id") or o.get("order_code") or o.get("order_id") for o in orders}
        for memo in _IN_MEMORY_ORDERS:
            m_id = memo.get("id") or memo.get("order_code") or memo.get("order_id")
            if m_id not in existing_ids:
                orders.append(memo)
        return orders[:limit]

    @staticmethod
    def get_orders_paginated(
        page: int = 1,
        page_size: int = 50,
        search: Optional[str] = None,
        status: Optional[str] = None,
        salesman_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        sort_by: str = "created_at",
        sort_dir: str = "desc"
    ) -> Tuple[List[Dict[str, Any]], int]:
        """Queries orders from Supabase with server-side filtering, strict sorting allowlist, and pagination."""
        safe_sort = sort_by.strip().lower() if sort_by and sort_by.strip().lower() in SORT_ALLOWLIST else "created_at"
        is_desc = sort_dir.strip().lower() != "asc"
        
        offset = (page - 1) * page_size
        client = get_supabase_client()
        
        all_candidates = []
        if client:
            try:
                query = client.table("pending_orders").select("*", count="exact")
                
                if status and status.strip():
                    query = query.eq("status", status.strip())
                if salesman_id and salesman_id.strip():
                    query = query.eq("salesman_id", salesman_id.strip())
                if customer_id and customer_id.strip():
                    query = query.ilike("shop_name", f"%{customer_id.strip()}%")
                if date_from and date_from.strip():
                    query = query.gte("created_at", date_from.strip())
                if date_to and date_to.strip():
                    query = query.lte("created_at", date_to.strip())
                if search and search.strip():
                    s_term = f"%{search.strip()}%"
                    query = query.or_(f"order_id.ilike.{s_term},shop_name.ilike.{s_term},salesman_name.ilike.{s_term}")
                    
                query = query.order(safe_sort, desc=is_desc).range(offset, offset + page_size - 1)
                res = query.execute()
                
                total_count = res.count if res.count is not None else len(res.data or [])
                all_candidates = res.data or []
                
                if all_candidates or total_count > 0:
                    SnapshotService.record_successful_read("orders", all_candidates)
                    return all_candidates, total_count
            except Exception as exc:
                logger.warning(f"Supabase paginated query failed: {exc}, using backend snapshot fallback")
                SnapshotService.record_db_failure("orders", exc)

        # In-memory / snapshot fallback filtering
        snap = SnapshotService.get_last_known_snapshot("orders")
        fallback_list = list(snap["data"]) if snap and snap.get("data") else OrderRepository.get_orders(limit=1000)
        filtered = []
        for o in fallback_list:
            o_status = str(o.get("status") or o.get("Status") or "")
            o_salesman_id = str(o.get("salesman_id") or "")
            o_shop = str(o.get("shop_name") or o.get("Shop Name") or o.get("customer_name") or "")
            o_salesman_name = str(o.get("salesman_name") or o.get("Salesman Name") or "")
            o_id = str(o.get("order_id") or o.get("order_code") or o.get("id") or "")
            o_created = str(o.get("created_at") or o.get("Timestamp") or "")

            if status and status.strip() and o_status.lower() != status.strip().lower():
                continue
            if salesman_id and salesman_id.strip() and o_salesman_id.lower() != salesman_id.strip().lower():
                continue
            if customer_id and customer_id.strip() and customer_id.strip().lower() not in o_shop.lower():
                continue
            if date_from and date_from.strip() and o_created < date_from.strip():
                continue
            if date_to and date_to.strip() and o_created > date_to.strip():
                continue
            if search and search.strip():
                st = search.strip().lower()
                if st not in o_id.lower() and st not in o_shop.lower() and st not in o_salesman_name.lower():
                    continue
            filtered.append(o)

        total_count = len(filtered)
        # Sort filtered list
        reverse = is_desc
        filtered.sort(key=lambda x: str(x.get(safe_sort) or x.get("created_at") or ""), reverse=reverse)
        paginated = filtered[offset:offset + page_size]
        return paginated, total_count

    @staticmethod
    def get_order_by_id_with_items(order_id: str) -> Optional[Dict[str, Any]]:
        if not order_id:
            return None
            
        client = get_supabase_client()
        header = None
        items = []
        
        if client:
            try:
                # 1. Fetch header matching order_id
                res = client.table("pending_orders").select("*").eq("order_id", order_id).limit(1).execute()
                if res.data:
                    header = res.data[0]
                    target_order_id = header.get("order_id") or order_id
                    # 2. Fetch line items
                    i_res = client.table("pending_order_items").select("*").eq("order_id", target_order_id).execute()
                    if i_res.data:
                        items = i_res.data
            except Exception as exc:
                logger.warning(f"Error fetching order {order_id} from Supabase: {exc}")

        if not header:
            # Check fallback in-memory or legacy list
            for o in _IN_MEMORY_ORDERS:
                if o.get("order_code") == order_id or o.get("order_id") == order_id or o.get("id") == order_id:
                    header = o
                    if not items and isinstance(o.get("items"), list):
                        items = o["items"]
                    break

        if not header:
            return None

        # Build standardized order dict
        order_dict = {
            "order_id": header.get("order_id") or header.get("order_code") or header.get("id"),
            "salesman_id": header.get("salesman_id"),
            "salesman_name": header.get("salesman_name") or header.get("Salesman Name") or "Sales Representative",
            "shop_name": header.get("shop_name") or header.get("Shop Name") or header.get("customer_name") or "Customer Store",
            "location_id": header.get("location_id"),
            "city": header.get("city"),
            "state": header.get("state"),
            "item_count": int(header.get("item_count") or len(items) or 1),
            "total_amount": float(header.get("total_amount") or header.get("Total Amount") or 0.0),
            "status": header.get("status") or header.get("Status") or "Pending",
            "notes": header.get("notes"),
            "created_by": header.get("created_by"),
            "created_at": header.get("created_at") or header.get("Timestamp") or "",
            "updated_at": header.get("updated_at"),
            "items": []
        }

        formatted_items = []
        for it in items:
            formatted_items.append({
                "id": it.get("id"),
                "order_id": it.get("order_id") or order_dict["order_id"],
                "sku": it.get("sku"),
                "item_name": it.get("item_name") or it.get("sku") or "Product",
                "category": it.get("category") or "General",
                "quantity": float(it.get("quantity") or 1.0),
                "price": float(it.get("price") or 0.0),
                "total_price": float(it.get("total_price") or (float(it.get("quantity") or 1) * float(it.get("price") or 0))),
                "created_at": it.get("created_at")
            })
            
        # If no DB items were found but header contains line info (e.g. legacy structure)
        if not formatted_items and (header.get("sku") or header.get("SKU")):
            formatted_items.append({
                "id": header.get("id"),
                "order_id": order_dict["order_id"],
                "sku": header.get("sku") or header.get("SKU"),
                "item_name": header.get("item_name") or header.get("sku") or "Product",
                "category": header.get("category") or "General",
                "quantity": float(header.get("total_quantity") or header.get("Quantity") or 1.0),
                "price": float(header.get("price") or 0.0),
                "total_price": float(header.get("total_amount") or header.get("Total Amount") or 0.0),
                "created_at": order_dict["created_at"]
            })

        order_dict["items"] = formatted_items
        order_dict["item_count"] = len(formatted_items)
        return order_dict

    @staticmethod
    def get_order_by_client_reference(client_reference: str) -> Optional[Dict[str, Any]]:
        if not client_reference:
            return None
        memo = next((o for o in _IN_MEMORY_ORDERS if o.get("client_reference") == client_reference or f"Client ref: {client_reference}" in str(o.get("notes", ""))), None)
        if memo:
            return memo
        client = get_supabase_client()
        if client:
            try:
                res = client.table("pending_orders").select("*").ilike("notes", f"%Client ref: {client_reference}%").limit(1).execute()
                if res.data:
                    return res.data[0]
            except Exception:
                pass
        return None

    @staticmethod
    def insert_order(order_data: Dict[str, Any]) -> Dict[str, Any]:
        client = get_supabase_client()
        if client:
            try:
                res = client.table("pending_orders").insert(order_data).execute()
                if res.data:
                    return res.data[0]
            except Exception as err:
                logger.warning(f"Supabase order insert failed, using fallback: {err}")

        _IN_MEMORY_ORDERS.insert(0, order_data)
        return order_data

    @staticmethod
    def insert_order_item(item_data: Dict[str, Any]) -> Dict[str, Any]:
        client = get_supabase_client()
        if client:
            try:
                res = client.table("pending_order_items").insert(item_data).execute()
                if res.data:
                    return res.data[0]
            except Exception as err:
                logger.warning(f"Supabase order item insert failed: {err}")
        return item_data

    @staticmethod
    def update_order_status(order_id: str, new_status: str) -> List[Dict[str, Any]]:
        client = get_supabase_client()
        affected = []
        if client:
            try:
                if is_valid_uuid(order_id):
                    sel_res = client.table("pending_orders").select("order_id").or_(f"order_id.eq.{order_id},id.eq.{order_id}").execute()
                    affected = sel_res.data or []
                    client.table("pending_orders").update({"status": new_status, "updated_at": "now()"}).or_(f"order_id.eq.{order_id},id.eq.{order_id}").execute()
                else:
                    sel_res = client.table("pending_orders").select("order_id").eq("order_id", order_id).execute()
                    affected = sel_res.data or []
                    client.table("pending_orders").update({"status": new_status, "updated_at": "now()"}).eq("order_id", order_id).execute()
            except Exception as err:
                logger.warning(f"Error updating order status for {order_id}: {err}")

        for o in _IN_MEMORY_ORDERS:
            if o.get("order_code") == order_id or o.get("order_id") == order_id or o.get("id") == order_id:
                o["status"] = new_status
                affected.append(o)
        return affected

    @staticmethod
    def recalculate_reservations(sku: str) -> None:
        """Filters reservations strictly by active status and updates inventory table."""
        if not sku:
            return
        clean_sku = sku.strip().upper()
        try:
            client = get_supabase_client()
            active_reserved = 0.0

            if client:
                try:
                    item_res = client.table("pending_order_items").select("order_id, quantity").eq("sku", clean_sku).execute()
                    items_data = item_res.data or []
                    order_ids = list({it["order_id"] for it in items_data if it.get("order_id")})

                    if order_ids:
                        order_res = client.table("pending_orders").select("order_id, status").in_("order_id", order_ids).execute()
                        status_map = {o["order_id"]: str(o.get("status", "")).lower() for o in (order_res.data or [])}

                        for it in items_data:
                            oid = it.get("order_id")
                            st = status_map.get(oid, "pending")
                            if st in RESERVATION_ELIGIBLE_STATUSES:
                                active_reserved += float(it.get("quantity") or 0.0)
                except Exception as db_err:
                    logger.warning(f"Error querying DB for recalculate_reservations: {db_err}")

            # Fallback/in-memory active reservation calculation
            for memo in _IN_MEMORY_ORDERS:
                m_st = str(memo.get("status", "")).lower()
                if m_st in RESERVATION_ELIGIBLE_STATUSES:
                    for it in memo.get("items", []):
                        if str(it.get("sku", "")).strip().upper() == clean_sku:
                            active_reserved += float(it.get("quantity") or 0.0)

            p_res = client.table("products").select("id").eq("sku", clean_sku).limit(1).execute() if client else None
            if p_res and p_res.data:
                prod_id = p_res.data[0]["id"]
                inv_res = client.table("inventory").select("id, quantity_on_hand").eq("product_id", prod_id).limit(1).execute()
                if inv_res and inv_res.data:
                    inv_id = inv_res.data[0]["id"]
                    client.table("inventory").update({
                        "quantity_reserved": round(active_reserved, 4)
                    }).eq("id", inv_id).execute()
        except Exception as e:
            logger.error(f"Error recalculating reservations for SKU {sku}: {e}")
