from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from core.logger import logger
from modules.mesa_consumo.mesa_consumo_schema import MesaCreate, MesaUpdate

class MesaCService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_all_mesasC(self) -> list[dict]:
        logger.info("SQL Nativo: Consultando todas las mesas.")
        query = text("SELECT id, id_producto, id_mov, id_mesa, cantidad, precio_unitario, subtotal FROM mesa_consumo ORDER BY id ASC;")
        result = await self.db.execute(query)
        return [dict(row) for row in result.mappings().all()]

    async def create_mesaC(self, mesaC_data: MesaCreate) -> dict:
        logger.info(f"SQL Nativo: Insertando consumo de mesa {mesaC_data.id_mesa}")

        query = text("INSERT INTO mesa_consumo (id_producto, id_mov, id_mesa, cantidad, precio_unitario, subtotal) VALUES (:id_producto, :id_mov, :id_mesa, :cantidad, :precio_unitario, :subtotal) RETURNING id, id_producto, id_mov, id_mesa, cantidad, precio_unitario, subtotal;")
        try:
            result = await self.db.execute(query, {
                "id_producto": mesaC_data.id_producto,
                "id_mov": mesaC_data.id_mov,
                "id_mesa": mesaC_data.id_mesa,
                "cantidad": mesaC_data.cantidad,
                "precio_unitario": mesaC_data.precio_unitario,
                "subtotal": mesaC_data.subtotal
            })
            await self.db.commit()
            return dict(result.mappings().first())
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error al insertar mesa: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno del servidor.")
        
    async def update_mesaC(self, target_mesa_id: int, mesa_update: MesaUpdate, current_user: dict) -> dict:
        logger.info(f"Usuario '{current_user['username']}' intenta modificar la mesa ID: {target_mesa_id}")

        # Verificar que el usuario objetivo realmente exista en PostgreSQL
        check = await self.db.execute(text("SELECT id FROM mesa_consumo WHERE id = :id;"), {"id": target_mesa_id})
        if not check.first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La mesa a modificar no existe.")

        if current_user["role_name"] == "Cliente" and mesa_update.id_cliente != current_user["id"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acceso denegado. No puedes modificar la mesa de otro cliente.")

        # Construcción dinámica de la sentencia UPDATE con SQL Puro
        update_fields = []
        params = {"id": target_mesa_id}

        if mesa_update.id_producto is not None:
            update_fields.append("id_producto = :id_producto")
            params["id_producto"] = mesa_update.id_producto

        if mesa_update.id_mov is not None:
            update_fields.append("id_mov = :id_mov")
            params["id_mov"] = mesa_update.id_mov

        if mesa_update.id_mesa is not None:
            update_fields.append("id_mesa = :id_mesa")
            params["id_mesa"] = mesa_update.id_mesa

        if mesa_update.cantidad is not None:
            update_fields.append("cantidad = :cantidad")
            params["cantidad"] = mesa_update.cantidad

        if mesa_update.precio_unitario is not None:
            update_fields.append("precio_unitario = :precio_unitario")
            params["precio_unitario"] = mesa_update.precio_unitario

        if mesa_update.subtotal is not None:
            update_fields.append("subtotal = :subtotal")
            params["subtotal"] = mesa_update.subtotal

        if not update_fields:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se enviaron datos para actualizar.")

        # Unificar campos en el string de SQL Nativo
        query_str = f"""
            UPDATE mesa_consumo
            SET {', '.join(update_fields)} 
            WHERE id = :id 
            RETURNING id, id_producto, id_mov, id_mesa, cantidad, precio_unitario, subtotal;
        """
        
        try:
            result = await self.db.execute(text(query_str), params)
            await self.db.commit()
            return dict(result.mappings().first())
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error crítico en actualización SQL: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al procesar los datos.")
