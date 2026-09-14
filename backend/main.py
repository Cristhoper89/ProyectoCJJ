from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from modules.metodos_pagos.metodo_pago_router import router as metodo_pago_router
from modules.categorias.categorias_router import router as categorias_router
from modules.roles.role_router import router as role_router
from modules.users.user_router import router as user_router
from modules.auth.auth_router import router as auth_router
from modules.productos.productos_router import router as productos_router
from modules.cajas.cajas_router import router as cajas_router
from modules.mesa.mesa_router import router as mesa_router
from modules.mesa_consumo.mesa_consumo_router import router as mesa_consumo_router
from modules.proveedores.proveedores_router import router as prooveedores_router
from modules.empresa.empresa_router import router as empresa_router
from modules.movimientos.movimientos_router import router as movimientos_router
from modules.ingredientes.ingredientes_router import router as ingredientes_router
from modules.producto_ingredientes.producto_ingredientes_router import router as producto_ingredientes_router
from modules.mesa_consumo_ingrediente.mesa_consumo_ingrediente_router import router as mesa_consumo_ingrediente_router
from core.logger import logger
from core.database import engine
from sqlalchemy import text

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as connection:
        await connection.execute(text("ALTER TABLE mesa ADD COLUMN IF NOT EXISTS nombre VARCHAR(100);"))
        await connection.execute(text("UPDATE mesa SET nombre = CASE WHEN tipo IS FALSE THEN 'Barra' ELSE 'Mesa ' || id::text END WHERE nombre IS NULL;"))
        await connection.execute(text("UPDATE mesa_consumo SET id_mesa = NULL WHERE id_mov IS NOT NULL AND id_mesa IS NOT NULL;"))
    logger.info("==========================================================")
    logger.info("  ¡API Modular Inicializada en Raíz con Éxito (Lifespan)!")
    logger.info("  Documentación interactiva: http://127.0.0.1:8000/docs")
    logger.info("==========================================================")
    yield
    logger.info("Cerrando recursos de la API de forma segura.")

app = FastAPI(
    title="API FastAPI Modular sin SRC - SQL Puro",
    version="3.1.0",
    description="Estructura limpia basada en dominios directo en raíz sin Passlib",
    lifespan=lifespan
)

# Inyección directa de rutas modulares verificadas sin prefijos redundantes
app.include_router(auth_router)
app.include_router(role_router)
app.include_router(user_router)
app.include_router(categorias_router)  # Incluye el router de categorías
app.include_router(productos_router)  # Incluye el router de productos
app.include_router(cajas_router)  # Incluye el router de cajas
app.include_router(mesa_router)  # Incluye el router de mesas
app.include_router(mesa_consumo_router)  # Incluye el router de consumo de mesas
app.include_router(prooveedores_router)  # Incluye el router de proveedores
app.include_router(empresa_router)  # Incluye el router de empresas
app.include_router(movimientos_router)  # Incluye el router de movimientos
app.include_router(metodo_pago_router)  # Incluye el router de métodos de pago
app.include_router(ingredientes_router)
app.include_router(producto_ingredientes_router)
app.include_router(mesa_consumo_ingrediente_router)

# ==============================
# FRONTEND
# ==============================

if FRONTEND_DIR.is_dir():
    app.mount(
        "/static",
        StaticFiles(directory=FRONTEND_DIR / "static"),
        name="static"
    )

@app.get("/")
async def login():

    return FileResponse(FRONTEND_DIR / "templates" / "login.html")

@app.get("/desbloquear")
async def desbloquear():

    return FileResponse(FRONTEND_DIR / "templates" / "desbloquear_cuenta.html")


@app.get("/recuperar")
async def recuperar():

    return FileResponse(FRONTEND_DIR / "templates" / "olvido_contrasena.html")

@app.get("/productos")
async def ver_productos():
    return FileResponse(FRONTEND_DIR / "templates" / "productos.html")
#johan
@app.get("/categorias")
async def ver_categorias():
    return FileResponse(FRONTEND_DIR / "templates" / "categorias.html")