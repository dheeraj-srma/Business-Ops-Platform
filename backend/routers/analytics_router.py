# backend/routers/analytics_router.py
import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query
from services.analytics_service import analytics_service

logger = logging.getLogger("analytics_router")
router = APIRouter(prefix="/api/analytics", tags=["Analytics & BI"])

@router.get("/summary")
def executive_summary():
    try:
        return analytics_service.get_executive_summary()
    except Exception as exc:
        logger.error(f"Error generating executive summary: {exc}")
        raise HTTPException(status_code=500, detail="Failed to calculate executive analytics summary.")

@router.get("/bi")
def bi_analytics():
    try:
        return analytics_service.get_bi_analytics()
    except Exception as exc:
        logger.error(f"Error generating BI analytics: {exc}")
        raise HTTPException(status_code=500, detail="Failed to calculate BI analytics KPIs.")

@router.get("/products")
def product_analytics(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: Optional[str] = Query(None)
):
    try:
        return analytics_service.get_paginated_product_analytics(page=page, page_size=page_size, search=search)
    except Exception as exc:
        logger.error(f"Error generating paginated product analytics: {exc}")
        raise HTTPException(status_code=500, detail="Failed to retrieve product analytics data.")
