# backend/services/snapshot_service.py
"""
Authoritative Backend-Owned Last Known Snapshot & READ-ONLY Resilience Service.

Architecture Pattern:
    PostgreSQL / DB
          │
    successful read
          │
    Last Known Snapshot (Backend-owned)
          │
    DB temporarily unavailable
          │
    Serve snapshot data (READ-ONLY mode)
"""

import os
import json
import time
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
from fastapi import HTTPException, status

logger = logging.getLogger("snapshot_service")

# Storage directory for persistent backend-owned snapshots
BACKEND_DIR = Path(__file__).resolve().parent.parent
SNAPSHOT_DIR = BACKEND_DIR / "data" / "snapshots"


class SnapshotService:
    """
    Thread-safe backend manager for:
    1. Capturing and persisting live DB read snapshots to disk.
    2. Serving last known snapshots seamlessly when PostgreSQL is unreachable.
    3. Tracking DB health and enforcing READ-ONLY mode on mutations during outages.
    """

    _lock = threading.Lock()
    _in_memory_snapshots: Dict[str, Dict[str, Any]] = {}
    _db_connected: bool = True
    _last_db_error: Optional[str] = None
    _last_db_success_at: Optional[str] = None
    _initialized: bool = False

    @classmethod
    def _ensure_init(cls) -> None:
        if cls._initialized:
            return
        with cls._lock:
            if cls._initialized:
                return
            SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
            # Load existing snapshots from disk if present
            try:
                for snapshot_file in SNAPSHOT_DIR.glob("*_snapshot.json"):
                    entity = snapshot_file.stem.replace("_snapshot", "")
                    try:
                        with open(snapshot_file, "r", encoding="utf-8") as f:
                            data = json.load(f)
                            cls._in_memory_snapshots[entity] = data
                            logger.info(f"Loaded existing disk snapshot for '{entity}' ({data.get('row_count', 0)} records).")
                    except Exception as exc:
                        logger.warning(f"Could not load snapshot file {snapshot_file}: {exc}")
            except Exception as e:
                logger.warning(f"Error initializing snapshot directory: {e}")
            cls._initialized = True

    @classmethod
    def record_successful_read(cls, entity: str, data: Any, metadata: Optional[Dict[str, Any]] = None) -> None:
        """
        Invoked after any successful PostgreSQL read.
        Updates in-memory snapshot and flushes atomically to disk.
        """
        cls._ensure_init()
        now_iso = datetime.now(timezone.utc).isoformat()
        row_count = len(data) if isinstance(data, list) else (len(data.keys()) if isinstance(data, dict) else 1)

        payload = {
            "entity": entity,
            "captured_at": now_iso,
            "row_count": row_count,
            "source": "postgresql_live",
            "metadata": metadata or {},
            "data": data
        }

        with cls._lock:
            cls._in_memory_snapshots[entity] = payload
            cls._db_connected = True
            cls._last_db_error = None
            cls._last_db_success_at = now_iso

        # Asynchronously or safely persist to disk without blocking execution
        try:
            target_file = SNAPSHOT_DIR / f"{entity}_snapshot.json"
            temp_file = SNAPSHOT_DIR / f"{entity}_snapshot.json.tmp"
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2, ensure_ascii=False)
            temp_file.replace(target_file)
            logger.debug(f"Saved snapshot for '{entity}' ({row_count} records) to {target_file}")
        except Exception as exc:
            logger.error(f"Failed to persist snapshot for '{entity}' to disk: {exc}")

    @classmethod
    def record_db_failure(cls, entity: str, error: Exception) -> None:
        """
        Invoked when a database read or query fails.
        Flags the database state as temporarily unavailable / degraded.
        """
        cls._ensure_init()
        err_str = str(error)
        with cls._lock:
            cls._db_connected = False
            cls._last_db_error = err_str
        logger.warning(f"Database query failure for entity '{entity}': {err_str}. Switching to READ-ONLY snapshot mode.")

    @classmethod
    def record_db_status(cls, is_connected: bool, error: Optional[str] = None) -> None:
        """Explicitly sets current database connectivity status."""
        cls._ensure_init()
        with cls._lock:
            cls._db_connected = is_connected
            if is_connected:
                cls._last_db_error = None
                cls._last_db_success_at = datetime.now(timezone.utc).isoformat()
            else:
                cls._last_db_error = error or "Database connection unreachable"

    @classmethod
    def get_latest_snapshot_meta(cls) -> Optional[Dict[str, Any]]:
        """Returns metadata for the most recently captured snapshot across all entities."""
        meta = cls.get_all_snapshots_meta()
        if not meta:
            return None
        # Sort by captured_at descending
        sorted_items = sorted(meta.items(), key=lambda item: item[1].get("captured_at") or "", reverse=True)
        if sorted_items:
            entity, info = sorted_items[0]
            return {"entity": entity, **info}
        return None

    @classmethod
    def get_last_known_snapshot(cls, entity: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves the authoritative last known snapshot for the requested entity.
        Returns the full snapshot dict or None if no snapshot has ever been captured.
        """
        cls._ensure_init()
        with cls._lock:
            if entity in cls._in_memory_snapshots:
                return cls._in_memory_snapshots[entity]

        # Check disk fallback if not in memory
        target_file = SNAPSHOT_DIR / f"{entity}_snapshot.json"
        if target_file.exists():
            try:
                with open(target_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    with cls._lock:
                        cls._in_memory_snapshots[entity] = data
                    return data
            except Exception as exc:
                logger.error(f"Failed to read disk snapshot for '{entity}': {exc}")

        return None

    @classmethod
    def is_db_available(cls) -> bool:
        """Returns True if the database is currently connected, False if unavailable."""
        cls._ensure_init()
        with cls._lock:
            return cls._db_connected

    @classmethod
    def get_system_mode(cls) -> str:
        """Returns 'LIVE' if DB is available, otherwise 'READ_ONLY'."""
        return "LIVE" if cls.is_db_available() else "READ_ONLY"

    @classmethod
    def assert_writable(cls, operation_name: str = "write") -> None:
        """
        Enforces READ-ONLY mode on mutations when PostgreSQL is temporarily unavailable.
        Raises HTTP 503 if the database is offline.
        """
        if not cls.is_db_available():
            meta = cls.get_all_snapshots_meta()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "error": "DATABASE_READ_ONLY",
                    "message": (
                        f"Database is temporarily unavailable. The system is operating in READ-ONLY mode "
                        f"using the last known snapshot. {operation_name.capitalize()} operations cannot be committed right now."
                    ),
                    "system_mode": "READ_ONLY",
                    "last_db_error": cls._last_db_error,
                    "last_success_at": cls._last_db_success_at,
                    "snapshots": meta
                }
            )

    @classmethod
    def get_all_snapshots_meta(cls) -> Dict[str, Any]:
        """Returns summary metadata for all captured snapshots without heavy payloads."""
        cls._ensure_init()
        with cls._lock:
            summary = {}
            for entity, snap in cls._in_memory_snapshots.items():
                summary[entity] = {
                    "captured_at": snap.get("captured_at"),
                    "row_count": snap.get("row_count", 0),
                    "source": snap.get("source", "unknown")
                }
            return summary
