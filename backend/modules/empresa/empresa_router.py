from uuid import UUID

from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from core.security import get_current_user  # Nueva importación
from modules.empresa.empresa_schema import EmpresaCreate, EmpresaResponse, EmpresaUpdate
from modules.empresa.empresa_service import EmpresaService

router = APIRouter(prefix="/empresas", tags=["Empresas"])

@router.get("/", response_model=list[EmpresaResponse], status_code=status.HTTP_200_OK)
async def read_empresas(
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """Acceso restringido: Solo Administradores puede ver los datos de empresa."""
    if current_user["role_name"] != "Administrador":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = EmpresaService(db)
    return await service.get_empresas()

@router.put("/{empresa_id}", response_model=EmpresaResponse, status_code=status.HTTP_200_OK)
async def update_existing_empresa(
    empresa_id: UUID, 
    empresa_data: EmpresaUpdate, 
    db: AsyncSession = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    """
    Endpoint Protegido por Token y RBAC:
    - Admin: Modifica a cualquier empresa sin restricciones.
    """
    if current_user["role_name"] != "Administrador":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")
    service = EmpresaService(db)
    return await service.update_empresa(empresa_id, empresa_data, current_user)
