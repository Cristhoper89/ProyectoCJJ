from decimal import Decimal
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class IngredienteCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)


class IngredienteResponse(BaseModel):
    id: int
    nombre: str

    model_config = ConfigDict(from_attributes=True)


class IngredienteUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)


class GastoCreate(BaseModel):
    id_ingrediente: Optional[int] = Field(None, gt=0)
    nombre: str = Field(..., min_length=1, max_length=100)
    descripcion: Optional[str] = Field(None, max_length=255)
    cantidad: Optional[Decimal] = Field(None, ge=0)
    valor: Optional[Decimal] = Field(None, ge=0)
    fecha: Optional[datetime] = None
    id_movimiento: Optional[int] = Field(None, gt=0)


class GastoResponse(GastoCreate):
    id: int

    model_config = ConfigDict(from_attributes=True)


class GastoUpdate(BaseModel):
    id_ingrediente: Optional[int] = Field(None, gt=0)
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    descripcion: Optional[str] = Field(None, max_length=255)
    cantidad: Optional[Decimal] = Field(None, ge=0)
    valor: Optional[Decimal] = Field(None, ge=0)
    fecha: Optional[datetime] = None
    id_movimiento: Optional[int] = Field(None, gt=0)