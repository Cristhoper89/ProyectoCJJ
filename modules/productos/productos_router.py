from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_current_user  # Nueva importación
from modules.productos.productos_schema import ProductoCreate, ProductoResponse, ProductoUpdate
from modules.productos.productos_service import ProductoService

router = APIRouter(prefix="/productos", tags=["Productos"])

@router.get("/", response_model=list[ProductoResponse], status_code=status.HTTP_200_OK)
async def read_productos(
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """Acceso restringido: Solo Administradores y Cajeros pueden listar productos."""
    if current_user["role_name"] != "Administrador" and current_user["role_name"] != "Cajero":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = ProductoService(db)
    return await service.get_all_productos()

@router.post("/", response_model=ProductoResponse, status_code=status.HTTP_201_CREATED)
async def add_producto(
    producto_in: ProductoCreate, 
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """Acceso restringido: Solo Administradores pueden registrar nuevos productos."""
    if current_user["role_name"] != "Administrador" and current_user["role_name"] != "Cajero":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = ProductoService(db)
    return await service.create_producto(producto_in)

@router.put("/{producto_id}", response_model=ProductoResponse, status_code=status.HTTP_200_OK)
async def update_existing_producto(
    producto_id: int, 
    producto_data: ProductoUpdate, 
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """
    Endpoint Protegido por Token y RBAC:
    - Admin y cajero: Modifica a cualquier producto sin restricciones.
    """
    if current_user["role_name"] not in ["Administrador", "Cajero"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = ProductoService(db)
    return await service.update_producto(producto_id, producto_data, current_user)

@router.patch("/{producto_id}/estado", response_model=ProductoResponse, status_code=status.HTTP_200_OK)
async def change_producto_state(
    producto_id: int, 
    new_state: bool, 
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """
    Endpoint Protegido por Token y RBAC:
    - Admin y cajero: Cambia el estado de un producto.
    """
    if current_user["role_name"] not in ["Administrador", "Cajero"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = ProductoService(db)
    return await service.cambiar_estado_producto(producto_id, new_state)