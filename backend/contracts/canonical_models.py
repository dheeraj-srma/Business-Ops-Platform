# backend/contracts/canonical_models.py
"""
Canonical Exchange Models & Explicit Financial Field Semantics.
Defines normalized, system-agnostic business data representations for external accounting interchange.
Independent of PostgreSQL/Supabase, SQLite, Tally XML, or frontend representations.
"""

from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from decimal import Decimal
from enum import Enum


class ExchangeDirection(str, Enum):
    IMPORT = "IMPORT"
    EXPORT = "EXPORT"


class ExchangeEntityType(str, Enum):
    HISTORICAL_SALES = "historical_sales"
    INVENTORY_CATALOG = "inventory_catalog"
    PURCHASES = "purchases"
    RETURNS = "returns"
    ACCOUNTING_MASTERS = "accounting_masters"


class ExchangeState(str, Enum):
    CREATED = "CREATED"
    UPLOADED = "UPLOADED"
    PARSING = "PARSING"
    VALIDATING = "VALIDATING"
    VALID = "VALID"
    INVALID = "INVALID"
    REQUIRES_REVIEW = "REQUIRES_REVIEW"
    AMBIGUOUS_MAPPING = "AMBIGUOUS_MAPPING"
    CONFLICT = "CONFLICT"
    READY_TO_COMMIT = "READY_TO_COMMIT"
    APPROVED = "APPROVED"
    COMMITTING = "COMMITTING"
    COMMITTED = "COMMITTED"
    FAILED = "FAILED"
    ROLLED_BACK = "ROLLED_BACK"
    DUPLICATE = "DUPLICATE"
    REQUIRES_RECONCILIATION = "REQUIRES_RECONCILIATION"


class MappingStatus(str, Enum):
    APPROVED = "APPROVED"
    PENDING_REVIEW = "PENDING_REVIEW"
    REJECTED = "REJECTED"
    AUTO_CANDIDATE = "AUTO_CANDIDATE"


# ─── EXPLICIT FINANCIAL FIELD SEMANTICS DEFINITION ───────────────────────────

@dataclass
class FieldSemantic:
    name: str
    semantic_meaning: str  # e.g., "line_net_amount", "taxable_subtotal", "gst_rate"
    type: str  # "string", "number", "integer", "boolean", "date", "array", "object"
    currency: Optional[str] = None  # "INR" for monetary
    tax_inclusive: Optional[bool] = None  # True if price includes GST, False if net
    precision: Optional[int] = None  # e.g. 2 for currency, 3 for weight
    unit: Optional[str] = None  # "PCS", "NOS", "KG", "MTR", "PERCENT"
    required: bool = False
    nullable: bool = False
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    format: Optional[str] = None  # e.g. "YYYY-MM-DD", "ISO-8601"
    allowed_values: Optional[List[str]] = None
    description: str = ""
    example: Any = None

    def to_dict(self) -> Dict[str, Any]:
        d = {
            "name": self.name,
            "semantic_meaning": self.semantic_meaning,
            "type": self.type,
            "required": self.required,
            "nullable": self.nullable,
            "description": self.description,
            "example": self.example
        }
        if self.currency:
            d["currency"] = self.currency
        if self.tax_inclusive is not None:
            d["tax_inclusive"] = self.tax_inclusive
        if self.precision is not None:
            d["precision"] = self.precision
        if self.unit:
            d["unit"] = self.unit
        if self.min_value is not None:
            d["min"] = self.min_value
        if self.max_value is not None:
            d["max"] = self.max_value
        if self.format:
            d["format"] = self.format
        if self.allowed_values:
            d["allowed_values"] = self.allowed_values
        return d


# ─── CANONICAL RECORD DATACLASSES ─────────────────────────────────────────────

@dataclass
class CanonicalSaleItem:
    item_name: str
    product_code: Optional[str] = None
    quantity: float = 0.0
    unit: str = "PCS"
    unit_rate: float = 0.0
    discount_amount: float = 0.0
    taxable_amount: float = 0.0
    gst_rate: float = 18.0
    gst_amount: float = 0.0
    line_amount: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "item_name": self.item_name,
            "product_code": self.product_code,
            "quantity": float(self.quantity),
            "unit": self.unit,
            "rate": float(self.unit_rate),
            "discount_amount": float(self.discount_amount),
            "taxable_amount": float(self.taxable_amount),
            "gst_rate": float(self.gst_rate),
            "gst_amount": float(self.gst_amount),
            "amount": float(self.line_amount)
        }


@dataclass
class CanonicalSaleVoucher:
    external_voucher_number: str
    voucher_date: str
    customer_name: str
    customer_code: Optional[str] = None
    customer_gstin: Optional[str] = None
    salesman_name: Optional[str] = "Unassigned / Unresolved"
    salesman_code: Optional[str] = None
    city: Optional[str] = "Unknown"
    state: Optional[str] = "Unknown"
    taxable_subtotal: float = 0.0
    discount_total: float = 0.0
    tax_total: float = 0.0
    total_amount: float = 0.0
    items: List[CanonicalSaleItem] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "voucher_number": self.external_voucher_number,
            "voucher_date": self.voucher_date,
            "customer_name": self.customer_name,
            "customer_code": self.customer_code,
            "customer_gstin": self.customer_gstin,
            "salesman_name": self.salesman_name,
            "salesman_code": self.salesman_code,
            "city": self.city,
            "state": self.state,
            "taxable_subtotal": float(self.taxable_subtotal),
            "discount_total": float(self.discount_total),
            "tax_total": float(self.tax_total),
            "total_amount": float(self.total_amount),
            "items": [item.to_dict() for item in self.items]
        }
