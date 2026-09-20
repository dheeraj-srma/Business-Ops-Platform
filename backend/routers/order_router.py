# backend/routers/order_router.py
import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from schemas.orders import (
    OrderCreateSchema,
    BulkOrderCreateSchema,
    OrderReservationRequest,
    OrderReservationResponse,
    OrderProcessRequest,
    OrderProcessResponse
)
from schemas.order_schemas import (
    OrderSummarySchema,
    OrderDetailSchema,
    OrderListResponseSchema
)
from schemas.order_workflow_schemas import (
    OrderEditRequest,
    OrderEditResponse,
    OrderCancelRequest,
    OrderCancelResponse,
    OrderRejectRequest,
    OrderRejectResponse,
    OrderReopenRequest,
    OrderReopenResponse
)
from services.order_service import OrderService
from services.order_read_service import OrderReadService
from auth import require_role, require_permission

logger = logging.getLogger("order_router")
router = APIRouter(prefix="/api/orders", tags=["Orders"])

@router.post(
    "/reserve",
    response_model=OrderReservationResponse,
    summary="Reserve order items and create order header",
    description="Atomically validates stock availability, reserves line items, and creates order header inside a single PostgreSQL transaction."
)
def reserve_order(
    payload: OrderReservationRequest,
    current_user: dict = Depends(require_permission("orders.create"))
):
    try:
        res = OrderService.reserve_order(payload, current_user)
        return OrderReservationResponse(
            status=res["status"],
            order_id=res["order_id"],
            client_reference=res.get("client_reference"),
            items_count=res["items_count"],
            total_amount=res["total_amount"],
            idempotent=res.get("idempotent", False),
            timestamp=res["timestamp"]
        )
    except ValueError as val_err:
        err_msg = str(val_err)
        if "INSUFFICIENT_STOCK" in err_msg:
            raise HTTPException(status_code=409, detail=err_msg)
        raise HTTPException(status_code=400, detail=err_msg)
    except Exception as exc:
        logger.error(f"Error executing order reservation: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.get(
    "",
    summary="List orders with pagination, search, and filtering",
    description="Returns paginated order summaries. Supports search, status, salesman, customer, date range filtering, and deterministic sorting."
)
def list_orders(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term for order ID, customer, or salesman"),
    status: Optional[str] = Query(None, description="Order status filter"),
    salesman_id: Optional[str] = Query(None, description="Salesman ID filter"),
    customer_id: Optional[str] = Query(None, description="Customer / Shop name filter"),
    date_from: Optional[str] = Query(None, description="Created at start date (ISO format)"),
    date_to: Optional[str] = Query(None, description="Created at end date (ISO format)"),
    sort_by: str = Query("created_at", description="Field to sort by (strict allowlist)"),
    sort_dir: str = Query("desc", description="Sort direction (asc, desc)"),
    current_user: dict = Depends(require_permission("orders.view"))
):
    try:
        return OrderReadService.list_orders(
            current_user=current_user,
            page=page,
            page_size=page_size,
            search=search,
            status=status,
            salesman_id=salesman_id,
            customer_id=customer_id,
            date_from=date_from,
            date_to=date_to,
            sort_by=sort_by,
            sort_dir=sort_dir
        )
    except Exception as exc:
        logger.error(f"Error listing orders: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/pending")
def pending_orders():
    try:
        return OrderService.pending_orders()
    except Exception as exc:
        logger.error(f"Error listing pending orders: {exc}")
        return []

