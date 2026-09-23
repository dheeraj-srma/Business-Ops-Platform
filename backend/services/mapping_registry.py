# backend/services/mapping_registry.py
"""
Central Mapping Registry Service.
Resolves external accounting identities (Tally customer names, item codes, salesman names)
to internal operational IDs.
Strict Zero Silent Fuzzy-Matching Rule:
- Exact approved mapping -> RESOLVED
- Ambiguous / fuzzy similarity -> AMBIGUOUS_MAPPING (surfaces candidates for manager approval, never silently commits)
- Unknown -> UNRESOLVED_REFERENCE (quarantined)
"""

import uuid
import logging
from typing import Dict, Any, List, Optional, Tuple
from difflib import SequenceMatcher
from datetime import datetime, timezone

from repositories.mapping_repo import mapping_repo
from config.database import get_db_client

logger = logging.getLogger("mapping_registry")


class MappingRegistryService:

    @staticmethod
    def calculate_similarity(a: str, b: str) -> float:
        """Calculates normalized string similarity ratio between 0.0 and 1.0."""
        if not a or not b:
            return 0.0
        return SequenceMatcher(None, a.strip().upper(), b.strip().upper()).ratio()

    @classmethod
    def resolve_customer(
        cls,
        external_name: str,
        external_id: Optional[str] = None,
        external_system: str = "TALLY",
        known_customers: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Resolves an external customer name/code.
        Returns:
            {
                "status": "APPROVED" | "AMBIGUOUS" | "UNRESOLVED",
                "internal_id": str | None,
                "internal_name": str | None,
                "confidence": float,
                "candidates": List[Dict[str, Any]],
                "requires_approval": bool
            }
        """
        clean_name = external_name.strip()
        lookup_id = (external_id or clean_name).strip()

        # 1. Check explicit mapping registry
        existing_mapping = mapping_repo.find_mapping(external_system, "CUSTOMER", lookup_id)
        if not existing_mapping:
            existing_mapping = mapping_repo.find_mapping_by_name(external_system, "CUSTOMER", clean_name)

        if existing_mapping:
            if existing_mapping["mapping_status"] == "APPROVED":
                return {
                    "status": "APPROVED",
                    "internal_id": existing_mapping.get("internal_entity_id"),
                    "internal_name": existing_mapping.get("internal_entity_name") or clean_name,
                    "confidence": float(existing_mapping.get("confidence", 1.0)),
                    "candidates": [],
                    "requires_approval": False
                }
            elif existing_mapping["mapping_status"] == "REJECTED":
                return {
                    "status": "REJECTED",
                    "internal_id": None,
                    "internal_name": None,
                    "confidence": 0.0,
                    "candidates": [],
                    "requires_approval": True,
                    "error": f"Customer '{clean_name}' was previously rejected by manager."
                }

        # 2. Check exact match in internal reference database
        customers_cache = known_customers or {}
        if clean_name.upper() in customers_cache:
            matched_name = customers_cache[clean_name.upper()]
            return {
                "status": "APPROVED",
                "internal_id": matched_name if isinstance(matched_name, str) else matched_name.get("id"),
                "internal_name": clean_name,
                "confidence": 1.0,
                "candidates": [],
                "requires_approval": False
            }

        # 3. Candidate search for fuzzy matches (NEVER SILENTLY APPLY)
        candidates: List[Dict[str, Any]] = []
        for known_upper, known_val in customers_cache.items():
            sim = cls.calculate_similarity(clean_name, known_upper)
            if sim >= 0.70:  # Threshold for human review
                name_str = known_val if isinstance(known_val, str) else known_val.get("name", known_upper)
                candidates.append({
                    "internal_id": known_val if isinstance(known_val, str) else known_val.get("id"),
                    "internal_name": name_str,
                    "similarity": round(sim, 3),
                    "reason": f"Fuzzy string match ({int(sim * 100)}% match with '{name_str}')"
                })

        candidates.sort(key=lambda x: x["similarity"], reverse=True)

        if candidates:
            return {
                "status": "AMBIGUOUS",
                "internal_id": None,
                "internal_name": None,
                "confidence": candidates[0]["similarity"],
                "candidates": candidates[:5],
                "requires_approval": True,
                "problem": f"Customer '{clean_name}' matches multiple internal records closely. Explicit manager selection required."
            }

        return {
            "status": "UNRESOLVED",
            "internal_id": None,
            "internal_name": None,
            "confidence": 0.0,
            "candidates": [],
            "requires_approval": True,
            "problem": f"Unknown external customer '{clean_name}' with no approved mapping."
        }

    @classmethod
    def resolve_product_sku(
        cls,
        external_name: str,
        external_code: Optional[str] = None,
        external_system: str = "TALLY",
        known_skus: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Resolves an external item/product code or name against internal catalog.
        """
        clean_name = external_name.strip()
        lookup_code = (external_code or clean_name).strip().upper()

        # 1. Check mapping registry
        existing_mapping = mapping_repo.find_mapping(external_system, "PRODUCT_SKU", lookup_code)
        if not existing_mapping and external_name:
            existing_mapping = mapping_repo.find_mapping_by_name(external_system, "PRODUCT_SKU", clean_name)

        if existing_mapping and existing_mapping["mapping_status"] == "APPROVED":
            return {
                "status": "APPROVED",
                "internal_id": existing_mapping.get("internal_entity_id"),
                "internal_name": existing_mapping.get("internal_entity_name") or clean_name,
                "confidence": float(existing_mapping.get("confidence", 1.0)),
                "candidates": [],
                "requires_approval": False
            }

        # 2. Check exact match in internal catalog
        skus_cache = known_skus or {}
        if lookup_code in skus_cache:
            matched = skus_cache[lookup_code]
            return {
                "status": "APPROVED",
                "internal_id": lookup_code,
                "internal_name": matched if isinstance(matched, str) else matched.get("name", clean_name),
                "confidence": 1.0,
                "candidates": [],
                "requires_approval": False
            }

        # Check exact name in internal catalog
        for k_sku, k_name in skus_cache.items():
            k_name_str = k_name if isinstance(k_name, str) else k_name.get("name", "")
            if k_name_str.strip().upper() == clean_name.upper():
                return {
                    "status": "APPROVED",
                    "internal_id": k_sku,
                    "internal_name": k_name_str,
                    "confidence": 1.0,
                    "candidates": [],
                    "requires_approval": False
                }

        # 3. Candidate similarity search (FOR REVIEW ONLY - NEVER SILENTLY APPLIED)
        candidates: List[Dict[str, Any]] = []
        for k_sku, k_name in skus_cache.items():
            k_name_str = k_name if isinstance(k_name, str) else k_name.get("name", k_sku)
            sim = cls.calculate_similarity(clean_name, k_name_str)
            if sim >= 0.70:
                candidates.append({
                    "internal_id": k_sku,
                    "internal_name": k_name_str,
                    "similarity": round(sim, 3),
                    "reason": f"Catalog product similarity ({int(sim * 100)}%)"
                })

        candidates.sort(key=lambda x: x["similarity"], reverse=True)

        if candidates:
            return {
                "status": "AMBIGUOUS",
                "internal_id": None,
                "internal_name": None,
                "confidence": candidates[0]["similarity"],
                "candidates": candidates[:5],
                "requires_approval": True,
                "problem": f"Product '{clean_name}' has similar existing catalog items. Manager approval required."
            }

        return {
            "status": "UNRESOLVED",
            "internal_id": None,
            "internal_name": None,
            "confidence": 0.0,
            "candidates": [],
            "requires_approval": True,
            "problem": f"Unknown product code/name '{clean_name}' with no internal catalog match."
        }

    @classmethod
    def approve_mapping(
        cls,
        external_system: str,
        entity_type: str,
        external_id: str,
        external_name: str,
        internal_entity_id: str,
        internal_entity_name: str,
        operator_email: str = "manager@nalkametals.com"
    ) -> Dict[str, Any]:
        """
        Creates or approves a verified mapping record.
        """
        mapping_data = {
            "id": f"MAP-{str(uuid.uuid4())[:8].upper()}",
            "external_system": external_system,
            "entity_type": entity_type,
            "external_id": external_id.strip(),
            "external_name": external_name.strip(),
            "internal_entity_id": internal_entity_id.strip(),
            "internal_entity_name": internal_entity_name.strip(),
            "mapping_status": "APPROVED",
            "confidence": 1.0,
            "notes": f"Approved by {operator_email}",
            "created_by": operator_email,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_verified_at": datetime.now(timezone.utc).isoformat()
        }
        return mapping_repo.save_mapping(mapping_data)


mapping_registry = MappingRegistryService()
