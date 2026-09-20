# backend/tests/test_order_workflow_mutations.py
import unittest
from unittest.mock import patch
from datetime import datetime
from fastapi.testclient import TestClient

from main import app
from repositories.order_repo import OrderRepository, _IN_MEMORY_ORDERS
from repositories.inventory_repo import InventoryRepository
from services.order_service import OrderService
from schemas.order_workflow_schemas import OrderEditRequest, OrderEditItemSchema, OrderCancelRequest, OrderRejectRequest, OrderReopenRequest

MOCK_INVENTORY = [
    {
        "id": "prod-1",
        "product_id": "prod-1",
        "sku": "SKU-A",
        "name": "Product A",
        "Category": "General",
        "physical_stock": 100.0,
        "reserved_stock": 10.0,
        "available_stock": 90.0,
        "Price": 50.0,
        "cost_price": 50.0
    },
    {
        "id": "prod-2",
        "product_id": "prod-2",
        "sku": "SKU-B",
        "name": "Product B",
        "Category": "General",
        "physical_stock": 50.0,
        "reserved_stock": 5.0,
        "available_stock": 45.0,
        "Price": 100.0,
        "cost_price": 100.0
    },
    {
        "id": "prod-3",
        "product_id": "prod-3",
        "sku": "SKU-C",
        "name": "Product C",
        "Category": "General",
        "physical_stock": 10.0,
        "reserved_stock": 0.0,
        "available_stock": 10.0,
        "Price": 200.0,
        "cost_price": 200.0
    }
]

