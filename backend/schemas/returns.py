# backend/schemas/returns.py
from pydantic import BaseModel, Field
from typing import Optional

class ReturnCreateSchema(BaseModel):
    customer_name: str = Field(..., min_length=1)
    location: str = Field(default="Main Depot")
    item_name: str = Field(...)
    category: str = Field(default="General")
    price: float = Field(..., ge=0.0)
    quantity: int = Field(..., gt=0)
    condition: str = Field(...)  # "Good", "Good Return", "Bad", "Defective", "Defective Return"
    reason: str = Field(...)
    sku: Optional[str] = None
    order_id: Optional[str] = None
    client_reference: Optional[str] = None

class ReturnResponseSchema(BaseModel):
    status: str
    return_id: str
    client_reference: Optional[str] = None
    restocked: bool
    previous_quantity: Optional[float] = None
    new_quantity: Optional[float] = None
    available_quantity: Optional[float] = None
    idempotent: bool = False
    timestamp: str
