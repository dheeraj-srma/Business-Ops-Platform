# backend/routers/webhook_router.py
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, Header
from auth import verify_webhook_signature

logger = logging.getLogger("webhook_router")
router = APIRouter(prefix="/api", tags=["Webhooks & Tally Operations"])

@router.post("/webhooks/tally")
async def tally_webhook(request: Request, x_signature: Optional[str] = Header(None, alias="X-Signature")):
    raw_body = await request.body()

    if not verify_webhook_signature(raw_body, x_signature):
        raise HTTPException(status_code=401, detail="Invalid cryptographic webhook signature.")

    logger.info("Tally webhook authenticated and verified successfully!")
    return {"status": "accepted", "verified": True}

@router.post("/webhooks/{source}")
async def generic_webhook(source: str, request: Request, x_signature: Optional[str] = Header(None, alias="X-Signature")):
    raw_body = await request.body()

    if not verify_webhook_signature(raw_body, x_signature):
        raise HTTPException(status_code=401, detail=f"Invalid webhook signature for {source}.")

    logger.info(f"Webhook from source '{source}' verified successfully!")
    return {"status": "accepted", "source": source, "verified": True}
