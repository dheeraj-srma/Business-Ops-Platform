"""
Reconciliation Service
Enforces the core stock invariant:
  inventory.current_stock == SUM(inventory_transactions.quantity)

Audits live balance fields against the authoritative transaction ledger,
detects discrepancies, and provides reconciliation fix workflows.
"""
from typing import Dict, Any, List, Optional
from repositories.inventory_repo import inventory_repository
from repositories.transaction_repo import transaction_repository
from services.audit_service import audit_service

class ReconciliationService:
    @staticmethod
    def _calculate_ledger_stock(transactions: List[Dict[str, Any]]) -> float:
        total = 0.0
        for tx in transactions:
            qty = float(tx.get("quantity", 0))
            tx_type = tx.get("transactionType") or tx.get("transaction_type")
            if tx_type in ("STOCK_OUT", "ADJUSTMENT_DECREASE"):
                total -= abs(qty)
            else:
                total += abs(qty)
        return total

    @staticmethod
    def compute_reconciliation_report(products: List[Dict[str, Any]], transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
        tx_by_pid: Dict[str, List[Dict[str, Any]]] = {}
        for tx in transactions:
            pid = tx.get("product_id") or tx.get("productId")
            if pid:
                tx_by_pid.setdefault(pid, []).append(tx)

        discrepancies = []
        for p in products:
            pid = p.get("id")
            current = float(p.get("current_stock") or p.get("currentStock") or 0.0)
            p_txs = tx_by_pid.get(pid, [])
            ledger_sum = ReconciliationService._calculate_ledger_stock(p_txs)
            variance = current - ledger_sum
            if round(variance, 4) != 0.0:
                discrepancies.append({
                    "product_id": pid,
                    "sku": p.get("sku"),
                    "name": p.get("name"),
                    "current_stock": current,
                    "ledger_sum": ledger_sum,
                    "variance": variance
                })

        return {
            "total_products_checked": len(products),
            "discrepancy_count": len(discrepancies),
            "discrepancies": discrepancies
        }

    def audit_inventory_invariant(self) -> Dict[str, Any]:

        """
        Audits all products to compare materialized `current_stock`
        against the sum of historical ledger transactions.
        """
        products = inventory_repository.get_all_products()
        transactions = transaction_repository.list_transactions(limit=10000)

        # Calculate transaction sums per product ID
        ledger_sums: Dict[str, float] = {}
        for tx in transactions:
            pid = tx.get("productId") or tx.get("product_id")
            if pid:
                qty = float(tx.get("quantity", 0))
                # If quantity is not pre-signed by transaction_type, calculate signed delta
                tx_type = tx.get("transactionType") or tx.get("transaction_type")
                if tx_type in ("STOCK_OUT", "ADJUSTMENT_DECREASE"):
                    delta = -abs(qty)
                else:
                    delta = abs(qty)
                ledger_sums[pid] = ledger_sums.get(pid, 0.0) + delta

        audited_items: List[Dict[str, Any]] = []
        discrepant_count = 0
        total_products = len(products)

        for p in products:
            pid = p["id"]
            current_balance = round(float(p.get("current_stock") or p.get("currentStock") or 0.0), 4)
            ledger_balance = round(ledger_sums.get(pid, 0.0), 4)
            discrepancy = round(current_balance - ledger_balance, 4)
            is_valid = (discrepancy == 0.0)

            if not is_valid:
                discrepant_count += 1

            audited_items.append({
                "product_id": pid,
                "sku": p.get("sku"),
                "product_name": p.get("name"),
                "materialized_balance": current_balance,
                "ledger_sum_balance": ledger_balance,
                "discrepancy": discrepancy,
                "is_invariant_valid": is_valid
            })

        return {
            "status": "HEALTHY" if discrepant_count == 0 else "DISCREPANCY_DETECTED",
            "total_products_audited": total_products,
            "discrepant_products_count": discrepant_count,
            "items": audited_items
        }

    def fix_inventory_discrepancy(
        self,
        product_id: str,
        actor_id: str,
        actor_email: str,
        actor_role: str,
        correlation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Fixes a product's materialized current_stock by setting it
        to match the authoritative transaction ledger sum.
        """
        audit_res = self.audit_inventory_invariant()
        target_item = next((it for it in audit_res["items"] if it["product_id"] == product_id), None)

        if not target_item:
            raise ValueError(f"Product ID '{product_id}' not found.")

        if target_item["is_invariant_valid"]:
            return {
                "message": "No reconciliation required. Invariant is already valid.",
                "item": target_item
            }

        before_state = {"current_stock": target_item["materialized_balance"]}
        new_balance = target_item["ledger_sum_balance"]

        # Update product stock in repo
        updated_prod = inventory_repository.update_product_stock(product_id, new_balance)
        after_state = {"current_stock": new_balance}

        # Audit event
        audit_service.record_audit(
            actor_id=actor_id,
            actor_email=actor_email,
            actor_role=actor_role,
            action="RECONCILE_INVENTORY_INVARIANT",
            entity_type="PRODUCT",
            entity_id=product_id,
            before_state=before_state,
            after_state=after_state,
            correlation_id=correlation_id
        )

        return {
            "message": f"Successfully reconciled stock balance to ledger truth ({new_balance} units).",
            "product": updated_prod,
            "reconciliation_detail": target_item
        }

reconciliation_service = ReconciliationService()
