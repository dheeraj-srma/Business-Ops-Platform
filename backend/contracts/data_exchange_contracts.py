# backend/contracts/data_exchange_contracts.py
"""
Data Exchange Contract Core & Specification Engine.
Defines versioned schemas, field rules, constraints, templates, and accountant specifications
for all supported data exchange types across the Business Operations Platform.
Single Source of Truth: All validators, templates, and accountant specs derive from this module.
"""

from typing import Dict, Any, List, Optional
import json
from datetime import datetime, timezone

CURRENT_SCHEMA_VERSION = "1.0"
SUPPORTED_SCHEMA_VERSIONS = ["1.0"]

# ─── 1. CONTRACT DEFINITIONS ──────────────────────────────────────────────────

CONTRACTS: Dict[str, Dict[str, Any]] = {
    "historical_sales": {
        "exchange_type": "historical_sales",
        "name": "Historical Sales & Invoices",
        "description": "Historical sales invoices and vouchers exchanged with Tally/accounting systems.",
        "schema_version": CURRENT_SCHEMA_VERSION,
        "supported_versions": SUPPORTED_SCHEMA_VERSIONS,
        "default_source": "TALLY",
        "default_destination": "BUSINESS_OPS_PLATFORM",
        "primary_key": "voucher_number",
        "root_fields": [
            {
                "name": "schema_version",
                "label": "Schema Version",
                "type": "string",
                "required": True,
                "nullable": False,
                "allowed_values": SUPPORTED_SCHEMA_VERSIONS,
                "description": "Contract version identifier. Must match a supported schema version.",
                "example": "1.0"
            },
            {
                "name": "exchange_type",
                "label": "Exchange Type",
                "type": "string",
                "required": True,
                "nullable": False,
                "allowed_values": ["historical_sales"],
                "description": "Unique identifier of the exchange contract type.",
                "example": "historical_sales"
            },
            {
                "name": "source",
                "label": "Source System",
                "type": "string",
                "required": True,
                "nullable": False,
                "description": "Source origin of the payload (e.g. TALLY, BUSY, INTERNAL).",
                "example": "TALLY"
            },
            {
                "name": "generated_at",
                "label": "Generated Timestamp",
                "type": "datetime",
                "required": False,
                "nullable": True,
                "description": "ISO 8601 timestamp when this payload was extracted.",
                "example": "2026-09-23T18:00:00Z"
            },
            {
                "name": "period_start",
                "label": "Period Start Date",
                "type": "date",
                "required": False,
                "nullable": True,
                "description": "Start date for the batch range (YYYY-MM-DD).",
                "example": "2026-06-01"
            },
            {
                "name": "period_end",
                "label": "Period End Date",
                "type": "date",
                "required": False,
                "nullable": True,
                "description": "End date for the batch range (YYYY-MM-DD).",
                "example": "2026-09-21"
            },
            {
                "name": "records",
                "label": "Records Array",
                "type": "array",
                "required": True,
                "nullable": False,
                "description": "List of individual sales invoice/voucher records.",
                "example": []
            }
        ],
        "record_fields": [
            {
                "name": "voucher_number",
                "label": "Voucher / Invoice Number",
                "type": "string",
                "required": True,
                "nullable": False,
                "min_length": 1,
                "max_length": 100,
                "description": "Unique external invoice or voucher identifier.",
                "example": "NMIPL/26-27/0714"
            },
            {
                "name": "voucher_date",
                "label": "Voucher Date",
                "type": "date",
                "required": True,
                "nullable": False,
                "format": "YYYY-MM-DD",
                "description": "Transaction date in canonical YYYY-MM-DD format.",
                "example": "2026-06-01"
            },
            {
                "name": "customer_name",
                "label": "Customer / Party Name",
                "type": "string",
                "required": True,
                "nullable": False,
                "min_length": 1,
                "max_length": 200,
                "description": "Customer ledger name as recorded in accounting.",
                "example": "BRIJRAJ CREATIVE"
            },
            {
                "name": "customer_code",
                "label": "Customer Code (External)",
                "type": "string",
                "required": False,
                "nullable": True,
                "description": "External customer ledger code or identifier.",
                "example": "CUST-FAR-101"
            },
            {
                "name": "customer_gstin",
                "label": "Customer GSTIN",
                "type": "string",
                "required": False,
                "nullable": True,
                "description": "15-digit GSTIN tax identifier.",
                "example": "06AAAAA0000A1Z5"
            },
            {
                "name": "salesman_name",
                "label": "Salesman / Representative Name",
                "type": "string",
                "required": False,
                "nullable": True,
                "description": "Field salesman credited for this sale.",
                "example": "ANKIT"
            },
            {
                "name": "salesman_code",
                "label": "Salesman Code",
                "type": "string",
                "required": False,
                "nullable": True,
                "description": "Internal salesman code reference.",
                "example": "TLY-SLM-001"
            },
            {
                "name": "city",
                "label": "City / Location",
                "type": "string",
                "required": False,
                "nullable": True,
                "description": "Delivery or dealer location city.",
                "example": "Faridabad"
            },
            {
                "name": "state",
                "label": "State",
                "type": "string",
                "required": False,
                "nullable": True,
                "description": "Indian state of dealer / supply.",
                "example": "Haryana"
            },
            {
                "name": "total_amount",
                "label": "Total Gross Amount",
                "type": "number",
                "required": True,
                "nullable": False,
                "min": 0.0,
                "precision": 2,
                "unit": "INR",
                "description": "Total voucher gross value in INR.",
                "example": 125000.00
            },
            {
                "name": "items",
                "label": "Line Items",
                "type": "array",
                "required": True,
                "nullable": False,
                "min_items": 1,
                "description": "Array of billed inventory line items.",
                "example": []
            }
        ],
        "item_fields": [
            {
                "name": "item_name",
                "label": "Item Description / Name",
                "type": "string",
                "required": True,
                "nullable": False,
                "description": "Full stock item description as recorded in accounting.",
                "example": "15mm CP Bib Cock Brass Elite"
            },
            {
                "name": "product_code",
                "label": "Product Code / SKU",
                "type": "string",
                "required": False,
                "nullable": True,
                "description": "External product SKU or catalog code.",
                "example": "NALKA-BIB-15"
            },
            {
                "name": "quantity",
                "label": "Billed Quantity",
                "type": "number",
                "required": True,
                "nullable": False,
                "min": 0.001,
                "precision": 3,
                "description": "Quantity billed in base units.",
                "example": 50.0
            },
            {
                "name": "unit",
                "label": "Unit of Measure",
                "type": "string",
                "required": False,
                "nullable": True,
                "description": "Unit of measure (e.g. PCS, NOS, BOX, KG, MTR).",
                "example": "PCS"
            },
            {
                "name": "rate",
                "label": "Unit Price / Rate",
                "type": "number",
                "required": True,
                "nullable": False,
                "min": 0.0,
                "precision": 2,
                "unit": "INR",
                "description": "Price per unit excluding taxes.",
                "example": 450.00
            },
            {
                "name": "amount",
                "label": "Line Amount",
                "type": "number",
                "required": True,
                "nullable": False,
                "min": 0.0,
                "precision": 2,
                "unit": "INR",
                "description": "Total amount for this line (quantity * rate).",
                "example": 22500.00
            },
            {
                "name": "discount_percent",
                "label": "Discount %",
                "type": "number",
                "required": False,
                "nullable": True,
                "min": 0.0,
                "max": 100.0,
                "precision": 2,
                "description": "Trade or line discount percentage applied.",
                "example": 5.0
            },
            {
                "name": "gst_rate",
                "label": "GST Rate %",
                "type": "number",
                "required": False,
                "nullable": True,
                "min": 0.0,
                "max": 40.0,
                "precision": 2,
                "description": "GST tax slab applicable (0, 5, 12, 18, 28).",
                "example": 18.0
            }
        ]
    },

    "inventory_catalog": {
        "exchange_type": "inventory_catalog",
        "name": "Inventory Masters & Stock Balances",
        "description": "Product master catalog, SKU definitions, opening stock, and price matrices.",
        "schema_version": CURRENT_SCHEMA_VERSION,
        "supported_versions": SUPPORTED_SCHEMA_VERSIONS,
        "default_source": "TALLY",
        "default_destination": "BUSINESS_OPS_PLATFORM",
        "primary_key": "sku",
        "root_fields": [
            {
                "name": "schema_version",
                "label": "Schema Version",
                "type": "string",
                "required": True,
                "nullable": False,
                "allowed_values": SUPPORTED_SCHEMA_VERSIONS,
                "example": "1.0"
            },
            {
                "name": "exchange_type",
                "label": "Exchange Type",
                "type": "string",
                "required": True,
                "nullable": False,
                "allowed_values": ["inventory_catalog", "inventory_sync"],
                "example": "inventory_catalog"
            },
            {
                "name": "source",
                "label": "Source System",
                "type": "string",
                "required": True,
                "nullable": False,
                "example": "TALLY"
            },
            {
                "name": "generated_at",
                "label": "Generated Timestamp",
                "type": "datetime",
                "required": False,
                "nullable": True,
                "example": "2026-09-23T18:00:00Z"
            },
            {
                "name": "records",
                "label": "Records Array",
                "type": "array",
                "required": True,
                "nullable": False,
                "example": []
            }
        ],
        "record_fields": [
            {
                "name": "sku",
                "label": "Product SKU / Item Code",
                "type": "string",
                "required": True,
                "nullable": False,
                "min_length": 1,
                "description": "Unique product SKU code.",
                "example": "NALKA-BIB-15"
            },
            {
                "name": "name",
                "label": "Product / Item Name",
                "type": "string",
                "required": True,
                "nullable": False,
                "min_length": 1,
                "description": "Standard display title of the product.",
                "example": "15mm CP Brass Bib Cock"
            },
            {
                "name": "category",
                "label": "Category Name",
                "type": "string",
                "required": False,
                "nullable": True,
                "description": "Product parent category or group.",
                "example": "Brass Faucets"
            },
            {
                "name": "brand",
                "label": "Brand Name",
                "type": "string",
                "required": False,
                "nullable": True,
                "description": "Product brand designation.",
                "example": "NALKA"
            },
            {
                "name": "unit_of_measure",
                "label": "Base UOM",
                "type": "string",
                "required": False,
                "nullable": True,
                "description": "Standard unit of measure (PCS, BOX, NOS, KG).",
                "example": "PCS"
            },
            {
                "name": "opening_quantity",
                "label": "Opening / Balance Stock",
                "type": "number",
                "required": False,
                "nullable": True,
                "min": 0.0,
                "precision": 3,
                "description": "Current on-hand balance stock quantity.",
                "example": 250.0
            },
            {
                "name": "cost_price",
                "label": "Cost Price",
                "type": "number",
                "required": False,
                "nullable": True,
                "min": 0.0,
                "precision": 2,
                "description": "Standard purchase / manufacturing cost per unit.",
                "example": 280.00
            },
            {
                "name": "default_sale_price",
                "label": "Default Sale Price / MRP",
                "type": "number",
                "required": True,
                "nullable": False,
                "min": 0.0,
                "precision": 2,
                "description": "Standard selling rate per unit.",
                "example": 450.00
            },
            {
                "name": "gst_rate",
                "label": "GST Rate %",
                "type": "number",
                "required": False,
                "nullable": True,
                "min": 0.0,
                "max": 40.0,
                "precision": 2,
                "description": "Applicable GST tax rate percentage.",
                "example": 18.0
            },
            {
                "name": "is_active",
                "label": "Active Status",
                "type": "boolean",
                "required": False,
                "nullable": True,
                "description": "Whether product is active for sales/ordering.",
                "example": True
            }
        ]
    },

    "purchases": {
        "exchange_type": "purchases",
        "name": "Inward Purchases & Vendor Receipts",
        "description": "Purchase vouchers, raw material inward, and supplier invoices.",
        "schema_version": CURRENT_SCHEMA_VERSION,
        "supported_versions": SUPPORTED_SCHEMA_VERSIONS,
        "default_source": "TALLY",
        "default_destination": "BUSINESS_OPS_PLATFORM",
        "primary_key": "voucher_number",
        "root_fields": [
            {
                "name": "schema_version",
                "label": "Schema Version",
                "type": "string",
                "required": True,
                "nullable": False,
                "allowed_values": SUPPORTED_SCHEMA_VERSIONS,
                "example": "1.0"
            },
            {
                "name": "exchange_type",
                "label": "Exchange Type",
                "type": "string",
                "required": True,
                "nullable": False,
                "allowed_values": ["purchases"],
                "example": "purchases"
            },
            {
                "name": "source",
                "label": "Source System",
                "type": "string",
                "required": True,
                "nullable": False,
                "example": "TALLY"
            },
            {
                "name": "generated_at",
                "label": "Generated Timestamp",
                "type": "datetime",
                "required": False,
                "nullable": True,
                "example": "2026-09-23T18:00:00Z"
            },
            {
                "name": "records",
                "label": "Records Array",
                "type": "array",
                "required": True,
                "nullable": False,
                "example": []
            }
        ],
        "record_fields": [
            {
                "name": "voucher_number",
                "label": "Purchase Voucher Number",
                "type": "string",
                "required": True,
                "nullable": False,
                "description": "Purchase bill or inward GRN number.",
                "example": "PUR/26-27/0042"
            },
            {
                "name": "voucher_date",
                "label": "Purchase Date",
                "type": "date",
                "required": True,
                "nullable": False,
                "format": "YYYY-MM-DD",
                "description": "Date of invoice/goods receipt (YYYY-MM-DD).",
                "example": "2026-06-15"
            },
            {
                "name": "supplier_name",
                "label": "Supplier / Vendor Name",
                "type": "string",
                "required": True,
                "nullable": False,
                "description": "Supplier ledger name in accounting.",
                "example": "Shree Ram Brass Ingot Casting"
            },
            {
                "name": "supplier_gstin",
                "label": "Supplier GSTIN",
                "type": "string",
                "required": False,
                "nullable": True,
                "description": "Supplier GSTIN tax identification.",
                "example": "06BBBBB1111B1Z2"
            },
            {
                "name": "total_amount",
                "label": "Total Purchase Amount",
                "type": "number",
                "required": True,
                "nullable": False,
                "min": 0.0,
                "precision": 2,
                "description": "Total purchase invoice value in INR.",
                "example": 450000.00
            },
            {
                "name": "items",
                "label": "Purchase Line Items",
                "type": "array",
                "required": True,
                "nullable": False,
                "min_items": 1,
                "description": "List of purchased items.",
                "example": []
            }
        ],
        "item_fields": [
            {
                "name": "item_name",
                "label": "Item Description",
                "type": "string",
                "required": True,
                "nullable": False,
                "example": "Standard Brass Scrap Ingot 60/40"
            },
            {
                "name": "product_code",
                "label": "Product Code / SKU",
                "type": "string",
                "required": False,
                "nullable": True,
                "example": "RAW-BRASS-INGOT"
            },
            {
                "name": "quantity",
                "label": "Received Quantity",
                "type": "number",
                "required": True,
                "nullable": False,
                "min": 0.001,
                "precision": 3,
                "example": 1000.0
            },
            {
                "name": "unit",
                "label": "Unit",
                "type": "string",
                "required": False,
                "nullable": True,
                "example": "KG"
            },
            {
                "name": "rate",
                "label": "Unit Purchase Rate",
                "type": "number",
                "required": True,
                "nullable": False,
                "min": 0.0,
                "precision": 2,
                "example": 450.00
            },
            {
                "name": "amount",
                "label": "Line Total Amount",
                "type": "number",
                "required": True,
                "nullable": False,
                "min": 0.0,
                "precision": 2,
                "example": 450000.00
            }
        ]
    },

    "returns": {
        "exchange_type": "returns",
        "name": "Sales Returns & Credit Notes",
        "description": "Customer return vouchers, credit notes, and quality replacement records.",
        "schema_version": CURRENT_SCHEMA_VERSION,
        "supported_versions": SUPPORTED_SCHEMA_VERSIONS,
        "default_source": "TALLY",
        "default_destination": "BUSINESS_OPS_PLATFORM",
        "primary_key": "voucher_number",
        "root_fields": [
            {
                "name": "schema_version",
                "label": "Schema Version",
                "type": "string",
                "required": True,
                "nullable": False,
                "allowed_values": SUPPORTED_SCHEMA_VERSIONS,
                "example": "1.0"
            },
            {
                "name": "exchange_type",
                "label": "Exchange Type",
                "type": "string",
                "required": True,
                "nullable": False,
                "allowed_values": ["returns"],
                "example": "returns"
            },
            {
                "name": "source",
                "label": "Source System",
                "type": "string",
                "required": True,
                "nullable": False,
                "example": "TALLY"
            },
            {
                "name": "generated_at",
                "label": "Generated Timestamp",
                "type": "datetime",
                "required": False,
                "nullable": True,
                "example": "2026-09-23T18:00:00Z"
            },
            {
                "name": "records",
                "label": "Records Array",
                "type": "array",
                "required": True,
                "nullable": False,
                "example": []
            }
        ],
        "record_fields": [
            {
                "name": "voucher_number",
                "label": "Credit Note / Return Number",
                "type": "string",
                "required": True,
                "nullable": False,
                "description": "Unique credit note voucher number.",
                "example": "CN/26-27/0018"
            },
            {
                "name": "voucher_date",
                "label": "Return Date",
                "type": "date",
                "required": True,
                "nullable": False,
                "format": "YYYY-MM-DD",
                "description": "Date of return credit note (YYYY-MM-DD).",
                "example": "2026-07-10"
            },
            {
                "name": "original_invoice_ref",
                "label": "Original Invoice Ref",
                "type": "string",
                "required": False,
                "nullable": True,
                "description": "Reference number of the original sales invoice.",
                "example": "NMIPL/26-27/0714"
            },
            {
                "name": "customer_name",
                "label": "Customer Name",
                "type": "string",
                "required": True,
                "nullable": False,
                "description": "Customer ledger name issuing return.",
                "example": "BRIJRAJ CREATIVE"
            },
            {
                "name": "total_amount",
                "label": "Total Return Amount",
                "type": "number",
                "required": True,
                "nullable": False,
                "min": 0.0,
                "precision": 2,
                "description": "Total value of return in INR.",
                "example": 9000.00
            },
            {
                "name": "reason",
                "label": "Return Reason / Defect Category",
                "type": "string",
                "required": False,
                "nullable": True,
                "description": "Return reason (e.g. Plating Defect, Thread Fault, Transit Damage, Excess Stock).",
                "example": "Plating Blemish / Quality Inspection"
            },
            {
                "name": "items",
                "label": "Returned Items",
                "type": "array",
                "required": True,
                "nullable": False,
                "min_items": 1,
                "example": []
            }
        ],
        "item_fields": [
            {
                "name": "item_name",
                "label": "Item Description",
                "type": "string",
                "required": True,
                "nullable": False,
                "example": "15mm CP Bib Cock Brass Elite"
            },
            {
                "name": "product_code",
                "label": "Product Code / SKU",
                "type": "string",
                "required": False,
                "nullable": True,
                "example": "NALKA-BIB-15"
            },
            {
                "name": "quantity",
                "label": "Returned Quantity",
                "type": "number",
                "required": True,
                "nullable": False,
                "min": 0.001,
                "precision": 3,
                "example": 20.0
            },
            {
                "name": "rate",
                "label": "Unit Credit Rate",
                "type": "number",
                "required": True,
                "nullable": False,
                "min": 0.0,
                "precision": 2,
                "example": 450.00
            },
            {
                "name": "amount",
                "label": "Line Credit Amount",
                "type": "number",
                "required": True,
                "nullable": False,
                "min": 0.0,
                "precision": 2,
                "example": 9000.00
            }
        ]
    },

    "accounting_masters": {
        "exchange_type": "accounting_masters",
        "name": "Party Ledgers & Accounting Masters",
        "description": "Customer and vendor ledger master records, addresses, GSTIN, and credit terms.",
        "schema_version": CURRENT_SCHEMA_VERSION,
        "supported_versions": SUPPORTED_SCHEMA_VERSIONS,
        "default_source": "TALLY",
        "default_destination": "BUSINESS_OPS_PLATFORM",
        "primary_key": "name",
        "root_fields": [
            {
                "name": "schema_version",
                "label": "Schema Version",
                "type": "string",
                "required": True,
                "nullable": False,
                "allowed_values": SUPPORTED_SCHEMA_VERSIONS,
                "example": "1.0"
            },
            {
                "name": "exchange_type",
                "label": "Exchange Type",
                "type": "string",
                "required": True,
                "nullable": False,
                "allowed_values": ["accounting_masters"],
                "example": "accounting_masters"
            },
            {
                "name": "source",
                "label": "Source System",
                "type": "string",
                "required": True,
                "nullable": False,
                "example": "TALLY"
            },
            {
                "name": "generated_at",
                "label": "Generated Timestamp",
                "type": "datetime",
                "required": False,
                "nullable": True,
                "example": "2026-09-23T18:00:00Z"
            },
            {
                "name": "records",
                "label": "Records Array",
                "type": "array",
                "required": True,
                "nullable": False,
                "example": []
            }
        ],
        "record_fields": [
            {
                "name": "name",
                "label": "Party / Ledger Name",
                "type": "string",
                "required": True,
                "nullable": False,
                "description": "Primary ledger account name.",
                "example": "BRIJRAJ CREATIVE"
            },
            {
                "name": "party_type",
                "label": "Party Type",
                "type": "string",
                "required": True,
                "nullable": False,
                "allowed_values": ["CUSTOMER", "SUPPLIER", "DEALER"],
                "description": "Ledger group type: CUSTOMER, SUPPLIER, or DEALER.",
                "example": "CUSTOMER"
            },
            {
                "name": "code",
                "label": "External Party Code",
                "type": "string",
                "required": False,
                "nullable": True,
                "description": "External customer or supplier code.",
                "example": "CUST-FAR-101"
            },
            {
                "name": "shop_name",
                "label": "Shop / Business Trading Name",
                "type": "string",
                "required": False,
                "nullable": True,
                "description": "Storefront or shop name.",
                "example": "Brijraj Hardware & Sanitary"
            },
            {
                "name": "gstin",
                "label": "GSTIN",
                "type": "string",
                "required": False,
                "nullable": True,
                "description": "15-digit GSTIN tax number.",
                "example": "06AAAAA0000A1Z5"
            },
            {
                "name": "city",
                "label": "City",
                "type": "string",
                "required": False,
                "nullable": True,
                "description": "City of registered place of business.",
                "example": "Faridabad"
            },
            {
                "name": "state",
                "label": "State",
                "type": "string",
                "required": False,
                "nullable": True,
                "description": "State of registered place of business.",
                "example": "Haryana"
            },
            {
                "name": "phone",
                "label": "Contact Phone",
                "type": "string",
                "required": False,
                "nullable": True,
                "description": "Primary mobile or telephone contact.",
                "example": "+91 98765 43210"
            },
            {
                "name": "salesman_name",
                "label": "Assigned Salesman",
                "type": "string",
                "required": False,
                "nullable": True,
                "description": "Designated internal field salesman.",
                "example": "ANKIT"
            },
            {
                "name": "opening_balance",
                "label": "Opening Outstanding Balance",
                "type": "number",
                "required": False,
                "nullable": True,
                "precision": 2,
                "description": "Opening ledger balance in INR (positive = debit, negative = credit).",
                "example": 15000.00
            }
        ]
    }
}


