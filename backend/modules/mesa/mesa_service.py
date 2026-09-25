from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from core.logger import logger
from modules.mesa.mesa_schema import MesaCreate, MesaUpdate, MesaFinalize

class MesaService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_all_mesas(self) -> list[dict]:
        logger.info("SQL Nativo: Consultando todas las mesas.")
        query = text("""
            SELECT
                id,
                nombre,
                estado,
                hora_inicio,
                tipo,
                id_mov
            FROM mesa
            ORDER BY id ASC;
        """)
        result = await self.db.execute(query)
        return [dict(row) for row in result.mappings().all()]

    async def create_mesa(self, mesa_data: MesaCreate) -> dict:
        logger.info(f"SQL Nativo: Insertando mesa {mesa_data.estado}")

        query = text("""
            INSERT INTO mesa (nombre, estado, tipo)
            VALUES (:nombre, :estado, :tipo)
            RETURNING
                id,
                nombre,
                estado,
                hora_inicio,
                tipo,
                id_mov;
        """)
        try:
            result = await self.db.execute(query, {
                "nombre": mesa_data.nombre,
                "estado": mesa_data.estado,
                "tipo": mesa_data.tipo
            })
            await self.db.commit()
            return dict(result.mappings().first())
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error al insertar mesa: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno del servidor.")
        
    async def update_mesa(self, target_mesa_id: int, mesa_update: MesaUpdate, current_user: dict) -> dict:
        logger.info(f"Usuario '{current_user['username']}' intenta modificar la mesa ID: {target_mesa_id}")

        # Verificar que el usuario objetivo realmente exista en PostgreSQL
        check = await self.db.execute(text("SELECT id FROM mesa WHERE id = :id;"), {"id": target_mesa_id})
        if not check.first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La mesa a modificar no existe.")

        # Construcción dinámica de la sentencia UPDATE con SQL Puro
        update_fields = []
        params = {"id": target_mesa_id}

        if mesa_update.estado is not None:
            update_fields.append("estado = :estado")
            params["estado"] = mesa_update.estado

        if mesa_update.nombre is not None:
            update_fields.append("nombre = :nombre")
            params["nombre"] = mesa_update.nombre

        if mesa_update.hora_inicio is not None:
            update_fields.append("hora_inicio = :hora_inicio")
            params["hora_inicio"] = mesa_update.hora_inicio

        if mesa_update.tipo is not None:
            update_fields.append("tipo = :tipo")
            params["tipo"] = mesa_update.tipo

        if mesa_update.id_mov is not None:
            update_fields.append("id_mov = :id_mov")
            params["id_mov"] = mesa_update.id_mov

        if not update_fields:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se enviaron datos para actualizar.")

        # Unificar campos en el string de SQL Nativo
        query_str = f"""
            UPDATE mesa 
            SET {', '.join(update_fields)} 
            WHERE id = :id 
            RETURNING id, nombre, estado, hora_inicio, tipo, id_mov;
        """
        
        try:
            result = await self.db.execute(text(query_str), params)
            await self.db.commit()
            return dict(result.mappings().first())
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error crítico en actualización SQL: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al procesar los datos.")

    async def cambiar_estado_mesa(self, target_mesa_id: int, estado: bool) -> dict:
        logger.info(f"Intentando cambiar el estado de la mesa ID: {target_mesa_id}")

        mesa_result = await self.db.execute(
            text("SELECT id, tipo, estado, id_mov FROM mesa WHERE id = :id FOR UPDATE;"),
            {"id": target_mesa_id},
        )
        mesa = mesa_result.mappings().first()
        if not mesa:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La mesa a desactivar no existe.")

        try:
            movimiento_id = mesa["id_mov"]

            should_create_movement = estado and (
                (mesa["tipo"] == "mesa" and movimiento_id is None)
                or (mesa["tipo"] == "barra" and mesa["estado"] is not True)
            )

            if should_create_movement:
                caja = (await self.db.execute(
                    text("SELECT id FROM caja ORDER BY id DESC LIMIT 1;")
                )).first()
                if not caja:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="No hay una caja disponible para iniciar la mesa.",
                    )

                movimiento = (await self.db.execute(text("""
                    INSERT INTO movimiento (estado, propina, domicilio, total, id_caja, metodo)
                    VALUES (TRUE, 0, 0, 0, :id_caja, 'Efectivo')
                    RETURNING id;
                """), {"id_caja": caja.id})).first()
                movimiento_id = movimiento.id

                if mesa["tipo"] == "barra":
                    await self.db.execute(
                        text("INSERT INTO barra (id_mesa, id_movimiento) VALUES (:id_mesa, :id_movimiento);"),
                        {"id_mesa": target_mesa_id, "id_movimiento": movimiento_id},
                    )

            result = await self.db.execute(text("""
                UPDATE mesa
                SET estado = :estado,
                    hora_inicio = CASE WHEN :estado THEN COALESCE(hora_inicio, CURRENT_TIMESTAMP) ELSE NULL END,
                    id_mov = :id_mov
                WHERE id = :id
                RETURNING id, nombre, estado, hora_inicio, tipo, id_mov;
            """), {
                "id": target_mesa_id,
                "estado": estado,
                "id_mov": movimiento_id if mesa["tipo"] == "mesa" else None,
            })
            await self.db.commit()
            return dict(result.mappings().first())
        except HTTPException:
            await self.db.rollback()
            raise
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error crítico al cambiar el estado de la mesa: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al procesar los datos.")

    async def cerrar_mesa(self, target_mesa_id: int) -> dict:
        logger.info(f"Intentando cerrar la mesa ID: {target_mesa_id}")

        mesa = (await self.db.execute(
            text("SELECT id, tipo, id_mov FROM mesa WHERE id = :id FOR UPDATE;"),
            {"id": target_mesa_id},
        )).mappings().first()
        if not mesa:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La mesa a cerrar no existe.")

        movement_ids = []

        if mesa["tipo"] == "mesa" and mesa["id_mov"] is not None:
            movement_ids = [mesa["id_mov"]]
        elif mesa["tipo"] == "barra":
            rows = (await self.db.execute(
                text("SELECT id_movimiento FROM barra WHERE id_mesa = :id_mesa;"),
                {"id_mesa": target_mesa_id},
            )).all()
            movement_ids = [row.id_movimiento for row in rows]

        try:
            if movement_ids:
                movement_ids = list(dict.fromkeys(movement_ids))

                await self.db.execute(
                    text("UPDATE mesa SET id_mov = NULL WHERE id = :id;"),
                    {"id": target_mesa_id},
                )

                await self.db.execute(
                    text("""
                        DELETE FROM mesa_consumo_ingredientes
                        WHERE id_mesa_consumo IN (
                            SELECT mc.id
                            FROM mesa_consumo mc
                            WHERE mc.id_mov = ANY(:movement_ids)
                        );
                    """),
                    {"movement_ids": movement_ids},
                )

                await self.db.execute(
                    text("DELETE FROM mesa_consumo WHERE id_mov = ANY(:movement_ids);"),
                    {"movement_ids": movement_ids},
                )

                await self.db.execute(
                    text("DELETE FROM barra WHERE id_mesa = :id_mesa AND id_movimiento = ANY(:movement_ids);"),
                    {"id_mesa": target_mesa_id, "movement_ids": movement_ids},
                )

                await self.db.execute(
                    text("DELETE FROM movimiento WHERE id = ANY(:movement_ids);"),
                    {"movement_ids": movement_ids},
                )

            result = await self.db.execute(text("""
                UPDATE mesa
                SET estado = false, hora_inicio = NULL, id_mov = NULL
                WHERE id = :id
                RETURNING id, nombre, estado, hora_inicio, tipo, id_mov;
            """), {"id": target_mesa_id})

            await self.db.commit()
            return dict(result.mappings().first())
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error crítico al cerrar la mesa: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al procesar los datos.")
        
    async def finalizar_mesa(self, mesa_id: int, data: MesaFinalize) -> dict:
        try:
            mesa = (await self.db.execute(text("SELECT id, tipo, id_mov FROM mesa WHERE id = :id FOR UPDATE;"), {"id": mesa_id})).mappings().first()
            if not mesa:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La mesa no existe.")

            movimiento = None
            if mesa["tipo"] == "mesa":
                if mesa["id_mov"] is None:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="La mesa no tiene un movimiento activo asociado.",
                    )

                update_fields = [
                    "estado = TRUE",
                    "propina = :propina",
                    "domicilio = :domicilio",
                    "total = :total",
                    "metodo = :metodo",
                ]
                params = {
                    "id": mesa["id_mov"],
                    "propina": data.propina,
                    "domicilio": data.domicilio,
                    "total": data.total,
                    "metodo": data.metodo,
                }
                if data.id_caja is not None:
                    update_fields.append("id_caja = :id_caja")
                    params["id_caja"] = data.id_caja

                movimiento = (await self.db.execute(text(f"""
                    UPDATE movimiento
                    SET {', '.join(update_fields)}
                    WHERE id = :id
                    RETURNING id, estado, propina, domicilio, total, id_caja, metodo, id_cliente, id_mesero, "fecha-hora" AS fecha_hora;
                """), params)).mappings().first()
                if movimiento is None:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El movimiento de la mesa no existe.")
            else:
                await self.db.execute(
                    text("DELETE FROM barra WHERE id_mesa = :mesa_id;"),
                    {"mesa_id": mesa_id},
                )

            await self.db.execute(text("""
                UPDATE mesa
                SET id_mov = NULL, estado = FALSE, hora_inicio = NULL
                WHERE id = :mesa_id;
            """), {"mesa_id": mesa_id})
            await self.db.commit()
            return dict(movimiento) if movimiento is not None else {
                "id": mesa_id,
                "estado": False,
                "id_mov": None,
            }
        except HTTPException:
            await self.db.rollback()
            raise
        except Exception as exc:
            await self.db.rollback()
            logger.error(f"Error al finalizar mesa {mesa_id}: {exc}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No fue posible crear el movimiento y cerrar la cuenta.")