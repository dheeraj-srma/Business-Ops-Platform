# backend/tests/test_customer_assignment.py
import sys
from pathlib import Path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from main import app
from config.database import get_db_client

client = TestClient(app)

# 1. Login as admin
login_res = client.post("/api/auth/login", json={"email": "jagmohan", "password": "Jagmohan@2026"})
assert login_res.status_code == 200, f"Login failed: {login_res.text}"
token = login_res.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# 2. Test /api/auth/me queries database live
me_res = client.get("/api/auth/me", headers=headers)
assert me_res.status_code == 200, f"Failed /me: {me_res.text}"
user_me = me_res.json()["user"]
assert user_me["email"] == "jagmohan@nalkametals.com"
assert user_me["role"] == "admin"
print(f"PASS: /api/auth/me returned live user: {user_me['full_name']} ({user_me['role']})")

# 3. Test /api/admin/salesmen
sm_res = client.get("/api/admin/salesmen", headers=headers)
assert sm_res.status_code == 200
salesmen = sm_res.json()["salesmen"]
assert len(salesmen) == 7
print(f"PASS: /api/admin/salesmen returned {len(salesmen)} salesmen")
ankit_sm = next(s for s in salesmen if s["salesman_code"] == "TLY-SLM-001")
saurav_sm = next(s for s in salesmen if s["salesman_code"] == "TLY-SLM-006")

# 4. Test /api/admin/customer-assignments
assign_res = client.get("/api/admin/customer-assignments?limit=5", headers=headers)
assert assign_res.status_code == 200
data = assign_res.json()
assert data["total"] == 804
assert len(data["customers"]) == 5
test_customer = data["customers"][0]
print(f"PASS: /api/admin/customer-assignments returned {data['total']} total customers. Sample: {test_customer['name']}")

# 5. Test PATCH /api/admin/customer-assignments/{id} (assign to Ankit)
patch_res = client.patch(
    f"/api/admin/customer-assignments/{test_customer['id']}",
    headers=headers,
    json={"salesman_id": ankit_sm["id"]}
)
assert patch_res.status_code == 200, f"PATCH failed: {patch_res.text}"
updated = patch_res.json()["assignment"]
assert updated["assigned_salesman_id"] == ankit_sm["id"]
assert updated["salesman_code"] == "TLY-SLM-001"
print(f"PASS: Reassigned '{test_customer['name']}' to ANKIT (TLY-SLM-001)")

# 6. Test PATCH reassigning to Direct / None
revert_res = client.patch(
    f"/api/admin/customer-assignments/{test_customer['id']}",
    headers=headers,
    json={"salesman_id": None}
)
assert revert_res.status_code == 200
reverted = revert_res.json()["assignment"]
assert reverted["assigned_salesman_id"] is None
assert reverted["salesman_code"] == "DIRECT"
print(f"PASS: Reassigned '{test_customer['name']}' back to Direct")

# 7. Test bulk reassignment
bulk_res = client.post(
    "/api/admin/customer-assignments/bulk",
    headers=headers,
    json={"customer_ids": [test_customer["id"]], "salesman_id": saurav_sm["id"]}
)
assert bulk_res.status_code == 200
bulk_data = bulk_res.json()
assert bulk_data["updated_count"] == 1
print(f"PASS: Bulk reassigned 1 customer to SAURAV (TLY-SLM-006)")

# Revert back
client.patch(
    f"/api/admin/customer-assignments/{test_customer['id']}",
    headers=headers,
    json={"salesman_id": test_customer.get("assigned_salesman_id")}
)
print("PASS: Reverted test customer to original assignment state")

print("\nALL CUSTOMER ASSIGNMENT & LIVE AUTH TESTS PASSED SUCCESSFULLY!")
