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

@router.get("/customers/profile")
def customer_profile_query(
    customer_id: str = Query(..., description="Customer ID or Customer Name")
):
    """Authoritative operational and commercial spotlight profile for a specific customer."""
    try:
        profile = analytics_service.get_customer_profile(customer_id_or_name=customer_id)
        if not profile:
            raise HTTPException(status_code=404, detail=f"Customer profile not found for '{customer_id}'")
        return profile
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error generating profile for '{customer_id}': {exc}")
        raise HTTPException(status_code=500, detail="Failed to retrieve customer operational profile.")

@router.get("/customers/{customer_id}/profile")
def customer_profile_path(
    customer_id: str
):
    """Authoritative operational and commercial spotlight profile for a specific customer."""
    try:
        profile = analytics_service.get_customer_profile(customer_id_or_name=customer_id)
        if not profile:
            raise HTTPException(status_code=404, detail=f"Customer profile not found for '{customer_id}'")
        return profile
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error generating profile for '{customer_id}': {exc}")
        raise HTTPException(status_code=500, detail="Failed to retrieve customer operational profile.")

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

@router.get("/explorer/entities")
def explorer_available_entities(
    entity_type: str = Query("Product", alias="type", description="Entity dimension type: Product, Category, Customer, Supplier, Salesman, Location")
):
    """Returns verified distinct entities with commercial transaction metadata for the 360 Explorer dropdown."""
    try:
        return analytics_service.get_explorer_available_entities(entity_type=entity_type)
    except Exception as exc:
        logger.error(f"Error fetching explorer entities for '{entity_type}': {exc}")
        raise HTTPException(status_code=500, detail="Failed to retrieve available explorer entities.")

@router.get("/explorer")
def explorer_entity_analytics(
    entity_type: str = Query("Product", alias="type", description="Entity dimension type: Product, Category, Customer, Supplier, Salesman, Location"),
    query: str = Query("", description="Entity search string, SKU, or name"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)")
):
    """Deep 360-degree cross-sectional analytics: summary KPIs, daily demand velocity, distribution breakdown, and ledger."""
    try:
        return analytics_service.get_explorer_entity_analytics(
            entity_type=entity_type,
            query=query,
            start_date=start_date,
            end_date=end_date
        )
    except Exception as exc:
        logger.error(f"Error generating 360 explorer analytics for '{entity_type}' ('{query}'): {exc}")
        raise HTTPException(status_code=500, detail="Failed to calculate 360 explorer analytics.")

@router.get("/forecast")
def demand_forecast(
    metric: str = Query("sales_and_purchases", description="Forecasting target metric: sales_and_purchases, demand, profit, procurement_refill"),
    horizon: int = Query(7, ge=7, le=90, description="Forecast horizon in days (7, 30, 90)"),
    demand_shift: float = Query(0.0, ge=-50.0, le=100.0, description="What-if demand volume shift percentage (-20 to +50)"),
    safety_stock_factor: float = Query(1.0, ge=0.5, le=3.0, description="What-if safety stock buffer multiplier (0.5 to 3.0)")
):
    """Statistical business planning forecast powered by Nixtla StatsForecast with 80% prediction intervals."""
    try:
        return analytics_service.get_demand_forecast(
            metric=metric,
            horizon=horizon,
            demand_shift=demand_shift,
            safety_stock_factor=safety_stock_factor
        )
    except Exception as exc:
        logger.error(f"Error generating demand forecast for {metric}: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to generate statistical forecast for {metric}.")

@router.get("/ai-insights")
def ai_insights_summary(
    demand_shift: float = Query(0.0, description="What-if demand shift percentage"),
    lead_time_shift: int = Query(0, description="What-if lead time delay in days"),
    safety_stock_factor: float = Query(1.0, description="What-if safety stock buffer factor")
):
    """Authoritative AI intelligence summary: product velocity, growth rates, observed seasonality, and risk distributions."""
    try:
        return analytics_service.get_ai_insights(
            demand_shift=demand_shift,
            lead_time_shift=lead_time_shift,
            safety_stock_factor=safety_stock_factor
        )
    except Exception as exc:
        logger.error(f"Error generating AI insights summary: {exc}")
        raise HTTPException(status_code=500, detail="Failed to generate AI insights summary.")



