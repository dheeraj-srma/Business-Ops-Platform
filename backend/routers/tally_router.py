"""
Tally Integration APIRouter
Provides isolated endpoints for Tally contract definitions, payload ingestion,
sync event logging, and retry handling.
"""
from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from typing import Dict, Any, Optional
from auth import get_current_user, require_roles
from services.tally_service import tally_service

router = APIRouter(prefix="/api/tally", tags=["Tally Integration"])

@router.get("/contracts")
def get_tally_contracts():
    return tally_service.get_contract_definitions()

@router.post("/sync")
def sync_tally_payload(
    payload: Dict[str, Any],
    x_correlation_id: Optional[str] = Header(None),
    user: Dict[str, Any] = Depends(require_roles(["tally_operator", "admin", "stock_manager"]))
):
    try:
        return tally_service.process_tally_payload(payload, correlation_id=x_correlation_id)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Tally sync error: {str(e)}")

@router.get("/logs")
def get_tally_logs(
    limit: int = 50,
    user: Dict[str, Any] = Depends(require_roles(["tally_operator", "admin", "stock_manager"]))
):
    return tally_service.list_sync_logs(limit=limit)

@router.post("/retry/{event_id}")
def retry_tally_event(
    event_id: str,
    user: Dict[str, Any] = Depends(require_roles(["admin", "tally_operator"]))
):
    try:
        return tally_service.retry_sync_event(event_id)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
