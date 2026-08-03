from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_current_user  # Nueva importación
from modules.categorias.categorias_schema import CategoriaCreate, CategoriaResponse
from modules.categorias.categorias_service import CategoriaService

router = APIRouter(prefix="/categorias", tags=["Categorías"])

@router.get("/", response_model=list[CategoriaResponse], status_code=status.HTTP_200_OK)
async def read_categorias(
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """Acceso restringido: Solo Administradores y Cajeros pueden listar categorías."""
    if current_user["role_name"] != "Administrador" and current_user["role_name"] != "cajero":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = CategoriaService(db)
    return await service.get_all_categorias()

@router.post("/", response_model=CategoriaResponse, status_code=status.HTTP_201_CREATED)
async def add_categoria(
    categoria_in: CategoriaCreate, 
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """Acceso restringido: Solo Administradores pueden registrar nuevas categorías."""
    if current_user["role_name"] != "Administrador" and current_user["role_name"] != "cajero":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = CategoriaService(db)
    return await service.create_categoria(categoria_in)

@router.put("/{categoria_id}", response_model=CategoriaResponse, status_code=status.HTTP_200_OK)
async def update_existing_categoria(
    categoria_id: int, 
    categoria_data: CategoriaCreate, 
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """
    Endpoint Protegido por Token y RBAC:
    - Admin y cajero: Modifica a cualquier categoría sin restricciones.
    """
    service = CategoriaService(db)
    return await service.update_categoria(categoria_id, categoria_data)