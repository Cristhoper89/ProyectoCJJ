from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from uuid import UUID

class EmpresaBase(BaseModel):
    nombre: str = Field(..., description="Nombre de la empresa")
    direccion: str = Field(..., description="Dirección de la empresa")
    telefono: str = Field(..., description="Teléfono de la empresa")
    NIT: str = Field(..., description="NIT de la empresa")
    correo: str = Field(..., description="Correo electrónico de la empresa")

class EmpresaCreate(EmpresaBase):
    pass

class EmpresaResponse(EmpresaBase):
    id: UUID

    model_config = ConfigDict(from_attributes=True)

class EmpresaUpdate(BaseModel):
    nombre: Optional[str] = Field(None, description="Nombre de la empresa")
    direccion: Optional[str] = Field(None, description="Dirección de la empresa")
    telefono: Optional[str] = Field(None, description="Teléfono de la empresa")
    NIT: Optional[str] = Field(None, description="NIT de la empresa")
    correo: Optional[str] = Field(None, description="Correo electrónico de la empresa")