# ─── 2. CONTRACT UTILITIES & TEMPLATE GENERATORS ─────────────────────────────

def get_contract(exchange_type: str, version: str = CURRENT_SCHEMA_VERSION) -> Dict[str, Any]:
    """Retrieves contract definition by exchange_type and verifies version support."""
    normalized_type = exchange_type.strip().lower()
    if normalized_type not in CONTRACTS:
        raise ValueError(
            f"Unsupported exchange type '{exchange_type}'. Supported types: {list(CONTRACTS.keys())}"
        )
    contract = CONTRACTS[normalized_type]
    if version not in contract.get("supported_versions", []):
        raise ValueError(
            f"Unsupported schema version '{version}' for exchange '{exchange_type}'. "
            f"Supported versions: {contract.get('supported_versions')}"
        )
    return contract


def list_contracts() -> List[Dict[str, Any]]:
    """Lists summary of all registered data exchange contracts."""
    summaries = []
    for k, c in CONTRACTS.items():
        summaries.append({
            "exchange_type": c["exchange_type"],
            "name": c["name"],
            "description": c["description"],
            "schema_version": c["schema_version"],
            "supported_versions": c["supported_versions"],
            "default_source": c["default_source"],
            "record_field_count": len(c.get("record_fields", [])),
            "item_field_count": len(c.get("item_fields", [])) if "item_fields" in c else 0
        })
    return summaries


