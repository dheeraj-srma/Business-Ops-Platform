# backend/repositories/inventory_repo.py
import logging
from typing import List, Dict, Any, Optional
from config.database import get_db_client

logger = logging.getLogger("inventory_repo")

class InventoryRepository:

    @staticmethod
    def fetch_all_products_with_inventory() -> List[Dict[str, Any]]:
        client = get_db_client()
        prods = []
        if client:
            try:
                offset = 0
                while True:
                    res = client.table("products").select(
                        "id, sku, name, brand, category_id, cost_price, default_sale_price, unit_of_measure, is_active, updated_at"
                    ).range(offset, offset + 999).execute()
                    batch = res.data or []
                    if not batch:
                        break
                    prods.extend(batch)
                    if len(batch) < 1000:
                        break
                    offset += 1000
            except Exception as err:
                logger.error(f"PostgreSQL products fetch failed: {err}")

        if not prods:
            return []

        inv_map = {}
        if client:
            try:
                offset = 0
                while True:
                    res = client.table("inventory").select(
                        "product_id, quantity_on_hand, quantity_reserved, quantity_available"
                    ).range(offset, offset + 999).execute()
                    batch = res.data or []
                    if not batch:
                        break
                    for row in batch:
                        inv_map[row["product_id"]] = row
                    if len(batch) < 1000:
                        break
                    offset += 1000
            except Exception as err:
                logger.error(f"PostgreSQL inventory map fetch failed: {err}")

        records = []
        seen_keys = set()
        for p in prods:
            pkey = p.get("id") or p.get("sku")
            if pkey and pkey in seen_keys:
                continue
            if pkey:
                seen_keys.add(pkey)

            inv_row = inv_map.get(p["id"])
            q_on_hand = float(inv_row["quantity_on_hand"]) if inv_row else float(p.get("currentStock") or 0.0)
            q_res = float(inv_row["quantity_reserved"]) if inv_row else float(p.get("reservedStock") or 0.0)
            q_avail = float(inv_row["quantity_available"]) if inv_row else (q_on_hand - q_res)
            cost_p = float(p.get("cost_price") or 0.0)
            sale_p = float(p.get("default_sale_price") or cost_p or 0.0)

            status = (
                "NEGATIVE" if q_on_hand < 0
                else "OUT_OF_STOCK" if q_on_hand == 0
                else "CRITICAL" if q_on_hand <= 5
                else "LOW" if q_on_hand <= 15
                else "HEALTHY"
            )

            records.append({
                "id": p.get("id"),
                "SKU": p.get("sku"),
                "sku": p.get("sku"),
                "Item Name": p.get("name"),
                "name": p.get("name"),
                "Category": p.get("brand") or p.get("category_id") or "General",
                "categoryName": p.get("brand") or p.get("category_id") or "General",
                "categoryId": p.get("brand") or p.get("category_id") or "General",
                "description": f"{p.get('brand') or 'Nalka Metals'} | Unit: {p.get('unit_of_measure') or 'NOS'}",
                "Brand": p.get("brand") or "Nalka Metals",
                "Price": round(sale_p if sale_p > 0 else cost_p, 2),
                "Cost Price": round(cost_p, 2),
                "unitCost": round(cost_p, 2),
                "Current Stock": round(q_on_hand, 4),
                "currentStock": round(q_on_hand, 4),
                "Reserved Quantity": round(q_res, 4),
                "reservedStock": round(q_res, 4),
                "Available Stock": round(q_avail, 4),
                "availableStock": round(q_avail, 4),
                "Unit": p.get("unit_of_measure") or "NOS",
                "unit": p.get("unit_of_measure") or "NOS",
                "status": status,
                "is_active": p.get("is_active") if p.get("is_active") is not None else True,
                "isActive": p.get("is_active") if p.get("is_active") is not None else True,
                "Updated At": p.get("updated_at"),
            })
        return records

    @staticmethod
    def get_product_by_sku(sku: str) -> Optional[Dict[str, Any]]:
        client = get_db_client()
        if client:
            try:
                res = client.table("products").select("*").eq("sku", sku).limit(1).execute()
                if res.data:
                    return res.data[0]
            except Exception as err:
                logger.error(f"Error fetching product by SKU '{sku}': {err}")
        return None

    @staticmethod
    def insert_product(product_data: Dict[str, Any]) -> Dict[str, Any]:
        import uuid
        if "id" not in product_data:
            product_data["id"] = str(uuid.uuid4())
        client = get_db_client()
        if client:
            try:
                res = client.table("products").insert(product_data).execute()
                if res.data:
                    return res.data[0]
            except Exception as err:
                logger.error(f"Supabase product insert failed: {err}")
                raise RuntimeError(f"Database error inserting product: {err}")

        raise RuntimeError("Database connection unavailable.")

    @staticmethod
    def get_dealers() -> List[Dict[str, Any]]:
        client = get_db_client()
        if client:
            try:
                res = client.table("dealers").select("*").limit(1000).execute()
                if res.data is not None:
                    return res.data
            except Exception as err:
                logger.error(f"Error fetching dealers: {err}")
        return []

    @staticmethod
    def get_locations() -> List[Dict[str, Any]]:
        client = get_db_client()
        if client:
            try:
                res = client.table("locations").select("*").limit(1000).execute()
                if res.data is not None:
                    return res.data
            except Exception as err:
                logger.error(f"Error fetching locations: {err}")
        return []

    @staticmethod
    def get_suppliers() -> List[Dict[str, Any]]:
        client = get_db_client()
        if client:
            try:
                res = client.table("suppliers").select("*").limit(500).execute()
                if res.data is not None:
                    return res.data
            except Exception as err:
                logger.error(f"Error fetching suppliers: {err}")
        return []

inventory_repository = InventoryRepository()
inventory_repo = InventoryRepository()
