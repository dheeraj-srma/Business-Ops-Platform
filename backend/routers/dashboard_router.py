# backend/routers/dashboard_router.py
import logging
from fastapi import APIRouter, HTTPException
from services.analytics_service import analytics_service

logger = logging.getLogger("dashboard_router")
router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

@router.get("/stats")
def get_dashboard_stats():
    try:
        bi_stats = analytics_service.get_bi_analytics()
        exec_summary = analytics_service.get_executive_summary()
        return {
            "core_kpis": bi_stats.get("core_kpis", {}),
            "executive_summary": exec_summary,
            "inventory_intelligence": bi_stats.get("inventory_intelligence", {})
        }
    except Exception as exc:
        logger.error(f"Error fetching dashboard stats: {exc}")
        raise HTTPException(status_code=500, detail="Failed to load dashboard statistics.")
