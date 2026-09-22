# backend/routers/transaction_router.py
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from schemas.returns import ReturnCreateSchema, ReturnResponseSchema
from repositories.transaction_repo import TransactionRepository
from repositories.order_repo import OrderRepository
from services.inventory_service import InventoryService
from auth import require_permission
from services.snapshot_service import SnapshotService

logger = logging.getLogger("transaction_router")
router = APIRouter(prefix="/api", tags=["Stock Movements & Transactions"])

from services.analytics_service import analytics_service

@router.get("/transactions")
def list_transactions(
    limit: int = Query(default=1000),
    dateFrom: Optional[str] = Query(None),
    dateTo: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    try:
        txns = TransactionRepository.get_transactions(
            limit=limit,
            start_date=dateFrom,
            end_date=dateTo,
            transaction_type=type,
            search=search
        )
        records = []
        for t in txns:
            prod = t.get("products") or {}
            if isinstance(prod, list) and prod:
                prod = prod[0]
            elif not isinstance(prod, dict):
                prod = {}

            sku = prod.get("sku") or "UNKNOWN"
            name = prod.get("name") or sku
            raw_type = str(t.get("transaction_type") or "adjustment").lower()
            t_type = raw_type.upper()
            qty = round(float(t.get("quantity") or 0.0), 4)
            cost = round(float(t.get("unit_cost") or 0.0), 2)
            total = round(qty * cost, 2)
            ts = t.get("transaction_date") or t.get("created_at") or ""

            notes_str = str(t.get("notes") or "")
            actor_name = "Staff"
            if "By:" in notes_str:
                parts = notes_str.split("By:")
                if len(parts) > 1:
                    actor_name = parts[1].split("|")[0].strip()

            supplier_recipient = "Main Depot"
            if "Supplier:" in notes_str:
                parts = notes_str.split("Supplier:")
                if len(parts) > 1:
                    supplier_recipient = parts[1].split("|")[0].strip()
            elif "Recipient:" in notes_str:
                parts = notes_str.split("Recipient:")
                if len(parts) > 1:
                    supplier_recipient = parts[1].split("|")[0].strip()

            ref_display = t.get("client_reference") or str(t.get("reference_id") or "") or t.get("reference_type") or "-"

            records.append({
                "id": str(t.get("id")),
                "Txn ID": str(t.get("id")),
                "Type": t_type,
                "transactionType": t_type,
                "transaction_type": raw_type,
                "productId": str(t.get("product_id") or prod.get("id") or ""),
                "product_id": str(t.get("product_id") or prod.get("id") or ""),
                "SKU": sku,
                "productSku": sku,
                "Item Name": name,
                "productName": name,
                "Category": prod.get("brand") or "General",
                "categoryName": prod.get("brand") or "General",
                "unit": prod.get("unit_of_measure") or "NOS",
                "Quantity": qty,
                "quantity": qty,
                "Unit Cost": cost,
                "Total Cost": total,
                "Reference": ref_display,
                "referenceNumber": ref_display,
                "reference_number": ref_display,
                "supplierOrRecipient": supplier_recipient,
                "supplier_or_recipient": supplier_recipient,
                "notes": notes_str,
                "createdByName": actor_name,
                "created_by_name": actor_name,
                "performed_by": t.get("performed_by"),
                "createdAt": ts,
                "created_at": ts,
                "Timestamp": ts[:19].replace("T", " ") if ts else "",
                "Date": ts[:10] if ts else "",
            })
        return records
    except Exception as exc:
        logger.error(f"Error listing transactions: {exc}")
        return []

@router.get("/transactions/movement-summary")
@router.get("/inventory/movement-summary")
def get_movement_summary(
    startDate: Optional[str] = Query(None),
    endDate: Optional[str] = Query(None),
    granularity: Optional[str] = Query("daily", regex="^(daily|weekly|monthly)$")
):
    try:
        return analytics_service.get_stock_movement_summary(
            start_date=startDate,
            end_date=endDate,
            granularity=granularity or "daily"
        )
    except Exception as exc:
        logger.error(f"Error calculating stock movement summary: {exc}")
        raise HTTPException(status_code=500, detail="Failed to compute stock movement summary.")

@router.get("/adjustments")
def list_adjustments():
    all_txns = list_transactions(limit=1000)
    return [t for t in all_txns if "ADJUSTMENT" in str(t.get("Type", "")).upper()]

@router.get("/returns")
def list_returns():
    try:
        returns = TransactionRepository.get_returns()
        records = []
        for r in returns:
            records.append({
                "Return ID": r.get("return_code") or r.get("id"),
                "Customer Name": r.get("customer_name"),
                "Location": r.get("location_name") or "Main Depot",
                "SKU": r.get("sku"),
                "Item Name": r.get("item_name"),
                "Category": r.get("category"),
                "Price": round(float(r.get("price") or 0.0), 2),
                "Quantity": int(r.get("quantity") or 1),
                "Condition": r.get("condition") or "Good Return",
                "Reason": r.get("reason"),
                "Status": r.get("status") or "Processed",
                "Timestamp": r.get("created_at"),
            })
        return records
    except Exception as exc:
        logger.error(f"Error listing returns: {exc}")
        return []

@router.post("/returns", response_model=ReturnResponseSchema)
def create_return(
    item: ReturnCreateSchema,
    current_user: dict = Depends(require_permission("returns.manage"))
):
    SnapshotService.assert_writable("return creation")
    try:
        res = InventoryService.process_return(item, current_user)
        return res
    except ValueError as val_err:
        err_msg = str(val_err)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=404, detail=err_msg)
        if "exceeds" in err_msg.lower() or "eligible" in err_msg.lower():
            raise HTTPException(status_code=409, detail=err_msg)
        raise HTTPException(status_code=422, detail=err_msg)
    except Exception as exc:
        logger.error(f"Error creating return: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/inwards")
def list_inwards(limit: int = Query(default=1000)):
    try:
        all_txns = list_transactions(limit=limit)
        inwards = [t for t in all_txns if str(t.get("transaction_type") or t.get("Type") or "").upper() in ("INWARD", "STOCK_IN")]
        return inwards
    except Exception as exc:
        logger.error(f"Error listing inwards: {exc}")
        return []

