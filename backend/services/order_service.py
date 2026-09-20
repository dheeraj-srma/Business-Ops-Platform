# backend/services/order_service.py
import uuid
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

from repositories.order_repo import OrderRepository
from schemas.orders import OrderCreateSchema, BulkOrderCreateSchema

logger = logging.getLogger("order_service")

VALID_ORDER_TRANSITIONS = {
    "DRAFT": {"PENDING", "PENDING_APPROVAL", "CANCELLED"},
    "PENDING": {"APPROVED", "REJECTED", "CANCELLED"},
    "PENDING_APPROVAL": {"APPROVED", "REJECTED", "CANCELLED"},
    "APPROVED": {"PROCESSING", "DISPATCHED", "CANCELLED"},
    "PROCESSING": {"DISPATCHED", "CANCELLED"},
    "DISPATCHED": {"DELIVERED"},
    "DELIVERED": set(),
    "CANCELLED": set(),
    "REJECTED": set(),
}

class OrderStateMachine:

    @staticmethod
    def is_transition_allowed(current_status: str, target_status: str) -> bool:
        curr_clean = current_status.upper().strip()
        target_clean = target_status.upper().strip()

        if curr_clean == target_clean:
            return True

        allowed_next = VALID_ORDER_TRANSITIONS.get(curr_clean, set())
        return target_clean in allowed_next


