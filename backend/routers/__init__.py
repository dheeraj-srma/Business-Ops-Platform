# backend/routers/__init__.py
"""FastAPI APIRouters Layer."""

from . import auth_router
from . import product_router
from . import inventory_router
from . import order_router
from . import customer_router
from . import supplier_router
from . import dealer_router
from . import dashboard_router
from . import user_router
from . import admin_router
from . import transaction_router
from . import analytics_router
from . import webhook_router
from . import tally_router
from . import salesman_router
from . import geography_router

__all__ = [
    "auth_router",
    "product_router",
    "inventory_router",
    "order_router",
    "customer_router",
    "supplier_router",
    "dealer_router",
    "dashboard_router",
    "user_router",
    "admin_router",
    "transaction_router",
    "analytics_router",
    "webhook_router",
    "tally_router",
    "salesman_router",
    "geography_router",
]
