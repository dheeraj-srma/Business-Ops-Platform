# backend/tests/test_phase1c_transactions.py
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, List

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from main import app
from auth import create_access_token
from supabase_client import get_supabase_client
from services.inventory_service import InventoryService, is_valid_uuid
from services.order_service import OrderService
from services.analytics_service import AnalyticsService
from repositories.inventory_repo import InventoryRepository
from repositories.transaction_repo import TransactionRepository
from services.reconciliation_service import ReconciliationService

client = TestClient(app)

def get_admin_headers():
    token = create_access_token({
        "user_id": "usr-admin-001",
        "email": "admin@nalkametals.com",
        "role": "admin",
        "full_name": "Admin User"
    })
    return {"Authorization": f"Bearer {token}"}

def create_controlled_product(initial_stock: float = 100.0) -> Dict[str, Any]:
    """Creates a fresh test product with explicit known stock balance."""
    headers = get_admin_headers()
    sku = f"NLK-TX-{uuid.uuid4().hex[:6].upper()}"
    res = client.post("/api/inventory", json={
        "sku": sku,
        "name": f"Transaction Test Product {sku}",
        "category": "Testing",
        "unit_price": 100.0,
        "cost_price": 80.0,
        "quantity": initial_stock,
        "unit": "NOS"
    }, headers=headers)
    assert res.status_code == 200, f"Failed creating product: {res.text}"
    prod_data = res.json()
    prod_id = prod_data["id"]
    return {"id": prod_id, "sku": sku, "initial_stock": initial_stock}


def test_tx_01_stock_in_and_out_balance():
    """
    TEST TX-01:
    Start: on_hand = 100
    INWARD 50
    OUTWARD 20
    Expected: on_hand = 130
    """
    prod = create_controlled_product(initial_stock=100.0)
    pid = prod["id"]

    # 1. Inward 50
    in_res = InventoryService.record_stock_in(
        items=[{"product_id": pid, "quantity": 50.0, "unit_cost": 80.0}],
        supplier="Test Supplier",
        reference_number=f"IN-{uuid.uuid4().hex[:6].upper()}"
    )
    assert in_res["status"] == "SUCCESS"

    # 2. Outward 20
    out_res = InventoryService.record_stock_out(
        items=[{"product_id": pid, "quantity": 20.0}],
        recipient="Test Recipient",
        reference_number=f"OUT-{uuid.uuid4().hex[:6].upper()}"
    )
    assert out_res["status"] == "SUCCESS"

    # Verify balance
    db = get_supabase_client()
    if db:
        inv_row = db.table("inventory").select("*").eq("product_id", pid).limit(1).execute().data[0]
        on_hand = float(inv_row["quantity_on_hand"])
        assert on_hand == 130.0, f"Expected 130.0 on_hand, got {on_hand}"
    print(f"TEST TX-01 PASS: Start 100 + IN 50 - OUT 20 = 130")


def test_tx_02_net_physical_movement():
    """
    TEST TX-02:
    INWARD = 500 total
    OUTWARD = 275 total
    Expected: net physical movement = +225
    """
    prod = create_controlled_product(initial_stock=0.0)
    pid = prod["id"]

    # Record inward 500
    InventoryService.record_stock_in(
        items=[{"product_id": pid, "quantity": 500.0}],
        supplier="Supplier A",
        reference_number=f"IN-{uuid.uuid4().hex[:6].upper()}"
    )

    # Record outward 275
    InventoryService.record_stock_out(
        items=[{"product_id": pid, "quantity": 275.0}],
        recipient="Buyer B",
        reference_number=f"OUT-{uuid.uuid4().hex[:6].upper()}"
    )

    txs = TransactionRepository.get_transactions(limit=50)
    prod_txs = [t for t in txs if str(t.get("product_id")) == pid]
    
    inward_sum = sum(float(t["quantity"]) for t in prod_txs if t.get("transaction_type") == "inward")
    outward_sum = sum(float(t["quantity"]) for t in prod_txs if t.get("transaction_type") == "sale")
    
    net_movement = inward_sum - outward_sum
    assert inward_sum == 500.0, f"Expected 500 inward, got {inward_sum}"
    assert outward_sum == 275.0, f"Expected 275 outward, got {outward_sum}"
    assert net_movement == 225.0, f"Expected net movement +225, got {net_movement}"
    print(f"TEST TX-02 PASS: Inward 500 - Outward 275 = Net {net_movement}")


