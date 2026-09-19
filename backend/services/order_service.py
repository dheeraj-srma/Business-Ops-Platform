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
    def create_bulk_order(payload: BulkOrderCreateSchema, current_user: dict) -> Dict[str, Any]:
        if payload.client_reference:
            existing = OrderRepository.get_order_by_client_reference(payload.client_reference)
            if existing:
                existing_code = existing.get("order_code") or f"ORD-{payload.client_reference[:8].upper()}"
                logger.info(f"Duplicate submission prevented for client_reference {payload.client_reference}")
                return {
                    "status": "already_processed",
                    "order_id": existing_code,
                    "timestamp": existing.get("created_at") or datetime.now().strftime("%d/%m/%Y, %I:%M:%S %p"),
                    "items_count": len(payload.items),
                    "idempotent": True
                }

        human_order_code = f"ORD-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        created_records = []
        total_amount = 0.0

        for item in payload.items:
            item_uuid = str(uuid.uuid4())
            item_price = round(float(item.price or 0.0), 2)
            item_qty = int(item.quantity)
            item_total = round(item.total_price if item.total_price is not None else (item_price * item_qty), 2)
            total_amount += item_total

            record = {
                "id": item_uuid,
                "order_code": human_order_code,
                "client_reference": payload.client_reference,
                "sku": item.sku,
                "item_name": item.item_name,
                "category": item.category,
                "total_quantity": item_qty,
                "price": item_price,
                "total_amount": item_total,
                "salesman_id": payload.salesman_id or "SLS-001",
                "salesman_name": payload.salesman_name or current_user.get("full_name") or "Salesman",
                "customer_name": payload.shop_name or "Direct",
                "city": payload.city,
                "state": payload.state,
                "location_id": payload.location_id,
                "status": "Pending",
                "created_at": datetime.now().isoformat()
            }
            OrderRepository.insert_order(record)
            created_records.append(record)
            OrderRepository.recalculate_reservations(item.sku)

        return {
            "status": "created",
            "order_id": human_order_code,
            "timestamp": datetime.now().strftime("%d/%m/%Y, %I:%M:%S %p"),
            "items_count": len(payload.items),
            "total_amount": round(total_amount, 2)
        }

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
        return OrderService.transition_order_status(order_id, "Dispatched")

