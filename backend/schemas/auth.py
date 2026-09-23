# backend/schemas/auth.py
from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class LoginRequestSchema(BaseModel):
    email: str = Field(..., description="User email address or login username")
    password: str = Field(..., min_length=1, description="Account password")
    remember_me: bool = Field(False, description="Whether to create a persistent session")

class UserProfileSchema(BaseModel):
    id: str
    email: str
    role: str
    full_name: str
    salesman_id: Optional[str] = None

class TokenResponseSchema(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfileSchema
