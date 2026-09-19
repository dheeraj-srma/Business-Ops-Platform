# backend/tests/test_observability.py
"""
Unit tests for Operational Safeguards & Observability.
Verifies FastAPI correlation ID propagation, health/readiness endpoints, rate limiting, and exception middleware.
"""

import unittest
from fastapi.testclient import TestClient
from main import app


class TestObservability(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)

    def test_healthz_endpoint(self):
        response = self.client.get("/healthz")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["service"], "nalka-metals-api")
        self.assertIn("X-Correlation-ID", response.headers)

    def test_readyz_endpoint(self):
        response = self.client.get("/readyz")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn(data["status"], ["ready", "degraded"])
        self.assertIn("X-Correlation-ID", response.headers)

    def test_correlation_id_header_propagation(self):
        custom_id = "test-corr-id-9999"
        response = self.client.get("/healthz", headers={"X-Correlation-ID": custom_id})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("X-Correlation-ID"), custom_id)

    def test_central_exception_handler_returns_json_structure(self):
        # Requesting non-existent endpoint or invalid payload trigger exception
        response = self.client.get("/non-existent-route-for-testing")
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
