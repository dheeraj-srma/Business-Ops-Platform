# backend/routers/product_router.py
import math
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, status
from services.inventory_service import InventoryService
from auth import require_permission
from schemas.product_schemas import ProductResponse, ProductListResponse

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
