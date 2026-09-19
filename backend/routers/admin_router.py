# backend/routers/admin_router.py
import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, status
from services.admin_service import admin_service
from repositories.admin_repo import admin_repo
from auth import require_role

logger = logging.getLogger("admin_router")
router = APIRouter(prefix="/api/admin", tags=["Central Admin Control Center"])

@router.get("/overview")
def get_admin_overview(
    current_user: dict = Depends(require_role(["admin", "manager"]))
):
    try:
        return admin_service.get_admin_overview()
    except Exception as exc:
        logger.error(f"Error fetching admin overview: {exc}")
        raise HTTPException(status_code=500, detail="Failed to retrieve admin control overview.")

@router.get("/users")
def list_users(
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    role: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: dict = Depends(require_role(["admin", "manager"]))
):
    try:
        users = admin_service.list_users(offset=offset, limit=limit, role_filter=role, search=search)
        page_num = (offset // limit) + 1 if limit > 0 else 1
        return {
            "items": users,
            "users": users,
            "page": page_num,
            "page_size": limit,
            "total": len(users),
            "has_next": False,
            "count": len(users)
        }
    except RuntimeError as rerr:
        logger.error(f"Database error listing users: {rerr}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(rerr))
    except Exception as exc:
        logger.error(f"Error listing users: {exc}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve user accounts from database.")

@router.post("/users")
def create_user(
    payload: dict,
    current_user: dict = Depends(require_role(["admin"]))
):
    try:
        return admin_service.create_user(payload, current_user)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        logger.error(f"Error creating user: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.patch("/users/{user_id}")
def update_user(
    user_id: str,
    payload: dict,
    current_user: dict = Depends(require_role(["admin"]))
):
    try:
        return admin_service.update_user(user_id, payload, current_user)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        logger.error(f"Error updating user '{user_id}': {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.delete("/users/{user_id}")
def delete_user(
    user_id: str,
    current_user: dict = Depends(require_role(["admin"]))
):
    try:
        return admin_service.delete_user(user_id, current_user)
    except Exception as exc:
        logger.error(f"Error deleting user '{user_id}': {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("/users/{user_id}/status")
def set_user_status(
    user_id: str,
    payload: dict,
    current_user: dict = Depends(require_role(["admin"]))
):
    is_active = payload.get("is_active", True)
    try:
        return admin_service.set_user_status(user_id, is_active, current_user)
    except Exception as exc:
        logger.error(f"Error updating user status '{user_id}': {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("/users/{user_id}/reset-password")
def reset_password(
    user_id: str,
    payload: dict,
    current_user: dict = Depends(require_role(["admin"]))
):
    temp_pass = payload.get("password") or "NalkaTemp2026!"
    try:
        return admin_service.reset_user_password(user_id, temp_pass, current_user)
    except Exception as exc:
        logger.error(f"Error resetting password for user '{user_id}': {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/settings")
def get_system_settings(
    current_user: dict = Depends(require_role(["admin", "manager"]))
):
    try:
        return {"settings": admin_repo.get_system_settings()}
    except RuntimeError as rerr:
        logger.error(f"Database error fetching settings: {rerr}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(rerr))
    except Exception as exc:
        logger.error(f"Error fetching system settings: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.patch("/settings/{key}")
def update_setting(
    key: str,
    payload: dict,
    current_user: dict = Depends(require_role(["admin"]))
):
    value = payload.get("setting_value") or payload.get("value") or ""
    try:
        return admin_service.update_setting(key, str(value), current_user)
    except Exception as exc:
        logger.error(f"Error updating setting '{key}': {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("/inventory/adjust")
def adjust_inventory_stock(
    payload: dict,
    current_user: dict = Depends(require_role(["admin"]))
):
    product_id = payload.get("product_id")
    new_quantity = payload.get("new_quantity")
    reason = payload.get("reason", "Admin manual stock correction")

    if not product_id or new_quantity is None:
        raise HTTPException(status_code=400, detail="Fields 'product_id' and 'new_quantity' are required.")

    try:
        return admin_service.adjust_inventory_stock(product_id, float(new_quantity), reason, current_user)
    except Exception as exc:
        logger.error(f"Error adjusting stock for product '{product_id}': {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/audit-logs")
def get_audit_logs(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    action: Optional[str] = Query(None),
    current_user: dict = Depends(require_role(["admin", "manager"]))
):
    try:
        logs = admin_repo.get_audit_logs(offset=offset, limit=limit, action=action)
        return {"logs": logs, "count": len(logs)}
    except RuntimeError as rerr:
        logger.error(f"Database error listing audit logs: {rerr}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(rerr))
    except Exception as exc:
        logger.error(f"Error listing audit logs: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/system-health")
def get_system_health():
    from config.database import get_db_client
    client = get_db_client(raise_on_missing=False)
    db_connected = False
    db_error = None
    if client is not None:
        try:
            res = client.table("system_settings").select("id").limit(1).execute()
            db_connected = res is not None
        except Exception as exc:
            db_connected = False
            db_error = str(exc)

    return {
        "status": "healthy" if db_connected else "degraded",
        "database": {
            "connected": db_connected,
            "engine": "PostgreSQL (Supabase)",
            "error": db_error
        },
        "backend": {
            "framework": "FastAPI",
            "version": "2.0.0",
        },
        "tally_integration": {
            "status": "configured",
        }
    }
