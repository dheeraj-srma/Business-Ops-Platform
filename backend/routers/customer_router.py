# backend/routers/customer_router.py
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from services.customer_service import customer_service
from auth import require_role

logger = logging.getLogger("customer_router")
router = APIRouter(prefix="/api/customers", tags=["Customers"])

@router.get("")
def list_customers(
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None)
):
    try:
        customers = customer_service.list_customers(offset=offset, limit=limit, search=search)
        return {"customers": customers, "count": len(customers)}
    except Exception as exc:
        logger.error(f"Error listing customers: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch customer directory.")
