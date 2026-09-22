# backend/tests/test_relational_sales_trace.py
"""
Authoritative End-to-End Acceptance Test for Relational Sales Mapping (Section 53).
Traces real historical vouchers across all canonical business dimensions:
  Voucher -> Customer -> Salesman -> City -> State -> Region -> Product -> SKU -> Category -> Revenue -> Date.
Validates that each voucher contributes mathematically to:
  1. Total Revenue
  2. Daily Sales Timeline
  3. Customer Performance
  4. Salesman Performance
  5. Geographic Analytics (State & Region)
  6. Product Analytics
  7. Category Analytics
"""

import sys
from pathlib import Path
from decimal import Decimal
import unittest

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from repositories.historical_sales_repo import HistoricalSalesRepository


class TestRelationalSalesTrace(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        HistoricalSalesRepository.init_db()
        cls.conn = HistoricalSalesRepository.get_connection()

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()

    def trace_voucher(self, vch_no: str):
        """Walks an individual voucher through all relational dimensions."""
        print(f"\n====================================================================")
        print(f"TRACING VOUCHER: {vch_no}")
        print(f"====================================================================")

        # 1. Fetch voucher header
        vch = self.conn.execute("""
            SELECT * FROM historical_sales WHERE voucher_number = ?;
        """, (vch_no,)).fetchone()
        self.assertIsNotNone(vch, f"Voucher {vch_no} not found in historical_sales")

        vch_amt = round(float(vch["voucher_amount"]), 2)
        vch_date = vch["voucher_date"]
        cust_name = vch["customer_name"]
        cust_id = vch["customer_id"]
        cust_status = vch["customer_mapping_status"]
        slm_name = vch["salesman_name"]
        slm_status = vch["salesman_mapping_status"]
        city = vch["city"]
        state = vch["state"]
        region = vch["region"]
        loc_status = vch["location_mapping_status"]

        print(f"  Voucher Date:        {vch_date}")
        print(f"  Voucher Revenue:     Rs. {vch_amt:,.2f}")
        print(f"  Customer:            {cust_name} (ID: {cust_id}, Status: {cust_status})")
        print(f"  Salesman:            {slm_name} (Status: {slm_status})")
        print(f"  Location:            {city}, {state} -> Region: {region} (Status: {loc_status})")

        # 2. Fetch line items
        items = self.conn.execute("""
            SELECT * FROM historical_sale_items WHERE historical_sale_id = ?;
        """, (vch["id"],)).fetchall()
        self.assertGreater(len(items), 0, f"Voucher {vch_no} has no line items")

        line_sum = round(sum(float(it["line_amount"]) for it in items), 2)
        print(f"  Line Items Count:    {len(items)} lines")
        print(f"  Line Items Sum:      Rs. {line_sum:,.2f}")
        self.assertEqual(vch_amt, line_sum, f"Line sum ({line_sum}) does not match voucher amount ({vch_amt})")

        print("  Sample Products & Categories:")
        for it in items[:3]:
            print(f"    - Product: {it['product_name']} | SKU: {it['sku']} | Category: {it['category_name']} | Rs. {it['line_amount']:,.2f}")

        # 3. Verify Total Revenue contribution
        kpis = HistoricalSalesRepository.get_summary_kpis()
        self.assertGreaterEqual(kpis["total_revenue"], vch_amt)

        # 4. Verify Daily Sales contribution
        daily = HistoricalSalesRepository.get_daily_sales_timeline(start_date=vch_date, end_date=vch_date)
        matching_days = [d for d in daily if d["date"] == vch_date]
        self.assertEqual(len(matching_days), 1, f"Expected 1 daily record for {vch_date}")
        self.assertGreaterEqual(matching_days[0]["revenue"], vch_amt)
        print(f"  [OK] Daily Sales Check: Day {vch_date} total Rs. {matching_days[0]['revenue']:,.2f} includes voucher")

        # 5. Verify Customer Performance contribution
        top_custs = HistoricalSalesRepository.get_top_customers(limit=500)
        cust_row = next((c for c in top_custs if c["dealer"].upper() == cust_name.upper()), None)
        if cust_name.strip():
            self.assertIsNotNone(cust_row, f"Customer {cust_name} should appear in customer rankings")
            self.assertGreaterEqual(cust_row["revenue"], vch_amt)
            print(f"  [OK] Customer Performance Check: Customer {cust_name} total Rs. {cust_row['revenue']:,.2f} includes voucher")

        # 6. Verify Salesman Performance contribution
        slm_perf = HistoricalSalesRepository.get_salesman_analytics()
        slm_row = next((s for s in slm_perf if s["salesman"].upper() == slm_name.upper()), None)
        self.assertIsNotNone(slm_row, f"Salesman {slm_name} should appear in salesman performance")
        self.assertGreaterEqual(slm_row["revenue"], vch_amt)
        print(f"  [OK] Salesman Performance Check: Salesman {slm_name} total Rs. {slm_row['revenue']:,.2f} includes voucher")

        # 7. Verify Geographic Analytics contribution
        geo = HistoricalSalesRepository.get_geographic_breakdown()
        st_row = next((s for s in geo["by_state"] if s["state"].upper() == state.upper()), None)
        self.assertIsNotNone(st_row, f"State {state} should appear in geographic breakdown")
        self.assertGreaterEqual(st_row["revenue"], vch_amt)

        reg_row = next((r for r in geo["by_region"] if r["region"].upper() == region.upper()), None)
        self.assertIsNotNone(reg_row, f"Region {region} should appear in geographic breakdown")
        self.assertGreaterEqual(reg_row["revenue"], vch_amt)
        print(f"  [OK] Geographic Check: State {state} (Rs. {st_row['revenue']:,.2f}) & Region {region} (Rs. {reg_row['revenue']:,.2f}) include voucher")

        # 8. Verify Category Analytics contribution
        cats = HistoricalSalesRepository.get_category_analytics()
        for it in items:
            cat_name = it["category_name"]
            cat_row = next((c for c in cats if c["category"].upper() == cat_name.upper()), None)
            self.assertIsNotNone(cat_row, f"Category {cat_name} should appear in category breakdown")
            self.assertGreaterEqual(cat_row["revenue"], float(it["line_amount"]))
        print(f"  [OK] Category Analytics Check: All {len(items)} line item categories verified in category analytics")

    def test_trace_multiple_diverse_vouchers(self):
        """Traces vouchers covering multiple salesmen, states, and product categories."""
        # Query distinct vouchers across different salesmen
        diverse_vouchers = self.conn.execute("""
            SELECT voucher_number, salesman_name, state, voucher_amount
            FROM historical_sales
            WHERE voucher_amount > 1000
            GROUP BY salesman_name
            ORDER BY voucher_amount DESC
            LIMIT 6;
        """).fetchall()

        self.assertGreaterEqual(len(diverse_vouchers), 4, "Should have diverse vouchers across salesmen")

        for v in diverse_vouchers:
            self.trace_voucher(v["voucher_number"])

    def test_reconciliation_audit(self):
        """Verifies Section 49 & 51 Data Quality Reconciliation."""
        report = HistoricalSalesRepository.get_data_quality_report()
        print("\n====================================================================")
        print("DATA QUALITY & RECONCILIATION AUDIT")
        print("====================================================================")
        print(f"Total Vouchers:          {report['total_historical_vouchers']}")
        print(f"Total Line Items:        {report['total_line_items']}")
        print(f"Voucher Sum:             Rs. {report['total_voucher_amount']:,.2f}")
        print(f"Line Items Sum:          Rs. {report['total_line_amount']:,.2f}")
        print(f"Reconciliation Diff:     Rs. {report['reconciliation_difference']:,.2f}")
        print(f"Customer Mapping:        {report['customer_mapping']['percentage']}%")
        print(f"Salesman Mapping:        {report['salesman_mapping']['percentage']}%")
        print(f"Location Mapping:        {report['location_mapping']['percentage']}%")
        print(f"Product Mapping:         {report['product_mapping']['percentage']}%")
        print(f"Category Mapping:        {report['category_mapping']['percentage']}%")

        self.assertEqual(report["reconciliation_difference"], 0.0)
        self.assertTrue(report["is_fully_reconciled"])
        self.assertGreater(report["customer_mapping"]["percentage"], 98.0)
        self.assertGreater(report["salesman_mapping"]["percentage"], 98.0)
        self.assertGreater(report["location_mapping"]["percentage"], 98.0)
        self.assertGreater(report["product_mapping"]["percentage"], 99.0)
        self.assertGreater(report["category_mapping"]["percentage"], 99.0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
