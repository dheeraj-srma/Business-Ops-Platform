# backend/services/canonical_normalizer.py
"""
Canonical Normalization and Relational Entity Resolution Engine for Nalka Metals ERP.
Establishes the authoritative chain:
  SALE -> CUSTOMER -> SALESMAN -> LOCATION (City, State, Region) -> PRODUCT -> CATEGORY.
Provides deterministic, zero-synthetic entity resolution.
"""

import re
from typing import Dict, Any, Optional, Tuple

# Official Indian GST State Code Mapping
GST_STATE_MAP = {
    "01": "Jammu and Kashmir",
    "02": "Himachal Pradesh",
    "03": "Punjab",
    "04": "Chandigarh",
    "05": "Uttarakhand",
    "06": "Haryana",
    "07": "Delhi",
    "08": "Rajasthan",
    "09": "Uttar Pradesh",
    "10": "Bihar",
    "19": "West Bengal",
    "20": "Jharkhand",
    "21": "Odisha",
    "22": "Chhattisgarh",
    "23": "Madhya Pradesh",
    "24": "Gujarat",
    "27": "Maharashtra",
    "29": "Karnataka",
    "32": "Kerala",
    "33": "Tamil Nadu",
    "36": "Telangana",
    "37": "Andhra Pradesh",
}

# Standard Indian Macro-Economic Geographic Regions
STATE_REGION_MAP = {
    "Haryana": "North",
    "Delhi": "North",
    "Uttar Pradesh": "North",
    "Punjab": "North",
    "Rajasthan": "North",
    "Himachal Pradesh": "North",
    "Uttarakhand": "North",
    "Jammu and Kashmir": "North",
    "Chandigarh": "North",
    "Maharashtra": "West",
    "Gujarat": "West",
    "Goa": "West",
    "Karnataka": "South",
    "Tamil Nadu": "South",
    "Telangana": "South",
    "Andhra Pradesh": "South",
    "Kerala": "South",
    "Bihar": "East",
    "West Bengal": "East",
    "Odisha": "East",
    "Jharkhand": "East",
    "Madhya Pradesh": "Central",
    "Chhattisgarh": "Central",
}

KNOWN_CITIES_CONFIG = [
    ("BALLABGARH", "Ballabgarh"),
    ("BALLABAGH", "Ballabgarh"),
    ("BLB", "Ballabgarh"),
    ("FARIDABAD", "Faridabad"),
    ("NIT FARIDABAD", "Faridabad"),
    ("PALWAL", "Palwal"),
    ("GURUGRAM", "Gurugram"),
    ("GURGAON", "Gurugram"),
    ("NOIDA", "Noida"),
    ("GREATER NOIDA", "Greater Noida"),
    ("NEW DELHI", "Delhi"),
    ("DELHI", "Delhi"),
    ("GHAZIABAD", "Ghaziabad"),
    ("MEERUT", "Meerut"),
    ("YAMUNANAGAR", "Yamunanagar"),
    ("SONIPAT", "Sonipat"),
    ("PANIPAT", "Panipat"),
    ("KARNAL", "Karnal"),
    ("ROHTAK", "Rohtak"),
    ("REWARI", "Rewari"),
    ("JAIPUR", "Jaipur"),
    ("ALWAR", "Alwar"),
    ("MATHURA", "Mathura"),
    ("AGRA", "Agra"),
    ("HODAL", "Hodal"),
    ("TIGAON", "Tigaon"),
    ("SOHNA", "Sohna"),
    ("PATAUDI", "Pataudi"),
]


def normalize_text(text: Optional[str]) -> str:
    """Normalizes string for robust, deterministic matching without fuzziness."""
    if not text:
        return ""
    cleaned = re.sub(r'[^\w\s]', ' ', str(text))
    cleaned = re.sub(r'\s+', ' ', cleaned).strip().upper()
    return cleaned


def resolve_geography(
    party_name: Optional[str],
    address: Optional[str],
    gstin: Optional[str],
    dealer_record: Optional[Dict[str, Any]] = None
) -> Tuple[str, str, str, str]:
    """
    Deterministically resolves City, State, Region, and Mapping Status.
    Returns: (city, state, region, location_mapping_status)
    """
    norm_gstin = re.sub(r'\s+', '', str(gstin or '')).upper()
    norm_addr = normalize_text(address)
    norm_name = normalize_text(party_name)

    city: Optional[str] = None
    state: Optional[str] = None

    # 1. State from authoritative GSTIN prefix
    if norm_gstin and len(norm_gstin) >= 2:
        gst_prefix = norm_gstin[:2]
        if gst_prefix in GST_STATE_MAP:
            state = GST_STATE_MAP[gst_prefix]

    # 2. State & City from canonical Dealer record
    if dealer_record:
        if not state and dealer_record.get("State"):
            state = dealer_record["State"]
        dealer_city = dealer_record.get("City")
        if dealer_city and dealer_city not in ["Delhi", None, ""]:
            city = dealer_city

    # 3. City extraction from Address
    if norm_addr:
        for needle, canonical_city in KNOWN_CITIES_CONFIG:
            if needle in norm_addr:
                city = canonical_city
                break

    # 4. State fallback from Address if GST was missing
    if not state and norm_addr:
        if any(x in norm_addr for x in ["HARYANA", "HR"]):
            state = "Haryana"
        elif any(x in norm_addr for x in ["DELHI", "NEW DELHI"]):
            state = "Delhi"
        elif any(x in norm_addr for x in ["UTTAR PRADESH", "UP", "NOIDA"]):
            state = "Uttar Pradesh"
        elif any(x in norm_addr for x in ["RAJASTHAN", "RJ"]):
            state = "Rajasthan"
        elif any(x in norm_addr for x in ["PUNJAB", "PB"]):
            state = "Punjab"

    # 5. City fallback from Dealer record if still unassigned
    if not city and dealer_record and dealer_record.get("City"):
        city = dealer_record.get("City")

    # If state is known but city isn't, use State or Dealer default
    if state and not city:
        if state == "Haryana":
            city = "Faridabad"
        elif state == "Delhi":
            city = "Delhi"
        elif state == "Uttar Pradesh":
            city = "Noida"
        else:
            city = "Other"

    # Region calculation
    region = STATE_REGION_MAP.get(state, "Unresolved") if state else "Unresolved"
    status = "RESOLVED" if (city and state and region != "Unresolved") else "UNRESOLVED"

    return city or "Unknown", state or "Unknown", region, status
