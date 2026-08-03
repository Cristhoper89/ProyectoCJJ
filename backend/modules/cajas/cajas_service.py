from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from modules.cajas.cajas_schema import CajasCreate, CajasUpdate

from core.logger import logger

class CajasService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_all_cajas(self) -> list[dict]:
        logger.info("SQL Nativo: Consultando todos las cajas.")
        query = text("SELECT id, fecha, ingresos_efectivo, ingresos_tarjeta, ingresos_transferencia, egresos_efectivo, egresos_tarjeta, egresos_transferencia, total_propinas, balance_inicial, balance_final FROM caja ORDER BY id ASC;")
        result = await self.db.execute(query)
        return [dict(row) for row in result.mappings().all()]

    async def create_caja(self, caja_data: CajasCreate) -> dict:
        logger.info(f"SQL Nativo: Insertando caja {caja_data.fecha}")

        query = text("INSERT INTO caja (fecha, ingresos_efectivo, ingresos_tarjeta, ingresos_transferencia, egresos_efectivo, egresos_tarjeta, egresos_transferencia, total_propinas, balance_inicial, balance_final) VALUES (:fecha, :ingresos_efectivo, :ingresos_tarjeta, :ingresos_transferencia, :egresos_efectivo, :egresos_tarjeta, :egresos_transferencia, :total_propinas, :balance_inicial, :balance_final) RETURNING id, fecha, ingresos_efectivo, ingresos_tarjeta, ingresos_transferencia, egresos_efectivo, egresos_tarjeta, egresos_transferencia, total_propinas, balance_inicial, balance_final;")
        try:
            result = await self.db.execute(query, {
                "fecha": caja_data.fecha,
                "ingresos_efectivo": caja_data.ingresos_efectivo,
                "ingresos_tarjeta": caja_data.ingresos_tarjeta,
                "ingresos_transferencia": caja_data.ingresos_transferencia,
                "egresos_efectivo": caja_data.egresos_efectivo,
                "egresos_tarjeta": caja_data.egresos_tarjeta,
                "egresos_transferencia": caja_data.egresos_transferencia,
                "total_propinas": caja_data.total_propinas,
                "balance_inicial": caja_data.balance_inicial,
                "balance_final": caja_data.balance_final
            })
            await self.db.commit()
            return dict(result.mappings().first())
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error al insertar caja: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno del servidor.")
        
    async def update_caja(self, target_caja_id: int, caja_update: CajasUpdate, current_user: dict) -> dict:
        logger.info(f"Usuario '{current_user['username']}' intenta modificar la caja ID: {target_caja_id}")

        # Verificar que el usuario objetivo realmente exista en PostgreSQL
        check = await self.db.execute(text("SELECT id FROM caja WHERE id = :id;"), {"id": target_caja_id})
        if not check.first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La caja a modificar no existe.")

        # Construcción dinámica de la sentencia UPDATE con SQL Puro
        update_fields = []
        params = {"id": target_caja_id}

        if caja_update.fecha is not None:
            update_fields.append("fecha = :fecha")
            params["fecha"] = caja_update.fecha

        if caja_update.ingresos_efectivo is not None:
            update_fields.append("ingresos_efectivo = :ingresos_efectivo")
            params["ingresos_efectivo"] = caja_update.ingresos_efectivo

        if caja_update.ingresos_tarjeta is not None:
            update_fields.append("ingresos_tarjeta = :ingresos_tarjeta")
            params["ingresos_tarjeta"] = caja_update.ingresos_tarjeta

        if caja_update.ingresos_transferencia is not None:
            update_fields.append("ingresos_transferencia = :ingresos_transferencia")
            params["ingresos_transferencia"] = caja_update.ingresos_transferencia

        if caja_update.egresos_efectivo is not None:
            update_fields.append("egresos_efectivo = :egresos_efectivo")
            params["egresos_efectivo"] = caja_update.egresos_efectivo

        if caja_update.egresos_tarjeta is not None:
            update_fields.append("egresos_tarjeta = :egresos_tarjeta")
            params["egresos_tarjeta"] = caja_update.egresos_tarjeta

        if caja_update.egresos_transferencia is not None:
            update_fields.append("egresos_transferencia = :egresos_transferencia")
            params["egresos_transferencia"] = caja_update.egresos_transferencia

        if caja_update.total_propinas is not None:
            update_fields.append("total_propinas = :total_propinas")
            params["total_propinas"] = caja_update.total_propinas

        if caja_update.balance_inicial is not None:
            update_fields.append("balance_inicial = :balance_inicial")
            params["balance_inicial"] = caja_update.balance_inicial

        if caja_update.balance_final is not None:
            update_fields.append("balance_final = :balance_final")
            params["balance_final"] = caja_update.balance_final

        if not update_fields:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se enviaron datos para actualizar.")

        # Unificar campos en el string de SQL Nativo
        query_str = f"""
            UPDATE caja 
            SET {', '.join(update_fields)} 
            WHERE id = :id 
            RETURNING id, fecha, ingresos_efectivo, ingresos_tarjeta, ingresos_transferencia, egresos_efectivo, egresos_tarjeta, egresos_transferencia, total_propinas, balance_inicial, balance_final;
        """
        
        try:
            result = await self.db.execute(text(query_str), params)
            await self.db.commit()
            return dict(result.mappings().first())
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error crítico en actualización SQL: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al procesar los datos.")

    async def cambiar_estado_caja(self, target_caja_id: int, estado: bool) -> dict:
        logger.info(f"Intentando cambiar el estado de la caja ID: {target_caja_id}")

        # Verificar que la caja objetivo realmente exista en PostgreSQL
        check = await self.db.execute(text("SELECT id FROM caja WHERE id = :id;"), {"id": target_caja_id})
        if not check.first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La caja a desactivar no existe.")

        query = text("UPDATE caja SET estado = :estado WHERE id = :id RETURNING id, estado;")
        
        try:
            result = await self.db.execute(query, {"id": target_caja_id, "estado": estado})
            await self.db.commit()
            return dict(result.mappings().first())
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error crítico al cambiar el estado de la caja: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al procesar los datos.")