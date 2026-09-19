# backend/services/analytics_service.py
import logging
from typing import Dict, Any, List, Optional
from repositories.inventory_repo import InventoryRepository
from repositories.order_repo import OrderRepository
from repositories.transaction_repo import TransactionRepository
from repositories.dealer_repo import DealerRepository
from repositories.supplier_repo import SupplierRepository

logger = logging.getLogger("analytics_service")

class AnalyticsService:

    @staticmethod
    def get_executive_summary() -> Dict[str, Any]:
        inv = InventoryRepository.fetch_all_products_with_inventory()
        total_products = len(inv)
        total_units = sum(item.get("Current Stock", 0) for item in inv)
        total_stock_val = sum(item.get("Current Stock", 0) * item.get("Price", 0) for item in inv)
        
        low_stock = sum(1 for item in inv if 5 < item.get("Current Stock", 0) <= 15)
        critical_stock = sum(1 for item in inv if 0 < item.get("Current Stock", 0) <= 5)
        out_of_stock = sum(1 for item in inv if item.get("Current Stock", 0) == 0)
        negative_stock = sum(1 for item in inv if item.get("Current Stock", 0) < 0)
        healthy = sum(1 for item in inv if item.get("Current Stock", 0) > 15)

        orders = OrderRepository.get_orders(limit=1000)
        returns = TransactionRepository.get_returns(limit=500)

        dealer_count = DealerRepository.count_dealers()
        supplier_count = SupplierRepository.count_suppliers()

        pending_orders_count = sum(1 for o in orders if str(o.get("status", "")).lower() in ("pending", "pending_approval"))

        return {
            "total_products": total_products,
            "total_units": int(total_units),
            "total_stock_value": round(total_stock_val, 2),
            "healthy_count": healthy,
            "low_stock_items": low_stock,
            "critical_stock_items": critical_stock,
            "out_of_stock_items": out_of_stock,
            "negative_stock_count": negative_stock,
            "deficit_mitigation_count": low_stock + out_of_stock + negative_stock,
            "pending_orders": pending_orders_count,
            "total_orders": len(orders),
            "total_returns": len(returns),
            "total_dealers": dealer_count,
            "active_dealers": dealer_count,
            "total_suppliers": supplier_count,
            "active_suppliers": supplier_count,
        }

    @staticmethod
    def get_bi_analytics() -> Dict[str, Any]:
        inv = InventoryRepository.fetch_all_products_with_inventory()
        total_skus = len(inv)
        total_units = sum(item.get("Current Stock", 0) for item in inv)
        inv_value = sum(item.get("Current Stock", 0) * item.get("Price", 0) for item in inv)
        
        out_of_stock = sum(1 for item in inv if item.get("Current Stock", 0) <= 0)
        low_stock = sum(1 for item in inv if 0 < item.get("Current Stock", 0) < 10)
        healthy = max(0, total_skus - low_stock - out_of_stock)

        health_score = round(max(0, min(100, ((healthy / total_skus) * 100) if total_skus > 0 else 100.0)), 1)

        orders = OrderRepository.get_orders(limit=1000)
        returns = TransactionRepository.get_returns(limit=500)
        dealer_count = DealerRepository.count_dealers()
        supplier_count = SupplierRepository.count_suppliers()

        approved_orders = [o for o in orders if str(o.get("status", "")).lower() in ("approved", "dispatched", "delivered")]
        pending_orders = [o for o in orders if str(o.get("status", "")).lower() in ("pending", "pending_approval")]

        total_revenue = sum(float(o.get("total_amount") or 0.0) for o in approved_orders)
        aov = round(total_revenue / len(approved_orders), 2) if approved_orders else 0.0

        return {
            "core_kpis": {
                "total_revenue": round(total_revenue, 2),
                "inventory_value": round(inv_value, 2),
                "total_units": int(total_units),
                "total_orders": len(orders),
                "approved_orders": len(approved_orders),
                "pending_orders": len(pending_orders),
                "average_order_value": aov,
                "aov": aov,
                "inventory_health_score": health_score,
                "active_dealers": dealer_count,
                "active_suppliers": supplier_count,
                "return_rate_pct": round((len(returns) / len(orders) * 100), 2) if orders else 0.0,
            },
            "inventory_intelligence": {
                "total_skus": total_skus,
                "total_units": int(total_units),
                "healthy_count": healthy,
                "low_stock": low_stock,
                "out_of_stock": out_of_stock,
            }
        }

    @staticmethod
    def get_paginated_product_analytics(page: int = 1, page_size: int = 10, search: Optional[str] = None) -> Dict[str, Any]:
        inv = InventoryRepository.fetch_all_products_with_inventory()
        if search:
            search_clean = search.strip().lower()
            inv = [
                item for item in inv
                if search_clean in item.get("sku", "").lower() or search_clean in item.get("name", "").lower()
            ]

        total = len(inv)
        offset = (page - 1) * page_size
        items = inv[offset:offset + page_size]

        return {
            "items": items,
            "page": page,
            "page_size": page_size,
            "total": total,
            "has_next": offset + page_size < total,
            "has_previous": page > 1,
        }

analytics_service = AnalyticsService()