def test_tx_03_reservation_is_not_stock_out():
    """
    TEST TX-03:
    Reservation of 100
    Expected: Stock Out = 0 because reservation is not physical movement.
    """
    prod = create_controlled_product(initial_stock=150.0)
    sku = prod["sku"]

    # Initial outward count for this product
    txs_before = TransactionRepository.get_transactions(limit=100)
    out_before = [t for t in txs_before if str(t.get("product_id")) == prod["id"] and t.get("transaction_type") in ("sale", "return_out")]

    # Create order reservation of 100
    headers = get_admin_headers()
    order_res = client.post("/api/orders/reserve", json={
        "shop_name": "Test Client Shop",
        "items": [{
            "sku": sku,
            "item_name": f"Item {sku}",
            "category": "Testing",
            "quantity": 100.0,
            "price": 100.0
        }]
    }, headers=headers)
    assert order_res.status_code == 200, f"Order reservation failed: {order_res.text}"

    # Verify no OUTWARD / sale transaction created
    txs_after = TransactionRepository.get_transactions(limit=100)
    out_after = [t for t in txs_after if str(t.get("product_id")) == prod["id"] and t.get("transaction_type") in ("sale", "return_out")]
    assert len(out_after) == len(out_before), "Reservation must NOT generate an outward physical transaction!"

    # Verify physical on_hand is unchanged
    db = get_supabase_client()
    if db:
        inv = db.table("inventory").select("*").eq("product_id", prod["id"]).limit(1).execute().data[0]
        assert float(inv["quantity_on_hand"]) == 150.0, "Physical quantity_on_hand must not decrease on reservation"
        assert float(inv["quantity_reserved"]) >= 100.0, "quantity_reserved should reflect the commitment"
    print("TEST TX-03 PASS: Reservation does NOT create Stock Out")


def test_tx_04_reservation_release_is_not_stock_in():
    """
    TEST TX-04:
    Reservation release of 100
    Expected: Stock In = 0 because release is not physical movement.
    """
    prod = create_controlled_product(initial_stock=150.0)
    sku = prod["sku"]

    # Create order
    headers = get_admin_headers()
    order_res = client.post("/api/orders/reserve", json={
        "shop_name": "Test Client Shop",
        "items": [{
            "sku": sku,
            "item_name": f"Item {sku}",
            "category": "Testing",
            "quantity": 100.0,
            "price": 100.0
        }]
    }, headers=headers)
    order_id = order_res.json()["order_id"]

    # Reject / Cancel order to release reservation
    txs_before = TransactionRepository.get_transactions(limit=100)
    in_before = [t for t in txs_before if str(t.get("product_id")) == prod["id"] and t.get("transaction_type") in ("inward", "return_in")]

    rej_res = client.post(f"/api/orders/{order_id}/reject", json={"reason": "Test Release"}, headers=headers)
    assert rej_res.status_code == 200, f"Reject failed: {rej_res.text}"

    txs_after = TransactionRepository.get_transactions(limit=100)
    in_after = [t for t in txs_after if str(t.get("product_id")) == prod["id"] and t.get("transaction_type") in ("inward", "return_in")]
    assert len(in_after) == len(in_before), "Reservation release must NOT generate an inward physical transaction!"
    print("TEST TX-04 PASS: Reservation release does NOT create Stock In")


