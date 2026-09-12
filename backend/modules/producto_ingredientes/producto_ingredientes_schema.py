from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ProductoIngredienteCreate(BaseModel):
    id_producto: int = Field(..., gt=0)
    id_ingrediente: int = Field(..., gt=0)


class ProductoIngredienteResponse(ProductoIngredienteCreate):
    id: int

    model_config = ConfigDict(from_attributes=True)


class ProductoIngredienteUpdate(BaseModel):
    id_producto: Optional[int] = Field(None, gt=0)
    id_ingrediente: Optional[int] = Field(None, gt=0)