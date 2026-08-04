from pydantic import BaseModel, EmailStr, Field, ConfigDict
from uuid import UUID
from typing import Optional
from datetime import datetime

# Definir los datos básicos de un usuario
class UserBase(BaseModel):
    username: str = Field(..., min_length=4, max_length=50)
    email: EmailStr


# Validar los datos para crear un usuario
class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=100)
    role_id: int = Field(..., gt=0)


# Definir los datos que se devolverán del usuario
class UserResponse(UserBase):
    id: UUID
    is_active: bool
    role_id: int
    created_at: datetime  # No se necesita Optional porque siempre tendrá el valor de NOW()
    last_login: Optional[datetime] = None  # Puede ser None hasta que el usuario inicie sesión

    # Permitir convertir datos provenientes de la base de datos
    model_config = ConfigDict(from_attributes=True)


# Validar los datos para actualizar un usuario
class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=6, max_length=100)
    role_id: Optional[int] = Field(None, gt=0)
    is_active: Optional[bool] = None


# Validar los datos para el inicio de sesión
class UserLogin(UserBase):
    codigo_r: str = Field(..., min_length=6, max_length=6)
    password: str = Field(..., min_length=6, max_length=100)
    codigo_exp: Optional[str] = None