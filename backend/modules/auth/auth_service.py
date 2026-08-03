from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from core.security import verify_password, create_access_token
from core.logger import logger
from datetime import datetime
from zoneinfo import ZoneInfo


class AuthService:

    # Inicializar el servicio de autenticación
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # Iniciar sesión del usuario
    async def login(self, username_in: str, password_in: str) -> str:
        logger.info(f"SQL Nativo: Intento de login para: {username_in}")

        # Buscar el usuario en la base de datos
        query = text(
            """SELECT id,username,email,hashed_password,is_active,role_id, intentos_fallidos,bloqueado_hasta FROM users WHERE username = :username;"""
        )
        result = await self.db.execute(query, {"username": username_in})
        user = result.mappings().first()

        # Verificar si la cuenta está bloqueada
        if user and user["bloqueado_hasta"]:
            if datetime.now() < user["bloqueado_hasta"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Cuenta bloqueada hasta {user['bloqueado_hasta']}. Puedes solicitar un código de desbloqueo.",
                )
            else:

                # Reiniciar el bloqueo cuando expire
                await self.db.execute(
                    text("""
                        UPDATE users
                        SET intentos_fallidos = 0,
                            bloqueado_hasta = NULL
                        WHERE id = :id
                    """),
                    {"id": user["id"]},
                )
                await self.db.commit()

                # Actualizar los datos del usuario en memoria
                user["intentos_fallidos"] = 0
                user["bloqueado_hasta"] = None

        # Validar que el usuario exista
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales inválidas.",
                headers={"WWW-Authenticate": "Bearer"}
            )

        # Actualizar la fecha del último inicio de sesión
        await self.db.execute(
            text("UPDATE users SET last_login = NOW() AT TIME ZONE 'America/Bogota' WHERE id = :id;"),
            {"id": user["id"]}
        )
        await self.db.commit()

        # Verificar la contraseña
        if not verify_password(password_in, user["hashed_password"]):

            intentos = user["intentos_fallidos"] + 1

            if intentos >= 5:
                await self.db.execute(
                    text("""
                        UPDATE users
                        SET intentos_fallidos = 5,
                            bloqueado_hasta = NOW() AT TIME ZONE 'America/Bogota' + INTERVAL '24 hours'
                        WHERE id = :id
                    """),
                    {"id": user["id"]}
                )

                await self.db.commit()

                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cuenta bloqueada por 24 horas. Puedes solicitar un código de desbloqueo."
                )

            # Actualizar los intentos fallidos
            await self.db.execute(
                text("""
                    UPDATE users
                    SET intentos_fallidos = :intentos
                    WHERE id = :id
                """),
                {
                    "intentos": intentos,
                    "id": user["id"]
                }
            )

            await self.db.commit()

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Credenciales inválidas. Intento {intentos} de 5.",
                headers={"WWW-Authenticate": "Bearer"}
            )

        # Verificar que el usuario esté activo
        if not user["is_active"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Usuario inactivo."
            )

        # Reiniciar los intentos fallidos
        await self.db.execute(
            text("""
                UPDATE users
                SET intentos_fallidos = 0,
                    bloqueado_hasta = NULL
                WHERE id = :id
            """),
            {"id": user["id"]}
        )

        await self.db.commit()

        # Generar el token JWT
        return create_access_token(
            data={
                "sub": user["username"],
                "user_id": user["id"],
                "role_id": user["role_id"]
            }
        )