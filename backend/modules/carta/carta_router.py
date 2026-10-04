from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.mesa_realtime import notify_mesa_change
from modules.carta.carta_schema import (
    CartaCatalogoResponse,
    CartaMesaResponse,
    CartaPedidoCreate,
)
from modules.carta.carta_service import CartaService


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
