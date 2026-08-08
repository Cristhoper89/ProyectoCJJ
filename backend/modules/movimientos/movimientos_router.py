from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_current_user  # Nueva importación
from modules.movimientos.movimientos_schema import MovimientoCreate, MovimientoResponse, MovimientoUpdate
from modules.movimientos.movimientos_service import MovimientoService

router = APIRouter(prefix="/movimientos", tags=["movimientos"])

@router.get("/", response_model=list[MovimientoResponse], status_code=status.HTTP_200_OK)
async def read_movimientos(
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """Acceso restringido: Solo Administradores y Cajeros pueden listar proveedores."""
    if current_user["role_name"] != "Administrador" and current_user["role_name"] != "Cajero":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = MovimientoService(db)
    return await service.get_all_movimientos()

@router.post("/", response_model=MovimientoResponse, status_code=status.HTTP_201_CREATED)
async def add_movimiento(
    movimiento_in: MovimientoCreate, 
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """Acceso restringido: Solo Administradores pueden registrar nuevos proveedores."""
    if current_user["role_name"] != "Administrador":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = MovimientoService(db)
    return await service.create_movimiento(movimiento_in)

@router.put("/{movimiento_id}", response_model=MovimientoResponse, status_code=status.HTTP_200_OK)
async def update_existing_movimiento(
    movimiento_id: int, 
    movimiento_data: MovimientoUpdate, 
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """
    Endpoint Protegido por Token y RBAC:
    - Admin y cajero: Modifica a cualquier movimiento sin restricciones.
    """
    if current_user["role_name"] not in ["Administrador", "Cajero"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = MovimientoService(db)
    return await service.update_movimiento(movimiento_id, movimiento_data, current_user)
