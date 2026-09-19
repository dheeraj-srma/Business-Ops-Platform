# backend/schemas/orders.py
from pydantic import BaseModel, Field
from typing import Optional, List

class OrderCreateSchema(BaseModel):
    sku: str = Field(..., min_length=1, description="Product SKU")
    quantity: int = Field(..., gt=0, description="Quantity ordered")
    salesman_name: Optional[str] = Field(None, description="Salesman Name")
    shop_name: Optional[str] = Field(None, description="Shop / Customer Name")
    notes: Optional[str] = Field(None, description="Order Notes")

class BulkOrderItemSchema(BaseModel):
    category: Optional[str] = None
    sku: str = Field(..., min_length=1, description="Product SKU")
    item_name: Optional[str] = None
    quantity: int = Field(..., gt=0, description="Quantity ordered")
    price: Optional[float] = Field(0.0, ge=0.0, description="Unit Price")
    total_price: Optional[float] = Field(None, ge=0.0, description="Line total price")

class BulkOrderCreateSchema(BaseModel):
    client_reference: Optional[str] = Field(None, description="Unique client-side idempotency UUID")
    salesman_id: Optional[str] = None
    salesman_name: Optional[str] = None
    shop_name: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    location_id: Optional[str] = None
    items: List[BulkOrderItemSchema] = Field(..., min_items=1, description="Line items list")

class OrderStatusUpdateSchema(BaseModel):
    target_status: str = Field(..., description="Target status for lifecycle transition")
    reason: Optional[str] = Field(None, description="Reason for cancellation, rejection, or status transition")

