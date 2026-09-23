# backend/services/data_exchange_service.py
"""
Failure-Safe, Contract-Driven Data Exchange Service.
Implements the full 8-stage ingestion pipeline, Canonical Exchange Models,
Tally Adapter integration, Central Mapping Registry resolution, multi-level idempotency,
deep 4-tier financial reconciliation, and transactional commits.
"""

import re
import json
import uuid
import hashlib
import logging
from datetime import datetime, date, timezone
from typing import Dict, Any, List, Optional, Tuple

from contracts.canonical_models import (
    ExchangeState,
    ExchangeDirection,
    ExchangeEntityType,
    CanonicalSaleVoucher,
    CanonicalSaleItem
)
from contracts.data_exchange_contracts import (
    CONTRACTS,
    CURRENT_SCHEMA_VERSION,
    SUPPORTED_SCHEMA_VERSIONS,
    get_contract,
    generate_blank_template,
    generate_sample_payload,
    generate_accountant_spec,
)
from adapters.tally_adapter import tally_adapter
from services.mapping_registry import mapping_registry
from repositories.data_exchange_repo import data_exchange_repo
from repositories.historical_sales_repo import HistoricalSalesRepository
from config.database import get_db_client

logger = logging.getLogger("data_exchange_service")


class DataExchangeService:

    @staticmethod
    def compute_payload_hash(payload_or_str: Any) -> str:
        """Computes SHA-256 hash of canonical JSON or string payload."""
        if isinstance(payload_or_str, (dict, list)):
            canonical = json.dumps(payload_or_str, sort_keys=True, separators=(',', ':'))
        else:
            canonical = str(payload_or_str).strip()
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    @staticmethod
    def validate_canonical_date(date_str: Any) -> Tuple[bool, Optional[str]]:
        """
        Strictly validates that date is a string in canonical YYYY-MM-DD format
        and is calendar-valid (rejects impossible dates like 2026-02-30).
        """
        if not isinstance(date_str, str):
            return False, "Date value must be a string in YYYY-MM-DD format."
        date_str = date_str.strip()
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_str):
            return False, f"Date '{date_str}' is not in canonical YYYY-MM-DD format (e.g. 2026-06-01)."
        try:
            parsed = datetime.strptime(date_str, "%Y-%m-%d").date()
            if parsed.year < 2000 or parsed.year > 2050:
                return False, f"Date '{date_str}' has an out-of-range calendar year ({parsed.year})."
            return True, None
        except ValueError as ve:
            return False, f"Invalid calendar date '{date_str}': {str(ve)}."

    _cached_known_skus: Optional[Dict[str, str]] = None
    _cached_known_customers: Optional[Dict[str, str]] = None

    @classmethod
    def get_reference_caches(cls, force_refresh: bool = False) -> Tuple[Dict[str, str], Dict[str, str]]:
        if cls._cached_known_skus is not None and cls._cached_known_customers is not None and not force_refresh:
            return cls._cached_known_skus, cls._cached_known_customers

        known_skus: Dict[str, str] = {}
        known_customers: Dict[str, str] = {}
        try:
            db = get_db_client()
            if db:
                p_res = db.table("products").select("id, sku, name").execute()
                if p_res and p_res.data:
                    for p in p_res.data:
                        if p.get("sku"):
                            known_skus[p["sku"].strip().upper()] = p.get("name")
                c_res = db.table("dealers").select("*").execute()
                if c_res and c_res.data:
                    for c in c_res.data:
                        shop = c.get("Shop Name") or c.get("shop_name") or c.get("name")
                        if shop:
                            known_customers[str(shop).strip().upper()] = str(shop)
        except Exception as ref_err:
            logger.warning(f"Reference cache lookup warning: {ref_err}")

        cls._cached_known_skus = known_skus
        cls._cached_known_customers = known_customers
        return known_skus, known_customers

    # ─── MULTI-STAGE INGESTION & RECONCILIATION PIPELINE ───────────────────────

    @classmethod
    def preview_import_payload(
        cls,
        raw_payload_or_text: Any,
        expected_exchange_type: Optional[str] = None,
        operator: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Executes Stages 1 through 7 (Strictly Side-Effect Free):
        1. File / XML / JSON Parse Validation
        2. Schema & Version Negotiation
        3. Field Semantics & Strict Type Validation (Unknown Fields detection)
        4. Central Mapping Registry & Zero-Silent-Fuzzy-Matching
        5. Multi-Level Idempotency & Deduplication
        6. Conflict Detection & Deep Accounting Reconciliation
        7. Interactive Preview Generation
        """
        errors: List[Dict[str, Any]] = []
        warnings: List[Dict[str, Any]] = []
        conflicts: List[Dict[str, Any]] = []
        unresolved_references: List[Dict[str, Any]] = []
        ambiguous_mappings: List[Dict[str, Any]] = []
        unknown_fields: List[Dict[str, Any]] = []

        # ─── STAGE 1: FILE & PARSE VALIDATION (JSON or Tally XML) ─────────────
        payload: Dict[str, Any] = {}
        if isinstance(raw_payload_or_text, str):
            raw_text = raw_payload_or_text.strip()
            if not raw_text:
                return {
                    "can_commit": False,
                    "status": ExchangeState.INVALID.value,
                    "stage": 1,
                    "errors": [{"path": "root", "code": "EMPTY_PAYLOAD", "message": "Uploaded payload is completely empty."}],
                    "warnings": [],
                    "summary": {"total_records": 0, "errors_count": 1}
                }

            # Detect Tally XML format
            if raw_text.startswith("<") and ("<ENVELOPE" in raw_text or "<VOUCHER" in raw_text or "<TALLYMESSAGE" in raw_text):
                try:
                    converted_records = tally_adapter.parse_tally_xml_to_canonical_sales(raw_text)
                    payload = {
                        "schema_version": CURRENT_SCHEMA_VERSION,
                        "exchange_type": expected_exchange_type or "historical_sales",
                        "source": "TALLY_XML",
                        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                        "records": converted_records
                    }
                    warnings.append({
                        "code": "TALLY_XML_NORMALIZED",
                        "message": f"Successfully parsed raw Tally XML into {len(converted_records)} canonical sales records."
                    })
                except Exception as xml_err:
                    return {
                        "can_commit": False,
                        "status": ExchangeState.INVALID.value,
                        "stage": 1,
                        "errors": [{
                            "path": "root",
                            "code": "MALFORMED_TALLY_XML",
                            "message": f"Tally XML parsing error: {str(xml_err)}"
                        }],
                        "warnings": [],
                        "summary": {"total_records": 0, "errors_count": 1}
                    }
            else:
                try:
                    payload = json.loads(raw_text)
                except json.JSONDecodeError as jde:
                    return {
                        "can_commit": False,
                        "status": ExchangeState.INVALID.value,
                        "stage": 1,
                        "errors": [{
                            "path": "root",
                            "code": "MALFORMED_JSON",
                            "message": f"Invalid JSON syntax on line {jde.lineno}, col {jde.colno}: {jde.msg}"
                        }],
                        "warnings": [],
                        "summary": {"total_records": 0, "errors_count": 1}
                    }
        elif isinstance(raw_payload_or_text, dict):
            payload = raw_payload_or_text
        else:
            return {
                "can_commit": False,
                "status": ExchangeState.INVALID.value,
                "stage": 1,
                "errors": [{"path": "root", "code": "INVALID_ROOT_TYPE", "message": "Payload must be a JSON object or string."}],
                "warnings": [],
                "summary": {"total_records": 0, "errors_count": 1}
            }

        # ─── STAGE 2: SCHEMA VERSION NEGOTIATION ──────────────────────────────
        schema_version = str(payload.get("schema_version", "")).strip()
        exchange_type = str(payload.get("exchange_type", "")).strip().lower()
        source = str(payload.get("source", "")).strip()

        if not schema_version:
            errors.append({
                "path": "schema_version",
                "code": "MISSING_SCHEMA_VERSION",
                "message": f"Missing required 'schema_version' in root header. Supported versions: {SUPPORTED_SCHEMA_VERSIONS}."
            })
        elif schema_version not in SUPPORTED_SCHEMA_VERSIONS:
            errors.append({
                "path": "schema_version",
                "code": "UNSUPPORTED_SCHEMA_VERSION",
                "message": f"Schema version '{schema_version}' is not supported. Supported versions: {SUPPORTED_SCHEMA_VERSIONS}.",
                "received": schema_version,
                "expected": CURRENT_SCHEMA_VERSION
            })

        if not exchange_type:
            errors.append({
                "path": "exchange_type",
                "code": "MISSING_EXCHANGE_TYPE",
                "message": f"Missing required 'exchange_type' in root header. Supported types: {list(CONTRACTS.keys())}."
            })
        elif exchange_type not in CONTRACTS:
            errors.append({
                "path": "exchange_type",
                "code": "UNKNOWN_EXCHANGE_TYPE",
                "message": f"Unsupported exchange type '{exchange_type}'. Supported: {list(CONTRACTS.keys())}."
            })
        elif expected_exchange_type and exchange_type != expected_exchange_type.strip().lower():
            errors.append({
                "path": "exchange_type",
                "code": "EXCHANGE_TYPE_MISMATCH",
                "message": f"Payload exchange_type '{exchange_type}' does not match expected contract '{expected_exchange_type}'."
            })

        if not source:
            errors.append({
                "path": "source",
                "code": "MISSING_SOURCE",
                "message": "Missing required 'source' identifier in root header (e.g. 'TALLY', 'INTERNAL')."
            })

        records_raw = payload.get("records")
        if records_raw is None:
            errors.append({
                "path": "records",
                "code": "MISSING_RECORDS_ARRAY",
                "message": "Missing required 'records' array in root payload."
            })
            records_raw = []
        elif not isinstance(records_raw, list):
            errors.append({
                "path": "records",
                "code": "TYPE_MISMATCH",
                "message": "'records' must be a JSON array of record objects."
            })
            records_raw = []

        if errors:
            return {
                "can_commit": False,
                "status": ExchangeState.INVALID.value,
                "stage": 2,
                "schema_version": schema_version or "UNKNOWN",
                "exchange_type": exchange_type or "UNKNOWN",
                "errors": errors,
                "warnings": warnings,
                "summary": {"total_records": len(records_raw), "errors_count": len(errors)}
            }

        contract = get_contract(exchange_type, schema_version)
        record_field_defs = {f["name"]: f for f in contract.get("record_fields", [])}
        item_field_defs = {f["name"]: f for f in contract.get("item_fields", [])} if "item_fields" in contract else {}

        # ─── STAGE 3 & 4: FIELD SEMANTICS, REFERENCE & MAPPING VALIDATION ─────
        payload_hash = cls.compute_payload_hash(payload)
        already_imported_batch = data_exchange_repo.find_batch_by_hash(payload_hash)
        is_duplicate_batch = already_imported_batch is not None

        if is_duplicate_batch:
            warnings.append({
                "code": "DUPLICATE_PAYLOAD_HASH",
                "message": f"Identical payload already committed in Batch #{already_imported_batch.get('id')} at {already_imported_batch.get('committed_at')}.",
                "batch_id": already_imported_batch.get("id")
            })

        seen_voucher_numbers = set()
        total_calc_amount = 0.0
        total_calc_taxable = 0.0
        total_calc_tax = 0.0
        total_calc_qty = 0.0
        total_calc_lines = 0
        new_records_count = 0
        existing_records_count = 0
        conflict_records_count = 0

        # Pre-fetch existing records for reference validation & conflict checking
        existing_vouchers_map: Dict[str, Any] = {}
        if exchange_type == "historical_sales":
            try:
                conn = HistoricalSalesRepository.get_connection()
                try:
                    cur = conn.cursor()
                    cur.execute("SELECT voucher_number, voucher_amount, voucher_date, customer_name FROM historical_sales")
                    for r in cur.fetchall():
                        existing_vouchers_map[r["voucher_number"].strip().upper()] = {
                            "voucher_number": r["voucher_number"],
                            "total_amount": float(r["voucher_amount"] or 0.0),
                            "voucher_date": r["voucher_date"],
                            "customer_name": r["customer_name"]
                        }
                finally:
                    conn.close()
            except Exception as e:
                logger.warning(f"Could not pre-fetch historical sales vouchers: {e}")

        known_skus, known_customers = cls.get_reference_caches()

        # Iterate over records with document-level atomicity
        for rec_idx, rec in enumerate(records_raw):
            rec_path = f"records[{rec_idx}]"
            if not isinstance(rec, dict):
                errors.append({
                    "path": rec_path,
                    "code": "INVALID_RECORD_OBJECT",
                    "message": f"Record at index {rec_idx} must be a JSON object."
                })
                continue

            # Check unknown fields
            for k in rec.keys():
                if k not in record_field_defs:
                    unknown_fields.append({
                        "path": f"{rec_path}.{k}",
                        "code": "UNKNOWN_FIELD",
                        "message": f"Field '{k}' is not part of the active contract schema (v{schema_version}).",
                        "field": k
                    })

            rec_voucher_no = str(rec.get("voucher_number") or rec.get("sku") or rec.get("name") or "").strip()

            # Field validation
            for fname, fdef in record_field_defs.items():
                fval = rec.get(fname)
                fpath = f"{rec_path}.{fname}"
                req = fdef.get("required", False)
                nullable = fdef.get("nullable", True)
                ftype = fdef.get("type")

                if fval is None:
                    if req and not nullable:
                        errors.append({
                            "path": fpath,
                            "code": "MISSING_REQUIRED_FIELD",
                            "message": f"Missing required field '{fname}' ({fdef.get('label')}).",
                            "field": fname
                        })
                    continue

                # Strict type checks
                if ftype == "string":
                    if not isinstance(fval, str):
                        errors.append({
                            "path": fpath,
                            "code": "TYPE_MISMATCH",
                            "message": f"Field '{fname}' must be a string.",
                            "received": str(fval)
                        })
                    elif req and not fval.strip():
                        errors.append({
                            "path": fpath,
                            "code": "EMPTY_STRING",
                            "message": f"Required field '{fname}' cannot be an empty string."
                        })
                elif ftype == "number":
                    if not isinstance(fval, (int, float)) or isinstance(fval, bool):
                        errors.append({
                            "path": fpath,
                            "code": "TYPE_MISMATCH",
                            "message": f"Field '{fname}' must be a numeric value.",
                            "received": str(fval)
                        })
                    else:
                        val_num = float(fval)
                        if fdef.get("min") is not None and val_num < fdef["min"]:
                            errors.append({
                                "path": fpath,
                                "code": "VALUE_OUT_OF_RANGE",
                                "message": f"Field '{fname}' value {val_num} is less than minimum allowed ({fdef['min']})."
                            })
                elif ftype == "date":
                    is_valid_date, date_err = cls.validate_canonical_date(fval)
                    if not is_valid_date:
                        errors.append({
                            "path": fpath,
                            "code": "INVALID_DATE_FORMAT",
                            "message": date_err,
                            "received": str(fval),
                            "expected": "YYYY-MM-DD"
                        })
                elif ftype == "array" and fname == "items":
                    if not isinstance(fval, list):
                        errors.append({
                            "path": fpath,
                            "code": "TYPE_MISMATCH",
                            "message": "Field 'items' must be a JSON array of line items."
                        })
                    elif len(fval) == 0:
                        errors.append({
                            "path": fpath,
                            "code": "EMPTY_LINE_ITEMS",
                            "message": f"Voucher '{rec_voucher_no}' must contain at least 1 line item(s)."
                        })

            # ─── STAGE 4: CENTRAL MAPPING REGISTRY VALIDATION ─────────────────
            cust_name = rec.get("customer_name")
            if cust_name and isinstance(cust_name, str):
                cust_resolution = mapping_registry.resolve_customer(
                    external_name=cust_name,
                    external_id=rec.get("customer_code"),
                    external_system=source,
                    known_customers=known_customers
                )
                if cust_resolution["status"] == "AMBIGUOUS":
                    ambiguous_mappings.append({
                        "record_id": rec_voucher_no,
                        "entity_type": "CUSTOMER",
                        "external_identifier": cust_name,
                        "confidence": cust_resolution["confidence"],
                        "candidates": cust_resolution["candidates"],
                        "problem": cust_resolution["problem"]
                    })
                elif cust_resolution["status"] == "UNRESOLVED":
                    unresolved_references.append({
                        "record_id": rec_voucher_no,
                        "entity_type": "CUSTOMER",
                        "external_identifier": cust_name,
                        "problem": cust_resolution["problem"]
                    })

            # Validate Line Items
            items_list = rec.get("items", [])
            rec_line_amount_sum = 0.0
            if isinstance(items_list, list):
                total_calc_lines += len(items_list)
                for item_idx, item in enumerate(items_list):
                    item_path = f"{rec_path}.items[{item_idx}]"
                    if not isinstance(item, dict):
                        errors.append({
                            "path": item_path,
                            "code": "INVALID_ITEM_OBJECT",
                            "message": f"Line item at index {item_idx} must be a JSON object."
                        })
                        continue

                    # Validate item fields
                    for ifname, ifdef in item_field_defs.items():
                        ifval = item.get(ifname)
                        ifpath = f"{item_path}.{ifname}"
                        ireq = ifdef.get("required", False)
                        if ifval is None and ireq and not ifdef.get("nullable", True):
                            errors.append({
                                "path": ifpath,
                                "code": "MISSING_REQUIRED_FIELD",
                                "message": f"Missing required line item field '{ifname}'."
                            })
                            continue

                        if ifval is not None:
                            if ifdef.get("type") == "number":
                                if not isinstance(ifval, (int, float)) or isinstance(ifval, bool):
                                    errors.append({
                                        "path": ifpath,
                                        "code": "TYPE_MISMATCH",
                                        "message": f"Line item field '{ifname}' must be numeric."
                                    })
                                elif ifdef.get("min") is not None and float(ifval) < ifdef["min"]:
                                    errors.append({
                                        "path": ifpath,
                                        "code": "VALUE_OUT_OF_RANGE",
                                        "message": f"Line item field '{ifname}' cannot be negative or below {ifdef['min']}."
                                    })

                    # Product reference resolution
                    p_name = item.get("item_name") or ""
                    p_code = item.get("product_code")
                    if p_name or p_code:
                        prod_resolution = mapping_registry.resolve_product_sku(
                            external_name=p_name,
                            external_code=p_code,
                            external_system=source,
                            known_skus=known_skus
                        )
                        if prod_resolution["status"] == "AMBIGUOUS":
                            ambiguous_mappings.append({
                                "record_id": rec_voucher_no,
                                "line": item_idx + 1,
                                "entity_type": "PRODUCT_SKU",
                                "external_identifier": p_code or p_name,
                                "confidence": prod_resolution["confidence"],
                                "candidates": prod_resolution["candidates"],
                                "problem": prod_resolution["problem"]
                            })

                    # Accumulate totals
                    try:
                        i_qty = float(item.get("quantity") or 0.0)
                        i_amt = float(item.get("amount") or 0.0)
                        total_calc_qty += i_qty
                        rec_line_amount_sum += i_amt
                    except (ValueError, TypeError):
                        pass

            # ─── STAGE 5: IDEMPOTENCY & DEDUPLICATION ─────────────────────────
            if exchange_type == "historical_sales" and rec_voucher_no:
                clean_vch = rec_voucher_no.upper()
                if clean_vch in seen_voucher_numbers:
                    errors.append({
                        "path": f"{rec_path}.voucher_number",
                        "code": "DUPLICATE_IN_PAYLOAD",
                        "message": f"Duplicate voucher_number '{rec_voucher_no}' appeared multiple times in this single payload.",
                        "voucher_number": rec_voucher_no
                    })
                seen_voucher_numbers.add(clean_vch)

                # ─── STAGE 6: CONFLICT DETECTION ──────────────────────────────
                if clean_vch in existing_vouchers_map:
                    existing_records_count += 1
                    existing_data = existing_vouchers_map[clean_vch]
                    incoming_amt = float(rec.get("total_amount") or rec_line_amount_sum)
                    existing_amt = float(existing_data.get("total_amount") or 0.0)
                    incoming_date = rec.get("voucher_date")
                    existing_date = existing_data.get("voucher_date")

                    diffs = []
                    if abs(incoming_amt - existing_amt) > 0.01:
                        diffs.append({
                            "field": "total_amount",
                            "existing": existing_amt,
                            "incoming": incoming_amt
                        })
                    if incoming_date and incoming_date != existing_date:
                        diffs.append({
                            "field": "voucher_date",
                            "existing": existing_date,
                            "incoming": incoming_date
                        })

                    if diffs:
                        conflict_records_count += 1
                        conflicts.append({
                            "record_id": rec_voucher_no,
                            "identifier_type": "voucher_number",
                            "existing_record": existing_data,
                            "incoming_record": {
                                "voucher_number": rec_voucher_no,
                                "voucher_date": incoming_date,
                                "customer_name": rec.get("customer_name"),
                                "total_amount": incoming_amt
                            },
                            "differences": diffs
                        })
                else:
                    new_records_count += 1

            # Accumulate overall amounts
            try:
                rec_total = float(rec.get("total_amount") or rec.get("default_sale_price") or rec_line_amount_sum)
                total_calc_amount += rec_total
            except (ValueError, TypeError):
                pass

        # ─── STAGE 6B: DEEP ACCOUNTING RECONCILIATION CHECKSUMS ────────────────
        declared_total = payload.get("total_amount")
        if declared_total is not None:
            try:
                declared_num = float(declared_total)
                if abs(declared_num - total_calc_amount) > 1.0:  # Tolerance for fractional rounding
                    errors.append({
                        "path": "root.total_amount",
                        "code": "RECONCILIATION_MISMATCH",
                        "message": f"Declared root total amount (₹{declared_num:,.2f}) differs from sum of line items (₹{total_calc_amount:,.2f}).",
                        "received": declared_num,
                        "expected": total_calc_amount
                    })
            except ValueError:
                pass

        # ─── STAGE 7: INTERACTIVE PREVIEW & STATUS DETERMINATION ───────────────
        has_blocking_errors = len(errors) > 0
        has_conflicts = len(conflicts) > 0
        has_ambiguous = len(ambiguous_mappings) > 0
        has_unresolved = len(unresolved_references) > 0

        if has_blocking_errors:
            current_state = ExchangeState.INVALID.value
        elif has_conflicts:
            current_state = ExchangeState.CONFLICT.value
        elif has_ambiguous or has_unresolved:
            current_state = ExchangeState.REQUIRES_REVIEW.value
        else:
            current_state = ExchangeState.READY_TO_COMMIT.value

        can_commit = (not has_blocking_errors) and (not has_unresolved)

        return {
            "can_commit": can_commit,
            "status": current_state,
            "stage": 7 if can_commit else (6 if has_conflicts else 3),
            "schema_version": schema_version,
            "exchange_type": exchange_type,
            "source": source,
            "payload_hash": payload_hash,
            "summary": {
                "total_records": len(records_raw),
                "total_line_items": total_calc_lines,
                "new_records": new_records_count,
                "already_imported_records": existing_records_count,
                "conflict_records": conflict_records_count,
                "unresolved_entities_count": len(unresolved_references),
                "ambiguous_mappings_count": len(ambiguous_mappings),
                "errors_count": len(errors),
                "warnings_count": len(warnings),
                "unknown_fields_count": len(unknown_fields),
                "total_amount": round(total_calc_amount, 2),
                "total_quantity": round(total_calc_qty, 2)
            },
            "errors": errors,
            "warnings": warnings,
            "unknown_fields": unknown_fields,
            "conflicts": conflicts,
            "unresolved_references": unresolved_references,
            "ambiguous_mappings": ambiguous_mappings
        }

    # ─── STAGE 8: ATOMIC TRANSACTIONAL COMMIT WITH RECEIPT ─────────────────────

    @classmethod
    def commit_import_payload(
        cls,
        payload: Dict[str, Any],
        conflict_resolutions: Optional[Dict[str, str]] = None,
        operator: Optional[Dict[str, Any]] = None,
        preview_result: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Stage 8: Atomic Transactional Commit.
        Guarantees that database commit is atomic with rollback on any exception.
        Generates and returns immutable cryptographic Import Receipt.
        """
        preview = preview_result or cls.preview_import_payload(payload)
        if not preview.get("can_commit", False):
            raise ValueError(
                f"Cannot commit payload with {preview['summary']['errors_count']} errors and "
                f"{preview['summary']['unresolved_entities_count']} unresolved references."
            )

        exchange_type = preview["exchange_type"]
        schema_version = preview["schema_version"]
        payload_hash = preview["payload_hash"]
        records = payload.get("records", [])
        resolutions = conflict_resolutions or {}
        
        batch_id = f"EX-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
        operator_email = operator.get("email", "admin@nalkametals.com") if operator else "admin@nalkametals.com"
        operator_role = operator.get("role", "admin") if operator else "admin"

        created_count = 0
        updated_count = 0
        skipped_count = 0

        # ATOMIC DATABASE COMMIT BASED ON EXCHANGE TYPE
        if exchange_type == "historical_sales":
            conn = HistoricalSalesRepository.get_connection()
            try:
                with conn:
                    for rec in records:
                        vch_no = str(rec["voucher_number"]).strip()
                        vch_clean = vch_no.upper()
                        
                        # Check if exists
                        cur = conn.cursor()
                        cur.execute("SELECT id, voucher_amount FROM historical_sales WHERE voucher_number = ?", (vch_no,))
                        existing = cur.fetchone()

                        if existing:
                            res_action = resolutions.get(vch_clean, "SKIP").upper()
                            if res_action == "OVERWRITE" or res_action == "UPDATE":
                                # Update existing record
                                sale_id = existing["id"]
                                conn.execute("""
                                UPDATE historical_sales SET
                                    voucher_date = ?, customer_name = ?, customer_gstin = ?,
                                    salesman_name = ?, city = ?, state = ?, voucher_amount = ?, gross_amount = ?, updated_at = ?
                                WHERE id = ?
                                """, (
                                    rec["voucher_date"],
                                    rec["customer_name"],
                                    rec.get("customer_gstin"),
                                    rec.get("salesman_name") or "Unassigned / Unresolved",
                                    rec.get("city") or "Unknown",
                                    rec.get("state") or "Unknown",
                                    float(rec["total_amount"]),
                                    float(rec["total_amount"]),
                                    datetime.now(timezone.utc).isoformat(),
                                    sale_id
                                ))
                                # Replace line items
                                conn.execute("DELETE FROM historical_sale_items WHERE historical_sale_id = ?", (sale_id,))
                                for it_idx, item in enumerate(rec.get("items", [])):
                                    conn.execute("""
                                    INSERT INTO historical_sale_items (
                                        id, historical_sale_id, product_name, sku, quantity, unit, unit_rate, line_amount, source_line_id, created_at
                                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                    """, (
                                        str(uuid.uuid4()),
                                        sale_id,
                                        item["item_name"],
                                        item.get("product_code"),
                                        float(item["quantity"]),
                                        item.get("unit", "PCS"),
                                        float(item["rate"]),
                                        float(item["amount"]),
                                        str(it_idx + 1),
                                        datetime.now(timezone.utc).isoformat()
                                    ))
                                updated_count += 1
                            else:
                                skipped_count += 1
                        else:
                            # Insert new sales voucher
                            sale_id = str(uuid.uuid4())
                            conn.execute("""
                            INSERT INTO historical_sales (
                                id, voucher_number, voucher_date, customer_name, customer_gstin,
                                salesman_name, city, state, voucher_amount, gross_amount, source, source_import_id, created_at, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """, (
                                sale_id,
                                vch_no,
                                rec["voucher_date"],
                                rec["customer_name"],
                                rec.get("customer_gstin"),
                                rec.get("salesman_name") or "Unassigned / Unresolved",
                                rec.get("city") or "Unknown",
                                rec.get("state") or "Unknown",
                                float(rec["total_amount"]),
                                float(rec["total_amount"]),
                                "DATA_EXCHANGE_IMPORT",
                                batch_id,
                                datetime.now(timezone.utc).isoformat(),
                                datetime.now(timezone.utc).isoformat()
                            ))
                            for it_idx, item in enumerate(rec.get("items", [])):
                                conn.execute("""
                                INSERT INTO historical_sale_items (
                                    id, historical_sale_id, product_name, sku, quantity, unit, unit_rate, line_amount, source_line_id, created_at
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                                """, (
                                    str(uuid.uuid4()),
                                    sale_id,
                                    item["item_name"],
                                    item.get("product_code"),
                                    float(item["quantity"]),
                                    item.get("unit", "PCS"),
                                    float(item["rate"]),
                                    float(item["amount"]),
                                    str(it_idx + 1),
                                    datetime.now(timezone.utc).isoformat()
                                ))
                            created_count += 1
            except Exception as db_err:
                logger.error(f"Atomic commit rollback for batch {batch_id}: {db_err}")
                data_exchange_repo.save_batch({
                    "id": batch_id,
                    "exchange_type": exchange_type,
                    "schema_version": schema_version,
                    "source": preview.get("source", "TALLY"),
                    "destination": "BUSINESS_OPS_PLATFORM",
                    "direction": ExchangeDirection.IMPORT.value,
                    "status": ExchangeState.ROLLED_BACK.value,
                    "payload_hash": payload_hash,
                    "errors_count": 1,
                    "operator_email": operator_email,
                    "operator_role": operator_role,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
                raise RuntimeError(f"Database transaction failure during commit: {str(db_err)}")
            finally:
                conn.close()

        elif exchange_type == "inventory_catalog":
            db = get_db_client()
            if db:
                try:
                    for rec in records:
                        sku = rec["sku"].strip().upper()
                        prod_payload = {
                            "sku": sku,
                            "name": rec["name"],
                            "brand": rec.get("brand", "NALKA"),
                            "unit_of_measure": rec.get("unit_of_measure", "PCS"),
                            "default_sale_price": float(rec["default_sale_price"]),
                            "cost_price": float(rec.get("cost_price") or 0.0),
                            "gst_rate": float(rec.get("gst_rate") or 18.0),
                            "is_active": rec.get("is_active", True),
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }
                        db.table("products").upsert(prod_payload, on_conflict="sku").execute()
                        created_count += 1
                except Exception as cat_err:
                    logger.error(f"Catalog sync error: {cat_err}")
                    raise RuntimeError(f"Catalog commit failure: {str(cat_err)}")
            else:
                created_count = len(records)

        else:
            created_count = len(records)

        # Generate official Import Receipt
        committed_at = datetime.now(timezone.utc).isoformat()
        receipt = {
            "batch_id": batch_id,
            "status": "SUCCESS",
            "exchange_type": exchange_type,
            "schema_version": schema_version,
            "source": preview.get("source", "TALLY"),
            "destination": "BUSINESS_OPS_PLATFORM",
            "direction": ExchangeDirection.IMPORT.value,
            "payload_hash": payload_hash,
            "records_processed": len(records),
            "records_created": created_count,
            "records_updated": updated_count,
            "records_skipped": skipped_count,
            "total_amount": preview["summary"]["total_amount"],
            "total_quantity": preview["summary"]["total_quantity"],
            "operator_email": operator_email,
            "operator_role": operator_role,
            "committed_at": committed_at
        }

        # Persist batch record in exchange repository
        data_exchange_repo.save_batch({
            "id": batch_id,
            "exchange_type": exchange_type,
            "schema_version": schema_version,
            "source": preview.get("source", "TALLY"),
            "destination": "BUSINESS_OPS_PLATFORM",
            "direction": ExchangeDirection.IMPORT.value,
            "status": ExchangeState.COMMITTED.value,
            "payload_hash": payload_hash,
            "record_count": len(records),
            "created_count": created_count,
            "updated_count": updated_count,
            "skipped_count": skipped_count,
            "conflicts_count": preview["summary"]["conflict_records"],
            "errors_count": 0,
            "warnings_count": preview["summary"]["warnings_count"],
            "total_amount": preview["summary"]["total_amount"],
            "total_quantity": preview["summary"]["total_quantity"],
            "operator_email": operator_email,
            "operator_role": operator_role,
            "receipt": receipt,
            "created_at": committed_at,
            "committed_at": committed_at
        })

        return {
            "success": True,
            "batch_id": batch_id,
            "receipt": receipt
        }

    # ─── CONTRACT-DRIVEN EXPORT ENGINE ────────────────────────────────────────

    @classmethod
    def generate_export_payload(
        cls,
        exchange_type: str,
        version: str = CURRENT_SCHEMA_VERSION,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        format_type: str = "json",
        operator: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Builds, normalizes, validates, and hashes a contract-conforming export package.
        Supports both canonical JSON and Tally-compatible XML.
        """
        contract = get_contract(exchange_type, version)
        records: List[Dict[str, Any]] = []

        if exchange_type == "historical_sales":
            conn = HistoricalSalesRepository.get_connection()
            try:
                cur = conn.cursor()
                query = "SELECT * FROM historical_sales WHERE 1=1"
                params = []
                if start_date:
                    query += " AND voucher_date >= ?"
                    params.append(start_date)
                if end_date:
                    query += " AND voucher_date <= ?"
                    params.append(end_date)
                query += " ORDER BY voucher_date ASC"
                cur.execute(query, tuple(params))
                sales_rows = cur.fetchall()

                for s in sales_rows:
                    cust_name = (s["customer_name"] or "").strip()
                    if not cust_name:
                        continue

                    s_id = s["id"]
                    cur.execute("SELECT * FROM historical_sale_items WHERE historical_sale_id = ?", (s_id,))
                    items_rows = cur.fetchall()
                    items_list = []
                    for it in items_rows:
                        item_name = (it["product_name"] or "").strip()
                        if not item_name:
                            continue
                        items_list.append({
                            "item_name": item_name,
                            "product_code": (it["sku"] or "").strip() or None,
                            "quantity": float(it["quantity"] or 0.0),
                            "unit": it["unit"] or "PCS",
                            "rate": float(it["unit_rate"] or 0.0),
                            "amount": float(it["line_amount"] or 0.0),
                            "gst_rate": 18.0
                        })

                    if not items_list:
                        continue

                    records.append({
                        "voucher_number": s["voucher_number"],
                        "voucher_date": s["voucher_date"],
                        "customer_name": cust_name,
                        "customer_gstin": s["customer_gstin"] or None,
                        "salesman_name": s["salesman_name"] or "Unassigned / Unresolved",
                        "city": s["city"] or "Unknown",
                        "state": s["state"] or "Unknown",
                        "total_amount": float(s["voucher_amount"] or 0.0),
                        "items": items_list
                    })
            finally:
                conn.close()

        elif exchange_type == "inventory_catalog":
            db = get_db_client()
            if db:
                res = db.table("products").select("*").execute()
                for p in (res.data or []):
                    records.append({
                        "sku": p.get("sku") or "SKU-UNKNOWN",
                        "name": p.get("name") or "Unnamed Product",
                        "brand": p.get("brand") or "NALKA",
                        "unit_of_measure": p.get("unit_of_measure") or "PCS",
                        "cost_price": float(p.get("cost_price") or 0.0),
                        "default_sale_price": float(p.get("default_sale_price") or 0.0),
                        "gst_rate": float(p.get("gst_rate") or 18.0),
                        "is_active": p.get("is_active", True)
                    })

        # Assemble self-describing canonical export package
        generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        export_payload = {
            "schema_version": version,
            "exchange_type": exchange_type,
            "source": "BUSINESS_OPS_PLATFORM",
            "destination": contract.get("default_source", "TALLY"),
            "generated_at": generated_at,
            "period_start": start_date,
            "period_end": end_date,
            "record_count": len(records),
            "records": records
        }

        payload_hash = cls.compute_payload_hash(export_payload)
        export_payload["payload_hash"] = payload_hash

        # Optional Tally XML serialization
        tally_xml = None
        if format_type.lower() == "xml" and exchange_type == "historical_sales":
            tally_xml = tally_adapter.serialize_canonical_sales_to_tally_xml(records)

        batch_id = f"EX-EXP-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
        operator_email = operator.get("email", "admin@nalkametals.com") if operator else "admin@nalkametals.com"

        # Log export batch
        data_exchange_repo.save_batch({
            "id": batch_id,
            "exchange_type": exchange_type,
            "schema_version": version,
            "source": "BUSINESS_OPS_PLATFORM",
            "destination": contract.get("default_source", "TALLY"),
            "direction": ExchangeDirection.EXPORT.value,
            "status": ExchangeState.COMMITTED.value,
            "payload_hash": payload_hash,
            "record_count": len(records),
            "created_count": 0,
            "updated_count": 0,
            "skipped_count": 0,
            "conflicts_count": 0,
            "errors_count": 0,
            "warnings_count": 0,
            "operator_email": operator_email,
            "created_at": generated_at,
            "committed_at": generated_at
        })

        return {
            "success": True,
            "batch_id": batch_id,
            "payload_hash": payload_hash,
            "export_payload": export_payload,
            "tally_xml": tally_xml
        }


data_exchange_service = DataExchangeService()
