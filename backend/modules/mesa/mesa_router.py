from uuid import UUID

from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_current_user  # Nueva importación

from modules.mesa.mesa_schema import MesaResponse, MesaUpdate, MesaCreate
from modules.mesa.mesa_service import MesaService

router = APIRouter(prefix="/mesas", tags=["Mesas"])

@router.get("/", response_model=list[MesaResponse], status_code=status.HTTP_200_OK)
async def read_mesas(
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """Acceso restringido: cliente no puede ver todas las mesas."""
    if current_user["role_name"] == "Cliente":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = MesaService(db)
    return await service.get_all_mesas()

@router.post("/", response_model=MesaResponse, status_code=status.HTTP_201_CREATED)
async def add_mesa(
    mesa_in: MesaCreate, 
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """Acceso restringido: Solo Administradores y Cajeros pueden registrar nuevas mesas."""
    if current_user["role_name"] != "Administrador" and current_user["role_name"] != "Cajero":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = MesaService(db)
    return await service.create_mesa(mesa_in)

@router.put("/{mesa_id}", response_model=MesaResponse, status_code=status.HTTP_200_OK)
async def update_existing_mesa(
    mesa_id: int, 
    mesa_data: MesaUpdate, 
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """
    Endpoint Protegido por Token y RBAC:
    - Admin y cajero: Modifica a cualquier mesa sin restricciones.
    """
    if current_user["role_name"] not in ["Administrador", "Cajero"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = MesaService(db)
    return await service.update_mesa(mesa_id, mesa_data, current_user)

@router.patch("/{mesa_id}/estado", response_model=MesaResponse, status_code=status.HTTP_200_OK)
async def change_mesa_state(
    mesa_id: int, 
    new_state: bool,
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """
    Endpoint Protegido por Token y RBAC:
    - Admin y cajero: Cambia el estado de una mesa.
    """
    if current_user["role_name"] not in ["Administrador", "Cajero", "Mesero"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = MesaService(db)
    return await service.cambiar_estado_mesa(mesa_id, new_state)

@router.patch("/{mesa_id}/asignar_mesero", response_model=MesaResponse, status_code=status.HTTP_200_OK)
async def assign_mesero_to_mesa(
    mesa_id: int, 
    id_mesero: UUID,
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """
    Endpoint Protegido por Token y RBAC:
    - Admin y cajero: Asigna un mesero a una mesa.
    """
    if current_user["role_name"] not in ["Administrador", "Cajero"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = MesaService(db)
    return await service.update_mesa(mesa_id, MesaUpdate(id_mesero=id_mesero), current_user)

@router.patch("/{mesa_id}/asignar_cliente", response_model=MesaResponse, status_code=status.HTTP_200_OK)
async def assign_cliente_to_mesa(
    mesa_id: int, 
    id_cliente: UUID,
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """
    Endpoint Protegido por Token y RBAC:
    - Admin y cajero: Asigna un cliente a una mesa.
    """
    if current_user["role_name"] not in ["Administrador", "Cajero"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = MesaService(db)
    return await service.update_mesa(mesa_id, MesaUpdate(id_cliente=id_cliente), current_user)