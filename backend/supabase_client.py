import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(env_path)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_ANON_KEY", "")

from typing import Optional

_client: Optional[Client] = None

def get_supabase_client(raise_on_missing: bool = False) -> Optional[Client]:
    global _client
    if _client is None:
        url = os.environ.get("SUPABASE_URL") or SUPABASE_URL
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_ANON_KEY") or SUPABASE_KEY
        if not url or not key:
            if raise_on_missing:
                raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in .env")
            return None
        try:
            _client = create_client(url, key)
        except Exception:
            if raise_on_missing:
                raise
            return None
    return _client


