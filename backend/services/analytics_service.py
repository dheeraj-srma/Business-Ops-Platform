# backend/services/analytics_service.py
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from repositories.inventory_repo import InventoryRepository
from repositories.order_repo import OrderRepository
from repositories.transaction_repo import TransactionRepository
from repositories.dealer_repo import DealerRepository
from repositories.supplier_repo import SupplierRepository

logger = logging.getLogger("analytics_service")

class AnalyticsService:

    @staticmethod
    def get_dashboard_stats(days: int = 7, start_date: Optional[str] = None, end_date: Optional[str] = None) -> Dict[str, Any]:
        inv = InventoryRepository.fetch_all_products_with_inventory()
        active_products = [p for p in inv if p.get("is_active", True) or p.get("isActive", True)]
        total_products = len(inv)
        total_active_skus = len(active_products)
        total_units = sum(float(item.get("Current Stock") or item.get("currentStock") or 0.0) for item in active_products)
        total_stock_val = sum(
            float(item.get("Current Stock") or item.get("currentStock") or 0.0) * 
            float(item.get("Cost Price") or item.get("unitCost") or item.get("Price") or 0.0)
            for item in active_products
        )
        
        healthy_count = 0
        low_stock_count = 0
        critical_stock_count = 0
        out_of_stock_count = 0
        negative_stock_count = 0
        low_stock_items = []

        for p in active_products:
            stock = float(p.get("Current Stock") or p.get("currentStock") or 0.0)
            min_stock = float(p.get("minimum_stock") or p.get("minimumStock") or 15.0)
            crit_stock = float(p.get("critical_stock") or p.get("criticalStock") or 5.0)

            status = p.get("status")
            if not status:
                if stock < 0:
                    status = "NEGATIVE"
                elif stock == 0:
                    status = "OUT_OF_STOCK"
                elif stock <= crit_stock:
                    status = "CRITICAL"
                elif stock <= min_stock:
                    status = "LOW"
                else:
                    status = "HEALTHY"

            if status == "NEGATIVE":
                negative_stock_count += 1
                low_stock_items.append({**p, "status": status})
            elif status == "OUT_OF_STOCK":
                out_of_stock_count += 1
                low_stock_items.append({**p, "status": status})
            elif status == "CRITICAL":
                critical_stock_count += 1
                low_stock_items.append({**p, "status": status})
            elif status == "LOW":
                low_stock_count += 1
                low_stock_items.append({**p, "status": status})
            else:
                healthy_count += 1

        # Fetch recent transactions
        raw_txs = TransactionRepository.get_transactions(limit=1000)
        recent_movements = []
        today_str = datetime.utcnow().strftime("%Y-%m-%d")
        current_month_prefix = datetime.utcnow().strftime("%Y-%m")
        movements_today = 0
        stock_added_this_month = 0
        stock_issued_this_month = 0

        for tx in raw_txs:
            tx_date_str = str(tx.get("created_at") or tx.get("transaction_date") or "")[:10]
            qty = float(tx.get("quantity") or 0.0)
            tx_type = str(tx.get("transaction_type") or tx.get("transactionType") or "STOCK_IN").upper()

            if tx_date_str == today_str:
                movements_today += 1

            if tx_date_str.startswith(current_month_prefix):
                if tx_type in ("INWARD", "STOCK_IN", "INITIAL_STOCK", "CUSTOMER_RETURN", "RETURN_IN", "ADJUSTMENT_INCREASE") or ("ADJUSTMENT" in tx_type and qty > 0):
                    stock_added_this_month += abs(qty)
                elif tx_type in ("SALE", "SALES", "STOCK_OUT", "DISPATCH", "ADJUSTMENT_DECREASE") or ("ADJUSTMENT" in tx_type and qty < 0):
                    stock_issued_this_month += abs(qty)

            if len(recent_movements) < 10:
                prod = tx.get("products") or {}
                if isinstance(prod, list) and prod:
                    prod = prod[0]
                elif not isinstance(prod, dict):
                    prod = {}

                recent_movements.append({
                    "id": str(tx.get("id")),
                    "productId": tx.get("product_id") or tx.get("productId") or "",
                    "product_id": tx.get("product_id") or tx.get("productId") or "",
                    "productName": prod.get("name") or tx.get("productName") or "Inventory Item",
                    "productSku": prod.get("sku") or tx.get("productSku") or "",
                    "categoryName": prod.get("brand") or tx.get("categoryName") or "General",
                    "transactionType": tx_type,
                    "transaction_type": tx_type,
                    "quantity": qty,
                    "unit": tx.get("unit") or prod.get("unit_of_measure") or "NOS",
                    "newStock": float(tx.get("new_stock") or tx.get("newStock") or qty),
                    "new_stock": float(tx.get("new_stock") or tx.get("newStock") or qty),
                    "referenceNumber": tx.get("reference_number") or tx.get("referenceNumber") or tx.get("reference_type") or "-",
                    "reference_number": tx.get("reference_number") or tx.get("referenceNumber") or tx.get("reference_type") or "-",
                    "supplierOrRecipient": tx.get("supplier_or_recipient") or tx.get("supplierOrRecipient") or tx.get("notes") or "-",
                    "supplier_or_recipient": tx.get("supplier_or_recipient") or tx.get("supplierOrRecipient") or tx.get("notes") or "-",
                    "createdByName": tx.get("created_by_name") or tx.get("createdByName") or "Admin",
                    "created_by_name": tx.get("created_by_name") or tx.get("createdByName") or "Admin",
                    "createdAt": tx.get("created_at") or tx.get("transaction_date") or datetime.utcnow().isoformat(),
                    "created_at": tx.get("created_at") or tx.get("transaction_date") or datetime.utcnow().isoformat(),
                })

        # Generate trend for the last N days
        trend_days = max(1, min(90, days or 7))
        trend = []
        for i in range(trend_days - 1, -1, -1):
            d = datetime.utcnow() - timedelta(days=i)
            day_iso = d.strftime("%Y-%m-%d")
            label = d.strftime("%b %d")
            
            s_in = 0.0
            s_out = 0.0
            adj = 0.0
            for tx in raw_txs:
                t_date = str(tx.get("transaction_date") or tx.get("created_at") or "")[:10]
                if t_date == day_iso:
                    t_type = str(tx.get("transaction_type") or tx.get("transactionType") or "").upper()
                    t_qty = float(tx.get("quantity") or 0.0)
                    t_notes = str(tx.get("notes") or "").lower()
                    is_opening = "opening quantity" in t_notes

                    if is_opening:
                        adj += abs(t_qty)
                        continue

                    if t_type in ("INWARD", "STOCK_IN", "CUSTOMER_RETURN", "RETURN_IN", "ADJUSTMENT_INCREASE"):
                        s_in += abs(t_qty)
                    elif t_type in ("SALE", "SALES", "STOCK_OUT", "DISPATCH", "ADJUSTMENT_DECREASE"):
                        s_out += abs(t_qty)
                    elif "ADJUSTMENT" in t_type:
                        if t_qty >= 0:
                            s_in += abs(t_qty)
                        else:
                            s_out += abs(t_qty)
                        adj += abs(t_qty)
                    else:
                        if t_qty >= 0:
                            s_in += abs(t_qty)
                        else:
                            s_out += abs(t_qty)
            trend.append({
                "date": label,
                "stockIn": round(s_in, 2),
                "stockOut": round(s_out, 2),
                "adjustments": round(adj, 2)
            })

        # Category breakdown
        cat_map: Dict[str, Dict[str, Any]] = {}
        for p in active_products:
            cat_name = p.get("Category") or p.get("categoryName") or p.get("brand") or "General"
            if cat_name not in cat_map:
                cat_map[cat_name] = {"name": cat_name, "count": 0, "units": 0.0}
            cat_map[cat_name]["count"] += 1
            cat_map[cat_name]["units"] += float(p.get("Current Stock") or p.get("currentStock") or 0.0)
        
        category_breakdown = [
            {"name": c["name"], "count": c["count"], "units": round(c["units"])}
            for c in cat_map.values()
        ]

        # Also get BI & Executive summaries for compatibility
        bi_stats = AnalyticsService.get_bi_analytics()
        exec_summary = AnalyticsService.get_executive_summary()

        return {
            # Operational Dashboard fields:
            "totalProducts": total_products,
            "totalActiveSkus": total_active_skus,
            "totalUnitsInStock": round(total_units),
            "totalStockValue": round(total_stock_val, 2),
            "healthyCount": healthy_count,
            "lowStockCount": low_stock_count,
            "criticalStockCount": critical_stock_count,
            "outOfStockCount": out_of_stock_count,
            "negativeStockCount": negative_stock_count,
            "movementsToday": movements_today,
            "stockAddedThisMonth": round(stock_added_this_month),
            "stockIssuedThisMonth": round(stock_issued_this_month),
            "trend": trend,
            "recentMovements": recent_movements,
            "lowStockItems": low_stock_items[:20],
            "categoryBreakdown": category_breakdown,

            # Executive / BI Read Model:
            "core_kpis": bi_stats.get("core_kpis", {}),
            "executive_summary": exec_summary,
            "inventory_intelligence": bi_stats.get("inventory_intelligence", {}),
        }

    @staticmethod
    def get_executive_summary() -> Dict[str, Any]:
        inv = InventoryRepository.fetch_all_products_with_inventory()
        total_products = len(inv)
        total_units = sum(item.get("Current Stock", 0) for item in inv)
        total_stock_val = sum(item.get("Current Stock", 0) * item.get("Price", 0) for item in inv)
        
        low_stock = sum(1 for item in inv if 5 < item.get("Current Stock", 0) <= 15)
        critical_stock = sum(1 for item in inv if 0 < item.get("Current Stock", 0) <= 5)
        out_of_stock = sum(1 for item in inv if item.get("Current Stock", 0) == 0)
        negative_stock = sum(1 for item in inv if item.get("Current Stock", 0) < 0)
        healthy = sum(1 for item in inv if item.get("Current Stock", 0) > 15)

        orders = OrderRepository.get_orders(limit=1000)
        returns = TransactionRepository.get_returns(limit=500)

        dealer_count = DealerRepository.count_dealers()
        supplier_count = SupplierRepository.count_suppliers()

        pending_orders_count = sum(1 for o in orders if str(o.get("status", "")).lower() in ("pending", "pending_approval"))

        return {
            "total_products": total_products,
            "total_units": int(total_units),
            "total_stock_value": round(total_stock_val, 2),
            "healthy_count": healthy,
            "low_stock_items": low_stock,
            "critical_stock_items": critical_stock,
            "out_of_stock_items": out_of_stock,
            "negative_stock_count": negative_stock,
            "deficit_mitigation_count": low_stock + out_of_stock + negative_stock,
            "pending_orders": pending_orders_count,
            "total_orders": len(orders),
            "total_returns": len(returns),
            "total_dealers": dealer_count,
            "active_dealers": dealer_count,
            "total_suppliers": supplier_count,
            "active_suppliers": supplier_count,
        }

    @staticmethod
    def get_bi_analytics() -> Dict[str, Any]:
        inv = InventoryRepository.fetch_all_products_with_inventory()
        total_skus = len(inv)
        total_units = sum(item.get("Current Stock", 0) for item in inv)
        inv_value = sum(item.get("Current Stock", 0) * item.get("Price", 0) for item in inv)
        
        out_of_stock = sum(1 for item in inv if item.get("Current Stock", 0) <= 0)
        low_stock = sum(1 for item in inv if 0 < item.get("Current Stock", 0) < 10)
        healthy = max(0, total_skus - low_stock - out_of_stock)

        health_score = round(max(0, min(100, ((healthy / total_skus) * 100) if total_skus > 0 else 100.0)), 1)

        orders = OrderRepository.get_orders(limit=1000)
        returns = TransactionRepository.get_returns(limit=500)
        dealer_count = DealerRepository.count_dealers()
        supplier_count = SupplierRepository.count_suppliers()

        approved_orders = [o for o in orders if str(o.get("status", "")).lower() in ("approved", "dispatched", "delivered")]
        pending_orders = [o for o in orders if str(o.get("status", "")).lower() in ("pending", "pending_approval")]

        total_revenue = sum(float(o.get("total_amount") or 0.0) for o in approved_orders)
        aov = round(total_revenue / len(approved_orders), 2) if approved_orders else 0.0

        return {
            "core_kpis": {
                "total_revenue": round(total_revenue, 2),
                "inventory_value": round(inv_value, 2),
                "total_units": int(total_units),
                "total_orders": len(orders),
                "approved_orders": len(approved_orders),
                "pending_orders": len(pending_orders),
                "average_order_value": aov,
                "aov": aov,
                "inventory_health_score": health_score,
                "active_dealers": dealer_count,
                "active_suppliers": supplier_count,
                "return_rate_pct": round((len(returns) / len(orders) * 100), 2) if orders else 0.0,
            },
            "inventory_intelligence": {
                "total_skus": total_skus,
                "total_units": int(total_units),
                "healthy_count": healthy,
                "low_stock": low_stock,
                "out_of_stock": out_of_stock,
            }
        }

    @staticmethod
    def get_paginated_product_analytics(page: int = 1, page_size: int = 10, search: Optional[str] = None) -> Dict[str, Any]:
        inv = InventoryRepository.fetch_all_products_with_inventory()
        if search:
            search_clean = search.strip().lower()
            inv = [
                item for item in inv
                if search_clean in item.get("sku", "").lower() or search_clean in item.get("name", "").lower()
            ]

        total = len(inv)
        offset = (page - 1) * page_size
        items = inv[offset:offset + page_size]

        return {
            "items": items,
            "page": page,
            "page_size": page_size,
            "total": total,
            "has_next": offset + page_size < total,
            "has_previous": page > 1,
        }

analytics_service = AnalyticsService()
