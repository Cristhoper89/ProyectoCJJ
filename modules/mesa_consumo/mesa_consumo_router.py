from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_current_user  # Nueva importación

from modules.mesa_consumo.mesa_consumo_schema import MesaResponse, MesaUpdate, MesaCreate
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
    """Acceso restringido: Solo Administradores y Cajeros pueden registrar nuevas mesas."""
    if current_user["role_name"] != "Administrador" and current_user["role_name"] != "Cajero":
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
    - Admin y cajero: Modifica a cualquier mesa sin restricciones.
    """
    if current_user["role_name"] not in ["Administrador", "Cajero"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = MesaCService(db)
    return await service.update_mesaC(mesa_id, mesa_data, current_user)
