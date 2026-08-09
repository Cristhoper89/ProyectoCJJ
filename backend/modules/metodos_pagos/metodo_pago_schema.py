from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from decimal import Decimal
from enum import Enum

class MetodoPagoEnum(str, Enum):
    efectivo = "Efectivo"
    transferencia = "Transferencia"
    tarjeta = "Tarjeta"

class MetodoPBase(BaseModel):
    movimiento_id: int = Field(..., description="ID del movimiento asociado")
    valor: Decimal = Field(..., description="Valor del pago")
    metodo: MetodoPagoEnum = Field(..., description="Método o tipo de pago")

class MetodoPCreate(MetodoPBase):
    pass

class MetodoPResponse(MetodoPBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

class MetodoPUpdate(BaseModel):
    movimiento_id: Optional[int] = Field(None, description="ID del movimiento asociado")
    valor: Optional[Decimal] = Field(None, description="Valor del pago")
    metodo: Optional[MetodoPagoEnum] = Field(None, description="Método o tipo de pago")