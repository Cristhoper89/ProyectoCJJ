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
        query = text("SELECT id, tipo, descripcion, estado, propina, domicilio, total, id_caja, metodo FROM movimiento ORDER BY id ASC;")
        result = await self.db.execute(query)
        return [dict(row) for row in result.mappings().all()]

    async def create_movimiento(self, movimiento_data: MovimientoCreate) -> dict:
        logger.info(f"SQL Nativo: Insertando movimiento {movimiento_data.descripcion}")

        query = text("INSERT INTO movimiento (tipo, descripcion, estado, propina, domicilio, total, id_caja, metodo) VALUES (:tipo, :descripcion, :estado, :propina, :domicilio, :total, :id_caja, :metodo) RETURNING id, tipo, descripcion, estado, propina, domicilio, total, id_caja, metodo;")
        try:
            result = await self.db.execute(query, {
                "tipo": movimiento_data.tipo,
                "descripcion": movimiento_data.descripcion,
                "estado": movimiento_data.estado,
                "propina": movimiento_data.propina,
                "domicilio": movimiento_data.domicilio,
                "total": movimiento_data.total,
                "id_caja": movimiento_data.id_caja,
                "metodo": movimiento_data.metodo
            })
            await self.db.commit()
            return dict(result.mappings().first())
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

        if movimiento_update.tipo is not None:
            update_fields.append("tipo = :tipo")
            params["tipo"] = movimiento_update.tipo

        if movimiento_update.descripcion is not None:
            update_fields.append("descripcion = :descripcion")
            params["descripcion"] = movimiento_update.descripcion

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

        if not update_fields:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se enviaron datos para actualizar.")

        # Unificar campos en el string de SQL Nativo
        query_str = f"""
            UPDATE movimiento 
            SET {', '.join(update_fields)} 
            WHERE id = :id 
            RETURNING id, tipo, descripcion, estado, propina, domicilio, total, id_caja, metodo;
        """
        
        try:
            result = await self.db.execute(text(query_str), params)
            await self.db.commit()
            return dict(result.mappings().first())
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error crítico en actualización SQL: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al procesar los datos.")
