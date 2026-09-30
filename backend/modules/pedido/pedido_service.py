from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class PedidoService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_orders(self) -> list[dict]:
        result = await self.db.execute(text("""
            SELECT
                mc.id,
                mc.id_producto,
                mc.id_mov AS id_movimiento,
                mc.cantidad,
                mc.preparado,
                mc.notas,
                mc.fecha_creacion,
                p.nombre AS producto_nombre,
                COALESCE(
                    NULLIF(m.nombre, ''),
                    'Mesa ' || m.id::text
                ) AS ubicacion,
                mci.id AS modificador_id,
                mci.id_ingrediente,
                i.nombre AS ingrediente_nombre,
                mci.accion::text AS accion
            FROM mesa_consumo mc
            JOIN mesa m ON m.estado IS TRUE
                AND (
                    m.id_mov = mc.id_mov
                    OR EXISTS (
                        SELECT 1
                        FROM barra b
                        WHERE b.id_mesa = m.id AND b.id_movimiento = mc.id_mov
                    )
                )
            JOIN productos p ON p.id = mc.id_producto
            LEFT JOIN mesa_consumo_ingredientes mci
                ON mci.id_mesa_consumo = mc.id AND mci.accion::text IN ('agregar', 'quitar')
            LEFT JOIN ingredientes i ON i.id = mci.id_ingrediente
            WHERE mc.preparado IS NOT NULL AND COALESCE(mc.subtotal, 0) > 0
            ORDER BY mc.fecha_creacion ASC, mc.id ASC, mci.id ASC;
        """))

        orders: dict[int, dict] = {}
        for row in result.mappings().all():
            order_id = row["id_movimiento"]
            order = orders.setdefault(order_id, {
                "id_movimiento": order_id,
                "ubicacion": row["ubicacion"],
                "fecha_creacion": row["fecha_creacion"],
                "items": {},
            })
            item = order["items"].setdefault(row["id"], {
                "id": row["id"],
                "id_producto": row["id_producto"],
                "producto_nombre": row["producto_nombre"],
                "cantidad": row["cantidad"],
                "preparado": row["preparado"],
                "notas": row["notas"],
                "modificadores": [],
            })
            if row["modificador_id"] is not None:
                item["modificadores"].append({
                    "id": row["modificador_id"],
                    "id_ingrediente": row["id_ingrediente"],
                    "nombre": row["ingrediente_nombre"],
                    "accion": row["accion"],
                })

        return [
            {**order, "items": list(order["items"].values())}
            for order in orders.values()
        ]

    async def set_prepared(self, consumo_id: int, preparado: bool) -> dict:
        result = await self.db.execute(text("""
                        UPDATE mesa_consumo mc
            SET preparado = :preparado
                        WHERE mc.id = :id
                            AND mc.preparado IS NOT NULL
                            AND COALESCE(mc.subtotal, 0) > 0
                            AND EXISTS (
                                    SELECT 1
                                    FROM mesa m
                                    WHERE m.estado IS TRUE
                                        AND (
                                                m.id_mov = mc.id_mov
                                                OR EXISTS (
                                                        SELECT 1
                                                        FROM barra b
                                                        WHERE b.id_mesa = m.id AND b.id_movimiento = mc.id_mov
                                                )
                                        )
                            )
                        RETURNING mc.id, mc.preparado;
        """), {"id": consumo_id, "preparado": preparado})
        row = result.mappings().first()
        if row is None:
            await self.db.rollback()
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El consumo de cocina no existe.")

        await self.db.commit()
        return dict(row)