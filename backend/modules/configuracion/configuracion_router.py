from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user
from modules.configuracion.configuracion_schema import ConfiguracionResponse, ConfiguracionUpdate
from modules.configuracion.configuracion_service import ConfiguracionService

router = APIRouter(prefix="/configuracion", tags=["Configuración"])


@router.get("/", response_model=ConfiguracionResponse, status_code=status.HTTP_200_OK)
async def read_configuracion(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["role_name"] not in ["Administrador", "Cajero", "Mesero"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Rol insuficiente.",
        )
    service = ConfiguracionService(db)
    return await service.get_configuracion()


@router.put("/", response_model=ConfiguracionResponse, status_code=status.HTTP_200_OK)
async def update_configuracion(
    configuracion: ConfiguracionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["role_name"] != "Administrador":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un administrador puede modificar la configuración.",
        )
    service = ConfiguracionService(db)
    return await service.update_configuracion(configuracion)
