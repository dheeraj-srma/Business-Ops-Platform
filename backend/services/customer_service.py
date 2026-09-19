# backend/services/customer_service.py
import logging
from typing import List, Dict, Any, Optional
from repositories.customer_repo import customer_repo
from repositories.dealer_repo import dealer_repo
from repositories.supplier_repo import supplier_repo

logger = logging.getLogger("customer_service")

class CustomerService:

    @staticmethod
    def list_customers(offset: int = 0, limit: int = 100, search: Optional[str] = None) -> List[Dict[str, Any]]:
        return customer_repo.get_all_customers(offset=offset, limit=limit, search=search)

    @staticmethod
    def list_dealers(offset: int = 0, limit: int = 100, search: Optional[str] = None) -> List[Dict[str, Any]]:
        return dealer_repo.get_all_dealers(offset=offset, limit=limit, search=search)

    @staticmethod
    def list_suppliers(offset: int = 0, limit: int = 100, search: Optional[str] = None) -> List[Dict[str, Any]]:
        return supplier_repo.get_all_suppliers(offset=offset, limit=limit, search=search)

customer_service = CustomerService()
