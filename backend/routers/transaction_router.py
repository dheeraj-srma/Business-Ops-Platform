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

@router.get("/transactions")
def list_transactions(
    limit: int = Query(default=1000),
    dateFrom: Optional[str] = Query(None),
    dateTo: Optional[str] = Query(None),
):
    try:
        txns = TransactionRepository.get_transactions(limit=limit, start_date=dateFrom, end_date=dateTo)
        records = []
        for t in txns:
            prod = t.get("products") or {}
            sku = prod.get("sku") or "UNKNOWN"
            name = prod.get("name") or sku
            t_type = (t.get("transaction_type") or "adjustment").upper()
            qty = round(float(t.get("quantity") or 0.0), 4)
            cost = round(float(t.get("unit_cost") or 0.0), 2)
            total = round(qty * cost, 2)
            ts = t.get("transaction_date") or t.get("created_at") or ""

            records.append({
                "id": t.get("id"),
                "Txn ID": t.get("id"),
                "Type": t_type,
                "transactionType": t_type,
                "transaction_type": t_type,
                "SKU": sku,
                "productSku": sku,
                "Item Name": name,
                "productName": name,
                "Category": prod.get("brand") or "General",
                "categoryName": prod.get("brand") or "General",
                "Quantity": qty,
                "quantity": qty,
                "Unit Cost": cost,
                "Total Cost": total,
                "Reference": t.get("reference_type") or t.get("notes") or "Movement",
                "referenceNumber": t.get("reference_type") or t.get("id"),
                "reference_number": t.get("reference_type") or t.get("id"),
                "supplierOrRecipient": "Main Depot",
                "supplier_or_recipient": "Main Depot",
                "notes": t.get("notes") or "",
                "createdByName": "Director (Operations)",
                "created_by_name": "Director (Operations)",
                "createdAt": ts,
                "created_at": ts,
                "Timestamp": ts[:19].replace("T", " ") if ts else "",
                "Date": ts[:10] if ts else "",
            })
        return records
    except Exception as exc:
        logger.error(f"Error listing transactions: {exc}")
        return []

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
