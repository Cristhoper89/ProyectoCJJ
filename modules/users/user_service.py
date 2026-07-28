from fastapi import HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from modules.users.user_schema import UserCreate
from core.security import hash_password
from core.logger import logger
from modules.users.user_schema import UserUpdate


# Gestionar la lógica de negocio de los usuarios
class UserService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # Obtener todos los usuarios registrados
    async def get_all_users(self) -> list[dict]:
        logger.info("SQL Nativo: Consultando todos los usuarios.")

        query = text(
            "SELECT id, username, email, is_active, role_id, created_at, last_login FROM users ORDER BY id ASC;"
        )

        result = await self.db.execute(query)

        return [dict(row) for row in result.mappings().all()]

    # Crear un usuario desde el panel de administración
    async def create_user(self, user_data: UserCreate) -> dict:
        logger.info(f"SQL Nativo: Registrando usuario {user_data.username}")

        # Verificar que el usuario o correo no existan
        dup = await self.db.execute(
            text("SELECT id FROM users WHERE username = :username OR email = :email;"),
            {"username": user_data.username, "email": user_data.email}
        )

        if dup.first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El usuario o correo ya existen."
            )

        # Verificar que el rol exista
        role_check = await self.db.execute(
            text("SELECT id FROM roles WHERE id = :role_id;"),
            {"role_id": user_data.role_id}
        )

        if not role_check.first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El role_id proveído no existe."
            )

        # Cifrar la contraseña
        hashed_pwd = hash_password(user_data.password)

        query = text(
            "INSERT INTO users (username, email, hashed_password, is_active, role_id, created_at) VALUES (:username, :email, :hashed_password, TRUE, :role_id, Now() AT TIME ZONE 'America/Bogota') RETURNING id, username, email, is_active, role_id, created_at;"
        )

        try:

            result = await self.db.execute(
                query,
                {
                    "username": user_data.username,
                    "email": user_data.email,
                    "hashed_password": hashed_pwd,
                    "role_id": user_data.role_id
                }
            )

            await self.db.commit()

            return dict(result.mappings().first())

        # Manejar errores al crear el usuario
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error al guardar usuario: {str(e)}")

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al crear el usuario."
            )

    # Registrar un nuevo cliente
    async def register_user(self, user_data: UserCreate) -> dict:
        logger.info(f"SQL Nativo: Registrando usuario {user_data.username}")

        # Verificar que el usuario o correo no existan
        dup = await self.db.execute(
            text("SELECT id FROM users WHERE username = :username OR email = :email;"),
            {"username": user_data.username, "email": user_data.email}
        )

        if dup.first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El usuario o correo ya existen."
            )

        # Validar que solo se registre con el rol permitido
        if user_data.role_id != 5:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No puedes registrarte con un rol distinto al predeterminado."
            )

        # Verificar que el rol exista
        role_check = await self.db.execute(
            text("SELECT id FROM roles WHERE id = :role_id;"),
            {"role_id": user_data.role_id}
        )

        if not role_check.first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El role_id proveído no existe."
            )

        # Cifrar la contraseña
        hashed_pwd = hash_password(user_data.password)

        # Registrar el usuario en la base de datos
        query = text(
            "INSERT INTO users (username, email, hashed_password, is_active, role_id) VALUES (:username, :email, :hashed_password, TRUE, :role_id) RETURNING id, username, email, is_active, role_id;"
        )

        try:

            result = await self.db.execute(
                query,
                {
                    "username": user_data.username,
                    "email": user_data.email,
                    "hashed_password": hashed_pwd,
                    "role_id": user_data.role_id
                }
            )

            await self.db.commit()

            return dict(result.mappings().first())

        # Manejar errores durante el registro
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error al guardar usuario: {str(e)}")

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al crear el usuario."
            )

    # Actualizar la información de un usuario
    async def update_user(
        self,
        target_user_id: int,
        user_update: UserUpdate,
        current_user: dict
    ) -> dict:

        logger.info(
            f"Usuario '{current_user['username']}' intenta modificar el usuario ID: {target_user_id}"
        )

        # Validar que el usuario tenga permiso para editar
        if (
            current_user["role_name"] != "Administrador"
            and current_user["id"] != target_user_id
        ):

            logger.warning(
                f"Acceso denegado para '{current_user['username']}'"
            )

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permiso denegado. No tienes autorización para modificar datos de otros usuarios."
            )

        # Evitar que un usuario cambie su rol o estado
        if current_user["role_name"] != "Administrador":

            if (
                user_update.role_id is not None
                or user_update.is_active is not None
            ):

                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permiso denegado. Solo un Administrador puede alterar roles o estados."
                )

        # Verificar que el usuario exista
        check = await self.db.execute(
            text("SELECT id FROM users WHERE id = :id;"),
            {"id": target_user_id}
        )

        if not check.first():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El usuario a modificar no existe."
            )

        # Preparar los campos a actualizar
        update_fields = []
        params = {"id": target_user_id}

        # Actualizar el correo
        if user_update.email is not None:

            dup_email = await self.db.execute(
                text(
                    "SELECT id FROM users WHERE email = :email AND id != :id;"
                ),
                {
                    "email": user_update.email,
                    "id": target_user_id
                }
            )

            if dup_email.first():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El correo ya está registrado."
                )

            update_fields.append("email = :email")
            params["email"] = user_update.email

        # Actualizar la contraseña
        if user_update.password is not None:

            update_fields.append(
                "hashed_password = :hashed_password"
            )

            params["hashed_password"] = hash_password(
                user_update.password
            )

        # Actualizar el rol
        if user_update.role_id is not None:

            role_exist = await self.db.execute(
                text("SELECT id FROM roles WHERE id = :r_id;"),
                {"r_id": user_update.role_id}
            )

            if not role_exist.first():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El rol asignado no existe."
                )

            update_fields.append("role_id = :role_id")
            params["role_id"] = user_update.role_id

        # Actualizar el estado del usuario
        if user_update.is_active is not None:

            update_fields.append("is_active = :is_active")
            params["is_active"] = user_update.is_active

        # Verificar que existan datos para actualizar
        if not update_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se enviaron datos para actualizar."
            )

        # Construir la consulta UPDATE
        query_str = f"""
            UPDATE users
            SET {', '.join(update_fields)}
            WHERE id = :id
            RETURNING id, username, email, is_active, role_id;
        """

        # Ejecutar la actualización
        try:

            result = await self.db.execute(
                text(query_str),
                params
            )

            await self.db.commit()

            return dict(result.mappings().first())

        # Manejar errores durante la actualización
        except Exception as e:

            await self.db.rollback()

            logger.error(
                f"Error crítico en actualización SQL: {str(e)}"
            )

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al procesar los datos."
            )