from fastapi import HTTPException, status
from sqlalchemy import UUID, text
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

        query = text("INSERT INTO mesa (estado) VALUES (:estado) RETURNING id, estado;")
        try:
            result = await self.db.execute(query, {
                "estado": mesa_data.estado
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
            dup = await self.db.execute(
                        text("SELECT id, role_id FROM users WHERE id = :id;"),
                        {"id": mesa_update.id_mesero}
                    )

            mesero = dup.first()
                       
            if not mesero:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El mesero especificado no existe.")
            
            if mesero.role_id != 3:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El ID proporcionado no corresponde a un mesero.")

            update_fields.append("id_mesero = :id_mesero")
            params["id_mesero"] = mesa_update.id_mesero

        if mesa_update.id_cliente is not None:
            dup = await self.db.execute(
                        text("SELECT id, role_id FROM users WHERE id = :id;"),
                        {"id": mesa_update.id_cliente}
                    )

            cliente = dup.first()

            if not cliente:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El cliente especificado no existe.")

            if cliente.role_id != 5:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El ID proporcionado no corresponde a un cliente.")
            
            update_fields.append("id_cliente = :id_cliente")
            params["id_cliente"] = mesa_update.id_cliente

        if mesa_update.propina is not None:
            update_fields.append("propina = :propina")
            params["propina"] = mesa_update.propina

        if mesa_update.domicilio is not None:
            update_fields.append("domicilio = :domicilio")
            params["domicilio"] = mesa_update.domicilio

        if mesa_update.tipo is not None:
            update_fields.append("tipo = :tipo")
            params["tipo"] = mesa_update.tipo

        if mesa_update.pago_efectivo is not None:
            update_fields.append("pago_efectivo = :pago_efectivo")
            params["pago_efectivo"] = mesa_update.pago_efectivo

        if mesa_update.pago_tarjeta is not None:
            update_fields.append("pago_tarjeta = :pago_tarjeta")
            params["pago_tarjeta"] = mesa_update.pago_tarjeta

        if mesa_update.pago_transfe is not None:
            update_fields.append("pago_transfe = :pago_transfe")
            params["pago_transfe"] = mesa_update.pago_transfe

        if not update_fields:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se enviaron datos para actualizar.")

        # Unificar campos en el string de SQL Nativo
        query_str = f"""
            UPDATE mesa 
            SET {', '.join(update_fields)} 
            WHERE id = :id 
            RETURNING id, estado, hora_inicio, total, id_mesero, id_cliente, propina, domicilio, tipo, pago_efectivo, pago_tarjeta, pago_transfe;
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
        
    async def aplicar_mesero_a_mesa(self, target_mesa_id: int, id_mesero: UUID) -> dict:
        logger.info(f"Intentando asignar mesero ID: {id_mesero} a la mesa ID: {target_mesa_id}")

        # Verificar que la mesa objetivo realmente exista en PostgreSQL
        check = await self.db.execute(text("SELECT id FROM mesa WHERE id = :id;"), {"id": target_mesa_id})
        if not check.first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La mesa a asignar mesero no existe.")

        # Verificar que el mesero realmente exista en PostgreSQL
        check_mesero = await self.db.execute(text("SELECT id, role_id FROM users WHERE id = :id;"), {"id": id_mesero})
        mesero = check_mesero.first()
        if not mesero:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El mesero especificado no existe.")
        if mesero.role_id != 3:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El ID proporcionado no corresponde a un mesero.")
        query = text("UPDATE mesa SET id_mesero = :id_mesero WHERE id = :id RETURNING id, id_mesero;")
        
        try:
            result = await self.db.execute(query, {"id": target_mesa_id, "id_mesero": id_mesero})
            await self.db.commit()
            return dict(result.mappings().first())
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error crítico al asignar mesero a la mesa: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al procesar los datos.")
        
    async def aplicar_cliente_a_mesa(self, target_mesa_id: int, id_cliente: UUID) -> dict:
        logger.info(f"Intentando asignar cliente ID: {id_cliente} a la mesa ID: {target_mesa_id}")

        # Verificar que la mesa objetivo realmente exista en PostgreSQL
        check = await self.db.execute(text("SELECT id FROM mesa WHERE id = :id;"), {"id": target_mesa_id})
        if not check.first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La mesa a asignar cliente no existe.")

        # Verificar que el cliente realmente exista en PostgreSQL
        check_cliente = await self.db.execute(text("SELECT id, role_id FROM users WHERE id = :id;"), {"id": id_cliente})
        cliente = check_cliente.first()
        if not cliente:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El cliente especificado no existe.")
        if cliente.role_id != 5:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El ID proporcionado no corresponde a un cliente.")

        query = text("UPDATE mesa SET id_cliente = :id_cliente WHERE id = :id RETURNING id, id_cliente;")
        
        try:
            result = await self.db.execute(query, {"id": target_mesa_id, "id_cliente": id_cliente})
            await self.db.commit()
            return dict(result.mappings().first())
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error crítico al asignar cliente a la mesa: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al procesar los datos.")