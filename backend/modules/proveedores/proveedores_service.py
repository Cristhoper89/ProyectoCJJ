from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from modules.proveedores.proveedores_schema import ProveedorCreate, ProveedorResponse, ProveedorUpdate
from core.logger import logger

class ProveedorService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_all_proveedores(self) -> list[dict]:
        logger.info("SQL Nativo: Consultando todos los proveedores.")
        query = text("SELECT id, nombre, \"NIT\", telefono, correo FROM proveedores ORDER BY id ASC;")
        result = await self.db.execute(query)
        return [dict(row) for row in result.mappings().all()]

    async def create_proveedor(self, proveedor_data: ProveedorCreate) -> dict:
        logger.info(f"SQL Nativo: Insertando proveedor {proveedor_data.nombre}")
    
        check = await self.db.execute(text("SELECT id FROM proveedores WHERE nombre = :nombre;"), {"nombre": proveedor_data.nombre})
        if check.first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El proveedor ya existe.")

        query = text("INSERT INTO proveedores (nombre, \"NIT\", telefono, correo) VALUES (:nombre, :NIT, :telefono, :correo) RETURNING id, nombre, \"NIT\", telefono, correo;")
        try:
            result = await self.db.execute(query, {
                "nombre": proveedor_data.nombre,
                "NIT": proveedor_data.NIT,
                "telefono": proveedor_data.telefono,
                "correo": proveedor_data.correo
            })
            await self.db.commit()
            return dict(result.mappings().first())
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error al insertar proveedor: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno del servidor.")

    async def update_proveedor(self, target_proveedor_id: int, proveedor_update: ProveedorUpdate, current_user: dict) -> dict:
        logger.info(f"Usuario '{current_user['username']}' intenta modificar el proveedor ID: {target_proveedor_id}")

        # Verificar que el usuario objetivo realmente exista en PostgreSQL
        check = await self.db.execute(text("SELECT id FROM proveedores WHERE id = :id;"), {"id": target_proveedor_id})
        if not check.first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El proveedor a modificar no existe.")

        # Construcción dinámica de la sentencia UPDATE con SQL Puro
        update_fields = []
        params = {"id": target_proveedor_id}

        if proveedor_update.nombre is not None:
            update_fields.append("nombre = :nombre")
            params["nombre"] = proveedor_update.nombre

        if proveedor_update.NIT is not None:
            update_fields.append("\"NIT\" = :NIT")
            params["NIT"] = proveedor_update.NIT

        if proveedor_update.telefono is not None:
            update_fields.append("telefono = :telefono")
            params["telefono"] = proveedor_update.telefono

        if proveedor_update.correo is not None:
            update_fields.append("correo = :correo")
            params["correo"] = proveedor_update.correo

        if not update_fields:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se enviaron datos para actualizar.")

        # Unificar campos en el string de SQL Nativo
        query_str = f"""
            UPDATE proveedores 
            SET {', '.join(update_fields)} 
            WHERE id = :id 
            RETURNING id, nombre, \"NIT\", telefono, correo;
        """
        
        try:
            result = await self.db.execute(text(query_str), params)
            await self.db.commit()
            return dict(result.mappings().first())
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error crítico en actualización SQL: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al procesar los datos.")
