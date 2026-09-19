# backend/tests/test_security_rbac.py
"""Automated security unit test suite for JWT authentication,
Server-side RBAC role permissions, and Webhook HMAC signature verification.
"""

import unittest
import hmac
import hashlib
from datetime import timedelta
from fastapi import HTTPException

from auth import (
    create_access_token,
    verify_access_token,
    require_role,
    verify_webhook_signature,
    JWT_SECRET,
    TALLY_WEBHOOK_SECRET,
)


class TestSecurityAndRBAC(unittest.TestCase):

    def test_jwt_creation_and_verification(self):
        payload = {
            "user_id": "usr-12345",
            "email": "admin@nalkametals.com",
            "role": "admin"
        }
        token = create_access_token(payload)
        self.assertIsInstance(token, str)
        self.assertTrue(len(token) > 20)

        verified = verify_access_token(token)
        self.assertEqual(verified["user_id"], "usr-12345")
        self.assertEqual(verified["email"], "admin@nalkametals.com")
        self.assertEqual(verified["role"], "admin")

    def test_invalid_jwt_rejection(self):
        bogus_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature"
        with self.assertRaises(HTTPException) as ctx:
            verify_access_token(bogus_token)
        self.assertEqual(ctx.exception.status_code, 401)

    def test_expired_jwt_rejection(self):
        payload = {"user_id": "usr-expired", "role": "salesman"}
        # Create token that expired 10 minutes ago
        expired_token = create_access_token(payload, expires_delta=timedelta(minutes=-10))
        
        with self.assertRaises(HTTPException) as ctx:
            verify_access_token(expired_token)
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertIn("expired", ctx.exception.detail.lower())

    def test_rbac_permission_checker(self):
        admin_user = {"user_id": "u1", "email": "admin@test.com", "role": "admin"}
        stock_manager_user = {"user_id": "u2", "email": "stock@test.com", "role": "stock_manager"}
        salesman_user = {"user_id": "u3", "email": "sales@test.com", "role": "salesman"}

        stock_checker = require_role(["stock_manager"])

        # Stock manager allowed
        res1 = stock_checker(stock_manager_user)
        self.assertEqual(res1["role"], "stock_manager")

        # Admin allowed via admin override
        res2 = stock_checker(admin_user)
        self.assertEqual(res2["role"], "admin")

        # Salesman blocked from stock manager route (HTTP 403)
        with self.assertRaises(HTTPException) as ctx:
            stock_checker(salesman_user)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_webhook_hmac_signature_verification(self):
        secret = "test_webhook_secret_key_99"
        raw_payload = b'{"event":"inventory_sync","sku":"SKU-001","qty":50}'

        # Compute valid HMAC signature
        valid_sig = hmac.new(secret.encode("utf-8"), raw_payload, hashlib.sha256).hexdigest()

        # Valid signature should be accepted
        is_valid = verify_webhook_signature(raw_payload, valid_sig, secret=secret)
        self.assertTrue(is_valid)

        # Valid signature with 'sha256=' prefix should be accepted
        is_valid_prefix = verify_webhook_signature(raw_payload, f"sha256={valid_sig}", secret=secret)
        self.assertTrue(is_valid_prefix)

        # Invalid signature should be rejected
        is_invalid = verify_webhook_signature(raw_payload, "invalid_sig_12345", secret=secret)
        self.assertFalse(is_invalid)

        # Missing signature should be rejected
        is_missing = verify_webhook_signature(raw_payload, None, secret=secret)
        self.assertFalse(is_missing)


if __name__ == "__main__":
    unittest.main()
