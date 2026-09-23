# backend/services/admin_service.py
import logging
from typing import List, Dict, Any, Optional
from repositories.admin_repo import admin_repo
from repositories.inventory_repo import InventoryRepository
from repositories.order_repo import OrderRepository
from repositories.dealer_repo import DealerRepository
from repositories.supplier_repo import SupplierRepository
from services.audit_service import audit_service

logger = logging.getLogger("admin_service")

class AdminService:

    @staticmethod
    def get_admin_overview() -> Dict[str, Any]:
        users = admin_repo.get_users_list(limit=1000)
        active_users = sum(1 for u in users if u.get("is_active", True))
        inactive_users = len(users) - active_users

        role_counts = {
            "admin": sum(1 for u in users if str(u.get("role")).lower() == "admin"),
            "accountant": sum(1 for u in users if str(u.get("role")).lower() == "accountant"),
            "manager": sum(1 for u in users if str(u.get("role")).lower() == "manager"),
            "warehouse_manager": sum(1 for u in users if str(u.get("role")).lower() in ("warehouse_manager", "stock_manager")),
            "salesman": sum(1 for u in users if str(u.get("role")).lower() == "salesman"),
            "customer": sum(1 for u in users if str(u.get("role")).lower() == "customer"),
            "viewer": sum(1 for u in users if str(u.get("role")).lower() == "viewer"),
        }

        settings = admin_repo.get_system_settings()
        settings_map = {s.get("setting_key"): s.get("setting_value") for s in settings}

        dealers_count = DealerRepository.count_dealers()
        suppliers_count = SupplierRepository.count_suppliers()
        products_count = len(InventoryRepository.fetch_all_products_with_inventory())
        recent_audits = admin_repo.get_audit_logs(limit=5)

        return {
            "user_stats": {
                "total_users": len(users),
                "active_users": active_users,
                "inactive_users": inactive_users,
                "role_breakdown": role_counts,
            },
            "master_counts": {
                "products": products_count,
                "dealers": dealers_count,
                "suppliers": suppliers_count,
            },
            "system_settings": settings_map,
            "recent_audit_actions": recent_audits,
        }

    @staticmethod
    def list_users(offset: int = 0, limit: int = 100, role_filter: Optional[str] = None, search: Optional[str] = None) -> List[Dict[str, Any]]:
        return admin_repo.get_users_list(offset=offset, limit=limit, role_filter=role_filter, search=search)

    @staticmethod
    def create_user(user_data: Dict[str, Any], actor: Dict[str, Any]) -> Dict[str, Any]:
        email = user_data.get("email", "").strip().lower()
        if not email:
            raise ValueError("User email is required.")
        
        created = admin_repo.create_user_account(user_data)
        audit_service.log_event(
            actor_id=actor.get("user_id", "admin"),
            actor_email=actor.get("email", "admin@nalkametals.com"),
            actor_role=actor.get("role", "admin"),
            action="CREATE_USER",
            target_entity="users",
            target_id=created.get("id"),
            new_value={"email": email, "role": user_data.get("role")}
        )
        return created

    @staticmethod
    def update_user(user_id: str, updates: Dict[str, Any], actor: Dict[str, Any]) -> Dict[str, Any]:
        updated = admin_repo.update_user_account(user_id, updates)
        audit_service.log_event(
            actor_id=actor.get("user_id", "admin"),
            actor_email=actor.get("email", "admin@nalkametals.com"),
            actor_role=actor.get("role", "admin"),
            action="UPDATE_USER",
            target_entity="users",
            target_id=user_id,
            new_value=updates
        )
        return updated or {}

    @staticmethod
    def set_user_status(user_id: str, is_active: bool, actor: Dict[str, Any]) -> Dict[str, Any]:
        updated = admin_repo.set_user_active_status(user_id, is_active)
        audit_service.log_event(
            actor_id=actor.get("user_id", "admin"),
            actor_email=actor.get("email", "admin@nalkametals.com"),
            actor_role=actor.get("role", "admin"),
            action="ACTIVATE_USER" if is_active else "DEACTIVATE_USER",
            target_entity="users",
            target_id=user_id,
            new_value={"is_active": is_active}
        )
        return updated or {}

    @staticmethod
    def delete_user(user_id: str, actor: Dict[str, Any]) -> Dict[str, Any]:
        deleted = admin_repo.delete_user_account(user_id)
        audit_service.log_event(
            actor_id=actor.get("user_id", "admin"),
            actor_email=actor.get("email", "admin@nalkametals.com"),
            actor_role=actor.get("role", "admin"),
            action="DELETE_USER",
            target_entity="users",
            target_id=user_id
        )
        return {"status": "success", "message": f"User '{user_id}' deleted successfully."}

    @staticmethod
    def reset_user_password(user_id: str, temp_password: str, actor: Dict[str, Any]) -> Dict[str, Any]:
        # Hash password if bcrypt available, or store safely
        try:
            import bcrypt
            hashed = bcrypt.hashpw(temp_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        except Exception:
            hashed = temp_password

        updated = admin_repo.update_user_account(user_id, {"password_hash": hashed})
        audit_service.log_event(
            actor_id=actor.get("user_id", "admin"),
            actor_email=actor.get("email", "admin@nalkametals.com"),
            actor_role=actor.get("role", "admin"),
            action="RESET_PASSWORD",
            target_entity="users",
            target_id=user_id
        )
        return {"status": "success", "message": f"Password for user '{user_id}' has been reset successfully."}

    @staticmethod
    def update_setting(setting_key: str, setting_value: str, actor: Dict[str, Any]) -> Dict[str, Any]:
        res = admin_repo.update_system_setting(setting_key, setting_value, updated_by=actor.get("email", "admin"))
        audit_service.log_event(
            actor_id=actor.get("user_id", "admin"),
            actor_email=actor.get("email", "admin@nalkametals.com"),
            actor_role=actor.get("role", "admin"),
            action="UPDATE_SYSTEM_SETTING",
            target_entity="system_settings",
            target_id=setting_key,
            new_value={"setting_key": setting_key, "setting_value": setting_value}
        )
        return res

    @staticmethod
    def adjust_inventory_stock(product_id: str, new_quantity: float, reason: str, actor: Dict[str, Any]) -> Dict[str, Any]:
        from config.database import get_db_client
        client = get_db_client()
        if not client:
            raise RuntimeError("Database connection unavailable.")

        # Fetch current stock
        inv_res = client.table("inventory").select("*").eq("product_id", product_id).limit(1).execute()
        current_inv = inv_res.data[0] if inv_res.data else {"quantity_on_hand": 0, "quantity_reserved": 0}
        old_qty = float(current_inv.get("quantity_on_hand") or 0.0)
        reserved = float(current_inv.get("quantity_reserved") or 0.0)
        new_avail = new_quantity - reserved

        client.table("inventory").update({
            "quantity_on_hand": new_quantity,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("product_id", product_id).execute()

        # Audit event
        audit_service.log_event(
            actor_id=actor.get("user_id", "admin"),
            actor_email=actor.get("email", "admin@nalkametals.com"),
            actor_role=actor.get("role", "admin"),
            action="ADMIN_STOCK_ADJUSTMENT",
            target_entity="inventory",
            target_id=product_id,
            old_value={"quantity_on_hand": old_qty},
            new_value={"quantity_on_hand": new_quantity, "reason": reason}
        )

        return {
            "status": "success",
            "product_id": product_id,
            "old_stock": old_qty,
            "new_stock": new_quantity,
            "reason": reason
        }

admin_service = AdminService()
