from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
from uuid import UUID

class MesaBase(BaseModel):
    estado: Optional[bool] = Field(None, description="Estado de la mesa (disponible/ocupada)")
    hora_inicio: Optional[datetime] = Field(None, description="Hora de inicio de la ocupación de la mesa")
    total: Optional[float] = Field(None, description="Total de la mesa")
    propina: Optional[float] = Field(None, description="Propinas acumuladas en la mesa")
    domicilio: Optional[float] = Field(None, description="Indica precio del domicilio")
    tipo: Optional[bool] = Field(None, description="MESA TRUE, BARRA FALSE")
    id_cliente: Optional[UUID] = Field(None, description="ID del cliente asignado a la mesa")
    id_mesero: Optional[UUID] = Field(None, description="ID del mesero asignado a la mesa")
    pago_efectivo: Optional[float] = Field(None, description="Monto pagado en efectivo")
    pago_tarjeta: Optional[float] = Field(None, description="Monto pagado con tarjeta")
    pago_transfe: Optional[float] = Field(None, description="Monto pagado por transferencia")

class MesaCreate(BaseModel):
    estado: bool = Field(..., description="Estado de la mesa (disponible/ocupada)")

class MesaResponse(MesaBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

class MesaUpdate(BaseModel):
    estado: Optional[bool] = Field(None, description="Estado de la mesa (disponible/ocupada)")
    hora_inicio: Optional[datetime] = Field(None, description="Hora de inicio de la ocupación de la mesa")
    total: Optional[float] = Field(None, description="Total de la mesa")
    propina: Optional[float] = Field(None, description="Propinas acumuladas en la mesa")
    domicilio: Optional[float] = Field(None, description="Indica precio del domicilio")
    tipo: Optional[bool] = Field(None, description="MESA TRUE, BARRA FALSE")
    id_cliente: Optional[UUID] = Field(None, description="ID del cliente asignado a la mesa")
    id_mesero: Optional[UUID] = Field(None, description="ID del mesero asignado a la mesa")
    pago_efectivo: Optional[float] = Field(None, description="Monto pagado en efectivo")
    pago_tarjeta: Optional[float] = Field(None, description="Monto pagado con tarjeta")
    pago_transfe: Optional[float] = Field(None, description="Monto pagado por transferencia")

class MesaChangeState(BaseModel):
    id: int
    estado: bool = Field(False, description="Nuevo estado de la mesa (disponible/ocupada)")

    model_config = ConfigDict(from_attributes=True)

class aplicarMesero(BaseModel):
    id: int
    id_mesero: UUID = Field(..., description="ID del mesero asignado a la mesa")

    model_config = ConfigDict(from_attributes=True)

class aplicarCliente(BaseModel):
    id: int
    id_cliente: UUID = Field(..., description="ID del cliente asignado a la mesa")

    model_config = ConfigDict(from_attributes=True)