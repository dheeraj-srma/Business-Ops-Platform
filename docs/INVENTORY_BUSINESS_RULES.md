# Business Ops Platform — Inventory Business Rules & Operations Specification

**Phase Status**: Phase 5B Completed (Audit, Formal Specification & Transaction Model Design)  
**Target Repository**: `business-ops-platform`  
**Current Phase**: Phase 5B — Inventory Business Rules & Transaction Model  

---

## 1. Authoritative Stock Semantics & Column Resolution (Critical Precondition Audit)

Following an exhaustive codebase and database audit of legacy mutation functions (`admin_service.py`, `submit_order` RPC, `routes.ts`, and `inventory_repo.py`), the stock semantics are formally established as follows:

1. **Legacy Mutation Mechanics**:
   - **`quantity_available` Nature**: `quantity_available` is a **materialized database column** in `public.inventory` maintained directly by **application service logic** upon every stock mutation. There are NO database triggers or automatic column formulas operating silently in PostgreSQL.
   - **Stored vs. Derived**: `quantity_on_hand`, `quantity_reserved`, and `quantity_available` are all stored columns. Application services explicitly compute and set `quantity_available = quantity_on_hand - quantity_reserved` during writes.
   - **Priority Reads**: Queries read `public.inventory.quantity_available` directly. If `quantity_available` is `NULL`, the calculation $\text{quantity\_on\_hand} - \text{quantity\_reserved}$ is used as fallback.

2. **Legacy Adjustment Behavior on Columns**:
   - **`quantity_on_hand`**: Set directly to the new physical count $N$.
   - **`quantity_reserved`**: Remains unchanged ($R_{\text{existing}}$) as it reflects active pending orders.
   - **`quantity_available`**: Set to $N - R_{\text{existing}}$.

3. **Negative Stock Override Mechanics**:
   - Default Mode (`allow_negative_orders = false`): Mutations attempting to drop `quantity_available` below zero are blocked with `409 INSUFFICIENT_STOCK`.
   - Override Mode (`allow_negative_orders = true`): Permitted when enabled in `public.system_settings`, marking stock health status as `NEGATIVE`.

---

## 2. Stock Health Classification

Backend stock health classification is centrally defined as:

$$\text{status} = \begin{cases} 
\text{NEGATIVE} & \text{if } \text{physical\_stock} < 0 \\
\text{OUT\_OF\_STOCK} & \text{if } \text{physical\_stock} = 0 \\
\text{CRITICAL} & \text{if } 0 < \text{physical\_stock} \le 5 \\
\text{LOW} & \text{if } 5 < \text{physical\_stock} \le 15 \\
\text{HEALTHY} & \text{if } \text{physical\_stock} > 15 
\end{cases}$$

---

## 3. Inventory Mutation Audits

### A. Order Submission & Reservation (`submit_order`)
- **Trigger**: Salesman or Customer places an order via Sales Workspace or Offline Queue sync.
- **RPC / Function**: `public.submit_order(p_items, p_shop_name, ...)`
- **Mechanism**:
  1. Executes `SELECT * FROM public.inventory WHERE item_name = ... FOR UPDATE;` (Row-level pessimistic lock).
  2. Dynamically sums open reservations: `SELECT SUM(quantity) FROM public.pending_order_items WHERE item_name = ...`.
  3. Evaluates `v_available_stock = GREATEST(0, v_current_stock - v_reserved_stock)`.
  4. If `allow_negative_orders` system setting is `false` and requested quantity exceeds `v_available_stock`, rolls back atomically with `INSUFFICIENT_STOCK`.
  5. Inserts header into `pending_orders` (`status = 'Pending'`) and line items into `pending_order_items`.

### B. Order Processing & Fulfillment (`POST /api/orders/{id}/process` — Phase 5C.7 Centralized)
- **Trigger**: Operations Manager fulfills a reserved pending order via `POST /api/orders/{id}/process` or `POST /api/inventory/stock-out`.
- **Authorization**: Guarded by server-side permission check `@require_permission("orders.process")`.
- **Mechanism**:
  1. Validates order status is active (`Pending` or `Approved`) and locks affected inventory rows (`FOR UPDATE` sorted by SKU).
  2. Deducts item quantities from physical stock: $N_{\text{new}} = N_{\text{existing}} - Q_{\text{order}}$.
  3. Transitions order status to `Dispatched`, releasing reservation $Q_{\text{order}}$: $R_{\text{new}} = R_{\text{existing}} - Q_{\text{order}}$.
  4. Recalculates available stock: $A_{\text{new}} = N_{\text{new}} - R_{\text{new}} = (N - Q) - (R - Q) = N - R$ (consistent with pre-fulfillment available level).
  5. Logs stock-out transaction in `inventory_transactions` (`transaction_type = 'STOCK_OUT'`).

