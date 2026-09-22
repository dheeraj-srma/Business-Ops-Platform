import logging
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from repositories.inventory_repo import InventoryRepository
from schemas.inventory import ProductCreateSchema, StockAdjustmentSchema

logger = logging.getLogger("inventory_service")

DEFAULT_LOCATION_ID = "92db6a9f-6a52-5df1-5748-70301279a94a"

def is_valid_uuid(val: Any) -> bool:
    if not val or not isinstance(val, str):
        return False
    try:
        uuid.UUID(val)
        return True
    except (ValueError, AttributeError):
        return False

def resolve_location_id(loc_id: Optional[str]) -> Optional[str]:
    if is_valid_uuid(loc_id):
        return loc_id
    return DEFAULT_LOCATION_ID

class InventoryService:

    @staticmethod
    def list_inventory() -> List[Dict[str, Any]]:
        return InventoryRepository.fetch_all_products_with_inventory()

    @staticmethod
    def add_product(product: ProductCreateSchema) -> Dict[str, Any]:
        clean_sku = product.sku.strip().upper()
        existing = InventoryService.get_product_by_sku(clean_sku)
        if existing:
            raise ValueError(f"Product with SKU '{clean_sku}' already exists in the canonical catalog.")

        unit_p = round(float(product.unit_price), 2)
        cost_p = round(float(product.cost_price or product.unit_price), 2)
        qty = round(float(product.quantity), 4)

        prod_data = {
            "sku": clean_sku,
            "name": product.name.strip(),
            "brand": product.brand.strip() if product.brand else "Nalka Metals",
            "cost_price": cost_p,
            "default_sale_price": unit_p,
            "unit_of_measure": product.unit or "NOS",
            "is_active": True,
        }

        created_prod = InventoryRepository.insert_product(prod_data)
        prod_id = created_prod["id"]

        # Insert initial inventory record
        locations = InventoryRepository.get_locations()
        raw_loc_id = locations[0]["id"] if locations else None
        loc_id = resolve_location_id(raw_loc_id)

        from supabase_client import get_supabase_client
        client = get_supabase_client()
        if client:
            inv_data = {
                "product_id": prod_id,
                "location_id": loc_id,
                "quantity_on_hand": 0.0,
                "quantity_reserved": 0.0,
            }
            client.table("inventory").insert(inv_data).execute()

        # Invalidate inventory cache and record initial stock transaction if qty > 0
        InventoryRepository.invalidate_cache()
        if qty > 0:
            from repositories.transaction_repo import TransactionRepository
            TransactionRepository.record_stock_transaction({
                "transaction_type": "inward",
                "product_id": prod_id,
                "location_id": loc_id,
                "quantity": qty,
                "unit_cost": cost_p,
                "reference_type": "inward",
                "notes": f"Initial SKU stock setup for {clean_sku}",
                "created_at": datetime.utcnow().isoformat()
            })

        return {"status": "created", "id": prod_id, "sku": clean_sku}

    @staticmethod
    def get_dealers() -> List[Dict[str, Any]]:
        return InventoryRepository.get_dealers()

    @staticmethod
    def get_suppliers() -> List[Dict[str, Any]]:
        data = InventoryRepository.get_suppliers()
        records = []
        for s in data:
            records.append({
                "Supplier ID": s.get("supplier_code") or s.get("id"),
                "Supplier Name": s.get("name"),
                "Contact Person": s.get("contact_person") or "-",
                "Phone": s.get("phone") or "-",
                "GST Number": s.get("gst_number") or "-",
                "Address": s.get("address") or "-",
                "Status": "Active" if s.get("is_active") else "Inactive",
            })
        return records

    @staticmethod
    def get_product_by_sku(sku: str) -> Optional[Dict[str, Any]]:
        prods = InventoryRepository.fetch_all_products_with_inventory()
        for p in prods:
            if p.get("sku", "").strip().upper() == sku.strip().upper():
                return p
        return None

    @staticmethod
    def adjust_stock(
        product_id: str,
        new_quantity: float,
        reason: str,
        actor: Dict[str, Any],
        location_id: Optional[str] = None
    ) -> Dict[str, Any]:
        from datetime import datetime
        from supabase_client import get_supabase_client
        from repositories.transaction_repo import TransactionRepository

        client = get_supabase_client()
        if not client:
            raise RuntimeError("Database client connection unavailable.")

        # Fetch current inventory row
        inv_res = client.table("inventory").select("*").eq("product_id", product_id).limit(1).execute()
        if not inv_res.data:
            raise ValueError(f"Inventory record for product '{product_id}' not found.")

        current_inv = inv_res.data[0]
        old_on_hand = float(current_inv.get("quantity_on_hand") or 0.0)
        reserved = float(current_inv.get("quantity_reserved") or 0.0)
        new_avail = new_quantity - reserved

        now_str = datetime.utcnow().isoformat()
        target_loc_id = resolve_location_id(location_id or current_inv.get("location_id"))

        # Update physical stock & available stock atomically
        client.table("inventory").update({
            "quantity_on_hand": new_quantity,
            "updated_at": now_str
        }).eq("product_id", product_id).execute()

        # Record audit transaction entry in stock_transactions
        tx_data = {
            "transaction_type": "adjustment",
            "product_id": product_id,
            "location_id": target_loc_id,
            "quantity": new_quantity - old_on_hand,
            "reference_type": "adjustment",
            "notes": f"Manual stock adjustment: {reason}",
            "created_at": now_str
        }
        try:
            TransactionRepository.record_stock_transaction(tx_data)
        except Exception as tx_err:
            logger.warning(f"Transaction ledger log failed during stock adjustment: {tx_err}")

        InventoryRepository.invalidate_cache()

        return {
            "status": "success",
            "product_id": product_id,
            "previous_quantity": old_on_hand,
            "new_quantity": new_quantity,
            "available_quantity": new_avail,
            "timestamp": now_str
        }

    @staticmethod
    def record_stock_in(
        items: List[Dict[str, Any]],
        supplier: Optional[str] = None,
        reference_number: Optional[str] = None,
        reason: Optional[str] = "Stock Inward",
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        from datetime import datetime
        from supabase_client import get_supabase_client
        from repositories.transaction_repo import TransactionRepository
        from repositories.inventory_repo import InventoryRepository

        client = get_supabase_client()
        processed_txs = []
        now_str = datetime.utcnow().isoformat()

        for it in items:
            raw_pid = it.get("product_id") or it.get("productId")
            sku = it.get("sku")
            qty = round(float(it.get("quantity", 0)), 4)
            unit_cost = float(it.get("unit_cost") or it.get("unitCost") or 0.0)
            if (not raw_pid and not sku) or qty <= 0:
                continue

            pid = None
            # Resolve product UUID if passed as SKU string or if invalid UUID
            if is_valid_uuid(raw_pid):
                pid = raw_pid
            elif client:
                search_key = (sku or raw_pid or "").strip().upper()
                if search_key:
                    pres = client.table("products").select("id").eq("sku", search_key).limit(1).execute()
                    if pres.data:
                        pid = pres.data[0]["id"]

            if not pid:
                raise ValueError(f"Product identifier '{raw_pid or sku}' could not be resolved to a valid product in catalog.")

            old_on_hand = 0.0
            reserved = 0.0
            loc_id = None
            if client:
                inv_res = client.table("inventory").select("*").eq("product_id", pid).limit(1).execute()
                if inv_res.data:
                    inv_row = inv_res.data[0]
                    old_on_hand = float(inv_row.get("quantity_on_hand") or 0.0)
                    reserved = float(inv_row.get("quantity_reserved") or 0.0)
                    loc_id = inv_row.get("location_id")

            new_on_hand = old_on_hand + qty

            if client:
                tx = TransactionRepository.record_stock_transaction({
                    "transaction_type": "inward",
                    "product_id": pid,
                    "location_id": resolve_location_id(loc_id),
                    "quantity": qty,
                    "unit_cost": unit_cost,
                    "reference_type": "inward",
                    "reference_id": reference_number if is_valid_uuid(reference_number) else None,
                    "notes": f"{reason or 'Stock Inward'} | Supplier: {supplier or 'Direct Supplier'} | Ref: {reference_number or '-'} | {notes or ''}",
                    "created_at": now_str
                })
                processed_txs.append(tx)

        InventoryRepository.invalidate_cache()

        return {
            "status": "SUCCESS",
            "processed_count": len(processed_txs),
            "transactions": processed_txs
        }

    @staticmethod
    def record_stock_out(
        items: List[Dict[str, Any]],
        recipient: Optional[str] = None,
        reference_number: Optional[str] = None,
        reason: Optional[str] = "Order Fulfillment / Stock Out",
        notes: Optional[str] = None,
        actor: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        from datetime import datetime
        from supabase_client import get_supabase_client
        from repositories.transaction_repo import TransactionRepository
        from repositories.inventory_repo import InventoryRepository

        client = get_supabase_client()
        processed_txs = []
        now_str = datetime.utcnow().isoformat()

        # Sort items deterministically by product ID or SKU to prevent lock inversion deadlocks
        sorted_items = sorted(items, key=lambda it: str(it.get("product_id") or it.get("productId") or it.get("sku") or ""))

        for it in sorted_items:
            raw_pid = it.get("product_id") or it.get("productId")
            sku = it.get("sku")
            qty = round(float(it.get("quantity", 0)), 4)
            if (not raw_pid and not sku) or qty <= 0:
                continue

            pid = None
            if is_valid_uuid(raw_pid):
                pid = raw_pid
            elif client:
                search_key = (sku or raw_pid or "").strip().upper()
                if search_key:
                    pres = client.table("products").select("id").eq("sku", search_key).limit(1).execute()
                    if pres.data:
                        pid = pres.data[0]["id"]

            if not pid:
                raise ValueError(f"Product identifier '{raw_pid or sku}' could not be resolved to a valid product in catalog.")

            # Lock inventory row & check available stock
            old_on_hand = 0.0
            reserved = 0.0
            loc_id = None
            if client:
                inv_res = client.table("inventory").select("*").eq("product_id", pid).limit(1).execute()
                if inv_res.data:
                    inv_row = inv_res.data[0]
                    old_on_hand = float(inv_row.get("quantity_on_hand") or 0.0)
                    reserved = float(inv_row.get("quantity_reserved") or 0.0)
                    loc_id = inv_row.get("location_id")

            avail_stock = old_on_hand - reserved
            if qty > avail_stock:
                raise ValueError(f"INSUFFICIENT_STOCK: Requested stock-out quantity ({qty}) exceeds available stock ({avail_stock}).")

            new_on_hand = old_on_hand - qty

            if client:
                # Record stock out transaction (positive quantity to comply with schema)
                tx = TransactionRepository.record_stock_transaction({
                    "transaction_type": "sale",
                    "product_id": pid,
                    "location_id": resolve_location_id(loc_id),
                    "quantity": qty,
                    "reference_type": "order",
                    "reference_id": reference_number if is_valid_uuid(reference_number) else None,
                    "notes": f"{reason or 'Stock Out'} | Recipient: {recipient or 'Direct'} | Ref: {reference_number or '-'} | {notes or ''}",
                    "created_at": now_str
                })
                processed_txs.append(tx)

                # Set canonical updated stock balance
                client.table("inventory").update({
                    "quantity_on_hand": new_on_hand,
                    "updated_at": now_str
                }).eq("product_id", pid).execute()

        InventoryRepository.invalidate_cache()

        return {
            "status": "SUCCESS",
            "processed_count": len(processed_txs),
            "transactions": processed_txs
        }

    @staticmethod
    def process_return(
        item,
        actor: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        import uuid
        from datetime import datetime
        from supabase_client import get_supabase_client
        from repositories.transaction_repo import TransactionRepository
        from repositories.inventory_repo import InventoryRepository

        client = get_supabase_client()

        client_ref = getattr(item, "client_reference", None) or None
        raw_sku = getattr(item, "sku", None)
        sku_clean = raw_sku.strip().upper() if raw_sku else None

        # 1. Idempotency Check via client_reference or return_code
        if client_ref and client:
            try:
                res = client.table("returns").select("*").or_(
                    f"client_reference.eq.{client_ref},return_code.eq.{client_ref}"
                ).limit(1).execute()
                if res.data:
                    existing = res.data[0]
                    return {
                        "status": "already_processed",
                        "return_id": existing.get("return_code") or existing.get("id"),
                        "client_reference": client_ref,
                        "restocked": existing.get("status") == "Restocked",
                        "idempotent": True,
                        "timestamp": existing.get("created_at") or datetime.utcnow().isoformat()
                    }
            except Exception as e:
                logger.warning(f"Error checking return idempotency in DB: {e}")

        # 2. Resolve Product ID
        prod_id = None
        if sku_clean:
            prod = InventoryService.get_product_by_sku(sku_clean)
            if prod:
                prod_id = prod.get("id")

        if not prod_id and item.item_name:
            prods = InventoryRepository.fetch_all_products_with_inventory()
            for p in prods:
                if p.get("name", "").strip().lower() == item.item_name.strip().lower():
                    prod_id = p.get("id")
                    if not sku_clean:
                        sku_clean = p.get("sku")
                    break

        if not prod_id and client:
            try:
                if sku_clean:
                    pres = client.table("products").select("id").eq("sku", sku_clean).limit(1).execute()
                    if pres.data:
                        prod_id = pres.data[0]["id"]
                if not prod_id and item.item_name:
                    pres = client.table("products").select("id").eq("name", item.item_name).limit(1).execute()
                    if pres.data:
                        prod_id = pres.data[0]["id"]
            except Exception as e:
                logger.warning(f"DB product lookup failed: {e}")

        if not prod_id:
            raise ValueError(f"Product with SKU '{raw_sku or item.item_name}' not found in canonical catalog.")

        # 3. Optional Original Order Return Eligibility Check
        order_id = getattr(item, "order_id", None)
        if order_id and client:
            try:
                line_res = client.table("pending_order_items").select("quantity").eq("order_id", order_id).limit(100).execute()
                if line_res.data:
                    total_ordered = sum(float(l.get("quantity") or 0) for l in line_res.data)
                    prev_returns_res = client.table("returns").select("quantity").eq("order_id", order_id).execute()
                    prev_returned = sum(int(r.get("quantity") or 0) for r in (prev_returns_res.data or []))
                    eligible_qty = total_ordered - prev_returned
                    if item.quantity > eligible_qty:
                        raise ValueError(f"Return quantity ({item.quantity}) exceeds remaining eligible order return quantity ({eligible_qty}).")
            except ValueError:
                raise
            except Exception as err:
                logger.warning(f"Order return eligibility check failed: {err}")

        # 4. Inventory Lock & Stock Restock Calculation
        old_on_hand = 0.0
        reserved = 0.0
        loc_id = None

        if client:
            inv_res = client.table("inventory").select("*").eq("product_id", prod_id).limit(1).execute()
            if inv_res.data:
                inv_row = inv_res.data[0]
                old_on_hand = float(inv_row.get("quantity_on_hand") or 0.0)
                reserved = float(inv_row.get("quantity_reserved") or 0.0)
                loc_id = inv_row.get("location_id")

        cond_clean = item.condition.strip().lower()
        is_good = "good" in cond_clean or cond_clean == "restocked"
        status_str = "Restocked" if is_good else "Defective"
        ret_code = f"RET-{uuid.uuid4().hex[:8].upper()}"
        now_str = datetime.utcnow().isoformat()

        new_on_hand = old_on_hand
        new_avail = old_on_hand - reserved

        if is_good:
            new_on_hand = old_on_hand + float(item.quantity)
            new_avail = new_on_hand - reserved

            if client:
                client.table("inventory").update({
                    "quantity_on_hand": new_on_hand,
                    "updated_at": now_str
                }).eq("product_id", prod_id).execute()

                # Record positive stock movement in ledger
                TransactionRepository.record_stock_transaction({
                    "transaction_type": "return_in",
                    "product_id": prod_id,
                    "location_id": resolve_location_id(loc_id),
                    "quantity": float(item.quantity),
                    "unit_cost": float(item.price),
                    "reference_type": "return",
                    "reference_id": ret_code if is_valid_uuid(ret_code) else None,
                    "notes": f"Restocked from return {ret_code} | Reason: {item.reason}",
                    "created_at": now_str
                })

        # 5. Insert Return Record
        ret_data = {
            "return_code": ret_code,
            "client_reference": client_ref or ret_code,
            "order_id": order_id,
            "customer_name": item.customer_name,
            "location_name": item.location,
            "sku": sku_clean or raw_sku,
            "item_name": item.item_name,
            "category": item.category,
            "price": round(float(item.price), 2),
            "quantity": int(item.quantity),
            "condition": "Good Return" if is_good else "Defective Return",
            "reason": item.reason,
            "status": status_str,
            "created_at": now_str
        }

        TransactionRepository.insert_return(ret_data)

        return {
            "status": "created",
            "return_id": ret_code,
            "client_reference": client_ref or ret_code,
            "restocked": is_good,
            "previous_quantity": old_on_hand,
            "new_quantity": new_on_hand,
            "available_quantity": new_avail,
            "idempotent": False,
            "timestamp": now_str
        }

    @staticmethod
    def get_restock_plan(
        multiplier: float = 2.0,
        category_id: Optional[str] = None,
        status_filter: Optional[str] = None
    ) -> Dict[str, Any]:
        import math
        prods = InventoryService.list_inventory()
        target_multiplier = max(1.1, float(multiplier or 2.0))

        items_to_restock = []
        total_negative_deficit_units = 0.0
        total_restock_units = 0.0
        estimated_total_restock_cost = 0.0

        negative_count = 0
        out_of_stock_count = 0
        critical_count = 0
        low_count = 0

        category_breakdown_map: Dict[str, Dict[str, Any]] = {}

        for prod in prods:
            if not prod.get("is_active", True):
                continue

            physical_stock = float(prod.get("currentStock", prod.get("physical_stock", 0.0)))
            reserved_stock = float(prod.get("reservedStock", prod.get("reserved_stock", 0.0)))
            available_stock = float(prod.get("availableStock", prod.get("available_stock", physical_stock - reserved_stock)))
            min_stock = float(prod.get("minimumStock", prod.get("min_stock", 15.0)))
            crit_stock = float(prod.get("criticalStock", prod.get("crit_stock", 5.0)))
            item_status = str(prod.get("status", "HEALTHY")).upper()

            needs_restock = item_status in ["NEGATIVE", "OUT_OF_STOCK", "CRITICAL", "LOW"]
            if not needs_restock:
                continue

            if item_status == "NEGATIVE":
                negative_count += 1
                total_negative_deficit_units += abs(physical_stock)
            elif item_status == "OUT_OF_STOCK":
                out_of_stock_count += 1
            elif item_status == "CRITICAL":
                critical_count += 1
            elif item_status == "LOW":
                low_count += 1

            # Target stock formula: Target = max(Min * multiplier, Min + 5)
            target_stock = math.ceil(max(min_stock * target_multiplier, min_stock + 5.0))
            reorder_quantity = max(0.0, target_stock - available_stock)
            unit_cost = float(prod.get("unitCost", prod.get("cost_price", 0.0)))
            estimated_cost = round(reorder_quantity * unit_cost, 2)

            total_restock_units += reorder_quantity
            estimated_total_restock_cost += estimated_cost

            if item_status == "NEGATIVE":
                urgency = "EMERGENCY"
                reorder_reason = f"Negative physical stock ({physical_stock} {prod.get('unit', 'NOS')}). Immediate replenishment needed to clear deficit."
            elif item_status == "OUT_OF_STOCK":
                urgency = "CRITICAL"
                reorder_reason = f"Zero stock on floor. Requires {reorder_quantity} {prod.get('unit', 'NOS')} to restore safe operating level ({target_stock})."
            elif item_status == "CRITICAL":
                urgency = "CRITICAL"
                reorder_reason = f"Stock ({physical_stock}) is at or below critical threshold ({crit_stock}). Requires {reorder_quantity} {prod.get('unit', 'NOS')}."
            else:
                urgency = "MEDIUM"
                reorder_reason = f"Stock ({physical_stock}) is below minimum safe threshold ({min_stock}). Requires {reorder_quantity} {prod.get('unit', 'NOS')}."

            cat_id = str(prod.get("categoryId") or prod.get("category") or "General")
            cat_name = str(prod.get("categoryName") or prod.get("Category") or cat_id)

            if cat_id not in category_breakdown_map:
                category_breakdown_map[cat_id] = {
                    "name": cat_name,
                    "count": 0,
                    "restockUnits": 0.0,
                    "estimatedCost": 0.0,
                }
            category_breakdown_map[cat_id]["count"] += 1
            category_breakdown_map[cat_id]["restockUnits"] += reorder_quantity
            category_breakdown_map[cat_id]["estimatedCost"] += estimated_cost

            items_to_restock.append({
                "id": str(prod.get("id")),
                "sku": str(prod.get("sku")),
                "name": str(prod.get("name")),
                "categoryId": cat_id,
                "categoryName": cat_name,
                "unit": str(prod.get("unit", "NOS")),
                "unitCost": unit_cost,
                "physicalStock": physical_stock,
                "reservedStock": reserved_stock,
                "availableStock": available_stock,
                "minimumStock": min_stock,
                "criticalStock": crit_stock,
                "targetStock": target_stock,
                "deficit": max(0.0, -physical_stock),
                "reorderQuantity": reorder_quantity,
                "estimatedCost": estimated_cost,
                "status": item_status,
                "urgency": urgency,
                "reorderReason": reorder_reason,
            })

        filtered_items = items_to_restock
        if category_id and category_id.lower() != "all":
            filtered_items = [i for i in filtered_items if i["categoryId"] == category_id or i["categoryName"] == category_id]
        if status_filter and status_filter.lower() != "all":
            filtered_items = [i for i in filtered_items if i["status"].upper() == status_filter.upper()]

        urgency_weight = {"EMERGENCY": 3, "CRITICAL": 2, "MEDIUM": 1}
        filtered_items.sort(key=lambda x: (urgency_weight.get(x["urgency"], 0), x["estimatedCost"]), reverse=True)

        return {
            "summary": {
                "totalItemsToRestock": len(items_to_restock),
                "negativeCount": negative_count,
                "outOfStockCount": out_of_stock_count,
                "criticalCount": critical_count,
                "lowCount": low_count,
                "totalNegativeDeficitUnits": round(total_negative_deficit_units, 2),
                "totalRestockUnits": round(total_restock_units, 2),
                "estimatedTotalRestockCost": round(estimated_total_restock_cost, 2),
                "targetMultiplier": target_multiplier,
            },
            "categoryBreakdown": sorted(list(category_breakdown_map.values()), key=lambda x: x["estimatedCost"], reverse=True),
            "items": filtered_items,
        }

    @staticmethod
    def bulk_restock(data: Dict[str, Any], actor: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        import time
        items = data.get("items", [])
        supplier = data.get("supplier", "Bulk Consignment Supplier")
        ref = data.get("referenceNumber", f"PO-{int(time.time())}")
        notes = data.get("notes", "")
        reason = data.get("reason", "Bulk Restock Purchase Order")

        res = InventoryService.record_stock_in(
            items=items,
            supplier=supplier,
            reference_number=ref,
            reason=reason,
            notes=notes
        )
        return {
            "success": True,
            "processedCount": len(items),
            "transactions": res.get("transactions", [])
        }

inventory_service = InventoryService()


