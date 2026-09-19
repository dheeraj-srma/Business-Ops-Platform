# backend/schemas/returns.py
from pydantic import BaseModel, Field
from typing import Optional

class ReturnCreateSchema(BaseModel):
    customer_name: str = Field(..., min_length=1)
    location: str = Field(...)
    item_name: str = Field(...)
    category: str = Field(...)
    price: float = Field(..., ge=0.0)
    quantity: int = Field(..., gt=0)
    condition: str = Field(...)  # "Good" or "Bad"
    reason: str = Field(...)
    sku: Optional[str] = None
