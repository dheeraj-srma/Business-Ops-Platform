# Business Ops Platform — Unified Authentication & Authorization Architecture

**Phase Status**: Phase 3 Security Architecture Completed & Verified  
**Target Repository**: `business-ops-platform`  
**Security Boundary**: Server-Side Next.js Edge Middleware (`middleware.ts`) & FastAPI Permission Decorators (`require_permission`)  
**Session Storage**: Secure `HttpOnly; SameSite=Lax; Path=/` Cookie (`nalka_token`)  

---

## 1. Architectural Principles Implemented

1. **Server-Side Security Boundary**: The frontend (`RouteGuard`, `localStorage`, React state) is NOT the security boundary. Server-side Edge Middleware (`middleware.ts`) inspects incoming HTTP requests on the server before rendering any page, verifying the cryptographically signed JWT token and issuing a 307 server redirect to `/login` if unauthenticated or unauthorized.
2. **HttpOnly Cookie Session**: Session tokens are issued by the backend (`POST /api/auth/login`) and stored strictly in **`HttpOnly; SameSite=Lax; Path=/` cookies** (`nalka_token`). Client-side JavaScript cannot read or modify HttpOnly cookies, protecting credentials from XSS attacks.
3. **Single Authoritative Identity**: User accounts and credentials reside in Supabase Auth (`auth.users`) and `public.user_profiles`. No duplicate user databases or competing password systems exist.
4. **Role vs Workspace Separation**: Roles map centrally to granular permissions (`orders.create`, `inventory.manage`, `analytics.view`). Permissions determine workspace access.
5. **Permission-Based Authorization**: FastAPI endpoints enforce permission decorators (`require_permission("inventory.manage")`) rather than hardcoded role strings.
6. **Zero Code Rewrites**: Internal business logic, calculators, modals, forms, charts, and Tally integration across all three workspaces remain 100% preserved.

---

## 2. Authentication Lifecycles

### A. LOGIN Lifecycle
```
User Submits Email + Password to /login
                   │
                   ▼
  POST /api/auth/login (FastAPI / Supabase Auth)
                   │
  1. Verify credentials against auth.users / user_profiles
  2. Verify is_active == true
  3. Retrieve user role & resolve permission set
  4. Mint cryptographically signed JWT Token
  5. Set HttpOnly, SameSite=Lax Cookie ('nalka_token')
                   │
                   ▼
  Respond with Auth Session & User Profile
                   │
                   ▼
  Redirect to Authorized Default Workspace based on Permissions
```

### B. REQUEST Lifecycle (Server Security Boundary)
```
Browser Requests /sales, /operations, or /management
                   │
                   ▼
 Next.js Server Edge Middleware (middleware.ts)
                   │
  1. Extract HttpOnly 'nalka_token' cookie
  2. Verify JWT signature using secret key & check expiration
  3. Extract user role & resolve permission set
  4. Check if permission set covers target workspace
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
    Authorized          Unauthorized / No Cookie
         │                   │
  Render Page        Server Redirect (307)
                      to /login
```

### C. LOGOUT Lifecycle
```
User Clicks Logout in PlatformHeader
                   │
                   ▼
  POST /api/auth/logout (Delete HttpOnly nalka_token cookie)
                   │
                   ▼
  Clear client-side cached profile state
                   │
                   ▼
  Server Redirect to /login
```

---

## 3. Role & Permission Matrix

| Role Name | Granted Permissions | Accessible Workspaces | Default Workspace Route |
|---|---|---|---|
| **`salesman`** | `orders.create`, `orders.view`, `customers.view`, `products.view` | Sales Workspace (`/sales`) | `/sales` |
| **`stock_manager`** / **`order_manager`** | `inventory.view`, `inventory.manage`, `orders.process`, `returns.manage`, `orders.view`, `customers.view`, `products.view` | Operations (`/operations`), Sales (`/sales`) | `/operations` |
| **`admin`** | `analytics.view`, `reports.view`, `users.manage`, `system.manage`, `all` | All Workspaces (`/sales`, `/operations`, `/management`) | `/management` |
| **`viewer`** | `orders.view`, `products.view` | Sales Workspace (`/sales` read-only) | `/sales` |

---

## 4. Testing & Verification Matrix

| Test Scenario | Action | Outcome | Status |
|---|---|---|---|
| **A. Unauthenticated Server Interception** | Request `/sales`, `/operations`, or `/management` without cookie | Intercepted on server by `middleware.ts`, issued 307 redirect to `/login` | **`PASS`** |
| **B. HttpOnly Cookie Storage** | Log in ➔ Inspect `document.cookie` in browser | Token stored as HttpOnly, invisible to client JS | **`PASS`** |
| **C. Sales Rep Route Access** | Log in as Sales Rep ➔ Request `/sales` vs `/management` | `/sales` rendered; `/management` blocked by server middleware | **`PASS`** |
| **D. Operations Manager Route Access** | Log in as Operations Manager ➔ Request `/operations` vs `/management` | `/operations` & `/sales` rendered; `/management` blocked | **`PASS`** |
| **E. System Admin Route Access** | Log in as Admin ➔ Request any workspace | `/sales`, `/operations`, `/management` rendered cleanly | **`PASS`** |
| **F. Client LocalStorage Tamper Test** | Edit `localStorage` state to `admin` as Sales Rep | Server middleware rejects request based on verified JWT cookie | **`PASS`** |
| **G. Session Expiration & Logout** | Click Logout or wait for token expiry | `POST /api/auth/logout` deletes cookie, server redirects to `/login` | **`PASS`** |
| **H. Business Logic Regression** | Create order, manage inventory, view BI charts | 100% of existing workspace functionality preserved | **`PASS`** |

---

## 5. Development Account Setup Instructions

Development test accounts are configured via environment variables and Supabase DB user profiles.

To configure test accounts in development:
1. Ensure `.env` is initialized from `.env.example`.
2. Supabase Auth seeds users in `auth.users` with linked profiles in `public.user_profiles`.
3. Development test logins:
   - **Admin**: `admin@nalkametals.com`
   - **Operations Manager**: `stock@nalkametals.com`
   - **Sales Representative**: `sales@nalkametals.com`
