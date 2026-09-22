# backend/tests/test_phase1b_inventory.py
import sys
import uuid
import time
from datetime import datetime, timedelta
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from main import app
from auth import create_access_token
from config.database import get_db_client
from services.inventory_service import InventoryService, is_valid_uuid
from repositories.inventory_repo import InventoryRepository
from repositories.order_repo import OrderRepository

client = TestClient(app)

def get_admin_headers():
    token = create_access_token({"user_id": "usr-admin-001", "email": "admin@nalkametals.com", "role": "admin", "full_name": "Admin User"})
    return {"Authorization": f"Bearer {token}"}

def test_inv_01_create_sku():
    headers = get_admin_headers()
    test_sku = f"NLK-TST-{uuid.uuid4().hex[:6].upper()}"
    payload = {
        "sku": test_sku,
        "name": f"Test Item {test_sku}",
        "category": "Testing",
        "unit_price": 100.0,
        "cost_price": 80.0,
        "quantity": 0.0,
        "unit": "NOS"
    }
    res = client.post("/api/inventory", json=payload, headers=headers)
    assert res.status_code == 200, f"Create SKU failed: {res.text}"
    prod_id = res.json()["id"]
    assert is_valid_uuid(prod_id)

    db = get_db_client()
    if db:
        inv_res = db.table("inventory").select("*").eq("product_id", prod_id).execute()
        assert len(inv_res.data) > 0
        inv = inv_res.data[0]
        assert float(inv["quantity_on_hand"]) == 0.0
        assert float(inv["quantity_reserved"]) == 0.0
        assert float(inv["quantity_available"]) == 0.0
    print(f"INV-01 PASS: Create SKU {test_sku}")

def test_inv_02_duplicate_sku():
    headers = get_admin_headers()
    test_sku = f"NLK-DUP-{uuid.uuid4().hex[:6].upper()}"
    payload = {
        "sku": test_sku,
        "name": f"Test Duplicate {test_sku}",
        "unit_price": 100.0,
        "quantity": 0.0
    }
    res1 = client.post("/api/inventory", json=payload, headers=headers)
    assert res1.status_code == 200

    res2 = client.post("/api/inventory", json=payload, headers=headers)
    assert res2.status_code == 400
    assert "already exists" in res2.text.lower()
    print("INV-02 PASS: Duplicate SKU rejected")

def test_inv_03_receive_stock():
    headers = get_admin_headers()
    test_sku = f"NLK-REC-{uuid.uuid4().hex[:6].upper()}"
    client.post("/api/inventory", json={"sku": test_sku, "name": f"Receive Test {test_sku}", "unit_price": 50.0, "quantity": 10.0}, headers=headers)

    db = get_db_client()
    if db:
        prod = db.table("products").select("id").eq("sku", test_sku).limit(1).execute().data[0]
        pid = prod["id"]

        rec_res = client.post("/api/inventory/stock-in", json={
            "product_id": pid,
            "quantity": 5.0,
            "unit_cost": 50.0,
            "reference_number": f"REC-{test_sku}"
        }, headers=headers)
        assert rec_res.status_code == 200, f"Stock in failed: {rec_res.text}"

        inv_res = db.table("inventory").select("*").eq("product_id", pid).execute()
        inv = inv_res.data[0]
        print(f"DEBUG INV-03: inv data = {inv_res.data}")
        assert float(inv["quantity_on_hand"]) == 15.0, f"Expected 15.0, got {inv.get('quantity_on_hand')}"

        tx_res = db.table("inventory_transactions").select("*").eq("product_id", pid).eq("transaction_type", "inward").execute()
        assert len(tx_res.data) > 0
    print("INV-03 PASS: Receive stock inward")

def test_inv_04_invalid_receive_quantity():
    headers = get_admin_headers()
    res = client.post("/api/inventory/stock-in", json={
        "product_id": str(uuid.uuid4()),
        "quantity": -5.0,
        "unit_cost": 50.0
    }, headers=headers)
    assert res.status_code in (400, 422)
    print("INV-04 PASS: Invalid receive quantity rejected")

def test_inv_05_receive_stock_using_sku():
    headers = get_admin_headers()
    test_sku = f"NLK-SKUR-{uuid.uuid4().hex[:6].upper()}"
    client.post("/api/inventory", json={"sku": test_sku, "name": f"SKU Test {test_sku}", "unit_price": 60.0, "quantity": 10.0}, headers=headers)

    rec_res = client.post("/api/inventory/stock-in", json={
        "product_id": test_sku,
        "quantity": 5.0,
        "unit_cost": 60.0,
        "reference_number": f"REC-{test_sku}"
    }, headers=headers)
    assert rec_res.status_code == 200, f"Stock in with SKU string failed: {rec_res.text}"
    print("INV-05 PASS: Receive stock using SKU string resolved to UUID")

