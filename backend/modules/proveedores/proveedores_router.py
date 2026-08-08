from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_current_user  # Nueva importación
from modules.proveedores.proveedores_schema import ProveedorCreate, ProveedorResponse, ProveedorUpdate
from modules.proveedores.proveedores_service import ProveedorService

router = APIRouter(prefix="/proveedores", tags=["Proveedores"])

@router.get("/", response_model=list[ProveedorResponse], status_code=status.HTTP_200_OK)
async def read_proveedores(
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """Acceso restringido: Solo Administradores y Cajeros pueden listar proveedores."""
    if current_user["role_name"] != "Administrador" and current_user["role_name"] != "Cajero":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = ProveedorService(db)
    return await service.get_all_proveedores()

@router.post("/", response_model=ProveedorResponse, status_code=status.HTTP_201_CREATED)
async def add_proveedor(
    proveedor_in: ProveedorCreate, 
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """Acceso restringido: Solo Administradores pueden registrar nuevos proveedores."""
    if current_user["role_name"] != "Administrador":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = ProveedorService(db)
    return await service.create_proveedor(proveedor_in)

@router.put("/{proveedor_id}", response_model=ProveedorResponse, status_code=status.HTTP_200_OK)
async def update_existing_proveedor(
    proveedor_id: int, 
    proveedor_data: ProveedorUpdate, 
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """
    Endpoint Protegido por Token y RBAC:
    - Admin y cajero: Modifica a cualquier proveedor sin restricciones.
    """
    if current_user["role_name"] not in ["Administrador", "Cajero"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = ProveedorService(db)
    return await service.update_proveedor(proveedor_id, proveedor_data, current_user)
