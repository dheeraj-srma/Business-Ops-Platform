# backend/schemas/inventory.py
from pydantic import BaseModel, Field
from typing import Optional

class ProductCreateSchema(BaseModel):
    sku: str = Field(..., min_length=2, description="Unique product SKU identifier")
    name: str = Field(..., min_length=1, description="Product display name")
    category: Optional[str] = Field(None, description="Category name")
    categoryId: Optional[str] = Field(None, description="Category ID alias")
    categoryName: Optional[str] = Field(None, description="Category name alias")
    brand: Optional[str] = Field("Nalka Metals", description="Brand name")
    unit_price: Optional[float] = Field(None, ge=0.0, description="Default sale unit price")
    price: Optional[float] = Field(None, ge=0.0, description="Default sale unit price alias")
    cost_price: Optional[float] = Field(None, ge=0.0, description="Cost price")
    unitCost: Optional[float] = Field(None, ge=0.0, description="Unit cost alias")
    quantity: Optional[float] = Field(0.0, ge=0.0, description="Initial stock quantity")
    initialStock: Optional[float] = Field(None, ge=0.0, description="Initial stock quantity alias")
    minimumStock: Optional[float] = Field(15.0, description="Minimum safe stock threshold")
    criticalStock: Optional[float] = Field(5.0, description="Critical stock threshold")
    unit: Optional[str] = Field("NOS", description="Unit of measure")
    description: Optional[str] = Field(None, description="Product description")
    tally_guid: Optional[str] = Field(None, description="Tally ERP Master GUID")
    tally_item_name: Optional[str] = Field(None, description="Tally ERP Master Item Name")


class StockAdjustmentSchema(BaseModel):
    sku: str = Field(..., description="Product SKU")
    quantity_delta: float = Field(..., description="Quantity delta (positive for add, negative for remove)")
    reason: str = Field(..., description="Reason for adjustment")
    location_id: Optional[str] = Field(None, description="Location ID")
