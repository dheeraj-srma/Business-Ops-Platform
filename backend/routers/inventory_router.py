# backend/routers/inventory_router.py
import math
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, Query, status
from schemas.inventory import ProductCreateSchema
from schemas.inventory_schemas import (
    InventoryItemResponse,
    InventoryListResponse,
    StockAdjustmentRequest,
    StockInRequest,
    StockMutationResponse
)
from services.inventory_service import InventoryService
from auth import require_role, require_permission

logger = logging.getLogger("inventory_router")
router = APIRouter(prefix="/api", tags=["Inventory & Products"])

@router.get(
    "/inventory",
    response_model=InventoryListResponse,
    summary="List inventory items",
    description="Retrieves inventory stock levels with permission verification, search, and pagination support."
)
def list_inventory(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=500, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term for SKU, name, or category"),
    status_filter: Optional[str] = Query(None, alias="status", description="Stock health status filter"),
    current_user: dict = Depends(require_permission("inventory.view"))
):
    try:
        raw_items = InventoryService.list_inventory()
        
        # Apply filtering
        if search:
            search_clean = search.strip().lower()
            raw_items = [
                item for item in raw_items
                if search_clean in str(item.get("sku", "")).lower()
                or search_clean in str(item.get("name", "")).lower()
                or search_clean in str(item.get("Category", "")).lower()
            ]
        if status_filter:
            raw_items = [item for item in raw_items if str(item.get("status", "")).upper() == status_filter.upper()]

        total_count = len(raw_items)
        total_pages = max(1, math.ceil(total_count / page_size)) if total_count > 0 else 1

        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paged_batch = raw_items[start_idx:end_idx]

        mapped_items: List[InventoryItemResponse] = []
        for p in paged_batch:
            q_on_hand = float(p.get("physical_stock", p.get("Current Stock", p.get("currentStock", 0.0))))
            q_reserved = float(p.get("reserved_stock", p.get("Reserved Quantity", p.get("reservedStock", 0.0))))
            q_avail = float(p.get("available_stock", p.get("Available Stock", p.get("availableStock", q_on_hand - q_reserved))))
            cost_p = float(p.get("Cost Price", p.get("unitCost", p.get("cost_price", 0.0))))
            sale_p = float(p.get("Price", p.get("default_sale_price", cost_p)))

            mapped_items.append(InventoryItemResponse(
                id=str(p.get("id", p.get("sku", ""))),
                sku=str(p.get("sku", p.get("SKU", ""))),
                name=str(p.get("name", p.get("Item Name", ""))),
                category=str(p.get("category", p.get("Category", p.get("Brand", "General")))),
                brand=str(p.get("Brand", "Nalka Metals")),
                cost_price=round(cost_p, 2),
                sale_price=round(sale_p, 2),
                physical_stock=round(q_on_hand, 4),
                reserved_stock=round(q_reserved, 4),
                available_stock=round(q_avail, 4),
                unit=str(p.get("unit", p.get("Unit", "NOS"))),
                status=str(p.get("status", "HEALTHY")),
                is_active=bool(p.get("is_active", p.get("isActive", True))),
                updated_at=str(p.get("Updated At", "")) if p.get("Updated At") else None,
            ))

        return InventoryListResponse(
            items=mapped_items,
            total_count=total_count,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
    except Exception as exc:
        logger.error(f"Error listing inventory: {exc}")
        raise HTTPException(status_code=500, detail="Failed to retrieve inventory items.")

@router.get(
    "/inventory/{product_id}",
    response_model=InventoryItemResponse,
    summary="Get inventory details for product"
)
def get_inventory_item(
    product_id: str,
    current_user: dict = Depends(require_permission("inventory.view"))
):
    try:
        raw_items = InventoryService.list_inventory()
        p = next((item for item in raw_items if str(item.get("id")) == str(product_id) or str(item.get("sku")).lower() == str(product_id).lower()), None)
        if not p:
            raise HTTPException(status_code=404, detail=f"Inventory record for product '{product_id}' not found.")
            
        q_on_hand = float(p.get("physical_stock", p.get("Current Stock", p.get("currentStock", 0.0))))
        q_reserved = float(p.get("reserved_stock", p.get("Reserved Quantity", p.get("reservedStock", 0.0))))
        q_avail = float(p.get("available_stock", p.get("Available Stock", p.get("availableStock", q_on_hand - q_reserved))))
        cost_p = float(p.get("Cost Price", p.get("unitCost", p.get("cost_price", 0.0))))
        sale_p = float(p.get("Price", p.get("default_sale_price", cost_p)))

        return InventoryItemResponse(
            id=str(p.get("id", p.get("sku", ""))),
            sku=str(p.get("sku", p.get("SKU", ""))),
            name=str(p.get("name", p.get("Item Name", ""))),
            category=str(p.get("category", p.get("Category", p.get("Brand", "General")))),
            brand=str(p.get("Brand", "Nalka Metals")),
            cost_price=round(cost_p, 2),
            sale_price=round(sale_p, 2),
            physical_stock=round(q_on_hand, 4),
            reserved_stock=round(q_reserved, 4),
            available_stock=round(q_avail, 4),
            unit=str(p.get("unit", p.get("Unit", "NOS"))),
            status=str(p.get("status", "HEALTHY")),
            is_active=bool(p.get("is_active", p.get("isActive", True))),
            updated_at=str(p.get("Updated At", "")) if p.get("Updated At") else None,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error getting inventory for product '{product_id}': {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

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

@router.post("/inventory/adjust", response_model=StockMutationResponse, summary="Manual stock adjustment", description="Executes manual stock count adjustment with atomic transaction protection.")
def adjust_inventory_stock(
    payload: StockAdjustmentRequest,
    current_user: dict = Depends(require_permission("inventory.manage"))
):
    try:
        res = InventoryService.adjust_stock(
            product_id=payload.product_id,
            new_quantity=payload.new_quantity,
            reason=payload.reason,
            actor=current_user,
            location_id=payload.location_id
        )
        return StockMutationResponse(
            status="success",
            product_id=res["product_id"],
            previous_quantity=res["previous_quantity"],
            new_quantity=res["new_quantity"],
            available_quantity=res["available_quantity"],
            timestamp=res["timestamp"]
        )
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as exc:
        logger.error(f"Error executing stock adjustment: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("/inventory/stock-in", summary="Record inward inventory stock", description="Records stock-in transaction and updates physical and available inventory levels.")
def record_stock_inward(
    payload: StockInRequest,
    current_user: dict = Depends(require_permission("inventory.manage"))
):
    try:
        res = InventoryService.record_stock_in(
            items=[{
                "product_id": payload.product_id,
                "quantity": payload.quantity,
                "unit_cost": payload.unit_cost
            }],
            supplier=payload.supplier_name,
            reference_number=payload.reference_number,
            notes=payload.notes
        )
        return res
    except Exception as exc:
        logger.error(f"Error recording stock inward: {exc}")
        raise HTTPException(status_code=400, detail=str(exc))

@router.post("/inventory/stock-out", summary="Record stock-out dispatch", description="Records stock-out consignment dispatch, deducts physical stock, and releases reservation.")
def record_stock_outward(
    payload: StockOutRequest,
    current_user: dict = Depends(require_permission("orders.process"))
):
    try:
        raw_items = payload.items or []
        if not raw_items and payload.product_id and payload.quantity:
            raw_items = [StockOutItemSchema(product_id=payload.product_id, quantity=payload.quantity)]
            
        items_list = [
            {
                "product_id": it.product_id or it.productId,
                "sku": it.sku,
                "quantity": it.quantity
            }
            for it in raw_items
        ]
        res = InventoryService.record_stock_out(
            items=items_list,
            recipient=payload.recipient,
            reference_number=payload.reference_number,
            reason=payload.reason,
            notes=payload.notes,
            actor=current_user
        )
        return res
    except Exception as exc:
        logger.error(f"Error recording stock outward: {exc}")
        raise HTTPException(status_code=400, detail=str(exc))

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
