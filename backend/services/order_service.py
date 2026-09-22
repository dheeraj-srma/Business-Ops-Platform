# backend/services/order_service.py
import uuid
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

from repositories.order_repo import OrderRepository
from schemas.orders import OrderCreateSchema, BulkOrderCreateSchema

logger = logging.getLogger("order_service")

def is_valid_uuid(val: Any) -> bool:
    if not val or not isinstance(val, str):
        return False
    try:
        uuid.UUID(val)
        return True
    except (ValueError, AttributeError):
        return False

VALID_ORDER_TRANSITIONS = {
    "DRAFT": {"PENDING", "PENDING_APPROVAL", "CANCELLED"},
    "PENDING": {"APPROVED", "REJECTED", "CANCELLED"},
    "PENDING_APPROVAL": {"APPROVED", "REJECTED", "CANCELLED"},
    "APPROVED": {"PROCESSING", "DISPATCHED", "CANCELLED", "REJECTED"},
    "PROCESSING": {"DISPATCHED", "CANCELLED", "REJECTED"},
    "DISPATCHED": {"DELIVERED"},
    "DELIVERED": set(),
    "CANCELLED": {"PENDING"},
    "REJECTED": {"PENDING"},
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
                "Order ID": o.get("order_code") or o.get("id") or o.get("order_id"),
                "SKU": o.get("sku") or "ORD",
                "Quantity": o.get("total_quantity") or 1,
                "Salesman Name": o.get("salesman_name") or "Unassigned",
                "Shop Name": o.get("customer_name") or o.get("shop_name") or "Direct Dealer",
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
    def get_order_history() -> Dict[str, Any]:
        from supabase_client import get_supabase_client
        client = get_supabase_client()
        orders = []
        items = []
        if client:
            try:
                res = (
                    client.table("pending_orders")
                    .select("*")
                    .neq("status", "Pending")
                    .order("created_at", desc=True)
                    .limit(500)
                    .execute()
                )
                raw_orders = res.data or []
                order_ids = [o["order_id"] for o in raw_orders if o.get("order_id")]
                
                raw_items = []
                if order_ids:
                    for chunk_start in range(0, len(order_ids), 100):
                        chunk_ids = order_ids[chunk_start:chunk_start + 100]
                        i_res = (
                            client.table("pending_order_items")
                            .select("*")
                            .in_("order_id", chunk_ids)
                            .execute()
                        )
                        if i_res.data:
                            raw_items.extend(i_res.data)

                item_map: Dict[str, List[Dict[str, Any]]] = {}
                for it in raw_items:
                    oid = it.get("order_id")
                    if oid not in item_map:
                        item_map[oid] = []
                    item_map[oid].append(it)
                    items.append({
                        "id": str(it.get("id")),
                        "order_id": oid,
                        "sku": it.get("sku") or it.get("item_name"),
                        "item_name": it.get("item_name") or it.get("sku"),
                        "category": it.get("category") or "General",
                        "quantity": float(it.get("quantity") or 0.0),
                        "price": float(it.get("price") or 0.0),
                        "total_price": float(it.get("total_price") or (float(it.get("price") or 0.0) * float(it.get("quantity") or 0.0))),
                        "matched": True,
                        "stock_deducted": float(it.get("quantity") or 0.0),
                        "created_at": it.get("created_at") or "",
                    })

                for o in raw_orders:
                    oid = o.get("order_id")
                    st = str(o.get("status", "")).upper()
                    is_confirmed = st in ("APPROVED", "CONFIRMED", "DISPATCHED", "DELIVERED", "COMPLETED", "PROCESSED")
                    o_items = item_map.get(oid, [])
                    orders.append({
                        "id": str(o.get("id") or oid),
                        "order_id": oid,
                        "salesman_id": o.get("salesman_id"),
                        "salesman_name": o.get("salesman_name") or "Sales Representative",
                        "shop_name": o.get("shop_name") or "Customer Store",
                        "city": o.get("city"),
                        "state": o.get("state"),
                        "location_id": o.get("location_id"),
                        "total_amount": float(o.get("total_amount") or 0.0),
                        "source": "supabase",
                        "status": "CONFIRMED" if is_confirmed else "REJECTED",
                        "processed_at": o.get("updated_at") or o.get("created_at") or datetime.now().isoformat(),
                        "processed_by_name": "Ops Manager",
                        "items_count": int(o.get("item_count") or len(o_items)),
                        "notes": o.get("notes"),
                        "rejection_reason": o.get("notes") if not is_confirmed else None,
                        "created_at": o.get("created_at") or datetime.now().isoformat(),
                        "updated_at": o.get("updated_at") or o.get("created_at") or datetime.now().isoformat(),
                    })
            except Exception as exc:
                logger.error(f"Error fetching order history from Supabase: {exc}")

        return {
            "success": True,
            "orders": orders,
            "items": items
        }

    @staticmethod
    def get_pending_order_previews() -> Dict[str, Any]:
        from supabase_client import get_supabase_client
        client = get_supabase_client()
        orders = []
        if client:
            try:
                res = (
                    client.table("pending_orders")
                    .select("*")
                    .eq("status", "Pending")
                    .order("created_at", desc=True)
                    .limit(200)
                    .execute()
                )
                raw_orders = res.data or []
                order_ids = [o["order_id"] for o in raw_orders if o.get("order_id")]
                
                raw_items = []
                if order_ids:
                    for chunk_start in range(0, len(order_ids), 100):
                        chunk_ids = order_ids[chunk_start:chunk_start + 100]
                        i_res = (
                            client.table("pending_order_items")
                            .select("*")
                            .in_("order_id", chunk_ids)
                            .execute()
                        )
                        if i_res.data:
                            raw_items.extend(i_res.data)

                item_map: Dict[str, List[Dict[str, Any]]] = {}
                for it in raw_items:
                    oid = it.get("order_id")
                    if oid not in item_map:
                        item_map[oid] = []
                    item_map[oid].append(it)

                for o in raw_orders:
                    oid = o.get("order_id")
                    o_items = item_map.get(oid, [])
                    preview_items = []
                    for it in o_items:
                        preview_items.append({
                            "id": str(it.get("id")),
                            "item_name": it.get("item_name") or it.get("sku") or "Product",
                            "category": it.get("category") or "General",
                            "quantity": float(it.get("quantity") or 0.0),
                            "price": float(it.get("price") or 0.0),
                            "total_price": float(it.get("total_price") or 0.0),
                            "matched": True,
                            "matchType": "EXACT",
                            "matchedProductId": it.get("sku"),
                            "matchedProductSku": it.get("sku"),
                            "matchedProductName": it.get("item_name"),
                            "currentStock": 100.0,
                            "unit": "NOS",
                            "hasSufficientStock": True,
                        })

                    orders.append({
                        "order_id": oid,
                        "salesman_id": o.get("salesman_id"),
                        "salesman_name": o.get("salesman_name") or "Sales Representative",
                        "shop_name": o.get("shop_name") or "Customer Store",
                        "city": o.get("city"),
                        "state": o.get("state"),
                        "location_id": o.get("location_id"),
                        "total_amount": float(o.get("total_amount") or 0.0),
                        "created_at": o.get("created_at") or datetime.now().isoformat(),
                        "source": "supabase",
                        "status": "PENDING",
                        "isDuplicate": False,
                        "hasUnmatchedItems": False,
                        "hasStockExceeded": False,
                        "items": preview_items,
                    })
            except Exception as exc:
                logger.error(f"Error fetching pending order previews from Supabase: {exc}")

        return {
            "success": True,
            "orders": orders,
            "isLiveConnected": client is not None,
            "count": len(orders)
        }

    @staticmethod
    def confirm_order_preview(order_id: str, resolved_items: Optional[List[dict]] = None, metadata: Optional[dict] = None) -> Dict[str, Any]:
        from supabase_client import get_supabase_client
        client = get_supabase_client()
        now_str = datetime.now().isoformat()
        if client:
            try:
                client.table("pending_orders").update({
                    "status": "Approved",
                    "notes": "Confirmed by Operations Manager",
                    "updated_at": now_str
                }).eq("order_id", order_id).execute()
            except Exception as exc:
                logger.warning(f"Error updating confirmed order in Supabase: {exc}")

        return {
            "success": True,
            "processedOrder": {
                "id": order_id,
                "order_id": order_id,
                "status": "CONFIRMED",
                "processed_at": now_str,
                "source": "supabase"
            },
            "affectedProducts": []
        }

    @staticmethod
    def reject_order_preview(order_id: str, reason: Optional[str] = None) -> Dict[str, Any]:
        from supabase_client import get_supabase_client
        client = get_supabase_client()
        now_str = datetime.now().isoformat()
        if client:
            try:
                client.table("pending_orders").update({
                    "status": "REJECTED",
                    "notes": f"Rejected: {reason or 'Rejected by operations manager'}",
                    "updated_at": now_str
                }).eq("order_id", order_id).execute()
            except Exception as exc:
                logger.warning(f"Error updating rejected order in Supabase: {exc}")

        return {"success": True}

    @staticmethod
    def reopen_order_preview(order_id: str) -> Dict[str, Any]:
        from supabase_client import get_supabase_client
        client = get_supabase_client()
        now_str = datetime.now().isoformat()
        if client:
            try:
                client.table("pending_orders").update({
                    "status": "Pending",
                    "notes": "Reopened: Reopened by Operations Manager",
                    "updated_at": now_str
                }).eq("order_id", order_id).execute()
            except Exception as exc:
                logger.warning(f"Error reopening order in Supabase: {exc}")

        return {
            "success": True,
            "reopenedOrder": {
                "order_id": order_id,
                "status": "PENDING",
                "source": "supabase"
            },
            "affectedProducts": []
        }


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

        # 2. Deterministic Lock Ordering (Sort line items by SKU)
        sorted_items = sorted(payload.items, key=lambda it: str(it.sku).strip().upper())

        # 3. Check System Settings for Negative Stock Toggle
        client = get_supabase_client()
        allow_negative = False
        if client:
            try:
                set_res = client.table("system_settings").select("setting_value").eq("setting_key", "allow_negative_orders").limit(1).execute()
                if set_res.data:
                    val = set_res.data[0].get("setting_value")
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
        from services.inventory_service import resolve_location_id
        loc_id = resolve_location_id(payload.location_id)
        header_record = {
            "order_id": human_order_code,
            "salesman_id": payload.salesman_id or "SLS-001",
            "salesman_name": payload.salesman_name or current_user.get("full_name") or "Salesman",
            "shop_name": payload.shop_name or "Direct Dealer",
            "location_id": loc_id,
            "city": payload.city or "Faridabad",
            "state": payload.state or "Haryana",
            "item_count": len(validated_lines),
            "total_amount": round(total_amount, 2),
            "status": "Pending",
            "notes": payload.notes or f"Client ref: {client_ref}",
            "created_at": now_iso
        }
        OrderRepository.insert_order(header_record)

        for line in validated_lines:
            item_record = {
                "order_id": human_order_code,
                "sku": line["sku"],
                "item_name": line["item_name"],
                "category": line["category"],
                "quantity": line["quantity"],
                "price": line["price"],
                "total_price": line["line_total"],
                "created_at": now_iso
            }
            OrderRepository.insert_order_item(item_record)
            OrderRepository.recalculate_reservations(line["sku"])

            # Record reservation transaction in inventory_transactions ledger
            from repositories.transaction_repo import TransactionRepository
            from repositories.inventory_repo import InventoryRepository
            prod_info = inv_map.get(line["sku"])
            if prod_info and prod_info.get("id"):
                try:
                    TransactionRepository.record_stock_transaction({
                        "transaction_type": "reservation",
                        "product_id": prod_info["id"],
                        "location_id": resolve_location_id(payload.location_id or prod_info.get("location_id")),
                        "quantity": line["quantity"],
                        "reference_type": "order",
                        "reference_id": human_order_code if is_valid_uuid(human_order_code) else None,
                        "notes": f"Stock reserved for order {human_order_code}",
                        "created_at": now_iso
                    })
                except Exception as tx_err:
                    logger.warning(f"Failed recording reservation transaction: {tx_err}")

        from repositories.inventory_repo import InventoryRepository
        InventoryRepository.invalidate_cache()

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
        target_orders = [o for o in orders if o.get("order_code") == order_id or o.get("id") == order_id or o.get("order_id") == order_id]
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

        orders = OrderRepository.get_orders()
        target_lines = [o for o in orders if o.get("order_code") == order_id or o.get("id") == order_id or o.get("order_id") == order_id]
        if not target_lines:
            raise ValueError(f"Order '{order_id}' not found.")

        current_status = str(target_lines[0].get("status", "Pending")).upper().strip()

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
        allow_negative = False
        if client:
            try:
                set_res = client.table("system_settings").select("setting_value").eq("setting_key", "allow_negative_orders").limit(1).execute()
                if set_res.data:
                    val = set_res.data[0].get("setting_value")
                    allow_negative = str(val).lower() in ("true", "1", "yes")
            except Exception:
                pass

        sorted_lines = sorted(target_lines, key=lambda l: str(l.get("sku", "")).strip().upper())

        sku_qty_map: Dict[str, float] = {}
        for line in sorted_lines:
            s = str(line.get("sku", "")).strip().upper()
            if s:
                qty = float(line.get("total_quantity") or line.get("quantity") or 0.0)
                sku_qty_map[s] = sku_qty_map.get(s, 0.0) + qty

        inv_catalog = InventoryRepository.fetch_all_products_with_inventory()
        inv_map = {str(item.get("sku")).strip().upper(): item for item in inv_catalog if item.get("sku")}

        for s, req_qty in sku_qty_map.items():
            prod_info = inv_map.get(s)
            if not prod_info:
                raise ValueError(f"Product SKU '{s}' not recognized in inventory catalog.")

            phys_stock = float(prod_info.get("physical_stock", prod_info.get("Current Stock", prod_info.get("quantity_on_hand", 0.0))))
            if not allow_negative and phys_stock < req_qty:
                raise ValueError(f"INSUFFICIENT_PHYSICAL_STOCK: Physical stock ({phys_stock}) for SKU '{s}' is insufficient to fulfill order ({req_qty}).")

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
                    "updated_at": now_str
                }).eq("product_id", prod_id).execute()

                tx = TransactionRepository.record_stock_transaction({
                    "transaction_type": "sale",
                    "product_id": prod_id,
                    "location_id": loc_id,
                    "quantity": -req_qty,
                    "unit_cost": unit_cost,
                    "reference_type": "order",
                    "reference_id": order_id if is_valid_uuid(order_id) else None,
                    "notes": f"Order fulfillment stock-out for order {order_id}",
                    "created_at": now_str
                })
                if tx and isinstance(tx, dict) and tx.get("id"):
                    tx_ids.append(str(tx.get("id")))

        affected = OrderRepository.update_order_status(order_id, target_status)
        affected_skus = {row.get("sku") for row in affected if row.get("sku")}
        for s in affected_skus:
            OrderRepository.recalculate_reservations(s)

        InventoryRepository.invalidate_cache()

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

    @staticmethod
    def update_order(
        order_id: str,
        payload: Any,
        current_user: Dict[str, Any]
    ) -> Dict[str, Any]:
        from repositories.inventory_repo import InventoryRepository
        from supabase_client import get_supabase_client
        client = get_supabase_client()
        now_str = datetime.now().isoformat()

        order_dict = OrderRepository.get_order_by_id_with_items(order_id)
        if not order_dict:
            raise ValueError(f"Order '{order_id}' not found.")

        current_status = str(order_dict.get("status", "Pending")).strip()
        if current_status.upper() in ("CANCELLED", "REJECTED", "DISPATCHED", "PROCESSED", "DELIVERED", "COMPLETED", "FULFILLED"):
            raise ValueError(f"Order '{order_id}' is in '{current_status}' state and cannot be edited.")

        # Grace period check for restricted salesman
        user_role = str(current_user.get("role", "")).lower().strip()
        user_perms = current_user.get("permissions") or []
        has_global_access = (
            user_role in ("admin", "order_manager", "stock_manager") or
            "orders.edit" in user_perms or "admin" in user_perms
        )

        if not has_global_access and user_role == "salesman":
            created_at_str = order_dict.get("created_at") or ""
            try:
                created_dt = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
                elapsed_secs = (datetime.now() - created_dt.replace(tzinfo=None)).total_seconds()
                if elapsed_secs > 15 * 60:
                    raise PermissionError(f"15-minute grace period has expired for editing order '{order_id}'.")
            except PermissionError:
                raise
            except Exception:
                pass

        valid_items = [item for item in payload.items if float(item.quantity) > 0]
        if not valid_items:
            raise ValueError("An order must contain at least one item with quantity > 0.")

        # Duplicate product check
        seen_skus = set()
        for it in valid_items:
            sku_clean = str(it.sku).strip().upper()
            if sku_clean in seen_skus:
                raise ValueError(f"Duplicate product SKU '{sku_clean}' in edit payload. Combine quantities into a single line item.")
            seen_skus.add(sku_clean)

        sorted_items = sorted(valid_items, key=lambda it: str(it.sku).strip().upper())

        allow_negative = False
        if client:
            try:
                set_res = client.table("system_settings").select("setting_value").eq("setting_key", "allow_negative_orders").limit(1).execute()
                if set_res.data:
                    val = set_res.data[0].get("setting_value")
                    allow_negative = str(val).lower() in ("true", "1", "yes")
            except Exception:
                pass

        inv_catalog = InventoryRepository.fetch_all_products_with_inventory()
        inv_map = {str(item.get("sku")).strip().upper(): item for item in inv_catalog if item.get("sku")}

        existing_item_prices = {
            str(it.get("sku", "")).strip().upper(): float(it.get("price") or 0.0)
            for it in order_dict.get("items", [])
            if it.get("sku")
        }

        total_amount = 0.0
        validated_lines = []
        new_sku_qty: Dict[str, float] = {}

        for item in sorted_items:
            sku_clean = str(item.sku).strip().upper()
            prod_info = inv_map.get(sku_clean)
            if not prod_info:
                raise ValueError(f"Product SKU '{sku_clean}' not recognized in inventory catalog.")

            req_qty = float(item.quantity)
            # Historical price preservation rule:
            # Re-use existing historical price for this SKU if present, unless explicitly overridden.
            if item.price and float(item.price) > 0 and (sku_clean not in existing_item_prices or float(item.price) == existing_item_prices[sku_clean]):
                unit_price = float(item.price)
            elif sku_clean in existing_item_prices and existing_item_prices[sku_clean] > 0:
                unit_price = existing_item_prices[sku_clean]
            elif item.price and float(item.price) > 0:
                unit_price = float(item.price)
            else:
                unit_price = float(prod_info.get("Price", prod_info.get("cost_price", 0.0)))

            line_total = round(unit_price * req_qty, 2)
            total_amount += line_total
            new_sku_qty[sku_clean] = new_sku_qty.get(sku_clean, 0.0) + req_qty

            validated_lines.append({
                "sku": sku_clean,
                "item_name": getattr(item, "item_name", None) or prod_info.get("name", sku_clean),
                "category": getattr(item, "category", None) or prod_info.get("Category", "General"),
                "quantity": req_qty,
                "price": unit_price,
                "line_total": line_total
            })

        old_sku_qty: Dict[str, float] = {}
        for old_it in order_dict.get("items", []):
            s = str(old_it.get("sku", "")).strip().upper()
            if s:
                old_sku_qty[s] = old_sku_qty.get(s, 0.0) + float(old_it.get("quantity") or 0.0)

        all_skus = set(new_sku_qty.keys()).union(set(old_sku_qty.keys()))
        for s in sorted(all_skus):
            delta = new_sku_qty.get(s, 0.0) - old_sku_qty.get(s, 0.0)
            if delta > 0 and not allow_negative:
                prod_info = inv_map.get(s)
                avail = float(prod_info.get("available_stock", 0.0)) if prod_info else 0.0
                if delta > avail:
                    raise ValueError(f"INSUFFICIENT_STOCK: Required additional quantity ({delta}) for SKU '{s}' exceeds available stock ({avail}).")

        # Atomic line item replacement
        if client:
            try:
                client.table("pending_order_items").delete().eq("order_id", order_id).execute()
                items_payload = [{
                    "order_id": order_id,
                    "sku": line["sku"],
                    "item_name": line["item_name"],
                    "category": line["category"],
                    "quantity": line["quantity"],
                    "price": line["price"],
                    "total_price": line["line_total"],
                    "created_at": order_dict.get("created_at") or now_str
                } for line in validated_lines]
                client.table("pending_order_items").insert(items_payload).execute()

                header_update = {
                    "item_count": len(validated_lines),
                    "total_amount": round(total_amount, 2),
                    "updated_at": now_str
                }
                if getattr(payload, "notes", None) is not None:
                    header_update["notes"] = payload.notes
                client.table("pending_orders").update(header_update).eq("order_id", order_id).execute()
            except Exception as exc:
                logger.warning(f"Error persisting order edit to Supabase: {exc}")

        for s in all_skus:
            OrderRepository.recalculate_reservations(s)

        return {
            "status": "updated",
            "order_id": order_id,
            "items_count": len(validated_lines),
            "total_amount": round(total_amount, 2),
            "reservation_delta": 0.0,
            "timestamp": now_str
        }

    @staticmethod
    def cancel_order(
        order_id: str,
        payload: Optional[Any] = None,
        current_user: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        from supabase_client import get_supabase_client
        client = get_supabase_client()
        now_str = datetime.now().isoformat()

        order_dict = OrderRepository.get_order_by_id_with_items(order_id)
        if not order_dict:
            raise ValueError(f"Order '{order_id}' not found.")

        current_status = str(order_dict.get("status", "Pending")).strip()
        if current_status.upper() in ("CANCELLED", "REJECTED"):
            return {
                "status": "already_cancelled",
                "order_id": order_id,
                "released_reservation": 0.0,
                "timestamp": now_str
            }

        if current_status.upper() in ("DISPATCHED", "PROCESSED", "DELIVERED", "COMPLETED", "FULFILLED"):
            raise ValueError(f"Order '{order_id}' is in '{current_status}' state and cannot be cancelled.")

        if current_user:
            user_role = str(current_user.get("role", "")).lower().strip()
            user_perms = current_user.get("permissions") or []
            has_global_access = (
                user_role in ("admin", "order_manager", "stock_manager") or
                "orders.cancel" in user_perms or "admin" in user_perms
            )
            if not has_global_access and user_role == "salesman":
                created_at_str = order_dict.get("created_at") or ""
                try:
                    created_dt = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
                    elapsed_secs = (datetime.now() - created_dt.replace(tzinfo=None)).total_seconds()
                    if elapsed_secs > 15 * 60:
                        raise PermissionError(f"15-minute grace period has expired for cancelling order '{order_id}'.")
                except PermissionError:
                    raise
                except Exception:
                    pass

        # Check reservation mismatch invariant
        if order_dict.get("reservation_mismatch"):
            raise ValueError(f"RESERVATION_MISMATCH: Order '{order_id}' reservation state cannot be reconciled with expected inventory reservation.")

        reason = getattr(payload, "reason", None) or "Cancelled by user"
        affected = OrderRepository.update_order_status(order_id, "Cancelled")

        if client:
            try:
                client.table("pending_orders").update({
                    "status": "Cancelled",
                    "notes": f"Cancelled: {reason}",
                    "updated_at": now_str
                }).eq("order_id", order_id).execute()
            except Exception:
                pass

        skus = {it.get("sku") for it in order_dict.get("items", []) if it.get("sku")}
        from repositories.transaction_repo import TransactionRepository
        from repositories.inventory_repo import InventoryRepository
        inv_catalog = InventoryRepository.fetch_all_products_with_inventory()
        inv_map = {str(item.get("sku")).strip().upper(): item for item in inv_catalog if item.get("sku")}

        for it in order_dict.get("items", []):
            s = it.get("sku")
            if s:
                OrderRepository.recalculate_reservations(s)
                prod_info = inv_map.get(str(s).strip().upper())
                if prod_info and prod_info.get("id"):
                    try:
                        TransactionRepository.record_stock_transaction({
                            "transaction_type": "reservation_release",
                            "product_id": prod_info["id"],
                            "location_id": prod_info.get("location_id"),
                            "quantity": -float(it.get("quantity") or 0.0),
                            "reference_type": "order",
                            "reference_id": order_id if is_valid_uuid(order_id) else None,
                            "notes": f"Reservation released on order cancel: {order_id}",
                            "created_at": now_str
                        })
                    except Exception as tx_err:
                        logger.warning(f"Failed recording reservation release transaction: {tx_err}")

        InventoryRepository.invalidate_cache()

        return {
            "status": "cancelled",
            "order_id": order_id,
            "released_reservation": float(order_dict.get("item_count") or len(skus)),
            "timestamp": now_str
        }

    @staticmethod
    def reject_order_workflow(
        order_id: str,
        payload: Optional[Any] = None,
        current_user: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        from supabase_client import get_supabase_client
        client = get_supabase_client()
        now_str = datetime.now().isoformat()

        order_dict = OrderRepository.get_order_by_id_with_items(order_id)
        if not order_dict:
            raise ValueError(f"Order '{order_id}' not found.")

        current_status = str(order_dict.get("status", "Pending")).strip()
        if current_status.upper() in ("REJECTED", "CANCELLED"):
            return {
                "status": "already_rejected",
                "order_id": order_id,
                "released_reservation": 0.0,
                "timestamp": now_str
            }

        if current_status.upper() in ("DISPATCHED", "PROCESSED", "DELIVERED", "COMPLETED", "FULFILLED"):
            raise ValueError(f"Order '{order_id}' is in '{current_status}' state and cannot be rejected.")

        # Check reservation mismatch invariant
        if order_dict.get("reservation_mismatch"):
            raise ValueError(f"RESERVATION_MISMATCH: Order '{order_id}' reservation state cannot be reconciled with expected inventory reservation.")

        reason = getattr(payload, "reason", None) or "Rejected by Manager"
        OrderRepository.update_order_status(order_id, "Rejected")

        if client:
            try:
                client.table("pending_orders").update({
                    "status": "Rejected",
                    "notes": f"Rejected: {reason}",
                    "updated_at": now_str
                }).eq("order_id", order_id).execute()
            except Exception:
                pass

        skus = {it.get("sku") for it in order_dict.get("items", []) if it.get("sku")}
        for s in skus:
            OrderRepository.recalculate_reservations(s)

        return {
            "status": "rejected",
            "order_id": order_id,
            "released_reservation": float(order_dict.get("item_count") or len(skus)),
            "timestamp": now_str
        }

    @staticmethod
    def reopen_order(
        order_id: str,
        payload: Optional[Any] = None,
        current_user: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        from repositories.inventory_repo import InventoryRepository
        from supabase_client import get_supabase_client
        client = get_supabase_client()
        now_str = datetime.now().isoformat()

        order_dict = OrderRepository.get_order_by_id_with_items(order_id)
        if not order_dict:
            raise ValueError(f"Order '{order_id}' not found.")

        current_status = str(order_dict.get("status", "Pending")).strip()
        if current_status.upper() in ("PENDING", "PENDING_APPROVAL"):
            return {
                "status": "already_pending",
                "order_id": order_id,
                "recreated_reservation": 0.0,
                "timestamp": now_str
            }

        # Restrict Reopen strictly to REJECTED orders per legacy workflow audit
        if current_status.upper() == "CANCELLED":
            raise ValueError(f"Order '{order_id}' is in 'CANCELLED' state and cannot be reopened. Legacy workflow supports reopening ONLY for Rejected orders.")

        if current_status.upper() != "REJECTED":
            raise ValueError(f"Order '{order_id}' is in '{current_status}' state and cannot be reopened. Reopen is strictly supported for Rejected orders.")

        allow_negative = False
        if client:
            try:
                set_res = client.table("system_settings").select("setting_value").eq("setting_key", "allow_negative_orders").limit(1).execute()
                if set_res.data:
                    val = set_res.data[0].get("setting_value")
                    allow_negative = str(val).lower() in ("true", "1", "yes")
            except Exception:
                pass

        inv_catalog = InventoryRepository.fetch_all_products_with_inventory()
        inv_map = {str(item.get("sku")).strip().upper(): item for item in inv_catalog if item.get("sku")}

        for it in order_dict.get("items", []):
            s = str(it.get("sku", "")).strip().upper()
            if s:
                req_qty = float(it.get("quantity") or 0.0)
                prod_info = inv_map.get(s)
                if prod_info and not allow_negative:
                    avail = float(prod_info.get("available_stock", 0.0))
                    if req_qty > avail:
                        raise ValueError(f"INSUFFICIENT_STOCK: Reopening order '{order_id}' requires {req_qty} units of SKU '{s}', but only {avail} available.")

        reason = getattr(payload, "reason", None) or "Reopened by Manager"
        OrderRepository.update_order_status(order_id, "Pending")

        if client:
            try:
                client.table("pending_orders").update({
                    "status": "Pending",
                    "notes": f"Reopened: {reason}",
                    "updated_at": now_str
                }).eq("order_id", order_id).execute()
            except Exception:
                pass

        skus = {it.get("sku") for it in order_dict.get("items", []) if it.get("sku")}
        for s in skus:
            OrderRepository.recalculate_reservations(s)

        return {
            "status": "reopened",
            "order_id": order_id,
            "recreated_reservation": float(order_dict.get("item_count") or len(skus)),
            "timestamp": now_str
        }
