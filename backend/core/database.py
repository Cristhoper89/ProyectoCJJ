from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
    AsyncSession
)
from core.config import settings
from core.logger import logger


# Crear la conexión con la base de datos
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=True,
    pool_pre_ping=True,

    # Limitar conexiones
    pool_size=5,
    max_overflow=2,

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