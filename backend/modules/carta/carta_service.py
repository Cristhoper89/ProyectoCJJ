from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.logger import logger
from modules.carta.carta_schema import CartaPedidoCreate


class CartaService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_catalog(self) -> dict:
        categories_result = await self.db.execute(text("""
            SELECT id, nombre
            FROM categorias
            WHERE COALESCE(estado, FALSE) = TRUE
            ORDER BY id ASC;
        """))
        categories = [
            {"id": row["id"], "nombre": row["nombre"], "productos": []}
            for row in categories_result.mappings().all()
        ]
        categories_by_id = {category["id"]: category for category in categories}
        if not categories:
            return {"categorias": []}

        products_result = await self.db.execute(text("""
            SELECT
                p.id,
                p.nombre,
                p.descripcion,
                p.precio,
                p.id_categoria,
                COALESCE(p.preparacion, FALSE) AS preparacion,
                (
                    SELECT pi.url
                    FROM producto_imagenes pi
                    WHERE pi.producto_id = p.id AND pi.es_principal = TRUE
                    ORDER BY pi.orden ASC, pi.id ASC
                    LIMIT 1
                ) AS imagen_url
            FROM productos p
            JOIN categorias c ON c.id = p.id_categoria
            WHERE COALESCE(p.estado, FALSE) = TRUE
              AND COALESCE(c.estado, FALSE) = TRUE
            ORDER BY c.id ASC, p.id ASC;
        """))
        products_by_id: dict[int, dict] = {}
        for row in products_result.mappings().all():
            product = {
                "id": row["id"],
                "nombre": row["nombre"],
                "descripcion": row["descripcion"],
                "precio": row["precio"],
                "preparacion": row["preparacion"],
                "imagen_url": row["imagen_url"],
                "ingredientes": [],
                "grupos_opciones": [],
            }
            products_by_id[row["id"]] = product
            category = categories_by_id.get(row["id_categoria"])
            if category is not None:
                category["productos"].append(product)

        if not products_by_id:
            return {"categorias": categories}

        ingredients_result = await self.db.execute(text("""
            SELECT pi.id_producto, i.id, i.nombre
            FROM producto_ingredientes pi
            JOIN ingredientes i ON i.id = pi.id_ingrediente
            WHERE pi.id_producto = ANY(:product_ids)
              AND COALESCE(i.estado, FALSE) = TRUE
            ORDER BY pi.id_producto ASC, i.id ASC;
        """), {"product_ids": list(products_by_id)})
        for row in ingredients_result.mappings().all():
            products_by_id[row["id_producto"]]["ingredientes"].append({
                "id": row["id"],
                "nombre": row["nombre"],
            })

        groups_result = await self.db.execute(text("""
            SELECT
                pgo.id_producto,
                go.id AS grupo_id,
                go.nombre AS grupo_nombre,
                o.id AS opcion_id,
                o.nombre AS opcion_nombre
            FROM producto_grupo_opcion pgo
            JOIN grupo_opcion go ON go.id = pgo.id_grupo_opcion
            LEFT JOIN opcion o
              ON o.id_grupo_opcion = go.id
             AND COALESCE(o.estado, FALSE) = TRUE
            WHERE pgo.id_producto = ANY(:product_ids)
              AND COALESCE(go.estado, FALSE) = TRUE
            ORDER BY pgo.id_producto ASC, go.id ASC, o.id ASC;
        """), {"product_ids": list(products_by_id)})
        groups_by_product: dict[int, dict[int, dict]] = {}
        for row in groups_result.mappings().all():
            product_groups = groups_by_product.setdefault(row["id_producto"], {})
            group = product_groups.setdefault(row["grupo_id"], {
                "id": row["grupo_id"],
                "nombre": row["grupo_nombre"],
                "opciones": [],
            })
            if row["opcion_id"] is not None:
                group["opciones"].append({
                    "id": row["opcion_id"],
                    "nombre": row["opcion_nombre"],
                })
        for product_id, product_groups in groups_by_product.items():
            products_by_id[product_id]["grupos_opciones"] = list(product_groups.values())

        return {"categorias": categories}

    async def get_mesa_status(self, mesa_id: int) -> dict:
        mesa_result = await self.db.execute(text("""
            SELECT id, nombre, estado, tipo, id_mov
            FROM mesa
            WHERE id = :id;
        """), {"id": mesa_id})
        mesa = mesa_result.mappings().first()
        if mesa is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="La mesa del código QR no existe."
            )

        is_active = (
            mesa["tipo"] == "mesa"
            and mesa["estado"] is True
            and mesa["id_mov"] is not None
        )
        if not is_active:
            return {
                "mesa_id": mesa["id"],
                "mesa_nombre": mesa["nombre"] or f"Mesa {mesa['id']}",
                "activa": False,
                "total": 0,
                "items": [],
            }

        movement_result = await self.db.execute(text("""
            SELECT id, estado, propina, domicilio
            FROM movimiento
            WHERE id = :id;
        """), {"id": mesa["id_mov"]})
        movement = movement_result.mappings().first()
        if movement is None or movement["estado"] is not True:
            return {
                "mesa_id": mesa["id"],
                "mesa_nombre": mesa["nombre"] or f"Mesa {mesa['id']}",
                "activa": False,
                "total": 0,
                "items": [],
            }

        items_result = await self.db.execute(text("""
            SELECT
                mc.id,
                mc.id_producto,
                p.nombre AS producto_nombre,
                mc.cantidad,
                mc.subtotal,
                mc.notas,
                modifiers.personalizaciones
            FROM mesa_consumo mc
            JOIN productos p ON p.id = mc.id_producto
            LEFT JOIN LATERAL (
                SELECT string_agg(
                    CASE
                        WHEN mci.accion::text = 'quitar' THEN 'Sin ' || i.nombre
                        WHEN mci.accion::text = 'agregar' THEN 'Extra ' || i.nombre
                    END,
                    ', ' ORDER BY i.nombre
                ) AS personalizaciones
                FROM mesa_consumo_ingredientes mci
                JOIN ingredientes i ON i.id = mci.id_ingrediente
                WHERE mci.id_mesa_consumo = mc.id
                  AND mci.accion::text IN ('quitar', 'agregar')
            ) modifiers ON TRUE
            WHERE mc.id_mov = :movement_id
            ORDER BY mc.id ASC;
        """), {"movement_id": movement["id"]})
        items = [dict(row) for row in items_result.mappings().all()]
        subtotal = sum(float(item["subtotal"] or 0) for item in items)
        total = subtotal + float(movement["propina"] or 0) + float(movement["domicilio"] or 0)
        return {
            "mesa_id": mesa["id"],
            "mesa_nombre": mesa["nombre"] or f"Mesa {mesa['id']}",
            "activa": True,
            "total": total,
            "items": items,
        }

    async def create_order(self, mesa_id: int, pedido: CartaPedidoCreate) -> dict:
        mesa_result = await self.db.execute(text("""
            SELECT id, nombre, estado, tipo, id_mov
            FROM mesa
            WHERE id = :id
            FOR UPDATE;
        """), {"id": mesa_id})
        mesa = mesa_result.mappings().first()
        if mesa is None:
            raise HTTPException(status_code=404, detail="La mesa del código QR no existe.")
        if mesa["tipo"] != "mesa":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Los pedidos por QR están disponibles para mesas, no para la barra."
            )
        if mesa["estado"] is not True or mesa["id_mov"] is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La mesa ya no está activa. Escanea nuevamente un código QR válido."
            )

        movement_result = await self.db.execute(text("""
            SELECT id
            FROM movimiento
            WHERE id = :id AND estado = TRUE
            FOR UPDATE;
        """), {"id": mesa["id_mov"]})
        movement = movement_result.mappings().first()
        if movement is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="La mesa ya no está activa. Escanea nuevamente un código QR válido."
            )

        try:
            for line in pedido.items:
                product_result = await self.db.execute(text("""
                    SELECT id, nombre, precio, preparacion
                    FROM productos
                    WHERE id = :id AND COALESCE(estado, FALSE) = TRUE
                    FOR SHARE;
                """), {"id": line.id_producto})
                product = product_result.mappings().first()
                if product is None:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"El producto {line.id_producto} no está disponible."
                    )

                ingredient_result = await self.db.execute(text("""
                    SELECT pi.id_ingrediente
                    FROM producto_ingredientes pi
                    JOIN ingredientes i ON i.id = pi.id_ingrediente
                    WHERE pi.id_producto = :product_id
                      AND COALESCE(i.estado, FALSE) = TRUE;
                """), {"product_id": line.id_producto})
                ingredient_ids = {row["id_ingrediente"] for row in ingredient_result.mappings().all()}
                ingredient_selections = {
                    selection.id_ingrediente: selection.incluido
                    for selection in line.ingredientes
                }
                if len(ingredient_selections) != len(line.ingredientes):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="El producto contiene ingredientes repetidos en la personalización."
                    )
                if not set(ingredient_selections).issubset(ingredient_ids):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="La personalización incluye un ingrediente que no pertenece al producto."
                    )
                if not product["preparacion"] and ingredient_selections:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="El producto no admite cambios de ingredientes."
                    )

                option_selections: dict[int, int] = {}
                for selection in line.opciones:
                    if selection.id_grupo_opcion in option_selections:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Solo se permite una opción por grupo."
                        )
                    option_selections[selection.id_grupo_opcion] = selection.id_opcion

                option_names: list[str] = []
                if option_selections:
                    valid_options = await self.db.execute(text("""
                        SELECT go.id AS group_id, go.nombre AS group_name,
                               o.id AS option_id, o.nombre AS option_name
                        FROM producto_grupo_opcion pgo
                        JOIN grupo_opcion go ON go.id = pgo.id_grupo_opcion
                        JOIN opcion o ON o.id_grupo_opcion = go.id
                        WHERE pgo.id_producto = :product_id
                          AND go.estado = TRUE
                          AND o.estado = TRUE
                          AND o.id = ANY(:option_ids);
                    """), {
                        "product_id": line.id_producto,
                        "option_ids": list(option_selections.values()),
                    })
                    valid_options_by_id = {
                        row["option_id"]: row for row in valid_options.mappings().all()
                    }
                    for group_id, option_id in option_selections.items():
                        option = valid_options_by_id.get(option_id)
                        if option is None or option["group_id"] != group_id:
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Una opción seleccionada no pertenece al grupo del producto."
                            )
                        option_names.append(f"{option['group_name']}: {option['option_name']}")

                notes_parts = option_names
                if line.notas and line.notas.strip():
                    notes_parts.append(line.notas.strip())
                notes = "; ".join(notes_parts) or None
                price = float(product["precio"] or 0)
                subtotal = round(price * line.cantidad, 2)
                prepared = False if product["preparacion"] else None
                consumption_result = await self.db.execute(text("""
                    INSERT INTO mesa_consumo (
                        id_producto, id_mov, cantidad, precio_unitario,
                        subtotal, preparado, notas, descuento
                    )
                    VALUES (
                        :product_id, :movement_id, :quantity, :price,
                        :subtotal, :prepared, :notes, 0
                    )
                    RETURNING id;
                """), {
                    "product_id": line.id_producto,
                    "movement_id": movement["id"],
                    "quantity": line.cantidad,
                    "price": price,
                    "subtotal": subtotal,
                    "prepared": prepared,
                    "notes": notes,
                })
                consumption_id = consumption_result.scalar_one()

                for ingredient_id in ingredient_ids:
                    included = ingredient_selections.get(ingredient_id, True)
                    await self.db.execute(text("""
                        INSERT INTO mesa_consumo_ingredientes (
                            id_mesa_consumo, id_ingrediente, accion
                        )
                        VALUES (
                            :consumption_id, :ingredient_id,
                            CAST(:action AS tipo_accion)
                        );
                    """), {
                        "consumption_id": consumption_id,
                        "ingredient_id": ingredient_id,
                        "action": "mantener" if included else "quitar",
                    })

            await self.db.commit()
        except HTTPException:
            await self.db.rollback()
            raise
        except Exception as error:
            await self.db.rollback()
            logger.error(f"Error al registrar pedido QR en mesa {mesa_id}: {error}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No fue posible registrar el pedido."
            ) from error

        return await self.get_mesa_status(mesa_id)
