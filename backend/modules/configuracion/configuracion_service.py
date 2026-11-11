from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.logger import logger
from modules.configuracion.configuracion_schema import ConfiguracionUpdate


class ConfiguracionService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_configuracion(self) -> dict:
        result = await self.db.execute(text("""
            SELECT id, propina, valor_propina, alerta_bajo_stock
            FROM configuracion
            WHERE id = 1;
        """))
        row = result.mappings().first()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="La configuración general no está inicializada en la base de datos.",
            )
        return dict(row)

    async def update_configuracion(self, configuracion: ConfiguracionUpdate) -> dict:
        try:
            result = await self.db.execute(text("""
                UPDATE configuracion
                SET propina = :propina,
                    valor_propina = :valor_propina,
                    alerta_bajo_stock = :alerta_bajo_stock
                WHERE id = 1
                RETURNING id, propina, valor_propina, alerta_bajo_stock;
            """), configuracion.model_dump())
            row = result.mappings().first()
            if not row:
                await self.db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="La configuración general no está inicializada en la base de datos.",
                )
            await self.db.commit()
            return dict(row)
        except HTTPException:
            raise
        except Exception as error:
            await self.db.rollback()
            logger.error(f"Error al actualizar la configuración general: {error}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No fue posible guardar la configuración general.",
            ) from error
