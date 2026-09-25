from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from modules.opciones.opciones_schema import (
    GrupoOpcionCreate,
    GrupoOpcionUpdate,
    OpcionCreate,
    OpcionUpdate,
    ProductoGrupoOpcionCreate,
)


class OpcionesService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_groups(self) -> list[dict]:
        groups = (await self.db.execute(
            text("SELECT id, nombre, estado FROM grupo_opcion ORDER BY id ASC;")
        )).mappings().all()
        options = (await self.db.execute(
            text("""
                SELECT id, id_grupo_opcion, nombre, estado
                FROM opcion
                ORDER BY id ASC;
            """)
        )).mappings().all()
        options_by_group: dict[int, list[dict]] = {}
        for option in options:
            options_by_group.setdefault(option["id_grupo_opcion"], []).append(dict(option))
        return [
            {**dict(group), "opciones": options_by_group.get(group["id"], [])}
            for group in groups
        ]

    async def create_group(self, data: GrupoOpcionCreate) -> dict:
        return await self._write(
            text("""
                INSERT INTO grupo_opcion (nombre, estado)
                VALUES (:nombre, :estado)
                RETURNING id, nombre, estado;
            """),
            data.model_dump(),
            "No fue posible crear el grupo de opciones.",
        )

    async def update_group(self, item_id: int, data: GrupoOpcionUpdate) -> dict:
        values = data.model_dump(exclude_none=True)
        if not values:
            raise HTTPException(status_code=400, detail="No se enviaron datos para actualizar.")
        values["id"] = item_id
        assignments = ", ".join(f"{field} = :{field}" for field in values if field != "id")
        return await self._write(
            text(f"""
                UPDATE grupo_opcion
                SET {assignments}
                WHERE id = :id
                RETURNING id, nombre, estado;
            """),
            values,
            "No fue posible actualizar el grupo de opciones.",
            missing_detail="El grupo de opciones no existe.",
        )

    async def delete_group(self, item_id: int) -> None:
        await self._delete(
            "DELETE FROM grupo_opcion WHERE id = :id RETURNING id;",
            item_id,
            "El grupo de opciones no existe.",
        )

    async def list_options(self, group_id: int | None = None, active_only: bool = False) -> list[dict]:
        query = """
            SELECT id, id_grupo_opcion, nombre, estado
            FROM opcion
        """
        params = {}
        if group_id is not None:
            query += " WHERE id_grupo_opcion = :group_id"
            params["group_id"] = group_id
            if active_only:
                query += " AND estado = TRUE"
        query += " ORDER BY id ASC;"
        result = await self.db.execute(text(query), params)
        return [dict(row) for row in result.mappings().all()]

    async def create_option(self, data: OpcionCreate) -> dict:
        return await self._write(
            text("""
                INSERT INTO opcion (id_grupo_opcion, nombre, estado)
                VALUES (:id_grupo_opcion, :nombre, :estado)
                RETURNING id, id_grupo_opcion, nombre, estado;
            """),
            data.model_dump(),
            "No fue posible crear la opción.",
        )

    async def update_option(self, item_id: int, data: OpcionUpdate) -> dict:
        values = data.model_dump(exclude_none=True)
        if not values:
            raise HTTPException(status_code=400, detail="No se enviaron datos para actualizar.")
        values["id"] = item_id
        assignments = ", ".join(f"{field} = :{field}" for field in values if field != "id")
        return await self._write(
            text(f"""
                UPDATE opcion
                SET {assignments}
                WHERE id = :id
                RETURNING id, id_grupo_opcion, nombre, estado;
            """),
            values,
            "No fue posible actualizar la opción.",
            missing_detail="La opción no existe.",
        )

    async def delete_option(self, item_id: int) -> None:
        await self._delete(
            "DELETE FROM opcion WHERE id = :id RETURNING id;",
            item_id,
            "La opción no existe.",
        )

    async def list_product_groups(self, product_id: int) -> list[dict]:
        result = await self.db.execute(text("""
            SELECT go.id, go.nombre, go.estado
            FROM producto_grupo_opcion pgo
            JOIN grupo_opcion go ON go.id = pgo.id_grupo_opcion
            WHERE pgo.id_producto = :id_producto AND go.estado = TRUE
            ORDER BY go.id ASC;
        """), {"id_producto": product_id})
        return [dict(row) for row in result.mappings().all()]

    async def assign_group(self, data: ProductoGrupoOpcionCreate) -> dict:
        return await self._write(
            text("""
                INSERT INTO producto_grupo_opcion (id_producto, id_grupo_opcion)
                VALUES (:id_producto, :id_grupo_opcion)
                RETURNING id_producto, id_grupo_opcion;
            """),
            data.model_dump(),
            "No fue posible asignar el grupo al producto.",
        )

    async def unassign_group(self, product_id: int, group_id: int) -> None:
        result = await self.db.execute(text("""
            DELETE FROM producto_grupo_opcion
            WHERE id_producto = :id_producto AND id_grupo_opcion = :id_grupo_opcion
            RETURNING id_producto;
        """), {"id_producto": product_id, "id_grupo_opcion": group_id})
        if result.first() is None:
            await self.db.rollback()
            raise HTTPException(status_code=404, detail="La asignación no existe.")
        await self.db.commit()

    async def _write(
        self,
        query,
        params: dict,
        error_detail: str,
        missing_detail: str | None = None,
    ) -> dict:
        try:
            result = await self.db.execute(query, params)
            row = result.mappings().first()
            if row is None:
                await self.db.rollback()
                raise HTTPException(status_code=404, detail=missing_detail or error_detail)
            await self.db.commit()
            return dict(row)
        except HTTPException:
            raise
        except Exception as error:
            await self.db.rollback()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_detail) from error

    async def _delete(self, query: str, item_id: int, missing_detail: str) -> None:
        try:
            result = await self.db.execute(text(query), {"id": item_id})
            if result.first() is None:
                await self.db.rollback()
                raise HTTPException(status_code=404, detail=missing_detail)
            await self.db.commit()
        except HTTPException:
            raise
        except Exception as error:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="No fue posible eliminar el registro.") from error
