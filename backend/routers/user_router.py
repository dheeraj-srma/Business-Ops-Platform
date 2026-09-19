# backend/routers/user_router.py
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from repositories.user_repo import user_repo
from auth import require_role

logger = logging.getLogger("user_router")
router = APIRouter(prefix="/api/users", tags=["User Management"])

@router.get("")
def list_users(
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: dict = Depends(require_role(["admin", "manager"]))
):
    try:
        users = user_repo.get_all_users(offset=offset, limit=limit)
        return {"users": users, "count": len(users)}
    except Exception as exc:
        logger.error(f"Error listing users: {exc}")
        raise HTTPException(status_code=500, detail="Failed to fetch user accounts.")
