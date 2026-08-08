from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from decimal import Decimal
from enum import Enum

# Definimos el Enum que coincide exactamente con los valores de PostgreSQL
class TipoPagoEnum(str, Enum):
    efectivo = "Efectivo"
    transferencia = "Transferencia"
    tarjeta = "Tarjeta"
    mixto = "Mixto"

class MovimientoBase(BaseModel):
    tipo: bool = Field(..., description="Tipo de movimiento (True para ingreso, False para egreso)")
    descripcion: str = Field(..., description="Descripción del movimiento")
    estado: bool = Field(..., description="Estado del movimiento")
    propina: Decimal = Field(..., description="Valor de la propina")
    domicilio: Decimal = Field(..., description="Valor del domicilio")
    total: Decimal = Field(..., description="Valor total")
    id_caja: int = Field(..., description="ID de la caja asociada")
    metodo: TipoPagoEnum = Field(..., description="Método o tipo de pago")  # <-- Aquí usas el Enum

class MovimientoCreate(MovimientoBase):
    pass

class MovimientoResponse(MovimientoBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

class MovimientoUpdate(BaseModel):
    tipo: Optional[bool] = Field(None, description="Tipo de movimiento")
    descripcion: Optional[str] = Field(None, description="Descripción del movimiento")
    estado: Optional[bool] = Field(None, description="Estado del movimiento")
    propina: Optional[Decimal] = Field(None, description="Valor de la propina")
    domicilio: Optional[Decimal] = Field(None, description="Valor del domicilio")
    total: Optional[Decimal] = Field(None, description="Valor total")
    id_caja: Optional[int] = Field(None, description="ID de la caja asociada")
    metodo: Optional[TipoPagoEnum] = Field(None, description="Método o tipo de pago")