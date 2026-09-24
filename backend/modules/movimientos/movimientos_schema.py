from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from decimal import Decimal
from enum import Enum
from datetime import datetime
from uuid import UUID

# Definimos el Enum que coincide exactamente con los valores de PostgreSQL
class TipoPagoEnum(str, Enum):
    efectivo = "Efectivo"
    transferencia = "Transferencia"
    tarjeta = "Tarjeta"
    mixto = "Mixto"

class MovimientoBase(BaseModel):
    estado: bool = Field(..., description="Estado del movimiento")
    propina: Decimal = Field(..., description="Valor de la propina")
    domicilio: Decimal = Field(..., description="Valor del domicilio")
    total: Decimal = Field(..., description="Valor total")
    id_caja: int = Field(..., description="ID de la caja asociada")
    metodo: TipoPagoEnum = Field(..., description="Método o tipo de pago")
    id_cliente: Optional[UUID] = Field(None, description="ID del cliente asociado")
    id_mesero: Optional[UUID] = Field(None, description="ID del mesero asociado")
    fecha_hora: Optional[datetime] = Field(None, description="Fecha y hora del movimiento")

class MovimientoCreate(MovimientoBase):
    id_caja: Optional[int] = Field(None, gt=0, description="ID de la caja asociada")
    id_mesa: Optional[int] = Field(None, gt=0, description="ID de la barra asociada")

class MovimientoResponse(MovimientoBase):
    id: int
    id_mesa: Optional[int] = Field(None, gt=0, description="ID de la barra asociada")

    model_config = ConfigDict(from_attributes=True)

class MovimientoUpdate(BaseModel):
    estado: Optional[bool] = Field(None, description="Estado del movimiento")
    propina: Optional[Decimal] = Field(None, description="Valor de la propina")
    domicilio: Optional[Decimal] = Field(None, description="Valor del domicilio")
    total: Optional[Decimal] = Field(None, description="Valor total")
    id_caja: Optional[int] = Field(None, description="ID de la caja asociada")
    metodo: Optional[TipoPagoEnum] = Field(None, description="Método o tipo de pago")
    id_cliente: Optional[UUID] = Field(None, description="ID del cliente asociado")
    id_mesero: Optional[UUID] = Field(None, description="ID del mesero asociado")
    fecha_hora: Optional[datetime] = Field(None, description="Fecha y hora del movimiento")