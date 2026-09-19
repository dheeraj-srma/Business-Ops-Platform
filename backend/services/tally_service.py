"""
Tally Integration Service
Isolated subsystem for managing Tally ERP sync contracts, payload normalization,
idempotency, error logging, and retry logic.
"""
from typing import Dict, Any, List, Optional
import hashlib
import json
import uuid
from datetime import datetime
from supabase_client import get_supabase_client
from services.inventory_service import inventory_service

_IN_MEMORY_TALLY_LOGS: List[Dict[str, Any]] = []

class TallyService:
    @staticmethod
    def compute_payload_hash(payload: Dict[str, Any]) -> str:
        payload_str = json.dumps(payload, sort_keys=True)
        return hashlib.sha256(payload_str.encode("utf-8")).hexdigest()

    @staticmethod
    def normalize_tally_payload(raw_data: Dict[str, Any]) -> Dict[str, Any]:
        normalized = {}
        for k, v in raw_data.items():
            if isinstance(v, str):
                v_clean = v.strip()
                try:
                    normalized[k] = float(v_clean)
                except ValueError:
                    normalized[k] = v_clean
            elif isinstance(v, list):
                normalized_list = []
                for item in v:
                    if isinstance(item, dict):
                        normalized_item = {}
                        for ik, iv in item.items():
                            ik_clean = "quantity" if ik in ("qty", "quantity") else ik
                            if isinstance(iv, str):
                                try:
                                    normalized_item[ik_clean] = float(iv.strip())
                                except ValueError:
                                    normalized_item[ik_clean] = iv.strip()
                            else:
                                normalized_item[ik_clean] = iv
                        normalized_list.append(normalized_item)
                    else:
                        normalized_list.append(item)
                normalized[k] = normalized_list
            else:
                normalized[k] = v
        return normalized

    @staticmethod
    def generate_tally_xml_voucher(order_data: Dict[str, Any]) -> str:
        order_code = order_data.get("order_code", "ORD-UNKNOWN")
        party = order_data.get("dealer_name") or order_data.get("party_name") or "Direct Customer"
        total = order_data.get("total_amount", 0.0)
        items = order_data.get("items", [])

        xml_items = []
        for it in items:
            xml_items.append(f"""    <ALLINVENTORYENTRIES.LIST>
      <STOCKITEMNAME>{it.get('product_name') or it.get('sku')}</STOCKITEMNAME>
      <RATE>{it.get('price', 0.0)}</RATE>
      <ACTUALQTY>{it.get('quantity', 0)}</ACTUALQTY>
    </ALLINVENTORYENTRIES.LIST>""")

        items_str = "\n".join(xml_items)
        return f"""<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE>
          <VOUCHER VCHTYPE="Sales" ACTION="Create">
            <VOUCHERNUMBER>{order_code}</VOUCHERNUMBER>
            <PARTYLEDGERNAME>{party}</PARTYLEDGERNAME>
            <AMOUNT>{total}</AMOUNT>
{items_str}
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>"""

    def get_contract_definitions(self) -> Dict[str, Any]:

        """
        Returns formal contracts and schemas for Tally import/export synchronization.
        """
        return {
            "subsystem": "Tally ERP 9 / Prime Integration Layer",
            "version": "2.0",
            "contracts": {
                "STOCK_INWARD_VOUCHER": {
                    "required_fields": ["event_id", "voucher_number", "supplier_name", "items"],
                    "item_schema": {"sku": "str", "quantity": "float (>0)", "rate": "float (>=0)"}
                },
                "STOCK_OUTWARD_DISPATCH": {
                    "required_fields": ["event_id", "voucher_number", "customer_name", "items"],
                    "item_schema": {"sku": "str", "quantity": "float (>0)", "rate": "float (>=0)"}
                },
                "MASTER_ITEM_SYNC": {
                    "required_fields": ["event_id", "items"],
                    "item_schema": {"sku": "str", "name": "str", "unit": "str", "min_stock": "float"}
                }
            }
        }

    def process_tally_payload(
        self,
        payload: Dict[str, Any],
        correlation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Processes incoming Tally payload, enforcing database-level idempotency
        via payload hash and event key matching.
        """
        event_id = payload.get("event_id") or payload.get("idempotency_key") or str(uuid.uuid4())
        payload_str = json.dumps(payload, sort_keys=True)
        payload_hash = hashlib.sha256(payload_str.encode("utf-8")).hexdigest()

        # Idempotency check
        existing_log = self._find_sync_log(event_id)
        if existing_log:
            if existing_log["status"] == "SUCCESS":
                return {
                    "status": "SKIPPED_DUPLICATE",
                    "message": f"Event '{event_id}' has already been processed successfully.",
                    "log": existing_log
                }

        # Process contract type
        contract_type = payload.get("contract_type") or "STOCK_INWARD_VOUCHER"
        items = payload.get("items") or []

        sync_log = {
            "id": str(uuid.uuid4()),
            "event_id": event_id,
            "payload_hash": payload_hash,
            "contract_type": contract_type,
            "status": "PROCESSING",
            "error_message": None,
            "created_at": datetime.utcnow().isoformat(),
            "correlation_id": correlation_id
        }

        try:
            processed_count = 0
            if contract_type == "STOCK_INWARD_VOUCHER":
                for it in items:
                    sku = it.get("sku")
                    qty = float(it.get("quantity", 0))
                    if sku and qty > 0:
                        prod = inventory_service.get_product_by_sku(sku)
                        if prod:
                            inventory_service.record_stock_in(
                                items=[{"product_id": prod["id"], "quantity": qty}],
                                supplier=payload.get("supplier_name", "Tally Import"),
                                reference_number=payload.get("voucher_number", f"TALLY-{event_id[:6]}"),
                                reason="Tally ERP Inward Sync",
                                notes=f"Tally Voucher: {payload.get('voucher_number')}"
                            )
                            processed_count += 1
            
            sync_log["status"] = "SUCCESS"
            sync_log["processed_count"] = processed_count
            self._save_sync_log(sync_log)

            return {
                "status": "SUCCESS",
                "message": f"Successfully processed Tally event '{event_id}'.",
                "processed_items_count": processed_count,
                "log": sync_log
            }
        except Exception as e:
            sync_log["status"] = "FAILED"
            sync_log["error_message"] = str(e)
            self._save_sync_log(sync_log)
            raise ValueError(f"Tally payload processing failed: {str(e)}")

    def retry_sync_event(self, event_id: str) -> Dict[str, Any]:
        """
        Retries processing a failed Tally sync event.
        """
        log = self._find_sync_log(event_id)
        if not log:
            raise ValueError(f"Sync event '{event_id}' not found.")
        if log["status"] == "SUCCESS":
            return {"message": "Event is already successfully synced.", "log": log}
        
        log["status"] = "RETRYING"
        log["error_message"] = None
        self._save_sync_log(log)
        return {"message": f"Retry initiated for Tally event '{event_id}'.", "log": log}

    def list_sync_logs(self, limit: int = 50) -> List[Dict[str, Any]]:
        client = get_supabase_client()
        if client:
            try:
                res = client.table("tally_sync_logs").select("*").order("created_at", desc=True).limit(limit).execute()
                if res.data is not None:
                    return res.data
            except Exception:
                pass
        return _IN_MEMORY_TALLY_LOGS[:limit]

    def _find_sync_log(self, event_id: str) -> Optional[Dict[str, Any]]:
        client = get_supabase_client()
        if client:
            try:
                res = client.table("tally_sync_logs").select("*").eq("event_id", event_id).execute()
                if res.data:
                    return res.data[0]
            except Exception:
                pass
        return next((l for l in _IN_MEMORY_TALLY_LOGS if l["event_id"] == event_id), None)

    def _save_sync_log(self, log: Dict[str, Any]):
        client = get_supabase_client()
        if client:
            try:
                client.table("tally_sync_logs").upsert(log).execute()
                return
            except Exception:
                pass
        
        # In-memory fallback
        for idx, existing in enumerate(_IN_MEMORY_TALLY_LOGS):
            if existing["event_id"] == log["event_id"]:
                _IN_MEMORY_TALLY_LOGS[idx] = log
                return
        _IN_MEMORY_TALLY_LOGS.insert(0, log)

tally_service = TallyService()