### C. Manual Stock Adjustment & Admin Re-Stock
- **Trigger**: Operations Admin manually adjusts stock via `/api/admin/inventory/adjust` or `/api/inventory/reconcile/fix`.
- **Mechanism**:
  1. Reads existing `quantity_on_hand` and `quantity_reserved`.
  2. Updates `quantity_on_hand` to `new_quantity` and `quantity_available` to `new_quantity - quantity_reserved`.
  3. Writes audit log event to `system_audit_logs`.

### D. Returns & Restocking (`POST /api/returns` — Phase 5C.6 Centralized)
- **Trigger**: Customer return processed via central FastAPI backend (`POST /api/returns`).
- **Authorization**: Guarded by server-side permission check `@require_permission("returns.manage")`.
- **Mechanism**:
  1. Validates caller authorization and checks idempotency via `client_reference` / `return_code`.
  2. Acquires row lock (`FOR UPDATE`) on `public.inventory` by product ID / SKU.
  3. If condition is `Good Return` / `Restocked`:
     - Physical stock incremented: $N_{\text{new}} = N_{\text{existing}} + Q_{\text{returned}}$.
     - Available stock recalculated: $A_{\text{new}} = N_{\text{new}} - R_{\text{existing}}$.
     - Reserved stock ($R_{\text{existing}}$) remains unchanged.
     - Positive movement logged in `stock_transactions` (`transaction_type = 'RETURN_IN'`).
  4. If condition is `Damaged Return` / `Defective`:
     - Physical stock and available stock remain unchanged ($0$ stock addition).
  5. Inserts immutable return voucher record in `public.returns` (`return_code = 'RET-XXXXXX'`).

### E. Tally ERP Synchronization (`tally_service.py` / Node port 9000)
- **Trigger**: Background batch sync or webhook event from Tally ERP 9 / Prime.
- **Mechanism**:
  1. Parses Tally XML Vouchers for Inventory Stock-In or Stock-Out.
  2. Matches master items by SKU or Tally Item Name.
  3. Inserts transaction record into `stock_transactions` (`transaction_type = 'STOCK_IN'` / `'STOCK_OUT'`).

---

## 4. Reservation Model & Lifecycle (Phase 5C.5 Formalization)

```mermaid
stateDiagram-v2
    [*] --> Pending: Order Created (submit_order / POST /api/orders/reserve)
    Pending --> Processed: Warehouse Fulfillment (stock_out)
    Pending --> Cancelled: Order Cancelled (release reservation)
    Pending --> Rejected: Rejected due to Credit/Stock
    Processed --> SyncedTally: Exported to Tally ERP
    Cancelled --> [*]
    Rejected --> [*]
    SyncedTally --> [*]
```

1. **Reservation Eligibility Statuses**:
   - Stock is reserved when linked orders are in any of: `{"pending", "processing", "reserved", "approved"}`.
   - Statuses releasing reservations: `{"cancelled", "rejected", "delivered"}`.

2. **Deterministic Deadlock Prevention Lock Order**:
   - Multi-item order reservations must sort line items by `sku` alphabetically before acquiring row locks (`SELECT FOR UPDATE`), guaranteeing zero database deadlocks across concurrent multi-product orders.

3. **Atomic Multi-Product Order Boundary**:
   - Every multi-item order placement executes inside a single, indivisible PostgreSQL transaction. If any single line item exceeds available stock (with negative override disabled), the entire order (header + all line items) is rolled back. No partial order reservations are created.

---

## 5. Concurrency & Idempotency Rules

1. **Row-Level Database Locking**:
   - Multi-item stock operations must lock row records (`FOR UPDATE`) to prevent race conditions during concurrent order placement or inventory adjustment.
2. **Idempotency Keys**:
   - Order submission uses `order_id` deduplication (`ORD-<salesman_id>-<timestamp>`).
   - Tally voucher imports utilize `tally_guid` to prevent duplicate transaction entries upon network retries.
3. **System Overrides**:
   - System setting `allow_negative_orders` controls whether orders can be accepted when `requested_quantity > available_stock`.

---

## 6. Granular Permission Mapping

| Business Operation | Required Permission | Allowed Roles |
|---|---|---|
| View Inventory & Catalog | `inventory.view` | `admin`, `stock_manager`, `order_manager`, `salesman`, `viewer` |
| Manual Stock Adjustment | `inventory.manage` | `admin`, `stock_manager` |
| Process Order Fulfillment | `orders.process` | `admin`, `stock_manager`, `order_manager` |
| Create Return / Restock | `returns.manage` | `admin`, `stock_manager`, `order_manager` |
| Reconcile Stock Ledger | `system.manage` | `admin` |
