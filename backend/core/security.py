import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from core.config import settings
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from uuid import UUID

# Cifrar la contraseña
def hash_password(password: str) -> str:
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


# Verificar que la contraseña sea correcta
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


# Generar el token JWT
def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


# Definir el endpoint donde se obtiene el token
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


# Obtener el usuario autenticado
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> dict:

    # Configurar la excepción para un token inválido
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar el token de acceso o ha expirado.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Validar y decodificar el token JWT
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        user_id: str = payload.get("user_id")

        if username is None or user_id is None:
            raise credentials_exception

        user_id = UUID(user_id)

    # Capturar errores del token
    except jwt.PyJWTError:
        raise credentials_exception

    # Consultar el usuario autenticado en la base de datos
    query = text("""
        SELECT u.id, u.username, u.email, u.is_active, u.role_id, r.name as role_name
        FROM users u
        INNER JOIN roles r ON u.role_id = r.id
        WHERE u.id = :user_id AND u.is_active = TRUE;
    """)

    result = await db.execute(query, {"user_id": user_id})
    user_row = result.mappings().first()

    # Verificar que el usuario exista y esté activo
    if not user_row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario inexistente o inhabilitado en el sistema."
        )

    # Retornar la información del usuario autenticado
    return dict(user_row)