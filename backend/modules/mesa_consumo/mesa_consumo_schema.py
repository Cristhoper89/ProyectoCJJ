from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, time

class MesaCBase(BaseModel):
    id_producto: Optional[int] = Field(None, description="ID del producto asociado a la mesa")
    id_mesa: Optional[int] = Field(None, description="ID de la mesa")
    cantidad: Optional[int] = Field(None, description="Cantidad de productos asociados a la mesa")
    preparado: Optional[bool] = Field(None, description="Indica si el producto está preparado")
    hora: Optional[time] = Field(None, description="Hora del registro de consumo")

class MesaCreate(MesaCBase):
    pass

class MesaResponse(MesaCBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

class MesaUpdate(BaseModel):
    id_producto: Optional[int] = Field(None, description="ID del producto asociado a la mesa")
    id_mov: Optional[int] = Field(None, description="ID del movimiento asociado a la mesa")
    id_mesa: Optional[int] = Field(None, description="ID de la mesa")
    cantidad: Optional[int] = Field(None, description="Cantidad de productos asociados a la mesa")
    precio_unitario: Optional[float] = Field(None, description="Precio unitario del producto asociado a la mesa")
    subtotal: Optional[float] = Field(None, description="Subtotal del producto asociado a la mesa")
    preparado: Optional[bool] = Field(None, description="Indica si el producto está preparado")
    hora: Optional[time] = Field(None, description="Hora del registro de consumo")

class PreparadoUpdate(BaseModel):
    preparado: Optional[bool] = Field(None, description="Indica si el producto está preparado")