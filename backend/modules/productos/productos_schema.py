from pydantic import BaseModel, Field, ConfigDict
from typing import Optional

class ProductoBase(BaseModel):
    nombre: Optional[str] = Field(None, min_length=3, max_length=50, description="Nombre del producto")
    descripcion: Optional[str] = Field(None, max_length=200)
    cantidad: Optional[int] = Field(None, gt=0)
    precio: Optional[float] = Field(None, gt=0)
    id_categoria: Optional[int] = Field(None, gt=0)
    preparacion: Optional[bool] = Field(False)
    estado: Optional[bool] = Field(True)

class ProductoCreate(ProductoBase):
    pass

class ProductoResponse(ProductoBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

class ProductoUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=3, max_length=50, description="Nombre del producto")
    descripcion: Optional[str] = Field(None, max_length=200)
    cantidad: Optional[int] = Field(None, gt=0)
    precio: Optional[float] = Field(None, gt=0)
    id_categoria: Optional[int] = Field(None, gt=0)
    preparacion: Optional[bool] = Field(None)
    estado: Optional[bool] = Field(None)

class ProductoChangeState(BaseModel):
    id: int


    model_config = ConfigDict(from_attributes=True)