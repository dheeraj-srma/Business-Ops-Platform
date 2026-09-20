# backend/main.py
"""
FastAPI Centralized Backend Application for Nalka Metals BI, Order, and Stock Platform.

Established PostgreSQL / Supabase as authoritative source of truth,
centralizing authentication, role-based authorization, inventory logic,
order workflows, transaction integrity, audit logging, system settings,
and Central Admin Panel control.
"""

import os
import time
import uuid
import logging
from datetime import datetime
from typing import Dict
from fastapi import FastAPI, Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from config.settings import settings
from config.database import get_db_client

from routers import (
    auth_router,
    product_router,
    inventory_router,
    order_router,
    customer_router,
    supplier_router,
    dealer_router,
    dashboard_router,
    user_router,
    admin_router,
    transaction_router,
    analytics_router,
    webhook_router,
    tally_router,
    salesman_router,
    geography_router,
    settings_router,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("nalka_metals")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Centralized Application & Data Access Layer for Nalka Metals Platform.",
    version=settings.VERSION
)

# ─── CORS Middleware ────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Correlation ID & Rate Limiting Middleware ──────────────────────────────
CLIENT_REQUEST_LOG: Dict[str, list] = {}
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX_REQUESTS = 240  # requests per minute per IP

@app.middleware("http")
async def observability_and_rate_limit_middleware(request: Request, call_next):
    correlation_id = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
    request.state.correlation_id = correlation_id

    client_ip = request.client.host if request.client else "127.0.0.1"
    now = time.time()
    
    timestamps = CLIENT_REQUEST_LOG.get(client_ip, [])
    timestamps = [ts for ts in timestamps if now - ts < RATE_LIMIT_WINDOW]
    CLIENT_REQUEST_LOG[client_ip] = timestamps

    if len(timestamps) >= RATE_LIMIT_MAX_REQUESTS:
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "error": "TOO_MANY_REQUESTS",
                "message": "Rate limit exceeded. Please wait before retrying.",
                "correlation_id": correlation_id
            },
            headers={"X-Correlation-ID": correlation_id}
        )

    timestamps.append(now)

    start_time = time.time()
    response: Response = await call_next(request)
    duration_ms = round((time.time() - start_time) * 1000, 2)

    response.headers["X-Correlation-ID"] = correlation_id
    response.headers["X-Response-Time-MS"] = str(duration_ms)
    return response

# ─── Central Exception Handlers ──────────────────────────────────────────────
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    correlation_id = getattr(request.state, "correlation_id", str(uuid.uuid4()))
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": "HTTP_EXCEPTION",
            "message": exc.detail,
            "correlation_id": correlation_id,
            "timestamp": datetime.utcnow().isoformat()
        },
        headers={"X-Correlation-ID": correlation_id}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    correlation_id = getattr(request.state, "correlation_id", str(uuid.uuid4()))
    logger.error(f"[CorrID: {correlation_id}] Unhandled server exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "INTERNAL_SERVER_ERROR",
            "message": str(exc),
            "correlation_id": correlation_id,
            "timestamp": datetime.utcnow().isoformat()
        },
        headers={"X-Correlation-ID": correlation_id}
    )

# ─── Mount Modular APIRouters ────────────────────────────────────────────────
app.include_router(auth_router.router)
app.include_router(product_router.router)
app.include_router(inventory_router.router)
app.include_router(order_router.router)
app.include_router(customer_router.router)
app.include_router(supplier_router.router)
app.include_router(dealer_router.router)
app.include_router(dashboard_router.router)
app.include_router(user_router.router)
app.include_router(admin_router.router)
app.include_router(transaction_router.router)
app.include_router(analytics_router.router)
app.include_router(webhook_router.router)
app.include_router(tally_router.router)
app.include_router(salesman_router.router)
app.include_router(geography_router.router)
app.include_router(settings_router.router)

# ─── Health & Database Readiness Endpoints ────────────────────────────────────
@app.get("/health", tags=["Observability"])
@app.get("/healthz", tags=["Observability"])
@app.get("/api/health", tags=["Observability"])
def liveness():
    return {
        "status": "healthy",
        "service": "nalka-metals-api",
        "architecture": "Service/Repository/Router (Centralized & Admin Control Plane)",
        "timestamp": datetime.utcnow().isoformat(),
    }

@app.get("/readyz", tags=["Observability"])
@app.get("/api/health/database", tags=["Observability"])
def database_health():
    client = get_db_client(raise_on_missing=False)
    connected = False
    error_msg = None

    if client:
        try:
            # Probe live database connection by selecting 1 row from system_settings
            res = client.table("system_settings").select("id").limit(1).execute()
            connected = res is not None
        except Exception as exc:
            connected = False
            error_msg = str(exc)

    return {
        "status": "ready" if connected else "degraded",
        "database": {
            "connected": connected,
            "error": error_msg
        },
        "timestamp": datetime.utcnow().isoformat(),
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
