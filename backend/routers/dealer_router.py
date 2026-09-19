# backend/routers/dealer_router.py
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from services.customer_service import customer_service

logger = logging.getLogger("dealer_router")
router = APIRouter(prefix="/api/dealers", tags=["Dealers"])

@router.get("")
def list_dealers(
    offset: int = Query(0, ge=0),
    limit: int = Query(1000, ge=1, le=5000),
    search: Optional[str] = Query(None)
):
    try:
        dealers = customer_service.list_dealers(offset=offset, limit=limit, search=search)
        return {"dealers": dealers, "count": len(dealers)}
    except Exception as exc:
        logger.error(f"Error listing dealers: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch dealer network directory.")

