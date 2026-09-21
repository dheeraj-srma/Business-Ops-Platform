# backend/services/analytics_service.py
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from repositories.inventory_repo import InventoryRepository
from repositories.order_repo import OrderRepository
from repositories.transaction_repo import TransactionRepository
from repositories.dealer_repo import DealerRepository
from repositories.supplier_repo import SupplierRepository
from services.snapshot_service import SnapshotService

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
        try:
            inv = InventoryRepository.fetch_all_products_with_inventory()
            total_skus = len(inv)
            total_units = sum(float(item.get("Current Stock", 0) or 0.0) for item in inv)
            inv_value = sum(
                float(item.get("Current Stock", 0) or 0.0) * float(item.get("Cost Price") or item.get("Price") or 0.0)
                for item in inv
            )
            
            out_of_stock = sum(1 for item in inv if float(item.get("Current Stock", 0) or 0.0) <= 0)
            low_stock = sum(1 for item in inv if 0 < float(item.get("Current Stock", 0) or 0.0) < 10)
            healthy = max(0, total_skus - low_stock - out_of_stock)
            health_score = round(max(0, min(100, ((healthy / total_skus) * 100) if total_skus > 0 else 100.0)), 1)

            orders = OrderRepository.get_orders(limit=2000)
            txns = TransactionRepository.get_transactions(limit=2000)
            returns = TransactionRepository.get_returns(limit=500)
            dealer_count = DealerRepository.count_dealers()
            supplier_count = SupplierRepository.count_suppliers()

            approved_orders = [o for o in orders if str(o.get("status", "")).lower() in ("approved", "dispatched", "delivered")]
            pending_orders = [o for o in orders if str(o.get("status", "")).lower() in ("pending", "pending_approval")]

            total_revenue = sum(float(o.get("total_amount") or 0.0) for o in approved_orders)
            aov = round(total_revenue / len(approved_orders), 2) if approved_orders else 0.0
            fulfillment_rate = round((len(approved_orders) / len(orders) * 100), 1) if orders else 0.0
            return_rate = round((len(returns) / len(orders) * 100), 2) if orders else 0.0

            # Daily chronological sales & stock movements
            daily_map: Dict[str, Dict[str, Any]] = {}
            latest_date_seen = ""

            for o in approved_orders:
                d_str = str(o.get("created_at") or "")[:10]
                if len(d_str) == 10 and d_str.startswith("20"):
                    if d_str not in daily_map:
                        daily_map[d_str] = {"date": d_str, "revenue": 0.0, "orders": 0, "stock_in": 0.0, "stock_out": 0.0, "adjustments": 0.0}
                    daily_map[d_str]["revenue"] += float(o.get("total_amount") or 0.0)
                    daily_map[d_str]["orders"] += 1
                    if d_str > latest_date_seen:
                        latest_date_seen = d_str

            for t in txns:
                t_date = str(t.get("transaction_date") or t.get("created_at") or "")[:10]
                if len(t_date) == 10 and t_date.startswith("20"):
                    if t_date not in daily_map:
                        daily_map[t_date] = {"date": t_date, "revenue": 0.0, "orders": 0, "stock_in": 0.0, "stock_out": 0.0, "adjustments": 0.0}
                    t_type = str(t.get("transaction_type") or "").upper()
                    qty = abs(float(t.get("quantity") or 0.0))
                    if t_type in ("INWARD", "STOCK_IN", "CUSTOMER_RETURN", "RETURN_IN"):
                        daily_map[t_date]["stock_in"] += qty
                    elif t_type in ("SALE", "SALES", "STOCK_OUT", "DISPATCH"):
                        daily_map[t_date]["stock_out"] += qty
                    elif "ADJUSTMENT" in t_type:
                        daily_map[t_date]["adjustments"] += qty
                    if t_date > latest_date_seen:
                        latest_date_seen = t_date

            daily_sales = [
                {
                    "date": d,
                    "revenue": round(val["revenue"], 2),
                    "orders": val["orders"],
                    "stock_in": round(val["stock_in"], 1),
                    "stock_out": round(val["stock_out"], 1),
                    "adjustments": round(val["adjustments"], 1),
                }
                for d, val in sorted(daily_map.items())
            ]

            # Dealer Rankings
            dealer_rev: Dict[str, float] = {}
            for o in approved_orders:
                cust = str(o.get("shop_name") or o.get("customer_name") or "Direct Customer").strip()
                dealer_rev[cust] = dealer_rev.get(cust, 0.0) + float(o.get("total_amount") or 0.0)
            sorted_dealers = sorted(dealer_rev.items(), key=lambda x: x[1], reverse=True)
            dealer_rankings = [{"dealer": d, "revenue": round(rev, 2)} for d, rev in sorted_dealers]
            top_dealer = dealer_rankings[0]["dealer"] if dealer_rankings else "N/A"

            # Salesman Performance
            salesman_rev: Dict[str, float] = {}
            for o in approved_orders:
                sm = str(o.get("salesman_name") or "Unassigned").strip()
                salesman_rev[sm] = salesman_rev.get(sm, 0.0) + float(o.get("total_amount") or 0.0)
            sorted_salesmen = sorted(salesman_rev.items(), key=lambda x: x[1], reverse=True)
            salesman_performance = [{"salesman": s, "revenue": round(rev, 2)} for s, rev in sorted_salesmen]
            top_salesman = salesman_performance[0]["salesman"] if salesman_performance else "N/A"

            # Category inventory valuation: quantity_on_hand * unit_cost
            cat_inv_map: Dict[str, float] = {}
            sku_to_cat: Dict[str, str] = {}
            sku_to_price: Dict[str, float] = {}
            name_to_cat: Dict[str, str] = {}
            for p in inv:
                cat = str(p.get("Category") or p.get("brand") or "General").strip()
                cost = float(p.get("Cost Price") or p.get("Price") or 0.0)
                stk = float(p.get("Current Stock") or 0.0)
                cat_inv_map[cat] = cat_inv_map.get(cat, 0.0) + (cost * stk)
                sku = str(p.get("SKU") or p.get("sku") or "").strip()
                name = str(p.get("Item Name") or p.get("name") or "").strip().lower()
                if sku:
                    sku_to_cat[sku] = cat
                    sku_to_price[sku] = cost
                if name:
                    name_to_cat[name] = cat
            category_valuation = [{"category": c, "value": round(val, 2)} for c, val in sorted(cat_inv_map.items(), key=lambda x: x[1], reverse=True)]

            # Category revenue from approved orders and transactions
            cat_sales_map: Dict[str, float] = {}
            for o in approved_orders:
                items = o.get("items") or []
                if isinstance(items, list) and items:
                    for it in items:
                        i_sku = str(it.get("sku") or it.get("product_id") or "").strip()
                        i_name = str(it.get("name") or it.get("product_name") or "").strip().lower()
                        i_cat = sku_to_cat.get(i_sku) or name_to_cat.get(i_name) or str(it.get("category") or "General").strip()
                        i_sub = float(it.get("subtotal") or it.get("total_price") or (float(it.get("quantity") or 0.0) * float(it.get("price") or it.get("rate") or 0.0)) or 0.0)
                        cat_sales_map[i_cat] = cat_sales_map.get(i_cat, 0.0) + i_sub

            if not cat_sales_map:
                for t in txns:
                    t_type = str(t.get("transaction_type") or "").upper()
                    if t_type in ("SALE", "SALES", "STOCK_OUT", "DISPATCH"):
                        prod = t.get("products") or {}
                        sku = str(prod.get("sku") or t.get("product_sku") or t.get("sku") or "").strip()
                        name = str(prod.get("name") or t.get("product_name") or "").strip().lower()
                        cat = sku_to_cat.get(sku) or name_to_cat.get(name) or str(prod.get("brand") or "General").strip()
                        qty = abs(float(t.get("quantity") or 0.0))
                        p_rate = sku_to_price.get(sku) or float(t.get("unit_cost") or 0.0)
                        cat_sales_map[cat] = cat_sales_map.get(cat, 0.0) + (qty * p_rate)

            cat_sales_sum = sum(cat_sales_map.values())
            if cat_sales_sum > 0 and total_revenue > 0:
                revenue_by_category = [
                    {"category": c, "revenue": round((val / cat_sales_sum) * total_revenue, 2)}
                    for c, val in sorted(cat_sales_map.items(), key=lambda x: x[1], reverse=True)
                ]
                rev_diff = round(total_revenue - sum(c["revenue"] for c in revenue_by_category), 2)
                if revenue_by_category and abs(rev_diff) > 0:
                    revenue_by_category[0]["revenue"] = round(revenue_by_category[0]["revenue"] + rev_diff, 2)
            elif total_revenue > 0:
                revenue_by_category = [{"category": "General", "revenue": round(total_revenue, 2)}]
            else:
                revenue_by_category = []

            # Top products
            prod_sold_map: Dict[str, Dict[str, Any]] = {}
            for t in txns:
                t_type = str(t.get("transaction_type") or "").upper()
                if t_type in ("SALE", "SALES", "STOCK_OUT", "DISPATCH"):
                    prod = t.get("products") or {}
                    sku = str(prod.get("sku") or t.get("product_sku") or t.get("sku") or "").strip()
                    name = str(prod.get("name") or t.get("product_name") or sku or "Item").strip()
                    qty = abs(float(t.get("quantity") or 0.0))
                    if sku:
                        if sku not in prod_sold_map:
                            prod_sold_map[sku] = {"sku": sku, "name": name, "qty": 0.0}
                        prod_sold_map[sku]["qty"] += qty
            sorted_prods = sorted(prod_sold_map.values(), key=lambda x: x["qty"], reverse=True)
            top_products = [{"sku": p["sku"], "name": p["name"], "qty": int(round(p["qty"]))} for p in sorted_prods[:15]]

            # Returns Intelligence
            return_reasons: Dict[str, int] = {}
            defective_count = 0
            good_count = 0
            for r in returns:
                rsn = str(r.get("reason") or "Other / General").strip()
                return_reasons[rsn] = return_reasons.get(rsn, 0) + 1
                cond = str(r.get("condition") or "").lower()
                q = int(r.get("quantity") or 1)
                if any(x in cond for x in ("defect", "scrap", "damage")):
                    defective_count += q
                else:
                    good_count += q

            # Procurement Intelligence
            inwards = [t for t in txns if str(t.get("transaction_type") or "").upper() in ("INWARD", "STOCK_IN")]
            purchase_val = sum(float(t.get("quantity") or 0.0) * float(t.get("unit_cost") or 0.0) for t in inwards)
            sup_map: Dict[str, float] = {}
            for t in inwards:
                sup = str(t.get("supplier_or_recipient") or "General Supplier").strip()
                v = float(t.get("quantity") or 0.0) * float(t.get("unit_cost") or 0.0)
                sup_map[sup] = sup_map.get(sup, 0.0) + v
            top_suppliers = [{"supplier": s, "value": round(val, 2)} for s, val in sorted(sup_map.items(), key=lambda x: x[1], reverse=True)[:25]]

            payload = {
                "status": "LIVE",
                "data_mode": "LIVE",
                "data_as_of": latest_date_seen or datetime.utcnow().strftime("%Y-%m-%d"),
                "core_kpis": {
                    "total_revenue": round(total_revenue, 2),
                    "purchase_value": round(purchase_val, 2),
                    "inventory_value": round(inv_value, 2),
                    "total_units": int(total_units),
                    "total_orders": len(orders),
                    "approved_orders": len(approved_orders),
                    "pending_orders": len(pending_orders),
                    "average_order_value": aov,
                    "aov": aov,
                    "inventory_turnover_ratio": round((total_revenue * 0.64 / inv_value), 2) if inv_value > 0 else 0.0,
                    "inventory_health_score": health_score,
                    "active_dealers": dealer_count,
                    "active_suppliers": supplier_count,
                    "return_rate_pct": return_rate,
                    "fulfillment_rate_pct": fulfillment_rate,
                },
                "sales_intelligence": {
                    "top_dealer": top_dealer,
                    "top_salesman": top_salesman,
                    "daily_sales": daily_sales,
                    "revenue_by_category": revenue_by_category,
                    "dealer_rankings": dealer_rankings,
                    "salesman_performance": salesman_performance,
                    "top_products": top_products,
                },
                "inventory_intelligence": {
                    "total_skus": total_skus,
                    "total_units": int(total_units),
                    "healthy_count": healthy,
                    "low_stock": low_stock,
                    "out_of_stock": out_of_stock,
                    "category_valuation": category_valuation,
                    "category_breakdown": category_valuation,
                    "top_movers": [{"name": p["name"], "sku": p["sku"], "units_sold": p["qty"]} for p in top_products[:6]],
                },
                "returns_intelligence": {
                    "total_returns": len(returns),
                    "return_reasons": return_reasons,
                    "reasons": return_reasons,
                    "defective_count": defective_count,
                    "good_count": good_count,
                },
                "procurement_intelligence": {
                    "purchase_value": round(purchase_val, 2),
                    "total_suppliers": supplier_count,
                    "top_suppliers": top_suppliers,
                },
                "ai_insights": [
                    { "type": "info", "title": "Authoritative Data Pipeline", "message": f"Aggregated {len(approved_orders)} approved orders across {dealer_count} verified accounts with real inventory telemetry." },
                    { "type": "success" if health_score >= 80 else "warning", "title": "Stock Distribution Metric", "message": f"{healthy} of {total_skus} SKUs operating within healthy inventory thresholds ({health_score}% rating)." }
                ]
            }

            SnapshotService.record_successful_read("analytics_bi", payload)
            return payload

        except Exception as exc:
            logger.warning(f"Error computing live BI analytics: {exc}, checking last known snapshot")
            snap = SnapshotService.get_last_known_snapshot("analytics_bi")
            if snap and snap.get("data"):
                snap_payload = snap["data"]
                snap_payload["status"] = "SNAPSHOT"
                snap_payload["data_mode"] = "SNAPSHOT"
                snap_payload["snapshot_updated_at"] = snap.get("captured_at")
                return snap_payload
            raise exc

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