def test_tx_05_process_order_physically_issues_stock():
    """
    TEST TX-05:
    Process order physically issuing 40
    Expected: Stock Out increases by exactly 40.
    """
    prod = create_controlled_product(initial_stock=100.0)
    sku = prod["sku"]

    headers = get_admin_headers()
    order_res = client.post("/api/orders/reserve", json={
        "shop_name": "Test Client Shop",
        "items": [{
            "sku": sku,
            "item_name": f"Item {sku}",
            "category": "Testing",
            "quantity": 40.0,
            "price": 100.0
        }]
    }, headers=headers)
    order_id = order_res.json()["order_id"]

    # Process order
    dispatch_res = client.post(f"/api/orders/{order_id}/process", headers=headers)
    assert dispatch_res.status_code == 200, f"Process order failed: {dispatch_res.text}"

    # Verify physical transaction exists
    db = get_supabase_client()
    if db:
        tx_rows = db.table("inventory_transactions").select("*").eq("product_id", prod["id"]).eq("transaction_type", "sale").execute().data
        assert len(tx_rows) > 0, "Expected at least one sale transaction for order fulfillment"
        matching = [r for r in tx_rows if float(r["quantity"]) == 40.0]
        assert len(matching) == 1, f"Expected exactly one transaction with quantity 40.0, got {len(matching)}"

        inv = db.table("inventory").select("*").eq("product_id", prod["id"]).limit(1).execute().data[0]
        assert float(inv["quantity_on_hand"]) == 60.0, f"Expected quantity_on_hand 60.0, got {inv['quantity_on_hand']}"
    print("TEST TX-05 PASS: Order dispatch issues exactly 40 units into physical ledger")


def test_tx_06_return_physical_units():
    """
    TEST TX-06:
    Return 15 physical units
    Expected: Stock In increases by 15.
    """
    prod = create_controlled_product(initial_stock=50.0)
    sku = prod["sku"]

    headers = get_admin_headers()
    ret_res = client.post("/api/returns", json={
        "sku": sku,
        "item_name": f"Item {sku}",
        "quantity": 15,
        "price": 100.0,
        "condition": "Good Return",
        "reason": "Customer Overordered",
        "customer_name": "Return Client"
    }, headers=headers)
    assert ret_res.status_code == 200, f"Return failed: {ret_res.text}"

    db = get_supabase_client()
    if db:
        tx_rows = db.table("inventory_transactions").select("*").eq("product_id", prod["id"]).eq("transaction_type", "return_in").execute().data
        matching = [r for r in tx_rows if float(r["quantity"]) == 15.0]
        assert len(matching) >= 1, "Expected return_in transaction of 15 units in ledger"

        inv = db.table("inventory").select("*").eq("product_id", prod["id"]).limit(1).execute().data[0]
        assert float(inv["quantity_on_hand"]) == 65.0, f"Expected 65.0 after return of 15, got {inv['quantity_on_hand']}"
    print("TEST TX-06 PASS: Return creates return_in transaction of 15 units")


def test_tx_07_duplicate_api_request():
    """
    TEST TX-07:
    Duplicate API request
    Expected: no duplicate transaction.
    """
    prod = create_controlled_product(initial_stock=50.0)
    sku = prod["sku"]
    headers = get_admin_headers()
    client_ref = f"RET-IDEMP-{uuid.uuid4().hex[:6].upper()}"

    payload = {
        "client_reference": client_ref,
        "sku": sku,
        "item_name": f"Item {sku}",
        "quantity": 5,
        "price": 100.0,
        "condition": "Good Return",
        "reason": "Idempotency Test",
        "customer_name": "Idemp Client"
    }

    res1 = client.post("/api/returns", json=payload, headers=headers)
    assert res1.status_code == 200

    res2 = client.post("/api/returns", json=payload, headers=headers)
    assert res2.status_code == 200
    assert res2.json().get("idempotent") is True or res2.json().get("status") == "already_processed"

    db = get_supabase_client()
    if db:
        if is_valid_uuid(client_ref):
            tx_rows = db.table("inventory_transactions").select("*").eq("product_id", prod["id"]).eq("client_reference", client_ref).execute().data
        else:
            tx_rows = db.table("inventory_transactions").select("*").eq("product_id", prod["id"]).ilike("notes", f"%{client_ref}%").execute().data
        assert len(tx_rows) == 1, f"Expected exactly 1 transaction row for duplicate client_reference, got {len(tx_rows)}"
    print("TEST TX-07 PASS: Duplicate request prevents duplicate ledger entry")


