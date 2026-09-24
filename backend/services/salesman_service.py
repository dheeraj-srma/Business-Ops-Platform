# backend/services/salesman_service.py
import logging
from typing import List, Dict, Any, Optional
from repositories.salesman_repo import salesman_repo

logger = logging.getLogger("salesman_service")

class SalesmanService:

    @staticmethod
    def get_team_summary(start_date: Optional[str] = None, end_date: Optional[str] = None, salesman_id: Optional[str] = None) -> Dict[str, Any]:
        return salesman_repo.get_team_summary(start_date=start_date, end_date=end_date, salesman_id=salesman_id)

    @staticmethod
    def get_salesman_performance_list(
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        search: Optional[str] = None,
        status_filter: Optional[str] = None,
        sort_by: str = "sales",
        sort_order: str = "desc"
    ) -> List[Dict[str, Any]]:
        return salesman_repo.get_salesman_performance_list(
            start_date=start_date,
            end_date=end_date,
            search=search,
            status_filter=status_filter,
            sort_by=sort_by,
            sort_order=sort_order
        )

    @staticmethod
    def get_salesman_detail(salesman_id: str, start_date: Optional[str] = None, end_date: Optional[str] = None) -> Dict[str, Any]:
        return salesman_repo.get_salesman_detail(salesman_id=salesman_id, start_date=start_date, end_date=end_date)

    @staticmethod
    def get_salesman_assigned_customers(salesman_id: str) -> List[Dict[str, Any]]:
        return salesman_repo.get_salesman_assigned_customers(salesman_id=salesman_id)

    @staticmethod
    def get_order_heatmap(salesman_id: Optional[str] = None, days_count: int = 365) -> Dict[str, Any]:
        return salesman_repo.get_order_heatmap_data(salesman_id=salesman_id, days_count=days_count)

salesman_service = SalesmanService()
