# Business Ops Platform — Analytics & BI Read Model Specification

**Document Status**: Authoritative Specification (Phase 7A)  
**Target Repository**: `business-ops-platform`  
**Phase**: Phase 7A — Management Analytics & Dashboard Read Audit / Migration Foundation  

---

## 1. Executive Summary

This document establishes the authoritative read model for Management Analytics, BI Reporting, Executive KPIs, and Geographic Intelligence across the `business-ops-platform`. All analytical calculations preserve existing legacy business logic, status filters, date semantics, and frontend expectations without altering metric definitions.

---

## 2. Discovered Analytics Domain Classification

| Domain | Queries & Endpoints | Target Components | Authoritative Sources |
|---|---|---|---|
| **Dashboard KPIs** | `GET /api/dashboard/stats`, `GET /api/analytics/summary` | `DashboardView.tsx`, `AppContext.tsx` | `pending_orders`, `products`, `inventory`, `returns`, `dealers`, `suppliers` |
| **Sales Analytics** | `GET /api/analytics/bi` (`sales_intelligence`) | `DashboardView.tsx`, `InteractiveChart.tsx` | `pending_orders`, `pending_order_items`, `products` |
| **Order Analytics** | `GET /api/orders`, `GET /api/analytics/bi` (`core_kpis`) | `PendingOrdersView.tsx`, `DashboardView.tsx` | `pending_orders` |
| **Inventory Analytics** | `GET /api/inventory`, `GET /api/analytics/products` | `InventoryView.tsx`, `RestockPlannerView.tsx` | `products`, `inventory` |
| **Customer Analytics** | `GET /api/geography/customers/{id}`, `GET /api/dealers` | `CustomerPerformanceView.tsx` | `dealers`, `pending_orders` |
| **Salesman Analytics** | `GET /api/sales/salesmen/performance`, `/summary` | `SalesmanPerformanceView.tsx` | `user_profiles`, `pending_orders` |
| **Returns Analytics** | `GET /api/returns`, `GET /api/analytics/bi` (`returns_intelligence`) | `QualityReturnsView.tsx` | `returns`, `pending_orders` |
| **Geo Analytics** | `GET /api/geography/summary`, `/states/{state}`, `/cities/{city}` | `IndiaMapChart.tsx` | `dealers`, `pending_orders` |

---

## 3. Authoritative Metric Formulas & Semantics

### A. Sales & Revenue
- **Total Revenue**: $\sum \text{total\_amount}$ for orders with status $\in \{\text{'Approved'}, \text{'Confirmed'}, \text{'Dispatched'}, \text{'Delivered'}, \text{'Fulfilled'}\}$.
- **Exclusions**: Orders with status $\in \{\text{'Cancelled'}, \text{'Rejected'}\}$ are strictly EXCLUDED from revenue totals.
- **Date Semantics**: Filtered by order creation date (`created_at`).

### B. Order Performance
- **Approved Orders Count**: Count of orders with status $\in \{\text{'Approved'}, \text{'Confirmed'}, \text{'Dispatched'}, \text{'Delivered'}\}$.
- **Pending Orders Count**: Count of orders with status $\in \{\text{'Pending'}, \text{'Pending\_Approval'}\}$.
- **Average Order Value (AOV)**:
  $$\text{AOV} = \frac{\text{Total Revenue}}{\text{Approved Orders Count}}$$

### C. Inventory Health & Valuation
- **Inventory Valuation**: $\sum (\text{Current Stock} \times \text{Price})$.
- **Stock Classifications**:
  - Healthy: $\text{Current Stock} > 15$
  - Low Stock: $5 < \text{Current Stock} \le 15$
  - Critical Stock: $0 < \text{Current Stock} \le 5$
  - Out of Stock: $\text{Current Stock} = 0$
  - Negative Stock: $\text{Current Stock} < 0$
- **Inventory Health Score**:
  $$\text{Health Score} = \frac{\text{Healthy SKUs}}{\text{Total SKUs}} \times 100\%$$

### D. Returns & Quality Metrics
- **Return Rate %**:
  $$\text{Return Rate} = \frac{\text{Total Returns Count}}{\text{Total Orders Count}} \times 100\%$$

---

## 4. Centralized API Read Boundaries

1. `GET /api/dashboard/stats`: Returns aggregated executive stats (`core_kpis`, `executive_summary`, `inventory_intelligence`).
2. `GET /api/analytics/bi`: Returns full BI dataset (`core_kpis`, `sales_intelligence`, `inventory_intelligence`, `returns_intelligence`, `procurement_intelligence`, `ai_insights`).
3. `GET /api/analytics/summary`: Executive high-level counts.
4. `GET /api/analytics/products`: Paginated product inventory health and velocity analytics.
5. `GET /api/sales/salesmen/performance`: Salesman rankings, revenue, order count, and assigned customers.
6. `GET /api/geography/summary`: State/city heatmap aggregated revenue and active dealer density.

---

## 5. Shared Client Integration (`shared/api/`)

Management workspace components access these centralized analytics endpoints via `shared/api/client.ts` and `shared/api/orders.ts` / dedicated helpers, maintaining strict TypeScript response schemas and zero UI changes.
