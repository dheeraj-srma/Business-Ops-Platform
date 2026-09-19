# backend/routers/inventory_router.py
import logging
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from schemas.inventory import ProductCreateSchema
from services.inventory_service import InventoryService
from auth import require_role

logger = logging.getLogger("inventory_router")
router = APIRouter(prefix="/api", tags=["Inventory & Products"])

@router.get("/inventory")
def list_inventory():
    try:
        return InventoryService.list_inventory()
    except Exception as exc:
        logger.error(f"Error listing inventory: {exc}")
        return []

@router.post("/inventory")
def add_product(
    product: ProductCreateSchema,
    current_user: dict = Depends(require_role(["admin", "stock_manager"]))
):
    try:
        return InventoryService.add_product(product)
    except Exception as exc:
        logger.error(f"Error adding product: {exc}")
        raise HTTPException(status_code=400, detail=str(exc))

@router.get("/categories")
def list_categories():
    try:
        prods = InventoryService.list_inventory()
        cats_set = set()
        for p in prods:
            c = p.get("Category") or p.get("categoryName") or p.get("Brand") or "General"
            if c:
                cats_set.add(str(c).strip())
        sorted_cats = sorted(list(cats_set))
        return [
            {
                "id": name,
                "name": name,
                "description": f"{name} catalog category",
                "isActive": True,
                "is_active": True,
                "createdAt": "2026-09-17T00:00:00Z",
                "updatedAt": "2026-09-17T00:00:00Z",
                "created_at": "2026-09-17T00:00:00Z",
                "updated_at": "2026-09-17T00:00:00Z"
            }
            for name in sorted_cats
        ]
    except Exception as exc:
        logger.error(f"Error listing categories: {exc}")
        return []

@router.get("/dealers")
def list_dealers():
    try:
        return InventoryService.get_dealers()
    except Exception as exc:
        logger.error(f"Error listing dealers: {exc}")
        return []

@router.get("/locations")
def list_locations():
    try:
        return InventoryService.get_locations()
    except Exception as exc:
        logger.error(f"Error listing locations: {exc}")
        return []

@router.get("/suppliers")
def list_suppliers():
    try:
        return InventoryService.get_suppliers()
    except Exception as exc:
        logger.error(f"Error listing suppliers: {exc}")
        return []

@router.get("/inventory/reconcile")
def audit_inventory_reconciliation(
    current_user: dict = Depends(require_role(["admin", "stock_manager"]))
):
    from services.reconciliation_service import reconciliation_service
    return reconciliation_service.audit_inventory_invariant()

@router.post("/inventory/reconcile/fix")
def fix_inventory_reconciliation(
    product_id: str,
    current_user: dict = Depends(require_role(["admin"]))
):
    from services.reconciliation_service import reconciliation_service
    try:
        return reconciliation_service.fix_inventory_discrepancy(
            product_id=product_id,
            actor_id=current_user.get("user_id") or current_user.get("sub", "admin"),
            actor_email=current_user.get("email", "admin@nalkametals.com"),
            actor_role=current_user.get("role", "admin")
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

