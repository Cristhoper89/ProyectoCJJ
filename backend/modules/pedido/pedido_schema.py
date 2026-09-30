from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class PedidoIngredienteResponse(BaseModel):
    id: int
    id_ingrediente: int
    nombre: str
    accion: Literal["agregar", "quitar"]


class PedidoItemResponse(BaseModel):
    id: int
    id_producto: int
    producto_nombre: str
    cantidad: int
    preparado: bool
    notas: str | None = None
    modificadores: list[PedidoIngredienteResponse]


class PedidoResponse(BaseModel):
    id_movimiento: int
    ubicacion: str
    fecha_creacion: datetime
    items: list[PedidoItemResponse]


class PedidoPreparadoUpdate(BaseModel):
    preparado: bool