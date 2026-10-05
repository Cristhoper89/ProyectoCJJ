from typing import AsyncGenerator
import os
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
    AsyncSession
)
from core.config import settings
from core.logger import logger


# La base de datos es remota y cada consulta tarda ~150 ms de ida y vuelta.
# Con un pool de 1 conexion las peticiones se ejecutaban en serie (7 endpoints
# = ~7 s). Estas variables permiten ajustarlo segun los limites del servidor.
DB_POOL_SIZE = max(1, int(os.getenv("DB_POOL_SIZE", "3")))
DB_MAX_OVERFLOW = max(0, int(os.getenv("DB_MAX_OVERFLOW", "2")))
DB_ECHO = os.getenv("DB_ECHO", "false").strip().lower() in ("1", "true", "yes", "on")

# Crear la conexión con la base de datos
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=DB_ECHO,
    pool_pre_ping=True,

    # Varias conexiones para que las peticiones simultaneas no se encadenen.
    pool_size=DB_POOL_SIZE,
    max_overflow=DB_MAX_OVERFLOW,
    pool_timeout=10,

    connect_args={
        "server_settings": {}
    }
)


# Crear el generador de sesiones
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)


# Obtener y administrar la sesión
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session

        except Exception as e:
            logger.error(f"Error en la sesión de DB: {str(e)}")
            await session.rollback()
            raise

        finally:
            await session.close()