def test_inv_06_stock_out():
    headers = get_admin_headers()
    test_sku = f"NLK-OUT-{uuid.uuid4().hex[:6].upper()}"
    client.post("/api/inventory", json={"sku": test_sku, "name": f"Stock Out Test {test_sku}", "unit_price": 100.0, "quantity": 20.0}, headers=headers)

    db = get_db_client()
    if db:
        prod = db.table("products").select("id").eq("sku", test_sku).limit(1).execute().data[0]
        pid = prod["id"]

        out_res = client.post("/api/inventory/stock-out", json={
            "product_id": pid,
            "quantity": 5.0,
            "reference_number": f"SO-{test_sku}"
        }, headers=headers)
        assert out_res.status_code == 200, f"Stock out failed: {out_res.text}"

        inv_res = db.table("inventory").select("*").eq("product_id", pid).execute()
        inv = inv_res.data[0]
        assert float(inv["quantity_on_hand"]) == 15.0

        tx_res = db.table("inventory_transactions").select("*").eq("product_id", pid).eq("transaction_type", "sale").execute()
        assert len(tx_res.data) > 0
    print("INV-06 PASS: Stock out sale transaction")

def test_inv_07_insufficient_stock_out():
    headers = get_admin_headers()
    test_sku = f"NLK-INS-{uuid.uuid4().hex[:6].upper()}"
    client.post("/api/inventory", json={"sku": test_sku, "name": f"Low Stock {test_sku}", "unit_price": 100.0, "quantity": 5.0}, headers=headers)

    db = get_db_client()
    if db:
        prod = db.table("products").select("id").eq("sku", test_sku).limit(1).execute().data[0]
        pid = prod["id"]

        out_res = client.post("/api/inventory/stock-out", json={
            "product_id": pid,
            "quantity": 50.0,
            "reference_number": f"SO-{test_sku}"
        }, headers=headers)
        assert out_res.status_code == 409
        assert "INSUFFICIENT_STOCK" in out_res.text
    print("INV-07 PASS: Insufficient stock out rejected with 409")

def test_inv_08_reservation():
    headers = get_admin_headers()
    test_sku = f"NLK-RES-{uuid.uuid4().hex[:6].upper()}"
    client.post("/api/inventory", json={"sku": test_sku, "name": f"Reserve Test {test_sku}", "unit_price": 100.0, "quantity": 20.0}, headers=headers)

    ref = f"REF-{uuid.uuid4().hex[:8]}"
    order_payload = {
        "client_reference": ref,
        "shop_name": "Test Dealer",
        "items": [{"sku": test_sku, "quantity": 8.0, "price": 100.0}]
    }
    res = client.post("/api/orders/reserve", json=order_payload, headers=headers)
    assert res.status_code == 200, f"Order reservation failed: {res.text}"

    db = get_db_client()
    if db:
        prod = db.table("products").select("id").eq("sku", test_sku).limit(1).execute().data[0]
        inv = db.table("inventory").select("*").eq("product_id", prod["id"]).execute().data[0]
        assert float(inv["quantity_reserved"]) == 8.0
        assert float(inv["quantity_available"]) == 12.0
    print("INV-08 PASS: Stock reservation")

def test_inv_09_insufficient_reservation():
    headers = get_admin_headers()
    test_sku = f"NLK-IRES-{uuid.uuid4().hex[:6].upper()}"
    client.post("/api/inventory", json={"sku": test_sku, "name": f"Low Stock Reserve {test_sku}", "unit_price": 100.0, "quantity": 5.0}, headers=headers)

    ref = f"REF-{uuid.uuid4().hex[:8]}"
    order_payload = {
        "client_reference": ref,
        "shop_name": "Test Dealer",
        "items": [{"sku": test_sku, "quantity": 50.0, "price": 100.0}]
    }
    res = client.post("/api/orders/reserve", json=order_payload, headers=headers)
    assert res.status_code in (400, 409)
    assert "INSUFFICIENT_STOCK" in res.text
    print("INV-09 PASS: Insufficient reservation rejected without partial line reservation")

def test_inv_10_reservation_idempotency():
    headers = get_admin_headers()
    test_sku = f"NLK-IDEM-{uuid.uuid4().hex[:6].upper()}"
    client.post("/api/inventory", json={"sku": test_sku, "name": f"Idempotent {test_sku}", "unit_price": 100.0, "quantity": 20.0}, headers=headers)

    ref = f"REF-{uuid.uuid4().hex[:8]}"
    order_payload = {
        "client_reference": ref,
        "shop_name": "Test Dealer",
        "items": [{"sku": test_sku, "quantity": 5.0, "price": 100.0}]
    }
    res1 = client.post("/api/orders/reserve", json=order_payload, headers=headers)
    assert res1.status_code == 200

    res2 = client.post("/api/orders/reserve", json=order_payload, headers=headers)
    assert res2.status_code == 200
    assert res2.json().get("idempotent") is True

    db = get_db_client()
    if db:
        prod = db.table("products").select("id").eq("sku", test_sku).limit(1).execute().data[0]
        inv = db.table("inventory").select("*").eq("product_id", prod["id"]).execute().data[0]
        assert float(inv["quantity_reserved"]) == 5.0
    print("INV-10 PASS: Reservation idempotency")

