# backend/tests/test_audit_logging.py
"""
Unit tests for Privileged Action Audit Logging.
Verifies structure, actor context, correlation IDs, and diff formatting.
"""

import unittest
from services.audit_service import AuditService


class TestAuditLogging(unittest.TestCase):

    def test_audit_log_structure(self):
        log_entry = AuditService.record_action(
            actor_id="usr_admin_01",
            actor_role="admin",
            action="UPDATE_SETTING",
            target_entity="tally_config",
            entity_id="cfg_01",
            before_values={"sync_interval": 30},
            after_values={"sync_interval": 15},
            correlation_id="corr-abc-123"
        )

        self.assertEqual(log_entry["actor_id"], "usr_admin_01")
        self.assertEqual(log_entry["action"], "UPDATE_SETTING")
        self.assertEqual(log_entry["target_entity"], "tally_config")
        self.assertEqual(log_entry["before_values"]["sync_interval"], 30)
        self.assertEqual(log_entry["after_values"]["sync_interval"], 15)
        self.assertEqual(log_entry["correlation_id"], "corr-abc-123")
        self.assertIn("timestamp", log_entry)

    def test_audit_log_format_without_optional_fields(self):
        log_entry = AuditService.record_action(
            actor_id="usr_sales_02",
            actor_role="salesman",
            action="STOCK_OUT",
            target_entity="inventory",
            entity_id="prod_888"
        )

        self.assertEqual(log_entry["actor_id"], "usr_sales_02")
        self.assertIsNone(log_entry.get("before_values"))
        self.assertIsNone(log_entry.get("after_values"))


if __name__ == "__main__":
    unittest.main()
