# Business Ops Platform — Order Workflow Specification

**Document Status**: Authoritative Specification (Phase 6B)  
**Target Repository**: `business-ops-platform`  
**Phase**: Phase 6B — Order Workflow Mutations / Editing / Cancellation Migration  

---

## 1. Discovered Order State Machine

The order lifecycle adheres to the following explicit state machine and mutation rules:

```
[PENDING / PENDING_APPROVAL] ──┬──► EDIT ORDER (Grace Window / Admin)
                              ├──► CANCEL ORDER (Grace Window / Admin)
                              ├──► REJECT ORDER (Manager / Admin)
                              └──► FULFILL / DISPATCH (Manager)

[APPROVED / CONFIRMED]      ──┬──► EDIT ORDER (Admin / Manager)
                              ├──► REJECT ORDER (Manager / Admin)
                              └──► FULFILL / DISPATCH (Manager)

[REJECTED / CANCELLED]       ───► REOPEN ORDER / ROLLBACK (Manager) ──► [PENDING]

[DISPATCHED / COMPLETED]     ───► LOCKED (Physical Stock Out Executed)
```

---

## 2. Mutation Eligibility Matrix

| Order Status | Edit Allowed? | Cancel Allowed? | Reject Allowed? | Reopen Allowed? | Fulfill Allowed? |
|---|---|---|---|---|---|
| **Pending** | YES (Grace window or Admin) | YES (Grace window or Admin) | YES (Manager) | NO | YES |
| **Approved / Confirmed** | YES (Manager/Admin) | YES (Manager/Admin) | YES (Manager) | NO | YES |
| **Dispatched / Processed** | NO | NO | NO | NO | NO (Already processed) |
| **Rejected** | NO | NO | NO | YES (Manager) | NO |
| **Cancelled** | NO | NO | NO | YES (Manager) | NO |

---

## 3. Authoritative Reservation & Stock Inventory Impact

The platform enforces the inventory invariant:

$$\text{Physical Stock} = N, \quad \text{Reserved Stock} = R, \quad \text{Available Stock} = N - R$$

### A. Order Edit ($\Delta Q = Q_{\text{new}} - Q_{\text{old}}$)
- **$\Delta Q > 0$**: Reservation increases by $\Delta Q$. Backend validates that $N - R \ge \Delta Q$ (unless system setting `allow_negative_orders` is enabled).
- **$\Delta Q < 0$**: Reservation decreases by $|\Delta Q|$, increasing available stock by $|\Delta Q|$.
- Physical stock $N$ is NOT modified during edits.

### B. Order Cancellation / Rejection ($Q_{\text{lines}}$)
- Outstanding line reservations are released: $R_{\text{new}} = \max(0, R - Q_{\text{lines}})$.
- Available stock increases: $A_{\text{new}} = N - R_{\text{new}}$.
- Physical stock $N$ remains unchanged.
- Order header status updated to `'Cancelled'` or `'Rejected'`.

### C. Order Reopen / Rollback Rejection
- Line reservations are re-established ($R_{\text{new}} = R + Q_{\text{lines}}$).
- Available stock checked against negative-stock setting policy.
- Order header status transitions back to `'Pending'`.

---

## 4. Deterministic Lock Ordering & Concurrency Protection

To prevent multi-product deadlock conditions during concurrent workflow mutations:
1. Target order header is locked first via PostgreSQL `SELECT * FROM pending_orders WHERE order_id = ... FOR UPDATE`.
2. All affected line item SKUs / product IDs are extracted and sorted deterministically (`ORDER BY sku`).
3. Row-level locks are acquired in sorted sequence: `SELECT * FROM inventory WHERE product_id IN (...) FOR UPDATE`.
4. Updates to order header, line items, reservation balances, and audit records execute within a single atomic PostgreSQL transaction.

---

## 5. Security & Permission Controls

- `orders.edit`: Permission required for order editing (or salesman owner within 15-minute grace window).
- `orders.cancel`: Permission required for order cancellation (or salesman owner within 15-minute grace window).
- `orders.reject`: Permission required for manager rejection.
- `orders.manage`: Permission required for reopening/rolling back rejected orders.
