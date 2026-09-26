from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from decimal import Decimal

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
    efectivo_contado: Optional[float] = Field(None, description="Efectivo contado al cierre")
    diferencia_caja: Optional[float] = Field(None, description="Diferencia entre efectivo contado y balance esperado")
    notas_cierre: Optional[str] = Field(None, description="Notas del cierre de caja")
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


class CajasCierreApertura(BaseModel):
    efectivo_contado: Decimal = Field(..., ge=0)
    balance_inicial: Decimal = Field(..., ge=0)
    notas_cierre: Optional[str] = Field(None, max_length=500)


class CajasCierreAperturaResponse(BaseModel):
    caja_cerrada: CajasResponse
    caja_nueva: CajasResponse
