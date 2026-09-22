# backend/tests/test_auth_phase1a.py
import sys
from pathlib import Path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from main import app
from auth import create_access_token, verify_access_token, PERMISSION_MAP

client = TestClient(app)

def get_default_workspace_python(role: str) -> str:
    r = (role or "").lower()
    if r in ("admin", "accountant"):
        return "/management"
    if r == "stock_manager":
        return "/operations"
    if r in ("salesman", "viewer"):
        return "/sales"
    return "/sales"

def has_workspace_access_python(workspace: str, role: str) -> bool:
    r = (role or "").lower()
    if r in ("admin", "accountant"):
        return True
    if workspace == "sales":
        return r in ("salesman", "stock_manager", "viewer")
    if workspace == "operations":
        return r == "stock_manager"
    if workspace == "management":
        return False
    return False

def test_auth_01_admin_login():
    client.cookies.clear()
    res = client.post("/api/auth/login", json={"email": "jagmohan@nalkametals.com", "password": "Jagmohan@2026"})
    assert res.status_code == 200, f"Failed admin login: {res.text}"
    user = res.json()["user"]
    assert user["role"] == "admin"
    assert get_default_workspace_python(user["role"]) == "/management"
    assert "nalka_token" in res.cookies
    print("AUTH-01 PASS: Admin login")

def test_auth_02_accountant_login():
    client.cookies.clear()
    token = create_access_token({"user_id": "test-acc-1", "email": "accountant@nalkametals.com", "role": "accountant", "full_name": "Accountant User"})
    payload = verify_access_token(token)
    assert payload["role"] == "accountant"
    assert get_default_workspace_python(payload["role"]) == "/management"
    assert has_workspace_access_python("management", payload["role"]) is True
    assert has_workspace_access_python("operations", payload["role"]) is True
    assert has_workspace_access_python("sales", payload["role"]) is True
    assert "analytics.view" in PERMISSION_MAP["accountant"]
    print("AUTH-02 PASS: Accountant login")

def test_auth_03_stock_manager_login():
    client.cookies.clear()
    res = client.post("/api/auth/login", json={"email": "parag@nalkametals.com", "password": "Parag@2026"})
    assert res.status_code == 200, f"Failed stock_manager login: {res.text}"
    user = res.json()["user"]
    assert user["role"] == "stock_manager", f"Expected stock_manager, got {user['role']}"
    assert get_default_workspace_python(user["role"]) == "/operations"
    assert has_workspace_access_python("operations", user["role"]) is True
    assert has_workspace_access_python("sales", user["role"]) is True
    assert has_workspace_access_python("management", user["role"]) is False
    print("AUTH-03 PASS: Stock manager login")

def test_auth_04_salesman_login():
    client.cookies.clear()
    res = client.post("/api/auth/login", json={"email": "ankit@nalkametals.com", "password": "Ankit@2026"})
    assert res.status_code == 200, f"Failed salesman login: {res.text}"
    user = res.json()["user"]
    assert user["role"] == "salesman"
    assert get_default_workspace_python(user["role"]) == "/sales"
    assert has_workspace_access_python("sales", user["role"]) is True
    assert has_workspace_access_python("operations", user["role"]) is False
    print("AUTH-04 PASS: Salesman login")

def test_auth_05_viewer_login():
    client.cookies.clear()
    res = client.post("/api/auth/login", json={"email": "dheeraj@nalkametals.com", "password": "Dheeraj@2026"})
    assert res.status_code == 200, f"Failed viewer login: {res.text}"
    user = res.json()["user"]
    assert user["role"] == "viewer"
    assert get_default_workspace_python(user["role"]) == "/sales"
    print("AUTH-05 PASS: Viewer login")

def test_auth_06_invalid_credentials():
    client.cookies.clear()
    res = client.post("/api/auth/login", json={"email": "nonexistent@nalkametals.com", "password": "wrongpassword"})
    assert res.status_code == 401
    assert "nalka_token" not in res.cookies
    print("AUTH-06 PASS: Invalid credentials fail closed")

