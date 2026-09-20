# Business Ops Platform — Order Read Model Specification

**Document Status**: Authoritative Specification (Phase 6A)  
**Target Repository**: `business-ops-platform`  
**Phase**: Phase 6A — Orders Read & History Migration  

---

## 1. Data Schema & Source of Truth

The authoritative order domain model consists of two relational tables in PostgreSQL / Supabase:

### A. Order Header Table (`public.pending_orders`)
*(Compatibility view: `public.orders`)*

| Column | Type | Description |
|---|---|---|
| `order_id` | `TEXT` (PK) | Server/client authoritative unique order identifier (e.g. `ORD-20260920-ABC123`). |
| `salesman_id` | `TEXT` | Unique identifier of the creating sales representative. |
| `salesman_name` | `TEXT` | Historical snapshot of the salesman's full name at order placement. |
| `shop_name` | `TEXT` | Historical snapshot of the customer / dealer store name. |
| `location_id` | `TEXT` | Optional location or warehouse code. |
| `city` | `TEXT` | Customer city location. |
| `state` | `TEXT` | Customer state location. |
| `item_count` | `NUMERIC` | Aggregate count of distinct line items in the order. |
| `total_amount` | `NUMERIC` | Aggregate historical grand total currency amount. |
| `status` | `TEXT` | Current lifecycle state (default: `'Pending'`). |
| `notes` | `TEXT` | Optional order notes or special customer instructions. |
| `created_by` | `UUID` | References `auth.users(id)` for user identity linking. |
| `created_at` | `TIMESTAMPTZ` | Timestamp when the order was created. |
| `updated_at` | `TIMESTAMPTZ` | Timestamp when order header state was last modified. |

### B. Order Line Items Table (`public.pending_order_items`)
*(Compatibility view: `public.order_items`)*

| Column | Type | Description |
|---|---|---|
| `id` | `BIGSERIAL` / `UUID` (PK) | Unique line item record identifier. |
| `order_id` | `TEXT` (FK) | Foreign key referencing `pending_orders.order_id`. |
| `sku` | `TEXT` | Product Stock Keeping Unit identifier. |
| `item_name` | `TEXT` | Historical snapshot of product description at time of sale. |
| `category` | `TEXT` | Product category grouping. |
| `quantity` | `NUMERIC` | Quantity of items ordered. |
| `price` | `NUMERIC` | Historical unit selling price at time of sale. |
| `total_price` | `NUMERIC` | Line total (`quantity * price`). |
| `created_at` | `TIMESTAMPTZ` | Line item creation timestamp. |

---

## 2. Order Lifecycle State Machine

Order processing adheres to the following explicit status state machine:

```
[DRAFT]
   │
   ▼
[PENDING / PENDING_APPROVAL] ──► [REJECTED]
   │
   ▼
[APPROVED] / [PROCESSING]    ──► [CANCELLED]
   │
   ▼
[DISPATCHED]
   │
   ▼
[DELIVERED] / [COMPLETED]
```

---

## 3. Historical Price & Data Snapshot Rules

1. **Unit Price Preservation**: `price` and `total_price` on `pending_order_items` reflect the agreed selling price at the moment of order placement. Read queries MUST NOT recalculate order line totals using current product catalog prices.
2. **Customer & Salesman Snapshots**: `shop_name` and `salesman_name` on `pending_orders` preserve the customer/salesman names as captured when the order was submitted.

---

## 4. API Endpoints (Phase 6A)

- `GET /api/orders`: Returns paginated, searchable, status-filtered order summaries.
- `GET /api/orders/{id}`: Returns complete order details including line items.

---

## 5. Security & Visibility Model

- **Sales Representative Visibility**: Users with the `salesman` role without global view permissions (`orders.view_all`) can ONLY query orders where `salesman_id` or `created_by` matches their own identity.
- **Admin / Manager Visibility**: Users with `admin`, `order_manager`, `stock_manager`, or `orders.view_all` permissions can view all orders platform-wide.