def generate_blank_template(exchange_type: str, version: str = CURRENT_SCHEMA_VERSION) -> Dict[str, Any]:
    """
    Generates a blank, contract-compliant JSON template with default placeholder values
    for accountants to fill in.
    """
    contract = get_contract(exchange_type, version)
    
    # Generate blank record
    blank_rec = {}
    for f in contract.get("record_fields", []):
        name = f["name"]
        t = f["type"]
        req = f.get("required", False)
        if name == "items" and "item_fields" in contract:
            blank_item = {}
            for item_f in contract.get("item_fields", []):
                iname = item_f["name"]
                it = item_f["type"]
                blank_item[iname] = (
                    0.0 if it == "number" else
                    "" if it == "string" else
                    "YYYY-MM-DD" if it == "date" else
                    None
                )
            blank_rec["items"] = [blank_item]
        elif t == "number":
            blank_rec[name] = 0.0 if req else None
        elif t == "date":
            blank_rec[name] = "YYYY-MM-DD" if req else ""
        elif t == "boolean":
            blank_rec[name] = True if req else None
        else:
            blank_rec[name] = "" if req else None

    return {
        "schema_version": version,
        "exchange_type": contract["exchange_type"],
        "source": contract["default_source"],
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "records": [blank_rec]
    }


def generate_sample_payload(exchange_type: str, version: str = CURRENT_SCHEMA_VERSION) -> Dict[str, Any]:
    """
    Generates a realistic, fully populated sample JSON payload derived strictly from
    field example metadata in the contract.
    """
    contract = get_contract(exchange_type, version)
    sample_rec = {}
    for f in contract.get("record_fields", []):
        name = f["name"]
        if name == "items" and "item_fields" in contract:
            sample_item = {}
            for item_f in contract.get("item_fields", []):
                sample_item[item_f["name"]] = item_f.get("example")
            sample_rec["items"] = [sample_item]
        else:
            sample_rec[name] = f.get("example")

    return {
        "schema_version": version,
        "exchange_type": contract["exchange_type"],
        "source": contract["default_source"],
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "records": [sample_rec]
    }


