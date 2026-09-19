# backend/routers/customer_router.py
import math
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, status
from services.customer_service import customer_service
from auth import require_permission
from schemas.customer_schemas import CustomerResponse, CustomerListResponse

logger = logging.getLogger("customer_router")
router = APIRouter(prefix="/api/customers", tags=["Customers"])

@router.get(
    "",
    response_model=CustomerListResponse,
    summary="List customers directory",
    description="Retrieves customer and dealer directory with search and pagination support."
)
def list_customers(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=500, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name, GSTIN, city, state, or phone"),
    current_user: dict = Depends(require_permission("customers.view"))
):
    try:
        offset = (page - 1) * page_size
        customers_raw = customer_service.list_customers(offset=0, limit=1000, search=search)
        
        total_count = len(customers_raw)
        total_pages = max(1, math.ceil(total_count / page_size)) if total_count > 0 else 1
        
        paged_items = customers_raw[offset:offset + page_size]

        mapped_customers: List[CustomerResponse] = []
        for c in paged_items:
            mapped_customers.append(CustomerResponse(
                id=str(c.get("id", c.get("dealer_id", ""))),
                name=str(c.get("name", c.get("dealer_name", c.get("firm_name", "Unknown Customer")))),
                dealer_name=c.get("dealer_name") or c.get("name"),
                gstin=str(c.get("gstin", "")) if c.get("gstin") else None,
                phone=str(c.get("phone", c.get("mobile", ""))) if (c.get("phone") or c.get("mobile")) else None,
                state=str(c.get("state", "")) if c.get("state") else None,
                city=str(c.get("city", "")) if c.get("city") else None,
                credit_limit=float(c.get("credit_limit", 0.0)),
                salesman_id=str(c.get("salesman_id", "")) if c.get("salesman_id") else None,
                address=str(c.get("address", "")) if c.get("address") else None,
                status=str(c.get("status", "ACTIVE")),
            ))

        return CustomerListResponse(
            customers=mapped_customers,
            total_count=total_count,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
    except Exception as exc:
        logger.error(f"Error listing customers: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch customer directory.")

@router.get("/{customer_id}", response_model=CustomerResponse, summary="Get customer details")
def get_customer(
    customer_id: str,
    current_user: dict = Depends(require_permission("customers.view"))
):
    try:
        customers_raw = customer_service.list_customers(offset=0, limit=1000)
        c = next((item for item in customers_raw if str(item.get("id")) == str(customer_id) or str(item.get("dealer_id")) == str(customer_id)), None)
        if not c:
            raise HTTPException(status_code=404, detail=f"Customer '{customer_id}' not found.")
            
        return CustomerResponse(
            id=str(c.get("id", c.get("dealer_id", ""))),
            name=str(c.get("name", c.get("dealer_name", c.get("firm_name", "Unknown Customer")))),
            dealer_name=c.get("dealer_name") or c.get("name"),
            gstin=str(c.get("gstin", "")) if c.get("gstin") else None,
            phone=str(c.get("phone", c.get("mobile", ""))) if (c.get("phone") or c.get("mobile")) else None,
            state=str(c.get("state", "")) if c.get("state") else None,
            city=str(c.get("city", "")) if c.get("city") else None,
            credit_limit=float(c.get("credit_limit", 0.0)),
            salesman_id=str(c.get("salesman_id", "")) if c.get("salesman_id") else None,
            address=str(c.get("address", "")) if c.get("address") else None,
            status=str(c.get("status", "ACTIVE")),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error getting customer '{customer_id}': {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
