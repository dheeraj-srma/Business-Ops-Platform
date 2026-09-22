# backend/routers/product_router.py
import math
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, status
from datetime import datetime
from services.inventory_service import InventoryService
from services.snapshot_service import SnapshotService
from auth import require_permission
from supabase_client import get_supabase_client
from schemas.inventory import ProductCreateSchema
from schemas.product_schemas import (
    ProductResponse,
    ProductListResponse,
    ProductCreateRequest,
    ProductUpdateRequest,
    ProductMutationResponse
)

logger = logging.getLogger("product_router")
router = APIRouter(prefix="/api/products", tags=["Products Catalog"])

@router.get(
    "",
    response_model=ProductListResponse,
    summary="List products catalog",
    description="Retrieves catalog products with pagination and search support."
)
def list_products(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: Optional[int] = Query(None, ge=1, le=10000, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term for SKU or name"),
    status_filter: Optional[str] = Query(None, alias="status", description="Status filter"),
    current_user: dict = Depends(require_permission("products.view"))
):
    try:
        inv = InventoryService.list_inventory()
        
        # Apply filtering
        if search:
            search_clean = search.strip().lower()
            inv = [
                p for p in inv 
                if search_clean in str(p.get("sku", "")).lower() 
                or search_clean in str(p.get("name", "")).lower() 
                or search_clean in str(p.get("category", "")).lower()
                or search_clean in str(p.get("Category", "")).lower()
            ]
        if status_filter:
            inv = [p for p in inv if str(p.get("status", "")).upper() == status_filter.upper()]

        total_count = len(inv)
        effective_page_size = page_size if page_size is not None else total_count
        effective_page_size = max(1, effective_page_size) if total_count > 0 else 1
        total_pages = max(1, math.ceil(total_count / effective_page_size)) if total_count > 0 else 1
        
        start_idx = (page - 1) * effective_page_size
        end_idx = start_idx + effective_page_size
        paged_items = inv[start_idx:end_idx]

        # Map to database-independent API models
        mapped_products: List[ProductResponse] = []
        for p in paged_items:
            stock_val = float(p.get("currentStock", p.get("Current Stock", p.get("physical_stock", p.get("stock", 0.0)))))
            res_val = float(p.get("reservedStock", p.get("Reserved Quantity", p.get("reserved_stock", 0.0))))
            avail_val = float(p.get("availableStock", p.get("Available Stock", p.get("available_stock", stock_val - res_val))))
            cost_val = float(p.get("unitCost", p.get("Cost Price", p.get("cost_price", 0.0))))
            price_val = float(p.get("price", p.get("Price", p.get("default_sale_price", cost_val))))
            c_name = str(p.get("categoryName") or p.get("Category") or p.get("category") or p.get("brand") or "General")
            
            mapped_products.append(ProductResponse(
                id=str(p.get("id", p.get("sku", ""))),
                sku=str(p.get("sku", "")),
                name=str(p.get("name", "")),
                category=c_name,
                price=price_val,
                unit_price=price_val,
                stock=stock_val,
                current_stock=stock_val,
                min_stock=float(p.get("minimumStock", p.get("min_stock", 15.0))),
                hsn_code=str(p.get("hsn_code", "")) if p.get("hsn_code") else None,
                unit=str(p.get("unit", p.get("Unit", "NOS"))),
                status=str(p.get("status", "HEALTHY")),
                description=str(p.get("description", "")) if p.get("description") else None,
                currentStock=stock_val,
                physicalStock=stock_val,
                reservedStock=res_val,
                availableStock=avail_val,
                minimumStock=float(p.get("minimumStock", p.get("min_stock", 15.0))),
                criticalStock=float(p.get("criticalStock", 5.0)),
                unitCost=cost_val,
                categoryId=c_name,
                categoryName=c_name,
                isActive=bool(p.get("is_active", p.get("isActive", True))),
            ))

        return ProductListResponse(
            products=mapped_products,
            items=mapped_products,
            total_count=total_count,
            page=page,
            page_size=effective_page_size,
            total_pages=total_pages
        )
    except Exception as exc:
        logger.error(f"Error fetching products catalog: {exc}")
        raise HTTPException(status_code=500, detail="Failed to retrieve products catalog.")

@router.get("/{product_id}", summary="Get product details", description="Retrieves details and stock summary for a specific product.")
def get_product(
    product_id: str,
    current_user: dict = Depends(require_permission("products.view"))
):
    try:
        inv = InventoryService.list_inventory()
        p = next((item for item in inv if str(item.get("id")) == str(product_id) or str(item.get("sku")).lower() == str(product_id).lower()), None)
        if not p:
            raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found.")
            
        stock_val = float(p.get("stock", p.get("Current Stock", p.get("quantity", 0.0))))
        price_val = float(p.get("price", p.get("default_sale_price", p.get("unit_price", 0.0))))

        prod_resp = ProductResponse(
            id=str(p.get("id", p.get("sku", ""))),
            sku=str(p.get("sku", "")),
            name=str(p.get("name", "")),
            category=p.get("category") or p.get("brand"),
            price=price_val,
            unit_price=price_val,
            stock=stock_val,
            current_stock=stock_val,
            min_stock=float(p.get("min_stock", 0.0)),
            hsn_code=str(p.get("hsn_code", "")) if p.get("hsn_code") else None,
            unit=str(p.get("unit", p.get("unit_of_measure", "NOS"))),
            status=str(p.get("status", "ACTIVE")),
            description=str(p.get("description", "")) if p.get("description") else None,
        )

        return {
            "product": prod_resp.dict(),
            "auditSummary": {
                "initialStock": stock_val,
                "calculatedCurrentStock": stock_val,
                "actualCurrentStock": stock_val,
            },
            "transactions": []
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error getting product '{product_id}': {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("", response_model=ProductMutationResponse, summary="Create a new catalog product")
def create_product(
    payload: ProductCreateRequest,
    current_user: dict = Depends(require_permission("inventory.manage"))
):
    SnapshotService.assert_writable("create product")
    try:
        schema_data = ProductCreateSchema(
            sku=payload.sku,
            name=payload.name,
            category=payload.category or payload.categoryId or payload.categoryName or "General",
            categoryId=payload.categoryId,
            categoryName=payload.categoryName or payload.category,
            brand=payload.brand or "Nalka Metals",
            unit_price=payload.unit_price if payload.unit_price is not None else payload.price,
            price=payload.price,
            cost_price=payload.cost_price,
            unitCost=payload.unitCost,
            quantity=payload.quantity,
            initialStock=payload.initialStock,
            minimumStock=payload.minimumStock or 15.0,
            criticalStock=payload.criticalStock or 5.0,
            unit=payload.unit or "NOS",
            description=payload.description
        )
        result = InventoryService.add_product(schema_data)
        prod_info = result["product"]
        
        mapped = ProductResponse(
            id=str(prod_info["id"]),
            sku=prod_info["sku"],
            name=prod_info["name"],
            category=prod_info["category"],
            price=prod_info["price"],
            unit_price=prod_info["unit_price"],
            stock=prod_info["stock"],
            current_stock=prod_info["currentStock"],
            min_stock=prod_info["minimumStock"],
            unit=prod_info["unit"],
            status="HEALTHY" if prod_info["stock"] > 0 else "OUT_OF_STOCK",
            description=prod_info.get("description"),
            currentStock=prod_info["currentStock"],
            physicalStock=prod_info["physicalStock"],
            reservedStock=0.0,
            availableStock=prod_info["availableStock"],
            minimumStock=prod_info["minimumStock"],
            criticalStock=prod_info["criticalStock"],
            unitCost=prod_info["unitCost"],
            categoryId=prod_info["categoryId"],
            categoryName=prod_info["categoryName"],
            isActive=True
        )
        return ProductMutationResponse(success=True, product=mapped)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        logger.error(f"Error creating product: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.put("/{product_id}", response_model=ProductMutationResponse, summary="Update product details")
def update_product(
    product_id: str,
    payload: ProductUpdateRequest,
    current_user: dict = Depends(require_permission("inventory.manage"))
):
    SnapshotService.assert_writable("update product")
    try:
        client = get_supabase_client()
        from repositories.inventory_repo import InventoryRepository
        
        inv = InventoryService.list_inventory()
        existing = next((p for p in inv if str(p.get("id")) == str(product_id) or str(p.get("sku")).lower() == str(product_id).lower()), None)
        if not existing:
            raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found.")
        
        real_id = str(existing.get("id"))
        
        updates = {}
        if payload.name:
            updates["name"] = payload.name.strip()
        if payload.unit:
            updates["unit_of_measure"] = payload.unit.strip()
        if payload.unit_price is not None or payload.price is not None:
            updates["default_sale_price"] = round(float(payload.unit_price if payload.unit_price is not None else payload.price), 2)
        if payload.cost_price is not None or payload.unitCost is not None:
            updates["cost_price"] = round(float(payload.cost_price if payload.cost_price is not None else payload.unitCost), 2)
        if payload.is_active is not None:
            updates["is_active"] = payload.is_active
        elif payload.isActive is not None:
            updates["is_active"] = payload.isActive
            
        if client and updates:
            updates["updated_at"] = datetime.utcnow().isoformat()
            client.table("products").update(updates).eq("id", real_id).execute()
            
        InventoryRepository.invalidate_cache()
        
        inv_after = InventoryService.list_inventory()
        updated = next((p for p in inv_after if str(p.get("id")) == real_id), existing)
        
        stock_val = float(updated.get("currentStock", updated.get("physical_stock", 0.0)))
        res_val = float(updated.get("reservedStock", updated.get("reserved_stock", 0.0)))
        avail_val = float(updated.get("availableStock", updated.get("available_stock", stock_val - res_val)))
        cost_val = float(updated.get("unitCost", updated.get("cost_price", 0.0)))
        price_val = float(updated.get("price", updated.get("default_sale_price", cost_val)))
        c_name = str(updated.get("categoryName") or updated.get("Category") or "General")

        prod_resp = ProductResponse(
            id=real_id,
            sku=str(updated.get("sku", "")),
            name=str(updated.get("name", "")),
            category=c_name,
            price=price_val,
            unit_price=price_val,
            stock=stock_val,
            current_stock=stock_val,
            min_stock=float(payload.minimumStock if payload.minimumStock is not None else updated.get("minimumStock", 15.0)),
            unit=str(updated.get("unit", "NOS")),
            status=str(updated.get("status", "HEALTHY")),
            description=payload.description or updated.get("description"),
            currentStock=stock_val,
            physicalStock=stock_val,
            reservedStock=res_val,
            availableStock=avail_val,
            minimumStock=float(payload.minimumStock if payload.minimumStock is not None else updated.get("minimumStock", 15.0)),
            criticalStock=float(payload.criticalStock if payload.criticalStock is not None else updated.get("criticalStock", 5.0)),
            unitCost=cost_val,
            categoryId=payload.categoryId or c_name,
            categoryName=c_name,
            isActive=bool(updated.get("is_active", True))
        )
        return ProductMutationResponse(success=True, product=prod_resp)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error updating product '{product_id}': {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.patch("/{product_id}/toggle-status", response_model=ProductMutationResponse, summary="Toggle product active status")
def toggle_product_status(
    product_id: str,
    current_user: dict = Depends(require_permission("inventory.manage"))
):
    SnapshotService.assert_writable("toggle product status")
    try:
        client = get_supabase_client()
        from repositories.inventory_repo import InventoryRepository
        
        inv = InventoryService.list_inventory()
        existing = next((p for p in inv if str(p.get("id")) == str(product_id) or str(p.get("sku")).lower() == str(product_id).lower()), None)
        if not existing:
            raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found.")
        
        real_id = str(existing.get("id"))
        new_status = not bool(existing.get("is_active", True))
        
        if client:
            client.table("products").update({
                "is_active": new_status,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", real_id).execute()
            
        InventoryRepository.invalidate_cache()
        
        inv_after = InventoryService.list_inventory()
        updated = next((p for p in inv_after if str(p.get("id")) == real_id), existing)
        
        stock_val = float(updated.get("currentStock", updated.get("physical_stock", 0.0)))
        cost_val = float(updated.get("unitCost", updated.get("cost_price", 0.0)))
        price_val = float(updated.get("price", updated.get("default_sale_price", cost_val)))
        c_name = str(updated.get("categoryName") or updated.get("Category") or "General")

        prod_resp = ProductResponse(
            id=real_id,
            sku=str(updated.get("sku", "")),
            name=str(updated.get("name", "")),
            category=c_name,
            price=price_val,
            unit_price=price_val,
            stock=stock_val,
            current_stock=stock_val,
            unit=str(updated.get("unit", "NOS")),
            status="ACTIVE" if new_status else "INACTIVE",
            currentStock=stock_val,
            physicalStock=stock_val,
            reservedStock=float(updated.get("reservedStock", 0.0)),
            availableStock=float(updated.get("availableStock", stock_val)),
            minimumStock=float(updated.get("minimumStock", 15.0)),
            criticalStock=float(updated.get("criticalStock", 5.0)),
            unitCost=cost_val,
            categoryId=c_name,
            categoryName=c_name,
            isActive=new_status
        )
        return ProductMutationResponse(success=True, product=prod_resp)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error toggling status for product '{product_id}': {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
