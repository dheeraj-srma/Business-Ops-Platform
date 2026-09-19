# backend/tests/test_orders_inventory.py
"""Automated unit test suite for Order calculation, Stock Reservations,
Insufficient Stock rules, and Idempotent submissions using standard unittest.
"""

import unittest
from datetime import datetime

RESERVATION_ELIGIBLE_STATUSES = {"pending", "processing", "reserved", "approved"}

def calculate_bulk_order_total(items):
    """Calculates price and total amount for bulk line items."""
    total = 0.0
    for item in items:
        qty = item.get("quantity", 0)
        price = item.get("price", 0.0)
        line_total = item.get("total_price") or (qty * price)
        total += line_total
    return round(total, 2)

def validate_stock_availability(inventory_item, requested_qty):
    """Validates if requested quantity exceeds available stock."""
    current_stock = inventory_item.get("current_stock", 0)
    reserved_stock = inventory_item.get("reserved_stock", 0)
    available_stock = current_stock - reserved_stock

    if requested_qty <= 0:
        return False, "Quantity must be greater than zero"
    if requested_qty > available_stock:
        return False, f"Insufficient stock: requested {requested_qty}, available {available_stock}"
    return True, "OK"

def calculate_active_reservations(orders_list, sku):
    """Recalculates product reservation quantity filtering strictly by active order status."""
    total_reserved = 0
    for order in orders_list:
        if order.get("sku") == sku:
            status = str(order.get("status", "")).lower()
            if status in RESERVATION_ELIGIBLE_STATUSES:
                total_reserved += order.get("quantity", 0)
    return total_reserved

def process_order_submission(submitted_orders_db, payload):
    """Simulates idempotent bulk order creation with client_reference."""
    client_ref = payload.get("client_reference")
    if client_ref:
        existing = [o for o in submitted_orders_db if o.get("client_reference") == client_ref]
        if existing:
            return {
                "status": "already_processed",
                "order_id": existing[0]["order_code"],
                "idempotent": True
            }

    order_code = f"ORD-{datetime.now().strftime('%Y%m%d')}-TEST"
    created = []
    for item in payload.get("items", []):
        record = {
            "id": f"uuid-{len(submitted_orders_db)+1}",
            "order_code": order_code,
            "client_reference": client_ref,
            "sku": item["sku"],
            "quantity": item["quantity"],
            "status": "Pending"
        }
        submitted_orders_db.append(record)
        created.append(record)

    return {
        "status": "created",
        "order_id": order_code,
        "items_count": len(created)
    }


class TestOrderAndInventoryRules(unittest.TestCase):

    def test_price_and_total_calculation(self):
        items = [
            {"sku": "SKU-001", "quantity": 5, "price": 100.0},
            {"sku": "SKU-002", "quantity": 2, "price": 250.50},
        ]
        total = calculate_bulk_order_total(items)
        self.assertEqual(total, 1001.0)

    def test_insufficient_stock_validation(self):
        inv_item = {"sku": "SKU-001", "current_stock": 10, "reserved_stock": 3}  # available = 7
        valid, msg = validate_stock_availability(inv_item, 5)
        self.assertTrue(valid)

        valid_exceeded, msg_exceeded = validate_stock_availability(inv_item, 8)
        self.assertFalse(valid_exceeded)
        self.assertIn("Insufficient stock", msg_exceeded)

    def test_reservation_calculation_filtering_by_status(self):
        orders = [
            {"sku": "SKU-100", "quantity": 5, "status": "Pending"},
            {"sku": "SKU-100", "quantity": 3, "status": "Approved"},
            {"sku": "SKU-100", "quantity": 4, "status": "Rejected"},   # Should NOT count
            {"sku": "SKU-100", "quantity": 2, "status": "Cancelled"},  # Should NOT count
        ]
        reserved = calculate_active_reservations(orders, "SKU-100")
        self.assertEqual(reserved, 8)

    def test_duplicate_submission_idempotency(self):
        db = []
        payload = {
            "client_reference": "unique-client-uuid-12345",
            "items": [{"sku": "SKU-001", "quantity": 2, "price": 50.0}]
        }

        # First submission
        res1 = process_order_submission(db, payload)
        self.assertEqual(res1["status"], "created")
        self.assertEqual(len(db), 1)

        # Second submission with same idempotency key
        res2 = process_order_submission(db, payload)
        self.assertEqual(res2["status"], "already_processed")
        self.assertTrue(res2["idempotent"])
        self.assertEqual(len(db), 1)

    def test_order_state_machine_valid_and_invalid_transitions(self):
        from services.order_service import OrderStateMachine
        self.assertTrue(OrderStateMachine.is_transition_allowed("PENDING", "APPROVED"))
        self.assertTrue(OrderStateMachine.is_transition_allowed("APPROVED", "DISPATCHED"))
        self.assertTrue(OrderStateMachine.is_transition_allowed("DISPATCHED", "DELIVERED"))
        self.assertTrue(OrderStateMachine.is_transition_allowed("PENDING", "REJECTED"))

        # Invalid transitions
        self.assertFalse(OrderStateMachine.is_transition_allowed("DELIVERED", "APPROVED"))
        self.assertFalse(OrderStateMachine.is_transition_allowed("CANCELLED", "DISPATCHED"))
        self.assertFalse(OrderStateMachine.is_transition_allowed("REJECTED", "PROCESSING"))


if __name__ == "__main__":
    unittest.main()


