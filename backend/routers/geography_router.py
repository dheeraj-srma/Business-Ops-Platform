# backend/routers/geography_router.py
from typing import Optional
from fastapi import APIRouter, Query, HTTPException, status
from repositories.geography_repo import GeographyRepository

router = APIRouter(prefix="/api/geography", tags=["Geographic Intelligence"])

@router.get("/india", summary="Get India National Level Summary")
@router.get("/summary", summary="Get Geographic Intelligence Overview")
def get_india_summary(range: str = Query("30d", description="Time range (30d, 90d, ytd, all)")):
    try:
        return GeographyRepository.get_india_summary(time_range=range)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch India summary: {str(exc)}"
        )

@router.get("/states/{state_name}", summary="Get State Level Summary")
def get_state_summary(
    state_name: str,
    range: str = Query("30d", description="Time range (30d, 90d, ytd, all)")
):
    try:
        return GeographyRepository.get_state_summary(state_name=state_name, time_range=range)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch state summary for {state_name}: {str(exc)}"
        )

@router.get("/cities/{city_name}", summary="Get City Level Summary & Customer Breakdown")
def get_city_summary(
    city_name: str,
    state_name: Optional[str] = Query(None, description="Optional parent state name"),
    range: str = Query("30d", description="Time range (30d, 90d, ytd, all)")
):
    try:
        return GeographyRepository.get_city_summary(city_name=city_name, state_name=state_name, time_range=range)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch city summary for {city_name}: {str(exc)}"
        )

@router.get("/customers/{customer_id}", summary="Get Customer Performance Summary & Top Products")
def get_customer_summary(
    customer_id: str,
    range: str = Query("30d", description="Time range (30d, 90d, ytd, all)")
):
    try:
        return GeographyRepository.get_customer_summary(customer_id=customer_id, time_range=range)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch customer summary for {customer_id}: {str(exc)}"
        )
