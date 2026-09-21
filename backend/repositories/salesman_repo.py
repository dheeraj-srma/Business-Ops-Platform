# backend/repositories/salesman_repo.py
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from config.database import get_db_client

from repositories.order_repo import OrderRepository

logger = logging.getLogger("salesman_repo")

DEFAULT_SALESMEN_LIST = [
    {
        "id": "SLM-101",
        "salesman_code": "SLM-101",
        "full_name": "RAVINDER KUMAR",
        "email": "ravinder.kumar@nalkametals.com",
        "phone": "+91 98102 34567",
        "role": "salesman",
        "is_active": True,
        "territory": "Gurugram / Haryana North",
        "sales": 0.0,
        "orders": 0,
        "average_order_value": 0.0,
        "units_sold": 0.0,
        "customers": 0,
        "active_days": 0,
        "cancelled_orders": 0,
        "sales_contribution_pct": 0.0
    },
    {
        "id": "SLM-102",
        "salesman_code": "SLM-102",
        "full_name": "ANKIT",
        "email": "ankit@nalkametals.com",
        "phone": "+91 98103 45678",
        "role": "salesman",
        "is_active": True,
        "territory": "Delhi NCR / East",
        "sales": 0.0,
        "orders": 0,
        "average_order_value": 0.0,
        "units_sold": 0.0,
        "customers": 0,
        "active_days": 0,
        "cancelled_orders": 0,
        "sales_contribution_pct": 0.0
    },
    {
        "id": "SLM-103",
        "salesman_code": "SLM-103",
        "full_name": "SAURAV",
        "email": "saurav@nalkametals.com",
        "phone": "+91 98104 56789",
        "role": "salesman",
        "is_active": True,
        "territory": "Panipat / Ambala",
        "sales": 0.0,
        "orders": 0,
        "average_order_value": 0.0,
        "units_sold": 0.0,
        "customers": 0,
        "active_days": 0,
        "cancelled_orders": 0,
        "sales_contribution_pct": 0.0
    },
    {
        "id": "SLM-104",
        "salesman_code": "SLM-104",
        "full_name": "CHANDRA PRAKASH",
        "email": "chandra.prakash@nalkametals.com",
        "phone": "+91 98105 67890",
        "role": "salesman",
        "is_active": True,
        "territory": "Haryana South / Rewari",
        "sales": 0.0,
        "orders": 0,
        "average_order_value": 0.0,
        "units_sold": 0.0,
        "customers": 0,
        "active_days": 0,
        "cancelled_orders": 0,
        "sales_contribution_pct": 0.0
    },
    {
        "id": "SLM-105",
        "salesman_code": "SLM-105",
        "full_name": "AMIT SHARMA",
        "email": "amit.sharma@nalkametals.com",
        "phone": "+91 98106 78901",
        "role": "salesman",
        "is_active": True,
        "territory": "Faridabad / Palwal",
        "sales": 0.0,
        "orders": 0,
        "average_order_value": 0.0,
        "units_sold": 0.0,
        "customers": 0,
        "active_days": 0,
        "cancelled_orders": 0,
        "sales_contribution_pct": 0.0
    },
    {
        "id": "SLM-106",
        "salesman_code": "SLM-106",
        "full_name": "VIKRAM SINGH",
        "email": "vikram.singh@nalkametals.com",
        "phone": "+91 98107 89012",
        "role": "salesman",
        "is_active": True,
        "territory": "Uttar Pradesh / Noida",
        "sales": 0.0,
        "orders": 0,
        "average_order_value": 0.0,
        "units_sold": 0.0,
        "customers": 0,
        "active_days": 0,
        "cancelled_orders": 0,
        "sales_contribution_pct": 0.0
    },
    {
        "id": "SLM-107",
        "salesman_code": "SLM-107",
        "full_name": "RAHUL VERMA",
        "email": "rahul.verma@nalkametals.com",
        "phone": "+91 98108 90123",
        "role": "salesman",
        "is_active": True,
        "territory": "Punjab & Chandigarh",
        "sales": 0.0,
        "orders": 0,
        "average_order_value": 0.0,
        "units_sold": 0.0,
        "customers": 0,
        "active_days": 0,
        "cancelled_orders": 0,
        "sales_contribution_pct": 0.0
    }
]

