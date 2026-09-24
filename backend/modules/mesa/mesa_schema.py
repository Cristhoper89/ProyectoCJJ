from pydantic import BaseModel, Field, ConfigDict
from typing import Literal, Optional
from datetime import datetime

TipoMesa = Literal["barra", "mesa"]

class MesaBase(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100, description="Nombre visible de la mesa o barra")
    estado: Optional[bool] = Field(None, description="Estado de la mesa (disponible/ocupada)")
    hora_inicio: Optional[datetime] = Field(None, description="Hora de inicio de la ocupación de la mesa")
    tipo: Optional[TipoMesa] = Field(None, description="Tipo de mesa (barra/mesa)")
    id_mov: Optional[int] = Field(None, gt=0, description="ID del movimiento asociado")

class MesaCreate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    estado: bool = Field(..., description="Estado de la mesa (disponible/ocupada)")
    tipo: Optional[TipoMesa] = Field("mesa", description="Tipo de mesa (barra/mesa)")

class MesaResponse(MesaBase):
    id: int
    nombre: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class MesaUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    estado: Optional[bool] = Field(None, description="Estado de la mesa (disponible/ocupada)")
    hora_inicio: Optional[datetime] = Field(None, description="Hora de inicio de la ocupación de la mesa")
    tipo: Optional[TipoMesa] = Field(None, description="Tipo de mesa (barra/mesa)")
    id_mov: Optional[int] = Field(None, gt=0, description="ID del movimiento asociado")

    model_config = ConfigDict(from_attributes=True)

class MesaFinalize(BaseModel):
    propina: float = Field(0, ge=0)
    domicilio: float = Field(0, ge=0)
    total: float = Field(..., ge=0)
    metodo: str = Field("Efectivo")
    id_caja: Optional[int] = Field(None, gt=0)