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
def bi_analytics(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    salesman: Optional[str] = Query(None, description="Filter by attributed salesman"),
    customer: Optional[str] = Query(None, description="Filter by customer / dealer"),
    state: Optional[str] = Query(None, description="Filter by state"),
    city: Optional[str] = Query(None, description="Filter by city"),
    category: Optional[str] = Query(None, description="Filter by product category")
):
    try:
        return analytics_service.get_bi_analytics(
            start_date=start_date,
            end_date=end_date,
            salesman=salesman,
            customer=customer,
            state=state,
            city=city,
            category=category
        )
    except Exception as exc:
        logger.error(f"Error generating BI analytics: {exc}")
        raise HTTPException(status_code=500, detail="Failed to calculate BI analytics KPIs.")

@router.get("/salesmen")
def salesman_analytics(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    category: Optional[str] = Query(None)
):
    try:
        return analytics_service.get_salesman_analytics(
            start_date=start_date,
            end_date=end_date,
            state=state,
            city=city,
            category=category
        )
    except Exception as exc:
        logger.error(f"Error retrieving salesman analytics: {exc}")
        raise HTTPException(status_code=500, detail="Failed to retrieve salesman analytics.")

@router.get("/geography")
def geographic_analytics(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    salesman: Optional[str] = Query(None),
    category: Optional[str] = Query(None)
):
    try:
        return analytics_service.get_geographic_analytics(
            start_date=start_date,
            end_date=end_date,
            salesman=salesman,
            category=category
        )
    except Exception as exc:
        logger.error(f"Error retrieving geographic analytics: {exc}")
        raise HTTPException(status_code=500, detail="Failed to retrieve geographic analytics.")

@router.get("/categories")
def category_analytics(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    salesman: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    customer: Optional[str] = Query(None)
):
    try:
        return analytics_service.get_category_analytics(
            start_date=start_date,
            end_date=end_date,
            salesman=salesman,
            state=state,
            city=city,
            customer=customer
        )
    except Exception as exc:
        logger.error(f"Error retrieving category analytics: {exc}")
        raise HTTPException(status_code=500, detail="Failed to retrieve category analytics.")

@router.get("/data-quality")
def data_quality_report():
    """Returns the comprehensive Data Quality & Relational Mapping Audit Report (Section 51)."""
    try:
        return analytics_service.get_data_quality_report()
    except Exception as exc:
        logger.error(f"Error generating data quality report: {exc}")
        raise HTTPException(status_code=500, detail="Failed to generate data quality audit report.")

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

@router.get("/customers")
def customer_analytics(
    limit: int = Query(100, ge=1, le=500),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    salesman: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    category: Optional[str] = Query(None)
):
    """Per-customer performance aggregation from historical sales ledger."""
    try:
        return analytics_service.get_customer_analytics(
            limit=limit, start_date=start_date, end_date=end_date,
            salesman=salesman, state=state, city=city, category=category
        )
    except Exception as exc:
        logger.error(f"Error generating customer analytics: {exc}")
        raise HTTPException(status_code=500, detail="Failed to retrieve customer analytics.")

@router.get("/customers/heatmap")
def customer_heatmap(
    customer_id: Optional[str] = Query(None, description="Optional customer ID or name (or 'all')"),
    days: int = Query(365, ge=1, le=730, description="Timeline horizon in days")
):
    """Activity heatmap and purchasing velocity for a customer or all customers."""
    try:
        return analytics_service.get_customer_heatmap(customer_id=customer_id, days_count=days)
    except Exception as exc:
        logger.error(f"Error generating customer heatmap: {exc}")
        raise HTTPException(status_code=500, detail="Failed to generate customer activity heatmap.")

@router.get("/customers/{customer_id}/heatmap")
def customer_heatmap_by_id(
    customer_id: str,
    days: int = Query(365, ge=1, le=730, description="Timeline horizon in days")
):
    """Activity heatmap and purchasing velocity for a specific customer."""
    try:
        return analytics_service.get_customer_heatmap(customer_id=customer_id, days_count=days)
    except Exception as exc:
        logger.error(f"Error generating customer heatmap for '{customer_id}': {exc}")
        raise HTTPException(status_code=500, detail="Failed to generate customer activity heatmap.")

@router.get("/returns")
def return_analytics(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    """Comprehensive return analytics from historical return vouchers."""
    try:
        return analytics_service.get_return_analytics(start_date=start_date, end_date=end_date)
    except Exception as exc:
        logger.error(f"Error generating return analytics: {exc}")
        raise HTTPException(status_code=500, detail="Failed to retrieve return analytics.")

@router.get("/procurement")
def purchase_analytics(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    """Comprehensive procurement analytics from historical purchase vouchers."""
    try:
        return analytics_service.get_purchase_analytics(start_date=start_date, end_date=end_date)
    except Exception as exc:
        logger.error(f"Error generating purchase analytics: {exc}")
        raise HTTPException(status_code=500, detail="Failed to retrieve purchase analytics.")

@router.get("/order-distribution")
def order_value_distribution(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    """Order value distribution buckets from historical sales voucher amounts."""
    try:
        return analytics_service.get_order_value_distribution(start_date=start_date, end_date=end_date)
    except Exception as exc:
        logger.error(f"Error generating order distribution: {exc}")
        raise HTTPException(status_code=500, detail="Failed to retrieve order value distribution.")

@router.get("/financials")
def financial_analytics(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    """Comprehensive commercial trade financials: brand margins, working capital, cashflow, and ticket distribution."""
    try:
        return analytics_service.get_financial_analytics(start_date=start_date, end_date=end_date)
    except Exception as exc:
        logger.error(f"Error generating financial analytics: {exc}")
        raise HTTPException(status_code=500, detail="Failed to retrieve financial analytics.")

