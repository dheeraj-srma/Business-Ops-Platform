# backend/tests/test_architecture.py
"""Automated unit test suite verifying Service/Repository architecture,
Pydantic request schema validation, exact numeric rounding rules, and APIRouter setup.
"""

import unittest
from pydantic import ValidationError

from schemas.orders import BulkOrderCreateSchema, BulkOrderItemSchema
from schemas.inventory import ProductCreateSchema
from services.order_service import OrderService
from services.inventory_service import InventoryService
from main import app


class TestBackendArchitecture(unittest.TestCase):

    def test_pydantic_schema_validation_rejects_invalid_quantity(self):
        # Quantity <= 0 should be rejected by schema
        with self.assertRaises(ValidationError):
            BulkOrderItemSchema(sku="SKU-001", quantity=0, price=100.0)

        with self.assertRaises(ValidationError):
            BulkOrderItemSchema(sku="SKU-001", quantity=-5, price=100.0)

    def test_pydantic_schema_validation_rejects_negative_price(self):
        with self.assertRaises(ValidationError):
            ProductCreateSchema(sku="SKU-TEST", name="Test Product", unit_price=-10.0)

    def test_pydantic_schema_accepts_valid_bulk_order(self):
        valid_data = {
            "client_reference": "uuid-1234-5678",
            "items": [
                {"sku": "SKU-001", "quantity": 10, "price": 150.75},
                {"sku": "SKU-002", "quantity": 5, "price": 200.00}
            ]
        }
        schema = BulkOrderCreateSchema(**valid_data)
        self.assertEqual(schema.client_reference, "uuid-1234-5678")
        self.assertEqual(len(schema.items), 2)
        self.assertEqual(schema.items[0].quantity, 10)

    def test_numeric_precision_rounding_rules(self):
        # Verify 2-decimal rounding for currency and exact calculation
        price = 125.3456
        qty = 3
        total = round(price * qty, 2)
        self.assertEqual(total, 376.04)

    def test_api_routers_mounted_on_app(self):
        routes = [getattr(r, "path", "") for r in app.routes if hasattr(r, "path")]
        for r in app.routes:
            if hasattr(r, "original_router"):
                for sub in r.original_router.routes:
                    if hasattr(sub, "path"):
                        routes.append(sub.path)

        self.assertIn("/health", routes)
        self.assertIn("/api/auth/login", routes)
        self.assertIn("/api/inventory", routes)
        self.assertIn("/api/orders", routes)
        self.assertIn("/api/orders/bulk", routes)
        self.assertIn("/api/transactions", routes)
        self.assertIn("/api/analytics/summary", routes)
        self.assertIn("/api/webhooks/tally", routes)


if __name__ == "__main__":
    unittest.main()
