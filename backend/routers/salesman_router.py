# backend/routers/salesman_router.py
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from services.salesman_service import salesman_service
from auth import get_current_user

logger = logging.getLogger("salesman_router")
router = APIRouter(prefix="/api/sales/salesmen", tags=["Salesman Performance Analytics"])

security_scheme = HTTPBearer(auto_error=False)

def optional_auth(credentials: Optional[HTTPAuthorizationCredentials] = Security(security_scheme)) -> dict:
    if not credentials or not credentials.credentials:
        return {"user_id": "anon", "role": "viewer"}
    try:
        return get_current_user(credentials)
    except Exception:
        return {"user_id": "anon", "role": "viewer"}

@router.get("/summary")
def get_team_summary(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: dict = Depends(optional_auth)
):
    try:
        return salesman_service.get_team_summary(start_date=start_date, end_date=end_date)
    except Exception as exc:
        logger.error(f"Error fetching team summary: {exc}")
        raise HTTPException(status_code=500, detail="Failed to retrieve team performance summary.")

@router.get("/performance")
def get_salesmen_performance(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    sort_by: str = Query("sales"),
    sort_order: str = Query("desc"),
    current_user: dict = Depends(optional_auth)
):
    try:
        items = salesman_service.get_salesman_performance_list(
            start_date=start_date,
            end_date=end_date,
            search=search,
            status_filter=status,
            sort_by=sort_by,
            sort_order=sort_order
        )
        return {
            "salesmen": items,
            "count": len(items),
            "start_date": start_date,
            "end_date": end_date
        }
    except Exception as exc:
        logger.error(f"Error fetching salesmen performance list: {exc}")
        raise HTTPException(status_code=500, detail="Failed to retrieve salesmen performance analytics.")

@router.get("/{salesman_id}/performance")
def get_salesman_detail_performance(
    salesman_id: str,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: dict = Depends(optional_auth)
):
    try:
        return salesman_service.get_salesman_detail(salesman_id=salesman_id, start_date=start_date, end_date=end_date)
    except Exception as exc:
        logger.error(f"Error fetching salesman performance detail for '{salesman_id}': {exc}")
        raise HTTPException(status_code=500, detail="Failed to retrieve salesman performance details.")

@router.get("/{salesman_id}/heatmap")
def get_salesman_heatmap(
    salesman_id: str,
    days: int = Query(365, ge=7, le=730),
    current_user: dict = Depends(optional_auth)
):
    try:
        return salesman_service.get_order_heatmap(salesman_id=salesman_id, days_count=days)
    except Exception as exc:
        logger.error(f"Error generating heatmap for salesman '{salesman_id}': {exc}")
        raise HTTPException(status_code=500, detail="Failed to generate order activity heatmap.")
