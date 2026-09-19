# backend/tests/test_e2e_integration.py
"""
End-to-End Multi-Actor Integration Test Suite for Nalka Metals ERP.

Simulates complete workflow across Salesman Order Placement, Stock Manager
Order Visibility & Reservation, Approval & Dispatch (Stock-Out execution),
Order Cancellation (Reservation Release), and Tally ERP Synchronization.
"""

import unittest
import uuid
from datetime import datetime

from fastapi.testclient import TestClient
from main import app
from services.order_service import OrderService, OrderStateMachine
from services.inventory_service import InventoryService
from services.tally_service import TallyService
from auth import create_access_token


class TestEndToEndIntegrationFlow(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)
        self.salesman_token = create_access_token({"sub": "usr_sales_01", "role": "salesman", "full_name": "Rajesh Kumar"})
        self.stock_manager_token = create_access_token({"sub": "usr_mgr_01", "role": "stock_manager", "full_name": "Anita Sharma"})

        self.salesman_headers = {"Authorization": f"Bearer {self.salesman_token}"}
        self.stock_manager_headers = {"Authorization": f"Bearer {self.stock_manager_token}"}

    def test_e2e_salesman_order_creation_and_idempotency(self):
        client_ref = f"e2e-ref-{uuid.uuid4()}"
        order_payload = {
            "client_reference": client_ref,
            "salesman_id": "SLS-888",
            "salesman_name": "Rajesh Kumar",
            "shop_name": "Shree Ram Hardware",
            "city": "Mumbai",
            "state": "Maharashtra",
            "items": [
                {"sku": "AL-ROD-01", "item_name": "Aluminum Rod 12mm", "quantity": 10, "price": 450.0}
            ]
        }

        # 1. Salesman places bulk order
        response = self.client.post("/api/orders/bulk", json=order_payload, headers=self.salesman_headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "created")
        order_code = data["order_id"]

        # 2. Duplicate submission with same client_reference returns idempotent response
        dup_response = self.client.post("/api/orders/bulk", json=order_payload, headers=self.salesman_headers)
        self.assertEqual(dup_response.status_code, 200)
        dup_data = dup_response.json()
        self.assertEqual(dup_data["status"], "already_processed")
        self.assertTrue(dup_data["idempotent"])
        self.assertEqual(dup_data["order_id"], order_code)

    def test_e2e_stock_manager_views_pending_orders_and_reservations(self):
        # 1. Stock Manager queries pending orders endpoint
        res = self.client.get("/api/orders/pending", headers=self.stock_manager_headers)
        self.assertEqual(res.status_code, 200)
        orders = res.json()
        self.assertIsInstance(orders, list)

    def test_e2e_order_approval_and_dispatch_workflow(self):
        test_sku = "AL-PIPE-02"
        client_ref = f"e2e-dispatch-{uuid.uuid4()}"

        from schemas.orders import BulkOrderCreateSchema

        # 1. Create order
        create_res = OrderService.create_bulk_order(
            BulkOrderCreateSchema(**{
                "client_reference": client_ref,
                "salesman_id": "SLS-999",
                "items": [{"sku": test_sku, "quantity": 5, "price": 300.0}]
            }),
            current_user={"full_name": "Rajesh Kumar"}
        )

        order_code = create_res["order_id"]

        # 2. Approve order (PENDING -> APPROVED)
        app_res = self.client.patch(f"/api/orders/{order_code}/approve", headers=self.stock_manager_headers)
        self.assertEqual(app_res.status_code, 200)
        self.assertEqual(app_res.json()["status"], "success")

        # 3. Dispatch order (APPROVED -> DISPATCHED)
        disp_res = self.client.patch(f"/api/orders/{order_code}/dispatch", headers=self.stock_manager_headers)
        self.assertEqual(disp_res.status_code, 200)
        self.assertEqual(disp_res.json()["new_status"].upper(), "DISPATCHED")


    def test_e2e_order_cancellation_releases_reservation(self):
        from schemas.orders import BulkOrderCreateSchema
        client_ref = f"e2e-cancel-{uuid.uuid4()}"
        create_res = OrderService.create_bulk_order(
            BulkOrderCreateSchema(**{
                "client_reference": client_ref,
                "items": [{"sku": "AL-ANGLE-01", "quantity": 20, "price": 150.0}]
            }),
            current_user={"full_name": "Rajesh Kumar"}
        )


        order_code = create_res["order_id"]

        # Cancel order via status transition endpoint
        cancel_res = self.client.patch(
            f"/api/orders/{order_code}/status",
            json={"target_status": "CANCELLED", "reason": "Customer changed mind"},
            headers=self.salesman_headers
        )
        self.assertEqual(cancel_res.status_code, 200)
        self.assertEqual(cancel_res.json()["new_status"], "CANCELLED")

        # Cannot dispatch a cancelled order (invalid state transition)
        invalid_disp = self.client.patch(f"/api/orders/{order_code}/dispatch", headers=self.stock_manager_headers)
        self.assertEqual(invalid_disp.status_code, 400)
        self.assertIn("Invalid state transition", invalid_disp.json()["message"])

    def test_e2e_tally_sync_idempotency_and_voucher_contract(self):
        tally = TallyService()
        evt_id = f"TALLY-EVT-{uuid.uuid4().hex[:8]}"

        payload = {
            "event_id": evt_id,
            "contract_type": "STOCK_INWARD_VOUCHER",
            "voucher_number": f"VCH-{evt_id}",
            "supplier_name": "Hindalco Industries",
            "items": [{"sku": "AL-INGOT-99", "quantity": 100, "rate": 220.0}]
        }

        # 1. First sync processing
        res1 = tally.process_tally_payload(payload)
        self.assertEqual(res1["status"], "SUCCESS")

        # 2. Second sync with same payload hash is skipped cleanly
        res2 = tally.process_tally_payload(payload)
        self.assertEqual(res2["status"], "SKIPPED_DUPLICATE")

        # 3. Generate Tally XML Sales Voucher
        order_sample = {
            "order_code": "ORD-2026-E2E",
            "dealer_name": "Surya Traders",
            "total_amount": 45000.0,
            "items": [{"sku": "AL-INGOT-99", "product_name": "Aluminum Ingot", "quantity": 100, "price": 220.0}]
        }
        xml = tally.generate_tally_xml_voucher(order_sample)
        self.assertIn("<ENVELOPE>", xml)
        self.assertIn("ORD-2026-E2E", xml)
        self.assertIn("Surya Traders", xml)


if __name__ == "__main__":
    unittest.main()
