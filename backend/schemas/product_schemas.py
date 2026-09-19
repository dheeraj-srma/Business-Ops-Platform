# backend/schemas/product_schemas.py
from pydantic import BaseModel, Field
from typing import Optional, List

class ProductResponse(BaseModel):
    id: str = Field(..., description="Unique product ID")
    sku: str = Field(..., description="Product SKU code")
    name: str = Field(..., description="Product display name")
    category: Optional[str] = Field(None, description="Product category")
    price: float = Field(0.0, description="Unit sale price")
    unit_price: float = Field(0.0, description="Alias unit sale price")
    stock: float = Field(0.0, description="Current available physical stock")
    current_stock: float = Field(0.0, description="Alias current stock")
    min_stock: Optional[float] = Field(0.0, description="Minimum stock threshold for reorder")
    hsn_code: Optional[str] = Field(None, description="HSN/SAC tax code")
    unit: Optional[str] = Field("NOS", description="Unit of measurement")
    status: Optional[str] = Field("ACTIVE", description="Product status (ACTIVE, INACTIVE, ARCHIVED)")
    description: Optional[str] = Field(None, description="Product description")

    model_config = {"from_attributes": True}

class ProductListResponse(BaseModel):
    products: List[ProductResponse] = Field(..., description="List of catalog products")
    total_count: int = Field(..., description="Total matching product count")
    page: int = Field(1, description="Current page number (1-indexed)")
    page_size: int = Field(50, description="Page size limit")
    total_pages: int = Field(1, description="Total available pages")
