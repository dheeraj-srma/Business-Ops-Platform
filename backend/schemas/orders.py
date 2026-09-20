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

class OrderReservationItem(BaseModel):
    sku: str = Field(..., min_length=1, description="Product SKU identifier")
    item_name: Optional[str] = Field(None, description="Line item name")
    category: Optional[str] = Field("General", description="Category or Brand")
    quantity: float = Field(..., gt=0.0, description="Quantity requested for reservation")
    price: Optional[float] = Field(0.0, ge=0.0, description="Unit sale price")

class OrderReservationRequest(BaseModel):
    order_id: Optional[str] = Field(None, description="Optional custom order ID")
    client_reference: Optional[str] = Field(None, description="Unique client idempotency UUID")
    salesman_id: Optional[str] = Field(None, description="Sales representative ID")
    salesman_name: Optional[str] = Field(None, description="Sales representative name")
    shop_name: str = Field(..., min_length=1, description="Shop / Customer name")
    city: Optional[str] = Field("Faridabad", description="Operating city")
    state: Optional[str] = Field("Haryana", description="Operating state")
    location_id: Optional[str] = Field("", description="Location/Warehouse ID")
    notes: Optional[str] = Field("", description="Order remarks/notes")
    items: List[OrderReservationItem] = Field(..., min_items=1, description="Order line items list")

class OrderReservationResponse(BaseModel):
    status: str = Field("created", description="Reservation status (created, already_processed)")
    order_id: str = Field(..., description="Server authoritative order ID")
    client_reference: Optional[str] = Field(None, description="Client reference ID")
    items_count: int = Field(..., description="Total line items count")
    total_amount: float = Field(..., description="Calculated order total amount")
    idempotent: bool = Field(False, description="Idempotency flag")
    timestamp: str = Field(..., description="Timestamp of reservation")

class OrderStatusUpdateSchema(BaseModel):
    target_status: str = Field(..., description="Target status for lifecycle transition")
    reason: Optional[str] = Field(None, description="Reason for cancellation, rejection, or status transition")

class OrderProcessRequest(BaseModel):
    notes: Optional[str] = Field(None, description="Optional fulfillment or dispatch notes")
    location_id: Optional[str] = Field(None, description="Warehouse or location ID override")

class OrderProcessResponse(BaseModel):
    status: str = Field(..., description="Result status (processed, already_processed)")
    order_id: str = Field(..., description="Processed order ID")
    previous_status: str = Field(..., description="Previous order status")
    new_status: str = Field(..., description="New order status (e.g. Dispatched)")
    items_processed: int = Field(..., description="Number of items fulfilled and stocked out")
    stock_transactions: List[str] = Field(default_factory=list, description="List of generated stock_transaction IDs")
    idempotent: bool = Field(False, description="Idempotency flag")
    timestamp: str = Field(..., description="Timestamp of fulfillment processing")
