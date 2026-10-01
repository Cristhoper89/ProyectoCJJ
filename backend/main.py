import asyncio
import cloudinary
import cloudinary.uploader


from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from core.database import engine
from core.frontend import FRONTEND_DIR

from modules.metodos_pagos.metodo_pago_router import router as metodo_pago_router
from modules.categorias.categorias_router import frontend_router as categorias_frontend_router, router as categorias_router
from modules.roles.role_router import router as role_router
from modules.users.user_router import frontend_router as users_frontend_router, router as user_router
from modules.auth.auth_router import frontend_router as auth_frontend_router, router as auth_router
from modules.productos.productos_router import frontend_router as productos_frontend_router, router as productos_router
from modules.cajas.cajas_router import frontend_router as cajas_frontend_router, router as cajas_router
from modules.mesa.mesa_router import frontend_router as mesas_frontend_router, router as mesa_router
from modules.mesa_consumo.mesa_consumo_router import router as mesa_consumo_router
from modules.proveedores.proveedores_router import router as prooveedores_router
from modules.empresa.empresa_router import frontend_router as empresa_frontend_router, router as empresa_router
from modules.movimientos.movimientos_router import frontend_router as movimientos_frontend_router, router as movimientos_router
from modules.ingredientes.ingredientes_router import frontend_router as ingredientes_frontend_router, router as ingredientes_router
from modules.producto_ingredientes.producto_ingredientes_router import router as producto_ingredientes_router
from modules.mesa_consumo_ingrediente.mesa_consumo_ingrediente_router import router as mesa_consumo_ingrediente_router
from modules.opciones.opciones_router import frontend_router as opciones_frontend_router, router as opciones_router
from modules.pedido.pedido_router import frontend_router as pedido_frontend_router, router as pedido_router
from core.mesa_realtime import listen_for_mesa_events, router as mesa_realtime_router
from core.logger import logger
from cloudinary.utils import cloudinary_url

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE mesa ADD COLUMN IF NOT EXISTS nombre VARCHAR(100);"))
            await conn.execute(text("ALTER TABLE ingredientes ADD COLUMN IF NOT EXISTS estado BOOLEAN DEFAULT TRUE;"))
            await conn.execute(text("UPDATE ingredientes SET estado = FALSE WHERE estado IS NULL;"))
            await conn.execute(text("UPDATE categorias SET estado = FALSE WHERE estado IS NULL;"))
            await conn.execute(text("UPDATE productos SET estado = FALSE WHERE estado IS NULL;"))
            await conn.execute(text("ALTER TABLE grupo_opcion ADD COLUMN IF NOT EXISTS estado BOOLEAN DEFAULT TRUE;"))
            await conn.execute(text("ALTER TABLE opcion ADD COLUMN IF NOT EXISTS estado BOOLEAN DEFAULT TRUE;"))
            await conn.execute(text("UPDATE grupo_opcion SET estado = TRUE WHERE estado IS NULL;"))
            await conn.execute(text("UPDATE opcion SET estado = TRUE WHERE estado IS NULL;"))
            await conn.execute(text("UPDATE mesa SET nombre = CASE WHEN tipo = 'barra' THEN 'Barra' ELSE 'Mesa ' || id::text END WHERE nombre IS NULL;"))
            await conn.execute(text("ALTER TABLE caja ADD COLUMN IF NOT EXISTS efectivo_contado NUMERIC(12,2);"))
            await conn.execute(text("ALTER TABLE caja ADD COLUMN IF NOT EXISTS diferencia_caja NUMERIC(12,2);"))
            await conn.execute(text("ALTER TABLE caja ADD COLUMN IF NOT EXISTS notas_cierre VARCHAR(500);"))
            await conn.execute(text("""
                ALTER TABLE mesa_consumo
                ADD COLUMN IF NOT EXISTS descuento numeric(10,2) DEFAULT 0.00;
            """))
            await conn.execute(text("ALTER TABLE mesa_consumo ADD COLUMN IF NOT EXISTS fecha_creacion TIMESTAMPTZ;"))
            await conn.execute(text("""
                UPDATE mesa_consumo mc
                SET fecha_creacion = COALESCE(m."fecha-hora", CURRENT_TIMESTAMP)
                FROM movimiento m
                WHERE mc.fecha_creacion IS NULL AND m.id = mc.id_mov;
            """))
            await conn.execute(text("UPDATE mesa_consumo SET fecha_creacion = CURRENT_TIMESTAMP WHERE fecha_creacion IS NULL;"))
            await conn.execute(text("ALTER TABLE mesa_consumo ALTER COLUMN fecha_creacion SET DEFAULT CURRENT_TIMESTAMP;"))
            await conn.execute(text("ALTER TABLE mesa_consumo ALTER COLUMN fecha_creacion SET NOT NULL;"))
    except Exception as e:
        logger.error(f"Migraciones de inicio omitidas: {str(e)}")

    logger.info("==========================================================")
    logger.info("  ¡API Modular Inicializada en Raíz con Éxito (Lifespan)!")
    logger.info("  Documentación interactiva: http://127.0.0.1:8000/docs")
    logger.info("==========================================================")

    listener_task = asyncio.create_task(listen_for_mesa_events())
    try:
        yield
    finally:
        listener_task.cancel()
        with suppress(asyncio.CancelledError):
            await listener_task
        await engine.dispose()
        logger.info("Cerrando recursos de la API de forma segura.")

app = FastAPI(
    title="API FastAPI Modular sin SRC - SQL Puro",
    version="3.1.0",
    description="Estructura limpia basada en dominios directo en raíz sin Passlib",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
app.include_router(opciones_router)
app.include_router(pedido_router)
app.include_router(mesa_realtime_router)
app.include_router(auth_frontend_router)





app.include_router(users_frontend_router)
app.include_router(categorias_frontend_router)
app.include_router(productos_frontend_router)
app.include_router(cajas_frontend_router)
app.include_router(mesas_frontend_router)
app.include_router(movimientos_frontend_router)
app.include_router(ingredientes_frontend_router)
app.include_router(opciones_frontend_router)
app.include_router(pedido_frontend_router)
app.include_router(empresa_frontend_router)

# ==============================
# FRONTEND
# ==============================

if FRONTEND_DIR.is_dir():
    app.mount(
        "/static",
        StaticFiles(directory=FRONTEND_DIR / "static"),
        name="static"
    )



# Configuration       
cloudinary.config( 
    cloud_name = "erqxtjqx", 
    api_key = "544669296561498", 
    api_secret = "TSyfX9BR4CrDBM1ChAstjxMGnW4", # Click 'View API Keys' above to copy your API secret
    secure=True
)

# Upload an image
upload_result = cloudinary.uploader.upload("https://res.cloudinary.com/demo/image/upload/getting-started/shoes.jpg",
                                           public_id="shoes")
print(upload_result["secure_url"])

# Optimize delivery by resizing and applying auto-format and auto-quality
optimize_url, _ = cloudinary_url("shoes", fetch_format="auto", quality="auto")
print(optimize_url)

# Transform the image: auto-crop to square aspect_ratio
auto_crop_url, _ = cloudinary_url("shoes", width=500, height=500, crop="auto", gravity="auto")
print(auto_crop_url)