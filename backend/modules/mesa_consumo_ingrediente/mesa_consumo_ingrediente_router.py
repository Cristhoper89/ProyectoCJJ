from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user
from modules.mesa_consumo_ingrediente.mesa_consumo_ingrediente_schema import (
    MesaConsumoIngredienteCreate,
    MesaConsumoIngredienteResponse,
    MesaConsumoIngredienteUpdate,
)
from modules.mesa_consumo_ingrediente.mesa_consumo_ingrediente_service import MesaConsumoIngredienteService


router = APIRouter(prefix="/mesa-consumo-ingredientes", tags=["Mesa consumo ingredientes"])


def require_staff(current_user: dict) -> None:
    if current_user["role_name"] not in ["Administrador", "Cajero", "Cocina"]:
        raise HTTPException(status_code=403, detail="Acceso denegado. Rol insuficiente.")


@router.get("/", response_model=list[MesaConsumoIngredienteResponse])
async def list_relations(db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    require_staff(current_user)
    return await MesaConsumoIngredienteService(db).get_all()


@router.post("/", response_model=MesaConsumoIngredienteResponse, status_code=status.HTTP_201_CREATED)
async def create_relation(data: MesaConsumoIngredienteCreate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    require_staff(current_user)
    return await MesaConsumoIngredienteService(db).create(data)


@router.put("/{item_id}", response_model=MesaConsumoIngredienteResponse)
async def update_relation(item_id: int, data: MesaConsumoIngredienteUpdate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    require_staff(current_user)
    return await MesaConsumoIngredienteService(db).update(item_id, data)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_relation(item_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    require_staff(current_user)
    await MesaConsumoIngredienteService(db).delete(item_id)