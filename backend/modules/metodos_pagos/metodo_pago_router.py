from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_current_user  # Nueva importación
from modules.metodos_pagos.metodo_pago_schema import MetodoPCreate, MetodoPUpdate, MetodoPResponse
from modules.metodos_pagos.metodo_pago_service import Metodo_pService

router = APIRouter(prefix="/metodo_pagos", tags=["metodo_pagos"])

@router.get("/", response_model=list[MetodoPResponse], status_code=status.HTTP_200_OK)
async def read_movimientos(
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """Acceso restringido: Solo Administradores y Cajeros pueden listar proveedores."""
    if current_user["role_name"] != "Administrador" and current_user["role_name"] != "Cajero":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = Metodo_pService(db)
    return await service.get_all_metodo_pagos()

@router.post("/", response_model=MetodoPResponse, status_code=status.HTTP_201_CREATED)
async def add_metodo_pago(
    metodo_pago_in: MetodoPCreate, 
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """Acceso restringido: Solo Administradores pueden registrar nuevos proveedores."""
    if current_user["role_name"] != "Administrador":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = Metodo_pService(db)
    return await service.create_metodo_pago(metodo_pago_in)

@router.put("/{metodo_pago_id}", response_model=MetodoPResponse, status_code=status.HTTP_200_OK)
async def update_existing_metodo_pago(
    metodo_pago_id: int, 
    metodo_pago_data: MetodoPUpdate, 
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """
    Endpoint Protegido por Token y RBAC:
    - Admin y cajero: Modifica a cualquier método de pago sin restricciones.
    """
    if current_user["role_name"] not in ["Administrador", "Cajero"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = Metodo_pService(db)
    return await service.update_metodo_pago(metodo_pago_id, metodo_pago_data, current_user)