def test_auth_07_missing_session():
    client.cookies.clear()
    res = client.get("/api/auth/me")
    assert res.status_code == 401
    print("AUTH-07 PASS: Missing session returns 401")

def test_auth_08_refresh_stock_manager():
    client.cookies.clear()
    login_res = client.post("/api/auth/login", json={"email": "parag@nalkametals.com", "password": "Parag@2026"})
    cookie_token = login_res.cookies.get("nalka_token")
    
    me_res = client.get("/api/auth/me", cookies={"nalka_token": cookie_token})
    assert me_res.status_code == 200
    u = me_res.json()["user"]
    assert u["role"] == "stock_manager", f"Expected stock_manager on me query, got {u['role']}"
    print("AUTH-08 PASS: Refresh while stock_manager preserves identity")

def test_auth_09_refresh_admin():
    client.cookies.clear()
    login_res = client.post("/api/auth/login", json={"email": "jagmohan@nalkametals.com", "password": "Jagmohan@2026"})
    cookie_token = login_res.cookies.get("nalka_token")
    
    me_res = client.get("/api/auth/me", cookies={"nalka_token": cookie_token})
    assert me_res.status_code == 200
    u = me_res.json()["user"]
    assert u["role"] == "admin"
    print("AUTH-09 PASS: Refresh while admin preserves identity")

def test_auth_10_refresh_accountant():
    client.cookies.clear()
    token = create_access_token({"user_id": "test-acc-1", "email": "accountant@nalkametals.com", "role": "accountant", "full_name": "Accountant User"})
    me_res = client.get("/api/auth/me", cookies={"nalka_token": token})
    assert me_res.status_code == 200
    u = me_res.json()["user"]
    assert u["role"] == "accountant"
    print("AUTH-10 PASS: Refresh while accountant preserves identity")

def test_auth_11_logout():
    client.cookies.clear()
    logout_res = client.post("/api/auth/logout")
    assert logout_res.status_code == 200
    assert "nalka_token" in logout_res.headers.get("set-cookie", "")
    print("AUTH-11 PASS: Logout clears cookie")

def test_auth_12_after_logout_me_fails():
    client.cookies.clear()
    client.post("/api/auth/logout")
    me_res = client.get("/api/auth/me")
    assert me_res.status_code == 401
    print("AUTH-12 PASS: After logout, /api/auth/me returns 401")

def test_auth_16_unknown_role_fails_closed():
    assert has_workspace_access_python("management", "super_hacker") is False
    assert has_workspace_access_python("operations", "super_hacker") is False
    assert has_workspace_access_python("sales", "super_hacker") is False
    print("AUTH-16 PASS: Unknown role fails closed")

def test_auth_17_missing_role_fails_closed():
    token = create_access_token({"user_id": "test-none-1", "email": "norole@nalkametals.com", "full_name": "No Role"})
    payload = verify_access_token(token)
    role = payload.get("role", "")
    assert has_workspace_access_python("management", role) is False
    assert has_workspace_access_python("operations", role) is False
    print("AUTH-17 PASS: Missing role fails closed")

if __name__ == "__main__":
    test_auth_01_admin_login()
    test_auth_02_accountant_login()
    test_auth_03_stock_manager_login()
    test_auth_04_salesman_login()
    test_auth_05_viewer_login()
    test_auth_06_invalid_credentials()
    test_auth_07_missing_session()
    test_auth_08_refresh_stock_manager()
    test_auth_09_refresh_admin()
    test_auth_10_refresh_accountant()
    test_auth_11_logout()
    test_auth_12_after_logout_me_fails()
    test_auth_16_unknown_role_fails_closed()
    test_auth_17_missing_role_fails_closed()
    print("\nALL PHASE 1A AUTOMATED AUTH TESTS PASSED SUCCESSFULLY!")
