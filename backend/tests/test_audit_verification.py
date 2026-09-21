# backend/tests/test_audit_verification.py
"""
Comprehensive Final Audit Verification Suite:
1. 24-Hour Snapshot Refresh (mock age < 24h vs >= 24h, atomic replacement)
2. Atomic Snapshot Writes (failure during write leaves previous valid snapshot intact)
3. Restart Persistence (cold boot reloads snapshot from disk, serves read-only on DB outage)
4. Decoupled Global Status Semantics (database_status vs system_mode vs write_status vs response_source)
5. Write Protection (assert_writable raises HTTP 503 DATABASE_READ_ONLY when DB is down)
6. Security Audit (no sensitive keys, tokens, or passwords in snapshots)
"""

import os
import sys
import json
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import HTTPException
from services.snapshot_service import SnapshotService, SNAPSHOT_DIR

class TestAuditVerification(unittest.TestCase):

    def setUp(self):
        SnapshotService.record_db_status(True)
        SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)

    def tearDown(self):
        SnapshotService.record_db_status(True)

    # =========================================================================
    # 1. VERIFY 24-HOUR SNAPSHOT REFRESH
    # =========================================================================
    def test_24_hour_snapshot_refresh_logic(self):
        entity = "audit_refresh_test"
        initial_data = [{"id": 1, "name": "Item Old"}]
        fresh_data = [{"id": 1, "name": "Item New"}]

        # Step A: Create an initial snapshot with timestamp 25 hours ago (>= 24h)
        past_time = (datetime.now(timezone.utc) - timedelta(hours=25)).isoformat()
        SnapshotService.record_successful_read(entity, initial_data, force_refresh=True)

        # Manually alter the snapshot captured_at on disk and in memory cache to 25 hours ago
        snap_file = SNAPSHOT_DIR / f"{entity}_snapshot.json"
        with open(snap_file, "r", encoding="utf-8") as f:
            disk_content = json.load(f)
        disk_content["captured_at"] = past_time
        with open(snap_file, "w", encoding="utf-8") as f:
            json.dump(disk_content, f, indent=2)

        # Re-initialize to load mocked past timestamp into memory cache
        with SnapshotService._lock:
            SnapshotService._in_memory_snapshots.clear()
            SnapshotService._initialized = False
        SnapshotService._ensure_init()

        snap = SnapshotService.get_last_known_snapshot(entity)
        self.assertIsNotNone(snap)
        self.assertEqual(snap["captured_at"], past_time)

        # Step B: Age >= 24h -> Successful read MUST trigger a refresh
        refreshed = SnapshotService.record_successful_read(entity, fresh_data, ttl_seconds=86400)
        self.assertTrue(refreshed, "Snapshot should refresh when age >= 24 hours")

        snap_updated = SnapshotService.get_last_known_snapshot(entity)
        self.assertEqual(snap_updated["data"][0]["name"], "Item New")
        
        # Verify timestamp was updated to now
        captured_dt = datetime.fromisoformat(snap_updated["captured_at"])
        if captured_dt.tzinfo is None:
            captured_dt = captured_dt.replace(tzinfo=timezone.utc)
        age = (datetime.now(timezone.utc) - captured_dt).total_seconds()
        self.assertLess(age, 60, "Newly refreshed snapshot age should be < 1 min")

        # Step C: Age < 24h -> Subsequent read MUST NOT trigger unnecessary refresh
        unnecessary_refresh = SnapshotService.record_successful_read(
            entity, [{"id": 1, "name": "Item Unnecessary"}], ttl_seconds=86400
        )
        self.assertFalse(unnecessary_refresh, "Snapshot should NOT refresh when age < 24 hours")

        # Confirm data remains "Item New" and was not overwritten
        snap_unchanged = SnapshotService.get_last_known_snapshot(entity)
        self.assertEqual(snap_unchanged["data"][0]["name"], "Item New")

    # =========================================================================
    # 2. VERIFY ATOMIC SNAPSHOT WRITES
    # =========================================================================
    def test_atomic_snapshot_write_failure_resilience(self):
        entity = "audit_atomic_test"
        valid_data = [{"id": 100, "sku": "ATOMIC-OK"}]

        # Write valid initial snapshot
        SnapshotService.record_successful_read(entity, valid_data, force_refresh=True)
        target_file = SNAPSHOT_DIR / f"{entity}_snapshot.json"
        self.assertTrue(target_file.exists())

        with open(target_file, "r", encoding="utf-8") as f:
            original_content = f.read()

        # Simulate a disk write failure during json.dump
        with patch("services.snapshot_service.json.dump", side_effect=OSError("Simulated Disk Write Error")):
            # Attempt to write corrupted/failing snapshot
            failed_write = SnapshotService.record_successful_read(
                entity, [{"id": 999, "sku": "CORRUPT"}], force_refresh=True
            )
            self.assertFalse(failed_write, "Failed write should return False")

        # Verify original snapshot file is completely intact and not corrupt
        self.assertTrue(target_file.exists())
        with open(target_file, "r", encoding="utf-8") as f:
            current_content = f.read()
        self.assertEqual(original_content, current_content, "Original snapshot must remain unchanged after write error")

        # Verify memory cache also preserved original data
        snap_mem = SnapshotService.get_last_known_snapshot(entity)
        self.assertEqual(snap_mem["data"][0]["sku"], "ATOMIC-OK")

        # Verify no orphaned .tmp file exists
        tmp_file = SNAPSHOT_DIR / f"{entity}_snapshot.json.tmp"
        self.assertFalse(tmp_file.exists(), "Temporary file must be cleaned up on failure")

    # =========================================================================
    # 3. VERIFY RESTART PERSISTENCE
    # =========================================================================
    def test_restart_persistence_and_outage_handling(self):
        entity = "audit_restart_test"
        seed_data = [{"id": 501, "sku": "RESTART-501", "stock": 42}]

        # 1. Generate valid snapshot
        SnapshotService.record_successful_read(entity, seed_data, force_refresh=True)
        initial_snap = SnapshotService.get_last_known_snapshot(entity)
        recorded_ts = initial_snap["captured_at"]

        # 2. Simulate complete server reboot: wipe memory cache & reinitialize from disk
        with SnapshotService._lock:
            SnapshotService._in_memory_snapshots.clear()
            SnapshotService._initialized = False
        SnapshotService._ensure_init()

        # 3. Simulate database outage immediately upon boot
        SnapshotService.record_db_failure(entity, ConnectionRefusedError("Database offline on boot"))

        # 4. Request data & check system status
        self.assertEqual(SnapshotService.get_system_mode(), "READ_ONLY")
        self.assertEqual(SnapshotService.get_database_status(), "UNAVAILABLE")
        self.assertEqual(SnapshotService.get_write_status(), "BLOCKED")

        recovery_snap = SnapshotService.get_last_known_snapshot(entity)
        self.assertIsNotNone(recovery_snap, "Snapshot must load successfully from disk after restart")
        self.assertEqual(recovery_snap["data"][0]["sku"], "RESTART-501")
        self.assertEqual(recovery_snap["data"][0]["stock"], 42)
        self.assertEqual(recovery_snap["captured_at"], recorded_ts, "Snapshot timestamp must be preserved")

    # =========================================================================
    # 4. VERIFY GLOBAL STATUS SEMANTICS
    # =========================================================================
    def test_global_status_semantics(self):
        # Initial healthy state
        SnapshotService.record_db_status(True)
        health = SnapshotService.get_health_status()
        self.assertEqual(health["database_status"], "CONNECTED")
        self.assertEqual(health["system_mode"], "LIVE")
        self.assertEqual(health["write_status"], "WRITABLE")

        # Record DB failure on one entity
        SnapshotService.record_db_failure("orders", Exception("Timeout querying orders table"))
        health = SnapshotService.get_health_status()
        self.assertEqual(health["database_status"], "UNAVAILABLE")
        self.assertEqual(health["system_mode"], "READ_ONLY")
        self.assertEqual(health["write_status"], "BLOCKED")
        self.assertIn("Timeout querying orders table", health["last_db_error"])

        # Reading from snapshot does NOT hide the active database outage
        snap = SnapshotService.get_last_known_snapshot("audit_refresh_test")
        self.assertIsNotNone(snap)
        self.assertEqual(SnapshotService.get_system_mode(), "READ_ONLY")
        self.assertEqual(SnapshotService.get_database_status(), "UNAVAILABLE")
        self.assertEqual(SnapshotService.get_write_status(), "BLOCKED")

        # Explicit recovery
        SnapshotService.record_db_status(True)
        self.assertEqual(SnapshotService.get_system_mode(), "LIVE")
        self.assertEqual(SnapshotService.get_database_status(), "CONNECTED")
        self.assertEqual(SnapshotService.get_write_status(), "WRITABLE")

    # =========================================================================
    # 5. VERIFY WRITE PROTECTION
    # =========================================================================
    def test_write_protection_in_read_only_mode(self):
        # Trigger read-only mode
        SnapshotService.record_db_failure("inventory", Exception("PostgreSQL down"))
        self.assertEqual(SnapshotService.get_system_mode(), "READ_ONLY")

        mutations = [
            "order creation",
            "order reservation",
            "bulk restock",
            "stock adjustment",
            "stock inward",
            "stock outward",
            "return creation",
            "user creation",
            "settings update"
        ]

        for mutation in mutations:
            with self.assertRaises(HTTPException) as ctx:
                SnapshotService.assert_writable(mutation)
            self.assertEqual(ctx.exception.status_code, 503)
            self.assertEqual(ctx.exception.detail["error"], "DATABASE_READ_ONLY")
            self.assertEqual(ctx.exception.detail["system_mode"], "READ_ONLY")
            self.assertIn("cannot be committed", ctx.exception.detail["message"])

    # =========================================================================
    # 6. SECURITY AUDIT: NO PASSWORDS, TOKENS, OR SECRETS IN SNAPSHOTS
    # =========================================================================
    def test_snapshot_security_cleanliness(self):
        forbidden_exact_keys = {
            "password", "password_hash", "token", "jwt", "secret",
            "access_token", "refresh_token", "api_key", "secret_key", "bearer"
        }

        # Check all existing snapshot files on disk
        for p in SNAPSHOT_DIR.glob("*_snapshot.json"):
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)

            def inspect(item, path=""):
                if isinstance(item, dict):
                    for k, v in item.items():
                        key_lower = k.lower()
                        self.assertNotIn(
                            key_lower, forbidden_exact_keys,
                            f"Forbidden security key '{k}' found at {path}.{k} in snapshot {p.name}"
                        )
                        inspect(v, f"{path}.{k}")
                elif isinstance(item, list):
                    for i, elem in enumerate(item):
                        inspect(elem, f"{path}[{i}]")

            inspect(data)


if __name__ == "__main__":
    unittest.main()
