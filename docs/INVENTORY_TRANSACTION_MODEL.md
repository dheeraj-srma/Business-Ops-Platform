# Business Ops Platform — Inventory Transaction Model & Phase 5C Design

**Document Status**: Proposed Architecture Blueprint (Phase 5C Design Specifications)  
**Target Repository**: `business-ops-platform`  
**Phase Target**: Phase 5C — Central Backend Inventory Writes & Mutation Layer  

---

## 1. Transaction Model Schema Design

To ensure full auditability and trace the exact answer to *"Why is current stock equal to X?"*, Phase 5C will enforce an immutable stock transaction ledger table (`stock_transactions`):

```sql
CREATE TABLE IF NOT EXISTS public.stock_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    location_id UUID REFERENCES public.locations(id),
    transaction_type VARCHAR(50) NOT NULL, -- STOCK_IN, STOCK_OUT, RESERVE, RELEASE_RESERVATION, ADJUSTMENT, RETURN_IN
    quantity NUMERIC(12, 4) NOT NULL,
    unit_cost NUMERIC(12, 2) DEFAULT 0.0,
    before_quantity NUMERIC(12, 4),
    after_quantity NUMERIC(12, 4),
    reference_type VARCHAR(50), -- order, return, tally_sync, manual_adjustment
    reference_id VARCHAR(100),  -- order_id, return_code, tally_guid
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_by_name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 2. Inventory Mutation Categories

| Mutation Category | Transaction Type | Quantity Effect | Affected Tables | Description |
|---|---|---|---|---|
| **Stock Inward** | `STOCK_IN` | $+\Delta Q$ | `inventory`, `stock_transactions` | Procurement receiving from suppliers or factory. |
| **Order Fulfillment** | `STOCK_OUT` | $-\Delta Q$ | `inventory`, `pending_orders`, `stock_transactions` | Physical dispatch of processed customer orders. |
| **Order Reservation** | `RESERVE` | $+ \text{reserved}$ | `pending_orders`, `pending_order_items` | Reserving available stock upon new order submission. |
| **Release Reservation** | `RELEASE_RESERVATION` | $- \text{reserved}$ | `pending_orders`, `pending_order_items` | Releasing reservations upon order cancellation or rejection. |
| **Manual Adjustment** | `ADJUSTMENT` | $\text{New } Q$ | `inventory`, `stock_transactions`, `system_audit_logs` | Admin stock count corrections or stock audit adjustments. |
| **Customer Return** | `RETURN_IN` | $+\Delta Q$ (if Good) | `returns`, `inventory`, `stock_transactions` | Restocking valid merchandise from customer returns. |

---

## 3. Atomic Transaction Boundaries for Phase 5C

### Order Processing Atomic Transaction Boundary (Phase 5C.7)
```sql
BEGIN TRANSACTION (PostgreSQL Isolation Level: READ COMMITTED / SERIALIZABLE)
  1. SELECT * FROM public.pending_orders WHERE id = order_id FOR UPDATE;
  2. If status IN ('PROCESSED', 'DISPATCHED', 'DELIVERED', 'COMPLETED'), return idempotent response (0 additional stock-out).
  3. Fetch order items for order_id.
  4. Collect distinct product IDs (or SKUs) and SORT THEM DETERMINISTICALLY (e.g. ORDER BY sku).
  5. Acquire row-level locks on inventory rows in sorted order:
     SELECT * FROM public.inventory WHERE sku IN (...) FOR UPDATE;
  6. For each item in order:
     - Deduct physical_stock: physical_stock = physical_stock - qty
     - Release reserved_stock: reserved_stock = max(0, reserved_stock - qty)
     - Record transaction in public.inventory_transactions (type: 'STOCK_OUT')
  7. Update order status: UPDATE public.pending_orders SET status = 'Dispatched', dispatch_date = NOW();
  8. Write system audit log entry.
COMMIT;
```

---

## 4. Phase 5C Test Scenarios Matrix

| Test ID | Test Scenario | Input / Action | Expected Result |
|---|---|---|---|
| **TC-01** | Valid Stock-In | `STOCK_IN` 50 units of product P1 | `physical_stock` increases by 50; transaction logged. |
| **TC-02** | Valid Order Processing | Process pending order of 10 units | `physical_stock` decreases by 10; order status becomes `Processed`. |
| **TC-03** | Insufficient Stock Block | Submit order of 100 units when `available_stock` = 5 | Order rejected with `INSUFFICIENT_STOCK` (if negative override disabled). |
| **TC-04** | Negative Stock Override | Submit order of 100 units when negative override enabled | Order accepted; `available_stock` becomes negative; status set to `NEGATIVE`. |
| **TC-05** | Order Cancellation | Cancel open pending order of 15 units | Reserved quantity released; `available_stock` increases by 15. |
| **TC-06** | Good Return Restock | Create return for 5 units in `Good` condition | `returns` record created; 5 units added back to `physical_stock`. |
| **TC-07** | Concurrent Order Lock | Two users simultaneously submit order for last remaining stock item | Row-level `FOR UPDATE` lock forces sequential execution; second order rejected safely. |
| **TC-08** | Idempotent Order Retry | Retry order submission with identical `order_id` | Duplicate request detected via unique constraint; idempotent response returned. |
| **TC-09** | Unauthorized Adjustment | User lacking `inventory.manage` attempts stock adjustment | HTTP 403 Forbidden returned; 0 DB changes. |
| **TC-10** | DB Failure Rollback | Database connection fails mid-transaction | Transaction rolls back completely; zero partial stock updates persist. |