@router.get(
    "/{order_id}",
    response_model=OrderDetailSchema,
    summary="Get order detail by ID",
    description="Returns detailed order header and line items with salesman visibility checks."
)
def get_order_by_id(
    order_id: str,
    current_user: dict = Depends(require_permission("orders.view"))
):
    try:
        return OrderReadService.get_order_by_id(order_id, current_user)
    except ValueError as val_err:
        raise HTTPException(status_code=404, detail=str(val_err))
    except PermissionError as perm_err:
        raise HTTPException(status_code=403, detail=str(perm_err))
    except Exception as exc:
        logger.error(f"Error retrieving order '{order_id}': {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.post(
    "/{order_id}/update",
    response_model=OrderEditResponse,
    summary="Edit order line items and quantities",
    description="Atomically updates order header and line items while recalculating reservation deltas. Validates stock availability for quantity increases."
)
def update_order(
    order_id: str,
    payload: OrderEditRequest,
    current_user: dict = Depends(require_permission("orders.view"))
):
    try:
        res = OrderService.update_order(order_id, payload, current_user)
        return OrderEditResponse(**res)
    except PermissionError as perm_err:
        raise HTTPException(status_code=403, detail=str(perm_err))
    except ValueError as val_err:
        err_msg = str(val_err)
        if "INSUFFICIENT_STOCK" in err_msg or "RESERVATION_MISMATCH" in err_msg:
            raise HTTPException(status_code=409, detail=err_msg)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=404, detail=err_msg)
        raise HTTPException(status_code=400, detail=err_msg)
    except Exception as exc:
        logger.error(f"Error updating order '{order_id}': {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.post(
    "/{order_id}/cancel",
    response_model=OrderCancelResponse,
    summary="Cancel order and release reservations",
    description="Transitions order status to Cancelled and releases active stock reservations back to available stock."
)
def cancel_order(
    order_id: str,
    payload: Optional[OrderCancelRequest] = None,
    current_user: dict = Depends(require_permission("orders.view"))
):
    try:
        res = OrderService.cancel_order(order_id, payload, current_user)
        return OrderCancelResponse(**res)
    except PermissionError as perm_err:
        raise HTTPException(status_code=403, detail=str(perm_err))
    except ValueError as val_err:
        err_msg = str(val_err)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=404, detail=err_msg)
        raise HTTPException(status_code=400, detail=err_msg)
    except Exception as exc:
        logger.error(f"Error cancelling order '{order_id}': {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.post(
    "/{order_id}/reject",
    response_model=OrderRejectResponse,
    summary="Reject order and release reservations",
    description="Transitions order status to Rejected and releases active line reservations."
)
def reject_order(
    order_id: str,
    payload: Optional[OrderRejectRequest] = None,
    current_user: dict = Depends(require_permission("orders.reject"))
):
    try:
        res = OrderService.reject_order_workflow(order_id, payload, current_user)
        return OrderRejectResponse(**res)
    except ValueError as val_err:
        err_msg = str(val_err)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=404, detail=err_msg)
        raise HTTPException(status_code=400, detail=err_msg)
    except Exception as exc:
        logger.error(f"Error rejecting order '{order_id}': {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.post(
    "/{order_id}/reopen",
    response_model=OrderReopenResponse,
    summary="Reopen rejected/cancelled order back to Pending queue",
    description="Transitions a Rejected or Cancelled order back to Pending queue and re-establishes stock reservations."
)
def reopen_order(
    order_id: str,
    payload: Optional[OrderReopenRequest] = None,
    current_user: dict = Depends(require_permission("orders.reject"))
):
    try:
        res = OrderService.reopen_order(order_id, payload, current_user)
        return OrderReopenResponse(**res)
    except ValueError as val_err:
        err_msg = str(val_err)
        if "INSUFFICIENT_STOCK" in err_msg:
            raise HTTPException(status_code=409, detail=err_msg)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=404, detail=err_msg)
        raise HTTPException(status_code=400, detail=err_msg)
    except Exception as exc:
        logger.error(f"Error reopening order '{order_id}': {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("")
def create_order(
    order: OrderCreateSchema,
    current_user: dict = Depends(require_role(["admin", "order_manager", "salesman"]))
):
    try:
        return OrderService.create_single_order(order, current_user)
    except Exception as exc:
        logger.error(f"Error creating order: {exc}")
        raise HTTPException(status_code=400, detail=str(exc))

@router.post("/bulk")
def create_bulk_order(
    payload: BulkOrderCreateSchema,
    current_user: dict = Depends(require_role(["admin", "order_manager", "salesman"]))
):
    try:
        return OrderService.create_bulk_order(payload, current_user)
    except Exception as exc:
        logger.error(f"Error creating bulk order: {exc}")
        raise HTTPException(status_code=400, detail=str(exc))

@router.patch("/{order_id}/approve")
def approve_order(
    order_id: str,
    current_user: dict = Depends(require_role(["admin", "order_manager", "stock_manager"]))
):
    try:
        return OrderService.approve_order(order_id)
    except Exception as exc:
        logger.error(f"Error approving order: {exc}")
        raise HTTPException(status_code=400, detail=str(exc))

@router.post(
    "/{order_id}/process",
    response_model=OrderProcessResponse,
    summary="Process order fulfillment and execute stock-out",
    description="Atomically validates stock availability, deducts physical stock, releases reservation, and transitions order status to Dispatched."
)
def process_order(
    order_id: str,
    payload: Optional[OrderProcessRequest] = None,
    current_user: dict = Depends(require_permission("orders.process"))
):
    try:
        res = OrderService.process_order(order_id, payload, current_user)
        return OrderProcessResponse(
            status=res["status"],
            order_id=res["order_id"],
            previous_status=res["previous_status"],
            new_status=res["new_status"],
            items_processed=res["items_processed"],
            stock_transactions=res.get("stock_transactions", []),
            idempotent=res.get("idempotent", False),
            timestamp=res["timestamp"]
        )
    except ValueError as val_err:
        err_msg = str(val_err)
        if "INSUFFICIENT_PHYSICAL_STOCK" in err_msg or "Cannot process" in err_msg:
            raise HTTPException(status_code=409, detail=err_msg)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=404, detail=err_msg)
        raise HTTPException(status_code=400, detail=err_msg)
    except Exception as exc:
        logger.error(f"Error processing order {order_id}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.patch("/{order_id}/dispatch", response_model=OrderProcessResponse)
def dispatch_order(
    order_id: str,
    current_user: dict = Depends(require_permission("orders.process"))
):
    try:
        res = OrderService.process_order(order_id, current_user=current_user)
        return OrderProcessResponse(
            status=res["status"],
            order_id=res["order_id"],
            previous_status=res["previous_status"],
            new_status=res["new_status"],
            items_processed=res["items_processed"],
            stock_transactions=res.get("stock_transactions", []),
            idempotent=res.get("idempotent", False),
            timestamp=res["timestamp"]
        )
    except ValueError as val_err:
        err_msg = str(val_err)
        if "INSUFFICIENT_PHYSICAL_STOCK" in err_msg or "Cannot process" in err_msg:
            raise HTTPException(status_code=409, detail=err_msg)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=404, detail=err_msg)
        raise HTTPException(status_code=400, detail=err_msg)
    except Exception as exc:
        logger.error(f"Error dispatching order: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

@router.patch("/{order_id}/status")
def transition_order_status(
    order_id: str,
    payload: dict,
    current_user: dict = Depends(require_role(["admin", "order_manager", "stock_manager", "salesman"]))
):
    target_status = payload.get("target_status")
    reason = payload.get("reason")
    if not target_status:
        raise HTTPException(status_code=400, detail="Missing required field 'target_status'")
    try:
        return OrderService.transition_order_status(order_id, target_status, actor=current_user, reason=reason)
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as exc:
        logger.error(f"Error transitioning status for order {order_id}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
