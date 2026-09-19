# backend/routers/order_router.py
import logging
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from schemas.orders import OrderCreateSchema, BulkOrderCreateSchema
from services.order_service import OrderService
from auth import require_role

logger = logging.getLogger("order_router")
router = APIRouter(prefix="/api/orders", tags=["Orders"])

@router.get("")
def list_orders():
    try:
        return OrderService.list_orders()
    except Exception as exc:
        logger.error(f"Error listing orders: {exc}")
        return []

@router.get("/pending")
def pending_orders():
    try:
        return OrderService.pending_orders()
    except Exception as exc:
        logger.error(f"Error listing pending orders: {exc}")
        return []

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

@router.patch("/{order_id}/reject")
def reject_order(
    order_id: str,
    current_user: dict = Depends(require_role(["admin", "order_manager", "stock_manager"]))
):
    try:
        return OrderService.reject_order(order_id)
    except Exception as exc:
        logger.error(f"Error rejecting order: {exc}")
        raise HTTPException(status_code=400, detail=str(exc))


@router.patch("/{order_id}/dispatch")
def dispatch_order(
    order_id: str,
    current_user: dict = Depends(require_role(["admin", "order_manager", "stock_manager"]))
):
    try:
        return OrderService.dispatch_order(order_id)
    except Exception as exc:
        logger.error(f"Error dispatching order: {exc}")
        raise HTTPException(status_code=400, detail=str(exc))

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

