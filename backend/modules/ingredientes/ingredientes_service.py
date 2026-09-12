from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from modules.ingredientes.ingredientes_schema import (
    GastoCreate,
    GastoUpdate,
    IngredienteCreate,
    IngredienteUpdate,
)


class IngredienteService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_all(self) -> list[dict]:
        result = await self.db.execute(
            text("SELECT id, nombre FROM ingredientes ORDER BY id ASC;")
        )
        return [dict(row) for row in result.mappings().all()]

    async def create(self, data: IngredienteCreate) -> dict:
        try:
            result = await self.db.execute(
                text("""
                    INSERT INTO ingredientes (nombre)
                    VALUES (:nombre)
                    RETURNING id, nombre;
                """),
                {"nombre": data.nombre},
            )
            await self.db.commit()
            return dict(result.mappings().first())
        except Exception as error:
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fue posible crear el ingrediente.",
            ) from error

    async def update(self, item_id: int, data: IngredienteUpdate) -> dict:
        if data.nombre is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se enviaron datos para actualizar.",
            )
        try:
            result = await self.db.execute(
                text("""
                    UPDATE ingredientes
                    SET nombre = :nombre
                    WHERE id = :id
                    RETURNING id, nombre;
                """),
                {"id": item_id, "nombre": data.nombre},
            )
            row = result.mappings().first()
            if row is None:
                await self.db.rollback()
                raise HTTPException(status_code=404, detail="El ingrediente no existe.")
            await self.db.commit()
            return dict(row)
        except HTTPException:
            raise
        except Exception as error:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="No fue posible actualizar el ingrediente.") from error

    async def delete(self, item_id: int) -> None:
        result = await self.db.execute(
            text("DELETE FROM ingredientes WHERE id = :id RETURNING id;"),
            {"id": item_id},
        )
        if result.first() is None:
            await self.db.rollback()
            raise HTTPException(status_code=404, detail="El ingrediente no existe.")
        await self.db.commit()


class GastoService:
    columns = "id, id_ingrediente, nombre, descripcion, cantidad, valor, fecha, id_movimiento"

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_all(self) -> list[dict]:
        result = await self.db.execute(
            text(f"SELECT {self.columns} FROM gasto ORDER BY id ASC;")
        )
        return [dict(row) for row in result.mappings().all()]

    async def create(self, data: GastoCreate) -> dict:
        query = text(f"""
            INSERT INTO gasto (id_ingrediente, nombre, descripcion, cantidad, valor, fecha, id_movimiento)
            VALUES (:id_ingrediente, :nombre, :descripcion, :cantidad, :valor,
                    COALESCE(:fecha, CURRENT_TIMESTAMP), :id_movimiento)
            RETURNING {self.columns};
        """)
        return await self._execute_write(query, data.model_dump())

    async def update(self, item_id: int, data: GastoUpdate) -> dict:
        values = data.model_dump(exclude_none=True)
        if not values:
            raise HTTPException(status_code=400, detail="No se enviaron datos para actualizar.")
        assignments = [f"{field} = :{field}" for field in values]
        values["id"] = item_id
        query = text(f"""
            UPDATE gasto SET {', '.join(assignments)}
            WHERE id = :id
            RETURNING {self.columns};
        """)
        return await self._execute_write(query, values, missing_detail="El gasto no existe.")

    async def delete(self, item_id: int) -> None:
        result = await self.db.execute(
            text("DELETE FROM gasto WHERE id = :id RETURNING id;"),
            {"id": item_id},
        )
        if result.first() is None:
            await self.db.rollback()
            raise HTTPException(status_code=404, detail="El gasto no existe.")
        await self.db.commit()

    async def _execute_write(self, query, params: dict, missing_detail: str = "") -> dict:
        try:
            result = await self.db.execute(query, params)
            row = result.mappings().first()
            if row is None:
                await self.db.rollback()
                raise HTTPException(status_code=404, detail=missing_detail)
            await self.db.commit()
            return dict(row)
        except HTTPException:
            raise
        except Exception as error:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="No fue posible guardar el gasto.") from error