# backend/schemas/inventory_schemas.py
from pydantic import BaseModel, Field
from typing import Optional, List

class InventoryItemResponse(BaseModel):
    id: str = Field(..., description="Product identifier")
    sku: str = Field(..., description="Stock keeping unit code")
    name: str = Field(..., description="Product display name")
    category: Optional[str] = Field("General", description="Product category or brand")
    brand: Optional[str] = Field("Nalka Metals", description="Brand name")
    cost_price: float = Field(0.0, description="Unit cost price")
    sale_price: float = Field(0.0, description="Unit sale price")
    physical_stock: float = Field(0.0, description="Physical stock on hand (quantity_on_hand)")
    reserved_stock: float = Field(0.0, description="Reserved stock quantity (quantity_reserved)")
    available_stock: float = Field(0.0, description="Available stock for orders (quantity_available)")
    unit: Optional[str] = Field("NOS", description="Unit of measure")
    status: str = Field("HEALTHY", description="Stock health status (HEALTHY, LOW, CRITICAL, OUT_OF_STOCK, NEGATIVE)")
    is_active: bool = Field(True, description="Active status flag")
    updated_at: Optional[str] = Field(None, description="Last updated timestamp")

    model_config = {"from_attributes": True}

class InventoryListResponse(BaseModel):
    items: List[InventoryItemResponse] = Field(..., description="Inventory item records")
    total_count: int = Field(..., description="Total matching inventory items")
    page: int = Field(1, description="Current page number (1-indexed)")
    page_size: int = Field(50, description="Page size limit")
    total_pages: int = Field(1, description="Total available pages")
