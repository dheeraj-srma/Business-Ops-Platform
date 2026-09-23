# backend/routers/coupon_router.py
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, status
from auth import require_permission, require_role
from services.snapshot_service import SnapshotService
from supabase_client import get_supabase_client

logger = logging.getLogger("coupon_router")
router = APIRouter(prefix="/api/coupons", tags=["Coupons Management"])

_IN_MEMORY_COUPONS: List[Dict[str, Any]] = []

@router.get("", summary="Get coupons with stats and filtering")
def list_coupons(
    brand: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    series: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: dict = Depends(require_permission("inventory.view"))
):
    client = get_supabase_client()
    coupons = []
    if client:
        try:
            res = client.table("coupons").select("*").order("created_at", desc=True).limit(1000).execute()
            if res.data:
                coupons = res.data
        except Exception as exc:
            logger.warning(f"Error fetching coupons from Supabase, using in-memory: {exc}")
            coupons = _IN_MEMORY_COUPONS
    else:
        coupons = _IN_MEMORY_COUPONS

    # Compute stats
    total_used = sum(int(c.get("coupons_used") or 0) for c in coupons)
    total_val = sum(float(c.get("coupon_amount") or 0) * int(c.get("coupons_used") or 0) for c in coupons)

    return {
        "success": True,
        "coupons": coupons,
        "stats": {
            "totalCouponsUsed": total_used,
            "totalDiscountValue": total_val,
            "totalEntries": len(coupons)
        }
    }

@router.post("", summary="Create or Add Coupon")
def create_coupon(
    payload: dict,
    current_user: dict = Depends(require_permission("inventory.manage"))
):
    SnapshotService.assert_writable("create coupon")
    client = get_supabase_client()
    if not client:
        raise HTTPException(status_code=500, detail="Database connection unavailable.")

    product_name = payload.get("product_name") or payload.get("productName")
    series_name = payload.get("series_name") or payload.get("seriesName")
    brand_name = payload.get("brand_name") or payload.get("brandName") or "Nalka Metals"
    category = payload.get("category") or "General"
    coupon_amount = float(payload.get("coupon_amount") or payload.get("couponAmount") or 0)
    coupons_used = int(payload.get("coupons_used") or payload.get("couponsUsed") or 0)
    notes = payload.get("notes") or ""

    if not product_name or not series_name or coupon_amount <= 0:
        raise HTTPException(status_code=400, detail="Fields product_name, series_name, and valid coupon_amount are required.")

    coupon_record = {
        "product_name": product_name.strip(),
        "series_name": series_name.strip().upper(),
        "brand_name": brand_name.strip(),
        "category": category.strip(),
        "coupon_amount": coupon_amount,
        "coupons_used": coupons_used,
        "notes": notes.strip(),
        "created_by": current_user.get("user_id") or current_user.get("email")
    }

    import uuid
    from datetime import datetime
    coupon_record["id"] = str(uuid.uuid4())
    coupon_record["created_at"] = datetime.utcnow().isoformat()

    try:
        res = client.table("coupons").insert(coupon_record).execute()
        created = res.data[0] if res.data else coupon_record
        _IN_MEMORY_COUPONS.insert(0, created)
        return {
            "success": True,
            "coupon": created,
            "message": f"Coupon series '{series_name}' added successfully."
        }
    except Exception as exc:
        logger.warning(f"Error inserting coupon to Supabase, using in-memory store: {exc}")
        _IN_MEMORY_COUPONS.insert(0, coupon_record)
        return {
            "success": True,
            "coupon": coupon_record,
            "message": f"Coupon series '{series_name}' added successfully."
        }

@router.post("/bulk", summary="Bulk Upload Coupon Records")
def bulk_create_coupons(
    payload: dict,
    current_user: dict = Depends(require_permission("inventory.manage"))
):
    SnapshotService.assert_writable("bulk create coupons")
    client = get_supabase_client()
    if not client:
        raise HTTPException(status_code=500, detail="Database connection unavailable.")

    items = payload.get("items") or payload.get("rows") or []
    if not items:
        raise HTTPException(status_code=400, detail="No coupon rows supplied for bulk upload.")

    replace_existing = payload.get("replace_existing", False)
    if replace_existing:
        try:
            client.table("coupons").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
        except Exception as del_err:
            logger.warning(f"Error clearing existing coupons during bulk upload: {del_err}")

    records_to_insert = []
    for it in items:
        p_name = it.get("product_name") or it.get("productName")
        s_name = it.get("series_name") or it.get("seriesName")
        c_amt = float(it.get("coupon_amount") or it.get("couponAmount") or 0)
        c_used = int(it.get("coupons_used") or it.get("couponsUsed") or 0)
        if p_name and s_name and c_amt > 0:
            records_to_insert.append({
                "product_name": str(p_name).strip(),
                "series_name": str(s_name).strip().upper(),
                "brand_name": str(it.get("brand_name") or it.get("brandName") or "Nalka Metals").strip(),
                "category": str(it.get("category") or "General").strip(),
                "coupon_amount": c_amt,
                "coupons_used": c_used,
                "notes": str(it.get("notes") or "").strip(),
                "created_by": current_user.get("user_id") or current_user.get("email")
            })

    if not records_to_insert:
        raise HTTPException(status_code=400, detail="No valid coupon items found in upload batch.")

    try:
        res = client.table("coupons").insert(records_to_insert).execute()
        return {
            "success": True,
            "processedCount": len(records_to_insert),
            "coupons": res.data or [],
            "message": f"Successfully imported {len(records_to_insert)} coupon records."
        }
    except Exception as exc:
        logger.error(f"Error executing bulk coupon upload: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.patch("/{coupon_id}", summary="Update Coupon")
def update_coupon(
    coupon_id: str,
    payload: dict,
    current_user: dict = Depends(require_permission("inventory.manage"))
):
    SnapshotService.assert_writable("update coupon")
    client = get_supabase_client()
    if not client:
        raise HTTPException(status_code=500, detail="Database connection unavailable.")

    updates = {}
    if "product_name" in payload: updates["product_name"] = payload["product_name"]
    if "series_name" in payload: updates["series_name"] = payload["series_name"]
    if "brand_name" in payload: updates["brand_name"] = payload["brand_name"]
    if "category" in payload: updates["category"] = payload["category"]
    if "coupon_amount" in payload: updates["coupon_amount"] = float(payload["coupon_amount"])
    if "coupons_used" in payload: updates["coupons_used"] = int(payload["coupons_used"])
    if "notes" in payload: updates["notes"] = payload["notes"]

    try:
        res = client.table("coupons").update(updates).eq("id", coupon_id).execute()
        updated = res.data[0] if res.data else updates
        return {
            "success": True,
            "coupon": updated,
            "message": f"Coupon '{coupon_id}' updated successfully."
        }
    except Exception as exc:
        logger.error(f"Error updating coupon '{coupon_id}': {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.delete("/{coupon_id}", summary="Delete Coupon")
def delete_coupon(
    coupon_id: str,
    current_user: dict = Depends(require_permission("inventory.manage"))
):
    SnapshotService.assert_writable("delete coupon")
    client = get_supabase_client()
    if not client:
        raise HTTPException(status_code=500, detail="Database connection unavailable.")

    try:
        client.table("coupons").delete().eq("id", coupon_id).execute()
        return {
            "success": True,
            "message": f"Coupon '{coupon_id}' deleted successfully."
        }
    except Exception as exc:
        logger.error(f"Error deleting coupon '{coupon_id}': {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
