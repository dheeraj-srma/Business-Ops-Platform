# backend/services/inventory_service.py
import logging
from typing import List, Dict, Any, Optional
from repositories.inventory_repo import InventoryRepository
from schemas.inventory import ProductCreateSchema, StockAdjustmentSchema

logger = logging.getLogger("inventory_service")

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
        loc_id = locations[0]["id"] if locations else None

        from supabase_client import get_supabase_client
        client = get_supabase_client()
        inv_data = {
            "product_id": prod_id,
            "location_id": loc_id,
            "quantity_on_hand": qty,
            "quantity_reserved": 0.0,
            "quantity_available": qty,
        }
        client.table("inventory").insert(inv_data).execute()

        return {"status": "created", "id": prod_id, "sku": product.sku}

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

        # Update physical stock & available stock atomically
        client.table("inventory").update({
            "quantity_on_hand": new_quantity,
            "quantity_available": new_avail,
            "updated_at": now_str
        }).eq("product_id", product_id).execute()

        # Record audit transaction entry in stock_transactions
        tx_data = {
            "transaction_type": "ADJUSTMENT",
            "product_id": product_id,
            "location_id": location_id or current_inv.get("location_id"),
            "quantity": new_quantity - old_on_hand,
            "reference_type": "manual_adjustment",
            "notes": f"Manual stock adjustment: {reason}",
            "created_at": now_str
        }
        try:
            TransactionRepository.record_stock_transaction(tx_data)
        except Exception as tx_err:
            logger.warning(f"Transaction ledger log failed during stock adjustment: {tx_err}")

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
        from repositories.transaction_repo import transaction_repository
        from repositories.inventory_repo import inventory_repository

        processed_txs = []
        for it in items:
            pid = it.get("product_id") or it.get("productId")
            qty = round(float(it.get("quantity", 0)), 4)
            if not pid or qty <= 0:
                continue

            # Record stock in transaction
            tx = transaction_repository.record_transaction(
                product_id=pid,
                transaction_type="STOCK_IN",
                quantity=qty,
                reason=reason or "Stock Inward",
                supplier_or_recipient=supplier or "Direct Supplier",
                reference_number=reference_number or "REC-IN",
                notes=notes
            )
            processed_txs.append(tx)

        return {
            "status": "SUCCESS",
            "transactions": processed_txs
        }

inventory_service = InventoryService()

