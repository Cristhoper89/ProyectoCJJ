from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.mesa_realtime import notify_mesa_change
from core.security import get_current_user
from modules.carta.carta_schema import (
    CartaCatalogoResponse,
    CartaMesaResponse,
    CartaPedidoCreate,
)
from modules.carta.carta_service import CartaService
from modules.mesa.mesa_service import MesaService


router = APIRouter(prefix="/carta", tags=["Carta pública"])


@router.get("/", response_model=CartaCatalogoResponse, status_code=status.HTTP_200_OK)
async def get_public_catalog(db: AsyncSession = Depends(get_db)):
    return await CartaService(db).get_catalog()


@router.get(
    "/mesas/{mesa_id}",
    response_model=CartaMesaResponse,
    status_code=status.HTTP_200_OK,
)
async def get_public_mesa(mesa_id: int, db: AsyncSession = Depends(get_db)):
    return await CartaService(db).get_mesa_status(mesa_id)


@router.post(
    "/mesas/{mesa_id}/activar",
    response_model=CartaMesaResponse,
    status_code=status.HTTP_200_OK,
)
async def activate_public_mesa(
    mesa_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    mesa = await MesaService(db).activar_mesa_por_qr(mesa_id)
    await notify_mesa_change(db)
    return {
        "mesa_id": mesa["id"],
        "mesa_nombre": mesa["nombre"] or f"Mesa {mesa['id']}",
        "activa": True,
        "total": 0,
        "items": [],
    }


@router.post(
    "/mesas/{mesa_id}/pedidos",
    response_model=CartaMesaResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_public_order(
    mesa_id: int,
    pedido: CartaPedidoCreate,
    db: AsyncSession = Depends(get_db),
):
    service = CartaService(db)
    result = await service.create_order(mesa_id, pedido)
    await notify_mesa_change(db)
    return result
