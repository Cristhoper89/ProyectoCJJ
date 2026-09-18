from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_current_user  # Nueva importación

from modules.mesa_consumo.mesa_consumo_schema import MesaResponse, MesaUpdate, MesaCreate, PreparadoUpdate
from modules.mesa_consumo.mesa_consumo_service import MesaCService

router = APIRouter(prefix="/mesasC", tags=["MesasC"])

@router.get("/", response_model=list[MesaResponse], status_code=status.HTTP_200_OK)
async def read_mesasC(
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """Acceso restringido: cliente no puede ver todas las mesas."""
    if current_user["role_name"] == "Cliente":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = MesaCService(db)
    return await service.get_all_mesasC()

@router.post("/", response_model=MesaResponse, status_code=status.HTTP_201_CREATED)
async def add_mesaC(
    mesa_in: MesaCreate, 
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
<<<<<<< Updated upstream
    """Acceso restringido: Solo Administradores y Cajeros pueden registrar nuevas mesas."""
=======
    """Acceso restringido: Admin, cajeros y meseros pueden registrar consumos."""
>>>>>>> Stashed changes
    if current_user["role_name"] not in ["Administrador", "Cajero", "Mesero"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = MesaCService(db)
    return await service.create_mesaC(mesa_in)

@router.put("/{mesa_id}", response_model=MesaResponse, status_code=status.HTTP_200_OK)
async def update_existing_mesaC(
    mesa_id: int, 
    mesa_data: MesaUpdate, 
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """
    Endpoint Protegido por Token y RBAC:
    - Admin, cajero y mesero: Modifica consumos sin restricciones.
    """
    if current_user["role_name"] not in ["Administrador", "Cajero", "Mesero"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = MesaCService(db)
    return await service.update_mesaC(mesa_id, mesa_data, current_user)

@router.delete("/{mesa_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_mesaC(
    mesa_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Elimina una línea de consumo (producto registrado en una mesa).
    Acceso: Admin, cajero y mesero.
    """
    if current_user["role_name"] not in ["Administrador", "Cajero", "Mesero"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = MesaCService(db)
    await service.delete_mesaC(mesa_id, current_user)

@router.delete("/mesa/{mesa_id}/todo", status_code=status.HTTP_204_NO_CONTENT)
async def delete_all_consumos_mesa(
    mesa_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Elimina todos los consumos de una mesa (cancelar pedido).
    Acceso: Admin, cajero y mesero.
    """
    if current_user["role_name"] not in ["Administrador", "Cajero", "Mesero"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = MesaCService(db)
    await service.delete_consumos_mesa(mesa_id, current_user)

@router.patch("/{mesa_id}/preparado", response_model=MesaResponse, status_code=status.HTTP_200_OK)
async def update_preparado_status(
    mesa_id: int, 
    preparado_data: PreparadoUpdate, 
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """
    Endpoint Protegido por Token y RBAC:
    - Cocina puede marcar productos como preparados.
    """
    if current_user["role_name"] not in ["Cocina"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = MesaCService(db)
    return await service.cambiar_estado_preparado(mesa_id, preparado_data.preparado)