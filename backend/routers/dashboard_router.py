# backend/routers/dashboard_router.py
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from services.analytics_service import analytics_service

logger = logging.getLogger("dashboard_router")
router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

@router.get("/stats")
def get_dashboard_stats(
    days: Optional[int] = Query(7, description="Number of trend days"),
    startDate: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    endDate: Optional[str] = Query(None, description="End date YYYY-MM-DD")
):
    try:
        return analytics_service.get_dashboard_stats(days=days, start_date=startDate, end_date=endDate)
    except Exception as exc:
        logger.error(f"Error fetching dashboard stats: {exc}")
        raise HTTPException(status_code=500, detail="Failed to load dashboard statistics.")

