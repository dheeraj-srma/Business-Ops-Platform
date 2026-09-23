# backend/repositories/mapping_repo.py
"""
Central Mapping Repository.
Persists external-to-internal entity mappings across systems (Tally, Busy, ERP)
for CUSTOMER, PRODUCT_SKU, SALESMAN, SUPPLIER, and TAX_LEDGER.
"""

import sqlite3
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

logger = logging.getLogger("mapping_repo")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
EXCHANGE_DB_PATH = DATA_DIR / "data_exchange.db"


class MappingRepository:
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
        if cls._initialized:
            return
        conn = cls.get_connection()
        try:
            with conn:
                # Check existing table columns if table already exists
                cur = conn.cursor()
                cur.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='entity_mappings'")
                table_exists = cur.fetchone()[0] > 0
                
                if table_exists:
                    cur.execute("PRAGMA table_info(entity_mappings)")
                    cols = [row["name"] for row in cur.fetchall()]
                    if "external_system" not in cols:
                        conn.execute("DROP TABLE IF EXISTS entity_mappings")

                conn.executescript("""
                CREATE TABLE IF NOT EXISTS entity_mappings (
                    id TEXT PRIMARY KEY,
                    external_system TEXT NOT NULL,
                    entity_type TEXT NOT NULL,
                    external_id TEXT NOT NULL,
                    external_name TEXT NOT NULL,
                    internal_entity_id TEXT,
                    internal_entity_name TEXT,
                    mapping_status TEXT NOT NULL DEFAULT 'APPROVED',
                    confidence REAL DEFAULT 1.0,
                    notes TEXT,
                    created_by TEXT NOT NULL DEFAULT 'system',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    last_verified_at TEXT,
                    UNIQUE(external_system, entity_type, external_id)
                );
                CREATE INDEX IF NOT EXISTS idx_mappings_lookup 
                ON entity_mappings(external_system, entity_type, external_id);
                """)
            cls._initialized = True
        finally:
            conn.close()

    @classmethod
    def find_mapping(cls, external_system: str, entity_type: str, external_id: str) -> Optional[Dict[str, Any]]:
        cls.init_db()
        conn = cls.get_connection()
        try:
            cur = conn.cursor()
            cur.execute("""
            SELECT * FROM entity_mappings 
            WHERE external_system = ? AND entity_type = ? AND UPPER(external_id) = UPPER(?)
            """, (external_system, entity_type, external_id.strip()))
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    @classmethod
    def find_mapping_by_name(cls, external_system: str, entity_type: str, external_name: str) -> Optional[Dict[str, Any]]:
        cls.init_db()
        conn = cls.get_connection()
        try:
            cur = conn.cursor()
            cur.execute("""
            SELECT * FROM entity_mappings 
            WHERE external_system = ? AND entity_type = ? AND UPPER(external_name) = UPPER(?)
            """, (external_system, entity_type, external_name.strip()))
            row = cur.fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    @classmethod
    def save_mapping(cls, mapping: Dict[str, Any]) -> Dict[str, Any]:
        cls.init_db()
        conn = cls.get_connection()
        now_iso = datetime.now(timezone.utc).isoformat()
        try:
            with conn:
                conn.execute("""
                INSERT INTO entity_mappings (
                    id, external_system, entity_type, external_id, external_name,
                    internal_entity_id, internal_entity_name, mapping_status, confidence,
                    notes, created_by, created_at, updated_at, last_verified_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(external_system, entity_type, external_id) DO UPDATE SET
                    external_name = excluded.external_name,
                    internal_entity_id = excluded.internal_entity_id,
                    internal_entity_name = excluded.internal_entity_name,
                    mapping_status = excluded.mapping_status,
                    confidence = excluded.confidence,
                    notes = excluded.notes,
                    updated_at = excluded.updated_at,
                    last_verified_at = excluded.last_verified_at
                """, (
                    mapping["id"],
                    mapping["external_system"],
                    mapping["entity_type"],
                    mapping["external_id"].strip(),
                    mapping.get("external_name", "").strip(),
                    mapping.get("internal_entity_id"),
                    mapping.get("internal_entity_name"),
                    mapping.get("mapping_status", "APPROVED"),
                    float(mapping.get("confidence", 1.0)),
                    mapping.get("notes"),
                    mapping.get("created_by", "system"),
                    mapping.get("created_at", now_iso),
                    now_iso,
                    mapping.get("last_verified_at", now_iso)
                ))
            return mapping
        finally:
            conn.close()

    @classmethod
    def list_mappings(cls, entity_type: Optional[str] = None, external_system: Optional[str] = None) -> List[Dict[str, Any]]:
        cls.init_db()
        conn = cls.get_connection()
        try:
            cur = conn.cursor()
            query = "SELECT * FROM entity_mappings WHERE 1=1"
            params = []
            if entity_type:
                query += " AND entity_type = ?"
                params.append(entity_type)
            if external_system:
                query += " AND external_system = ?"
                params.append(external_system)
            query += " ORDER BY updated_at DESC"
            cur.execute(query, tuple(params))
            return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()


mapping_repo = MappingRepository()
