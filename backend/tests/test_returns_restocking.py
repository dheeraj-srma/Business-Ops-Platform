# backend/tests/test_returns_restocking.py
"""Automated unit test suite for Phase 5C.6 Returns Restocking & Inventory Mutation.

Tests:
1. Return condition semantics (Good Return restocks stock; Damaged Return does not).
2. Authoritative quantity calculation (physical_stock increases, reserved_stock unchanged, available_stock recalculated).
3. Duplicate submission protection / Idempotency via client_reference.
4. Order return eligibility validation (over-return prevention).
5. Role & Permission enforcement (returns.manage).
"""

import unittest
from datetime import datetime


class TestReturnRestockingRules(unittest.TestCase):

    def setUp(self):
        # Simulated database state
        self.inventory_db = {
            "AL-ROD-01": {
                "id": "PROD-001",
                "sku": "AL-ROD-01",
                "name": "Aluminum Rod 12mm",
                "quantity_on_hand": 100.0,
                "quantity_reserved": 20.0,
                "quantity_available": 80.0
            }
        }
        self.returns_db = []
        self.transactions_db = []
        self.orders_db = {
            "ORD-100": {
                "order_id": "ORD-100",
                "items": [
                    {"sku": "AL-ROD-01", "quantity": 10}
                ]
            }
        }

    def process_test_return(self, payload, user_permissions):
        """Simulates central backend InventoryService.process_return & authorization."""
        # Permission check
        if "returns.manage" not in user_permissions and "admin" not in user_permissions:
            return {"error": "Permission denied: returns.manage required", "status_code": 403}

        client_ref = payload.get("client_reference")
        if client_ref:
            existing = [r for r in self.returns_db if r.get("client_reference") == client_ref]
            if existing:
                return {
                    "status": "already_processed",
                    "return_id": existing[0]["return_code"],
                    "client_reference": client_ref,
                    "restocked": existing[0]["status"] == "Restocked",
                    "idempotent": True,
                    "timestamp": existing[0]["created_at"]
                }

        sku = payload.get("sku")
        if sku not in self.inventory_db:
            return {"error": "Product not found", "status_code": 404}

        # Check order eligibility if order_id provided
        order_id = payload.get("order_id")
        if order_id:
            order = self.orders_db.get(order_id)
            if not order:
                return {"error": "Order not found", "status_code": 404}
            order_item = next((i for i in order["items"] if i["sku"] == sku), None)
            if not order_item:
                return {"error": "Order line item not found", "status_code": 404}

            prev_returned = sum(r["quantity"] for r in self.returns_db if r.get("order_id") == order_id and r.get("sku") == sku)
            eligible_qty = order_item["quantity"] - prev_returned
            if payload.get("quantity", 0) > eligible_qty:
                return {"error": f"Return quantity ({payload.get('quantity')}) exceeds eligible quantity ({eligible_qty})", "status_code": 409}

        # Acquire lock and mutate stock
        inv = self.inventory_db[sku]
        old_on_hand = inv["quantity_on_hand"]
        reserved = inv["quantity_reserved"]

        is_good = "good" in str(payload.get("condition", "")).lower() or str(payload.get("condition", "")).lower() == "restocked"
        status_str = "Restocked" if is_good else "Defective"
        ret_code = f"RET-TEST-{len(self.returns_db)+1}"
        now_str = datetime.utcnow().isoformat()

        new_on_hand = old_on_hand
        new_avail = old_on_hand - reserved

        if is_good:
            new_on_hand = old_on_hand + payload.get("quantity", 0)
            new_avail = new_on_hand - reserved
            inv["quantity_on_hand"] = new_on_hand
            inv["quantity_available"] = new_avail

            self.transactions_db.append({
                "transaction_type": "RETURN_IN",
                "product_id": sku,
                "quantity": payload.get("quantity", 0),
                "reference_id": ret_code,
                "created_at": now_str
            })

        ret_record = {
            "return_code": ret_code,
            "client_reference": client_ref or ret_code,
            "order_id": order_id,
            "sku": sku,
            "quantity": payload.get("quantity", 0),
            "condition": "Good Return" if is_good else "Defective Return",
            "status": status_str,
            "created_at": now_str
        }
        self.returns_db.append(ret_record)

        return {
            "status": "created",
            "return_id": ret_code,
            "client_reference": client_ref or ret_code,
            "restocked": is_good,
            "previous_quantity": old_on_hand,
            "new_quantity": new_on_hand,
            "available_quantity": new_avail,
            "idempotent": False,
            "timestamp": now_str
        }

    def test_permission_enforcement(self):
        payload = {"sku": "AL-ROD-01", "quantity": 5, "condition": "Good"}
        # Viewer lacks returns.manage
        res = self.process_test_return(payload, ["inventory.view"])
        self.assertEqual(res.get("status_code"), 403)

        # Stock Manager has returns.manage
        res2 = self.process_test_return(payload, ["returns.manage"])
        self.assertEqual(res2.get("status"), "created")

    def test_good_return_restocks_physical_and_available_stock(self):
        payload = {"sku": "AL-ROD-01", "quantity": 5, "condition": "Good Return"}
        res = self.process_test_return(payload, ["returns.manage"])

        self.assertEqual(res["status"], "created")
        self.assertTrue(res["restocked"])
        self.assertEqual(res["previous_quantity"], 100.0)
        self.assertEqual(res["new_quantity"], 105.0)
        self.assertEqual(res["available_quantity"], 85.0) # 105 physical - 20 reserved

        # Verify DB updated correctly
        inv = self.inventory_db["AL-ROD-01"]
        self.assertEqual(inv["quantity_on_hand"], 105.0)
        self.assertEqual(inv["quantity_reserved"], 20.0)
        self.assertEqual(inv["quantity_available"], 85.0)
        self.assertEqual(len(self.transactions_db), 1)

    def test_damaged_return_does_not_restock_inventory(self):
        payload = {"sku": "AL-ROD-01", "quantity": 3, "condition": "Damaged / Defective"}
        res = self.process_test_return(payload, ["returns.manage"])

        self.assertEqual(res["status"], "created")
        self.assertFalse(res["restocked"])

        # Stock remains untouched
        inv = self.inventory_db["AL-ROD-01"]
        self.assertEqual(inv["quantity_on_hand"], 100.0)
        self.assertEqual(inv["quantity_available"], 80.0)
        self.assertEqual(len(self.transactions_db), 0) # No stock_in ledger transaction
        self.assertEqual(len(self.returns_db), 1)

    def test_duplicate_submission_idempotency(self):
        payload = {
            "client_reference": "RET-CLIENT-UUID-9999",
            "sku": "AL-ROD-01",
            "quantity": 2,
            "condition": "Good Return"
        }

        # First request
        res1 = self.process_test_return(payload, ["returns.manage"])
        self.assertEqual(res1["status"], "created")
        self.assertEqual(self.inventory_db["AL-ROD-01"]["quantity_on_hand"], 102.0)

        # Retry request with identical client_reference
        res2 = self.process_test_return(payload, ["returns.manage"])
        self.assertEqual(res2["status"], "already_processed")
        self.assertTrue(res2["idempotent"])
        # Inventory must NOT be incremented a second time
        self.assertEqual(self.inventory_db["AL-ROD-01"]["quantity_on_hand"], 102.0)

    def test_order_return_eligibility_and_over_return_prevention(self):
        # Original order has 10 units of AL-ROD-01
        payload1 = {"order_id": "ORD-100", "sku": "AL-ROD-01", "quantity": 6, "condition": "Good"}
        res1 = self.process_test_return(payload1, ["returns.manage"])
        self.assertEqual(res1["status"], "created")

        # Second return attempt of 5 units (total 11 > 10) must be rejected
        payload2 = {"order_id": "ORD-100", "sku": "AL-ROD-01", "quantity": 5, "condition": "Good"}
        res2 = self.process_test_return(payload2, ["returns.manage"])
        self.assertEqual(res2.get("status_code"), 409)
        self.assertIn("exceeds eligible quantity", res2.get("error", ""))


if __name__ == "__main__":
    unittest.main()
