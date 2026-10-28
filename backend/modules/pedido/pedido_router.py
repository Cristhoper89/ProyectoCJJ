from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.mesa_realtime import notify_mesa_change
from core.security import get_current_user
from modules.pedido.pedido_schema import PedidoPreparadoUpdate, PedidoResponse
from modules.pedido.pedido_service import PedidoService

router = APIRouter(prefix="/pedido", tags=["Pedidos de cocina"])


def require_kitchen(user: dict) -> None:
    if user["role_name"] not in ["Administrador", "Cocina"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. Rol insuficiente.")


@router.get("/", response_model=list[PedidoResponse], status_code=status.HTTP_200_OK)
async def read_orders(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    require_kitchen(current_user)
    return await PedidoService(db).get_orders()


@router.patch("/items/{consumo_id}/preparado", status_code=status.HTTP_200_OK)
async def update_prepared(
    consumo_id: int,
    data: PedidoPreparadoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    require_kitchen(current_user)
    result = await PedidoService(db).set_prepared(consumo_id, data.preparado)
    await notify_mesa_change(db)
    return result