# backend/repositories/data_exchange_repo.py
"""
Data Exchange Repository.
Provides transactional storage for exchange batch logs, cryptographic payload receipts,
entity alias mappings, and exchange audit records.
Uses localized SQLite database for guaranteed atomic tracking alongside Supabase client.
"""

import os
import json
import sqlite3
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

logger = logging.getLogger("data_exchange_repo")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
EXCHANGE_DB_PATH = DATA_DIR / "data_exchange.db"


class DataExchangeRepository:
    _initialized = False

    @classmethod
    def get_connection(cls) -> sqlite3.Connection:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(EXCHANGE_DB_PATH))
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn

    @classmethod
    def init_db(cls) -> None:
        if cls._initialized and EXCHANGE_DB_PATH.exists():
            return
        conn = cls.get_connection()
        try:
            with conn:
                conn.executescript("""
                CREATE TABLE IF NOT EXISTS data_exchange_batches (
                    id TEXT PRIMARY KEY,
                    exchange_type TEXT NOT NULL,
                    schema_version TEXT NOT NULL,
                    source TEXT NOT NULL,
                    destination TEXT NOT NULL,
                    direction TEXT NOT NULL,
                    status TEXT NOT NULL,
                    payload_hash TEXT NOT NULL,
                    record_count INTEGER DEFAULT 0,
                    created_count INTEGER DEFAULT 0,
                    updated_count INTEGER DEFAULT 0,
                    skipped_count INTEGER DEFAULT 0,
                    conflicts_count INTEGER DEFAULT 0,
                    errors_count INTEGER DEFAULT 0,
                    warnings_count INTEGER DEFAULT 0,
                    total_amount REAL DEFAULT 0.0,
                    total_quantity REAL DEFAULT 0.0,
                    operator_email TEXT,
                    operator_role TEXT,
                    receipt_json TEXT,
                    created_at TEXT NOT NULL,
                    committed_at TEXT
                );

                CREATE INDEX IF NOT EXISTS idx_exchange_hash ON data_exchange_batches(payload_hash);
                CREATE INDEX IF NOT EXISTS idx_exchange_type ON data_exchange_batches(exchange_type);
                CREATE INDEX IF NOT EXISTS idx_exchange_created ON data_exchange_batches(created_at);
                """)
                cls._initialized = True
        except Exception as e:
            logger.error(f"Error initializing data exchange db: {e}")
            raise

    @classmethod
    def find_batch_by_hash(cls, payload_hash: str) -> Optional[Dict[str, Any]]:
        cls.init_db()
        conn = cls.get_connection()
        try:
            cur = conn.cursor()
            cur.execute("SELECT * FROM data_exchange_batches WHERE payload_hash = ? AND status = 'COMMITTED' LIMIT 1", (payload_hash,))
            row = cur.fetchone()
            if row:
                d = dict(row)
                if d.get("receipt_json"):
                    try:
                        d["receipt"] = json.loads(d["receipt_json"])
                    except Exception:
                        pass
                return d
            return None
        finally:
            conn.close()

    @classmethod
    def get_batch_by_id(cls, batch_id: str) -> Optional[Dict[str, Any]]:
        cls.init_db()
        conn = cls.get_connection()
        try:
            cur = conn.cursor()
            cur.execute("SELECT * FROM data_exchange_batches WHERE id = ? LIMIT 1", (batch_id,))
            row = cur.fetchone()
            if row:
                d = dict(row)
                if d.get("receipt_json"):
                    try:
                        d["receipt"] = json.loads(d["receipt_json"])
                    except Exception:
                        pass
                return d
            return None
        finally:
            conn.close()

    @classmethod
    def save_batch(cls, batch: Dict[str, Any]) -> Dict[str, Any]:
        cls.init_db()
        conn = cls.get_connection()
        try:
            with conn:
                receipt_str = json.dumps(batch.get("receipt")) if batch.get("receipt") else None
                conn.execute("""
                INSERT OR REPLACE INTO data_exchange_batches (
                    id, exchange_type, schema_version, source, destination, direction, status,
                    payload_hash, record_count, created_count, updated_count, skipped_count,
                    conflicts_count, errors_count, warnings_count, total_amount, total_quantity,
                    operator_email, operator_role, receipt_json, created_at, committed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    batch["id"],
                    batch["exchange_type"],
                    batch.get("schema_version", "1.0"),
                    batch.get("source", "TALLY"),
                    batch.get("destination", "BUSINESS_OPS_PLATFORM"),
                    batch.get("direction", "IMPORT"),
                    batch.get("status", "PREVIEWED"),
                    batch["payload_hash"],
                    batch.get("record_count", 0),
                    batch.get("created_count", 0),
                    batch.get("updated_count", 0),
                    batch.get("skipped_count", 0),
                    batch.get("conflicts_count", 0),
                    batch.get("errors_count", 0),
                    batch.get("warnings_count", 0),
                    batch.get("total_amount", 0.0),
                    batch.get("total_quantity", 0.0),
                    batch.get("operator_email", "admin@nalkametals.com"),
                    batch.get("operator_role", "admin"),
                    receipt_str,
                    batch.get("created_at", datetime.now(timezone.utc).isoformat()),
                    batch.get("committed_at")
                ))
            return batch
        finally:
            conn.close()

    @classmethod
    def list_batches(cls, limit: int = 50, exchange_type: Optional[str] = None) -> List[Dict[str, Any]]:
        cls.init_db()
        conn = cls.get_connection()
        try:
            cur = conn.cursor()
            query = "SELECT * FROM data_exchange_batches"
            params = []
            if exchange_type:
                query += " WHERE exchange_type = ?"
                params.append(exchange_type)
            query += " ORDER BY created_at DESC LIMIT ?"
            params.append(limit)
            cur.execute(query, tuple(params))
            rows = cur.fetchall()
            results = []
            for r in rows:
                d = dict(r)
                if d.get("receipt_json"):
                    try:
                        d["receipt"] = json.loads(d["receipt_json"])
                    except Exception:
                        pass
                results.append(d)
            return results
        finally:
            conn.close()

    @classmethod
    def get_entity_mapping(cls, entity_type: str, external_identifier: str) -> Optional[Dict[str, Any]]:
        cls.init_db()
        conn = cls.get_connection()
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT * FROM entity_mappings WHERE entity_type = ? AND external_identifier = ? LIMIT 1",
                (entity_type.upper(), external_identifier.strip().upper())
            )
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    @classmethod
    def save_entity_mapping(cls, entity_type: str, external_identifier: str, internal_id: str, internal_label: str = "", mapped_by: str = "admin") -> Dict[str, Any]:
        cls.init_db()
        conn = cls.get_connection()
        now_str = datetime.utcnow().isoformat()
        import uuid
        mapping_id = str(uuid.uuid4())
        try:
            with conn:
                conn.execute("""
                INSERT INTO entity_mappings (
                    id, entity_type, external_identifier, internal_id, internal_label, is_verified, mapped_by, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
                ON CONFLICT(entity_type, external_identifier) DO UPDATE SET
                    internal_id = excluded.internal_id,
                    internal_label = excluded.internal_label,
                    mapped_by = excluded.mapped_by,
                    updated_at = excluded.updated_at
                """, (
                    mapping_id,
                    entity_type.upper(),
                    external_identifier.strip().upper(),
                    internal_id,
                    internal_label,
                    mapped_by,
                    now_str,
                    now_str
                ))
            return {
                "entity_type": entity_type,
                "external_identifier": external_identifier,
                "internal_id": internal_id,
                "internal_label": internal_label
            }
        finally:
            conn.close()


data_exchange_repo = DataExchangeRepository
