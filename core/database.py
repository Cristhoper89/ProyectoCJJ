from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from core.config import settings
from core.logger import logger

# En core/database.py
engine = create_async_engine(
    settings.DATABASE_URL, 
    echo=True, 
    pool_pre_ping=True,
    connect_args={
        "server_settings": {}  # Evita que mande parámetros incompatibles
    }
)

AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception as e:
            logger.error(f"Error en la sesión de DB: {str(e)}")
            await session.rollback()
            raise e
        finally:
            await session.close()