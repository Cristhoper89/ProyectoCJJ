from contextlib import asynccontextmanager
from fastapi import FastAPI

from modules.categorias.categorias_router import router as categorias_router
from modules.roles.role_router import router as role_router
from modules.users.user_router import router as user_router
from modules.auth.auth_router import router as auth_router
from modules.productos.productos_router import router as productos_router
from modules.cajas.cajas_router import router as cajas_router
from modules.mesa.mesa_router import router as mesa_router
from modules.mesa_consumo.mesa_consumo_router import router as mesa_consumo_router
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