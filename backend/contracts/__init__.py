# backend/contracts/__init__.py
from .data_exchange_contracts import (
    CONTRACTS,
    CURRENT_SCHEMA_VERSION,
    SUPPORTED_SCHEMA_VERSIONS,
    get_contract,
    list_contracts,
    generate_blank_template,
    generate_sample_payload,
    generate_accountant_spec,
)
