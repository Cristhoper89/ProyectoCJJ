from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user
from modules.ingredientes.ingredientes_schema import (
    GastoCreate,
    GastoResponse,
    GastoUpdate,
    IngredienteCreate,
    IngredienteResponse,
    IngredienteUpdate,
)
from modules.ingredientes.ingredientes_service import GastoService, IngredienteService


router = APIRouter(tags=["Ingredientes y gastos"])


def require_staff(current_user: dict) -> None:
    if current_user["role_name"] not in ["Administrador", "Cajero"]:
        raise HTTPException(status_code=403, detail="Acceso denegado. Rol insuficiente.")


@router.get("/ingredientes/", response_model=list[IngredienteResponse])
async def list_ingredientes(db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    require_staff(current_user)
    return await IngredienteService(db).get_all()


@router.post("/ingredientes/", response_model=IngredienteResponse, status_code=status.HTTP_201_CREATED)
async def create_ingrediente(data: IngredienteCreate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    require_staff(current_user)
    return await IngredienteService(db).create(data)


@router.put("/ingredientes/{item_id}", response_model=IngredienteResponse)
async def update_ingrediente(item_id: int, data: IngredienteUpdate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    require_staff(current_user)
    return await IngredienteService(db).update(item_id, data)


@router.delete("/ingredientes/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ingrediente(item_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    require_staff(current_user)
    await IngredienteService(db).delete(item_id)


@router.get("/gastos/", response_model=list[GastoResponse])
async def list_gastos(db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    require_staff(current_user)
    return await GastoService(db).get_all()


@router.post("/gastos/", response_model=GastoResponse, status_code=status.HTTP_201_CREATED)
async def create_gasto(data: GastoCreate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    require_staff(current_user)
    return await GastoService(db).create(data)


@router.put("/gastos/{item_id}", response_model=GastoResponse)
async def update_gasto(item_id: int, data: GastoUpdate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    require_staff(current_user)
    return await GastoService(db).update(item_id, data)


@router.delete("/gastos/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_gasto(item_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    require_staff(current_user)
    await GastoService(db).delete(item_id)