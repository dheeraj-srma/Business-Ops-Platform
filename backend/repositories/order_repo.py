# backend/repositories/order_repo.py
import logging
from typing import List, Dict, Any, Optional
from supabase_client import get_supabase_client

logger = logging.getLogger("order_repo")

RESERVATION_ELIGIBLE_STATUSES = {"pending", "processing", "reserved", "approved"}

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
            except Exception:
                pass
        # Add in-memory orders avoiding duplicates
        existing_ids = {o.get("id") or o.get("order_code") for o in orders}
        for memo in _IN_MEMORY_ORDERS:
            m_id = memo.get("id") or memo.get("order_code")
            if m_id not in existing_ids:
                orders.append(memo)
        return orders[:limit]

    @staticmethod
    def get_order_by_client_reference(client_reference: str) -> Optional[Dict[str, Any]]:
        if not client_reference:
            return None
        memo = next((o for o in _IN_MEMORY_ORDERS if o.get("client_reference") == client_reference), None)
        if memo:
            return memo
        client = get_supabase_client()
        if client:
            try:
                res = client.table("orders").select("*").eq("client_reference", client_reference).limit(1).execute()
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
                res = client.table("orders").insert(order_data).execute()
                if res.data:
                    return res.data[0]
            except Exception as err:
                logger.warning(f"Supabase order insert failed, using fallback: {err}")

        _IN_MEMORY_ORDERS.insert(0, order_data)
        return order_data

    @staticmethod
    def update_order_status(order_id: str, new_status: str) -> List[Dict[str, Any]]:
        client = get_supabase_client()
        affected = []
        if client:
            try:
                sel_res = client.table("orders").select("sku").or_(f"order_code.eq.{order_id},id.eq.{order_id}").execute()
                affected = sel_res.data or []
                client.table("orders").update({"status": new_status}).or_(f"order_code.eq.{order_id},id.eq.{order_id}").execute()
            except Exception:
                pass

        for o in _IN_MEMORY_ORDERS:
            if o.get("order_code") == order_id or o.get("id") == order_id:
                o["status"] = new_status
                affected.append(o)
        return affected


    @staticmethod
    def recalculate_reservations(sku: str) -> None:
        """Filters reservations strictly by active status and updates inventory table."""
        if not sku:
            return
        try:
            client = get_supabase_client()
            res = client.table("orders").select("total_quantity, quantity, status").eq("sku", sku).execute()
            orders_data = res.data or []

            active_reserved = sum(
                float(o.get("total_quantity") or o.get("quantity") or 0)
                for o in orders_data
                if str(o.get("status", "")).lower() in RESERVATION_ELIGIBLE_STATUSES
            )

            p_res = client.table("products").select("id").eq("sku", sku).limit(1).execute()
            if p_res.data:
                prod_id = p_res.data[0]["id"]
                inv_res = client.table("inventory").select("id, quantity_on_hand").eq("product_id", prod_id).limit(1).execute()
                if inv_res.data:
                    inv_id = inv_res.data[0]["id"]
                    q_on_hand = float(inv_res.data[0].get("quantity_on_hand") or 0)
                    q_avail = q_on_hand - active_reserved

                    client.table("inventory").update({
                        "quantity_reserved": round(active_reserved, 4),
                        "quantity_available": round(q_avail, 4)
                    }).eq("id", inv_id).execute()
        except Exception as e:
            logger.error(f"Error recalculating reservations for SKU {sku}: {e}")
