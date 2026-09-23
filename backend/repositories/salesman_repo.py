# backend/repositories/salesman_repo.py
import logging
import sqlite3
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

from repositories.order_repo import OrderRepository

logger = logging.getLogger("salesman_repo")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DB_PATH = DATA_DIR / "historical_sales.db"

# Canonical salesman territory mapping
SALESMAN_TERRITORY_MAP = {
    "ANKIT": "Delhi NCR / East",
    "RAVINDER KUMAR": "Gurugram / Haryana North",
    "CHANDRA PRAKASH": "Haryana South / Rewari",
    "SAURAV": "Panipat / Ambala",
    "RAVINDER  - NOIDA": "Uttar Pradesh / Noida",
    "RAVINDER - NOIDA": "Uttar Pradesh / Noida",
    "NALKA": "Central Hub",
    "YOJIT": "Faridabad / Palwal",
    "Unresolved": "Direct Counter Sales"
}

SALESMAN_CODE_MAP = {
    "ANKIT": "TLY-SLM-001",
    "CHANDRA PRAKASH": "TLY-SLM-002",
    "NALKA": "TLY-SLM-003",
    "RAVINDER  - NOIDA": "TLY-SLM-004",
    "RAVINDER - NOIDA": "TLY-SLM-004",
    "RAVINDER KUMAR": "TLY-SLM-005",
    "SAURAV": "TLY-SLM-006",
    "YOJIT": "TLY-SLM-007",
    "Unresolved": "TLY-SLM-UNR"
}

CODE_TO_SALESMAN_MAP = {v: k for k, v in SALESMAN_CODE_MAP.items()}
CODE_TO_SALESMAN_MAP["TLY-SLM-UNR"] = "Unresolved"

class SalesmanRepository:

    @staticmethod
    def get_connection():
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        return conn

    @classmethod
    def get_salesmen_list(cls) -> List[Dict[str, Any]]:
        conn = cls.get_connection()
        try:
            query = """
                SELECT 
                    COALESCE(NULLIF(salesman_name, ''), 'Unresolved') as name,
                    COALESCE(NULLIF(salesman_id, ''), 'TLY-SLM-UNR') as id
                FROM historical_sales
                GROUP BY name
                ORDER BY COUNT(*) DESC;
            """
            rows = conn.execute(query).fetchall()
            results = []
            for r in rows:
                name = r["name"]
                slm_id = r["id"] or SALESMAN_CODE_MAP.get(name, "SLM-100")
                results.append({
                    "id": slm_id,
                    "salesman_code": slm_id,
                    "full_name": name,
                    "name": name,
                    "email": f"{name.lower().replace(' ', '.').replace('-', '')}@nalkametals.com",
                    "phone": "—",
                    "role": "salesman",
                    "is_active": True,
                    "territory": SALESMAN_TERRITORY_MAP.get(name, "Northern Region")
                })
            return results
        except Exception as err:
            logger.error(f"Error fetching salesmen list from DB: {err}")
            return []
        finally:
            conn.close()

    @classmethod
    def get_team_summary(cls, start_date: Optional[str] = None, end_date: Optional[str] = None) -> Dict[str, Any]:
        conn = cls.get_connection()
        try:
            where_parts = []
            params = []
            if start_date:
                where_parts.append("s.voucher_date >= ?")
                params.append(start_date[:10])
            if end_date:
                where_parts.append("s.voucher_date <= ?")
                params.append(end_date[:10])
            where_sql = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""

            query = f"""
                SELECT 
                    COUNT(DISTINCT s.voucher_number) as total_orders,
                    ROUND(COALESCE(SUM(s.voucher_amount), 0.0), 2) as total_team_sales,
                    COUNT(DISTINCT s.customer_name) as total_customers,
                    COUNT(DISTINCT s.salesman_name) as total_active_salesmen
                FROM historical_sales s
                {where_sql};
            """
            row = conn.execute(query, params).fetchone()

            # Quantity of units sold
            units_query = f"""
                SELECT ROUND(COALESCE(SUM(ABS(i.quantity)), 0.0), 1) as total_units
                FROM historical_sale_items i
                JOIN historical_sales s ON i.historical_sale_id = s.id
                {where_sql};
            """
            units_row = conn.execute(units_query, params).fetchone()

            total_sales = float(row["total_team_sales"] or 0.0) if row else 0.0
            total_orders = int(row["total_orders"] or 0) if row else 0
            total_customers = int(row["total_customers"] or 0) if row else 0
            active_salesmen = int(row["total_active_salesmen"] or 0) if row else 0
            total_units = float(units_row["total_units"] or 0.0) if units_row else 0.0
            aov = round(total_sales / total_orders, 2) if total_orders > 0 else 0.0

            return {
                "total_team_sales": total_sales,
                "total_orders": total_orders,
                "total_units_sold": total_units,
                "total_active_salesmen": max(active_salesmen, 1),
                "total_customers_served": total_customers,
                "average_order_value": aov,
                "start_date": start_date,
                "end_date": end_date
            }
        except Exception as err:
            logger.error(f"Error fetching team summary: {err}")
            return {
                "total_team_sales": 0.0,
                "total_orders": 0,
                "total_units_sold": 0.0,
                "total_active_salesmen": 0,
                "total_customers_served": 0,
                "average_order_value": 0.0
            }
        finally:
            conn.close()

    @classmethod
    def get_salesman_performance_list(
        cls,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        search: Optional[str] = None,
        status_filter: Optional[str] = None,
        sort_by: str = "sales",
        sort_order: str = "desc"
    ) -> List[Dict[str, Any]]:
        conn = cls.get_connection()
        try:
            where_parts = []
            params = []
            if start_date:
                where_parts.append("s.voucher_date >= ?")
                params.append(start_date[:10])
            if end_date:
                where_parts.append("s.voucher_date <= ?")
                params.append(end_date[:10])
            where_sql = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""

            query = f"""
                SELECT 
                    COALESCE(NULLIF(s.salesman_id, ''), 'TLY-SLM-UNR') as salesman_id,
                    COALESCE(NULLIF(s.salesman_name, ''), 'Unresolved') as name,
                    ROUND(SUM(s.voucher_amount), 2) as sales,
                    COUNT(DISTINCT s.voucher_number) as orders,
                    COUNT(DISTINCT s.customer_name) as customers,
                    COUNT(DISTINCT s.voucher_date) as active_days
                FROM historical_sales s
                {where_sql}
                GROUP BY s.salesman_id, s.salesman_name
                ORDER BY sales DESC;
            """
            rows = conn.execute(query, params).fetchall()

            # Get units sold per salesman
            units_q = f"""
                SELECT 
                    COALESCE(NULLIF(s.salesman_name, ''), 'Unresolved') as name,
                    ROUND(COALESCE(SUM(ABS(i.quantity)), 0.0), 1) as units_sold
                FROM historical_sale_items i
                JOIN historical_sales s ON i.historical_sale_id = s.id
                {where_sql}
                GROUP BY s.salesman_name;
            """
            units_map = {
                r["name"]: float(r["units_sold"] or 0.0)
                for r in conn.execute(units_q, params).fetchall()
            }

            assigned_counts = cls.get_all_salesmen_assigned_counts()
            total_team_sales = sum(float(r["sales"] or 0.0) for r in rows)
            res_list = []
            for r in rows:
                name = r["name"]
                slm_id = r["salesman_id"] or SALESMAN_CODE_MAP.get(name, "SLM-100")
                s_sales = float(r["sales"] or 0.0)
                s_orders = int(r["orders"] or 0)
                aov = round(s_sales / s_orders, 2) if s_orders > 0 else 0.0
                contrib = round((s_sales / total_team_sales * 100), 1) if total_team_sales > 0 else 0.0
                assigned_cnt = assigned_counts.get(slm_id, assigned_counts.get(name, assigned_counts.get(name.upper(), 0)))

                res_list.append({
                    "salesman_id": slm_id,
                    "salesman_code": slm_id,
                    "name": name,
                    "email": f"{name.lower().replace(' ', '.').replace('-', '')}@nalkametals.com",
                    "phone": "—",
                    "location": SALESMAN_TERRITORY_MAP.get(name, "Northern Region"),
                    "territory": SALESMAN_TERRITORY_MAP.get(name, "Northern Region"),
                    "is_active": True,
                    "sales": s_sales,
                    "gross_sales": s_sales,
                    "orders": s_orders,
                    "average_order_value": aov,
                    "units_sold": units_map.get(name, 0.0),
                    "customers": int(r["customers"] or 0),
                    "dealers": int(r["customers"] or 0),
                    "assigned_customers": assigned_cnt,
                    "active_days": int(r["active_days"] or 0),
                    "cancelled_orders": 0,
                    "sales_contribution_pct": contrib
                })

            if search:
                q = search.strip().lower()
                res_list = [r for r in res_list if q in r["name"].lower() or q in (r["salesman_code"] or "").lower() or q in r["territory"].lower()]

            reverse_flag = (sort_order.lower() == "desc")
            sort_field_map = {
                "sales": "sales",
                "orders": "orders",
                "average_order_value": "average_order_value",
                "aov": "average_order_value",
                "units_sold": "units_sold",
                "units": "units_sold",
                "customers": "customers",
                "dealers": "dealers",
                "active_days": "active_days",
                "name": "name"
            }
            target_field = sort_field_map.get(sort_by.lower(), "sales")
            if target_field == "name":
                res_list.sort(key=lambda x: x["name"].lower(), reverse=reverse_flag)
            else:
                res_list.sort(key=lambda x: x[target_field], reverse=reverse_flag)

            return res_list
        except Exception as err:
            logger.error(f"Error fetching salesmen performance list: {err}")
            return []
        finally:
            conn.close()

    @classmethod
    def get_all_salesmen_assigned_counts(cls) -> Dict[str, int]:
        from config.database import get_db_client
        client = get_db_client()
        if not client:
            return {}
        try:
            res = client.table("salesman_customer_catalog").select("salesman_id, salesman_code, salesman_name").execute()
            counts = {}
            for r in res.data or []:
                code = r.get("salesman_code")
                name = r.get("salesman_name")
                sid = r.get("salesman_id")
                if code:
                    counts[code] = counts.get(code, 0) + 1
                if name:
                    counts[name] = counts.get(name, 0) + 1
                    counts[name.upper()] = counts.get(name.upper(), 0) + 1
                if sid:
                    counts[sid] = counts.get(sid, 0) + 1
            return counts
        except Exception as err:
            logger.warning(f"Error fetching catalog assigned counts: {err}")
            return {}

    @classmethod
    def get_salesman_assigned_customers(cls, salesman_id: str) -> List[Dict[str, Any]]:
        import uuid
        from config.database import get_db_client
        client = get_db_client()
        if not client:
            return []
        try:
            canonical_name = CODE_TO_SALESMAN_MAP.get(salesman_id, salesman_id)
            code = SALESMAN_CODE_MAP.get(canonical_name, salesman_id)
            is_unresolved = (
                str(salesman_id).upper() in ("TLY-SLM-UNR", "UNRESOLVED", "DIRECT")
                or canonical_name.lower() in ("unresolved", "direct", "direct / house account")
            )

            is_uuid = False
            try:
                uuid.UUID(str(salesman_id))
                is_uuid = True
            except (ValueError, AttributeError):
                is_uuid = False

            query = client.table("salesman_customer_catalog").select("*")
            if is_unresolved:
                query = query.or_("salesman_code.eq.DIRECT,salesman_name.ilike.%Direct%,salesman_name.ilike.%Unresolved%")
            elif is_uuid:
                query = query.or_(f"salesman_id.eq.{salesman_id},salesman_code.eq.{code},salesman_name.ilike.%{canonical_name}%")
            else:
                query = query.or_(f"salesman_code.eq.{code},salesman_name.ilike.%{canonical_name}%")

            res = query.order("shop_name").limit(1000).execute()
            customers = []
            for r in res.data or []:
                customers.append({
                    "customer_id": r.get("customer_id"),
                    "customer_code": r.get("customer_code") or r.get("Customer Code") or "—",
                    "shop_name": r.get("shop_name") or r.get("Shop Name") or r.get("location_name") or "Unnamed Customer",
                    "name": r.get("shop_name") or r.get("Shop Name") or r.get("location_name") or "Unnamed Customer",
                    "city": r.get("city") or r.get("City") or "Faridabad",
                    "state": r.get("state") or r.get("State") or "Haryana",
                    "location_id": r.get("location_id") or r.get("Location ID") or "—",
                    "location_name": r.get("location_name") or r.get("shop_name"),
                    "phone": r.get("Phone") or r.get("phone") or "—",
                    "contact_person": r.get("Contact Person") or r.get("contact_person") or "—"
                })
            return customers
        except Exception as err:
            logger.error(f"Error fetching assigned customers for salesman '{salesman_id}': {err}")
            return []

    @classmethod
    def get_salesman_detail(cls, salesman_id: str, start_date: Optional[str] = None, end_date: Optional[str] = None) -> Dict[str, Any]:
        conn = cls.get_connection()
        try:
            where_parts = []
            params = []
            is_all = not salesman_id or salesman_id.lower() in ("all", "team", "unassigned_all")

            canonical_name = CODE_TO_SALESMAN_MAP.get(salesman_id, salesman_id)
            is_unresolved = not is_all and (salesman_id.upper() in ("TLY-SLM-UNR", "UNRESOLVED") or canonical_name.lower() == "unresolved")

            if is_unresolved:
                where_parts.append("(s.salesman_id = 'TLY-SLM-UNR' OR UPPER(COALESCE(s.salesman_name, '')) IN ('UNRESOLVED', '') OR s.salesman_id IS NULL)")
            elif not is_all:
                where_parts.append("(UPPER(s.salesman_name) = UPPER(?) OR s.salesman_id = ? OR UPPER(s.salesman_name) = UPPER(?))")
                params.extend([salesman_id, salesman_id, canonical_name])

            if start_date:
                where_parts.append("s.voucher_date >= ?")
                params.append(start_date[:10])
            if end_date:
                where_parts.append("s.voucher_date <= ?")
                params.append(end_date[:10])
            where_sql = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""

            # Name & header
            display_name = "Direct Counter Sales (Unresolved)" if is_unresolved else (canonical_name if not is_all else "All Salesmen (Entire Team)")
            header_info = {
                "salesman_id": "TLY-SLM-UNR" if is_unresolved else (salesman_id if not is_all else "all"),
                "salesman_code": "TLY-SLM-UNR" if is_unresolved else (salesman_id if not is_all else "ALL_TEAM"),
                "name": display_name,
                "email": "unresolved@nalkametals.com" if is_unresolved else f"{canonical_name.lower().replace(' ', '.').replace('-', '')}@nalkametals.com",
                "phone": "—",
                "territory": SALESMAN_TERRITORY_MAP.get(canonical_name, "Direct Counter Sales" if is_unresolved else "Northern Region"),
                "role": "Direct Sales / Counter Sales" if is_unresolved else ("Sales Executive" if not is_all else "Sales Team"),
                "is_active": True
            }

            # Metrics
            metrics_q = f"""
                SELECT 
                    ROUND(COALESCE(SUM(s.voucher_amount), 0.0), 2) as total_sales,
                    COUNT(DISTINCT s.voucher_number) as total_orders,
                    COUNT(DISTINCT s.customer_name) as unique_customers,
                    COUNT(DISTINCT s.voucher_date) as active_days
                FROM historical_sales s
                {where_sql};
            """
            m_row = conn.execute(metrics_q, params).fetchone()

            units_q = f"""
                SELECT 
                    COUNT(i.id) as total_line_items,
                    ROUND(COALESCE(SUM(ABS(i.quantity)), 0.0), 1) as total_units
                FROM historical_sale_items i
                JOIN historical_sales s ON i.historical_sale_id = s.id
                {where_sql};
            """
            u_row = conn.execute(units_q, params).fetchone()

            tot_sales = float(m_row["total_sales"] or 0.0) if m_row else 0.0
            tot_orders = int(m_row["total_orders"] or 0) if m_row else 0
            aov = round(tot_sales / tot_orders, 2) if tot_orders > 0 else 0.0

            # Daily trends
            trend_q = f"""
                SELECT 
                    s.voucher_date as date,
                    ROUND(SUM(s.voucher_amount), 2) as sales,
                    COUNT(DISTINCT s.voucher_number) as orders
                FROM historical_sales s
                {where_sql}
                GROUP BY s.voucher_date
                ORDER BY s.voucher_date ASC;
            """
            daily_trends = [
                {
                    "date": r["date"],
                    "sales": float(r["sales"] or 0.0),
                    "orders": int(r["orders"] or 0)
                }
                for r in conn.execute(trend_q, params).fetchall()
            ]

            # Fetch authoritative assigned customers from catalog
            assigned_customers = cls.get_salesman_assigned_customers(salesman_id)
            assigned_count = len(assigned_customers)

            return {
                "header": header_info,
                "metrics": {
                    "total_sales": tot_sales,
                    "gross_sales": tot_sales,
                    "cancelled_sales": 0.0,
                    "cancelled_returned_value": 0.0,
                    "net_sales": tot_sales,
                    "total_orders": tot_orders,
                    "cancelled_orders": 0,
                    "cancelled_returned_orders": 0,
                    "returned_orders": 0,
                    "average_order_value": aov,
                    "total_units_sold": float(u_row["total_units"] or 0.0) if u_row else 0.0,
                    "unique_customers": int(m_row["unique_customers"] or 0) if m_row else 0,
                    "assigned_customers_count": assigned_count,
                    "active_days": int(m_row["active_days"] or 0) if m_row else 0,
                    "line_items_count": int(u_row["total_line_items"] or 0) if u_row else (tot_orders * 4)
                },
                "assigned_customers": assigned_customers,
                "daily_trends": daily_trends
            }
        except Exception as err:
            logger.error(f"Error fetching salesman detail: {err}")
            return {
                "header": {"name": salesman_id, "salesman_id": salesman_id},
                "metrics": {},
                "assigned_customers": [],
                "daily_trends": []
            }
        finally:
            conn.close()

    @classmethod
    def get_order_heatmap_data(
        cls,
        salesman_id: Optional[str] = None,
        days_count: int = 365
    ) -> Dict[str, Any]:
        conn = cls.get_connection()
        try:
            where_parts = []
            params = []
            is_all = not salesman_id or salesman_id.lower() in ("all", "team")
            canonical_name = CODE_TO_SALESMAN_MAP.get(salesman_id or "", salesman_id or "")
            is_unresolved = not is_all and ((salesman_id and salesman_id.upper() in ("TLY-SLM-UNR", "UNRESOLVED")) or canonical_name.lower() == "unresolved")

            if is_unresolved:
                where_parts.append("(s.salesman_id = 'TLY-SLM-UNR' OR UPPER(COALESCE(s.salesman_name, '')) IN ('UNRESOLVED', '') OR s.salesman_id IS NULL)")
            elif not is_all:
                where_parts.append("(UPPER(s.salesman_name) = UPPER(?) OR s.salesman_id = ? OR UPPER(s.salesman_name) = UPPER(?))")
                params.extend([salesman_id, salesman_id, canonical_name])

            where_sql = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""

            query = f"""
                SELECT 
                    s.voucher_date as date,
                    COUNT(DISTINCT s.voucher_number) as orders,
                    ROUND(SUM(s.voucher_amount), 2) as sales,
                    COUNT(DISTINCT s.customer_name) as customers
                FROM historical_sales s
                {where_sql}
                GROUP BY s.voucher_date
                ORDER BY s.voucher_date ASC;
            """
            rows = conn.execute(query, params).fetchall()
            orders_by_date = {
                r["date"]: {
                    "orders": int(r["orders"]),
                    "sales": float(r["sales"]),
                    "customers": int(r["customers"])
                }
                for r in rows
            }

            # Generate full day list back from today (dynamic — never hardcoded)
            ref_date = datetime.utcnow().date()
            days_list = []
            for i in range(days_count - 1, -1, -1):
                d = ref_date - timedelta(days=i)
                d_str = d.isoformat()
                data_for_day = orders_by_date.get(d_str)
                if data_for_day:
                    days_list.append({
                        "date": d_str,
                        "orders": data_for_day["orders"],
                        "sales": data_for_day["sales"],
                        "customers": data_for_day["customers"]
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
        except Exception as err:
            logger.error(f"Error fetching heatmap data: {err}")
            return {"days": [], "summary": {}}
        finally:
            conn.close()

    @staticmethod
    def get_order_heatmap(salesman_id: Optional[str] = None, days_count: int = 365) -> Dict[str, Any]:
        return SalesmanRepository.get_order_heatmap_data(salesman_id, days_count)

salesman_repo = SalesmanRepository()
