from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from modules.categorias.categorias_schema import CategoriaCreate, CategoriaUpdate
from core.logger import logger

class CategoriaService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_all_categorias(self) -> list[dict]:
        logger.info("SQL Nativo: Consultando todas las categorías.")
        query = text(
            """
            SELECT
                id,
                nombre,
                COALESCE(estado, TRUE) AS estado
            FROM categorias
            ORDER BY id ASC;
            """
        )
        result = await self.db.execute(query)
        return [dict(row) for row in result.mappings().all()]

    async def create_categoria(self, categoria_data: CategoriaCreate) -> dict:
        logger.info(f"SQL Nativo: Insertando categoría {categoria_data.nombre}")
        
        check = await self.db.execute(text("SELECT id FROM categorias WHERE nombre = :nombre;"), {"nombre": categoria_data.nombre})
        if check.first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La categoría ya existe.")

        query = text(
            """
            INSERT INTO categorias (nombre, estado)
            VALUES (:nombre, TRUE)
            RETURNING id, nombre, estado;
            """
        )
        try:
            result = await self.db.execute(query, {"nombre": categoria_data.nombre})
            await self.db.commit()
            return dict(result.mappings().first())
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error al insertar rol: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno del servidor.")
    
    async def update_categoria(self,target_categoria_id: int,categoria_update: CategoriaCreate) -> dict:
        logger.info(f"Intentando modificar la categoría ID: {target_categoria_id}")

        # Verificar que la categoría objetivo realmente exista en PostgreSQL
        check = await self.db.execute(
            text(
                "SELECT id, estado FROM categorias WHERE id = :id;"
            ),
            {"id": target_categoria_id}
        )
        categoria = check.mappings().first()
    
        if not categoria:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="La categoría a modificar no existe."
            )

        if categoria["estado"] is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se puede editar una categoría desactivada."
            )

        duplicate = await self.db.execute(
            text("""
                SELECT id
                FROM categorias
                WHERE LOWER(nombre) = LOWER(:nombre)
                AND id <> :id;
            """),
            {
                "nombre": categoria_update.nombre,
                "id": target_categoria_id
            }
        )

        if duplicate.first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La categoría ya existe."
            )
        # Construcción dinámica de la sentencia UPDATE con SQL Puro
        update_fields = []
        params = {"id": target_categoria_id}

        if categoria_update.nombre is not None:
            update_fields.append("nombre = :nombre")
            params["nombre"] = categoria_update.nombre

        if not update_fields:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se proporcionaron campos para actualizar.")

        update_query = f"""
                UPDATE categorias
                SET {', '.join(update_fields)}
                WHERE id = :id
                RETURNING id, nombre, estado;
            """
        
        try:
            result = await self.db.execute(text(update_query), params)
            await self.db.commit()
            return dict(result.mappings().first())
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error al actualizar categoría: {str(e)}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error interno del servidor.")

    async def desactivar_categoria(self, categoria_id: int) -> dict:
        logger.info(
            f"Intentando desactivar la categoría ID: {categoria_id}"
        )

        check = await self.db.execute(
            text(
                """
                SELECT
                    id,
                    COALESCE(estado, TRUE) AS estado
                FROM categorias
                WHERE id = :id;
                """
            ),
            {"id": categoria_id}
        )

        categoria = check.mappings().first()

        if not categoria:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="La categoría no existe."
            )

        if categoria["estado"] is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La categoría ya está desactivada."
            )

        try:
            query = text(
                """
                UPDATE categorias
                SET estado = FALSE
                WHERE id = :id
                RETURNING id, nombre, estado;
                """
            )

            result = await self.db.execute(
                query,
                {"id": categoria_id}
            )

            await self.db.commit()

            return dict(result.mappings().first())

        except Exception as e:
            await self.db.rollback()

            logger.error(
                f"Error al desactivar categoría: {str(e)}"
            )

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error interno del servidor."
            )