from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_current_user  # Nueva importación
from modules.roles.role_schema import RoleCreate, RoleResponse
from modules.roles.role_service import RoleService

router = APIRouter(prefix="/roles", tags=["Roles"])

@router.get("/", response_model=list[RoleResponse], status_code=status.HTTP_200_OK)
async def read_roles(
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """Acceso restringido: Solo Administradores pueden listar roles."""
    if current_user["role_name"] != "Administrador":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = RoleService(db)
    return await service.get_all_roles()

@router.post("/", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def add_role(
    role_in: RoleCreate, 
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """Acceso restringido: Solo Administradores pueden registrar nuevos roles."""
    if current_user["role_name"] != "Administrador":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = RoleService(db)
    return await service.create_role(role_in)
