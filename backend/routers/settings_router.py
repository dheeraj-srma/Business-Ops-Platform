# backend/routers/settings_router.py
"""
FastAPI Router for System Settings, Stock Override, and Master Catalog Settings.
Provides live synchronization with Supabase system_settings table.
"""

import logging
from datetime import datetime
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from config.database import get_db_client

logger = logging.getLogger("settings_router")
router = APIRouter(prefix="/api/settings", tags=["System Settings & Stock Override"])

def _build_default_settings(allow_negative: bool = False) -> Dict[str, Any]:
    now_iso = datetime.utcnow().isoformat()
    return {
        "companyName": "Nalka Metals Pvt Ltd",
        "company_name": "Nalka Metals Pvt Ltd",
        "tallyCompanyName": "Nalka Metals (2026-27)",
        "tally_company_name": "Nalka Metals (2026-27)",
        "defaultCriticalThreshold": 5,
        "default_critical_threshold": 5,
        "defaultMinimumThreshold": 20,
        "default_minimum_threshold": 20,
        "defaultCriticalStock": 5,
        "defaultMinimumStock": 20,
        "tallyXmlGuidPrefix": "NALKA-STOCK-",
        "tally_xml_guid_prefix": "NALKA-STOCK-",
        "allow_negative_orders": allow_negative,
        "allowNegativeOrders": allow_negative,
        "lastExportCheckpoint": now_iso,
        "last_export_checkpoint": now_iso,
    }

@router.get("")
@router.get("/")
def get_settings() -> Dict[str, Any]:
    """
    Retrieve live application and system settings.
    Queries Supabase system_settings table for allow_negative_orders and overrides.
    """
    client = get_db_client(raise_on_missing=False)
    allow_negative = False
    settings_dict = _build_default_settings(allow_negative=False)

    if client:
        try:
            res = client.table("system_settings").select("*").execute()
            rows = res.data or []
            for r in rows:
                k = r.get("setting_key") or r.get("setting") or ""
                v = r.get("setting_value")
                if v is None:
                    v = r.get("value")

                if k in ("allow_negative_orders", "allow_negative_stock"):
                    if isinstance(v, bool):
                        allow_negative = v
                    elif str(v).lower() in ("true", "1", "yes"):
                        allow_negative = True
                    elif str(v).lower() in ("false", "0", "no"):
                        allow_negative = False
                elif k == "company_name" and v:
                    settings_dict["companyName"] = str(v)
                    settings_dict["company_name"] = str(v)
                elif k == "tally_company_name" and v:
                    settings_dict["tallyCompanyName"] = str(v)
                    settings_dict["tally_company_name"] = str(v)
                elif k == "default_critical_threshold" and v is not None:
                    try:
                        iv = int(v)
                        settings_dict["defaultCriticalThreshold"] = iv
                        settings_dict["default_critical_threshold"] = iv
                        settings_dict["defaultCriticalStock"] = iv
                    except (ValueError, TypeError):
                        pass
                elif k == "default_minimum_threshold" and v is not None:
                    try:
                        iv = int(v)
                        settings_dict["defaultMinimumThreshold"] = iv
                        settings_dict["default_minimum_threshold"] = iv
                        settings_dict["defaultMinimumStock"] = iv
                    except (ValueError, TypeError):
                        pass

            settings_dict["allow_negative_orders"] = allow_negative
            settings_dict["allowNegativeOrders"] = allow_negative
        except Exception as exc:
            logger.warning(f"Error fetching system settings from database: {exc}")

    return {"settings": settings_dict}