def generate_accountant_spec(exchange_type: str, version: str = CURRENT_SCHEMA_VERSION) -> Dict[str, Any]:
    """
    Generates a structured, business-friendly accountant specification document directly
    from the contract.
    """
    contract = get_contract(exchange_type, version)
    
    root_spec = []
    for f in contract.get("root_fields", []):
        root_spec.append({
            "name": f["name"],
            "label": f["label"],
            "type": f["type"],
            "required": f.get("required", False),
            "description": f.get("description", ""),
            "example": str(f.get("example", "")),
            "allowed_values": f.get("allowed_values")
        })

    record_spec = []
    for f in contract.get("record_fields", []):
        record_spec.append({
            "name": f["name"],
            "label": f["label"],
            "type": f["type"],
            "semantic_meaning": f.get("semantic_meaning", f.get("name")),
            "required": f.get("required", False),
            "nullable": f.get("nullable", True),
            "description": f.get("description", ""),
            "example": str(f.get("example", "")),
            "constraints": {
                "min": f.get("min"),
                "max": f.get("max"),
                "precision": f.get("precision"),
                "format": f.get("format"),
                "allowed_values": f.get("allowed_values")
            }
        })

    item_spec = []
    if "item_fields" in contract:
        for f in contract.get("item_fields", []):
            item_spec.append({
                "name": f["name"],
                "label": f["label"],
                "type": f["type"],
                "semantic_meaning": f.get("semantic_meaning", f.get("name")),
                "required": f.get("required", False),
                "nullable": f.get("nullable", True),
                "description": f.get("description", ""),
                "example": str(f.get("example", "")),
                "constraints": {
                    "min": f.get("min"),
                    "max": f.get("max"),
                    "precision": f.get("precision"),
                    "unit": f.get("unit")
                }
            })

    return {
        "exchange_type": contract["exchange_type"],
        "name": contract["name"],
        "description": contract["description"],
        "schema_version": contract["schema_version"],
        "canonical_date_format": "YYYY-MM-DD",
        "primary_key": contract.get("primary_key"),
        "root_fields": root_spec,
        "record_fields": record_spec,
        "item_fields": item_spec,
        "validation_rules": [
            "Every payload must contain a root object with valid schema_version and exchange_type matching the contract.",
            "Dates must strictly follow canonical YYYY-MM-DD format (e.g. 2026-06-01). Ambiguous formats like DD/MM/YY are rejected.",
            "Numeric amounts and quantities must be numeric values, not currency-formatted strings (e.g. 1250.00, NOT '₹1,250').",
            "Vouchers are identified by unique external voucher_number to ensure idempotent imports without duplicate insertion.",
            "Unresolved entity references (unknown SKUs, unmapped customer codes) are quarantined for review without silent auto-creation.",
            "All import operations are transactional: any database interruption triggers a full rollback."
        ]
    }
