from pydantic import BaseModel, Field, ConfigDict
from typing import Optional

class ProveedorBase(BaseModel):
    nombre: str = Field(..., description="Nombre del proveedor")
    NIT: str = Field(..., description="NIT del proveedor")
    telefono: str = Field(..., description="Teléfono de contacto del proveedor")
    correo: str = Field(..., description="Correo electrónico del proveedor")

class ProveedorCreate(ProveedorBase):
    pass

class ProveedorResponse(ProveedorBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

class ProveedorUpdate(BaseModel):
    nombre: Optional[str] = Field(None, description="Nombre del proveedor")
    NIT: Optional[str] = Field(None, description="NIT del proveedor")
    telefono: Optional[str] = Field(None, description="Teléfono de contacto del proveedor")
    correo: Optional[str] = Field(None, description="Correo electrónico del proveedor")