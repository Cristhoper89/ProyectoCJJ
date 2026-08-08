from fastapi import HTTPException, status
from sqlalchemy import UUID, text
from sqlalchemy.ext.asyncio import AsyncSession
from modules.empresa.empresa_schema import EmpresaCreate, EmpresaResponse, EmpresaUpdate
from core.logger import logger

class EmpresaService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_empresas(self) -> list[dict]:
        logger.info("SQL Nativo: Consultando todas las empresas.")
        query = text("SELECT id, nombre, \"NIT\", telefono, direccion, correo FROM empresa ORDER BY id ASC;")
        result = await self.db.execute(query)
        return [dict(row) for row in result.mappings().all()]

    async def update_empresa(self, target_empresa_id: UUID, empresa_update: EmpresaUpdate, current_user: dict) -> dict:
        logger.info(f"Usuario '{current_user['username']}' intenta modificar la empresa ID: {target_empresa_id}")

        # Verificar que el usuario objetivo realmente exista en PostgreSQL
        check = await self.db.execute(text("SELECT id FROM empresa WHERE id = :id;"), {"id": target_empresa_id})
        if not check.first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La empresa a modificar no existe.")

        # Construcción dinámica de la sentencia UPDATE con SQL Puro
        update_fields = []
        params = {"id": target_empresa_id}

        if empresa_update.nombre is not None:
            update_fields.append("nombre = :nombre")
            params["nombre"] = empresa_update.nombre

        if empresa_update.NIT is not None:
            update_fields.append("\"NIT\" = :NIT")
            params["NIT"] = empresa_update.NIT

        if empresa_update.telefono is not None:
            update_fields.append("telefono = :telefono")
            params["telefono"] = empresa_update.telefono

        if empresa_update.correo is not None:
            update_fields.append("correo = :correo")
            params["correo"] = empresa_update.correo

        if empresa_update.direccion is not None:
            update_fields.append("direccion = :direccion")
            params["direccion"] = empresa_update.direccion
        
        if not update_fields:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se enviaron datos para actualizar.")

        # Unificar campos en el string de SQL Nativo
        query_str = f"""
            UPDATE empresa 
            SET {', '.join(update_fields)} 
            WHERE id = :id 
            RETURNING id, nombre, \"NIT\", telefono, direccion, correo;
        """
        
        try:
            result = await self.db.execute(text(query_str), params)
            await self.db.commit()
            return dict(result.mappings().first())
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error crítico en actualización SQL: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al procesar los datos.")
