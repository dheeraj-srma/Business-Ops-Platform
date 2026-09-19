# backend/routers/product_router.py
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, status
from services.inventory_service import InventoryService
from auth import require_role

logger = logging.getLogger("product_router")
router = APIRouter(prefix="/api/products", tags=["Products Catalog"])

@router.get("")
def list_products(
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status")
):
    try:
        inv = InventoryService.list_inventory()
        if search:
            search_clean = search.strip().lower()
            inv = [p for p in inv if search_clean in str(p.get("sku", "")).lower() or search_clean in str(p.get("name", "")).lower()]
        if status_filter:
            inv = [p for p in inv if str(p.get("status", "")).upper() == status_filter.upper()]
        return {"products": inv}
    except Exception as exc:
        logger.error(f"Error fetching products catalog: {exc}")
        raise HTTPException(status_code=500, detail="Failed to retrieve products catalog.")

@router.get("/{product_id}")
def get_product(product_id: str):
    try:
        inv = InventoryService.list_inventory()
        p = next((item for item in inv if str(item.get("id")) == str(product_id) or str(item.get("sku")).lower() == str(product_id).lower()), None)
        if not p:
            raise HTTPException(status_code=404, detail=f"Product '{product_id}' not found.")
        return {
            "product": p,
            "auditSummary": {
                "initialStock": p.get("Current Stock", 0),
                "calculatedCurrentStock": p.get("Current Stock", 0),
                "actualCurrentStock": p.get("Current Stock", 0),
            },
            "transactions": []
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error getting product '{product_id}': {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
