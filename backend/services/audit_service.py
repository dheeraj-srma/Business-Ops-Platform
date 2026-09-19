"""
Audit Service
Business logic layer for recording traceable audit logs for privileged operations.
"""
from typing import Dict, Any, Optional, List
from repositories.audit_repo import audit_repository

class AuditService:
    def record_audit(
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
        return audit_repository.create_log(
            actor_id=actor_id,
            actor_email=actor_email,
            actor_role=actor_role,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            before_state=before_state,
            after_state=after_state,
            correlation_id=correlation_id,
            ip_address=ip_address
        )

    @staticmethod
    def record_action(
        actor_id: str,
        actor_role: str = "viewer",
        action: str = "UNKNOWN",
        target_entity: str = "general",
        entity_id: Optional[str] = None,
        before_values: Optional[Dict[str, Any]] = None,
        after_values: Optional[Dict[str, Any]] = None,
        correlation_id: Optional[str] = None,
        actor_email: str = ""
    ) -> Dict[str, Any]:
        return audit_repository.create_log(
            actor_id=actor_id,
            actor_email=actor_email or f"{actor_id}@system.local",
            actor_role=actor_role,
            action=action,
            entity_type=target_entity,
            entity_id=entity_id,
            before_state=before_values,
            after_state=after_values,
            correlation_id=correlation_id
        )


    def log_event(
        self,
        actor_id: str,
        actor_email: str = "",
        actor_role: str = "admin",
        action: str = "UNKNOWN",
        target_entity: str = "general",
        target_id: Optional[str] = None,
        old_value: Optional[Dict[str, Any]] = None,
        new_value: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        return self.record_audit(
            actor_id=actor_id,
            actor_email=actor_email,
            actor_role=actor_role,
            action=action,
            entity_type=target_entity,
            entity_id=target_id,
            before_state=old_value,
            after_state=new_value
        )

    def get_audit_trail(
        self,
        limit: int = 100,
        action: Optional[str] = None,
        entity_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        return audit_repository.list_logs(limit=limit, action=action, entity_type=entity_type)

audit_service = AuditService()
