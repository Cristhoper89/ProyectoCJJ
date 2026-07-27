from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    username: str = Field(..., min_length=4, max_length=50)
    email: EmailStr

class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=100)
    role_id: int = Field(..., gt=0)

class UserResponse(UserBase):
    id: int
    is_active: bool
    role_id: int
    created_at: datetime #No se necesita Optional porque siempre tendra el valor de NOW() el cual lo llena cuando se crea
    last_login: Optional[datetime] = None # Si se necesita Optional porque el espacio empieza vacio ya que el usuario aun no ha hecho login

    model_config = ConfigDict(from_attributes=True)

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=6, max_length=100)
    role_id: Optional[int] = Field(None, gt=0)
    is_active: Optional[bool] = None

class UserLogin(UserBase):
    codigo_r: str = Field(..., min_length=6, max_length=6)
    password: str = Field(..., min_length=6, max_length=100)
    codigo_exp: Optional[str] = None
