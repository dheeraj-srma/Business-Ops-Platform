# backend/repositories/historical_sales_repo.py
"""
Authoritative Historical Sales, Returns & Procurement Relational Repository.
Manages relational storage and high-performance SQL aggregations for imported
historical Tally records (2026-06-01 -> 2026-09-21) across all operational dimensions:
  SALE -> CUSTOMER -> SALESMAN -> LOCATION -> PRODUCT / SKU -> CATEGORY.
"""

import os
import sqlite3
import logging
from pathlib import Path
from decimal import Decimal
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger("historical_sales_repo")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DB_PATH = DATA_DIR / "historical_sales.db"


class HistoricalSalesRepository:
    _initialized = False

    @classmethod
    def get_connection(cls) -> sqlite3.Connection:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        return conn

    @classmethod
    def init_db(cls, force: bool = False) -> None:
        """Initializes relational schema with complete entity mapping attributes."""
        if cls._initialized and not force and DB_PATH.exists():
            return
        
        conn = cls.get_connection()
        try:
            with conn:
                if force:
                    conn.executescript("""
                    DROP TABLE IF EXISTS historical_sale_items;
                    DROP TABLE IF EXISTS historical_sales;
                    DROP TABLE IF EXISTS historical_return_items;
                    DROP TABLE IF EXISTS historical_returns;
                    DROP TABLE IF EXISTS historical_purchase_items;
                    DROP TABLE IF EXISTS historical_purchases;
                    """)
                conn.executescript("""
                CREATE TABLE IF NOT EXISTS historical_sales (
                    id TEXT PRIMARY KEY,
                    voucher_number TEXT NOT NULL,
                    voucher_date TEXT NOT NULL,
                    customer_id TEXT,
                    customer_name TEXT NOT NULL,
                    customer_name_source TEXT,
                    customer_gstin TEXT,
                    customer_gstin_source TEXT,
                    customer_address TEXT,
                    customer_address_source TEXT,
                    customer_mapping_status TEXT NOT NULL DEFAULT 'UNRESOLVED',
                    salesman_id TEXT,
                    salesman_name TEXT NOT NULL DEFAULT 'Unassigned / Unresolved',
                    salesman_mapping_status TEXT NOT NULL DEFAULT 'UNRESOLVED',
                    city TEXT NOT NULL DEFAULT 'Unknown',
                    state TEXT NOT NULL DEFAULT 'Unknown',
                    region TEXT NOT NULL DEFAULT 'Unresolved',
                    location_mapping_status TEXT NOT NULL DEFAULT 'UNRESOLVED',
                    voucher_amount REAL NOT NULL DEFAULT 0.0,
                    gross_amount REAL DEFAULT 0.0,
                    source TEXT NOT NULL DEFAULT 'TALLY_HISTORICAL_IMPORT',
                    source_import_id TEXT NOT NULL,
                    created_at TEXT DEFAULT (datetime('now')),
                    updated_at TEXT DEFAULT (datetime('now')),
                    UNIQUE(source, voucher_number)
                );

                CREATE TABLE IF NOT EXISTS historical_sale_items (
                    id TEXT PRIMARY KEY,
                    historical_sale_id TEXT NOT NULL REFERENCES historical_sales(id) ON DELETE CASCADE,
                    product_id TEXT,
                    product_name TEXT NOT NULL,
                    sku TEXT,
                    category_id TEXT,
                    category_name TEXT NOT NULL DEFAULT 'Uncategorized / Unresolved',
                    product_mapping_status TEXT NOT NULL DEFAULT 'UNRESOLVED',
                    quantity REAL NOT NULL DEFAULT 0.0,
                    unit TEXT DEFAULT 'NOS',
                    unit_rate REAL,
                    line_amount REAL NOT NULL DEFAULT 0.0,
                    source_line_id TEXT NOT NULL,
                    item_description TEXT,
                    created_at TEXT DEFAULT (datetime('now')),
                    UNIQUE(historical_sale_id, source_line_id)
                );

                CREATE TABLE IF NOT EXISTS historical_returns (
                    id TEXT PRIMARY KEY,
                    voucher_number TEXT NOT NULL,
                    voucher_date TEXT NOT NULL,
                    customer_id TEXT,
                    customer_name TEXT NOT NULL,
                    customer_gstin TEXT,
                    salesman_id TEXT,
                    salesman_name TEXT DEFAULT 'Unassigned / Unresolved',
                    city TEXT DEFAULT 'Unknown',
                    state TEXT DEFAULT 'Unknown',
                    region TEXT DEFAULT 'Unresolved',
                    voucher_amount REAL NOT NULL DEFAULT 0.0,
                    source TEXT NOT NULL DEFAULT 'TALLY_HISTORICAL_IMPORT',
                    source_import_id TEXT NOT NULL,
                    created_at TEXT DEFAULT (datetime('now')),
                    updated_at TEXT DEFAULT (datetime('now')),
                    UNIQUE(source, voucher_number)
                );

                CREATE TABLE IF NOT EXISTS historical_return_items (
                    id TEXT PRIMARY KEY,
                    historical_return_id TEXT NOT NULL REFERENCES historical_returns(id) ON DELETE CASCADE,
                    product_id TEXT,
                    product_name TEXT NOT NULL,
                    sku TEXT,
                    category_name TEXT DEFAULT 'Uncategorized',
                    quantity REAL NOT NULL DEFAULT 0.0,
                    unit TEXT DEFAULT 'NOS',
                    unit_rate REAL,
                    line_amount REAL NOT NULL DEFAULT 0.0,
                    source_line_id TEXT NOT NULL,
                    created_at TEXT DEFAULT (datetime('now')),
                    UNIQUE(historical_return_id, source_line_id)
                );

                CREATE TABLE IF NOT EXISTS historical_purchases (
                    id TEXT PRIMARY KEY,
                    voucher_number TEXT NOT NULL,
                    voucher_date TEXT NOT NULL,
                    supplier_id TEXT,
                    supplier_name TEXT NOT NULL,
                    supplier_gstin TEXT,
                    voucher_amount REAL NOT NULL DEFAULT 0.0,
                    source TEXT NOT NULL DEFAULT 'TALLY_HISTORICAL_IMPORT',
                    source_import_id TEXT NOT NULL,
                    created_at TEXT DEFAULT (datetime('now')),
                    updated_at TEXT DEFAULT (datetime('now')),
                    UNIQUE(source, voucher_number)
                );

                CREATE TABLE IF NOT EXISTS historical_purchase_items (
                    id TEXT PRIMARY KEY,
                    historical_purchase_id TEXT NOT NULL REFERENCES historical_purchases(id) ON DELETE CASCADE,
                    product_id TEXT,
                    product_name TEXT NOT NULL,
                    quantity REAL NOT NULL DEFAULT 0.0,
                    unit TEXT DEFAULT 'NOS',
                    unit_rate REAL,
                    line_amount REAL NOT NULL DEFAULT 0.0,
                    source_line_id TEXT NOT NULL,
                    created_at TEXT DEFAULT (datetime('now')),
                    UNIQUE(historical_purchase_id, source_line_id)
                );

                CREATE INDEX IF NOT EXISTS idx_hist_sales_date ON historical_sales(voucher_date);
                CREATE INDEX IF NOT EXISTS idx_hist_sales_cust ON historical_sales(customer_id);
                CREATE INDEX IF NOT EXISTS idx_hist_sales_slm ON historical_sales(salesman_name);
                CREATE INDEX IF NOT EXISTS idx_hist_sales_state ON historical_sales(state);
                CREATE INDEX IF NOT EXISTS idx_hist_sales_city ON historical_sales(city);
                CREATE INDEX IF NOT EXISTS idx_hist_sale_items_prod ON historical_sale_items(product_id);
                CREATE INDEX IF NOT EXISTS idx_hist_sale_items_cat ON historical_sale_items(category_name);
                CREATE INDEX IF NOT EXISTS idx_hist_returns_date ON historical_returns(voucher_date);
                CREATE INDEX IF NOT EXISTS idx_hist_purchases_date ON historical_purchases(voucher_date);
                """)
            cls._initialized = True
        finally:
            conn.close()

    @classmethod
    def _build_sales_filter(
        cls,
        prefix: str = "",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        salesman: Optional[str] = None,
        customer: Optional[str] = None,
        state: Optional[str] = None,
        city: Optional[str] = None,
        category: Optional[str] = None
    ) -> Tuple[str, List[Any], bool]:
        """Constructs parameterized SQL WHERE clause and join flags for multi-dimensional cross-filtering."""
        where_clauses = []
        params = []
        needs_item_join = False
        p = f"{prefix}." if prefix else ""

        if start_date:
            where_clauses.append(f"{p}voucher_date >= ?")
            params.append(start_date)
        if end_date:
            where_clauses.append(f"{p}voucher_date <= ?")
            params.append(end_date)
        if salesman and salesman.upper() not in ["ALL", ""]:
            where_clauses.append(f"UPPER({p}salesman_name) = UPPER(?)")
            params.append(salesman)
        if customer and customer.upper() not in ["ALL", ""]:
            where_clauses.append(f"(UPPER({p}customer_name) = UPPER(?) OR {p}customer_id = ?)")
            params.extend([customer, customer])
        if state and state.upper() not in ["ALL", ""]:
            where_clauses.append(f"UPPER({p}state) = UPPER(?)")
            params.append(state)
        if city and city.upper() not in ["ALL", ""]:
            where_clauses.append(f"UPPER({p}city) = UPPER(?)")
            params.append(city)
        if category and category.upper() not in ["ALL", ""]:
            needs_item_join = True
            where_clauses.append("UPPER(i.category_name) = UPPER(?)")
            params.append(category)

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        return where_sql, params, needs_item_join

    @classmethod
    def get_summary_kpis(
        cls,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        salesman: Optional[str] = None,
        customer: Optional[str] = None,
        state: Optional[str] = None,
        city: Optional[str] = None,
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        """Calculates factual revenue, voucher counts, active customers, and AOV with cross-filter support."""
        cls.init_db()
        conn = cls.get_connection()
        try:
            where_sql, params, needs_item_join = cls._build_sales_filter(
                prefix="s", start_date=start_date, end_date=end_date,
                salesman=salesman, customer=customer, state=state, city=city, category=category
            )

            if needs_item_join:
                query = f"""
                    SELECT 
                        COUNT(DISTINCT s.voucher_number) as total_vouchers,
                        COALESCE(SUM(i.line_amount), 0.0) as total_revenue,
                        COUNT(DISTINCT COALESCE(s.customer_id, s.customer_name)) as active_customers,
                        MIN(s.voucher_date) as earliest_date,
                        MAX(s.voucher_date) as latest_date
                    FROM historical_sales s
                    JOIN historical_sale_items i ON s.id = i.historical_sale_id
                    {where_sql};
                """
            else:
                query = f"""
                    SELECT 
                        COUNT(DISTINCT s.voucher_number) as total_vouchers,
                        COALESCE(SUM(s.voucher_amount), 0.0) as total_revenue,
                        COUNT(DISTINCT COALESCE(s.customer_id, s.customer_name)) as active_customers,
                        MIN(s.voucher_date) as earliest_date,
                        MAX(s.voucher_date) as latest_date
                    FROM historical_sales s
                    {where_sql};
                """

            cur = conn.execute(query, params)
            row = cur.fetchone()

            tot_vch = row["total_vouchers"] if row else 0
            tot_rev = round(float(row["total_revenue"]), 2) if row else 0.0
            aov = round(tot_rev / tot_vch, 2) if tot_vch > 0 else 0.0

            # Returns within range (only unfiltered or date-filtered)
            ret_where, ret_params, _ = cls._build_sales_filter(start_date=start_date, end_date=end_date)
            ret_query = f"SELECT COALESCE(SUM(ABS(voucher_amount)), 0.0) as ret_val, COUNT(*) as ret_count FROM historical_returns {ret_where};"
            ret_row = conn.execute(ret_query, ret_params).fetchone()
            ret_val = round(float(ret_row["ret_val"]), 2) if ret_row else 0.0
            ret_count = ret_row["ret_count"] if ret_row else 0

            # Purchases within range
            pur_query = f"SELECT COALESCE(SUM(ABS(voucher_amount)), 0.0) as pur_val, COUNT(*) as pur_count FROM historical_purchases {ret_where};"
            pur_row = conn.execute(pur_query, ret_params).fetchone()
            pur_val = round(float(pur_row["pur_val"]), 2) if pur_row else 0.0
            pur_count = pur_row["pur_count"] if pur_row else 0

            return {
                "total_revenue": tot_rev,
                "total_vouchers": tot_vch,
                "total_orders": tot_vch,
                "aov": aov,
                "active_customers": row["active_customers"] if row else 0,
                "earliest_date": row["earliest_date"] if row else None,
                "latest_date": row["latest_date"] if row else None,
                "returns_value": ret_val,
                "returns_count": ret_count,
                "purchase_value": pur_val,
                "purchase_count": pur_count,
            }
        finally:
            conn.close()

    @classmethod
    def get_daily_sales_timeline(
        cls,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        salesman: Optional[str] = None,
        customer: Optional[str] = None,
        state: Optional[str] = None,
        city: Optional[str] = None,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Returns chronological daily sales aggregation."""
        cls.init_db()
        conn = cls.get_connection()
        try:
            where_sql, params, needs_item_join = cls._build_sales_filter(
                prefix="s", start_date=start_date, end_date=end_date,
                salesman=salesman, customer=customer, state=state, city=city, category=category
            )

            if needs_item_join:
                query = f"""
                    SELECT 
                        s.voucher_date as date,
                        ROUND(SUM(i.line_amount), 2) as revenue,
                        COUNT(DISTINCT s.voucher_number) as orders,
                        ROUND(COALESCE(SUM(ABS(i.quantity)), 0.0), 1) as outward_qty
                    FROM historical_sales s
                    JOIN historical_sale_items i ON s.id = i.historical_sale_id
                    {where_sql}
                    GROUP BY s.voucher_date
                    ORDER BY s.voucher_date ASC;
                """
            else:
                query = f"""
                    SELECT 
                        s.voucher_date as date,
                        ROUND(SUM(s.voucher_amount), 2) as revenue,
                        COUNT(DISTINCT s.voucher_number) as orders,
                        COALESCE(items.outward_qty, 0.0) as outward_qty
                    FROM historical_sales s
                    LEFT JOIN (
                        SELECT s2.voucher_date, ROUND(SUM(ABS(i.quantity)), 1) as outward_qty
                        FROM historical_sales s2
                        JOIN historical_sale_items i ON s2.id = i.historical_sale_id
                        GROUP BY s2.voucher_date
                    ) items ON s.voucher_date = items.voucher_date
                    {where_sql}
                    GROUP BY s.voucher_date
                    ORDER BY s.voucher_date ASC;
                """

            # Inward stock receipts from historical purchase consignments
            inward_q = """
                SELECT p.voucher_date as date, ROUND(COALESCE(SUM(ABS(pi.quantity)), 0.0), 1) as inward_qty
                FROM historical_purchases p
                JOIN historical_purchase_items pi ON p.id = pi.historical_purchase_id
                GROUP BY p.voucher_date;
            """
            inward_map = {
                row["date"]: float(row["inward_qty"] or 0.0)
                for row in conn.execute(inward_q).fetchall()
            }

            cur = conn.execute(query, params)
            sales_rows = {
                r["date"]: {
                    "date": r["date"],
                    "revenue": round(float(r["revenue"]), 2),
                    "orders": int(r["orders"]),
                    "stock_out": round(float(r["outward_qty"] or 0.0), 1),
                }
                for r in cur.fetchall()
            }

            # Merge all dates where either sales or purchase inward movements took place
            all_dates = sorted(set(sales_rows.keys()) | set(inward_map.keys()))
            if start_date:
                all_dates = [d for d in all_dates if d >= start_date]
            if end_date:
                all_dates = [d for d in all_dates if d <= end_date]

            timeline = []
            for d in all_dates:
                s_info = sales_rows.get(d, {"revenue": 0.0, "orders": 0, "stock_out": 0.0})
                timeline.append({
                    "date": d,
                    "revenue": s_info["revenue"],
                    "orders": s_info["orders"],
                    "stock_in": inward_map.get(d, 0.0),
                    "stock_out": s_info["stock_out"],
                    "adjustments": 0.0
                })
            return timeline
        finally:
            conn.close()

    @classmethod
    def get_salesman_analytics(
        cls,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        state: Optional[str] = None,
        city: Optional[str] = None,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Aggregates performance by attributed salesman with contribution percentage."""
        cls.init_db()
        conn = cls.get_connection()
        try:
            where_sql, params, needs_item_join = cls._build_sales_filter(
                prefix="s", start_date=start_date, end_date=end_date,
                state=state, city=city, category=category
            )

            if needs_item_join:
                query = f"""
                    SELECT 
                        s.salesman_name as salesman,
                        s.salesman_id as salesman_id,
                        s.salesman_mapping_status as status,
                        ROUND(SUM(i.line_amount), 2) as revenue,
                        COUNT(DISTINCT s.voucher_number) as vouchers,
                        COUNT(DISTINCT COALESCE(s.customer_id, s.customer_name)) as active_customers
                    FROM historical_sales s
                    JOIN historical_sale_items i ON s.id = i.historical_sale_id
                    {where_sql}
                    GROUP BY s.salesman_name
                    ORDER BY revenue DESC;
                """
            else:
                query = f"""
                    SELECT 
                        s.salesman_name as salesman,
                        s.salesman_id as salesman_id,
                        s.salesman_mapping_status as status,
                        ROUND(SUM(s.voucher_amount), 2) as revenue,
                        COUNT(DISTINCT s.voucher_number) as vouchers,
                        COUNT(DISTINCT COALESCE(s.customer_id, s.customer_name)) as active_customers
                    FROM historical_sales s
                    {where_sql}
                    GROUP BY s.salesman_name
                    ORDER BY revenue DESC;
                """

            cur = conn.execute(query, params)
            rows = cur.fetchall()
            total_rev = sum(float(r["revenue"] or 0.0) for r in rows)

            results = []
            for r in rows:
                rev = round(float(r["revenue"]), 2)
                vch = int(r["vouchers"])
                aov = round(rev / vch, 2) if vch > 0 else 0.0
                pct = round((rev / total_rev) * 100, 2) if total_rev > 0 else 0.0
                results.append({
                    "salesman": r["salesman"],
                    "salesman_id": r["salesman_id"],
                    "status": r["status"],
                    "revenue": rev,
                    "vouchers": vch,
                    "aov": aov,
                    "active_customers": int(r["active_customers"]),
                    "contribution_percent": pct,
                })
            return results
        finally:
            conn.close()

    @classmethod
    def get_geographic_breakdown(
        cls,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        salesman: Optional[str] = None,
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        """Provides unified canonical geographic breakdown across Region, State, and City."""
        cls.init_db()
        conn = cls.get_connection()
        try:
            where_sql, params, needs_item_join = cls._build_sales_filter(
                prefix="s", start_date=start_date, end_date=end_date,
                salesman=salesman, category=category
            )

            rev_col = "i.line_amount" if needs_item_join else "s.voucher_amount"
            from_clause = "historical_sales s JOIN historical_sale_items i ON s.id = i.historical_sale_id" if needs_item_join else "historical_sales s"

            # 1. State aggregation
            state_query = f"""
                SELECT 
                    s.state as state,
                    s.region as region,
                    ROUND(SUM({rev_col}), 2) as revenue,
                    COUNT(DISTINCT s.voucher_number) as vouchers,
                    COUNT(DISTINCT COALESCE(s.customer_id, s.customer_name)) as active_customers
                FROM {from_clause}
                {where_sql}
                GROUP BY s.state, s.region
                ORDER BY revenue DESC;
            """
            state_rows = conn.execute(state_query, params).fetchall()
            tot_geo_rev = sum(float(r["revenue"] or 0.0) for r in state_rows)

            states = []
            for r in state_rows:
                rev = round(float(r["revenue"]), 2)
                pct = round((rev / tot_geo_rev) * 100, 2) if tot_geo_rev > 0 else 0.0
                states.append({
                    "state": r["state"],
                    "region": r["region"],
                    "revenue": rev,
                    "vouchers": int(r["vouchers"]),
                    "active_customers": int(r["active_customers"]),
                    "share_percent": pct,
                })

            # 2. Region aggregation
            region_map: Dict[str, Dict[str, Any]] = {}
            for st in states:
                reg = st["region"]
                if reg not in region_map:
                    region_map[reg] = {"region": reg, "revenue": 0.0, "vouchers": 0}
                region_map[reg]["revenue"] += st["revenue"]
                region_map[reg]["vouchers"] += st["vouchers"]

            regions = [
                {
                    "region": reg,
                    "revenue": round(data["revenue"], 2),
                    "vouchers": data["vouchers"],
                    "share_percent": round((data["revenue"] / tot_geo_rev) * 100, 2) if tot_geo_rev > 0 else 0.0
                }
                for reg, data in sorted(region_map.items(), key=lambda x: x[1]["revenue"], reverse=True)
            ]

            # 3. City aggregation
            city_query = f"""
                SELECT 
                    s.city as city,
                    s.state as state,
                    s.region as region,
                    ROUND(SUM({rev_col}), 2) as revenue,
                    COUNT(DISTINCT s.voucher_number) as vouchers
                FROM {from_clause}
                {where_sql}
                GROUP BY s.city, s.state, s.region
                ORDER BY revenue DESC
                LIMIT 25;
            """
            cities = [
                {
                    "city": r["city"],
                    "state": r["state"],
                    "region": r["region"],
                    "revenue": round(float(r["revenue"]), 2),
                    "vouchers": int(r["vouchers"])
                }
                for r in conn.execute(city_query, params).fetchall()
            ]

            # Convert to dictionary format for legacy compatibility
            state_dict = {s["state"]: s["revenue"] for s in states}

            return {
                "total_revenue": round(tot_geo_rev, 2),
                "by_region": regions,
                "by_state": states,
                "by_city": cities,
                "state_distribution": state_dict
            }
        finally:
            conn.close()

    @classmethod
    def get_category_analytics(
        cls,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        salesman: Optional[str] = None,
        state: Optional[str] = None,
        city: Optional[str] = None,
        customer: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Calculates exact revenue and volume split across canonical product categories."""
        cls.init_db()
        conn = cls.get_connection()
        try:
            where_sql, params, _ = cls._build_sales_filter(
                prefix="s", start_date=start_date, end_date=end_date,
                salesman=salesman, state=state, city=city, customer=customer
            )

            query = f"""
                SELECT 
                    i.category_name as category,
                    ROUND(SUM(i.line_amount), 2) as revenue,
                    ROUND(SUM(i.quantity), 1) as units,
                    COUNT(*) as line_count
                FROM historical_sale_items i
                JOIN historical_sales s ON i.historical_sale_id = s.id
                {where_sql}
                GROUP BY i.category_name
                ORDER BY revenue DESC;
            """
            rows = conn.execute(query, params).fetchall()
            tot_cat_rev = sum(float(r["revenue"] or 0.0) for r in rows)

            return [
                {
                    "category": r["category"],
                    "revenue": round(float(r["revenue"]), 2),
                    "units": int(round(float(r["units"]))),
                    "line_count": int(r["line_count"]),
                    "share_percent": round((float(r["revenue"]) / tot_cat_rev) * 100, 2) if tot_cat_rev > 0 else 0.0
                }
                for r in rows
            ]
        finally:
            conn.close()

    @classmethod
    def get_top_customers(
        cls,
        limit: int = 20,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        salesman: Optional[str] = None,
        state: Optional[str] = None,
        city: Optional[str] = None,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Returns top customers with connected salesman and location dimensions."""
        cls.init_db()
        conn = cls.get_connection()
        try:
            where_sql, params, needs_item_join = cls._build_sales_filter(
                prefix="s", start_date=start_date, end_date=end_date,
                salesman=salesman, state=state, city=city, category=category
            )

            rev_col = "i.line_amount" if needs_item_join else "s.voucher_amount"
            from_clause = "historical_sales s JOIN historical_sale_items i ON s.id = i.historical_sale_id" if needs_item_join else "historical_sales s"

            query = f"""
                SELECT 
                    COALESCE(NULLIF(s.customer_name, ''), 'Direct Counter Sales') as dealer,
                    s.customer_id as customer_id,
                    s.salesman_name as salesman,
                    s.city as city,
                    s.state as state,
                    ROUND(SUM({rev_col}), 2) as revenue,
                    COUNT(DISTINCT s.voucher_number) as vouchers
                FROM {from_clause}
                {where_sql}
                GROUP BY dealer, s.customer_id, s.salesman_name, s.city, s.state
                ORDER BY revenue DESC
                LIMIT ?;
            """
            params.append(limit)
            cur = conn.execute(query, params)
            return [
                {
                    "dealer": r["dealer"],
                    "customer_id": r["customer_id"],
                    "salesman": r["salesman"],
                    "city": r["city"],
                    "state": r["state"],
                    "revenue": round(float(r["revenue"]), 2),
                    "vouchers": int(r["vouchers"]),
                    "aov": round(float(r["revenue"]) / int(r["vouchers"]), 2) if int(r["vouchers"]) > 0 else 0.0
                }
                for r in cur.fetchall()
            ]
        finally:
            conn.close()

    @classmethod
    def get_product_analytics(
        cls,
        limit: int = 25,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        salesman: Optional[str] = None,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Aggregates product performance by quantity sold, revenue, and category."""
        cls.init_db()
        conn = cls.get_connection()
        try:
            where_sql, params, _ = cls._build_sales_filter(
                prefix="s", start_date=start_date, end_date=end_date,
                salesman=salesman, category=category
            )

            query = f"""
                SELECT 
                    i.product_name as name,
                    COALESCE(i.sku, '-') as sku,
                    i.category_name as category,
                    ROUND(SUM(i.quantity), 2) as qty,
                    ROUND(SUM(i.line_amount), 2) as revenue,
                    COUNT(DISTINCT s.voucher_number) as vouchers
                FROM historical_sale_items i
                JOIN historical_sales s ON i.historical_sale_id = s.id
                {where_sql}
                GROUP BY i.product_name, i.sku, i.category_name
                ORDER BY revenue DESC
                LIMIT ?;
            """
            params.append(limit)
            cur = conn.execute(query, params)
            return [
                {
                    "name": r["name"],
                    "sku": r["sku"],
                    "category": r["category"],
                    "qty": round(float(r["qty"]), 1),
                    "revenue": round(float(r["revenue"]), 2),
                    "vouchers": int(r["vouchers"])
                }
                for r in cur.fetchall()
            ]
        finally:
            conn.close()

    @classmethod
    def get_data_quality_report(cls) -> Dict[str, Any]:
        """Generates the authoritative Data Quality & Relational Mapping Audit Report (Section 51)."""
        cls.init_db()
        conn = cls.get_connection()
        try:
            # 1. Voucher & Revenue totals
            vch_row = conn.execute("""
                SELECT 
                    COUNT(*) as total_vouchers,
                    ROUND(SUM(voucher_amount), 2) as total_voucher_amount,
                    SUM(CASE WHEN customer_mapping_status = 'MAPPED' THEN 1 ELSE 0 END) as mapped_customers,
                    SUM(CASE WHEN customer_mapping_status != 'MAPPED' THEN 1 ELSE 0 END) as unresolved_customers,
                    SUM(CASE WHEN salesman_mapping_status IN ('MAPPED', 'HOUSE_ACCOUNT') THEN 1 ELSE 0 END) as mapped_salesmen,
                    SUM(CASE WHEN salesman_mapping_status NOT IN ('MAPPED', 'HOUSE_ACCOUNT') THEN 1 ELSE 0 END) as unresolved_salesmen,
                    SUM(CASE WHEN location_mapping_status = 'RESOLVED' THEN 1 ELSE 0 END) as resolved_locations,
                    SUM(CASE WHEN location_mapping_status != 'RESOLVED' THEN 1 ELSE 0 END) as unresolved_locations
                FROM historical_sales;
            """).fetchone()

            total_vch = vch_row["total_vouchers"] or 0
            vch_val = float(vch_row["total_voucher_amount"] or 0.0)

            # 2. Line Items & Products
            line_row = conn.execute("""
                SELECT 
                    COUNT(*) as total_lines,
                    ROUND(SUM(line_amount), 2) as total_line_amount,
                    SUM(CASE WHEN product_mapping_status = 'MAPPED' THEN 1 ELSE 0 END) as mapped_products,
                    SUM(CASE WHEN product_mapping_status != 'MAPPED' THEN 1 ELSE 0 END) as unresolved_products,
                    SUM(CASE WHEN category_name NOT LIKE '%Uncategorized%' AND category_name NOT LIKE '%Unresolved%' THEN 1 ELSE 0 END) as mapped_categories,
                    SUM(CASE WHEN category_name LIKE '%Uncategorized%' OR category_name LIKE '%Unresolved%' THEN 1 ELSE 0 END) as unresolved_categories
                FROM historical_sale_items;
            """).fetchone()

            total_lines = line_row["total_lines"] or 0
            line_val = float(line_row["total_line_amount"] or 0.0)

            # 3. Unresolved customer records
            unresolved_cust_rows = conn.execute("""
                SELECT DISTINCT customer_name, customer_gstin, customer_address, COUNT(*) as count, ROUND(SUM(voucher_amount), 2) as amount
                FROM historical_sales
                WHERE customer_mapping_status != 'MAPPED'
                GROUP BY customer_name, customer_gstin, customer_address;
            """).fetchall()

            # 4. Unresolved products
            unresolved_prod_rows = conn.execute("""
                SELECT product_name, COUNT(*) as count, ROUND(SUM(line_amount), 2) as amount
                FROM historical_sale_items
                WHERE product_mapping_status != 'MAPPED'
                GROUP BY product_name;
            """).fetchall()

            # 5. Math reconciliation
            discrepancy = round(abs(vch_val - line_val), 2)

            return {
                "total_historical_vouchers": total_vch,
                "total_line_items": total_lines,
                "total_voucher_amount": vch_val,
                "total_line_amount": line_val,
                "reconciliation_difference": discrepancy,
                "is_fully_reconciled": discrepancy == 0.0,
                "customer_mapping": {
                    "mapped": int(vch_row["mapped_customers"] or 0),
                    "unresolved": int(vch_row["unresolved_customers"] or 0),
                    "percentage": round((int(vch_row["mapped_customers"] or 0) / total_vch) * 100, 2) if total_vch > 0 else 0.0,
                },
                "salesman_mapping": {
                    "mapped": int(vch_row["mapped_salesmen"] or 0),
                    "unresolved": int(vch_row["unresolved_salesmen"] or 0),
                    "percentage": round((int(vch_row["mapped_salesmen"] or 0) / total_vch) * 100, 2) if total_vch > 0 else 0.0,
                },
                "location_mapping": {
                    "resolved": int(vch_row["resolved_locations"] or 0),
                    "unresolved": int(vch_row["unresolved_locations"] or 0),
                    "percentage": round((int(vch_row["resolved_locations"] or 0) / total_vch) * 100, 2) if total_vch > 0 else 0.0,
                },
                "product_mapping": {
                    "mapped": int(line_row["mapped_products"] or 0),
                    "unresolved": int(line_row["unresolved_products"] or 0),
                    "percentage": round((int(line_row["mapped_products"] or 0) / total_lines) * 100, 2) if total_lines > 0 else 0.0,
                },
                "category_mapping": {
                    "mapped": int(line_row["mapped_categories"] or 0),
                    "unresolved": int(line_row["unresolved_categories"] or 0),
                    "percentage": round((int(line_row["mapped_categories"] or 0) / total_lines) * 100, 2) if total_lines > 0 else 0.0,
                },
                "unresolved_customers": [
                    {
                        "name": r["customer_name"] or "(Empty / Cash Counter)",
                        "gstin": r["customer_gstin"],
                        "address": r["customer_address"],
                        "vouchers": r["count"],
                        "amount": float(r["amount"])
                    }
                    for r in unresolved_cust_rows
                ],
                "unresolved_products": [
                    {
                        "name": r["product_name"],
                        "lines": r["count"],
                        "amount": float(r["amount"])
                    }
                    for r in unresolved_prod_rows
                ]
            }
        finally:
            conn.close()

    # ═══════════════════════════════════════════════════════════════════════
    # PHASE 1: New analytical query methods for BI alignment
    # ═══════════════════════════════════════════════════════════════════════

    @classmethod
    def get_customer_performance(
        cls,
        limit: int = 100,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        salesman: Optional[str] = None,
        state: Optional[str] = None,
        city: Optional[str] = None,
        category: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Per-customer aggregation: revenue, voucher count, AOV, last purchase, product diversity, city, state, salesman."""
        cls.init_db()
        conn = cls.get_connection()
        try:
            where_sql, params, needs_item_join = cls._build_sales_filter(
                prefix="s", start_date=start_date, end_date=end_date,
                salesman=salesman, state=state, city=city, category=category
            )

            rev_col = "i.line_amount" if needs_item_join else "s.voucher_amount"
            from_clause = "historical_sales s JOIN historical_sale_items i ON s.id = i.historical_sale_id" if needs_item_join else "historical_sales s"

            query = f"""
                SELECT 
                    COALESCE(NULLIF(s.customer_name, ''), 'Direct Counter Sales') as customer_name,
                    s.customer_id,
                    s.salesman_name,
                    s.city,
                    s.state,
                    s.region,
                    s.customer_gstin,
                    ROUND(SUM({rev_col}), 2) as revenue,
                    COUNT(DISTINCT s.voucher_number) as voucher_count,
                    MIN(s.voucher_date) as first_purchase,
                    MAX(s.voucher_date) as last_purchase,
                    COUNT(DISTINCT s.voucher_date) as active_days
                FROM {from_clause}
                {where_sql}
                GROUP BY s.customer_name, s.customer_id, s.salesman_name, s.city, s.state, s.region, s.customer_gstin
                ORDER BY revenue DESC
                LIMIT ?;
            """
            params.append(limit)
            rows = conn.execute(query, params).fetchall()
            total_rev = sum(float(r["revenue"] or 0.0) for r in rows)

            results = []
            for r in rows:
                rev = round(float(r["revenue"]), 2)
                vch = int(r["voucher_count"])
                aov = round(rev / vch, 2) if vch > 0 else 0.0
                pct = round((rev / total_rev) * 100, 2) if total_rev > 0 else 0.0

                # Count distinct products for this customer
                cust_name = r["customer_name"]
                prod_count_q = """
                    SELECT COUNT(DISTINCT i.product_name) as prod_count
                    FROM historical_sale_items i
                    JOIN historical_sales s ON i.historical_sale_id = s.id
                    WHERE COALESCE(NULLIF(s.customer_name, ''), 'Direct Counter Sales') = ?
                """
                prod_row = conn.execute(prod_count_q, [cust_name]).fetchone()
                prod_diversity = int(prod_row["prod_count"]) if prod_row else 0

                results.append({
                    "customer_name": cust_name,
                    "customer_id": r["customer_id"],
                    "salesman": r["salesman_name"],
                    "city": r["city"],
                    "state": r["state"],
                    "region": r["region"],
                    "gstin": r["customer_gstin"],
                    "revenue": rev,
                    "voucher_count": vch,
                    "aov": aov,
                    "first_purchase": r["first_purchase"],
                    "last_purchase": r["last_purchase"],
                    "active_days": int(r["active_days"]),
                    "product_diversity": prod_diversity,
                    "contribution_percent": pct,
                })
            return results
        finally:
            conn.close()

    @classmethod
    def get_return_analytics(
        cls,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Comprehensive return analytics: timeline, reason breakdown, top returned products, financial impact."""
        cls.init_db()
        conn = cls.get_connection()
        try:
            # Date filter for returns
            ret_where_parts = []
            ret_params: List[Any] = []
            if start_date:
                ret_where_parts.append("r.voucher_date >= ?")
                ret_params.append(start_date)
            if end_date:
                ret_where_parts.append("r.voucher_date <= ?")
                ret_params.append(end_date)
            ret_where = f"WHERE {' AND '.join(ret_where_parts)}" if ret_where_parts else ""

            # 1. Summary
            summary_q = f"""
                SELECT 
                    COUNT(*) as total_returns,
                    ROUND(COALESCE(SUM(ABS(r.voucher_amount)), 0), 2) as total_value,
                    MIN(r.voucher_date) as earliest,
                    MAX(r.voucher_date) as latest,
                    COUNT(DISTINCT r.customer_name) as unique_customers
                FROM historical_returns r
                {ret_where};
            """
            summary = conn.execute(summary_q, ret_params).fetchone()

            # 2. Daily timeline
            timeline_q = f"""
                SELECT 
                    r.voucher_date as date,
                    COUNT(*) as return_count,
                    ROUND(SUM(ABS(r.voucher_amount)), 2) as return_value
                FROM historical_returns r
                {ret_where}
                GROUP BY r.voucher_date
                ORDER BY r.voucher_date ASC;
            """
            timeline = [
                {"date": row["date"], "returns": int(row["return_count"]), "value": float(row["return_value"])}
                for row in conn.execute(timeline_q, ret_params).fetchall()
            ]

            # 3. Top returned products (from return items)
            top_prods_q = f"""
                SELECT 
                    ri.product_name,
                    ri.category_name,
                    ROUND(SUM(ABS(ri.quantity)), 1) as total_qty,
                    ROUND(SUM(ABS(ri.line_amount)), 2) as total_value,
                    COUNT(*) as line_count
                FROM historical_return_items ri
                JOIN historical_returns r ON ri.historical_return_id = r.id
                {ret_where}
                GROUP BY ri.product_name, ri.category_name
                ORDER BY total_value DESC
                LIMIT 15;
            """
            top_returned_products = [
                {
                    "product": row["product_name"],
                    "category": row["category_name"],
                    "quantity": float(row["total_qty"]),
                    "value": float(row["total_value"]),
                    "occurrences": int(row["line_count"]),
                }
                for row in conn.execute(top_prods_q, ret_params).fetchall()
            ]

            # 4. Returns by customer
            by_customer_q = f"""
                SELECT 
                    r.customer_name,
                    COUNT(*) as return_count,
                    ROUND(SUM(ABS(r.voucher_amount)), 2) as return_value
                FROM historical_returns r
                {ret_where}
                GROUP BY r.customer_name
                ORDER BY return_value DESC
                LIMIT 15;
            """
            by_customer = [
                {"customer": row["customer_name"], "returns": int(row["return_count"]), "value": float(row["return_value"])}
                for row in conn.execute(by_customer_q, ret_params).fetchall()
            ]

            # 5. Returns by category
            by_category_q = f"""
                SELECT 
                    ri.category_name as category,
                    ROUND(SUM(ABS(ri.quantity)), 1) as qty,
                    ROUND(SUM(ABS(ri.line_amount)), 2) as value,
                    COUNT(*) as lines
                FROM historical_return_items ri
                JOIN historical_returns r ON ri.historical_return_id = r.id
                {ret_where}
                GROUP BY ri.category_name
                ORDER BY value DESC;
            """
            by_category = [
                {"category": row["category"], "quantity": float(row["qty"]), "value": float(row["value"]), "lines": int(row["lines"])}
                for row in conn.execute(by_category_q, ret_params).fetchall()
            ]

            return {
                "total_returns": int(summary["total_returns"]) if summary else 0,
                "total_value": float(summary["total_value"]) if summary else 0.0,
                "earliest_date": summary["earliest"] if summary else None,
                "latest_date": summary["latest"] if summary else None,
                "unique_customers": int(summary["unique_customers"]) if summary else 0,
                "timeline": timeline,
                "top_returned_products": top_returned_products,
                "by_customer": by_customer,
                "by_category": by_category,
            }
        finally:
            conn.close()

    @classmethod
    def get_purchase_analytics(
        cls,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Comprehensive purchase/procurement analytics: timeline, supplier ranking, category spend."""
        cls.init_db()
        conn = cls.get_connection()
        try:
            pur_where_parts = []
            pur_params: List[Any] = []
            if start_date:
                pur_where_parts.append("p.voucher_date >= ?")
                pur_params.append(start_date)
            if end_date:
                pur_where_parts.append("p.voucher_date <= ?")
                pur_params.append(end_date)
            pur_where = f"WHERE {' AND '.join(pur_where_parts)}" if pur_where_parts else ""

            # 1. Summary
            summary_q = f"""
                SELECT 
                    COUNT(*) as total_purchases,
                    ROUND(COALESCE(SUM(ABS(p.voucher_amount)), 0), 2) as total_value,
                    MIN(p.voucher_date) as earliest,
                    MAX(p.voucher_date) as latest,
                    COUNT(DISTINCT p.supplier_name) as unique_suppliers
                FROM historical_purchases p
                {pur_where};
            """
            summary = conn.execute(summary_q, pur_params).fetchone()

            # 2. Daily timeline
            timeline_q = f"""
                SELECT 
                    p.voucher_date as date,
                    COUNT(*) as purchase_count,
                    ROUND(SUM(ABS(p.voucher_amount)), 2) as purchase_value
                FROM historical_purchases p
                {pur_where}
                GROUP BY p.voucher_date
                ORDER BY p.voucher_date ASC;
            """
            timeline = [
                {"date": row["date"], "purchases": int(row["purchase_count"]), "value": float(row["purchase_value"])}
                for row in conn.execute(timeline_q, pur_params).fetchall()
            ]

            # 3. Top suppliers
            top_suppliers_q = f"""
                SELECT 
                    p.supplier_name,
                    COUNT(*) as voucher_count,
                    ROUND(SUM(ABS(p.voucher_amount)), 2) as total_value
                FROM historical_purchases p
                {pur_where}
                GROUP BY p.supplier_name
                ORDER BY total_value DESC
                LIMIT 20;
            """
            top_suppliers = [
                {"supplier": row["supplier_name"], "vouchers": int(row["voucher_count"]), "value": float(row["total_value"])}
                for row in conn.execute(top_suppliers_q, pur_params).fetchall()
            ]

            # 4. Spend by category
            by_category_q = f"""
                SELECT 
                    pi.product_name as category,
                    ROUND(SUM(ABS(pi.line_amount)), 2) as value,
                    ROUND(SUM(ABS(pi.quantity)), 1) as qty
                FROM historical_purchase_items pi
                JOIN historical_purchases p ON pi.historical_purchase_id = p.id
                {pur_where}
                GROUP BY pi.product_name
                ORDER BY value DESC
                LIMIT 20;
            """
            by_category = [
                {"category": row["category"], "value": float(row["value"]), "quantity": float(row["qty"])}
                for row in conn.execute(by_category_q, pur_params).fetchall()
            ]

            # 5. Monthly capital outflow
            monthly_q = f"""
                SELECT 
                    strftime('%Y-%m', p.voucher_date) as month,
                    COUNT(*) as vouchers,
                    ROUND(SUM(ABS(p.voucher_amount)), 2) as spend
                FROM historical_purchases p
                {pur_where}
                GROUP BY month
                ORDER BY month ASC;
            """
            monthly_outflow = [
                {"name": row["month"], "month": row["month"], "vouchers": int(row["vouchers"]), "value": float(row["spend"])}
                for row in conn.execute(monthly_q, pur_params).fetchall()
            ]

            # 6. Consignment ticket size brackets
            brackets_q = f"""
                SELECT 
                    CASE 
                        WHEN ABS(p.voucher_amount) < 25000 THEN 'Under ₹25K'
                        WHEN ABS(p.voucher_amount) < 50000 THEN '₹25K - ₹50K'
                        WHEN ABS(p.voucher_amount) < 100000 THEN '₹50K - ₹1L'
                        WHEN ABS(p.voucher_amount) < 250000 THEN '₹1L - ₹2.5L'
                        ELSE 'Above ₹2.5L'
                    END as bracket,
                    COUNT(*) as count,
                    ROUND(SUM(ABS(p.voucher_amount)), 2) as total_val
                FROM historical_purchases p
                {pur_where}
                GROUP BY bracket
                ORDER BY total_val DESC;
            """
            consignment_brackets = [
                {"name": row["bracket"], "bracket": row["bracket"], "count": int(row["count"]), "value": float(row["total_val"])}
                for row in conn.execute(brackets_q, pur_params).fetchall()
            ]

            return {
                "total_purchases": int(summary["total_purchases"]) if summary else 0,
                "total_value": float(summary["total_value"]) if summary else 0.0,
                "earliest_date": summary["earliest"] if summary else None,
                "latest_date": summary["latest"] if summary else None,
                "unique_suppliers": int(summary["unique_suppliers"]) if summary else 0,
                "timeline": timeline,
                "top_suppliers": top_suppliers,
                "by_category": by_category,
                "monthly_outflow": monthly_outflow,
                "consignment_brackets": consignment_brackets,
                "financials": cls.get_financial_analytics(start_date, end_date),
            }
        finally:
            conn.close()

    @classmethod
    def get_order_value_distribution(
        cls,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Buckets historical sales voucher amounts into size tiers for order value distribution analysis."""
        cls.init_db()
        conn = cls.get_connection()
        try:
            where_parts = []
            params: List[Any] = []
            if start_date:
                where_parts.append("voucher_date >= ?")
                params.append(start_date)
            if end_date:
                where_parts.append("voucher_date <= ?")
                params.append(end_date)
            where_sql = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""

            query = f"""
                SELECT 
                    CASE 
                        WHEN ABS(voucher_amount) < 1000 THEN 'Under ₹1K'
                        WHEN ABS(voucher_amount) < 5000 THEN '₹1K - ₹5K'
                        WHEN ABS(voucher_amount) < 10000 THEN '₹5K - ₹10K'
                        WHEN ABS(voucher_amount) < 25000 THEN '₹10K - ₹25K'
                        WHEN ABS(voucher_amount) < 50000 THEN '₹25K - ₹50K'
                        ELSE '₹50K+'
                    END as bucket,
                    COUNT(*) as order_count,
                    ROUND(SUM(ABS(voucher_amount)), 2) as total_value,
                    ROUND(AVG(ABS(voucher_amount)), 2) as avg_value
                FROM historical_sales
                {where_sql}
                GROUP BY bucket
                ORDER BY MIN(ABS(voucher_amount)) ASC;
            """
            return [
                {
                    "bucket": row["bucket"],
                    "orders": int(row["order_count"]),
                    "value": float(row["total_value"]),
                    "avg_value": float(row["avg_value"]),
                }
                for row in conn.execute(query, params).fetchall()
            ]
        finally:
            conn.close()

    @classmethod
    def get_financial_analytics(
        cls,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Calculates comprehensive commercial trade financials: brand margins, working capital, cashflow, and ticket distribution."""
        cls.init_db()
        conn = cls.get_connection()
        try:
            sales_where_parts = []
            sales_params: List[Any] = []
            pur_where_parts = []
            pur_params: List[Any] = []

            if start_date:
                sales_where_parts.append("s.voucher_date >= ?")
                sales_params.append(start_date)
                pur_where_parts.append("p.voucher_date >= ?")
                pur_params.append(start_date)
            if end_date:
                sales_where_parts.append("s.voucher_date <= ?")
                sales_params.append(end_date)
                pur_where_parts.append("p.voucher_date <= ?")
                pur_params.append(end_date)

            sales_where = f"WHERE {' AND '.join(sales_where_parts)}" if sales_where_parts else ""
            pur_where = f"WHERE {' AND '.join(pur_where_parts)}" if pur_where_parts else ""

            # 1. Total sales realization
            s_q = f"SELECT ROUND(COALESCE(SUM(s.voucher_amount), 0), 2) as s_val, COUNT(*) as s_cnt FROM historical_sales s {sales_where};"
            s_row = conn.execute(s_q, sales_params).fetchone()
            total_sales = float(s_row["s_val"] or 0.0) if s_row else 0.0
            total_orders = int(s_row["s_cnt"] or 0) if s_row else 0

            # 2. Total procurement expenditure
            p_q = f"SELECT ROUND(COALESCE(SUM(ABS(p.voucher_amount)), 0), 2) as p_val, COUNT(*) as p_cnt FROM historical_purchases p {pur_where};"
            p_row = conn.execute(p_q, pur_params).fetchone()
            total_purchases = float(p_row["p_val"] or 0.0) if p_row else 0.0
            total_purch_vouchers = int(p_row["p_cnt"] or 0) if p_row else 0

            # Realized trade surplus & margin %
            net_trading_surplus = round(total_sales - total_purchases, 2)
            gross_margin_pct = round((net_trading_surplus / total_sales * 100), 1) if total_sales > 0 else 0.0

            # 3. Brand-level sales vs purchase costs
            brand_case = """
                CASE 
                    WHEN UPPER(product_name) LIKE '%SHEETAL%' THEN 'SHEETAL'
                    WHEN UPPER(product_name) LIKE '%FINOLEX%' THEN 'FINOLEX'
                    WHEN UPPER(product_name) LIKE '%HAHN%' THEN 'HAHN'
                    WHEN UPPER(product_name) LIKE '%FLOTO%' THEN 'FLOTO'
                    WHEN UPPER(product_name) LIKE '%COATS%' THEN 'COATS'
                    WHEN UPPER(product_name) LIKE '%GRAVITY%' THEN 'GRAVITY'
                    WHEN UPPER(product_name) LIKE '%MATRIX%' THEN 'MATRIX'
                    WHEN UPPER(product_name) LIKE '%NALKA%' THEN 'NALKA'
                    WHEN UPPER(product_name) LIKE '%SUPERFLO%' THEN 'SUPERFLO'
                    WHEN UPPER(product_name) LIKE '%UNIK%' THEN 'UNIK'
                    WHEN UPPER(product_name) LIKE '%TARUN%' THEN 'TARUN'
                    WHEN UPPER(product_name) LIKE '%NM%' THEN 'NM'
                    ELSE 'OTHER'
                END
            """
            b_sales_q = f"""
                SELECT {brand_case} as brand, ROUND(SUM(si.line_amount), 2) as sales
                FROM historical_sale_items si
                JOIN historical_sales s ON si.historical_sale_id = s.id
                {sales_where}
                GROUP BY brand;
            """
            brands_sales = {r["brand"]: float(r["sales"] or 0.0) for r in conn.execute(b_sales_q, sales_params).fetchall()}

            b_pur_q = f"""
                SELECT {brand_case} as brand, ROUND(SUM(ABS(pi.line_amount)), 2) as purchases
                FROM historical_purchase_items pi
                JOIN historical_purchases p ON pi.historical_purchase_id = p.id
                {pur_where}
                GROUP BY brand;
            """
            brands_pur = {r["brand"]: float(r["purchases"] or 0.0) for r in conn.execute(b_pur_q, pur_params).fetchall()}

            all_brands = sorted(list(set(brands_sales.keys()) | set(brands_pur.keys())))
            gross_margin_by_brand = []
            net_margin_contribution = []

            for b in all_brands:
                s_val = brands_sales.get(b, 0.0)
                p_val = brands_pur.get(b, 0.0)
                surplus = round(s_val - p_val, 2)
                margin_pct = round((surplus / s_val * 100), 1) if s_val > 0 else 0.0

                gross_margin_by_brand.append({
                    "name": b,
                    "brand": b,
                    "value": margin_pct,
                    "sales": s_val,
                    "purchases": p_val,
                    "margin_pct": margin_pct,
                    "surplus": surplus
                })

                if surplus > 0:
                    net_margin_contribution.append({
                        "name": b,
                        "brand": b,
                        "value": surplus,
                        "sales": s_val,
                        "margin_pct": margin_pct
                    })

            gross_margin_by_brand.sort(key=lambda x: x["margin_pct"], reverse=True)
            net_margin_contribution.sort(key=lambda x: x["value"], reverse=True)

            # 4. Monthly cashflow trajectory
            monthly_q = """
                SELECT 
                    m.month,
                    COALESCE(s.sales_val, 0) as sales,
                    COALESCE(p.purch_val, 0) as purchases,
                    ROUND(COALESCE(s.sales_val, 0) - COALESCE(p.purch_val, 0), 2) as net_surplus
                FROM (
                    SELECT strftime('%Y-%m', voucher_date) as month FROM historical_sales
                    UNION
                    SELECT strftime('%Y-%m', voucher_date) as month FROM historical_purchases
                ) m
                LEFT JOIN (
                    SELECT strftime('%Y-%m', voucher_date) as month, ROUND(SUM(voucher_amount), 2) as sales_val
                    FROM historical_sales GROUP BY month
                ) s ON m.month = s.month
                LEFT JOIN (
                    SELECT strftime('%Y-%m', voucher_date) as month, ROUND(SUM(ABS(voucher_amount)), 2) as purch_val
                    FROM historical_purchases GROUP BY month
                ) p ON m.month = p.month
                ORDER BY m.month ASC;
            """
            monthly_cashflow = [
                {
                    "name": row["month"],
                    "month": row["month"],
                    "sales": float(row["sales"]),
                    "purchases": float(row["purchases"]),
                    "value": float(row["net_surplus"]),
                    "net_surplus": float(row["net_surplus"]),
                }
                for row in conn.execute(monthly_q).fetchall()
            ]

            # 5. Working capital & asset breakdown
            total_inv_valuation = 24706750.74
            dead_stock_locked = 8652472.00
            active_stock = round(total_inv_valuation - dead_stock_locked, 2)
            liquid_surplus = max(0.0, net_trading_surplus)

            working_capital_allocation = [
                {"name": "Active Working Stock", "value": active_stock, "category": "Active Assets"},
                {"name": "Dead Stock Capital Lockup", "value": dead_stock_locked, "category": "Stagnant Assets"},
                {"name": "Realized Commercial Surplus", "value": liquid_surplus, "category": "Trade Surplus"},
            ]

            # 6. Inventory Carrying Cost Breakdown (Standard 20% annualized holding rate on ₹2.47 Cr stock)
            annual_holding_cost = round(total_inv_valuation * 0.20, 2)
            carrying_cost_breakdown = [
                {"name": "Capital Financing (10%)", "value": round(total_inv_valuation * 0.10, 2)},
                {"name": "Warehousing & Space (5%)", "value": round(total_inv_valuation * 0.05, 2)},
                {"name": "Logistics & Handling (3%)", "value": round(total_inv_valuation * 0.03, 2)},
                {"name": "Shrinkage & Depreciation (2%)", "value": round(total_inv_valuation * 0.02, 2)},
            ]

            # 7. Order ticket size value distribution
            ticket_dist = cls.get_order_value_distribution(start_date, end_date)
            order_ticket_distribution = [
                {"name": t["bucket"], "orders": t["orders"], "value": t["value"], "avg_value": t["avg_value"]}
                for t in ticket_dist
            ]

            return {
                "summary": {
                    "total_sales": total_sales,
                    "total_orders": total_orders,
                    "total_purchases": total_purchases,
                    "total_purch_vouchers": total_purch_vouchers,
                    "net_trading_surplus": net_trading_surplus,
                    "gross_margin_pct": gross_margin_pct,
                    "total_inventory_valuation": total_inv_valuation,
                    "annual_carrying_cost": annual_holding_cost,
                    "dead_stock_locked_capital": dead_stock_locked,
                    "active_working_capital": active_stock,
                },
                "gross_margin_by_brand": gross_margin_by_brand,
                "net_margin_contribution": net_margin_contribution,
                "working_capital_allocation": working_capital_allocation,
                "carrying_cost_breakdown": carrying_cost_breakdown,
                "monthly_cashflow": monthly_cashflow,
                "order_ticket_distribution": order_ticket_distribution,
            }
        finally:
            conn.close()
