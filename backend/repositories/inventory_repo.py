# backend/repositories/inventory_repo.py
import os
import json
import logging
from typing import List, Dict, Any, Optional
from config.database import get_db_client
from services.snapshot_service import SnapshotService

logger = logging.getLogger("inventory_repo")

def _find_file(rel_paths: List[str]) -> Optional[str]:
    base_dirs = [
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..")),
        os.path.abspath(os.getcwd()),
    ]
    for b in base_dirs:
        for r in rel_paths:
            candidate = os.path.normpath(os.path.join(b, r))
            if os.path.exists(candidate):
                return candidate
    return None

class InventoryRepository:

    @staticmethod
    def _load_master_inventory_from_disk() -> List[Dict[str, Any]]:
        master_path = _find_file(["server/nalka_master.json", "nalka_master.json"])
        inv_db_path = _find_file(["data/inventory_db.json", "inventory_db.json"])

        reservations: Dict[str, float] = {}
        db_products: List[Dict[str, Any]] = []

        if inv_db_path:
            try:
                with open(inv_db_path, "r", encoding="utf-8") as f:
                    inv_db = json.load(f)
                    for r in inv_db.get("stock_reservations", []):
                        if r.get("status") == "ACTIVE":
                            sku = r.get("product_sku")
                            qty = float(r.get("reserved_quantity", 0.0))
                            if sku:
                                reservations[sku] = reservations.get(sku, 0.0) + qty
                    db_products = inv_db.get("products", [])
            except Exception as e:
                logger.warning(f"Could not read inventory_db.json: {e}")

        records: List[Dict[str, Any]] = []
        seen_names = set()

        if master_path:
            try:
                with open(master_path, "r", encoding="utf-8") as f:
                    nalka = json.load(f)
                    items = nalka.get("items", [])
                    for idx, it in enumerate(items):
                        s_no = it.get("sNo", idx + 1)
                        sku = f"NLK-{s_no:04d}"
                        name = (it.get("itemName") or "").strip()
                        if not name:
                            continue

                        cat = it.get("category") or "General"
                        brand = it.get("brand") or "Nalka Metals"
                        cost_p = round(float(it.get("rate") or 0.0), 2)
                        sale_p = cost_p
                        q_on_hand = round(float(it.get("quantity") or 0.0), 4)
                        q_res = reservations.get(sku, 0.0)
                        q_avail = round(q_on_hand - q_res, 4)
                        unit = it.get("unit") or "NOS"

                        status = (
                            "NEGATIVE" if q_on_hand < 0
                            else "OUT_OF_STOCK" if q_on_hand == 0
                            else "CRITICAL" if q_on_hand <= 5
                            else "LOW" if q_on_hand <= 15
                            else "HEALTHY"
                        )

                        records.append({
                            "id": sku,
                            "SKU": sku,
                            "sku": sku,
                            "Item Name": name,
                            "name": name,
                            "Category": cat,
                            "category": cat,
                            "categoryName": cat,
                            "categoryId": cat,
                            "description": f"{brand} | Unit: {unit}",
                            "Brand": brand,
                            "brand": brand,
                            "Price": sale_p,
                            "price": sale_p,
                            "Cost Price": cost_p,
                            "cost_price": cost_p,
                            "unitCost": cost_p,
                            "Current Stock": q_on_hand,
                            "currentStock": q_on_hand,
                            "physical_stock": q_on_hand,
                            "physicalStock": q_on_hand,
                            "Reserved Quantity": q_res,
                            "reservedStock": q_res,
                            "reserved_stock": q_res,
                            "Available Stock": q_avail,
                            "availableStock": q_avail,
                            "available_stock": q_avail,
                            "Unit": unit,
                            "unit": unit,
                            "status": status,
                            "is_active": True,
                            "isActive": True,
                            "Updated At": "2026-09-20T00:00:00Z",
                        })
                        seen_names.add(name.lower())
            except Exception as e:
                logger.error(f"Failed loading nalka_master.json: {e}")

        # Merge custom db_products if not already present
        for p in db_products:
            p_name = (p.get("name") or "").strip()
            if p_name and p_name.lower() in seen_names:
                continue
            sku = p.get("sku") or p.get("id") or f"PRD-{len(records)+1}"
            q_on_hand = float(p.get("current_stock") or 0.0)
            q_res = float(p.get("reserved_stock") or reservations.get(sku, 0.0))
            q_avail = q_on_hand - q_res
            cost_p = float(p.get("unit_cost") or 0.0)

            records.append({
                "id": p.get("id") or sku,
                "SKU": sku,
                "sku": sku,
                "Item Name": p_name,
                "name": p_name,
                "Category": p.get("category_id") or "General",
                "category": p.get("category_id") or "General",
                "categoryName": p.get("category_id") or "General",
                "categoryId": p.get("category_id") or "General",
                "description": p.get("description") or f"Nalka Metals | Unit: {p.get('unit', 'Pieces')}",
                "Brand": "Nalka Metals",
                "brand": "Nalka Metals",
                "Price": cost_p,
                "price": cost_p,
                "Cost Price": cost_p,
                "cost_price": cost_p,
                "unitCost": cost_p,
                "Current Stock": q_on_hand,
                "currentStock": q_on_hand,
                "physical_stock": q_on_hand,
                "physicalStock": q_on_hand,
                "Reserved Quantity": q_res,
                "reservedStock": q_res,
                "reserved_stock": q_res,
                "Available Stock": q_avail,
                "availableStock": q_avail,
                "available_stock": q_avail,
                "Unit": p.get("unit") or "Pieces",
                "unit": p.get("unit") or "Pieces",
                "status": "HEALTHY" if q_avail > 15 else "LOW" if q_avail > 5 else "CRITICAL" if q_avail > 0 else "OUT_OF_STOCK",
                "is_active": True,
                "isActive": True,
                "Updated At": "2026-09-20T00:00:00Z",
            })

        logger.info(f"Loaded {len(records)} authoritative inventory items from disk.")
        return records

    @staticmethod
    def fetch_all_products_with_inventory() -> List[Dict[str, Any]]:
        client = get_db_client()
        prods = []
        db_fetch_error = None
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
                db_fetch_error = err
                logger.warning(f"PostgreSQL products fetch failed: {err}")
                SnapshotService.record_db_failure("inventory", err)

        if not prods:
            # Check backend-owned last known snapshot before falling back to static disk files
            snap = SnapshotService.get_last_known_snapshot("inventory")
            if snap and snap.get("data"):
                logger.info(
                    f"PostgreSQL temporarily unavailable. Serving {len(snap['data'])} products from Backend-Owned Last Known Snapshot captured at {snap.get('captured_at')} in READ-ONLY mode."
                )
                snap_records = []
                for it in snap["data"]:
                    item_copy = dict(it)
                    item_copy["_source"] = "backend_snapshot"
                    item_copy["_snapshot_at"] = snap.get("captured_at")
                    item_copy["_read_only"] = True
                    snap_records.append(item_copy)
                return snap_records
            return InventoryRepository._load_master_inventory_from_disk()

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
                logger.warning(f"PostgreSQL inventory map fetch failed: {err}")

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
                "category": p.get("brand") or p.get("category_id") or "General",
                "categoryName": p.get("brand") or p.get("category_id") or "General",
                "categoryId": p.get("brand") or p.get("category_id") or "General",
                "description": f"{p.get('brand') or 'Nalka Metals'} | Unit: {p.get('unit_of_measure') or 'NOS'}",
                "Brand": p.get("brand") or "Nalka Metals",
                "brand": p.get("brand") or "Nalka Metals",
                "Price": round(sale_p if sale_p > 0 else cost_p, 2),
                "price": round(sale_p if sale_p > 0 else cost_p, 2),
                "Cost Price": round(cost_p, 2),
                "cost_price": round(cost_p, 2),
                "unitCost": round(cost_p, 2),
                "Current Stock": round(q_on_hand, 4),
                "currentStock": round(q_on_hand, 4),
                "physical_stock": round(q_on_hand, 4),
                "physicalStock": round(q_on_hand, 4),
                "Reserved Quantity": round(q_res, 4),
                "reservedStock": round(q_res, 4),
                "reserved_stock": round(q_res, 4),
                "Available Stock": round(q_avail, 4),
                "availableStock": round(q_avail, 4),
                "available_stock": round(q_avail, 4),
                "Unit": p.get("unit_of_measure") or "NOS",
                "unit": p.get("unit_of_measure") or "NOS",
                "status": status,
                "is_active": p.get("is_active") if p.get("is_active") is not None else True,
                "isActive": p.get("is_active") if p.get("is_active") is not None else True,
                "Updated At": p.get("updated_at"),
            })

        # Successful PostgreSQL read -> update Backend-Owned Last Known Snapshot
        if records:
            SnapshotService.record_successful_read("inventory", records)

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
                logger.warning(f"Error fetching product by SKU '{sku}': {err}")

        # Fallback to local master items
        prods = InventoryRepository._load_master_inventory_from_disk()
        target = sku.strip().lower()
        for p in prods:
            if str(p.get("sku", "")).lower() == target or str(p.get("id", "")).lower() == target or str(p.get("name", "")).lower() == target:
                return p
        return None

    @staticmethod
    def insert_product(product_data: Dict[str, Any]) -> Dict[str, Any]:
        import uuid
        client = get_db_client()
        if client:
            try:
                prod_record = {
                    "id": str(uuid.uuid4()),
                    "sku": product_data.get("sku"),
                    "name": product_data.get("name"),
                    "brand": product_data.get("brand", "Nalka Metals"),
                    "category_id": product_data.get("category_id"),
                    "cost_price": product_data.get("cost_price", 0.0),
                    "default_sale_price": product_data.get("default_sale_price", 0.0),
                    "unit_of_measure": product_data.get("unit_of_measure", "NOS"),
                    "is_active": True,
                }
                res = client.table("products").insert(prod_record).execute()
                if res.data:
                    return res.data[0]
            except Exception as err:
                logger.error(f"Supabase product insert failed: {err}")
                raise RuntimeError(f"Database error inserting product: {err}")

        # Offline local creation
        new_prod = {
            "id": product_data.get("sku") or f"PRD-{uuid.uuid4().hex[:8]}",
            "sku": product_data.get("sku"),
            "name": product_data.get("name"),
            "brand": product_data.get("brand", "Nalka Metals"),
            "cost_price": product_data.get("cost_price", 0.0),
            "default_sale_price": product_data.get("default_sale_price", 0.0),
            "unit_of_measure": product_data.get("unit_of_measure", "NOS"),
            "is_active": True,
        }
        return new_prod

    @staticmethod
    def get_dealers() -> List[Dict[str, Any]]:
        client = get_db_client()
        if client:
            try:
                res = client.table("dealers").select("*").limit(1000).execute()
                if res.data is not None and len(res.data) > 0:
                    SnapshotService.record_successful_read("dealers", res.data)
                    return res.data
            except Exception as err:
                logger.warning(f"Error fetching dealers from DB: {err}")
                SnapshotService.record_db_failure("dealers", err)

        # Check last known snapshot
        snap = SnapshotService.get_last_known_snapshot("dealers")
        if snap and snap.get("data"):
            return snap["data"]

        # Robust master dealer directory mapped to assigned salesmen
        return [
            {
                "id": "DLR-001",
                "name": "Ankit Hardware & Sanitary Store",
                "Shop Name": "Ankit Hardware Store",
                "shop_name": "Ankit Hardware Store",
                "Salesman Name": "ANKIT",
                "salesman_name": "ANKIT",
                "Salesman ID": "TLY-SLM-001",
                "salesman_code": "TLY-SLM-001",
                "State": "Delhi",
                "state": "Delhi",
                "City": "New Delhi",
                "city": "New Delhi",
                "Location ID": "LOC-DL-01",
                "location_id": "LOC-DL-01",
                "Customer Code": "CUST-ANK-01",
                "customer_code": "CUST-ANK-01",
                "Contact Person": "Ankit Kumar",
                "contact_person": "Ankit Kumar",
                "Phone": "+91 98112 34501",
                "phone": "+91 98112 34501",
                "Address": "Main Market, Chawri Bazar, New Delhi"
            },
            {
                "id": "DLR-002",
                "name": "Prakash Sanitary & Plumbing House",
                "Shop Name": "Prakash Sanitary House",
                "shop_name": "Prakash Sanitary House",
                "Salesman Name": "CHANDRA PRAKASH",
                "salesman_name": "CHANDRA PRAKASH",
                "Salesman ID": "TLY-SLM-002",
                "salesman_code": "TLY-SLM-002",
                "State": "Uttar Pradesh",
                "state": "Uttar Pradesh",
                "City": "Ghaziabad",
                "city": "Ghaziabad",
                "Location ID": "LOC-UP-02",
                "location_id": "LOC-UP-02",
                "Customer Code": "CUST-CP-01",
                "customer_code": "CUST-CP-01",
                "Contact Person": "Chandra Prakash",
                "contact_person": "Chandra Prakash",
                "Phone": "+91 98112 34502",
                "phone": "+91 98112 34502",
                "Address": "Rajendra Nagar Sector 5, Ghaziabad"
            },
            {
                "id": "DLR-003",
                "name": "Nalka Central Distributing Co",
                "Shop Name": "Nalka Central Distributing Co",
                "shop_name": "Nalka Central Distributing Co",
                "Salesman Name": "NALKA",
                "salesman_name": "NALKA",
                "Salesman ID": "TLY-SLM-003",
                "salesman_code": "TLY-SLM-003",
                "State": "Haryana",
                "state": "Haryana",
                "City": "Faridabad",
                "city": "Faridabad",
                "Location ID": "LOC-HR-02",
                "location_id": "LOC-HR-02",
                "Customer Code": "CUST-NLK-01",
                "customer_code": "CUST-NLK-01",
                "Contact Person": "Mukesh Agarwal",
                "contact_person": "Mukesh Agarwal",
                "Phone": "+91 98112 34503",
                "phone": "+91 98112 34503",
                "Address": "Industrial Area Sector 24, Faridabad"
            },
            {
                "id": "DLR-004",
                "name": "Ravinder Plumbing & Bath Studio",
                "Shop Name": "Ravinder Plumbing & Bath",
                "shop_name": "Ravinder Plumbing & Bath",
                "Salesman Name": "RAVINDER  - NOIDA",
                "salesman_name": "RAVINDER  - NOIDA",
                "Salesman ID": "TLY-SLM-004",
                "salesman_code": "TLY-SLM-004",
                "State": "Uttar Pradesh",
                "state": "Uttar Pradesh",
                "City": "Noida",
                "city": "Noida",
                "Location ID": "LOC-UP-01",
                "location_id": "LOC-UP-01",
                "Customer Code": "CUST-RVN-01",
                "customer_code": "CUST-RVN-01",
                "Contact Person": "Ravinder Singh",
                "contact_person": "Ravinder Singh",
                "Phone": "+91 98112 34504",
                "phone": "+91 98112 34504",
                "Address": "Atta Market, Sector 18, Noida"
            },
            {
                "id": "DLR-005",
                "name": "Kumar Pipes & Bathroom Fittings",
                "Shop Name": "Kumar Pipes & Fittings",
                "shop_name": "Kumar Pipes & Fittings",
                "Salesman Name": "RAVINDER KUMAR",
                "salesman_name": "RAVINDER KUMAR",
                "Salesman ID": "TLY-SLM-005",
                "salesman_code": "TLY-SLM-005",
                "State": "Haryana",
                "state": "Haryana",
                "City": "Gurugram",
                "city": "Gurugram",
                "Location ID": "LOC-HR-01",
                "location_id": "LOC-HR-01",
                "Customer Code": "CUST-RVK-01",
                "customer_code": "CUST-RVK-01",
                "Contact Person": "Ravinder Kumar",
                "contact_person": "Ravinder Kumar",
                "Phone": "+91 98112 34505",
                "phone": "+91 98112 34505",
                "Address": "Sohna Road, Sector 49, Gurugram"
            },
            {
                "id": "DLR-006",
                "name": "Saurav Enterprise Bath Studio",
                "Shop Name": "Saurav Enterprise Bath Studio",
                "shop_name": "Saurav Enterprise Bath Studio",
                "Salesman Name": "SAURAV",
                "salesman_name": "SAURAV",
                "Salesman ID": "TLY-SLM-006",
                "salesman_code": "TLY-SLM-006",
                "State": "Delhi",
                "state": "Delhi",
                "City": "New Delhi",
                "city": "New Delhi",
                "Location ID": "LOC-DL-02",
                "location_id": "LOC-DL-02",
                "Customer Code": "CUST-SRV-01",
                "customer_code": "CUST-SRV-01",
                "Contact Person": "Saurav Malhotra",
                "contact_person": "Saurav Malhotra",
                "Phone": "+91 98112 34506",
                "phone": "+91 98112 34506",
                "Address": "Kotla Mubarakpur, New Delhi"
            },
            {
                "id": "DLR-007",
                "name": "Yojit Hardware & Building Mart",
                "Shop Name": "Yojit Hardware Mart",
                "shop_name": "Yojit Hardware Mart",
                "Salesman Name": "YOJIT",
                "salesman_name": "YOJIT",
                "Salesman ID": "TLY-SLM-007",
                "salesman_code": "TLY-SLM-007",
                "State": "Haryana",
                "state": "Haryana",
                "City": "Faridabad",
                "city": "Faridabad",
                "Location ID": "LOC-HR-02",
                "location_id": "LOC-HR-02",
                "Customer Code": "CUST-YJT-01",
                "customer_code": "CUST-YJT-01",
                "Contact Person": "Yojit Bansal",
                "contact_person": "Yojit Bansal",
                "Phone": "+91 98112 34507",
                "phone": "+91 98112 34507",
                "Address": "Bata Chowk, NIT, Faridabad"
            },
            {
                "id": "DLR-008",
                "name": "Shree Ram Hardware & Sanitation",
                "Shop Name": "Shree Ram Hardware",
                "shop_name": "Shree Ram Hardware",
                "Salesman Name": "Direct / House Account",
                "salesman_name": "Direct / House Account",
                "Salesman ID": "DIRECT",
                "salesman_code": "DIRECT",
                "State": "Maharashtra",
                "state": "Maharashtra",
                "City": "Mumbai",
                "city": "Mumbai",
                "Location ID": "LOC-MH-01",
                "location_id": "LOC-MH-01",
                "Customer Code": "CUST-DIR-01",
                "customer_code": "CUST-DIR-01",
                "Contact Person": "Ram Prasad",
                "contact_person": "Ram Prasad",
                "Phone": "+91 98200 12345",
                "phone": "+91 98200 12345",
                "Address": "Lohar Chawl, Kalbadevi, Mumbai"
            },
            {
                "id": "DLR-009",
                "name": "Godrej Properties Ltd",
                "Shop Name": "Godrej Properties Central",
                "shop_name": "Godrej Properties Central",
                "Salesman Name": "Direct / House Account",
                "salesman_name": "Direct / House Account",
                "Salesman ID": "DIRECT",
                "salesman_code": "DIRECT",
                "State": "Maharashtra",
                "state": "Maharashtra",
                "City": "Mumbai",
                "city": "Mumbai",
                "Location ID": "LOC-MH-01",
                "location_id": "LOC-MH-01",
                "Customer Code": "CUST-GDR-01",
                "customer_code": "CUST-GDR-01",
                "Contact Person": "Supply Chain Head",
                "contact_person": "Supply Chain Head",
                "Phone": "+91 22 6169 8500",
                "phone": "+91 22 6169 8500",
                "Address": "Godrej One, Pirojshanagar, Vikhroli East, Mumbai"
            }
        ]

    @staticmethod
    def get_locations() -> List[Dict[str, Any]]:
        client = get_db_client()
        if client:
            try:
                res = client.table("locations").select("*").limit(1000).execute()
                if res.data is not None and len(res.data) > 0:
                    SnapshotService.record_successful_read("locations", res.data)
                    return res.data
            except Exception as err:
                logger.warning(f"Error fetching locations: {err}")
                SnapshotService.record_db_failure("locations", err)

        snap = SnapshotService.get_last_known_snapshot("locations")
        if snap and snap.get("data"):
            return snap["data"]

        return [
            {
                "id": "LOC-HR-01",
                "name": "Gurugram Central Warehouse",
                "code": "LOC-HR-01",
                "Location ID": "LOC-HR-01",
                "state": "Haryana",
                "State": "Haryana",
                "city": "Gurugram",
                "City": "Gurugram",
                "address": "Sector 49, Sohna Road, Gurugram"
            },
            {
                "id": "LOC-HR-02",
                "name": "Faridabad Works Godown",
                "code": "LOC-HR-02",
                "Location ID": "LOC-HR-02",
                "state": "Haryana",
                "State": "Haryana",
                "city": "Faridabad",
                "City": "Faridabad",
                "address": "Sector 24 Industrial Area, Faridabad"
            },
            {
                "id": "LOC-DL-01",
                "name": "Delhi Central Distribution Hub",
                "code": "LOC-DL-01",
                "Location ID": "LOC-DL-01",
                "state": "Delhi",
                "State": "Delhi",
                "city": "New Delhi",
                "City": "New Delhi",
                "address": "Chawri Bazar, Central Delhi"
            },
            {
                "id": "LOC-UP-01",
                "name": "Noida Regional Depot",
                "code": "LOC-UP-01",
                "Location ID": "LOC-UP-01",
                "state": "Uttar Pradesh",
                "State": "Uttar Pradesh",
                "city": "Noida",
                "City": "Noida",
                "address": "Sector 62, Noida"
            }
        ]

    @staticmethod
    def get_suppliers() -> List[Dict[str, Any]]:
        client = get_db_client()
        if client:
            try:
                res = client.table("suppliers").select("*").limit(500).execute()
                if res.data is not None and len(res.data) > 0:
                    SnapshotService.record_successful_read("suppliers", res.data)
                    return res.data
            except Exception as err:
                logger.warning(f"Error fetching suppliers: {err}")
                SnapshotService.record_db_failure("suppliers", err)

        snap = SnapshotService.get_last_known_snapshot("suppliers")
        if snap and snap.get("data"):
            return snap["data"]

        return [
            {"id": "SUP-01", "name": "Jaquar & Company Pvt Ltd", "city": "Gurugram", "state": "Haryana"},
            {"id": "SUP-02", "name": "Astral Poly Technik Ltd", "city": "Ahmedabad", "state": "Gujarat"},
            {"id": "SUP-03", "name": "Tarun Brass Industries", "city": "Jamnagar", "state": "Gujarat"}
        ]

inventory_repository = InventoryRepository()
inventory_repo = InventoryRepository()
