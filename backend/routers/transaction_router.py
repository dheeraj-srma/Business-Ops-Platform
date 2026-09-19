# backend/routers/transaction_router.py
import logging
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query
from schemas.returns import ReturnCreateSchema
from repositories.transaction_repo import TransactionRepository
from repositories.order_repo import OrderRepository
from auth import require_role
from supabase_client import get_supabase_client

logger = logging.getLogger("transaction_router")
router = APIRouter(prefix="/api", tags=["Stock Movements & Transactions"])

@router.get("/transactions")
def list_transactions(limit: int = Query(default=1000)):
    try:
        txns = TransactionRepository.get_transactions(limit=limit)
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

@router.post("/returns")
def create_return(
    item: ReturnCreateSchema,
    current_user: dict = Depends(require_role(["admin", "stock_manager", "order_manager"]))
):
    try:
        client = get_supabase_client()
        import uuid
        is_good = "good" in item.condition.strip().lower()
        status = "Restocked" if is_good else "Defective"
        ret_code = f"RET-{uuid.uuid4().hex[:8].upper()}"

        ret_data = {
            "return_code": ret_code,
            "customer_name": item.customer_name,
            "location_name": item.location,
            "sku": item.sku,
            "item_name": item.item_name,
            "category": item.category,
            "price": round(float(item.price), 2),
            "quantity": int(item.quantity),
            "condition": "Good Return" if is_good else "Defective Return",
            "reason": item.reason,
            "status": status,
        }
        TransactionRepository.insert_return(ret_data)

        # If Good return, record stock_in transaction to drive atomic stock ledger
        if is_good and item.sku:
            p_res = client.table("products").select("id").eq("sku", item.sku).limit(1).execute()
            if p_res.data:
                prod_id = p_res.data[0]["id"]
                inv_res = client.table("inventory").select("location_id").eq("product_id", prod_id).limit(1).execute()
                loc_id = inv_res.data[0]["location_id"] if inv_res.data else None

                # Atomic stock movement insert -> triggers DB balance update
                TransactionRepository.record_stock_transaction({
                    "transaction_type": "return_in",
                    "product_id": prod_id,
                    "location_id": loc_id,
                    "quantity": float(item.quantity),
                    "unit_cost": float(item.price),
                    "reference_type": "return",
                    "notes": f"Restocked from return {ret_code}",
                })

        return {"status": "success", "return_id": ret_code, "restocked": is_good}
    except Exception as exc:
        logger.error(f"Error creating return: {exc}")
        raise HTTPException(status_code=400, detail=str(exc))
