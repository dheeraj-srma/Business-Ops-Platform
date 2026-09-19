# backend/config/database.py
import logging
from typing import Optional
from supabase import Client
from supabase_client import get_supabase_client

logger = logging.getLogger("database")

def get_db_client(raise_on_missing: bool = False) -> Optional[Client]:
    """
    Returns authoritative Supabase/PostgreSQL client instance.
    Centralized database access layer for all repositories and services.
    """
    return get_supabase_client(raise_on_missing=raise_on_missing)
