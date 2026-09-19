# backend/repositories/audit_repo.py
"""
Audit Repository
Handles persistence of privileged action audit logs in PostgreSQL/Supabase.
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid
import logging
from config.database import get_db_client

logger = logging.getLogger("audit_repo")

VALID_ACTIONS = {"insert", "update", "delete"}

class AuditRepository:
    def create_log(
        self,
        actor_id: str,
        actor_email: str,
        actor_role: str,
        action: str,
        entity_type: str,
        entity_id: Optional[str] = None,
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None,
        correlation_id: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        # Normalize action to fit PostgreSQL check constraint ('insert', 'update', 'delete')
        act_clean = action.lower()
        if act_clean not in VALID_ACTIONS:
            if "create" in act_clean or "insert" in act_clean or "add" in act_clean:
                act_clean = "insert"
            elif "delete" in act_clean or "remove" in act_clean:
                act_clean = "delete"
            else:
                act_clean = "update"

        # Format record_id as valid UUID if string passed
        record_uuid = str(uuid.uuid4())
        if entity_id:
            try:
                record_uuid = str(uuid.UUID(entity_id))
            except Exception:
                pass

        # Validate actor_id against users table or leave None to avoid FK constraint error
        changed_by_user_id = None
        if actor_id:
            try:
                valid_uuid = str(uuid.UUID(actor_id))
                client = get_db_client()
                if client:
                    user_check = client.table("users").select("id").eq("id", valid_uuid).limit(1).execute()
                    if user_check.data:
                        changed_by_user_id = valid_uuid
            except Exception:
                pass

        log_entry = {
            "id": str(uuid.uuid4()),
            "table_name": entity_type or "system_settings",
            "record_id": record_uuid,
            "action": act_clean,
            "old_values": before_state or {},
            "new_values": after_state or {"actor_email": actor_email, "actor_role": actor_role, "original_action": action},
            "changed_by": changed_by_user_id,
            "changed_at": datetime.utcnow().isoformat()
        }

        client = get_db_client()
        if client:
            try:
                res = client.table("audit_log").insert(log_entry).execute()
                if res.data:
                    return res.data[0]
            except Exception as err:
                logger.error(f"Error persisting audit log entry to PostgreSQL: {err}")

        return log_entry

    def list_logs(
        self,
        limit: int = 100,
        action: Optional[str] = None,
        entity_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        client = get_db_client()
        if client:
            try:
                query = client.table("audit_log").select("*")
                if action:
                    query = query.eq("action", action.lower())
                if entity_type:
                    query = query.eq("table_name", entity_type)
                res = query.order("changed_at", desc=True).limit(limit).execute()
                if res.data is not None:
                    return res.data
            except Exception as err:
                logger.error(f"Error reading audit log from PostgreSQL: {err}")
        return []

audit_repository = AuditRepository()