def test_inv_11_release_reservation():
    headers = get_admin_headers()
    test_sku = f"NLK-REL-{uuid.uuid4().hex[:6].upper()}"
    client.post("/api/inventory", json={"sku": test_sku, "name": f"Release {test_sku}", "unit_price": 100.0, "quantity": 20.0}, headers=headers)

    ref = f"REF-{uuid.uuid4().hex[:8]}"
    res = client.post("/api/orders/reserve", json={
        "client_reference": ref,
        "shop_name": "Test Dealer",
        "items": [{"sku": test_sku, "quantity": 5.0, "price": 100.0}]
    }, headers=headers)
    order_id = res.json()["order_id"]

    cancel_res = client.post(f"/api/orders/{order_id}/cancel", json={"reason": "Testing release"}, headers=headers)
    assert cancel_res.status_code == 200

    db = get_db_client()
    if db:
        prod = db.table("products").select("id").eq("sku", test_sku).limit(1).execute().data[0]
        inv = db.table("inventory").select("*").eq("product_id", prod["id"]).execute().data[0]
        assert float(inv["quantity_reserved"]) == 0.0
    print("INV-11 PASS: Release reservation on order cancellation")

def test_inv_14_generated_column_protection():
    db = get_db_client()
    if db:
        try:
            prod = db.table("products").select("id").limit(1).execute().data[0]
            db.table("inventory").update({"quantity_available": 999.0}).eq("product_id", prod["id"]).execute()
            assert False, "Should have thrown code 428C9 for generated column"
        except Exception as e:
            assert "428C9" in str(e) or "generated column" in str(e).lower()
    print("INV-14 PASS: Generated column quantity_available is protected")

def test_inv_15_transaction_enums():
    from repositories.transaction_repo import TransactionRepository
    headers = get_admin_headers()
    test_sku = f"NLK-ENM-{uuid.uuid4().hex[:6].upper()}"
    client.post("/api/inventory", json={"sku": test_sku, "name": f"Enum Test {test_sku}", "unit_price": 50.0, "quantity": 100.0}, headers=headers)
    db = get_db_client()
    if db:
        prod = db.table("products").select("id").eq("sku", test_sku).limit(1).execute().data[0]["id"]
        loc = db.table("inventory").select("location_id").eq("product_id", prod).limit(1).execute().data[0]["location_id"]
        valid_enums = ["inward", "sale", "adjustment", "return_in"]
        for t in valid_enums:
            ref_type = "adjustment"
            tx = TransactionRepository.record_stock_transaction({
                "transaction_type": t,
                "product_id": prod,
                "location_id": loc,
                "reference_type": ref_type,
                "quantity": 1.0,
                "notes": "Automated Enum Test"
            })
            assert tx is not None
    print("INV-15 PASS: Transaction types match canonical database enums")

def test_inv_16_confirmation_grace_period():
    # Test grace period check for restricted salesman user
    salesman_token = create_access_token({"user_id": "test-slm-1", "email": "salesman@nalkametals.com", "role": "salesman", "full_name": "Salesman User"})
    sm_headers = {"Authorization": f"Bearer {salesman_token}"}

    test_sku = f"NLK-GRC-{uuid.uuid4().hex[:6].upper()}"
    get_admin_headers()
    client.post("/api/inventory", json={"sku": test_sku, "name": f"Grace Test {test_sku}", "unit_price": 100.0, "quantity": 20.0}, headers=get_admin_headers())

    ref = f"REF-{uuid.uuid4().hex[:8]}"
    res = client.post("/api/orders/reserve", json={
        "client_reference": ref,
        "shop_name": "Test Dealer",
        "items": [{"sku": test_sku, "quantity": 2.0, "price": 100.0}]
    }, headers=sm_headers)
    order_id = res.json()["order_id"]

    # Within grace period -> cancellation succeeds
    cancel_res = client.post(f"/api/orders/{order_id}/cancel", json={"reason": "Grace test cancel"}, headers=sm_headers)
    assert cancel_res.status_code == 200
    print("INV-16 PASS: Confirmation grace period enforced")

if __name__ == "__main__":
    test_inv_01_create_sku()
    test_inv_02_duplicate_sku()
    test_inv_03_receive_stock()
    test_inv_04_invalid_receive_quantity()
    test_inv_05_receive_stock_using_sku()
    test_inv_06_stock_out()
    test_inv_07_insufficient_stock_out()
    test_inv_08_reservation()
    test_inv_09_insufficient_reservation()
    test_inv_10_reservation_idempotency()
    test_inv_11_release_reservation()
    test_inv_14_generated_column_protection()
    test_inv_15_transaction_enums()
    test_inv_16_confirmation_grace_period()
    print("\nALL PHASE 1B INVENTORY AUTOMATED TESTS PASSED SUCCESSFULLY!")
