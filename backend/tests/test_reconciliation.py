# backend/tests/test_reconciliation.py
"""
Unit tests for Inventory Ledger Invariant & Reconciliation Engine.
Verifies that SUM(transactions) matches current_stock, and discrepancy detection logic.
"""

import unittest
from services.reconciliation_service import ReconciliationService


class TestInventoryReconciliation(unittest.TestCase):

    def test_stock_movement_invariant_calculation(self):
        # Initial 0 stock + STOCK_IN(100) + ADJUSTMENT_INCREASE(20) - STOCK_OUT(30) - ADJUSTMENT_DECREASE(10) = 80
        transactions = [
            {"transaction_type": "STOCK_IN", "quantity": 100},
            {"transaction_type": "ADJUSTMENT_INCREASE", "quantity": 20},
            {"transaction_type": "STOCK_OUT", "quantity": 30},
            {"transaction_type": "ADJUSTMENT_DECREASE", "quantity": 10},
        ]
        calculated_stock = ReconciliationService._calculate_ledger_stock(transactions)
        self.assertEqual(calculated_stock, 80.0)

    def test_reconciliation_detects_discrepancy(self):
        # Ledger sum is 50, but recorded current stock in database is 45
        products = [
            {"id": "prod-1", "sku": "SKU-TEST-1", "name": "Pipe 1", "currentStock": 45.0}
        ]
        all_txs = [
            {"product_id": "prod-1", "transaction_type": "STOCK_IN", "quantity": 50.0}
        ]

        report = ReconciliationService.compute_reconciliation_report(products, all_txs)
        self.assertEqual(report["total_products_checked"], 1)
        self.assertEqual(report["discrepancy_count"], 1)
        discrepancy = report["discrepancies"][0]
        self.assertEqual(discrepancy["product_id"], "prod-1")
        self.assertEqual(discrepancy["current_stock"], 45.0)
        self.assertEqual(discrepancy["ledger_sum"], 50.0)
        self.assertEqual(discrepancy["variance"], -5.0)

    def test_reconciliation_clean_when_balanced(self):
        products = [
            {"id": "prod-2", "sku": "SKU-TEST-2", "name": "Rod 2", "currentStock": 150.0}
        ]
        all_txs = [
            {"product_id": "prod-2", "transaction_type": "STOCK_IN", "quantity": 200.0},
            {"product_id": "prod-2", "transaction_type": "STOCK_OUT", "quantity": 50.0},
        ]

        report = ReconciliationService.compute_reconciliation_report(products, all_txs)
        self.assertEqual(report["discrepancy_count"], 0)
        self.assertEqual(len(report["discrepancies"]), 0)


if __name__ == "__main__":
    unittest.main()
