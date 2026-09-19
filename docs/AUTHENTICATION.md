# Business Ops Platform — Unified Authentication & Authorization Architecture

**Phase Status**: Phase 3 Unified Security & Identity Layer Completed  
**Target Repository**: `business-ops-platform`  
**Authoritative Identity Source**: FastAPI JWT Authentication & Supabase Auth (`users` / `user_profiles` table)  

---

## 1. Executive Security Architecture

The **Business Ops Platform** establishes a single, central security boundary across all three business workspaces:

```
                    UNIFIED LOGIN FLOW (/login)
                                │
                                ▼
                      POST /api/auth/login
              (Cryptographic JWT Minting & Claims)
                                │
                        Auth Session Object
                    { token, user: { id, role } }
                                │
               ┌────────────────┼────────────────┐
               │                │                │
            /sales         /operations      /management
          (RouteGuard)     (RouteGuard)     (RouteGuard)
               │                │                │
        salesman, manager,  stock_manager,    admin only
            admin            admin
```

---

## 2. Authentication Model & Token Claims

1. **Credentials Verification**: `app/login/page.tsx` submits credentials to `POST /api/auth/login`. Upon validation against Supabase Auth or the PostgreSQL `users` table, a signed Bearer JWT token is minted.
2. **Session Token Claims**:
   - `user_id`: Unique database primary key identifier.
   - `email`: User account email address.
   - `role`: Authoritative role assigned in backend database (`admin`, `stock_manager`, `order_manager`, `salesman`, `viewer`).
   - `full_name`: Display name.
   - `salesman_id`: Optional sales rep reference code (e.g. `TLY-SLM-003`).

---

## 3. Role & Permission Matrix

| Role Name | Accessible Workspaces | Granted Permissions | Default Workspace |
|---|---|---|---|
| **`salesman`** | Sales Workspace (`/sales`) | `orders.create`, `orders.view`, `customers.view`, `products.view` | `/sales` |
| **`stock_manager`** / **`operations`** | Sales Workspace (`/sales`), Operations Workspace (`/operations`) | `inventory.view`, `inventory.manage`, `orders.process`, `returns.manage`, `orders.view` | `/operations` |
| **`admin`** / **`management`** | Sales (`/sales`), Operations (`/operations`), Management (`/management`) | `analytics.view`, `reports.view`, `users.manage`, `system.manage`, `all` | `/management` |
| **`viewer`** | Sales Workspace (`/sales` read-only) | `orders.view`, `products.view` | `/sales` |

---

## 4. Protected Routes (`RouteGuard`)

Route protection is enforced by `shared/RouteGuard.tsx` wrapping all workspace page entries:

1. **Unauthenticated Redirect**: Any unauthenticated request attempting to load `/sales`, `/operations`, or `/management` is immediately intercepted and redirected to `/login`.
2. **Unauthorized Role Enforcement**: Any user session lacking permission for a workspace (e.g., a `salesman` attempting to enter `/management`) is denied and redirected to their allowed default workspace (`getDefaultWorkspace(user.role)`).
3. **Tamper-Proof Authorization**: Role permissions are evaluated against the verified session profile (`getAuthSession()`), preventing client-side `localStorage` state manipulation from bypassing workspace protection.

---

## 5. Permission-Aware Platform Header

The global platform navigation bar ([`shared/PlatformHeader.tsx`](file:///d:/Projects/Business%20Ops%20Platform/shared/PlatformHeader.tsx)) dynamically inspects the authenticated user role:

- **Sales Rep (`salesman`)**: Renders `Sales Workspace` tab only.
- **Operations Manager (`stock_manager`)**: Renders `Sales Workspace` & `Operations Workspace` tabs.
- **Administrator / BI Executive (`admin`)**: Renders all workspace tabs (`Sales`, `Operations`, `Management`).
- **Logout Action**: Invokes `clearAuthSession()`, clears JWT tokens, and returns to `/login`.

---

## 6. Testing & Security Verification Matrix

| Test Scenario | Input / Action | Expected Result | Status |
|---|---|---|---|
| **A. Unauthenticated Direct URL Access** | Navigate directly to `/sales`, `/operations`, or `/management` | Intercepted by `RouteGuard`, redirected to `/login` | **`PASS`** |
| **B. Sales Representative Login** | Log in as `sales@nalkametals.com` | Auto-routed to `/sales`. Management tab hidden. | **`PASS`** |
| **C. Sales Rep Unauthorized Access** | Sales rep attempts URL navigation to `/management` | Access denied, redirected to `/sales` | **`PASS`** |
| **D. Operations Manager Login** | Log in as `stock@nalkametals.com` | Auto-routed to `/operations`. Allowed `/sales` & `/operations`. | **`PASS`** |
| **E. Operations Manager Unauthorized Access** | Operations manager attempts URL navigation to `/management` | Access denied, redirected to `/operations` | **`PASS`** |
| **F. System Admin Login** | Log in as `admin@nalkametals.com` | Auto-routed to `/management`. Allowed all workspace tabs. | **`PASS`** |
| **G. Tampered Role State Test** | Edit `localStorage` role value to 'admin' as a salesman | `RouteGuard` verifies verified identity and blocks access | **`PASS`** |
| **H. Session Persistence & Logout** | Refresh page or click Logout | Refresh maintains valid session; Logout clears tokens to `/login` | **`PASS`** |

---

## 7. Development Login Accounts Reference

- **Admin Account**: `admin@nalkametals.com` / `password123` (Access to all workspaces)
- **Operations Account**: `stock@nalkametals.com` / `password123` (Access to Operations & Sales)
- **Sales Rep Account**: `sales@nalkametals.com` / `password123` (Access to Sales)
