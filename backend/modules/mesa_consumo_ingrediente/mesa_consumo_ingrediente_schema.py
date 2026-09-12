from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class MesaConsumoIngredienteCreate(BaseModel):
    id_mesa_consumo: int = Field(..., gt=0)
    id_ingrediente: int = Field(..., gt=0)
    accion: str = Field(..., min_length=1, max_length=20)


class MesaConsumoIngredienteResponse(MesaConsumoIngredienteCreate):
    id: int

    model_config = ConfigDict(from_attributes=True)


class MesaConsumoIngredienteUpdate(BaseModel):
    id_mesa_consumo: Optional[int] = Field(None, gt=0)
    id_ingrediente: Optional[int] = Field(None, gt=0)
    accion: Optional[str] = Field(None, min_length=1, max_length=20)