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

    # CamelCase compatibility fields for Operations and Management frontends
    currentStock: Optional[float] = Field(0.0, description="Physical stock alias")
    physicalStock: Optional[float] = Field(0.0, description="Physical stock alias")
    reservedStock: Optional[float] = Field(0.0, description="Reserved stock alias")
    availableStock: Optional[float] = Field(0.0, description="Available stock alias")
    minimumStock: Optional[float] = Field(15.0, description="Minimum safe stock threshold")
    criticalStock: Optional[float] = Field(5.0, description="Critical stock threshold")
    unitCost: Optional[float] = Field(0.0, description="Unit cost alias")
    categoryId: Optional[str] = Field(None, description="Category identifier alias")
    categoryName: Optional[str] = Field(None, description="Category name alias")
    isActive: Optional[bool] = Field(True, description="Active status alias")

    model_config = {"from_attributes": True}

class ProductListResponse(BaseModel):
    products: List[ProductResponse] = Field(..., description="List of catalog products")
    items: Optional[List[ProductResponse]] = Field(None, description="Compatibility alias for items")
    total_count: int = Field(..., description="Total matching product count")
    page: int = Field(1, description="Current page number (1-indexed)")
    page_size: int = Field(50, description="Page size limit")
    total_pages: int = Field(1, description="Total available pages")

class ProductCreateRequest(BaseModel):
    sku: str = Field(..., min_length=2, description="Product SKU code")
    name: str = Field(..., min_length=1, description="Product display name")
    categoryId: Optional[str] = Field(None, description="Category identifier")
    category: Optional[str] = Field(None, description="Category name alias")
    categoryName: Optional[str] = Field(None, description="Category name alias")
    description: Optional[str] = Field(None, description="Product description")
    unit: Optional[str] = Field("NOS", description="Unit of measurement")
    initialStock: Optional[float] = Field(0.0, description="Initial stock quantity")
    quantity: Optional[float] = Field(None, description="Quantity alias")
    minimumStock: Optional[float] = Field(15.0, description="Minimum safe stock threshold")
    criticalStock: Optional[float] = Field(5.0, description="Critical stock threshold")
    unitCost: Optional[float] = Field(0.0, description="Unit cost alias")
    cost_price: Optional[float] = Field(None, description="Cost price alias")
    unit_price: Optional[float] = Field(None, description="Unit sale price")
    price: Optional[float] = Field(None, description="Unit sale price alias")
    brand: Optional[str] = Field("Nalka Metals", description="Brand name")
    hsn_code: Optional[str] = Field(None, description="HSN tax code")

class ProductUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, description="Updated product name")
    categoryId: Optional[str] = Field(None, description="Updated category ID")
    category: Optional[str] = Field(None, description="Updated category name alias")
    description: Optional[str] = Field(None, description="Updated description")
    unit: Optional[str] = Field(None, description="Updated unit")
    minimumStock: Optional[float] = Field(None, description="Updated minimum stock")
    criticalStock: Optional[float] = Field(None, description="Updated critical stock")
    unitCost: Optional[float] = Field(None, description="Updated unit cost")
    cost_price: Optional[float] = Field(None, description="Updated cost price")
    unit_price: Optional[float] = Field(None, description="Updated unit sale price")
    price: Optional[float] = Field(None, description="Updated unit sale price")
    is_active: Optional[bool] = Field(None, description="Active status")
    isActive: Optional[bool] = Field(None, description="Active status alias")

class ProductMutationResponse(BaseModel):
    success: bool = Field(True, description="Operation success flag")
    product: ProductResponse = Field(..., description="Product details")
