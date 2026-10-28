from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user
from modules.opciones.opciones_schema import (
    GrupoOpcionCreate,
    GrupoOpcionResponse,
    GrupoOpcionUpdate,
    OpcionCreate,
    OpcionResponse,
    OpcionUpdate,
    ProductoGrupoOpcionCreate,
    ProductoGrupoOpcionResponse,
)
from modules.opciones.opciones_service import OpcionesService


router = APIRouter(tags=["Opciones de productos"])


def require_read_access(current_user: dict) -> None:
    if current_user["role_name"] not in ["Administrador", "Cajero", "Mesero"]:
        raise HTTPException(status_code=403, detail="Acceso denegado. Rol insuficiente.")


def require_write_access(current_user: dict) -> None:
    if current_user["role_name"] not in ["Administrador", "Cajero"]:
        raise HTTPException(status_code=403, detail="Acceso denegado. Rol insuficiente.")


@router.get("/grupos-opciones/", response_model=list[GrupoOpcionResponse])
async def list_groups(db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    require_read_access(current_user)
    return await OpcionesService(db).list_groups()


@router.post("/grupos-opciones/", response_model=GrupoOpcionResponse, status_code=status.HTTP_201_CREATED)
async def create_group(data: GrupoOpcionCreate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    require_write_access(current_user)
    return await OpcionesService(db).create_group(data)


@router.put("/grupos-opciones/{group_id}", response_model=GrupoOpcionResponse)
async def update_group(group_id: int, data: GrupoOpcionUpdate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    require_write_access(current_user)
    return await OpcionesService(db).update_group(group_id, data)


@router.delete("/grupos-opciones/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(group_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    require_write_access(current_user)
    await OpcionesService(db).delete_group(group_id)


@router.get("/opciones/", response_model=list[OpcionResponse])
async def list_options(
    group_id: int | None = Query(None, gt=0),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    require_read_access(current_user)
    return await OpcionesService(db).list_options(group_id)


@router.post("/opciones/", response_model=OpcionResponse, status_code=status.HTTP_201_CREATED)
async def create_option(data: OpcionCreate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    require_write_access(current_user)
    return await OpcionesService(db).create_option(data)


@router.put("/opciones/{option_id}", response_model=OpcionResponse)
async def update_option(option_id: int, data: OpcionUpdate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    require_write_access(current_user)
    return await OpcionesService(db).update_option(option_id, data)


@router.delete("/opciones/{option_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_option(option_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    require_write_access(current_user)
    await OpcionesService(db).delete_option(option_id)


@router.get("/productos/{product_id}/grupos-opciones/", response_model=list[GrupoOpcionResponse])
async def list_product_groups(product_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    require_read_access(current_user)
    groups = await OpcionesService(db).list_product_groups(product_id)
    service = OpcionesService(db)
    result = []
    for group in groups:
        result.append({**group, "opciones": await service.list_options(group["id"], active_only=True)})
    return result


@router.post("/producto-grupo-opcion/", response_model=ProductoGrupoOpcionResponse, status_code=status.HTTP_201_CREATED)
async def assign_group(data: ProductoGrupoOpcionCreate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    require_write_access(current_user)
    return await OpcionesService(db).assign_group(data)


@router.delete("/productos/{product_id}/grupos-opciones/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unassign_group(product_id: int, group_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    require_write_access(current_user)
    await OpcionesService(db).unassign_group(product_id, group_id)
