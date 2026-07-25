from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from core.logger import logger
from modules.mesa.mesa_schema import MesaCreate, MesaUpdate

class MesaService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_all_mesas(self) -> list[dict]:
        logger.info("SQL Nativo: Consultando todas las mesas.")
        query = text("SELECT id, estado, hora_inicio, total, id_mesero, id_cliente FROM mesa ORDER BY id ASC;")
        result = await self.db.execute(query)
        return [dict(row) for row in result.mappings().all()]

    async def create_mesa(self, mesa_data: MesaCreate) -> dict:
        logger.info(f"SQL Nativo: Insertando mesa {mesa_data.estado}")

        query = text("INSERT INTO mesa (estado, hora_inicio, total, id_mesero, id_cliente) VALUES (:estado, :hora_inicio, :total, :id_mesero, :id_cliente) RETURNING id, estado, hora_inicio, total, id_mesero, id_cliente;")
        try:
            result = await self.db.execute(query, {
                "estado": mesa_data.estado,
                "hora_inicio": mesa_data.hora_inicio,
                "total": mesa_data.total,
                "propina": mesa_data.propina,
                "domicilio": mesa_data.domicilio,
                "id_mesero": mesa_data.id_mesero,
                "id_cliente": mesa_data.id_cliente
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

        if current_user["role_name"] == "Cliente" and mesa_update.id_cliente != current_user["id"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. No puedes modificar la mesa de otro cliente.")

        # Construcción dinámica de la sentencia UPDATE con SQL Puro
        update_fields = []
        params = {"id": target_mesa_id}

        if mesa_update.estado is not None:
            update_fields.append("estado = :estado")
            params["estado"] = mesa_update.estado

        if mesa_update.hora_inicio is not None:
            update_fields.append("hora_inicio = :hora_inicio")
            params["hora_inicio"] = mesa_update.hora_inicio

        if mesa_update.total is not None:
            update_fields.append("total = :total")
            params["total"] = mesa_update.total

        if mesa_update.id_mesero is not None:
            update_fields.append("id_mesero = :id_mesero")
            params["id_mesero"] = mesa_update.id_mesero

        if mesa_update.id_cliente is not None:
            update_fields.append("id_cliente = :id_cliente")
            params["id_cliente"] = mesa_update.id_cliente

        if mesa_update.propina is not None:
            update_fields.append("propina = :propina")
            params["propina"] = mesa_update.propina

        if mesa_update.domicilio is not None:
            update_fields.append("domicilio = :domicilio")
            params["domicilio"] = mesa_update.domicilio

        if not update_fields:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se enviaron datos para actualizar.")

        # Unificar campos en el string de SQL Nativo
        query_str = f"""
            UPDATE mesa 
            SET {', '.join(update_fields)} 
            WHERE id = :id 
            RETURNING id, estado, hora_inicio, total, id_mesero, id_cliente;
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

        # Verificar que la mesa objetivo realmente exista en PostgreSQL
        check = await self.db.execute(text("SELECT id FROM mesa WHERE id = :id;"), {"id": target_mesa_id})
        if not check.first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La mesa a desactivar no existe.")

        query = text("UPDATE mesa SET estado = :estado WHERE id = :id RETURNING id, estado;")
        
        try:
            result = await self.db.execute(query, {"id": target_mesa_id, "estado": estado})
            await self.db.commit()
            return dict(result.mappings().first())
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error crítico al cambiar el estado de la mesa: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al procesar los datos.")
        
    async def aplicar_mesero_a_mesa(self, target_mesa_id: int, id_mesero: int) -> dict:
        logger.info(f"Intentando asignar mesero ID: {id_mesero} a la mesa ID: {target_mesa_id}")

        # Verificar que la mesa objetivo realmente exista en PostgreSQL
        check = await self.db.execute(text("SELECT id FROM mesa WHERE id = :id;"), {"id": target_mesa_id})
        if not check.first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La mesa a asignar mesero no existe.")

        query = text("UPDATE mesa SET id_mesero = :id_mesero WHERE id = :id RETURNING id, id_mesero;")
        
        try:
            result = await self.db.execute(query, {"id": target_mesa_id, "id_mesero": id_mesero})
            await self.db.commit()
            return dict(result.mappings().first())
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error crítico al asignar mesero a la mesa: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al procesar los datos.")
        
    async def aplicar_cliente_a_mesa(self, target_mesa_id: int, id_cliente: int) -> dict:
        logger.info(f"Intentando asignar cliente ID: {id_cliente} a la mesa ID: {target_mesa_id}")

        # Verificar que la mesa objetivo realmente exista en PostgreSQL
        check = await self.db.execute(text("SELECT id FROM mesa WHERE id = :id;"), {"id": target_mesa_id})
        if not check.first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La mesa a asignar cliente no existe.")

        query = text("UPDATE mesa SET id_cliente = :id_cliente WHERE id = :id RETURNING id, id_cliente;")
        
        try:
            result = await self.db.execute(query, {"id": target_mesa_id, "id_cliente": id_cliente})
            await self.db.commit()
            return dict(result.mappings().first())
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error crítico al asignar cliente a la mesa: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al procesar los datos.")