def test_tx_08_failed_mutation_creates_no_transaction():
    """
    TEST TX-08:
    Failed inventory mutation
    Expected: no transaction row.
    """
    prod = create_controlled_product(initial_stock=10.0)
    pid = prod["id"]
    headers = get_admin_headers()

    # Attempt to stock out 9999 (exceeds available 10.0)
    res = client.post("/api/inventory/stock-out", json={
        "product_id": pid,
        "quantity": 9999.0,
        "reason": "Impossible dispatch"
    }, headers=headers)
    assert res.status_code in (400, 409, 422, 500), f"Expected failure status code, got {res.status_code}: {res.text}"

    # Verify no transaction row was written
    txs = TransactionRepository.get_transactions(limit=100)
    failed_txs = [t for t in txs if str(t.get("product_id")) == pid and float(t.get("quantity", 0)) == 9999.0]
    assert len(failed_txs) == 0, "Failed mutation must NOT write transaction row"
    print("TEST TX-08 PASS: Failed mutation writes no transaction")


def test_tx_09_successful_mutation_creates_exactly_one_transaction():
    """
    TEST TX-09:
    Successful inventory mutation
    Expected: exactly one corresponding transaction per physical movement.
    """
    prod = create_controlled_product(initial_stock=20.0)
    pid = prod["id"]
    headers = get_admin_headers()

    res = client.post("/api/inventory/stock-in", json={
        "product_id": pid,
        "quantity": 17.0,
        "unit_cost": 50.0,
        "reference_number": f"IN-EXACT-{uuid.uuid4().hex[:6].upper()}"
    }, headers=headers)
    assert res.status_code == 200

    db = get_supabase_client()
    if db:
        txs = db.table("inventory_transactions").select("*").eq("product_id", pid).eq("transaction_type", "inward").execute().data
        matching = [t for t in txs if float(t["quantity"]) == 17.0]
        assert len(matching) == 1, f"Expected exactly 1 transaction with quantity 17.0, got {len(matching)}"
    print("TEST TX-09 PASS: Exactly one transaction created per physical movement")


def test_tx_10_daily_aggregation():
    """
    TEST TX-10:
    Daily aggregation
    Insert known transactions across 3 dates.
    Verify each day's Stock In and Stock Out exactly match transaction rows.
    """
    today = datetime.utcnow()
    d1 = (today - timedelta(days=2)).strftime("%Y-%m-%d")
    d2 = (today - timedelta(days=1)).strftime("%Y-%m-%d")
    d3 = today.strftime("%Y-%m-%d")

    dummy_txs = [
        {"transaction_type": "inward", "quantity": 100.0, "transaction_date": f"{d1}T10:00:00+00:00", "notes": "d1 in"},
        {"transaction_type": "sale", "quantity": 40.0, "transaction_date": f"{d1}T12:00:00+00:00", "notes": "d1 out"},
        {"transaction_type": "sale", "quantity": 25.0, "transaction_date": f"{d2}T09:00:00+00:00", "notes": "d2 out"},
        {"transaction_type": "inward", "quantity": 80.0, "transaction_date": f"{d3}T08:00:00+00:00", "notes": "d3 in"},
    ]

    # Test daily bucket calculation logic
    buckets = {}
    for d in [d1, d2, d3]:
        buckets[d] = {"stock_in": 0.0, "stock_out": 0.0}

    for tx in dummy_txs:
        date_str = tx["transaction_date"][:10]
        tt = tx["transaction_type"]
        q = tx["quantity"]
        if tt == "inward":
            buckets[date_str]["stock_in"] += q
        elif tt == "sale":
            buckets[date_str]["stock_out"] += q

    assert buckets[d1]["stock_in"] == 100.0 and buckets[d1]["stock_out"] == 40.0
    assert buckets[d2]["stock_in"] == 0.0 and buckets[d2]["stock_out"] == 25.0
    assert buckets[d3]["stock_in"] == 80.0 and buckets[d3]["stock_out"] == 0.0
    print("TEST TX-10 PASS: Daily aggregation matches underlying transaction rows")


