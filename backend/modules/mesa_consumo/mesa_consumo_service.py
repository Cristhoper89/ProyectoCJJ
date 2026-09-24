from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from core.logger import logger
from modules.mesa_consumo.mesa_consumo_schema import MesaCreate, MesaUpdate

MESA_CONSUMO_COLUMNS = """
    id, id_producto, id_mov, cantidad, precio_unitario,
    subtotal, preparado, notas, descuento
"""


class MesaCService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_all_mesasC(self) -> list[dict]:
        logger.info("SQL Nativo: Consultando todos los consumos de mesa.")
        query = text(f"""
            SELECT {MESA_CONSUMO_COLUMNS}
            FROM mesa_consumo
            ORDER BY id ASC;
        """)
        result = await self.db.execute(query)
        return [dict(row) for row in result.mappings().all()]

    @staticmethod
    def _calc_subtotal(precio: float, cantidad: int, descuento: float) -> float:
        return round(max(0.0, (precio - descuento) * cantidad), 2)

    async def create_mesaC(self, mesaC_data: MesaCreate) -> dict:
        logger.info(f"SQL Nativo: Insertando consumo del movimiento {mesaC_data.id_mov}")

        dup = await self.db.execute(
            text("SELECT id, preparacion, precio FROM productos WHERE id = :id;"),
            {"id": mesaC_data.id_producto}
        )
        producto = dup.first()
        if not producto:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El producto especificado no existe.")

        cantidad = mesaC_data.cantidad or 1
        precio_unitario = float(producto.precio)
        descuento = round(float(mesaC_data.descuento or 0), 2)
        subtotal = self._calc_subtotal(precio_unitario, cantidad, descuento)
        preparado = not bool(producto.preparacion)

        query = text(f"""
            INSERT INTO mesa_consumo (
                id_producto, id_mov, cantidad,
                precio_unitario, subtotal, preparado, notas, descuento
            )
            VALUES (
                :id_producto, :id_mov, :cantidad,
                :precio_unitario, :subtotal, :preparado, :notas, :descuento
            )
            RETURNING {MESA_CONSUMO_COLUMNS};
        """)

        try:
            result = await self.db.execute(query, {
                "id_producto": mesaC_data.id_producto,
                "id_mov": mesaC_data.id_mov,
                "cantidad": cantidad,
                "precio_unitario": precio_unitario,
                "subtotal": subtotal,
                "preparado": preparado,
                "notas": mesaC_data.notas,
                "descuento": descuento,
            })
            consumo = result.mappings().first()
            for ingrediente in mesaC_data.ingredientes:
                await self.db.execute(
                    text("""
                        INSERT INTO mesa_consumo_ingredientes (id_mesa_consumo, id_ingrediente, accion)
                        VALUES (
                            :id_mesa_consumo,
                            :id_ingrediente,
                            CAST(:accion AS tipo_accion)
                        );
                    """),
                    {
                        "id_mesa_consumo": consumo["id"],
                        "id_ingrediente": ingrediente.id_ingrediente,
                        "accion": ingrediente.accion,
                    },
                )
            await self.db.commit()
            return dict(consumo)
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error al insertar consumo de mesa: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno del servidor.")
          
    async def update_mesaC(self, target_mesa_id: int, mesa_update: MesaUpdate, current_user: dict) -> dict:
        logger.info(f"Usuario '{current_user['username']}' intenta modificar el consumo ID: {target_mesa_id}")

        # Verificar que el consumo objetivo realmente exista en PostgreSQL
        check = await self.db.execute(
            text("SELECT id FROM mesa_consumo WHERE id = :id;"),
            {"id": target_mesa_id}
        )
        if not check.first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El consumo a modificar no existe.")

        # Cargar el precio original del producto para recalcular el subtotal
        current_row = await self.db.execute(
            text("""
                SELECT mc.precio_unitario, mc.cantidad, mc.descuento, p.precio AS producto_precio
                FROM mesa_consumo mc
                LEFT JOIN productos p ON p.id = mc.id_producto
                WHERE mc.id = :id;
            """),
            {"id": target_mesa_id}
        )
        row = current_row.first()

        base_precio = float(row.producto_precio) if (row and row.producto_precio is not None) else (float(row.precio_unitario) if row and row.precio_unitario is not None else 0)
        current_cantidad = int(row.cantidad) if row and row.cantidad is not None else 1
        current_descuento = float(row.descuento or 0) if row else 0

        update_fields = []
        params = {"id": target_mesa_id}

        if mesa_update.cantidad is not None:
            update_fields.append("cantidad = :cantidad")
            params["cantidad"] = mesa_update.cantidad

        if mesa_update.descuento is not None:
            update_fields.append("descuento = :descuento")
            params["descuento"] = mesa_update.descuento

        if mesa_update.id_mov is not None:
            update_fields.append("id_mov = :id_mov")
            params["id_mov"] = mesa_update.id_mov

        if mesa_update.notas is not None:
            update_fields.append("notas = :notas")
            params["notas"] = mesa_update.notas

        # Recalcular el subtotal según la cantidad y el descuento finales
        new_cantidad = mesa_update.cantidad if mesa_update.cantidad is not None else current_cantidad
        new_descuento = mesa_update.descuento if mesa_update.descuento is not None else current_descuento
        update_fields.append("subtotal = :subtotal")
        params["subtotal"] = self._calc_subtotal(base_precio, new_cantidad, new_descuento)

        query_str = f"""
            UPDATE mesa_consumo
            SET {', '.join(update_fields)}
            WHERE id = :id
            RETURNING {MESA_CONSUMO_COLUMNS};
        """

        try:
            result = await self.db.execute(text(query_str), params)
            await self.db.commit()
            return dict(result.mappings().first())
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error crítico en actualización SQL: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al procesar los datos.")

    async def delete_mesaC(self, target_consumo_id: int, current_user: dict) -> None:
        logger.info(f"Usuario '{current_user['username']}' intenta eliminar el consumo ID: {target_consumo_id}")

        check = await self.db.execute(
            text("SELECT id FROM mesa_consumo WHERE id = :id;"),
            {"id": target_consumo_id}
        )
        if not check.first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El consumo a eliminar no existe.")

        try:
            await self.db.execute(
                text("DELETE FROM mesa_consumo_ingredientes WHERE id_mesa_consumo = :id;"),
                {"id": target_consumo_id}
            )
            await self.db.execute(
                text("DELETE FROM mesa_consumo WHERE id = :id;"),
                {"id": target_consumo_id}
            )
            await self.db.commit()
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error al eliminar consumo de mesa: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno del servidor.")

    async def delete_consumos_mesa(self, target_mesa_id: int, current_user: dict) -> None:
        logger.info(f"Usuario '{current_user['username']}' intenta eliminar todos los consumos de la mesa ID: {target_mesa_id}")

        try:
            await self.db.execute(
                text("""
                    DELETE FROM mesa_consumo_ingredientes
                    WHERE id_mesa_consumo IN (
                        SELECT mc.id FROM mesa_consumo mc
                        WHERE mc.id_mov = (SELECT id_mov FROM mesa WHERE id = :id_mesa)
                           OR mc.id_mov IN (SELECT id_movimiento FROM barra WHERE id_mesa = :id_mesa)
                    );
                """),
                {"id_mesa": target_mesa_id}
            )
            await self.db.execute(
                text("""
                    DELETE FROM mesa_consumo
                    WHERE id_mov = (SELECT id_mov FROM mesa WHERE id = :id_mesa)
                       OR id_mov IN (SELECT id_movimiento FROM barra WHERE id_mesa = :id_mesa);
                """),
                {"id_mesa": target_mesa_id}
            )
            await self.db.commit()
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error al eliminar los consumos de la mesa: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno del servidor.")

    async def cambiar_estado_preparado(self, target_mesa_id: int, preparado: bool) -> dict:
        logger.info(f"Actualizando estado 'preparado' de la mesa ID: {target_mesa_id} a {preparado}")

        # Verificar que la mesa exista
        check = await self.db.execute(text("SELECT id FROM mesa_consumo WHERE id = :id;"), {"id": target_mesa_id})
        if not check.first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La mesa a modificar no existe.")

        query = text("""
            UPDATE mesa_consumo
            SET preparado = :preparado
            WHERE id = :id
            RETURNING id, id_producto, id_mov, cantidad, precio_unitario, subtotal, preparado, notas, descuento;
        """)
        
        try:
            result = await self.db.execute(query, {"id": target_mesa_id, "preparado": preparado})
            await self.db.commit()
            return dict(result.mappings().first())
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error crítico en actualización SQL: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al procesar los datos.")