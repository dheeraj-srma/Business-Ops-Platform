# backend/routers/data_exchange_router.py
"""
Data Exchange REST Router.
Exposes contract specifications, template downloads, multi-stage validation preview,
atomic transactional imports, contract-driven exports, Tally XML adapter endpoints,
mapping registry approvals, and audit batch logs.
"""

import logging
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status, Body

from auth import get_current_user, require_role
from services.snapshot_service import SnapshotService
from services.data_exchange_service import data_exchange_service
from services.mapping_registry import mapping_registry
from repositories.mapping_repo import mapping_repo
from adapters.tally_adapter import tally_adapter
from contracts.data_exchange_contracts import (
    list_contracts,
    get_contract,
    generate_blank_template,
    generate_sample_payload,
    generate_accountant_spec,
    CURRENT_SCHEMA_VERSION,
)
from repositories.data_exchange_repo import data_exchange_repo

logger = logging.getLogger("data_exchange_router")
router = APIRouter(prefix="/api/exchange", tags=["Data Exchange Protocol"])


@router.get("/contracts", summary="List all active data exchange contracts")
def get_contracts_list():
    return {
        "success": True,
        "current_schema_version": CURRENT_SCHEMA_VERSION,
        "contracts": list_contracts()
    }


@router.get("/contracts/{exchange_type}", summary="Get contract definition, accountant specification, and templates")
def get_contract_detail(
    exchange_type: str,
    version: str = Query(CURRENT_SCHEMA_VERSION, description="Schema version (e.g. 1.0)")
):
    try:
        contract = get_contract(exchange_type, version)
        spec = generate_accountant_spec(exchange_type, version)
        blank_template = generate_blank_template(exchange_type, version)
        sample_payload = generate_sample_payload(exchange_type, version)
        return {
            "success": True,
            "exchange_type": exchange_type,
            "schema_version": version,
            "contract": contract,
            "specification": spec,
            "accountant_spec": spec,
            "blank_template": blank_template,
            "sample_payload": sample_payload
        }
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))


@router.post("/import/preview", summary="Run multi-stage validation and reconciliation preview")
def preview_import(
    body: Dict[str, Any] = Body(...),
    exchange_type: Optional[str] = Query(None, description="Optional expected exchange type"),
    current_user: dict = Depends(require_role(["admin", "accountant", "stock_manager", "warehouse_manager"]))
):
    try:
        raw_payload = body.get("payload") if "payload" in body else body
        expected_type = exchange_type or body.get("expected_exchange_type")
        preview = data_exchange_service.preview_import_payload(
            raw_payload_or_text=raw_payload,
            expected_exchange_type=expected_type,
            operator=current_user
        )
        return preview
    except Exception as exc:
        logger.error(f"Import preview error: {exc}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/import/commit", summary="Execute atomic transactional commit with receipt")