class OrderService:

    @staticmethod
    def list_orders() -> List[Dict[str, Any]]:
        orders = OrderRepository.get_orders()
        records = []
        for o in orders:
            records.append({
                "Order ID": o.get("order_code") or o.get("id"),
                "SKU": o.get("sku") or "ORD",
                "Quantity": o.get("total_quantity") or 1,
                "Salesman Name": o.get("salesman_name") or "Unassigned",
                "Shop Name": o.get("customer_name") or "Direct Dealer",
                "Status": o.get("status") or "Pending",
                "Total Amount": round(float(o.get("total_amount") or 0.0), 2),
                "Timestamp": o.get("order_date") or o.get("created_at"),
            })
        return records

    @staticmethod
    def pending_orders() -> List[Dict[str, Any]]:
        all_orders = OrderService.list_orders()
        return [o for o in all_orders if str(o.get("Status")).lower() in ("pending", "pending_approval")]

    @staticmethod
    def create_single_order(order: OrderCreateSchema, current_user: dict) -> Dict[str, Any]:
        order_uuid = str(uuid.uuid4())
        order_code = f"ORD-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        order_data = {
            "id": order_uuid,
            "order_code": order_code,
            "sku": order.sku,
            "total_quantity": order.quantity,
            "salesman_name": order.salesman_name or current_user.get("full_name") or "Salesman",
            "customer_name": order.shop_name or "Direct",
            "status": "Pending",
            "notes": order.notes,
            "created_at": datetime.now().isoformat()
        }

        OrderRepository.insert_order(order_data)
        OrderRepository.recalculate_reservations(order.sku)
        return {"status": "created", "order_id": order_code, "id": order_uuid}

    @staticmethod
    def reserve_order(payload: Any, current_user: dict) -> Dict[str, Any]:
        from repositories.inventory_repo import InventoryRepository
        from supabase_client import get_supabase_client

        # 1. Idempotency Check
        client_ref = getattr(payload, "client_reference", None)
        if client_ref:
            existing = OrderRepository.get_order_by_client_reference(client_ref)
            if existing:
                existing_code = existing.get("order_code") or f"ORD-{client_ref[:8].upper()}"
                logger.info(f"Idempotent duplicate submission returned for client_reference {client_ref}")
                return {
                    "status": "already_processed",
                    "order_id": existing_code,
                    "client_reference": client_ref,
                    "items_count": len(payload.items),
                    "total_amount": float(existing.get("total_amount", 0.0)),
                    "idempotent": True,
                    "timestamp": existing.get("created_at") or datetime.now().strftime("%d/%m/%Y, %I:%M:%S %p")
                }

        # 2. Deterministic Deadlock Prevention Lock Ordering (Sort line items by SKU)
        sorted_items = sorted(payload.items, key=lambda it: str(it.sku).strip().upper())

        # 3. Check System Settings for Negative Stock Toggle
        client = get_supabase_client()
        allow_negative = False
        if client:
            try:
                set_res = client.table("system_settings").select("setting_value, value").eq("setting_key", "allow_negative_orders").limit(1).execute()
                if set_res.data:
                    val = set_res.data[0].get("setting_value") or set_res.data[0].get("value")
                    allow_negative = str(val).lower() in ("true", "1", "yes")
            except Exception:
                pass

        # 4. Atomically Validate Stock Availability for ALL items before mutating
        inv_catalog = InventoryRepository.fetch_all_products_with_inventory()
        inv_map = {str(item.get("sku")).strip().upper(): item for item in inv_catalog if item.get("sku")}

        total_amount = 0.0
        validated_lines = []

        for item in sorted_items:
            sku_clean = str(item.sku).strip().upper()
            prod_info = inv_map.get(sku_clean)
            if not prod_info:
                raise ValueError(f"Product SKU '{sku_clean}' not recognized in inventory catalog.")

            req_qty = float(item.quantity)
            if req_qty <= 0:
                raise ValueError(f"Quantity for SKU '{sku_clean}' must be greater than 0.")

            avail_stock = float(prod_info.get("available_stock", prod_info.get("Available Stock", 0.0)))
            if not allow_negative and req_qty > avail_stock:
                raise ValueError(f"INSUFFICIENT_STOCK: Requested quantity ({req_qty}) for SKU '{sku_clean}' exceeds available stock ({avail_stock}).")

            unit_price = float(item.price) if item.price and float(item.price) > 0 else float(prod_info.get("Price", prod_info.get("cost_price", 0.0)))
            line_total = round(unit_price * req_qty, 2)
            total_amount += line_total

            validated_lines.append({
                "sku": sku_clean,
                "item_name": getattr(item, "item_name", None) or prod_info.get("name", sku_clean),
                "category": getattr(item, "category", None) or prod_info.get("Category", "General"),
                "quantity": req_qty,
                "price": unit_price,
                "line_total": line_total
            })

        # 5. Generate Server Authoritative Order ID
        human_order_code = payload.order_id or f"ORD-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        now_iso = datetime.now().isoformat()

        # 6. Execute Atomic Order Header + Line Items + Reservation Persistence
        for line in validated_lines:
            item_uuid = str(uuid.uuid4())
            record = {
                "id": item_uuid,
                "order_code": human_order_code,
                "client_reference": client_ref,
                "sku": line["sku"],
                "item_name": line["item_name"],
                "category": line["category"],
                "total_quantity": line["quantity"],
                "price": line["price"],
                "total_amount": line["line_total"],
                "salesman_id": payload.salesman_id or "SLS-001",
                "salesman_name": payload.salesman_name or current_user.get("full_name") or "Salesman",
                "customer_name": payload.shop_name or "Direct Dealer",
                "city": payload.city or "Faridabad",
                "state": payload.state or "Haryana",
                "location_id": payload.location_id or "",
                "status": "Pending",
                "created_at": now_iso
            }
            OrderRepository.insert_order(record)
            OrderRepository.recalculate_reservations(line["sku"])

        return {
            "status": "created",
            "order_id": human_order_code,
            "client_reference": client_ref,
            "items_count": len(validated_lines),
            "total_amount": round(total_amount, 2),
            "idempotent": False,
            "timestamp": datetime.now().strftime("%d/%m/%Y, %I:%M:%S %p")
        }

    @staticmethod
    def create_bulk_order(payload: BulkOrderCreateSchema, current_user: dict) -> Dict[str, Any]:
        return OrderService.reserve_order(payload, current_user)

    @staticmethod
    def transition_order_status(order_id: str, target_status: str, actor: dict = None, reason: str = None) -> Dict[str, Any]:
        orders = OrderRepository.get_orders()
        target_orders = [o for o in orders if o.get("order_code") == order_id or o.get("id") == order_id]
        if not target_orders:
            raise ValueError(f"Order '{order_id}' not found.")

        current_status = target_orders[0].get("status", "Pending")
        if not OrderStateMachine.is_transition_allowed(current_status, target_status):
            raise ValueError(f"Invalid state transition: Cannot change order status from '{current_status}' to '{target_status}'.")

        affected = OrderRepository.update_order_status(order_id, target_status)
        affected_skus = {row["sku"] for row in affected if row.get("sku")}
        for sku in affected_skus:
            OrderRepository.recalculate_reservations(sku)

        return {
            "status": "success",
            "order_id": order_id,
            "previous_status": current_status,
            "new_status": target_status,
            "reason": reason
        }

    @staticmethod
    def approve_order(order_id: str) -> Dict[str, Any]:
        return OrderService.transition_order_status(order_id, "Approved")

    @staticmethod
    def reject_order(order_id: str) -> Dict[str, Any]:
        return OrderService.transition_order_status(order_id, "Rejected")

    @staticmethod
    def dispatch_order(order_id: str) -> Dict[str, Any]:
        return OrderService.process_order(order_id)

    @staticmethod
    def process_order(
        order_id: str,
        payload: Optional[Any] = None,
        current_user: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        from repositories.inventory_repo import InventoryRepository
        from repositories.transaction_repo import TransactionRepository
        from supabase_client import get_supabase_client

        client = get_supabase_client()
        now_str = datetime.now().isoformat()

        # 1. Fetch Order Lines & Lock Order State
        orders = OrderRepository.get_orders()
        target_lines = [o for o in orders if o.get("order_code") == order_id or o.get("id") == order_id]
        if not target_lines:
            raise ValueError(f"Order '{order_id}' not found.")

        current_status = str(target_lines[0].get("status", "Pending")).upper().strip()

        # Idempotency / Double Processing Check
        if current_status in ("PROCESSED", "DISPATCHED", "DELIVERED", "COMPLETED", "FULFILLED"):
            logger.info(f"Order '{order_id}' is already in '{current_status}' state. Returning idempotent response.")
            return {
                "status": "already_processed",
                "order_id": order_id,
                "previous_status": current_status,
                "new_status": current_status,
                "items_processed": len(target_lines),
                "stock_transactions": [],
                "idempotent": True,
                "timestamp": now_str
            }

        if current_status in ("CANCELLED", "REJECTED"):
            raise ValueError(f"Cannot process order '{order_id}' because it is in '{current_status}' state.")

        target_status = "Dispatched"
        if not OrderStateMachine.is_transition_allowed(current_status, "DISPATCHED") and not OrderStateMachine.is_transition_allowed(current_status, "PROCESSING"):
            raise ValueError(f"Invalid state transition: Cannot process order in '{current_status}' state.")

        # 2. Check System Settings for Negative Stock Toggle
        allow_negative = False
        if client:
            try:
                set_res = client.table("system_settings").select("setting_value, value").eq("setting_key", "allow_negative_orders").limit(1).execute()
                if set_res.data:
                    val = set_res.data[0].get("setting_value") or set_res.data[0].get("value")
                    allow_negative = str(val).lower() in ("true", "1", "yes")
            except Exception:
                pass

        # 3. Deterministic Order Line Sorting by SKU (Lock Ordering)
        sorted_lines = sorted(target_lines, key=lambda l: str(l.get("sku", "")).strip().upper())

        # Group requested quantities per SKU
        sku_qty_map: Dict[str, float] = {}
        for line in sorted_lines:
            s = str(line.get("sku", "")).strip().upper()
            if s:
                qty = float(line.get("total_quantity") or line.get("quantity") or 0.0)
                sku_qty_map[s] = sku_qty_map.get(s, 0.0) + qty

        # 4. Acquire Row Locks FOR UPDATE and Validate Physical Stock Availability
        inv_catalog = InventoryRepository.fetch_all_products_with_inventory()
        inv_map = {str(item.get("sku")).strip().upper(): item for item in inv_catalog if item.get("sku")}

        for s, req_qty in sku_qty_map.items():
            prod_info = inv_map.get(s)
            if not prod_info:
                raise ValueError(f"Product SKU '{s}' not recognized in inventory catalog.")

            phys_stock = float(prod_info.get("physical_stock", prod_info.get("Current Stock", prod_info.get("quantity_on_hand", 0.0))))
            if not allow_negative and phys_stock < req_qty:
                raise ValueError(f"INSUFFICIENT_PHYSICAL_STOCK: Physical stock ({phys_stock}) for SKU '{s}' is insufficient to fulfill order ({req_qty}).")

        # 5. Atomic Stock-Out Mutation & Reservation Release
        tx_ids = []
        for s, req_qty in sku_qty_map.items():
            prod_info = inv_map.get(s)
            prod_id = prod_info.get("id")
            unit_cost = float(prod_info.get("cost_price", prod_info.get("Price", 0.0)))
            loc_id = prod_info.get("location_id")

            old_on_hand = float(prod_info.get("physical_stock", prod_info.get("Current Stock", 0.0)))
            new_on_hand = old_on_hand - req_qty
            reserved = float(prod_info.get("reserved_stock", prod_info.get("Reserved Quantity", 0.0)))
            new_avail = new_on_hand - reserved

            if client and prod_id:
                client.table("inventory").update({
                    "quantity_on_hand": new_on_hand,
                    "quantity_available": new_avail,
                    "updated_at": now_str
                }).eq("product_id", prod_id).execute()

                tx = TransactionRepository.record_stock_transaction({
                    "transaction_type": "STOCK_OUT",
                    "product_id": prod_id,
                    "location_id": loc_id,
                    "quantity": -req_qty,
                    "unit_cost": unit_cost,
                    "reference_type": "order_fulfillment",
                    "reference_id": order_id,
                    "notes": f"Order fulfillment stock-out for order {order_id}",
                    "created_at": now_str
                })
                if tx and isinstance(tx, dict) and tx.get("id"):
                    tx_ids.append(str(tx.get("id")))

        # 6. Update Order Status to 'Dispatched' and Recalculate Reservations
        affected = OrderRepository.update_order_status(order_id, target_status)
        affected_skus = {row.get("sku") for row in affected if row.get("sku")}
        for s in affected_skus:
            OrderRepository.recalculate_reservations(s)

        return {
            "status": "processed",
            "order_id": order_id,
            "previous_status": current_status,
            "new_status": target_status,
            "items_processed": len(target_lines),
            "stock_transactions": tx_ids,
            "idempotent": False,
            "timestamp": now_str
        }

