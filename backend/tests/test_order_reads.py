# backend/tests/test_order_reads.py
import unittest
from datetime import datetime
from fastapi.testclient import TestClient

from main import app
from repositories.order_repo import OrderRepository, _IN_MEMORY_ORDERS
from services.order_read_service import OrderReadService

class TestOrderReads(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)
        
        # Populate controlled mock orders in _IN_MEMORY_ORDERS for testing
        _IN_MEMORY_ORDERS.clear()
        
        self.test_order_1 = {
            "id": "uuid-read-1",
            "order_id": "ORD-2026-READ-001",
            "order_code": "ORD-2026-READ-001",
            "salesman_id": "SLS-001",
            "salesman_name": "Salesman Alpha",
            "shop_name": "Metro Retail Store",
            "location_id": "LOC-DELHI",
            "city": "Delhi",
            "state": "Delhi",
            "item_count": 2,
            "total_amount": 1500.0,
            "status": "Pending",
            "notes": "Express delivery requested",
            "created_by": "user-salesman-alpha",
            "created_at": "2026-09-20T08:00:00Z",
            "items": [
                {
                    "id": "item-1",
                    "order_id": "ORD-2026-READ-001",
                    "sku": "SKU-RED-100",
                    "item_name": "Red Cotton Shirt",
                    "category": "Apparel",
                    "quantity": 10.0,
                    "price": 100.0,
                    "total_price": 1000.0,
                    "created_at": "2026-09-20T08:00:00Z"
                },
                {
                    "id": "item-2",
                    "order_id": "ORD-2026-READ-001",
                    "sku": "SKU-BLUE-200",
                    "item_name": "Blue Denim Pants",
                    "category": "Apparel",
                    "quantity": 5.0,
                    "price": 100.0,
                    "total_price": 500.0,
                    "created_at": "2026-09-20T08:00:00Z"
                }
            ]
        }
        
        self.test_order_2 = {
            "id": "uuid-read-2",
            "order_id": "ORD-2026-READ-002",
            "order_code": "ORD-2026-READ-002",
            "salesman_id": "SLS-002",
            "salesman_name": "Salesman Beta",
            "shop_name": "Apex Electronics",
            "location_id": "LOC-MUMBAI",
            "city": "Mumbai",
            "state": "Maharashtra",
            "item_count": 1,
            "total_amount": 3500.0,
            "status": "Dispatched",
            "notes": "Standard shipping",
            "created_by": "user-salesman-beta",
            "created_at": "2026-09-20T09:00:00Z",
            "items": [
                {
                    "id": "item-3",
                    "order_id": "ORD-2026-READ-002",
                    "sku": "SKU-TECH-500",
                    "item_name": "Wireless Headphones",
                    "category": "Electronics",
                    "quantity": 1.0,
                    "price": 3500.0,
                    "total_price": 3500.0,
                    "created_at": "2026-09-20T09:00:00Z"
                }
            ]
        }
        
        _IN_MEMORY_ORDERS.append(self.test_order_1)
        _IN_MEMORY_ORDERS.append(self.test_order_2)

    def tearDown(self):
        _IN_MEMORY_ORDERS.clear()

    def test_list_orders_paginated(self):
        user = {"id": "admin-1", "role": "admin", "permissions": ["orders.view", "orders.view_all"]}
        res = OrderReadService.list_orders(current_user=user, page=1, page_size=10)
        
        self.assertGreaterEqual(res.total, 2)
        self.assertEqual(res.page, 1)
        self.assertEqual(res.page_size, 10)
        self.assertGreaterEqual(len(res.items), 2)

    def test_list_orders_search_filter(self):
        user = {"id": "admin-1", "role": "admin", "permissions": ["orders.view", "orders.view_all"]}
        res = OrderReadService.list_orders(current_user=user, search="Apex Electronics")
        
        self.assertEqual(len(res.items), 1)
        self.assertEqual(res.items[0].shop_name, "Apex Electronics")
        self.assertEqual(res.items[0].order_id, "ORD-2026-READ-002")

    def test_list_orders_status_filter(self):
        user = {"id": "admin-1", "role": "admin", "permissions": ["orders.view", "orders.view_all"]}
        res = OrderReadService.list_orders(current_user=user, status="Dispatched")
        
        self.assertEqual(len(res.items), 1)
        self.assertEqual(res.items[0].status, "Dispatched")

    def test_get_order_detail_historical_prices(self):
        user = {"id": "admin-1", "role": "admin", "permissions": ["orders.view", "orders.view_all"]}
        detail = OrderReadService.get_order_by_id("ORD-2026-READ-001", current_user=user)
        
        self.assertEqual(detail.order_id, "ORD-2026-READ-001")
        self.assertEqual(detail.total_amount, 1500.0)
        self.assertEqual(len(detail.items), 2)
        self.assertEqual(detail.items[0].price, 100.0)
        self.assertEqual(detail.items[0].total_price, 1000.0)

    def test_salesman_visibility_restriction(self):
        salesman_alpha = {
            "id": "SLS-001",
            "user_id": "user-salesman-alpha",
            "role": "salesman",
            "permissions": ["orders.view"]
        }
        
        # Salesman Alpha CAN access own order ORD-2026-READ-001
        detail_own = OrderReadService.get_order_by_id("ORD-2026-READ-001", current_user=salesman_alpha)
        self.assertEqual(detail_own.order_id, "ORD-2026-READ-001")
        
        # Salesman Alpha CANNOT access Salesman Beta's order ORD-2026-READ-002 -> raises PermissionError
        with self.assertRaises(PermissionError):
            OrderReadService.get_order_by_id("ORD-2026-READ-002", current_user=salesman_alpha)

    def test_nonexistent_order_returns_error(self):
        user = {"id": "admin-1", "role": "admin", "permissions": ["orders.view"]}
        with self.assertRaises(ValueError):
            OrderReadService.get_order_by_id("NONEXISTENT-ORDER-999", current_user=user)

if __name__ == "__main__":
    unittest.main()