def commit_import(
    body: Dict[str, Any] = Body(...),
    current_user: dict = Depends(require_role(["admin", "accountant"]))
):
    SnapshotService.assert_writable("data exchange commit")
    payload = body.get("payload")
    if not payload or not isinstance(payload, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request body must contain 'payload' object.")
    
    conflict_resolutions = body.get("conflict_resolutions") or {}

    try:
        result = data_exchange_service.commit_import_payload(
            payload=payload,
            conflict_resolutions=conflict_resolutions,
            operator=current_user
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(ve))
    except Exception as exc:
        logger.error(f"Import commit error: {exc}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.post("/export/generate", summary="Build, validate and generate contract-compliant export package")
def generate_export(
    body: Dict[str, Any] = Body(...),
    current_user: dict = Depends(require_role(["admin", "accountant", "stock_manager", "warehouse_manager"]))
):
    exchange_type = body.get("exchange_type", "historical_sales")
    version = body.get("schema_version", CURRENT_SCHEMA_VERSION)
    start_date = body.get("start_date")
    end_date = body.get("end_date")
    format_type = body.get("format", "json")

    try:
        return data_exchange_service.generate_export_payload(
            exchange_type=exchange_type,
            version=version,
            start_date=start_date,
            end_date=end_date,
            format_type=format_type,
            operator=current_user
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as exc:
        logger.error(f"Export generation error: {exc}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.get("/batches", summary="List exchange audit batches and receipts")
def list_exchange_batches(
    limit: int = Query(50, ge=1, le=200),
    exchange_type: Optional[str] = Query(None),
    current_user: dict = Depends(require_role(["admin", "accountant", "stock_manager", "warehouse_manager"]))
):
    batches = data_exchange_repo.list_batches(limit=limit, exchange_type=exchange_type)
    return {"success": True, "count": len(batches), "batches": batches}


@router.get("/batches/{batch_id}", summary="Get detailed batch receipt")
def get_batch_detail(
    batch_id: str,
    current_user: dict = Depends(require_role(["admin", "accountant", "stock_manager", "warehouse_manager"]))
):
    batch = data_exchange_repo.get_batch_by_id(batch_id)
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Exchange batch '{batch_id}' not found.")
    return {"success": True, "batch": batch}


# ─── CENTRAL MAPPING REGISTRY ENDPOINTS ───────────────────────────────────────

@router.get("/mappings", summary="List all entity alias mappings")
def get_mappings(
    entity_type: Optional[str] = Query(None),
    external_system: Optional[str] = Query(None),
    current_user: dict = Depends(require_role(["admin", "accountant", "stock_manager"]))
):
    mappings = mapping_repo.list_mappings(entity_type=entity_type, external_system=external_system)
    return {"success": True, "count": len(mappings), "mappings": mappings}


@router.post("/mappings/approve", summary="Approve an external entity mapping")
def approve_mapping_endpoint(
    body: Dict[str, Any] = Body(...),
    current_user: dict = Depends(require_role(["admin", "accountant"]))
):
    external_system = body.get("external_system", "TALLY")
    entity_type = body.get("entity_type")
    external_id = body.get("external_id")
    external_name = body.get("external_name", external_id)
    internal_id = body.get("internal_id")
    internal_name = body.get("internal_name", internal_id)

    if not entity_type or not external_id or not internal_id:
        raise HTTPException(status_code=400, detail="entity_type, external_id, and internal_id are required.")

    operator_email = current_user.get("email", "admin@nalkametals.com")
    saved = mapping_registry.approve_mapping(
        external_system=external_system,
        entity_type=entity_type,
        external_id=external_id,
        external_name=external_name,
        internal_entity_id=internal_id,
        internal_entity_name=internal_name,
        operator_email=operator_email
    )
    return {"success": True, "mapping": saved}


# ─── TALLY ADAPTER ENDPOINTS ──────────────────────────────────────────────────

@router.post("/adapters/tally/parse-xml", summary="Parse raw Tally XML export into Canonical Sales Invoices")
def parse_tally_xml_endpoint(
    body: Dict[str, Any] = Body(...),
    current_user: dict = Depends(require_role(["admin", "accountant", "stock_manager"]))
):
    xml_content = body.get("xml_content")
    if not xml_content or not isinstance(xml_content, str):
        raise HTTPException(status_code=400, detail="'xml_content' string is required.")
    try:
        canonical_records = tally_adapter.parse_tally_xml_to_canonical_sales(xml_content)
        return {
            "success": True,
            "record_count": len(canonical_records),
            "records": canonical_records
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Tally XML parsing error: {str(e)}")


@router.post("/adapters/tally/to-xml", summary="Serialize Canonical Sales records into Tally XML format")
def serialize_to_tally_xml_endpoint(
    body: Dict[str, Any] = Body(...),
    current_user: dict = Depends(require_role(["admin", "accountant", "stock_manager"]))
):
    records = body.get("records")
    if not records or not isinstance(records, list):
        raise HTTPException(status_code=400, detail="'records' list is required.")
    company_name = body.get("company_name", "Nalka Metals Private Limited")
    try:
        xml_result = tally_adapter.serialize_canonical_sales_to_tally_xml(records, company_name=company_name)
        return {"success": True, "xml_content": xml_result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Tally XML serialization error: {str(e)}")
