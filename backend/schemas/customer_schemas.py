# backend/schemas/customer_schemas.py
from pydantic import BaseModel, Field
from typing import Optional, List

class CustomerResponse(BaseModel):
    id: str = Field(..., description="Unique customer/dealer identifier")
    name: str = Field(..., description="Customer business name")
    dealer_name: Optional[str] = Field(None, description="Alias dealer name")
    gstin: Optional[str] = Field(None, description="GST Tax Identification Number")
    phone: Optional[str] = Field(None, description="Contact phone number")
    state: Optional[str] = Field(None, description="Operating state")
    city: Optional[str] = Field(None, description="Operating city")
    credit_limit: Optional[float] = Field(0.0, description="Approved credit limit amount")
    salesman_id: Optional[str] = Field(None, description="Assigned sales representative ID")
    address: Optional[str] = Field(None, description="Billing/Shipping address")
    status: Optional[str] = Field("ACTIVE", description="Customer account status")

    model_config = {"from_attributes": True}

class CustomerListResponse(BaseModel):
    customers: List[CustomerResponse] = Field(..., description="List of customers/dealers")
    total_count: int = Field(..., description="Total matching customer count")
    page: int = Field(1, description="Current page number (1-indexed)")
    page_size: int = Field(50, description="Page size limit")
    total_pages: int = Field(1, description="Total available pages")
