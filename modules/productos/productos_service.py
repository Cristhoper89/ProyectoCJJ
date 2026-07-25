from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from modules.productos.productos_schema import ProductoCreate, ProductoUpdate
from core.logger import logger

class ProductoService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_all_productos(self) -> list[dict]:
        logger.info("SQL Nativo: Consultando todos los productos.")
        query = text("SELECT id, nombre, descripcion, cantidad, precio, id_categoria, preparacion FROM productos ORDER BY id ASC;")
        result = await self.db.execute(query)
        return [dict(row) for row in result.mappings().all()]

    async def create_producto(self, producto_data: ProductoCreate) -> dict:
        logger.info(f"SQL Nativo: Insertando producto {producto_data.nombre}")

        check = await self.db.execute(text("SELECT id FROM productos WHERE nombre = :nombre;"), {"nombre": producto_data.nombre})
        if check.first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="El producto ya existe.")

        query = text("INSERT INTO productos (nombre, descripcion, cantidad, precio, id_categoria, preparacion) VALUES (:nombre, :descripcion, :cantidad, :precio, :id_categoria, :preparacion) RETURNING id, nombre, descripcion, cantidad, precio, id_categoria, preparacion;")
        try:
            result = await self.db.execute(query, {
                "nombre": producto_data.nombre,
                "descripcion": producto_data.descripcion,
                "cantidad": producto_data.cantidad,
                "precio": producto_data.precio,
                "id_categoria": producto_data.id_categoria,
                "preparacion": producto_data.preparacion
            })
            await self.db.commit()
            return dict(result.mappings().first())
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error al insertar producto: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno del servidor.")
        
    async def update_producto(self, target_producto_id: int, producto_update: ProductoUpdate, current_user: dict) -> dict:
        logger.info(f"Usuario '{current_user['username']}' intenta modificar el producto ID: {target_producto_id}")

        # Verificar que el usuario objetivo realmente exista en PostgreSQL
        check = await self.db.execute(text("SELECT id FROM productos WHERE id = :id;"), {"id": target_producto_id})
        if not check.first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El producto a modificar no existe.")

        # Construcción dinámica de la sentencia UPDATE con SQL Puro
        update_fields = []
        params = {"id": target_producto_id}

        if producto_update.nombre is not None:
            update_fields.append("nombre = :nombre")
            params["nombre"] = producto_update.nombre

        if producto_update.descripcion is not None:
            update_fields.append("descripcion = :descripcion")
            params["descripcion"] = producto_update.descripcion

        if producto_update.cantidad is not None:
            update_fields.append("cantidad = :cantidad")
            params["cantidad"] = producto_update.cantidad

        if producto_update.precio is not None:
            update_fields.append("precio = :precio")
            params["precio"] = producto_update.precio

        if producto_update.id_categoria is not None:
            update_fields.append("id_categoria = :id_categoria")
            params["id_categoria"] = producto_update.id_categoria

        if producto_update.preparacion is not None:
            update_fields.append("preparacion = :preparacion")
            params["preparacion"] = producto_update.preparacion

        if not update_fields:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se enviaron datos para actualizar.")

        # Unificar campos en el string de SQL Nativo
        query_str = f"""
            UPDATE productos 
            SET {', '.join(update_fields)} 
            WHERE id = :id 
            RETURNING id, nombre, descripcion, cantidad, precio, id_categoria, preparacion;
        """
        
        try:
            result = await self.db.execute(text(query_str), params)
            await self.db.commit()
            return dict(result.mappings().first())
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error crítico en actualización SQL: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error al procesar los datos.")

    async def cambiar_estado_producto(self, target_producto_id: int, estado: bool) -> dict:
        logger.info(f"Intentando cambiar el estado del producto ID: {target_producto_id}")

        # Verificar que el producto objetivo realmente exista en PostgreSQL
        check = await self.db.execute(text("SELECT id FROM productos WHERE id = :id;"), {"id": target_producto_id})
        if not check.first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="El producto a desactivar no existe.")

        query = text("UPDATE productos SET estado = :estado WHERE id = :id RETURNING id, estado;")
        
        try:
            result = await self.db.execute(query, {"id": target_producto_id, "estado": estado})
            await self.db.commit()
            return dict(result.mappings().first())
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error al cambiar el estado del producto: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno del servidor.")