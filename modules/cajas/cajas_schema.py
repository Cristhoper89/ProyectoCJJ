from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime

class CajasBase(BaseModel):
    fecha: Optional[datetime] = Field(None, description="Fecha de la caja")
    ingresos_efectivo: Optional[float] = Field(None, description="Ingreso en efectivo")
    ingresos_tarjeta: Optional[float] = Field(None, description="Ingreso con tarjeta")
    ingresos_transferencia: Optional[float] = Field(None, description="Ingreso por transferencia")
    egresos_efectivo: Optional[float] = Field(None, description="Egreso en efectivo")
    egresos_tarjeta: Optional[float] = Field(None, description="Egreso con tarjeta")
    egresos_transferencia: Optional[float] = Field(None, description="Egreso por transferencia")
    total_propinas: Optional[float] = Field(None, description="Total de propina")
    balance_inicial: Optional[float] = Field(None, description="Balance inicial de la caja")
    balance_final: Optional[float] = Field(None, description="Balance final de la caja")
    estado: Optional[str] = Field("abierta", description="Estado de la caja (abierta/cerrada)")
class CajasCreate(CajasBase):
    pass

class CajasResponse(CajasBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

class CajasUpdate(BaseModel):
    fecha: Optional[datetime] = Field(None, description="Fecha de la caja")
    ingresos_efectivo: Optional[float] = Field(None, description="Ingreso en efectivo")
    ingresos_tarjeta: Optional[float] = Field(None, description="Ingreso con tarjeta")
    ingresos_transferencia: Optional[float] = Field(None, description="Ingreso por transferencia")
    egresos_efectivo: Optional[float] = Field(None, description="Egreso en efectivo")
    egresos_tarjeta: Optional[float] = Field(None, description="Egreso con tarjeta")
    egresos_transferencia: Optional[float] = Field(None, description="Egreso por transferencia")
    total_propinas: Optional[float] = Field(None, description="Total de propina")
    balance_inicial: Optional[float] = Field(None, description="Balance inicial de la caja")
    balance_final: Optional[float] = Field(None, description="Balance final de la caja")

class CajasChangeState(BaseModel):
    id: int
    estado: str = Field("cerrada", description="Nuevo estado de la caja (abierta/cerrada)")

    model_config = ConfigDict(from_attributes=True)
