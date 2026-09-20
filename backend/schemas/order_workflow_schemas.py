# backend/schemas/order_workflow_schemas.py
from pydantic import BaseModel, Field
from typing import Optional, List

class OrderEditItemSchema(BaseModel):
    sku: str = Field(..., min_length=1, description="Product SKU identifier")
    item_name: Optional[str] = Field(None, description="Item description")
    category: Optional[str] = Field("General", description="Product category")
    quantity: float = Field(..., gt=0.0, description="New requested item quantity")
    price: Optional[float] = Field(0.0, ge=0.0, description="Unit price")

class OrderEditRequest(BaseModel):
    items: List[OrderEditItemSchema] = Field(..., min_items=1, description="Updated order line items")
    notes: Optional[str] = Field(None, description="Optional updated order notes")

class OrderEditResponse(BaseModel):
    status: str = Field("updated", description="Mutation result status")
    order_id: str = Field(..., description="Target order ID")
    items_count: int = Field(..., description="Updated item count")
    total_amount: float = Field(..., description="Updated total grand amount")
    reservation_delta: float = Field(0.0, description="Net reservation balance change")
    timestamp: str = Field(..., description="Timestamp of edit mutation")

class OrderCancelRequest(BaseModel):
    reason: Optional[str] = Field(None, description="Reason for cancellation")

class OrderCancelResponse(BaseModel):
    status: str = Field("cancelled", description="Result status")
    order_id: str = Field(..., description="Cancelled order ID")
    released_reservation: float = Field(0.0, description="Released reservation quantity")
    timestamp: str = Field(..., description="Timestamp of cancellation")

class OrderRejectRequest(BaseModel):
    reason: Optional[str] = Field(None, description="Reason for rejection")

class OrderRejectResponse(BaseModel):
    status: str = Field("rejected", description="Result status")
    order_id: str = Field(..., description="Rejected order ID")
    released_reservation: float = Field(0.0, description="Released reservation quantity")
    timestamp: str = Field(..., description="Timestamp of rejection")

class OrderReopenRequest(BaseModel):
    reason: Optional[str] = Field(None, description="Reason for reopening/rollback")

class OrderReopenResponse(BaseModel):
    status: str = Field("reopened", description="Result status")
    order_id: str = Field(..., description="Reopened order ID")
    recreated_reservation: float = Field(0.0, description="Recreated reservation quantity")
    timestamp: str = Field(..., description="Timestamp of reopening")
