from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

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
from core.logger import logger

@asynccontextmanager
async def lifespan(app: FastAPI):
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
# ==============================
# FRONTEND
# ==============================

app.mount(
    "/static",
    StaticFiles(directory="../frontend/static"),
    name="static"
)


@app.get("/")
async def login():

    return FileResponse("../frontend/templates/login.html")

@app.get("/desbloquear")
async def desbloquear():

    return FileResponse("../frontend/templates/desbloquear_cuenta.html")


@app.get("/recuperar")
async def recuperar():

    return FileResponse("../frontend/templates/olvido_contrasena.html")