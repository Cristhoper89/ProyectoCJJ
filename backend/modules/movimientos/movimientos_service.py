from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from modules.movimientos.movimientos_schema import MovimientoCreate, MovimientoResponse, MovimientoUpdate
from core.logger import logger

class MovimientoService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_all_movimientos(self) -> list[dict]:
        logger.info("SQL Nativo: Consultando todos los movimientos.")
        query = text("""
            SELECT m.id, m.estado, m.propina, m.domicilio, m.total, m.id_caja,
                   m.metodo, m.id_cliente, m.id_mesero, m."fecha-hora" AS fecha_hora,
                   b.id_mesa
            FROM movimiento m
            LEFT JOIN barra b ON b.id_movimiento = m.id
            ORDER BY m.id ASC;
        """)
        result = await self.db.execute(query)
        return [dict(row) for row in result.mappings().all()]

    async def create_movimiento(self, movimiento_data: MovimientoCreate) -> dict:
        logger.info("SQL Nativo: Insertando movimiento.")

        if movimiento_data.id_mesa is not None:
            barra = (await self.db.execute(text("""
                SELECT m.id, m.tipo, m.estado
                FROM mesa m
                WHERE m.id = :id_mesa;
            """), {"id_mesa": movimiento_data.id_mesa})).mappings().first()
            if not barra:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La barra no existe.")
            if barra["tipo"] != "barra":
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La mesa indicada no es una barra.")
            if barra["estado"] is not True:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La barra debe estar activa para asociar un movimiento.")

        caja_id = movimiento_data.id_caja
        if caja_id is None:
            caja = (await self.db.execute(
                text("""
                    SELECT id
                    FROM caja
                    WHERE LOWER(TRIM(estado::text)) = 'abierta'
                    ORDER BY id DESC
                    LIMIT 1;
                """)
            )).first()
            if not caja:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No hay una caja abierta.")
            caja_id = caja.id
        else:
            caja = (await self.db.execute(
                text("""
                    SELECT id
                    FROM caja
                    WHERE id = :id AND LOWER(TRIM(estado::text)) = 'abierta';
                """),
                {"id": caja_id},
            )).first()
            if not caja:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La caja asociada debe estar abierta.")

        query = text("""
            INSERT INTO movimiento (estado, propina, domicilio, total, id_caja, metodo, id_cliente, id_mesero, "fecha-hora")
            VALUES (:estado, :propina, :domicilio, :total, :id_caja, :metodo, :id_cliente, :id_mesero,
                    COALESCE(:fecha_hora, CURRENT_TIMESTAMP))
            RETURNING id, estado, propina, domicilio, total, id_caja, metodo, id_cliente, id_mesero, "fecha-hora" AS fecha_hora;
        """)
        try:
            result = await self.db.execute(query, {
                "estado": movimiento_data.estado,
                "propina": movimiento_data.propina,
                "domicilio": movimiento_data.domicilio,
                "total": movimiento_data.total,
                "id_caja": caja_id,
                "metodo": movimiento_data.metodo,
                "id_cliente": movimiento_data.id_cliente,
                "id_mesero": movimiento_data.id_mesero,
                "fecha_hora": movimiento_data.fecha_hora
            })
            movimiento = dict(result.mappings().first())
            movimiento["id_mesa"] = movimiento_data.id_mesa
            if movimiento_data.id_mesa is not None:
                await self.db.execute(
                    text("INSERT INTO barra (id_mesa, id_movimiento) VALUES (:id_mesa, :id_movimiento);"),
                    {"id_mesa": movimiento_data.id_mesa, "id_movimiento": movimiento["id"]},
                )
            await self.db.commit()
            return movimiento
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error al insertar movimiento: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno del servidor.")

    async def update_movimiento(self, target_movimiento_id: int, movimiento_update: MovimientoUpdate, current_user: dict) -> dict:
        logger.info(f"Usuario '{current_user['username']}' intenta modificar el movimiento ID: {target_movimiento_id}")

        # Verificar que el usuario objetivo realmente exista en PostgreSQL
        check = await self.db.execute(text("SELECT id FROM movimiento WHERE id = :id;"), {"id": target_movimiento_id})
        if not check.first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El movimiento a modificar no existe.")

        # Construcción dinámica de la sentencia UPDATE con SQL Puro
        update_fields = []
        params = {"id": target_movimiento_id}

        if movimiento_update.estado is not None:
            update_fields.append("estado = :estado")
            params["estado"] = movimiento_update.estado

        if movimiento_update.propina is not None:
            update_fields.append("propina = :propina")
            params["propina"] = movimiento_update.propina

        if movimiento_update.domicilio is not None:
            update_fields.append("domicilio = :domicilio")
            params["domicilio"] = movimiento_update.domicilio

        if movimiento_update.total is not None:
            update_fields.append("total = :total")
            params["total"] = movimiento_update.total

        if movimiento_update.id_caja is not None:
            update_fields.append("id_caja = :id_caja")
            params["id_caja"] = movimiento_update.id_caja

        if movimiento_update.metodo is not None:
            update_fields.append("metodo = :metodo")
            params["metodo"] = movimiento_update.metodo

        if movimiento_update.id_cliente is not None:
            update_fields.append("id_cliente = :id_cliente")
            params["id_cliente"] = movimiento_update.id_cliente

        if movimiento_update.id_mesero is not None:
            update_fields.append("id_mesero = :id_mesero")
            params["id_mesero"] = movimiento_update.id_mesero

        if movimiento_update.fecha_hora is not None:
            update_fields.append('"fecha-hora" = :fecha_hora')
            params["fecha_hora"] = movimiento_update.fecha_hora

        if not update_fields:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se enviaron datos para actualizar.")

        # Unificar campos en el string de SQL Nativo
        query_str = f"""
            UPDATE movimiento 
            SET {', '.join(update_fields)} 
            WHERE id = :id 
            RETURNING id, estado, propina, domicilio, total, id_caja, metodo, id_cliente, id_mesero, "fecha-hora" AS fecha_hora;
        """
        
        try:
            result = await self.db.execute(text(query_str), params)
            await self.db.commit()
            return dict(result.mappings().first())
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error crítico en actualización SQL: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al procesar los datos.")
