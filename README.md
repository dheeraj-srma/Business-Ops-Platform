# Business Ops Platform

Consolidated enterprise operations platform integrating three business applications into a single unified application repository, single deployment, single login, and role-based workspaces.

---

## 1. Executive Summary & Architecture

The **Business Ops Platform** unifies three core business applications into a single repository:

```
                      BUSINESS OPS PLATFORM
                                │
               ┌────────────────┴────────────────┐
               │                                 │
         Single Login                     Application Shell
         (Supabase Auth)                  (Next.js 16 Host)
               │                                 │
               └────────────────┬────────────────┘
                                │
               ┌────────────────┼────────────────┐
               │                │                │
            Sales          Operations        Management
          Workspace        Workspace         Workspace
          (Order App)     (Stock App)        (BI App)
```

### Workspaces & Preserved Modules

1. **Sales Workspace (`/sales`)**:
   - **Original Product**: Order / Sales Application.
   - **Capabilities**: Sales rep portal, customer/dealer selection, catalog search, order creation & submission, PDF generation, CSV import/export, and offline order queueing.
2. **Operations Workspace (`/operations`)**:
   - **Original Product**: Stock & Operations Management Application.
   - **Capabilities**: Inventory balances, pending order approval lifecycle, restock planner, stock movement modals (In, Out, Adjustments, Returns), and Tally ERP XML/JSON sync engine.
3. **Management Workspace (`/management`)**:
   - **Original Product**: BI & Analytics Application.
   - **Capabilities**: Executive BI insights dashboards, geographic GIS heatmaps, financial valuation, demand forecasting, stock reconciliation, and report exports.

---

## 2. Directory Structure

```
business-ops-platform/
│
├── app/                        # Unified Next.js 16 App Router Shell
│   ├── page.tsx                # Platform Landing & Workspace Switcher
│   ├── login/                  # Unified Single Login Page
│   ├── sales/                  # Sales Workspace Page Route (Order App)
│   ├── operations/             # Operations Workspace Page Route (Stock App)
│   ├── management/             # Management Workspace Page Route (BI App)
│   ├── globals.css             # Unified Global Styles & Tailwind CSS v4
│   └── layout.tsx              # Root Layout & Platform Navigation Bar
│
├── workspaces/                 # Preserved Workspace Codebases
│   ├── sales/                  # Isolated Order App source code & assets
│   ├── operations/             # Isolated Stock Management App source code & assets
│   └── management/             # Isolated BI App pages, components & assets
│
├── backend/                    # Python FastAPI Backend (Orders, Inventory, RBAC)
├── server/                     # Express Node.js Server & Tally Sync Engine
├── shared/                     # Platform Header & Unified Navigation Components
├── public/                     # Consolidated static assets (logos, icons)
├── package.json                # Root dependency configuration
├── next.config.ts              # Next.js configuration & API proxy rewrites
└── README.md                   # System Architecture & Documentation
```

---

## 3. Quick Start & Development Setup

### Prerequisites
- **Node.js**: v18.0.0+ or v20.0.0+
- **npm**: v9.0.0+
- **Python**: v3.10+ (for FastAPI backend)

### Step 1: Environment Setup
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Default configuration connects to the shared Supabase instance:
```env
NEXT_PUBLIC_SUPABASE_URL=https://deqrfmjzoxlirgfhuouh.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_bvWbNpkJMLzR0NOgQTOFQQ_C-G9N-2P
SUPABASE_URL=https://deqrfmjzoxlirgfhuouh.supabase.co
SUPABASE_ANON_KEY=sb_publishable_bvWbNpkJMLzR0NOgQTOFQQ_C-G9N-2P
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Run Development Servers

**Run Frontend Application (Port 3000)**:
```bash
npm run dev
```

**Run Python FastAPI Backend (Port 8000)**:
```bash
npm run dev:backend
```

**Run Express Tally Server (Port 3000 API/Bridge)**:
```bash
npm run dev:tally
```

---

## 4. Production Build Verification

Build the production application bundle:
```bash
npm run build
```

Start the production server:
```bash
npm run start
```

---

## 5. Security & Authentication Model

- **Authentication Boundary**: Authentication is enforced at the backend via Supabase Auth and FastAPI JWT verification.
- **Frontend Role Checks**: Used exclusively for UX and workspace navigation (`/sales`, `/operations`, `/management`).
- **Data Protection**: Zero secrets or private service-role keys are committed in source code.

---

## 6. Business Logic & Integration Principles

- **Preservation First**: Zero functionality, UI styling, charts, forms, or database interactions from the original applications were destroyed or rewritten.
- **Tally ERP Subsystem**: The Tally XML/JSON synchronization engine, mappers, parsers, and dead-letter queue semantics in `server/tally` are fully preserved.
