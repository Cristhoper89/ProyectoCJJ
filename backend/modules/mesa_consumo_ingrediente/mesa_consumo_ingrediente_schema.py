from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

AccionIngrediente = Literal["agregar", "quitar", "mantener"]


class MesaConsumoIngredienteCreate(BaseModel):
    id_mesa_consumo: int = Field(..., gt=0)
    id_ingrediente: int = Field(..., gt=0)
    accion: AccionIngrediente


class MesaConsumoIngredienteResponse(MesaConsumoIngredienteCreate):
    id: int
    accion: str

    model_config = ConfigDict(from_attributes=True)


class MesaConsumoIngredienteUpdate(BaseModel):
    id_mesa_consumo: Optional[int] = Field(None, gt=0)
    id_ingrediente: Optional[int] = Field(None, gt=0)
    accion: Optional[AccionIngrediente] = None