from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from modules.mesa_consumo_ingrediente.mesa_consumo_ingrediente_schema import (
    MesaConsumoIngredienteCreate,
    MesaConsumoIngredienteUpdate,
)


class MesaConsumoIngredienteService:
    columns = "id, id_mesa_consumo, id_ingrediente, accion"

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_all(self) -> list[dict]:
        result = await self.db.execute(
            text(f"SELECT {self.columns} FROM mesa_consumo_ingrediente ORDER BY id ASC;")
        )
        return [dict(row) for row in result.mappings().all()]

    async def create(self, data: MesaConsumoIngredienteCreate) -> dict:
        result = await self.db.execute(
            text(f"""
                INSERT INTO mesa_consumo_ingrediente (id_mesa_consumo, id_ingrediente, accion)
                VALUES (:id_mesa_consumo, :id_ingrediente, :accion)
                RETURNING {self.columns};
            """),
            data.model_dump(),
        )
        await self.db.commit()
        return dict(result.mappings().first())

    async def update(self, item_id: int, data: MesaConsumoIngredienteUpdate) -> dict:
        values = data.model_dump(exclude_none=True)
        if not values:
            raise HTTPException(status_code=400, detail="No se enviaron datos para actualizar.")
        values["id"] = item_id
        assignments = [f"{field} = :{field}" for field in values if field != "id"]
        result = await self.db.execute(
            text(f"""
                UPDATE mesa_consumo_ingrediente SET {', '.join(assignments)}
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
            text("DELETE FROM mesa_consumo_ingrediente WHERE id = :id RETURNING id;"),
            {"id": item_id},
        )
        if result.first() is None:
            await self.db.rollback()
            raise HTTPException(status_code=404, detail="La relación no existe.")
        await self.db.commit()