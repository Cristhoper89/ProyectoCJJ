from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class GrupoOpcionCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)


class GrupoOpcionUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)


class OpcionCreate(BaseModel):
    id_grupo_opcion: int = Field(..., gt=0)
    nombre: str = Field(..., min_length=1, max_length=100)


class OpcionUpdate(BaseModel):
    id_grupo_opcion: Optional[int] = Field(None, gt=0)
    nombre: Optional[str] = Field(None, min_length=1, max_length=100)


class OpcionResponse(OpcionCreate):
    id: int

    model_config = ConfigDict(from_attributes=True)


class GrupoOpcionResponse(GrupoOpcionCreate):
    id: int
    opciones: list[OpcionResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ProductoGrupoOpcionCreate(BaseModel):
    id_producto: int = Field(..., gt=0)
    id_grupo_opcion: int = Field(..., gt=0)


class ProductoGrupoOpcionResponse(ProductoGrupoOpcionCreate):
    model_config = ConfigDict(from_attributes=True)
