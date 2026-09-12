from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from modules.producto_ingredientes.producto_ingredientes_schema import (
    ProductoIngredienteCreate,
    ProductoIngredienteUpdate,
)


class ProductoIngredienteService:
    columns = "id, id_producto, id_ingrediente"

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_all(self) -> list[dict]:
        result = await self.db.execute(
            text(f"SELECT {self.columns} FROM producto_ingredientes ORDER BY id ASC;")
        )
        return [dict(row) for row in result.mappings().all()]

    async def create(self, data: ProductoIngredienteCreate) -> dict:
        result = await self.db.execute(
            text(f"""
                INSERT INTO producto_ingredientes (id_producto, id_ingrediente)
                VALUES (:id_producto, :id_ingrediente)
                RETURNING {self.columns};
            """),
            data.model_dump(),
        )
        await self.db.commit()
        return dict(result.mappings().first())

    async def update(self, item_id: int, data: ProductoIngredienteUpdate) -> dict:
        values = data.model_dump(exclude_none=True)
        if not values:
            raise HTTPException(status_code=400, detail="No se enviaron datos para actualizar.")
        values["id"] = item_id
        assignments = [f"{field} = :{field}" for field in values if field != "id"]
        result = await self.db.execute(
            text(f"""
                UPDATE producto_ingredientes SET {', '.join(assignments)}
                WHERE id = :id
                RETURNING {self.columns};
            """),
            values,
        )
        row = result.mappings().first()
        if row is None:
            await self.db.rollback()
            raise HTTPException(status_code=404, detail="La relación no existe.")
        await self.db.commit()
        return dict(row)

    async def delete(self, item_id: int) -> None:
        result = await self.db.execute(
            text("DELETE FROM producto_ingredientes WHERE id = :id RETURNING id;"),
            {"id": item_id},
        )
        if result.first() is None:
            await self.db.rollback()
            raise HTTPException(status_code=404, detail="La relación no existe.")
        await self.db.commit()