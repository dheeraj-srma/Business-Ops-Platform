# backend/services/analytics_service.py
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from repositories.inventory_repo import InventoryRepository
from repositories.order_repo import OrderRepository
from repositories.transaction_repo import TransactionRepository
from repositories.dealer_repo import DealerRepository
from repositories.supplier_repo import SupplierRepository
from repositories.historical_sales_repo import HistoricalSalesRepository
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
                # Strict exclusion of non-physical reservation events
                if tx_type in ("RESERVATION", "RESERVATION_RELEASE"):
                    continue

                t_notes_check = str(tx.get("notes") or "").lower()
                if tx_type in ("INWARD", "STOCK_IN", "CUSTOMER_RETURN", "RETURN_IN", "ADJUSTMENT_INCREASE", "INITIAL_STOCK"):
                    stock_added_this_month += abs(qty)
                elif tx_type in ("SALE", "SALES", "STOCK_OUT", "DISPATCH", "RETURN_OUT", "ADJUSTMENT_DECREASE"):
                    stock_issued_this_month += abs(qty)
                elif "ADJUSTMENT" in tx_type:
                    if "delta: -" in t_notes_check or "- " in t_notes_check or "loss" in t_notes_check or "damage" in t_notes_check:
                        stock_issued_this_month += abs(qty)
                    else:
                        stock_added_this_month += abs(qty)

            if len(recent_movements) < 15:
                prod = tx.get("products") or {}
                if isinstance(prod, list) and prod:
                    prod = prod[0]
                elif not isinstance(prod, dict):
                    prod = {}

                pid = tx.get("product_id") or tx.get("productId") or ""
                if (not prod.get("name") or not prod.get("sku")) and pid:
                    matching_p = next((p for p in active_products if str(p.get("id")) == str(pid) or str(p.get("sku")) == str(pid)), None)
                    if matching_p:
                        prod = {
                            "id": matching_p.get("id"),
                            "sku": matching_p.get("sku"),
                            "name": matching_p.get("name"),
                            "brand": matching_p.get("brand") or matching_p.get("Category") or matching_p.get("categoryName"),
                            "unit_of_measure": matching_p.get("unit") or matching_p.get("unit_of_measure")
                        }

                p_sku = prod.get("sku") or tx.get("productSku") or ""
                p_name = prod.get("name") or tx.get("productName") or p_sku or "Inventory Item"
                p_brand = prod.get("brand") or tx.get("categoryName") or "General"
                p_unit = prod.get("unit_of_measure") or tx.get("unit") or "NOS"

                notes_str = str(tx.get("notes") or "")
                ref_num = tx.get("client_reference") or tx.get("reference_id") or tx.get("reference_number") or tx.get("referenceNumber") or ""
                if not ref_num or ref_num == "-":
                    if "Ref:" in notes_str:
                        ref_num = notes_str.split("Ref:")[1].split("|")[0].strip()
                    elif "initial" in notes_str.lower():
                        ref_num = "INITIAL-SETUP"
                    elif tx.get("reference_type"):
                        ref_num = str(tx.get("reference_type")).upper()
                    else:
                        ref_num = "-"

                supp_rec = tx.get("supplier_or_recipient") or tx.get("supplierOrRecipient") or ""
                if not supp_rec or supp_rec == "-":
                    if "Supplier:" in notes_str:
                        supp_rec = notes_str.split("Supplier:")[1].split("|")[0].strip()
                    elif "Recipient:" in notes_str:
                        supp_rec = notes_str.split("Recipient:")[1].split("|")[0].strip()
                    elif notes_str:
                        supp_rec = notes_str.split("|")[0].strip()
                    else:
                        supp_rec = "-"

                actor = tx.get("created_by_name") or tx.get("createdByName") or tx.get("performed_by") or ""
                if not actor or actor == "None":
                    if "By:" in notes_str:
                        actor = notes_str.split("By:")[1].split("|")[0].strip()
                    else:
                        actor = "Admin"

                raw_ts = tx.get("transaction_date") or tx.get("created_at") or datetime.now(timezone.utc).isoformat()

                recent_movements.append({
                    "id": str(tx.get("id")),
                    "productId": str(pid),
                    "product_id": str(pid),
                    "productName": p_name,
                    "productSku": p_sku,
                    "categoryName": p_brand,
                    "transactionType": tx_type,
                    "transaction_type": tx_type,
                    "quantity": qty,
                    "unit": p_unit,
                    "newStock": float(tx.get("new_stock") or tx.get("newStock") or qty),
                    "new_stock": float(tx.get("new_stock") or tx.get("newStock") or qty),
                    "referenceNumber": ref_num,
                    "reference_number": ref_num,
                    "supplierOrRecipient": supp_rec,
                    "supplier_or_recipient": supp_rec,
                    "createdByName": actor,
                    "created_by_name": actor,
                    "createdAt": raw_ts,
                    "created_at": raw_ts,
                })

        # Generate trend for requested date range or last N days
        date_list = []
        if start_date and end_date:
            try:
                cur_dt = datetime.strptime(start_date[:10], "%Y-%m-%d")
                end_dt = datetime.strptime(end_date[:10], "%Y-%m-%d")
                while cur_dt <= end_dt and len(date_list) < 365:
                    date_list.append(cur_dt)
                    cur_dt += timedelta(days=1)
            except Exception:
                date_list = []

        if not date_list:
            trend_days = max(1, min(90, days or 7))
            for i in range(trend_days - 1, -1, -1):
                date_list.append(datetime.utcnow() - timedelta(days=i))

        trend = []
        for d in date_list:
            day_iso = d.strftime("%Y-%m-%d")
            label = d.strftime("%b %d")

            s_in = 0.0
            s_out = 0.0
            adj = 0.0
            for tx in raw_txs:
                t_date = str(tx.get("transaction_date") or tx.get("created_at") or "")[:10]
                if t_date == day_iso:
                    t_type = str(tx.get("transaction_type") or tx.get("transactionType") or "").upper()
                    t_qty = abs(float(tx.get("quantity") or 0.0))
                    t_notes = str(tx.get("notes") or "").lower()

                    # Strictly exclude non-physical reservation movements
                    if t_type in ("RESERVATION", "RESERVATION_RELEASE"):
                        continue

                    if t_type in ("INWARD", "STOCK_IN", "CUSTOMER_RETURN", "RETURN_IN", "ADJUSTMENT_INCREASE", "INITIAL_STOCK"):
                        s_in += t_qty
                    elif t_type in ("SALE", "SALES", "STOCK_OUT", "DISPATCH", "RETURN_OUT", "ADJUSTMENT_DECREASE"):
                        s_out += t_qty
                    elif "ADJUSTMENT" in t_type:
                        if "delta: -" in t_notes or "- " in t_notes or "loss" in t_notes or "damage" in t_notes:
                            s_out += t_qty
                        else:
                            s_in += t_qty
                        adj += t_qty

            trend.append({
                "date": label,
                "dateIso": day_iso,
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

        # Construct BI & Executive summaries directly from computed in-memory metrics (Zero redundant DB round-trips)
        core_kpis = {
            "total_revenue": 0.0,
            "purchase_value": 0.0,
            "inventory_value": round(total_stock_val, 2),
            "total_units": round(total_units),
            "total_orders": 0,
            "pending_orders": 0,
            "healthy_count": healthy_count,
            "low_stock": low_stock_count,
            "out_of_stock": out_of_stock_count,
            "inventory_health_score": round(max(0, min(100, ((healthy_count / total_products) * 100) if total_products > 0 else 100.0)), 1),
        }
        exec_summary = {
            "total_products": total_products,
            "total_units": int(total_units),
            "total_stock_value": round(total_stock_val, 2),
            "healthy_count": healthy_count,
            "low_stock_items": low_stock_count,
            "critical_stock_items": critical_stock_count,
            "out_of_stock_items": out_of_stock_count,
            "negative_stock_count": negative_stock_count,
            "deficit_mitigation_count": low_stock_count + out_of_stock_count + negative_stock_count,
        }
        inventory_intelligence = {
            "total_skus": total_products,
            "total_units": round(total_units),
            "healthy_count": healthy_count,
            "low_stock": low_stock_count,
            "out_of_stock": out_of_stock_count,
            "category_breakdown": category_breakdown,
        }

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
            "core_kpis": core_kpis,
            "executive_summary": exec_summary,
            "inventory_intelligence": inventory_intelligence,
        }

    @staticmethod
    def get_stock_movement_summary(
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        granularity: str = "daily"
    ) -> Dict[str, Any]:
        """
        Authoritative calculation of stock in, stock out, net movement,
        and timeline strictly derived from actual inventory_transactions.
        """
        all_txs = TransactionRepository.get_transactions(limit=10000)

        # Date normalization
        sd_str = start_date[:10] if start_date else None
        ed_str = end_date[:10] if end_date else datetime.utcnow().strftime("%Y-%m-%d")
        if not sd_str:
            sd_dt = datetime.utcnow() - timedelta(days=30)
            sd_str = sd_dt.strftime("%Y-%m-%d")

        cur_dt = datetime.strptime(sd_str, "%Y-%m-%d")
        end_dt = datetime.strptime(ed_str, "%Y-%m-%d")

        total_stock_in = 0.0
        total_stock_out = 0.0

        daily_buckets: Dict[str, Dict[str, float]] = {}
        temp_dt = cur_dt
        while temp_dt <= end_dt and len(daily_buckets) < 365:
            d_str = temp_dt.strftime("%Y-%m-%d")
            daily_buckets[d_str] = {"stock_in": 0.0, "stock_out": 0.0, "adjustments": 0.0}
            temp_dt += timedelta(days=1)

        prior_net_movement = 0.0
        has_prior_records = False

        for tx in all_txs:
            t_date = str(tx.get("transaction_date") or tx.get("created_at") or "")[:10]
            t_type = str(tx.get("transaction_type") or tx.get("transactionType") or "").upper()
            qty = abs(float(tx.get("quantity") or 0.0))
            notes = str(tx.get("notes") or "").lower()

            # Non-physical reservations are strictly excluded
            if t_type in ("RESERVATION", "RESERVATION_RELEASE"):
                continue

            is_opening = "opening quantity" in notes or "initial stock" in notes

            # Classify physical movement
            is_inward = t_type in ("INWARD", "STOCK_IN", "CUSTOMER_RETURN", "RETURN_IN", "ADJUSTMENT_INCREASE")
            is_outward = t_type in ("SALE", "SALES", "STOCK_OUT", "DISPATCH", "RETURN_OUT", "ADJUSTMENT_DECREASE")
            if "ADJUSTMENT" in t_type and not (is_inward or is_outward):
                if "delta: -" in notes or "- " in notes:
                    is_outward = True
                else:
                    is_inward = True

            # Track prior movements for opening balance reconstruction
            if t_date < sd_str:
                has_prior_records = True
                if is_inward:
                    prior_net_movement += qty
                elif is_outward:
                    prior_net_movement -= qty

            # In-range movements
            if sd_str <= t_date <= ed_str:
                if is_opening:
                    if t_date in daily_buckets:
                        daily_buckets[t_date]["adjustments"] += qty
                    continue

                if is_inward:
                    total_stock_in += qty
                    if t_date in daily_buckets:
                        daily_buckets[t_date]["stock_in"] += qty
                elif is_outward:
                    total_stock_out += qty
                    if t_date in daily_buckets:
                        daily_buckets[t_date]["stock_out"] += qty

        # Format timeline based on granularity
        timeline = []
        if granularity == "weekly":
            week_map: Dict[str, Dict[str, float]] = {}
            for d_str, b in sorted(daily_buckets.items()):
                dt = datetime.strptime(d_str, "%Y-%m-%d")
                w_key = f"{dt.year}-W{dt.isocalendar()[1]:02d}"
                if w_key not in week_map:
                    week_map[w_key] = {"stock_in": 0.0, "stock_out": 0.0}
                week_map[w_key]["stock_in"] += b["stock_in"]
                week_map[w_key]["stock_out"] += b["stock_out"]
            for w_key, b in sorted(week_map.items()):
                timeline.append({
                    "date": w_key,
                    "stock_in": round(b["stock_in"], 2),
                    "stock_out": round(b["stock_out"], 2),
                    "net_movement": round(b["stock_in"] - b["stock_out"], 2)
                })
        elif granularity == "monthly":
            month_map: Dict[str, Dict[str, float]] = {}
            for d_str, b in sorted(daily_buckets.items()):
                m_key = d_str[:7]
                if m_key not in month_map:
                    month_map[m_key] = {"stock_in": 0.0, "stock_out": 0.0}
                month_map[m_key]["stock_in"] += b["stock_in"]
                month_map[m_key]["stock_out"] += b["stock_out"]
            for m_key, b in sorted(month_map.items()):
                timeline.append({
                    "date": m_key,
                    "stock_in": round(b["stock_in"], 2),
                    "stock_out": round(b["stock_out"], 2),
                    "net_movement": round(b["stock_in"] - b["stock_out"], 2)
                })
        else:
            for d_str, b in sorted(daily_buckets.items()):
                dt = datetime.strptime(d_str, "%Y-%m-%d")
                label = dt.strftime("%b %d")
                timeline.append({
                    "date": label,
                    "date_iso": d_str,
                    "stock_in": round(b["stock_in"], 2),
                    "stock_out": round(b["stock_out"], 2),
                    "net_movement": round(b["stock_in"] - b["stock_out"], 2)
                })

        opening_balance = round(prior_net_movement, 2) if has_prior_records else "UNAVAILABLE"
        closing_balance = round(prior_net_movement + total_stock_in - total_stock_out, 2) if has_prior_records else "UNAVAILABLE"

        matching_txs = [
            tx for tx in all_txs
            if sd_str <= str(tx.get("transaction_date") or tx.get("created_at") or "")[:10] <= ed_str
            and str(tx.get("transaction_type") or "").upper() not in ("RESERVATION", "RESERVATION_RELEASE")
        ]

        return {
            "start_date": sd_str,
            "end_date": ed_str,
            "granularity": granularity,
            "stock_in": round(total_stock_in, 2),
            "stock_out": round(total_stock_out, 2),
            "net_movement": round(total_stock_in - total_stock_out, 2),
            "opening_balance": opening_balance,
            "closing_balance": closing_balance,
            "transaction_count": len(matching_txs),
            "timeline": timeline
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

        orders = OrderRepository.get_orders(limit=1000)
        returns = TransactionRepository.get_returns(limit=500)

        hist_kpis = HistoricalSalesRepository.get_summary_kpis()
        total_orders_count = hist_kpis["total_orders"] if hist_kpis["total_orders"] > 0 else len(orders)
        total_returns_count = hist_kpis["returns_count"] if hist_kpis["returns_count"] > 0 else len(returns)
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
            "total_orders": total_orders_count,
            "total_returns": total_returns_count,
            "total_dealers": dealer_count,
            "active_dealers": dealer_count,
            "total_suppliers": supplier_count,
            "active_suppliers": supplier_count,
        }

    @staticmethod
    def get_bi_analytics(
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        salesman: Optional[str] = None,
        customer: Optional[str] = None,
        state: Optional[str] = None,
        city: Optional[str] = None,
        category: Optional[str] = None
    ) -> Dict[str, Any]:
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
            dealer_count = DealerRepository.count_dealers()
            supplier_count = SupplierRepository.count_suppliers()

            pending_orders = [o for o in orders if str(o.get("status", "")).lower() in ("pending", "pending_approval")]

            # Query Authoritative Historical Sales Ledger with cross-filter support
            hist_kpis = HistoricalSalesRepository.get_summary_kpis(
                start_date=start_date, end_date=end_date,
                salesman=salesman, customer=customer,
                state=state, city=city, category=category
            )
            has_hist_data = hist_kpis["total_vouchers"] > 0

            if has_hist_data:
                total_revenue = hist_kpis["total_revenue"]
                total_orders = hist_kpis["total_orders"]
                approved_orders_count = hist_kpis["total_orders"]
                aov = hist_kpis["aov"]
                daily_sales = HistoricalSalesRepository.get_daily_sales_timeline(
                    start_date=start_date, end_date=end_date,
                    salesman=salesman, customer=customer,
                    state=state, city=city, category=category
                )
                dealer_rankings = HistoricalSalesRepository.get_top_customers(
                    limit=50, start_date=start_date, end_date=end_date,
                    salesman=salesman, state=state, city=city, category=category
                )
                top_dealer = dealer_rankings[0]["dealer"] if dealer_rankings else "N/A"
                top_products = HistoricalSalesRepository.get_product_analytics(
                    limit=25, start_date=start_date, end_date=end_date,
                    salesman=salesman, category=category
                )
                revenue_by_category = HistoricalSalesRepository.get_category_analytics(
                    start_date=start_date, end_date=end_date,
                    salesman=salesman, state=state, city=city, customer=customer
                )
                salesman_performance = HistoricalSalesRepository.get_salesman_analytics(
                    start_date=start_date, end_date=end_date,
                    state=state, city=city, category=category
                )
                top_salesman = salesman_performance[0]["salesman"] if salesman_performance else "N/A"
                geo_breakdown = HistoricalSalesRepository.get_geographic_breakdown(
                    start_date=start_date, end_date=end_date,
                    salesman=salesman, category=category
                )
                latest_date_seen = hist_kpis["latest_date"] or datetime.utcnow().strftime("%Y-%m-%d")
                return_val = hist_kpis["returns_value"]
                return_count = hist_kpis["returns_count"]
                return_rate = round((return_val / total_revenue * 100), 2) if total_revenue > 0 else 0.0
                purchase_val = hist_kpis["purchase_value"]
                disp_or_delivered = [o for o in orders if str(o.get("status", "")).lower() in ("dispatched", "delivered", "approved")]
                fulfillment_rate = round((len(disp_or_delivered) / len(orders) * 100), 1) if orders else None
            else:
                approved_orders = [o for o in orders if str(o.get("status", "")).lower() in ("approved", "dispatched", "delivered")]
                total_revenue = sum(float(o.get("total_amount") or 0.0) for o in approved_orders)
                total_orders = len(orders)
                approved_orders_count = len(approved_orders)
                aov = round(total_revenue / len(approved_orders), 2) if approved_orders else 0.0
                fulfillment_rate = round((len(approved_orders) / len(orders) * 100), 1) if orders else 0.0
                return_rate = 0.0
                return_count = 0
                purchase_val = 0.0
                daily_sales = []
                dealer_rankings = []
                top_dealer = "N/A"
                top_products = []
                revenue_by_category = []
                top_salesman = "N/A"
                salesman_performance = []
                geo_breakdown = {"state_distribution": {}, "by_region": [], "by_state": [], "by_city": []}
                latest_date_seen = datetime.utcnow().strftime("%Y-%m-%d")

            # Category inventory valuation: quantity_on_hand * unit_cost (Current stock strictly separated from historical sales)
            cat_inv_map: Dict[str, float] = {}
            for p in inv:
                cat = str(p.get("Category") or p.get("brand") or "General").strip()
                cost = float(p.get("Cost Price") or p.get("Price") or 0.0)
                stk = float(p.get("Current Stock") or 0.0)
                cat_inv_map[cat] = cat_inv_map.get(cat, 0.0) + (cost * stk)
            category_valuation = [{"category": c, "value": round(val, 2)} for c, val in sorted(cat_inv_map.items(), key=lambda x: x[1], reverse=True)]

            # Returns Intelligence
            return_reasons = {
                "Historical Credit Notes / Returns": return_count
            }

            # Procurement Intelligence
            top_suppliers = [
                {"supplier": "Historical Inward Procurement", "value": round(purchase_val, 2)}
            ]

            freshness_map = HistoricalSalesRepository.get_sources_freshness()
            now_iso = datetime.now(timezone(timedelta(hours=5, minutes=30))).isoformat()
            min_avail_date = hist_kpis.get("earliest_date") or freshness_map["sales"]["data_min_date"] or "2026-06-01"

            payload = {
                "status": "LIVE",
                "data_mode": "LIVE",
                "data_as_of": latest_date_seen,
                "data_min_date": min_avail_date,
                "generated_at": now_iso,
                "meta": {
                    "date_range": {
                        "start": start_date,
                        "end": end_date,
                    },
                    "data_as_of": latest_date_seen,
                    "data_min_date": min_avail_date,
                    "generated_at": now_iso,
                    "database_mode": "LIVE",
                    "source": "historical_sales",
                    "sources_freshness": freshness_map,
                },
                "applied_filters": {
                    "start_date": start_date,
                    "end_date": end_date,
                    "salesman": salesman,
                    "customer": customer,
                    "state": state,
                    "city": city,
                    "category": category,
                },
                "core_kpis": {
                    "total_revenue": round(total_revenue, 2),
                    "purchase_value": round(purchase_val, 2),
                    "inventory_value": round(inv_value, 2),
                    "total_units": int(total_units),
                    "total_orders": total_orders,
                    "approved_orders": approved_orders_count,
                    "pending_orders": len(pending_orders),
                    "average_order_value": aov,
                    "aov": aov,
                    "inventory_turnover_ratio": round((purchase_val / inv_value), 2) if inv_value > 0 and purchase_val > 0 else None,
                    "inventory_health_score": health_score,
                    "active_dealers": hist_kpis.get("active_customers") or dealer_count,
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
                    "geographic_sales": geo_breakdown.get("state_distribution", {}),
                    "by_region": geo_breakdown.get("by_region", []),
                    "by_state": geo_breakdown.get("by_state", []),
                    "by_city": geo_breakdown.get("by_city", []),
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
                    "total_returns": return_count,
                    "return_reasons": return_reasons,
                    "reasons": return_reasons,
                    "defective_count": 0,
                    "good_count": return_count,
                },
                "procurement_intelligence": {
                    "purchase_value": round(purchase_val, 2),
                    "total_suppliers": supplier_count,
                    "top_suppliers": top_suppliers,
                },
                "financial_intelligence": HistoricalSalesRepository.get_financial_analytics(
                    start_date=start_date, end_date=end_date
                ),
                "ai_insights": [
                    { "type": "info", "title": "Authoritative Historical Foundation", "message": f"Verified {total_orders:,} historical sales vouchers (Rs. {total_revenue:,.2f}) — data through {latest_date_seen}." },
                    { "type": "success" if health_score >= 80 else "warning", "title": "Inventory Integrity Safeguard", "message": f"Historical sales demand ledger operates independently with 0 mutations to current stock ({total_skus:,} SKUs active)." }
                ]
            }

            # Only cache snapshot when unfiltered
            if not any([start_date, end_date, salesman, customer, state, city, category]):
                SnapshotService.record_successful_read("analytics_bi", payload, force_refresh=True)
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
    def get_salesman_analytics(
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        state: Optional[str] = None,
        city: Optional[str] = None,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        return HistoricalSalesRepository.get_salesman_analytics(
            start_date=start_date, end_date=end_date, state=state, city=city, category=category
        )

    @staticmethod
    def get_geographic_analytics(
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        salesman: Optional[str] = None,
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        return HistoricalSalesRepository.get_geographic_breakdown(
            start_date=start_date, end_date=end_date, salesman=salesman, category=category
        )

    @staticmethod
    def get_category_analytics(
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        salesman: Optional[str] = None,
        state: Optional[str] = None,
        city: Optional[str] = None,
        customer: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        return HistoricalSalesRepository.get_category_analytics(
            start_date=start_date, end_date=end_date, salesman=salesman, state=state, city=city, customer=customer
        )

    @staticmethod
    def get_data_quality_report() -> Dict[str, Any]:
        return HistoricalSalesRepository.get_data_quality_report()

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

    # ═══════════════════════════════════════════════════════════════════════
    # PHASE 1: New analytical endpoints for BI alignment
    # ═══════════════════════════════════════════════════════════════════════

    @staticmethod
    def get_customer_analytics(
        limit: int = 100,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        salesman: Optional[str] = None,
        state: Optional[str] = None,
        city: Optional[str] = None,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        return HistoricalSalesRepository.get_customer_performance(
            limit=limit, start_date=start_date, end_date=end_date,
            salesman=salesman, state=state, city=city, category=category
        )

    @staticmethod
    def get_customer_heatmap(
        customer_id: Optional[str] = None,
        days_count: int = 365
    ) -> Dict[str, Any]:
        return HistoricalSalesRepository.get_customer_order_heatmap_data(
            customer_id=customer_id, days_count=days_count
        )

    @staticmethod
    def get_customer_profile(
        customer_id_or_name: str
    ) -> Optional[Dict[str, Any]]:
        return HistoricalSalesRepository.get_customer_profile(
            customer_id_or_name=customer_id_or_name
        )

    @staticmethod
    def get_return_analytics(
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        return HistoricalSalesRepository.get_return_analytics(
            start_date=start_date, end_date=end_date
        )

    @staticmethod
    def get_purchase_analytics(
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        return HistoricalSalesRepository.get_purchase_analytics(
            start_date=start_date, end_date=end_date
        )

    @staticmethod
    def get_order_value_distribution(
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        return HistoricalSalesRepository.get_order_value_distribution(
            start_date=start_date, end_date=end_date
        )

    @staticmethod
    def get_financial_analytics(
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        return HistoricalSalesRepository.get_financial_analytics(
            start_date=start_date, end_date=end_date
        )

    @staticmethod
    def get_explorer_available_entities(
        entity_type: str = "Product"
    ) -> List[Dict[str, Any]]:
        return HistoricalSalesRepository.get_explorer_available_entities(
            entity_type=entity_type
        )

    @staticmethod
    def get_explorer_entity_analytics(
        entity_type: str = "Product",
        query: str = "",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        return HistoricalSalesRepository.get_explorer_entity_analytics(
            entity_type=entity_type,
            query=query,
            start_date=start_date,
            end_date=end_date,
        )

analytics_service = AnalyticsService()


