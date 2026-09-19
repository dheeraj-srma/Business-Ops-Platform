# backend/routers/supplier_router.py
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from services.customer_service import customer_service

logger = logging.getLogger("supplier_router")
router = APIRouter(prefix="/api/suppliers", tags=["Suppliers"])

@router.get("")
def list_suppliers(
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None)
):
    try:
        suppliers = customer_service.list_suppliers(offset=offset, limit=limit, search=search)
        return {"suppliers": suppliers, "count": len(suppliers)}
    except Exception as exc:
        logger.error(f"Error listing suppliers: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch supplier directory.")
