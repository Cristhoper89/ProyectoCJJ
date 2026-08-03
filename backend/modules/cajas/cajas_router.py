from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_current_user  # Nueva importación
from modules.cajas.cajas_schema import CajasCreate, CajasResponse, CajasUpdate
from modules.cajas.cajas_service import CajasService

router = APIRouter(prefix="/cajas", tags=["Cajas"])

@router.get("/", response_model=list[CajasResponse], status_code=status.HTTP_200_OK)
async def read_cajas(
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """Acceso restringido: Solo Administradores pueden listar cajas."""
    if current_user["role_name"] != "Administrador" and current_user["role_name"] != "Cajero":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = CajasService(db)
    return await service.get_all_cajas()

@router.post("/", response_model=CajasResponse, status_code=status.HTTP_201_CREATED)
async def add_caja(
    caja_in: CajasCreate, 
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """Acceso restringido: Solo Administradores y Cajeros pueden registrar nuevas cajas."""
    if current_user["role_name"] != "Administrador" and current_user["role_name"] != "Cajero":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = CajasService(db)
    return await service.create_caja(caja_in)

@router.put("/{caja_id}", response_model=CajasResponse, status_code=status.HTTP_200_OK)
async def update_existing_caja(
    caja_id: int, 
    caja_data: CajasUpdate, 
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """
    Endpoint Protegido por Token y RBAC:
    - Admin y cajero: Modifica a cualquier caja sin restricciones.
    """
    if current_user["role_name"] not in ["Administrador", "Cajero"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = CajasService(db)
    return await service.update_caja(caja_id, caja_data, current_user)

@router.patch("/{caja_id}/estado", response_model=CajasResponse, status_code=status.HTTP_200_OK)
async def change_caja_state(
    caja_id: int, 
    new_state: str,
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """
    Endpoint Protegido por Token y RBAC:
    - Admin y cajero: Cambia el estado de una caja.
    """
    if current_user["role_name"] not in ["Administrador", "Cajero"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = CajasService(db)
    return await service.cambiar_estado_caja(caja_id, new_state)
