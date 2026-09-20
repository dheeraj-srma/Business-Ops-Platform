# backend/services/order_read_service.py
import math
import logging
from typing import Optional, Dict, Any, List
from repositories.order_repo import OrderRepository
from schemas.order_schemas import OrderSummarySchema, OrderDetailSchema, OrderListResponseSchema, OrderItemSchema

logger = logging.getLogger("order_read_service")

class OrderReadService:

    @staticmethod
    def list_orders(
        current_user: dict,
        page: int = 1,
        page_size: int = 50,
        search: Optional[str] = None,
        status: Optional[str] = None,
        salesman_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        sort_by: str = "created_at",
        sort_dir: str = "desc"
    ) -> OrderListResponseSchema:
        """Lists orders with server-side pagination, search, filters, and role-based salesman visibility enforcement."""
        # 1. Server-side Role / Visibility Enforcement
        user_role = str(current_user.get("role", "")).lower().strip()
        user_id = current_user.get("id") or current_user.get("sub") or current_user.get("user_id")
        user_perms = current_user.get("permissions") or []
        
        has_global_access = (
            user_role in ("admin", "order_manager", "stock_manager") or
            "orders.view_all" in user_perms or
            "admin" in user_perms
        )

        effective_salesman_id = salesman_id
        if not has_global_access and user_role == "salesman":
            # Restricted salesman can only view their own assigned orders
            effective_salesman_id = user_id

        # 2. Query Repository
        items_data, total_count = OrderRepository.get_orders_paginated(
            page=page,
            page_size=page_size,
            search=search,
            status=status,
            salesman_id=effective_salesman_id,
            customer_id=customer_id,
            date_from=date_from,
            date_to=date_to,
            sort_by=sort_by,
            sort_dir=sort_dir
        )

        # 3. Format Response Schemas preserving historical values
        summaries: List[OrderSummarySchema] = []
        for o in items_data:
            summaries.append(
                OrderSummarySchema(
                    order_id=str(o.get("order_id") or o.get("order_code") or o.get("id") or ""),
                    salesman_id=o.get("salesman_id"),
                    salesman_name=str(o.get("salesman_name") or o.get("Salesman Name") or "Sales Representative"),
                    shop_name=str(o.get("shop_name") or o.get("Shop Name") or o.get("customer_name") or "Customer Store"),
                    location_id=o.get("location_id"),
                    city=o.get("city"),
                    state=o.get("state"),
                    item_count=int(o.get("item_count") or 0),
                    total_amount=round(float(o.get("total_amount") or o.get("Total Amount") or 0.0), 2),
                    status=str(o.get("status") or o.get("Status") or "Pending"),
                    notes=o.get("notes"),
                    created_by=o.get("created_by"),
                    created_at=str(o.get("created_at") or o.get("Timestamp") or ""),
                    updated_at=o.get("updated_at")
                )
            )

        pages_count = math.ceil(total_count / page_size) if page_size > 0 else 1

        return OrderListResponseSchema(
            items=summaries,
            total=total_count,
            page=page,
            page_size=page_size,
            pages=pages_count
        )

    @staticmethod
    def get_order_by_id(order_id: str, current_user: dict) -> OrderDetailSchema:
        """Retrieves single order detail with line items and checks visibility access."""
        order_dict = OrderRepository.get_order_by_id_with_items(order_id)
        if not order_dict:
            raise ValueError(f"Order with ID '{order_id}' not found.")

        # Visibility enforcement for restricted salesman
        user_role = str(current_user.get("role", "")).lower().strip()
        user_id = current_user.get("id") or current_user.get("sub") or current_user.get("user_id")
        user_perms = current_user.get("permissions") or []

        has_global_access = (
            user_role in ("admin", "order_manager", "stock_manager") or
            "orders.view_all" in user_perms or
            "admin" in user_perms
        )

        if not has_global_access and user_role == "salesman":
            order_salesman = order_dict.get("salesman_id")
            order_creator = order_dict.get("created_by")
            user_name = current_user.get("full_name") or ""
            order_salesman_name = order_dict.get("salesman_name") or ""

            match_id = order_salesman and str(order_salesman).strip() == str(user_id).strip()
            match_creator = order_creator and str(order_creator).strip() == str(user_id).strip()
            match_name = user_name and user_name.strip().lower() in order_salesman_name.strip().lower()

            if not (match_id or match_creator or match_name):
                raise PermissionError(f"Access denied: Salesman is not authorized to view order '{order_id}'.")

        # Format items preserving historical line totals
        items_list: List[OrderItemSchema] = []
        for it in order_dict.get("items", []):
            items_list.append(
                OrderItemSchema(
                    id=it.get("id"),
                    order_id=it.get("order_id") or order_id,
                    sku=it.get("sku"),
                    item_name=str(it.get("item_name") or "Product Item"),
                    category=it.get("category") or "General",
                    quantity=float(it.get("quantity") or 1.0),
                    price=round(float(it.get("price") or 0.0), 2),
                    total_price=round(float(it.get("total_price") or 0.0), 2),
                    created_at=it.get("created_at")
                )
            )

        return OrderDetailSchema(
            order_id=str(order_dict["order_id"]),
            salesman_id=order_dict.get("salesman_id"),
            salesman_name=str(order_dict.get("salesman_name") or "Sales Representative"),
            shop_name=str(order_dict.get("shop_name") or "Customer Store"),
            location_id=order_dict.get("location_id"),
            city=order_dict.get("city"),
            state=order_dict.get("state"),
            item_count=int(order_dict.get("item_count") or len(items_list)),
            total_amount=round(float(order_dict.get("total_amount") or 0.0), 2),
            status=str(order_dict.get("status") or "Pending"),
            notes=order_dict.get("notes"),
            created_by=order_dict.get("created_by"),
            created_at=str(order_dict.get("created_at") or ""),
            updated_at=order_dict.get("updated_at"),
            items=items_list
        )