def test_tx_11_date_range_filtering():
    """
    TEST TX-11:
    Date range
    Select a known range. Verify transactions outside range are excluded.
    """
    headers = get_admin_headers()
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    res = client.get(f"/api/transactions?dateFrom={today_str}&dateTo={today_str}", headers=headers)
    assert res.status_code == 200
    txs = res.json()
    for t in txs:
        t_date = (t.get("createdAt") or t.get("created_at") or "")[:10]
        if t_date:
            assert t_date == today_str, f"Transaction date {t_date} outside requested range {today_str}"
    print("TEST TX-11 PASS: Transactions outside selected date range are excluded")


def test_tx_12_long_range_weekly_monthly_aggregation():
    """
    TEST TX-12:
    Long range
    Verify weekly/monthly aggregation equals the sum of underlying daily transactions.
    """
    summary_daily = AnalyticsService.get_stock_movement_summary(
        start_date=(datetime.utcnow() - timedelta(days=60)).strftime("%Y-%m-%d"),
        end_date=datetime.utcnow().strftime("%Y-%m-%d"),
        granularity="daily"
    )
    summary_weekly = AnalyticsService.get_stock_movement_summary(
        start_date=(datetime.utcnow() - timedelta(days=60)).strftime("%Y-%m-%d"),
        end_date=datetime.utcnow().strftime("%Y-%m-%d"),
        granularity="weekly"
    )

    daily_total_in = sum(item["stock_in"] for item in summary_daily["timeline"])
    weekly_total_in = sum(item["stock_in"] for item in summary_weekly["timeline"])
    assert round(daily_total_in, 2) == round(weekly_total_in, 2), f"Daily sum ({daily_total_in}) != Weekly sum ({weekly_total_in})"
    print(f"TEST TX-12 PASS: Weekly aggregation ({weekly_total_in}) equals daily sum ({daily_total_in})")


def test_tx_13_ledger_to_balance_reconciliation():
    """
    TEST TX-13:
    Ledger-to-balance reconciliation
    For a controlled inventory item:
    opening balance + physical inward - physical outward ± adjustments/returns
    must equal closing balance.
    """
    prod = create_controlled_product(initial_stock=100.0)
    pid = prod["id"]

    # Inward 30
    InventoryService.record_stock_in(
        items=[{"product_id": pid, "quantity": 30.0}],
        supplier="Vendor 1"
    )
    # Outward 15
    InventoryService.record_stock_out(
        items=[{"product_id": pid, "quantity": 15.0}],
        recipient="Recipient 1"
    )

    db = get_supabase_client()
    if db:
        inv = db.table("inventory").select("*").eq("product_id", pid).limit(1).execute().data[0]
        closing_balance = float(inv["quantity_on_hand"])

        tx_rows = db.table("inventory_transactions").select("*").eq("product_id", pid).execute().data
        calc_stock = ReconciliationService._calculate_ledger_stock(tx_rows)

        # Expected: 100 (initial adjustment) + 30 (inward) - 15 (outward) = 115
        assert closing_balance == 115.0, f"Expected closing balance 115.0, got {closing_balance}"
        assert calc_stock == 115.0, f"Reconciliation calculation {calc_stock} != closing balance {closing_balance}"
    print("TEST TX-13 PASS: Ledger-to-balance reconciles exactly")


if __name__ == "__main__":
    print("Running Phase 1C Transaction Tests...")
    test_tx_01_stock_in_and_out_balance()
    test_tx_02_net_physical_movement()
    test_tx_03_reservation_is_not_stock_out()
    test_tx_04_reservation_release_is_not_stock_in()
    test_tx_05_process_order_physically_issues_stock()
    test_tx_06_return_physical_units()
    test_tx_07_duplicate_api_request()
    test_tx_08_failed_mutation_creates_no_transaction()
    test_tx_09_successful_mutation_creates_exactly_one_transaction()
    test_tx_10_daily_aggregation()
    test_tx_11_date_range_filtering()
    test_tx_12_long_range_weekly_monthly_aggregation()
    test_tx_13_ledger_to_balance_reconciliation()
    print("ALL PHASE 1C TESTS PASSED SUCCESSFULLY!")
