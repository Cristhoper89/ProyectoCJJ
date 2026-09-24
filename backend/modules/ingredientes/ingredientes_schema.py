from decimal import Decimal
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class IngredienteCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)


class IngredienteResponse(BaseModel):
    id: int
    nombre: str
    estado: bool

    model_config = ConfigDict(from_attributes=True)


class IngredienteUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)


class IngredienteEstadoUpdate(BaseModel):
    estado: bool


class GastoCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    descripcion: Optional[str] = Field(None, max_length=255)
    valor: Optional[Decimal] = Field(None, ge=0)
    fecha_hora: Optional[datetime] = None
    categoria: Optional[int] = Field(None, gt=0)
    id_caja: Optional[int] = Field(None, gt=0)


class GastoResponse(GastoCreate):
    id: int
    categoria_nombre: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class GastoUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)
    descripcion: Optional[str] = Field(None, max_length=255)
    valor: Optional[Decimal] = Field(None, ge=0)
    fecha_hora: Optional[datetime] = None
    categoria: Optional[int] = Field(None, gt=0)
    id_caja: Optional[int] = Field(None, gt=0)