class TestOrderWorkflowMutations(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)
        _IN_MEMORY_ORDERS.clear()

        self.test_order = {
            "id": "uuid-mut-1",
            "order_id": "ORD-MUT-001",
            "order_code": "ORD-MUT-001",
            "salesman_id": "SLS-001",
            "salesman_name": "Salesman Alpha",
            "shop_name": "Metro Store",
            "item_count": 2,
            "total_amount": 1000.0,
            "status": "Pending",
            "created_by": "SLS-001",
            "created_at": datetime.now().isoformat(),
            "items": [
                {
                    "id": "it-1",
                    "order_id": "ORD-MUT-001",
                    "sku": "SKU-A",
                    "item_name": "Product A",
                    "category": "General",
                    "quantity": 10.0,
                    "price": 50.0,
                    "total_price": 500.0
                },
                {
                    "id": "it-2",
                    "order_id": "ORD-MUT-001",
                    "sku": "SKU-B",
                    "item_name": "Product B",
                    "category": "General",
                    "quantity": 5.0,
                    "price": 100.0,
                    "total_price": 500.0
                }
            ]
        }
        _IN_MEMORY_ORDERS.append(self.test_order)

    def tearDown(self):
        _IN_MEMORY_ORDERS.clear()

    @patch.object(InventoryRepository, 'fetch_all_products_with_inventory', return_value=MOCK_INVENTORY)
    def test_multi_product_quantity_edit_increase_and_decrease(self, mock_inv):
        user = {"id": "SLS-001", "role": "salesman", "permissions": ["orders.edit"]}
        payload = OrderEditRequest(
            items=[
                OrderEditItemSchema(sku="SKU-A", quantity=15.0, price=50.0), # Increase A by 5
                OrderEditItemSchema(sku="SKU-B", quantity=2.0, price=100.0)   # Decrease B by 3
            ],
            notes="Updated quantity"
        )
        
        res = OrderService.update_order("ORD-MUT-001", payload, user)
        self.assertEqual(res["status"], "updated")
        self.assertEqual(res["total_amount"], 950.0) # (15*50) + (2*100) = 750 + 200 = 950

    @patch.object(InventoryRepository, 'fetch_all_products_with_inventory', return_value=MOCK_INVENTORY)
    def test_add_and_remove_product_in_edit(self, mock_inv):
        user = {"id": "admin-1", "role": "admin", "permissions": ["orders.edit"]}
        payload = OrderEditRequest(
            items=[
                OrderEditItemSchema(sku="SKU-A", quantity=10.0, price=50.0), # Keep A
                OrderEditItemSchema(sku="SKU-C", quantity=2.0, price=200.0)   # Add C, Remove B
            ]
        )
        
        res = OrderService.update_order("ORD-MUT-001", payload, user)
        self.assertEqual(res["status"], "updated")
        self.assertEqual(res["items_count"], 2)
        self.assertEqual(res["total_amount"], 900.0) # (10*50) + (2*200) = 500 + 400 = 900

    @patch.object(InventoryRepository, 'fetch_all_products_with_inventory', return_value=MOCK_INVENTORY)
    def test_insufficient_stock_causes_complete_edit_rollback(self, mock_inv):
        user = {"id": "admin-1", "role": "admin", "permissions": ["orders.edit"]}
        payload = OrderEditRequest(
            items=[
                OrderEditItemSchema(sku="SKU-A", quantity=10.0, price=50.0),
                OrderEditItemSchema(sku="SKU-C", quantity=50.0, price=200.0)  # Requires 50, only 10 available -> Fail
            ]
        )
        
        with self.assertRaises(ValueError) as ctx:
            OrderService.update_order("ORD-MUT-001", payload, user)
        self.assertIn("INSUFFICIENT_STOCK", str(ctx.exception))

    @patch.object(InventoryRepository, 'fetch_all_products_with_inventory', return_value=MOCK_INVENTORY)
    def test_duplicate_product_sku_in_edit_rejected(self, mock_inv):
        user = {"id": "admin-1", "role": "admin", "permissions": ["orders.edit"]}
        payload = OrderEditRequest(
            items=[
                OrderEditItemSchema(sku="SKU-A", quantity=5.0, price=50.0),
                OrderEditItemSchema(sku="SKU-A", quantity=10.0, price=50.0)  # Duplicate SKU-A -> Fail
            ]
        )
        
        with self.assertRaises(ValueError) as ctx:
            OrderService.update_order("ORD-MUT-001", payload, user)
        self.assertIn("Duplicate product SKU", str(ctx.exception))

    def test_valid_order_cancellation(self):
        user = {"id": "SLS-001", "role": "salesman", "permissions": ["orders.cancel"]}
        res = OrderService.cancel_order("ORD-MUT-001", OrderCancelRequest(reason="Customer request"), user)
        
        self.assertEqual(res["status"], "cancelled")
        order_dict = OrderRepository.get_order_by_id_with_items("ORD-MUT-001")
        self.assertEqual(order_dict["status"], "Cancelled")

    def test_cancel_already_dispatched_order_rejected(self):
        user = {"id": "admin-1", "role": "admin", "permissions": ["orders.cancel"]}
        self.test_order["status"] = "Dispatched"
        
        with self.assertRaises(ValueError) as ctx:
            OrderService.cancel_order("ORD-MUT-001", OrderCancelRequest(reason="Test"), user)
        self.assertIn("cannot be cancelled", str(ctx.exception))

    def test_valid_order_rejection_by_manager(self):
        user = {"id": "mgr-1", "role": "order_manager", "permissions": ["orders.reject"]}
        res = OrderService.reject_order_workflow("ORD-MUT-001", OrderRejectRequest(reason="Credit limit exceeded"), user)
        
        self.assertEqual(res["status"], "rejected")
        order_dict = OrderRepository.get_order_by_id_with_items("ORD-MUT-001")
        self.assertEqual(order_dict["status"], "Rejected")

    @patch.object(InventoryRepository, 'fetch_all_products_with_inventory', return_value=MOCK_INVENTORY)
    def test_valid_order_reopen(self, mock_inv):
        user = {"id": "mgr-1", "role": "order_manager", "permissions": ["orders.manage"]}
        self.test_order["status"] = "Rejected"
        
        res = OrderService.reopen_order("ORD-MUT-001", OrderReopenRequest(reason="Approval granted"), user)
        self.assertEqual(res["status"], "reopened")
        order_dict = OrderRepository.get_order_by_id_with_items("ORD-MUT-001")
        self.assertEqual(order_dict["status"], "Pending")

    def test_reopen_cancelled_order_rejected(self):
        user = {"id": "mgr-1", "role": "order_manager", "permissions": ["orders.manage"]}
        self.test_order["status"] = "Cancelled"
        
        with self.assertRaises(ValueError) as ctx:
            OrderService.reopen_order("ORD-MUT-001", OrderReopenRequest(reason="Test"), user)
        self.assertIn("cannot be reopened", str(ctx.exception))
        self.assertIn("ONLY for Rejected orders", str(ctx.exception))

    def test_reopen_dispatched_order_rejected(self):
        user = {"id": "mgr-1", "role": "order_manager", "permissions": ["orders.manage"]}
        self.test_order["status"] = "Dispatched"
        
        with self.assertRaises(ValueError) as ctx:
            OrderService.reopen_order("ORD-MUT-001", OrderReopenRequest(reason="Test"), user)
        self.assertIn("cannot be reopened", str(ctx.exception))

    @patch.object(OrderRepository, 'get_order_by_id_with_items', return_value={"order_id": "ORD-MUT-001", "status": "Pending", "items": [{"sku": "SKU-A", "quantity": 10}], "reservation_mismatch": True})
    def test_reservation_mismatch_detection(self, mock_order):
        user = {"id": "admin-1", "role": "admin", "permissions": ["orders.cancel"]}
        
        with self.assertRaises(ValueError) as ctx:
            OrderService.cancel_order("ORD-MUT-001", OrderCancelRequest(reason="Mismatch test"), user)
        self.assertIn("RESERVATION_MISMATCH", str(ctx.exception))

    @patch.object(InventoryRepository, 'fetch_all_products_with_inventory', return_value=MOCK_INVENTORY)
    def test_historical_price_preservation(self, mock_inv):
        user = {"id": "admin-1", "role": "admin", "permissions": ["orders.edit"]}
        # Product catalog price for SKU-A in MOCK_INVENTORY is 50.0.
        # Set historical price on test_order line 1 to 40.0.
        self.test_order["items"][0]["price"] = 40.0
        self.test_order["items"][0]["total_price"] = 400.0
        
        # Edit order quantity for SKU-A from 10 to 15 without specifying price
        payload = OrderEditRequest(
            items=[
                OrderEditItemSchema(sku="SKU-A", quantity=15.0), # price omitted (0.0)
                OrderEditItemSchema(sku="SKU-B", quantity=5.0)
            ]
        )
        
        res = OrderService.update_order("ORD-MUT-001", payload, user)
        self.assertEqual(res["status"], "updated")
        # Total amount must preserve 40.0 historical price for SKU-A: (15 * 40.0) + (5 * 100.0) = 600 + 500 = 1100.0
        self.assertEqual(res["total_amount"], 1100.0)

    @patch.object(InventoryRepository, 'fetch_all_products_with_inventory', return_value=MOCK_INVENTORY)
    @patch.object(OrderRepository, 'get_order_by_id_with_items', return_value={"order_id": "ORD-MUT-001", "status": "Cancelled", "items": [{"sku": "SKU-A", "quantity": 10}]})
    def test_concurrent_edit_vs_cancel(self, mock_order, mock_inv):
        user = {"id": "admin-1", "role": "admin", "permissions": ["orders.cancel", "orders.edit"]}
        payload = OrderEditRequest(
            items=[OrderEditItemSchema(sku="SKU-A", quantity=20.0, price=50.0)]
        )
        with self.assertRaises(ValueError) as ctx:
            OrderService.update_order("ORD-MUT-001", payload, user)
        self.assertIn("cannot be edited", str(ctx.exception))

    def test_concurrent_edit_vs_process(self):
        user = {"id": "admin-1", "role": "admin", "permissions": ["orders.process", "orders.edit"]}
        # Simulate order already processed (status = Dispatched)
        self.test_order["status"] = "Dispatched"
        
        payload = OrderEditRequest(
            items=[OrderEditItemSchema(sku="SKU-A", quantity=20.0, price=50.0)]
        )
        with self.assertRaises(ValueError) as ctx:
            OrderService.update_order("ORD-MUT-001", payload, user)
        self.assertIn("cannot be edited", str(ctx.exception))

    def test_concurrent_cancel_vs_process(self):
        user = {"id": "admin-1", "role": "admin", "permissions": ["orders.cancel", "orders.process"]}
        # Simulate order already processed (status = Dispatched)
        self.test_order["status"] = "Dispatched"
        
        with self.assertRaises(ValueError) as ctx:
            OrderService.cancel_order("ORD-MUT-001", OrderCancelRequest(reason="Late cancel"), user)
        self.assertIn("cannot be cancelled", str(ctx.exception))

if __name__ == "__main__":
    unittest.main()

