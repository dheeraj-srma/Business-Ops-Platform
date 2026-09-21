# backend/tests/test_snapshot_resilience.py
import unittest
from services.snapshot_service import SnapshotService
from fastapi import HTTPException

class TestSnapshotResilience(unittest.TestCase):

    def setUp(self):
        SnapshotService.record_db_status(True)

    def tearDown(self):
        SnapshotService.record_db_status(True)

    def test_record_and_retrieve_snapshot(self):
        sample_data = [
            {"sku": "NLK-0001", "name": "Brass Ball Valve", "price": 450.0},
            {"sku": "NLK-0002", "name": "CPVC Pipe 1 inch", "price": 120.0}
        ]
        SnapshotService.record_successful_read("test_inventory", sample_data)
        
        snapshot = SnapshotService.get_last_known_snapshot("test_inventory")
        self.assertIsNotNone(snapshot)
        self.assertEqual(snapshot["entity"], "test_inventory")
        self.assertEqual(snapshot["row_count"], 2)
        self.assertEqual(len(snapshot["data"]), 2)
        self.assertEqual(snapshot["data"][0]["sku"], "NLK-0001")
        self.assertEqual(snapshot["source"], "postgresql_live")

    def test_system_mode_and_db_failure_tracking(self):
        self.assertEqual(SnapshotService.get_system_mode(), "LIVE")
        self.assertTrue(SnapshotService.is_db_available())

        # Record DB failure
        SnapshotService.record_db_failure("test_orders", Exception("Connection refused to PostgreSQL"))
        self.assertEqual(SnapshotService.get_system_mode(), "READ_ONLY")
        self.assertFalse(SnapshotService.is_db_available())

        # When in READ_ONLY, assert_writable must raise HTTP 503
        with self.assertRaises(HTTPException) as ctx:
            SnapshotService.assert_writable("order placement")
        self.assertEqual(ctx.exception.status_code, 503)
        self.assertEqual(ctx.exception.detail["error"], "DATABASE_READ_ONLY")
        self.assertEqual(ctx.exception.detail["system_mode"], "READ_ONLY")

        # Restoring DB status restores LIVE mode
        SnapshotService.record_db_status(True)
        self.assertEqual(SnapshotService.get_system_mode(), "LIVE")
        self.assertTrue(SnapshotService.is_db_available())
        # Should not raise
        SnapshotService.assert_writable("order placement")

if __name__ == "__main__":
    unittest.main()
