import asyncio
from io import BytesIO

import cloudinary.uploader
from fastapi import HTTPException, status

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from modules.productos.productos_schema import (
    ProductoCreate,
    ProductoUpdate
)

from core.logger import logger


class ProductoService:

    def __init__(self, db: AsyncSession) -> None:

        self.db = db


    # ======================================================
    # LISTAR PRODUCTOS
    # ======================================================

    async def get_all_productos(self) -> list[dict]:

        logger.info(
            "SQL Nativo: Consultando todos los productos."
        )


        query = text("""
            SELECT
                p.id,
                p.nombre,
                p.descripcion,
                p.cantidad,
                p.precio,
                p.id_categoria,
                p.preparacion,
                p.estado,
                (
                    SELECT pi.url
                    FROM producto_imagenes pi
                    WHERE pi.producto_id = p.id AND pi.es_principal = TRUE
                    ORDER BY pi.orden ASC, pi.id ASC
                    LIMIT 1
                ) AS imagen_url
            FROM productos p
            ORDER BY p.id ASC;
        """)


        result = await self.db.execute(query)


        return [
            dict(row)
            for row in result.mappings().all()
        ]


    async def get_producto_image(self, producto_id: int) -> dict | None:

        result = await self.db.execute(
            text("""
                SELECT
                    id,
                    producto_id,
                    url,
                    public_id,
                    es_principal,
                    orden
                FROM producto_imagenes
                WHERE producto_id = :producto_id
                ORDER BY es_principal DESC, orden ASC, id ASC
                LIMIT 1;
            """),
            {"producto_id": producto_id}
        )
        image = result.mappings().first()
        return dict(image) if image else None


    async def get_producto_images(self, producto_id: int) -> list[dict]:

        result = await self.db.execute(
            text("""
                SELECT id, producto_id, url, public_id, es_principal, orden
                FROM producto_imagenes
                WHERE producto_id = :producto_id
                ORDER BY es_principal DESC, orden ASC, id ASC;
            """),
            {"producto_id": producto_id}
        )
        return [dict(row) for row in result.mappings().all()]


    async def save_producto_images(
        self,
        producto_id: int,
        images: list[tuple[bytes, str]]
    ) -> list[dict]:

        product = await self.db.execute(
            text("SELECT id FROM productos WHERE id = :id FOR UPDATE;"),
            {"id": producto_id}
        )
        if not product.first():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El producto no existe."
            )

        principal_result = await self.db.execute(
            text("""
                SELECT id
                FROM producto_imagenes
                WHERE producto_id = :producto_id AND es_principal = TRUE;
            """),
            {"producto_id": producto_id}
        )
        has_principal = principal_result.first() is not None
        order_result = await self.db.execute(
            text("""
                SELECT COALESCE(MAX(orden), -1) + 1
                FROM producto_imagenes
                WHERE producto_id = :producto_id;
            """),
            {"producto_id": producto_id}
        )
        next_order = order_result.scalar_one()
        uploaded_images: list[dict] = []

        try:
            for index, (image_data, _) in enumerate(images):
                upload_result = await asyncio.to_thread(
                    cloudinary.uploader.upload,
                    BytesIO(image_data),
                    folder="productos",
                    resource_type="image"
                )
                image_url = upload_result.get("secure_url")
                public_id = upload_result.get("public_id")
                if not image_url or not public_id:
                    raise ValueError("Cloudinary no devolvió la URL o el identificador de la imagen.")
                uploaded_images.append({
                    "url": image_url,
                    "public_id": public_id,
                    "orden": next_order + index,
                    "es_principal": not has_principal and index == 0,
                })
        except Exception as error:
            await self.db.rollback()
            for uploaded_image in uploaded_images:
                try:
                    await asyncio.to_thread(
                        cloudinary.uploader.destroy,
                        uploaded_image["public_id"],
                        resource_type="image"
                    )
                except Exception as cleanup_error:
                    logger.error(f"No se pudo limpiar la imagen {uploaded_image['public_id']} de Cloudinary: {cleanup_error}")
            logger.error(f"Error al subir imagen del producto {producto_id} a Cloudinary: {error}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="No fue posible subir la imagen a Cloudinary."
            ) from error

        try:
            for uploaded_image in uploaded_images:
                result = await self.db.execute(
                    text("""
                        INSERT INTO producto_imagenes (
                            producto_id,
                            url,
                            public_id,
                            es_principal,
                            orden
                        )
                        VALUES (
                            :producto_id,
                            :url,
                            :public_id,
                            :es_principal,
                            :orden
                        )
                        RETURNING id, producto_id, url, public_id, es_principal, orden;
                    """),
                    {
                        "producto_id": producto_id,
                        **uploaded_image,
                    }
                )
                uploaded_image.update(dict(result.mappings().one()))
            await self.db.commit()
        except Exception as error:
            await self.db.rollback()
            for uploaded_image in uploaded_images:
                try:
                    await asyncio.to_thread(
                        cloudinary.uploader.destroy,
                        uploaded_image["public_id"],
                        resource_type="image"
                    )
                except Exception as cleanup_error:
                    logger.error(f"No se pudo limpiar la imagen {uploaded_image['public_id']} de Cloudinary: {cleanup_error}")
            logger.error(f"Error al guardar imagen del producto {producto_id}: {error}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No fue posible guardar la imagen del producto."
            ) from error

        return uploaded_images


    async def set_producto_main_image(
        self,
        producto_id: int,
        image_id: int
    ) -> dict:

        image_result = await self.db.execute(
            text("""
                SELECT id
                FROM producto_imagenes
                WHERE id = :image_id AND producto_id = :producto_id;
            """),
            {"image_id": image_id, "producto_id": producto_id}
        )
        if not image_result.first():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="La imagen no pertenece a este producto."
            )

        try:
            await self.db.execute(
                text("""
                    UPDATE producto_imagenes
                    SET es_principal = (id = :image_id)
                    WHERE producto_id = :producto_id;
                """),
                {"image_id": image_id, "producto_id": producto_id}
            )
            result = await self.db.execute(
                text("""
                    SELECT id, producto_id, url, public_id, es_principal, orden
                    FROM producto_imagenes
                    WHERE id = :image_id;
                """),
                {"image_id": image_id}
            )
            await self.db.commit()
            return dict(result.mappings().one())
        except Exception as error:
            await self.db.rollback()
            logger.error(f"Error al marcar imagen principal del producto {producto_id}: {error}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No fue posible cambiar la imagen principal."
            ) from error


    # ======================================================
    # REGISTRAR PRODUCTO
    # ======================================================

    async def create_producto(
        self,
        producto_data: ProductoCreate
    ) -> dict:

        logger.info(
            f"SQL Nativo: Insertando producto {producto_data.nombre}"
        )


        # --------------------------------------------------
        # VERIFICAR SI YA EXISTE
        # --------------------------------------------------

        check = await self.db.execute(
            text("""
                SELECT id
                FROM productos
                WHERE nombre = :nombre;
            """),
            {
                "nombre": producto_data.nombre
            }
        )


        if check.first():

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El producto ya existe."
            )


        # --------------------------------------------------
        # INSERTAR
        # --------------------------------------------------

        query = text("""
            INSERT INTO productos (
                nombre,
                descripcion,
                cantidad,
                precio,
                id_categoria,
                preparacion,
                estado
            )
            VALUES (
                :nombre,
                :descripcion,
                :cantidad,
                :precio,
                :id_categoria,
                :preparacion,
                :estado
            )
            RETURNING
                id,
                nombre,
                descripcion,
                cantidad,
                precio,
                id_categoria,
                preparacion,
                estado;
        """)


        try:

            result = await self.db.execute(
                query,
                {
                    "nombre": producto_data.nombre,
                    "descripcion": producto_data.descripcion,
                    "cantidad": producto_data.cantidad,
                    "precio": producto_data.precio,
                    "id_categoria": producto_data.id_categoria,
                    "preparacion": producto_data.preparacion,
                    "estado": True
                }
            )


            await self.db.commit()


            return dict(
                result.mappings().first()
            )


        except Exception as e:

            await self.db.rollback()

            logger.error(
                f"Error al insertar producto: {str(e)}"
            )

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error interno del servidor."
            )


    # ======================================================
    # EDITAR PRODUCTO
    # ======================================================

    async def update_producto(
        self,
        target_producto_id: int,
        producto_update: ProductoUpdate,
        current_user: dict
    ) -> dict:

        logger.info(
            f"Usuario '{current_user['username']}' "
            f"intenta modificar el producto ID: "
            f"{target_producto_id}"
        )


        # --------------------------------------------------
        # VERIFICAR PRODUCTO
        # --------------------------------------------------

        check = await self.db.execute(
            text("""
                SELECT id
                FROM productos
                WHERE id = :id;
            """),
            {
                "id": target_producto_id
            }
        )


        if not check.first():

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El producto a modificar no existe."
            )


        # --------------------------------------------------
        # CAMPOS A ACTUALIZAR
        # --------------------------------------------------

        update_fields = []

        params = {
            "id": target_producto_id
        }


        if producto_update.nombre is not None:

            update_fields.append(
                "nombre = :nombre"
            )

            params["nombre"] = producto_update.nombre


        if producto_update.descripcion is not None:

            update_fields.append(
                "descripcion = :descripcion"
            )

            params["descripcion"] = producto_update.descripcion


        if producto_update.cantidad is not None:

            update_fields.append(
                "cantidad = :cantidad"
            )

            params["cantidad"] = producto_update.cantidad


        if producto_update.precio is not None:

            update_fields.append(
                "precio = :precio"
            )

            params["precio"] = producto_update.precio


        if producto_update.id_categoria is not None:

            update_fields.append(
                "id_categoria = :id_categoria"
            )

            params["id_categoria"] = producto_update.id_categoria


        if producto_update.preparacion is not None:

            update_fields.append(
                "preparacion = :preparacion"
            )

            params["preparacion"] = producto_update.preparacion


        if producto_update.estado is not None:

            update_fields.append(
                "estado = :estado"
            )

            params["estado"] = producto_update.estado


        # --------------------------------------------------
        # VALIDAR CAMBIOS
        # --------------------------------------------------

        if not update_fields:

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se enviaron datos para actualizar."
            )


        # --------------------------------------------------
        # ACTUALIZAR
        # --------------------------------------------------

        query_str = f"""
            UPDATE productos
            SET {', '.join(update_fields)}
            WHERE id = :id
            RETURNING
                id,
                nombre,
                descripcion,
                cantidad,
                precio,
                id_categoria,
                preparacion,
                estado;
        """


        try:

            result = await self.db.execute(
                text(query_str),
                params
            )


            await self.db.commit()


            return dict(
                result.mappings().first()
            )


        except Exception as e:

            await self.db.rollback()

            logger.error(
                f"Error crítico en actualización SQL: {str(e)}"
            )

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al procesar los datos."
            )


    # ======================================================
    # CAMBIAR ESTADO
    # ======================================================

    async def cambiar_estado_producto(
        self,
        target_producto_id: int,
        estado: bool
    ) -> dict:

        logger.info(
            f"Intentando cambiar el estado del "
            f"producto ID: {target_producto_id}"
        )


        # --------------------------------------------------
        # VERIFICAR PRODUCTO
        # --------------------------------------------------

        check = await self.db.execute(
            text("""
                SELECT id
                FROM productos
                WHERE id = :id;
            """),
            {
                "id": target_producto_id
            }
        )


        if not check.first():

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El producto a desactivar no existe."
            )


        # --------------------------------------------------
        # CAMBIAR ESTADO
        # --------------------------------------------------

        query = text("""
            UPDATE productos
            SET estado = :estado
            WHERE id = :id
            RETURNING
                id,
                nombre,
                descripcion,
                cantidad,
                precio,
                id_categoria,
                preparacion,
                estado;
        """)


        try:

            result = await self.db.execute(
                query,
                {
                    "id": target_producto_id,
                    "estado": estado
                }
            )


            await self.db.commit()


            return dict(
                result.mappings().first()
            )


        except Exception as e:

            await self.db.rollback()

            logger.error(
                f"Error al cambiar el estado "
                f"del producto: {str(e)}"
            )

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error interno del servidor."
            )