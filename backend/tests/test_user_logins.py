# backend/tests/test_user_logins.py
import sys
from pathlib import Path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

users = [
    ("jagmohan@nalkametals.com", "Jagmohan@2026", "admin", "Jagmohan Sardhana"),
    ("jagmohan", "jagmohan@2026", "admin", "Jagmohan Sardhana"),
    ("parag@nalkametals.com", "Parag@2026", "stock_manager", "Parag Sharma"),
    ("parag", "parag@2026", "stock_manager", "Parag Sharma"),
    ("rajesh@nalkametals.com", "Rajesh@2026", "manager", "Rajesh Sharma"),
    ("rajesh", "rajesh@2026", "manager", "Rajesh Sharma"),
    ("ankit@nalkametals.com", "Ankit@2026", "salesman", "Ankit Kumar"),
    ("ankit", "ankit@2026", "salesman", "Ankit Kumar"),
    ("chandra.prakash@nalkametals.com", "Chandra@2026", "salesman", "CHANDRA PRAKASH"),
    ("dheeraj@nalkametals.com", "Dheeraj@2026", "viewer", "Dheeraj Sharma"),
]

for identifier, pwd, expected_role, expected_name in users:
    res = client.post("/api/auth/login", json={"email": identifier, "password": pwd})
    assert res.status_code == 200, f"Failed for {identifier}: {res.text}"
    u = res.json()["user"]
    assert u["role"] == expected_role, f"Role mismatch for {identifier}: {u['role']} != {expected_role}"
    assert u["full_name"] == expected_name, f"Name mismatch for {identifier}: {u['full_name']} != {expected_name}"
    print(f"PASS: {identifier} -> role: {expected_role}, name: {expected_name}")

print("\nALL USER LOGINS WITH [firstname]@2026 PASSED SUCCESSFULLY!")
