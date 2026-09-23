# backend/adapters/tally_adapter.py
"""
Tally Integration Adapter Layer.
Responsible for parsing Tally XML/JSON export envelopes, normalizing Tally-specific quirks,
translating between Tally and the Canonical Exchange Model, and serializing canonical records
into Tally-compliant XML requests.
Isolated from internal database schemas and core business analytics.
"""

import re
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
import logging

from contracts.canonical_models import (
    CanonicalSaleVoucher,
    CanonicalSaleItem,
    ExchangeEntityType
)

logger = logging.getLogger("tally_adapter")


class TallyAdapter:
    """
    Adapter between Tally ERP 9 / TallyPrime representations and Canonical Exchange Models.
    """

    @classmethod
    def parse_tally_date(cls, raw_date_str: str) -> str:
        """
        Normalizes Tally date formats (e.g. '20260601', '01-Jun-2026', '2026-06-01')
        into canonical ISO 'YYYY-MM-DD'.
        """
        if not raw_date_str:
            return ""
        raw_clean = raw_date_str.strip()
        
        # 1. Standard YYYY-MM-DD
        if re.match(r"^\d{4}-\d{2}-\d{2}$", raw_clean):
            return raw_clean

        # 2. Tally compact YYYYMMDD
        if re.match(r"^\d{8}$", raw_clean):
            try:
                dt = datetime.strptime(raw_clean, "%Y%m%d")
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                pass

        # 3. Tally DD-Mon-YYYY (e.g. 01-Jun-2026)
        if re.match(r"^\d{1,2}-[A-Za-z]{3}-\d{4}$", raw_clean):
            try:
                dt = datetime.strptime(raw_clean, "%d-%b-%Y")
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                pass

        # 4. DD/MM/YYYY
        if re.match(r"^\d{1,2}/\d{1,2}/\d{4}$", raw_clean):
            try:
                dt = datetime.strptime(raw_clean, "%d/%m/%Y")
                return dt.strftime("%Y-%m-%d")
            except ValueError:
                pass

        return raw_clean

    @classmethod
    def sanitize_ledger_name(cls, name: str) -> str:
        """Sanitizes party/ledger name, preserving Unicode & special characters safely."""
        if not name:
            return "Unknown Party"
        # Strip redundant trailing whitespace but preserve inner spacing and unicode
        return re.sub(r"\s+", " ", name.strip())

    @classmethod
    def parse_tally_xml_to_canonical_sales(cls, xml_content: str) -> List[Dict[str, Any]]:
        """
        Parses raw Tally XML export into Canonical Sales Invoices payload.
        Handles <ENVELOPE> -> <BODY> -> <DATA> -> <TALLYMESSAGE> -> <VOUCHER>.
        """
        vouchers: List[Dict[str, Any]] = []
        try:
            root = ET.fromstring(xml_content)
        except Exception as e:
            logger.error(f"Tally XML parse failure: {e}")
            raise ValueError(f"Malformed Tally XML: {str(e)}")

        # Find all VOUCHER nodes
        voucher_nodes = root.findall(".//VOUCHER")
        if not voucher_nodes:
            # Check TALLYMESSAGE children
            voucher_nodes = root.findall(".//TALLYMESSAGE/VOUCHER")

        for v_node in voucher_nodes:
            vch_type = v_node.get("VCHTYPE") or v_node.findtext("VOUCHERTYPENAME") or "Sales"
            vch_no = v_node.findtext("VOUCHERNUMBER") or v_node.findtext("REFERENCE") or ""
            vch_date_raw = v_node.findtext("DATE") or v_node.findtext("VOUCHERDATE") or ""
            party_name = v_node.findtext("PARTYLEDGERNAME") or v_node.findtext("BASICBUYERNAME") or ""
            party_gstin = v_node.findtext("PARTYGSTIN") or None
            
            canonical_date = cls.parse_tally_date(vch_date_raw)
            if not vch_no or not canonical_date:
                continue

            # Extract Inventory Entries / Line items
            items: List[Dict[str, Any]] = []
            inv_entries = v_node.findall(".//ALLINVENTORYENTRIES.LIST") or v_node.findall(".//INVENTORYENTRIES.LIST")
            total_voucher_amt = 0.0

            for it in inv_entries:
                stock_item_name = it.findtext("STOCKITEMNAME") or "Unknown Product"
                qty_text = it.findtext("ACTUALQTY") or it.findtext("BILLEDQTY") or "0"
                # Tally format: "10.00 PCS" or "100.00 NOS"
                qty_match = re.search(r"([\d\.\-]+)\s*([A-Za-z]*)", qty_text)
                qty = float(qty_match.group(1)) if qty_match else 0.0
                unit = qty_match.group(2).upper() if qty_match and qty_match.group(2) else "PCS"

                rate_text = it.findtext("RATE") or "0"
                rate_match = re.search(r"([\d\.\-]+)", rate_text)
                rate = float(rate_match.group(1)) if rate_match else 0.0

                amount_text = it.findtext("AMOUNT") or "0"
                # Tally amounts can be negative for credit
                amount = abs(float(amount_text)) if amount_text else (qty * rate)
                total_voucher_amt += amount

                items.append({
                    "item_name": cls.sanitize_ledger_name(stock_item_name),
                    "product_code": it.findtext("PRODUCTCODE") or None,
                    "quantity": abs(qty),
                    "unit": unit or "PCS",
                    "rate": abs(rate),
                    "amount": round(amount, 2),
                    "gst_rate": 18.0
                })

            if not items:
                # Fallback: create default line item if only ledger entry exists
                ledger_amt_text = v_node.findtext(".//ALLLEDGERENTRIES.LIST/AMOUNT") or "0"
                total_voucher_amt = abs(float(ledger_amt_text)) if ledger_amt_text else 0.0
                items.append({
                    "item_name": "General Sales Items",
                    "product_code": None,
                    "quantity": 1.0,
                    "unit": "PCS",
                    "rate": total_voucher_amt,
                    "amount": total_voucher_amt,
                    "gst_rate": 18.0
                })

            vouchers.append({
                "voucher_number": vch_no.strip(),
                "voucher_date": canonical_date,
                "customer_name": cls.sanitize_ledger_name(party_name),
                "customer_gstin": party_gstin,
                "salesman_name": v_node.findtext("SALESMANNAME") or "Unassigned / Unresolved",
                "city": v_node.findtext("CITY") or "Unknown",
                "state": v_node.findtext("STATE") or "Unknown",
                "total_amount": round(total_voucher_amt, 2),
                "items": items
            })

        return vouchers

    @classmethod
    def serialize_canonical_sales_to_tally_xml(
        cls,
        vouchers: List[Dict[str, Any]],
        company_name: str = "Nalka Metals Private Limited"
    ) -> str:
        """
        Serializes Canonical Sales records into Tally-compliant XML for Tally import/sync.
        """
        root = ET.Element("ENVELOPE")
        header = ET.SubElement(root, "HEADER")
        tally_req = ET.SubElement(header, "TALLYREQUEST")
        tally_req.text = "Import Data"

        body = ET.SubElement(root, "BODY")
        import_data = ET.SubElement(body, "IMPORTDATA")
        req_desc = ET.SubElement(import_data, "REQUESTDESC")
        report_name = ET.SubElement(req_desc, "REPORTNAME")
        report_name.text = "All Masters"
        
        static_vars = ET.SubElement(req_desc, "STATICVARIABLES")
        sv_company = ET.SubElement(static_vars, "SVCURRENTCOMPANY")
        sv_company.text = company_name

        req_data = ET.SubElement(import_data, "REQUESTDATA")

        for v in vouchers:
            msg = ET.SubElement(req_data, "TALLYMESSAGE")
            msg.set("xmlns:UDF", "TallyUDF")
            
            vch = ET.SubElement(msg, "VOUCHER")
            vch.set("VCHTYPE", "Sales")
            vch.set("ACTION", "Create")
            
            # Format date as YYYYMMDD for Tally
            raw_date = v.get("voucher_date", "2026-01-01")
            tally_date = raw_date.replace("-", "")
            
            ET.SubElement(vch, "DATE").text = tally_date
            ET.SubElement(vch, "VOUCHERTYPENAME").text = "Sales"
            ET.SubElement(vch, "VOUCHERNUMBER").text = str(v.get("voucher_number"))
            ET.SubElement(vch, "PARTYLEDGERNAME").text = str(v.get("customer_name"))
            ET.SubElement(vch, "BASICBUYERNAME").text = str(v.get("customer_name"))
            if v.get("customer_gstin"):
                ET.SubElement(vch, "PARTYGSTIN").text = str(v.get("customer_gstin"))

            # Ledger Entry for Party (Debit)
            party_ledger = ET.SubElement(vch, "ALLLEDGERENTRIES.LIST")
            ET.SubElement(party_ledger, "LEDGERNAME").text = str(v.get("customer_name"))
            ET.SubElement(party_ledger, "ISDEEMEDPOSITIVE").text = "Yes"
            ET.SubElement(party_ledger, "AMOUNT").text = f"-{float(v.get('total_amount', 0.0)):.2f}"

            # Inventory Entries
            for it in v.get("items", []):
                inv = ET.SubElement(vch, "ALLINVENTORYENTRIES.LIST")
                ET.SubElement(inv, "STOCKITEMNAME").text = str(it.get("item_name"))
                ET.SubElement(inv, "ISDEEMEDPOSITIVE").text = "No"
                ET.SubElement(inv, "RATE").text = f"{float(it.get('rate', 0.0)):.2f}/{it.get('unit', 'PCS')}"
                ET.SubElement(inv, "ACTUALQTY").text = f"{float(it.get('quantity', 0.0)):.2f} {it.get('unit', 'PCS')}"
                ET.SubElement(inv, "BILLEDQTY").text = f"{float(it.get('quantity', 0.0)):.2f} {it.get('unit', 'PCS')}"
                ET.SubElement(inv, "AMOUNT").text = f"{float(it.get('amount', 0.0)):.2f}"

                # Sales Ledger allocation
                sales_alloc = ET.SubElement(inv, "ACCOUNTINGALLOCATIONS.LIST")
                ET.SubElement(sales_alloc, "LEDGERNAME").text = "Sales Account"
                ET.SubElement(sales_alloc, "ISDEEMEDPOSITIVE").text = "No"
                ET.SubElement(sales_alloc, "AMOUNT").text = f"{float(it.get('amount', 0.0)):.2f}"

        return ET.tostring(root, encoding="utf-8", xml_declaration=True).decode("utf-8")


tally_adapter = TallyAdapter()
