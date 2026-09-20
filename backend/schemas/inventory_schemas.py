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

class InventoryListResponse(BaseModel):
    items: List[InventoryItemResponse] = Field(..., description="Inventory item records")
    products: Optional[List[InventoryItemResponse]] = Field(None, description="Compatibility alias for products")
    total_count: int = Field(..., description="Total matching inventory items")
    page: int = Field(1, description="Current page number (1-indexed)")
    page_size: int = Field(50, description="Page size limit")
    total_pages: int = Field(1, description="Total available pages")

class StockAdjustmentRequest(BaseModel):
    product_id: str = Field(..., description="Product ID to adjust")
    new_quantity: float = Field(..., ge=0.0, description="New physical stock quantity")
    reason: str = Field(..., min_length=2, description="Audit reason for manual stock adjustment")
    location_id: Optional[str] = Field(None, description="Warehouse/Location ID")
    idempotency_key: Optional[str] = Field(None, description="Unique request idempotency key")

class StockInRequest(BaseModel):
    product_id: str = Field(..., description="Product ID for stock inward")
    quantity: float = Field(..., gt=0.0, description="Inward stock quantity to add")
    unit_cost: Optional[float] = Field(0.0, ge=0.0, description="Unit cost price")
    supplier_name: Optional[str] = Field("Direct Supplier", description="Supplier or vendor name")
    reference_number: Optional[str] = Field("REC-IN", description="Purchase order or delivery note reference")
    notes: Optional[str] = Field(None, description="Additional movement notes")
    idempotency_key: Optional[str] = Field(None, description="Unique request idempotency key")

class StockMutationResponse(BaseModel):
    status: str = Field("success", description="Mutation result status")
    product_id: str = Field(..., description="Target product ID")
    previous_quantity: float = Field(..., description="Previous physical quantity")
    new_quantity: float = Field(..., description="Updated physical quantity")
    available_quantity: float = Field(..., description="Updated available quantity")
    transaction_id: Optional[str] = Field(None, description="Generated stock transaction ID")
    message: Optional[str] = Field(None, description="Status detail message")
    timestamp: str = Field(..., description="ISO timestamp of operation")

class StockOutItemSchema(BaseModel):
    product_id: Optional[str] = Field(None, description="Product ID")
    productId: Optional[str] = Field(None, description="CamelCase product ID alias")
    sku: Optional[str] = Field(None, description="Product SKU")
    quantity: float = Field(..., gt=0.0, description="Quantity to dispatch")

class StockOutRequest(BaseModel):
    items: Optional[List[StockOutItemSchema]] = Field(None, description="Batch line items list")
    product_id: Optional[str] = Field(None, description="Single product ID to stock out")
    quantity: Optional[float] = Field(None, gt=0.0, description="Single product quantity")
    reason: Optional[str] = Field("Order Fulfillment", description="Dispatch or stock-out reason")
    recipient: Optional[str] = Field("Direct Consignee", description="Recipient or customer name")
    reference_number: Optional[str] = Field(None, description="Order ID or delivery reference")
    notes: Optional[str] = Field(None, description="Movement notes")
    idempotency_key: Optional[str] = Field(None, description="Idempotency key")
