# backend/tests/test_tally_subsystem.py
"""
Unit tests for the isolated Tally ERP Integration Subsystem.
Verifies payload normalization, SHA256 event hashing for DB idempotency, and XML mapping contracts.
"""

import unittest
from services.tally_service import TallyService


class TestTallySubsystem(unittest.TestCase):

    def test_canonical_event_hashing(self):
        payload_a = {"event_id": "EVT-101", "voucher_type": "Sales", "amount": 1500.0}
        payload_b = {"voucher_type": "Sales", "amount": 1500.0, "event_id": "EVT-101"}

        hash_a = TallyService.compute_payload_hash(payload_a)
        hash_b = TallyService.compute_payload_hash(payload_b)
        self.assertEqual(hash_a, hash_b)
        self.assertEqual(len(hash_a), 64)

    def test_payload_normalization(self):
        raw_data = {
            "voucher_number": " VOUCH-001 ",
            "party_name": "  Surya Enterprises  ",
            "amount": "25000.50",
            "items": [
                {"sku": "SKU-99", "qty": "10"}
            ]
        }

        norm = TallyService.normalize_tally_payload(raw_data)
        self.assertEqual(norm["voucher_number"], "VOUCH-001")
        self.assertEqual(norm["party_name"], "Surya Enterprises")
        self.assertEqual(norm["amount"], 25000.50)
        self.assertEqual(norm["items"][0]["quantity"], 10.0)

    def test_xml_export_contract_generation(self):
        order_data = {
            "order_code": "ORD-2026-9999",
            "dealer_name": "Reliable Metal Traders",
            "items": [
                {"sku": "AL-ROD-01", "product_name": "Aluminum Rod", "quantity": 50, "price": 450.0}
            ],
            "total_amount": 22500.0
        }

        xml_output = TallyService.generate_tally_xml_voucher(order_data)
        self.assertIn("<VOUCHER", xml_output)
        self.assertIn("ORD-2026-9999", xml_output)

        self.assertIn("Reliable Metal Traders", xml_output)
        self.assertIn("<ALLINVENTORYENTRIES.LIST>", xml_output)


if __name__ == "__main__":
    unittest.main()
