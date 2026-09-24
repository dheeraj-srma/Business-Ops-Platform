# backend/services/realtime_bus.py
"""
Lightweight in-process Server-Sent Events (SSE) broadcast bus.

Operational routers (orders, inventory) call `notify(scope)` after any
successful write mutation.  The analytics SSE endpoint subscribes every
connected Management client and fans out the signal so the frontend can
trigger an authoritative re-fetch without polling.

No Supabase Realtime or service-role credentials are exposed to the browser.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Set, Literal

logger = logging.getLogger("realtime_bus")

AnalyticsScope = Literal["orders", "inventory", "returns", "inwards", "all"]

# Registered queues – one per connected SSE client
_subscribers: Set[asyncio.Queue] = set()


def subscribe() -> asyncio.Queue:
    """Register a new SSE subscriber and return its private queue."""
    q: asyncio.Queue = asyncio.Queue(maxsize=50)
    _subscribers.add(q)
    logger.debug("SSE subscriber added (total=%d)", len(_subscribers))
    return q


def unsubscribe(q: asyncio.Queue) -> None:
    """Deregister a subscriber when the SSE connection closes."""
    _subscribers.discard(q)
    logger.debug("SSE subscriber removed (total=%d)", len(_subscribers))


def notify(scope: AnalyticsScope = "all") -> None:
    """
    Broadcast an analytics invalidation signal to all connected SSE clients.

    This function is sync-safe – it is called from synchronous FastAPI route
    handlers.  It places the event on each subscriber's queue without awaiting.
    """
    payload = json.dumps({
        "scope": scope,
        "ts": datetime.now(timezone.utc).isoformat(),
    })
    dead: Set[asyncio.Queue] = set()
    for q in list(_subscribers):
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            # Slow client – drop oldest entry, push new one
            try:
                q.get_nowait()
                q.put_nowait(payload)
            except Exception:
                dead.add(q)
        except Exception:
            dead.add(q)
    for q in dead:
        _subscribers.discard(q)
