# backend/schemas/order_schemas.py
from pydantic import BaseModel, Field
from typing import Optional, List, Any

class OrderItemSchema(BaseModel):
    id: Optional[Any] = Field(None, description="Line item ID")
    order_id: str = Field(..., description="Parent order ID")
    sku: Optional[str] = Field(None, description="Product SKU")
    item_name: str = Field(..., description="Historical product name at sale time")
    category: Optional[str] = Field("General", description="Product category")
    quantity: float = Field(..., description="Quantity ordered")
    price: float = Field(0.0, description="Historical unit sale price")
    total_price: float = Field(0.0, description="Historical line total price (quantity * price)")
    created_at: Optional[str] = Field(None, description="Line item creation timestamp")

class OrderSummarySchema(BaseModel):
    order_id: str = Field(..., description="Order identifier")
    salesman_id: Optional[str] = Field(None, description="Sales representative ID")
    salesman_name: str = Field("Sales Representative", description="Sales representative name")
    shop_name: str = Field("Customer Store", description="Customer / Dealer shop name")
    location_id: Optional[str] = Field(None, description="Location / Warehouse ID")
    city: Optional[str] = Field(None, description="Customer city")
    state: Optional[str] = Field(None, description="Customer state")
    item_count: int = Field(0, description="Number of distinct line items")
    total_amount: float = Field(0.0, description="Historical grand total amount")
    status: str = Field("Pending", description="Current lifecycle status")
    notes: Optional[str] = Field(None, description="Order notes")
    created_by: Optional[str] = Field(None, description="User ID of creator")
    created_at: str = Field(..., description="Creation timestamp")
    updated_at: Optional[str] = Field(None, description="Last update timestamp")

class OrderDetailSchema(OrderSummarySchema):
    items: List[OrderItemSchema] = Field(default_factory=list, description="Order line items")

class OrderListResponseSchema(BaseModel):
    items: List[OrderSummarySchema] = Field(default_factory=list, description="List of order summaries")
    total: int = Field(..., description="Total count of matching orders")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Number of items per page")
    pages: int = Field(..., description="Total available pages")