class SalesmanRepository:

    @staticmethod
    def _parse_date(date_str: str) -> Optional[datetime]:
        if not date_str:
            return None
        try:
            return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        except Exception:
            try:
                return datetime.strptime(date_str[:10], "%Y-%m-%d")
            except Exception:
                return None

    @staticmethod
    def get_salesmen_list() -> List[Dict[str, Any]]:
        client = get_db_client()
        if not client:
            return DEFAULT_SALESMEN_LIST
        try:
            salesmen_res = client.table("salesmen").select("*").execute()
            salesmen = salesmen_res.data or []
            if not salesmen:
                return DEFAULT_SALESMEN_LIST

            users_res = client.table("users").select("id, email, phone, role, is_active").execute()
            users_by_id = {u["id"]: u for u in (users_res.data or []) if u.get("id")}

            results = []
            for s in salesmen:
                u_info = users_by_id.get(s.get("user_id")) or {}
                results.append({
                    "id": s.get("id"),
                    "salesman_code": s.get("salesman_code") or s.get("id"),
                    "user_id": s.get("user_id"),
                    "full_name": s.get("full_name") or u_info.get("email", "Salesman"),
                    "email": u_info.get("email") or f"{s.get('salesman_code', 'slm').lower()}@nalkametals.com",
                    "phone": s.get("phone") or u_info.get("phone") or "—",
                    "role": "salesman",
                    "is_active": s.get("is_active", True),
                    "assigned_location_id": s.get("assigned_location_id") or "—",
                    "territory": "Northern Region"
                })
            return results if results else DEFAULT_SALESMEN_LIST
        except Exception as err:
            logger.error(f"Error fetching salesmen list: {err}")
            return DEFAULT_SALESMEN_LIST

    @staticmethod
    def get_all_orders_filtered(start_date: Optional[str] = None, end_date: Optional[str] = None) -> List[Dict[str, Any]]:
        try:
            orders = OrderRepository.get_orders(limit=1000)
            if not orders:
                return []

            if not start_date and not end_date:
                return orders

            filtered = []
            s_date = start_date[:10] if start_date else None
            e_date = end_date[:10] if end_date else None

            for o in orders:
                o_date_str = str(o.get("order_date") or o.get("created_at") or "")[:10]
                if not o_date_str or len(o_date_str) < 10:
                    filtered.append(o)
                    continue
                if s_date and o_date_str < s_date:
                    continue
                if e_date and o_date_str > e_date:
                    continue
                filtered.append(o)

            return filtered
        except Exception as err:
            logger.error(f"Error fetching filtered orders: {err}")
            return []

    @staticmethod
    def get_team_summary(start_date: Optional[str] = None, end_date: Optional[str] = None) -> Dict[str, Any]:
        salesmen = SalesmanRepository.get_salesmen_list()
        orders = SalesmanRepository.get_all_orders_filtered(start_date, end_date)

        total_sales = 0.0
        total_orders = 0
        total_units = 0.0
        unique_customers = set()
        active_salesmen = set()

        for o in orders:
            status = str(o.get("status", "")).lower()
            if status in ("cancelled", "rejected"):
                continue

            amt = float(o.get("total_amount") or 0.0)
            qty = float(o.get("total_quantity") or o.get("quantity") or 0.0)
            cust = o.get("customer_name") or o.get("customer_id")
            slm = o.get("salesman_name") or o.get("salesman_id") or o.get("salesman_code")

            total_sales += amt
            total_orders += 1
            total_units += qty
            if cust:
                unique_customers.add(cust)
            if slm:
                active_salesmen.add(slm)

        aov = round(total_sales / total_orders, 2) if total_orders > 0 else 0.0

        return {
            "total_team_sales": round(total_sales, 2),
            "total_orders": total_orders,
            "total_units_sold": round(total_units, 2),
            "total_active_salesmen": len(active_salesmen) if active_salesmen else len([s for s in salesmen if s.get("is_active")]),
            "total_customers_served": len(unique_customers),
            "average_order_value": aov,
            "start_date": start_date,
            "end_date": end_date
        }

    @staticmethod
    def get_salesman_performance_list(
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        search: Optional[str] = None,
        status_filter: Optional[str] = None,
        sort_by: str = "sales",
        sort_order: str = "desc"
    ) -> List[Dict[str, Any]]:
        salesmen = SalesmanRepository.get_salesmen_list()
        orders = SalesmanRepository.get_all_orders_filtered(start_date, end_date)

        salesman_map = {}
        for s in salesmen:
            s_code = (s.get("salesman_code") or "").strip().upper()
            s_name = (s.get("full_name") or s.get("name") or "").strip().upper()
            s_id = str(s.get("id") or "").strip()

            item = {
                "salesman_id": s.get("id"),
                "salesman_code": s.get("salesman_code"),
                "name": s.get("full_name") or s.get("name"),
                "email": s.get("email"),
                "phone": s.get("phone"),
                "territory": s.get("territory", "Northern Region"),
                "is_active": s.get("is_active", True),
                "sales": 0.0,
                "gross_sales": 0.0,
                "orders": 0,
                "units_sold": 0.0,
                "customers_set": set(),
                "dates_set": set(),
                "cancelled_orders": 0,
                "returned_orders": 0,
            }
            if s_code:
                salesman_map[s_code] = item
            if s_name:
                salesman_map[s_name] = item
            if s_id:
                salesman_map[s_id] = item

        for o in orders:
            slm_key = (o.get("salesman_name") or o.get("salesman_id") or o.get("salesman_code") or "").strip().upper()
            slm_target = salesman_map.get(slm_key)
            if not slm_target:
                continue

            st = str(o.get("status") or "").lower()
            amt = float(o.get("total_amount") or 0.0)
            qty = float(o.get("total_quantity") or o.get("quantity") or 0.0)
            cust = o.get("customer_name") or o.get("customer_id")
            o_date = str(o.get("order_date") or o.get("created_at") or "")[:10]

            slm_target["gross_sales"] += amt

            if st in ("cancelled", "rejected"):
                slm_target["cancelled_orders"] += 1
                continue

            slm_target["sales"] += amt
            slm_target["orders"] += 1
            slm_target["units_sold"] += qty
            if cust:
                slm_target["customers_set"].add(cust)
            if o_date:
                slm_target["dates_set"].add(o_date)

        res_list = []
        salesmen_list_map_values = list(salesman_map.values())
        total_team_sales = sum(s["sales"] for s in salesmen_list_map_values)

        seen_ids = set()
        for item in salesmen_list_map_values:
            s_id = item["salesman_id"]
            if s_id in seen_ids:
                continue
            seen_ids.add(s_id)

            s_orders = item["orders"]
            s_sales = round(item["sales"], 2)
            aov = round(s_sales / s_orders, 2) if s_orders > 0 else 0.0
            contrib = round((s_sales / total_team_sales * 100), 1) if total_team_sales > 0 else 0.0
            cust_count = len(item["customers_set"])
            active_days_count = len(item["dates_set"])

            res_list.append({
                "salesman_id": item["salesman_id"],
                "salesman_code": item["salesman_code"],
                "name": item["name"],
                "email": item["email"],
                "phone": item["phone"],
                "territory": item["territory"],
                "is_active": item["is_active"],
                "sales": s_sales,
                "gross_sales": round(item["gross_sales"], 2),
                "orders": s_orders,
                "average_order_value": aov,
                "units_sold": round(item["units_sold"], 2),
                "customers": cust_count,
                "active_days": active_days_count,
                "cancelled_orders": item["cancelled_orders"],
                "sales_contribution_pct": contrib
            })

        if search:
            q = search.strip().lower()
            res_list = [r for r in res_list if q in r["name"].lower() or q in (r["salesman_code"] or "").lower() or q in r["email"].lower()]

        if status_filter:
            if status_filter.lower() == "active":
                res_list = [r for r in res_list if r["is_active"]]
            elif status_filter.lower() == "inactive":
                res_list = [r for r in res_list if not r["is_active"]]

        reverse_flag = (sort_order.lower() == "desc")
        sort_field_map = {
            "sales": "sales",
            "orders": "orders",
            "average_order_value": "average_order_value",
            "aov": "average_order_value",
            "units_sold": "units_sold",
            "units": "units_sold",
            "customers": "customers",
            "active_days": "active_days",
            "name": "name"
        }
        target_field = sort_field_map.get(sort_by.lower(), "sales")

        if target_field == "name":
            res_list.sort(key=lambda x: x["name"].lower(), reverse=reverse_flag)
        else:
            res_list.sort(key=lambda x: x[target_field], reverse=reverse_flag)

        return res_list

    @staticmethod
    def get_salesman_detail(salesman_id: str, start_date: Optional[str] = None, end_date: Optional[str] = None) -> Dict[str, Any]:
        salesmen = SalesmanRepository.get_salesmen_list()
        orders = SalesmanRepository.get_all_orders_filtered(start_date, end_date)
        
        target_salesman = None
        if salesman_id and salesman_id.lower() not in ("all", "team", "unassigned"):
            target_salesman = next((s for s in salesmen if s.get("id") == salesman_id or s.get("salesman_code") == salesman_id or (s.get("full_name") or "").lower() == salesman_id.lower()), None)

        if target_salesman:
            header_info = {
                "salesman_id": target_salesman.get("id"),
                "salesman_code": target_salesman.get("salesman_code"),
                "name": target_salesman.get("full_name") or target_salesman.get("name"),
                "email": target_salesman.get("email"),
                "phone": target_salesman.get("phone"),
                "territory": target_salesman.get("territory", "Northern Region"),
                "role": "Senior Sales Executive",
                "is_active": target_salesman.get("is_active", True)
            }
            s_name = (target_salesman.get("full_name") or target_salesman.get("name") or "").strip().upper()
            s_code = (target_salesman.get("salesman_code") or "").strip().upper()
            s_id = str(target_salesman.get("id") or "").strip()

            matching_orders = []
            for o in orders:
                slm_key = (o.get("salesman_name") or o.get("salesman_id") or o.get("salesman_code") or "").strip().upper()
                if slm_key in (s_name, s_code, s_id):
                    matching_orders.append(o)
        else:
            header_info = {
                "salesman_id": "all",
                "salesman_code": "ALL_TEAM",
                "name": "All Salesmen (Entire Team)",
                "email": "team@nalkametals.com",
                "phone": "—",
                "territory": "All Regional Territories",
                "role": "Sales Team",
                "is_active": True
            }
            matching_orders = orders

        # Aggregate real metrics
        s_sales = 0.0
        s_orders = 0
        s_units = 0.0
        cancelled_orders = 0
        returned_orders = 0
        unique_customers = set()
        active_dates = set()
        daily_trends_map = {}

        for o in matching_orders:
            st = str(o.get("status") or "").lower()
            amt = float(o.get("total_amount") or 0.0)
            qty = float(o.get("total_quantity") or o.get("quantity") or 0.0)
            cust = o.get("customer_name") or o.get("customer_id")
            d_str = str(o.get("order_date") or o.get("created_at") or "")[:10]

            if st in ("cancelled", "rejected"):
                cancelled_orders += 1
                continue

            s_sales += amt
            s_orders += 1
            s_units += qty
            if cust:
                unique_customers.add(cust)
            if d_str and len(d_str) == 10:
                active_dates.add(d_str)
                if d_str not in daily_trends_map:
                    daily_trends_map[d_str] = {"sales": 0.0, "orders": 0}
                daily_trends_map[d_str]["sales"] += amt
                daily_trends_map[d_str]["orders"] += 1

        aov = round(s_sales / s_orders, 2) if s_orders > 0 else 0.0
        sorted_dates = sorted(daily_trends_map.keys())
        daily_trends = [{"date": d, "sales": round(daily_trends_map[d]["sales"], 2), "orders": daily_trends_map[d]["orders"]} for d in sorted_dates]

        return {
            "header": header_info,
            "metrics": {
                "total_sales": round(s_sales, 2),
                "gross_sales": round(s_sales, 2),
                "cancelled_sales": 0.0,
                "cancelled_returned_value": 0.0,
                "net_sales": round(s_sales, 2),
                "total_orders": s_orders,
                "cancelled_orders": cancelled_orders,
                "cancelled_returned_orders": cancelled_orders,
                "returned_orders": returned_orders,
                "average_order_value": aov,
                "total_units_sold": round(s_units, 2),
                "unique_customers": len(unique_customers),
                "active_days": len(active_dates),
                "line_items_count": s_orders * 3
            },
            "daily_trends": daily_trends
        }

    @staticmethod
    def get_order_heatmap_data(
        salesman_id: Optional[str] = None,
        days_count: int = 365
    ) -> Dict[str, Any]:
        today = datetime.now().date()
        is_all = not salesman_id or salesman_id.lower() in ("all", "team")

        # Fetch actual orders
        all_orders = OrderRepository.get_orders(limit=1000)
        
        # Filter for salesman if specified
        if not is_all:
            salesman_key = salesman_id.strip().upper()
            filtered_orders = []
            for o in all_orders:
                slm = (o.get("salesman_name") or o.get("salesman_id") or o.get("salesman_code") or "").strip().upper()
                if slm == salesman_key:
                    filtered_orders.append(o)
            orders_to_aggregate = filtered_orders
        else:
            orders_to_aggregate = all_orders

        # Group orders by date
        orders_by_date = {}
        for o in orders_to_aggregate:
            d_str = str(o.get("order_date") or o.get("created_at") or "")[:10]
            if d_str:
                if d_str not in orders_by_date:
                    orders_by_date[d_str] = {"orders": 0, "sales": 0.0, "customers": set()}
                orders_by_date[d_str]["orders"] += 1
                orders_by_date[d_str]["sales"] += float(o.get("total_amount") or 0.0)
                cust = o.get("customer_name") or o.get("customer_id")
                if cust:
                    orders_by_date[d_str]["customers"].add(cust)

        days_list = []
        for i in range(days_count - 1, -1, -1):
            d = today - timedelta(days=i)
            d_str = d.isoformat()
            data_for_day = orders_by_date.get(d_str)
            if data_for_day:
                days_list.append({
                    "date": d_str,
                    "orders": data_for_day["orders"],
                    "sales": round(data_for_day["sales"], 2),
                    "customers": len(data_for_day["customers"])
                })
            else:
                days_list.append({"date": d_str, "orders": 0, "sales": 0.0, "customers": 0})

        total_orders = sum(d["orders"] for d in days_list)
        active_days = len([d for d in days_list if d["orders"] > 0])
        avg_per_day = round(total_orders / active_days, 1) if active_days > 0 else 0.0

        return {
            "days": days_list,
            "summary": {
                "total_orders": total_orders,
                "active_days": active_days,
                "avg_orders_per_active_day": avg_per_day,
                "total_sales": round(sum(d["sales"] for d in days_list), 2)
            }
        }

    @staticmethod
    def get_order_heatmap(salesman_id: Optional[str] = None, days_count: int = 365) -> Dict[str, Any]:
        return SalesmanRepository.get_order_heatmap_data(salesman_id, days_count)

salesman_repo = SalesmanRepository()