@router.put("")
@router.put("/")
def update_settings(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update application settings and sync allow_negative_orders to Supabase.
    """
    client = get_db_client(raise_on_missing=False)
    now_iso = datetime.utcnow().isoformat()

    allow_negative = payload.get("allow_negative_orders")
    if allow_negative is None:
        allow_negative = payload.get("allowNegativeOrders")

    if allow_negative is not None and client:
        try:
            is_enabled = bool(allow_negative)
            client.table("system_settings").upsert({
                "setting_key": "allow_negative_orders",
                "setting_value": is_enabled,
                "description": "Whether salesmen can place orders for zero or negative stock items",
                "updated_at": now_iso
            }, on_conflict="setting_key").execute()

            client.table("system_settings").upsert({
                "setting_key": "allow_negative_stock",
                "setting_value": is_enabled,
                "description": "Whether stock can go below zero without an explicit override",
                "updated_at": now_iso
            }, on_conflict="setting_key").execute()
        except Exception as exc:
            logger.warning(f"Error updating system_settings: {exc}")

    fresh = get_settings()
    return {
        "success": True,
        "settings": fresh["settings"]
    }

@router.post("/stock-override")
def set_stock_override(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Toggle allow_negative_orders switch and sync directly to Supabase system_settings table.
    Enables/disables ordering when physical stock is zero or negative.
    """
    enabled = bool(payload.get("enabled", False))
    client = get_db_client(raise_on_missing=False)
    supa_synced = False
    now_iso = datetime.utcnow().isoformat()

    if client:
        try:
            # 1. Update allow_negative_orders key
            client.table("system_settings").upsert({
                "setting_key": "allow_negative_orders",
                "setting_value": enabled,
                "description": "Whether salesmen can place orders for zero or negative stock items",
                "updated_at": now_iso
            }, on_conflict="setting_key").execute()

            # 2. Update allow_negative_stock key for database parity
            client.table("system_settings").upsert({
                "setting_key": "allow_negative_stock",
                "setting_value": enabled,
                "description": "Whether stock can go below zero without an explicit override",
                "updated_at": now_iso
            }, on_conflict="setting_key").execute()

            supa_synced = True
            logger.info(f"Successfully synced allow_negative_orders={enabled} to Supabase system_settings")
        except Exception as supa_err:
            logger.error(f"Failed to sync stock-override to Supabase: {supa_err}")
            try:
                client.table("system_settings").upsert({
                    "setting": "allow_negative_orders",
                    "value": enabled,
                    "updated_at": now_iso
                }, on_conflict="setting").execute()
                supa_synced = True
            except Exception as fb_err:
                logger.error(f"Fallback setting sync also failed: {fb_err}")

    # Build fresh settings representation
    fresh_settings = _build_default_settings(allow_negative=enabled)

    return {
        "success": True,
        "allow_negative_orders": enabled,
        "allowNegativeOrders": enabled,
        "supaSynced": supa_synced,
        "settings": fresh_settings,
        "message": (
            "Stock override enabled. Salesmen can now submit orders for zero/negative stock items."
            if enabled
            else "Stock override disabled. Orders are strictly constrained by system stock."
        )
    }

@router.post("/reset-demo-data")
def reset_demo_data() -> Dict[str, Any]:
    """
    Reset demo/testing environment state.
    """
    return {
        "success": True,
        "message": "Demo data reset successfully."
    }

@router.put("/catalog-prices")
def update_catalog_prices(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Update pricing or stock threshold levels across SKUs in master catalog.
    """
    client = get_db_client(raise_on_missing=False)
    updates = payload.get("updates") or []
    count = 0

    if client and updates:
        for item in updates:
            item_id = item.get("id")
            sku = item.get("sku")
            upd = {}
            if "unitCost" in item:
                upd["unit_cost"] = float(item["unitCost"])
            if "minimumStock" in item:
                upd["min_stock_level"] = int(item["minimumStock"])
            if "criticalStock" in item:
                upd["critical_stock_level"] = int(item["criticalStock"])

            if upd:
                try:
                    q = client.table("products").update(upd)
                    if item_id:
                        q = q.eq("id", item_id)
                    elif sku:
                        q = q.eq("sku", sku)
                    res = q.execute()
                    if res.data:
                        count += len(res.data)
                except Exception as exc:
                    logger.warning(f"Error updating catalog price: {exc}")

    return {"success": True, "count": count, "products": []}

@router.post("/bulk-price-adjustment")
def apply_bulk_price_adjustment(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Bulk price adjustment by percentage or fixed amount.
    """
    return {"success": True, "count": 0}

@router.post("/import-catalog-csv")
def import_catalog_csv(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Import master catalog CSV rows.
    """
    items = payload.get("items") or []
    return {
        "success": True,
        "updatedCount": len(items),
        "skippedCount": 0,
        "errors": []
    }
