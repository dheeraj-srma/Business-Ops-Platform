# backend/routers/inventory_router.py
import math
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, Query, status, Response
from schemas.inventory import ProductCreateSchema
from schemas.inventory_schemas import (
    InventoryItemResponse,
    InventoryListResponse,
    StockAdjustmentRequest,
    StockInRequest,
    StockInItemSchema,
    StockOutRequest,
    StockOutItemSchema,
    StockMutationResponse
)
from services.inventory_service import InventoryService
from services.snapshot_service import SnapshotService
from auth import require_role, require_permission

logger = logging.getLogger("inventory_router")
router = APIRouter(prefix="/api", tags=["Inventory & Products"])

@router.get(
    "/inventory/restock-plan",
    summary="Compute restock and reorder calculations"
)
def get_restock_plan(
    multiplier: float = Query(2.0, description="Target stock multiplier"),
    category_id: Optional[str] = Query(None, alias="categoryId", description="Category ID filter"),
    status: Optional[str] = Query(None, description="Stock status filter"),
):
    try:
        return InventoryService.get_restock_plan(
            multiplier=multiplier,
            category_id=category_id,
            status_filter=status
        )
    except Exception as exc:
        logger.error(f"Error computing restock plan: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.post(
    "/inventory/bulk-restock",
    summary="Process bulk restock consignment"
)
def bulk_restock(payload: dict):
    SnapshotService.assert_writable("bulk restock")
    try:
        return InventoryService.bulk_restock(payload)
    except Exception as exc:
        logger.error(f"Error processing bulk restock: {exc}")
        raise HTTPException(status_code=400, detail=str(exc))

@router.get(
    "/inventory",
    response_model=InventoryListResponse,
    summary="List inventory items",
    description="Retrieves inventory stock levels with permission verification, search, and pagination support."
)
def list_inventory(
    response: Response,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: Optional[int] = Query(None, ge=1, le=10000, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term for SKU, name, or category"),
    status_filter: Optional[str] = Query(None, alias="status", description="Stock health status filter"),
    current_user: dict = Depends(require_permission("inventory.view"))
):
    system_mode = SnapshotService.get_system_mode()
    response.headers["X-Database-Mode"] = system_mode
    snap_meta = SnapshotService.get_latest_snapshot_meta()
    if snap_meta and snap_meta.get("captured_at"):
        response.headers["X-Snapshot-Time"] = str(snap_meta["captured_at"])

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
        effective_page_size = page_size if page_size is not None else total_count
        effective_page_size = max(1, effective_page_size) if total_count > 0 else 1
        total_pages = max(1, math.ceil(total_count / effective_page_size)) if total_count > 0 else 1

        start_idx = (page - 1) * effective_page_size
        end_idx = start_idx + effective_page_size
        paged_batch = raw_items[start_idx:end_idx]

        mapped_items: List[InventoryItemResponse] = []
        for p in paged_batch:
            q_on_hand = float(p.get("physical_stock", p.get("Current Stock", p.get("currentStock", 0.0))))
            q_reserved = float(p.get("reserved_stock", p.get("Reserved Quantity", p.get("reservedStock", 0.0))))
            q_avail = float(p.get("available_stock", p.get("Available Stock", p.get("availableStock", q_on_hand - q_reserved))))
            cost_p = float(p.get("Cost Price", p.get("unitCost", p.get("cost_price", 0.0))))
            sale_p = float(p.get("Price", p.get("default_sale_price", cost_p)))
            c_name = str(p.get("category", p.get("Category", p.get("Brand", "General"))))

            mapped_items.append(InventoryItemResponse(
                id=str(p.get("id", p.get("sku", ""))),
                sku=str(p.get("sku", p.get("SKU", ""))),
                name=str(p.get("name", p.get("Item Name", ""))),
                category=c_name,
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
                currentStock=round(q_on_hand, 4),
                physicalStock=round(q_on_hand, 4),
                reservedStock=round(q_reserved, 4),
                availableStock=round(q_avail, 4),
                minimumStock=float(p.get("minimumStock", 15.0)),
                criticalStock=float(p.get("criticalStock", 5.0)),
                unitCost=round(cost_p, 2),
                categoryId=c_name,
                categoryName=c_name,
                isActive=bool(p.get("is_active", p.get("isActive", True))),
            ))

        is_snap = (system_mode == "READ_ONLY") or any(item.get("_source") == "backend_snapshot" for item in paged_batch)
        snap_time = snap_meta.get("captured_at") if snap_meta else None

        return InventoryListResponse(
            items=mapped_items,
            products=mapped_items,
            total_count=total_count,
            page=page,
            page_size=effective_page_size,
            total_pages=total_pages,
            system_mode=system_mode,
            is_snapshot=is_snap,
            snapshot_at=snap_time
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
    SnapshotService.assert_writable("add product")
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
    SnapshotService.assert_writable("stock adjustment")
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
    SnapshotService.assert_writable("stock inward")
    try:
        raw_items = payload.items or []
        if not raw_items and (payload.product_id or payload.productId or payload.sku) and payload.quantity:
            cost = payload.unitCost if payload.unitCost is not None else (payload.unit_cost or 0.0)
            raw_items = [
                StockInItemSchema(
                    product_id=payload.product_id or payload.productId,
                    sku=payload.sku,
                    quantity=payload.quantity,
                    unit_cost=cost
                )
            ]
        if not raw_items:
            raise ValueError("No valid stock-in items provided in request.")

        items_list = [
            {
                "product_id": it.product_id or it.productId,
                "sku": it.sku,
                "quantity": it.quantity,
                "unit_cost": it.unitCost if it.unitCost is not None else (it.unit_cost or 0.0)
            }
            for it in raw_items
        ]
        supplier_val = payload.supplier or payload.supplier_name or "Direct Supplier"
        ref_val = payload.referenceNumber or payload.reference_number or "REC-IN"

        res = InventoryService.record_stock_in(
            items=items_list,
            supplier=supplier_val,
            reference_number=ref_val,
            notes=payload.notes,
            actor=current_user
        )
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        logger.error(f"Error recording stock inward: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("/inventory/stock-out", summary="Record stock-out dispatch", description="Records stock-out consignment dispatch, deducts physical stock, and releases reservation.")
def record_stock_outward(
    payload: StockOutRequest,
    current_user: dict = Depends(require_permission(["orders.process", "inventory.manage"]))
):
    SnapshotService.assert_writable("stock outward")
    try:
        raw_items = payload.items or []
        if not raw_items and (payload.product_id or payload.productId or payload.sku) and payload.quantity:
            raw_items = [StockOutItemSchema(
                product_id=payload.product_id or payload.productId,
                sku=payload.sku,
                quantity=payload.quantity
            )]
            
        if not raw_items:
            raise ValueError("No valid stock-out items provided in request.")

        items_list = [
            {
                "product_id": it.product_id or it.productId,
                "sku": it.sku,
                "quantity": it.quantity
            }
            for it in raw_items
        ]
        ref_val = payload.referenceNumber or payload.reference_number
        res = InventoryService.record_stock_out(
            items=items_list,
            recipient=payload.recipient or "Direct Consignee",
            reference_number=ref_val,
            reason=payload.reason or "Order Fulfillment",
            notes=payload.notes,
            actor=current_user
        )
        return res
    except ValueError as ve:
        err_msg = str(ve)
        status_code = status.HTTP_409_CONFLICT if "INSUFFICIENT_STOCK" in err_msg else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=err_msg)
    except Exception as exc:
        logger.error(f"Error recording stock outward: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

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
    SnapshotService.assert_writable("inventory reconciliation fix")
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
