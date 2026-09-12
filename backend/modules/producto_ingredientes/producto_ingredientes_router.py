from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user
from modules.producto_ingredientes.producto_ingredientes_schema import (
    ProductoIngredienteCreate,
    ProductoIngredienteResponse,
    ProductoIngredienteUpdate,
)
from modules.producto_ingredientes.producto_ingredientes_service import ProductoIngredienteService


router = APIRouter(prefix="/producto-ingredientes", tags=["Producto ingredientes"])


def require_staff(current_user: dict) -> None:
    if current_user["role_name"] not in ["Administrador", "Cajero"]:
        raise HTTPException(status_code=403, detail="Acceso denegado. Rol insuficiente.")


@router.get("/", response_model=list[ProductoIngredienteResponse])
async def list_relations(db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    require_staff(current_user)
    return await ProductoIngredienteService(db).get_all()


@router.post("/", response_model=ProductoIngredienteResponse, status_code=status.HTTP_201_CREATED)
async def create_relation(data: ProductoIngredienteCreate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    require_staff(current_user)
    return await ProductoIngredienteService(db).create(data)


@router.put("/{item_id}", response_model=ProductoIngredienteResponse)
async def update_relation(item_id: int, data: ProductoIngredienteUpdate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    require_staff(current_user)
    return await ProductoIngredienteService(db).update(item_id, data)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_relation(item_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    require_staff(current_user)
    await ProductoIngredienteService(db).delete(item_id)