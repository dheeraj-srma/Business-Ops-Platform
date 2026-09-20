# backend/tests/test_analytics_reads.py
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient

from main import app
from services.analytics_service import AnalyticsService

MOCK_INVENTORY_ANALYTICS = [
    {"sku": "SKU-101", "name": "Item 101", "Category": "Category A", "Current Stock": 20, "Price": 100.0},
    {"sku": "SKU-102", "name": "Item 102", "Category": "Category B", "Current Stock": 8, "Price": 50.0},
    {"sku": "SKU-103", "name": "Item 103", "Category": "Category A", "Current Stock": 0, "Price": 200.0},
]

MOCK_ORDERS_ANALYTICS = [
    {"order_id": "ORD-1", "status": "Dispatched", "total_amount": 1000.0, "created_at": "2026-09-01T10:00:00"},
    {"order_id": "ORD-2", "status": "Approved", "total_amount": 500.0, "created_at": "2026-09-02T10:00:00"},
    {"order_id": "ORD-3", "status": "Pending", "total_amount": 250.0, "created_at": "2026-09-03T10:00:00"},
    {"order_id": "ORD-4", "status": "Cancelled", "total_amount": 800.0, "created_at": "2026-09-04T10:00:00"},
]

class TestAnalyticsReads(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)

    @patch('repositories.inventory_repo.InventoryRepository.fetch_all_products_with_inventory', return_value=MOCK_INVENTORY_ANALYTICS)
    @patch('repositories.order_repo.OrderRepository.get_orders', return_value=MOCK_ORDERS_ANALYTICS)
    @patch('repositories.transaction_repo.TransactionRepository.get_returns', return_value=[])
    @patch('repositories.dealer_repo.DealerRepository.count_dealers', return_value=10)
    @patch('repositories.supplier_repo.SupplierRepository.count_suppliers', return_value=5)
    def test_executive_summary(self, mock_sup, mock_dlr, mock_ret, mock_ord, mock_inv):
        res = self.client.get("/api/analytics/summary")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        
        self.assertEqual(data["total_products"], 3)
        self.assertEqual(data["total_units"], 28)
        self.assertEqual(data["total_stock_value"], 2400.0) # (20*100) + (8*50) + (0*200) = 2400
        self.assertEqual(data["healthy_count"], 1)
        self.assertEqual(data["low_stock_items"], 1)
        self.assertEqual(data["out_of_stock_items"], 1)
        self.assertEqual(data["pending_orders"], 1)
        self.assertEqual(data["total_orders"], 4)

    @patch('repositories.inventory_repo.InventoryRepository.fetch_all_products_with_inventory', return_value=MOCK_INVENTORY_ANALYTICS)
    @patch('repositories.order_repo.OrderRepository.get_orders', return_value=MOCK_ORDERS_ANALYTICS)
    @patch('repositories.transaction_repo.TransactionRepository.get_returns', return_value=[])
    @patch('repositories.dealer_repo.DealerRepository.count_dealers', return_value=10)
    @patch('repositories.supplier_repo.SupplierRepository.count_suppliers', return_value=5)
    def test_bi_analytics_kpis(self, mock_sup, mock_dlr, mock_ret, mock_ord, mock_inv):
        res = self.client.get("/api/analytics/bi")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        
        kpis = data.get("core_kpis", {})
        # Approved orders are ORD-1 (Dispatched) and ORD-2 (Approved) -> Revenue = 1500.0
        self.assertEqual(kpis["total_revenue"], 1500.0)
        self.assertEqual(kpis["approved_orders"], 2)
        self.assertEqual(kpis["pending_orders"], 1)
        self.assertEqual(kpis["average_order_value"], 750.0) # 1500 / 2 = 750

    @patch('repositories.inventory_repo.InventoryRepository.fetch_all_products_with_inventory', return_value=MOCK_INVENTORY_ANALYTICS)
    @patch('repositories.order_repo.OrderRepository.get_orders', return_value=MOCK_ORDERS_ANALYTICS)
    def test_dashboard_stats_endpoint(self, mock_ord, mock_inv):
        res = self.client.get("/api/dashboard/stats")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        
        # BI & Executive reads
        self.assertIn("core_kpis", data)
        self.assertIn("executive_summary", data)
        self.assertIn("inventory_intelligence", data)

        # Operational dashboard reads
        self.assertIn("totalProducts", data)
        self.assertIn("healthyCount", data)
        self.assertIn("lowStockCount", data)
        self.assertIn("criticalStockCount", data)
        self.assertIn("outOfStockCount", data)
        self.assertIn("lowStockItems", data)
        self.assertIn("recentMovements", data)
        self.assertIn("trend", data)
        self.assertIn("categoryBreakdown", data)
        self.assertIsInstance(data["lowStockItems"], list)
        self.assertIsInstance(data["recentMovements"], list)
        self.assertIsInstance(data["trend"], list)

    @patch('repositories.inventory_repo.InventoryRepository.fetch_all_products_with_inventory', return_value=MOCK_INVENTORY_ANALYTICS)
    def test_paginated_product_analytics(self, mock_inv):
        res = self.client.get("/api/analytics/products?page=1&page_size=2")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        
        self.assertEqual(data["total"], 3)
        self.assertEqual(len(data["items"]), 2)
        self.assertTrue(data["has_next"])

if __name__ == "__main__":
    unittest.main()
