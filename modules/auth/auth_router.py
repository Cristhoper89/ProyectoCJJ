import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from zoneinfo import ZoneInfo

from modules.auth.mailer_schema import (
    ForgotPasswordRequest,
    SendUnlockCodeRequest,
    ResetPasswordRequest,
    UnlockAccountRequest,
)

from core.database import get_db
from core.mailer import (
    enviar_correo_recuperacion,
    enviar_correo_desbloqueo,
)
from core.security import (
    hash_password,
)

from modules.auth.auth_service import AuthService

# Crear las rutas del módulo de autenticación
router = APIRouter(prefix="/auth", tags=["Autenticación"])


# Iniciar sesión
@router.post("/login", status_code=status.HTTP_200_OK)
async def sign_in(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    service = AuthService(db)
    token = await service.login(form_data.username, form_data.password)
    return {"access_token": token, "token_type": "bearer"}


# Solicitar código de recuperación de contraseña
@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(
    req: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db)
):

    # Verificar que el correo exista
    query_search = text("SELECT id FROM users WHERE email = :email;")
    result = await db.execute(query_search, {"email": req.correo})
    user = result.mappings().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No existe una cuenta asociada a este correo."
        )

    # Generar código de recuperación
    codigo = f"{secrets.randbelow(900000) + 100000}"
    expiracion = datetime.now() + timedelta(minutes=15)

    query_update = text("""
        UPDATE users
        SET codigo_r = :codigo, codigo_exp = :expiracion
        WHERE email = :email;
    """)

    try:
        await db.execute(
            query_update,
            {
                "codigo": codigo,
                "expiracion": expiracion,
                "email": req.correo
            }
        )
        await db.commit()

    # Manejar errores al guardar
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al guardar el código de recuperación en la base de datos."
        )

    # Enviar el correo de recuperación
    enviado = enviar_correo_recuperacion(req.correo, codigo)

    if not enviado:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo enviar el correo de verificación."
        )

    return {"mensaje": "Código enviado a tu correo electrónico."}


# Restablecer la contraseña
@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(
    req: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db)
):

    # Validar el código de recuperación
    query_select = text("""
        SELECT id FROM users
        WHERE email = :email
        AND codigo_r = :codigo
        AND codigo_exp > :ahora;
    """)

    result = await db.execute(
        query_select,
        {
            "email": req.correo,
            "codigo": req.codigo,
            "ahora": datetime.now()
        }
    )

    user = result.mappings().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Código inválido o ha expirado."
        )

    # Cifrar la nueva contraseña
    hashed_pwd = hash_password(req.nuevaContrasena)

    query_reset = text("""
        UPDATE users
        SET hashed_password = :hashed_password,
            codigo_r = NULL,
            codigo_exp = NULL
        WHERE email = :email;
    """)

    try:
        await db.execute(
            query_reset,
            {
                "hashed_password": hashed_pwd,
                "email": req.correo
            }
        )

        await db.commit()

    # Manejar errores al actualizar la contraseña
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar la contraseña."
        )

    return {
        "mensaje": "¡Contraseña actualizada con éxito! Ya puedes iniciar sesión."
    }


# Enviar código de desbloqueo
@router.post("/send-unlock-code", status_code=status.HTTP_200_OK)
async def send_unlock_code(
    req: SendUnlockCodeRequest,
    db: AsyncSession = Depends(get_db),
):

    # Buscar el usuario
    result = await db.execute(
        text("""
            SELECT id, bloqueado_hasta
            FROM users
            WHERE email = :email
        """),
        {"email": req.correo},
    )

    user = result.mappings().first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="No existe una cuenta asociada a este correo."
        )

    # Verificar que la cuenta esté bloqueada
    if user["bloqueado_hasta"] is None:
        raise HTTPException(
            status_code=400,
            detail="La cuenta no se encuentra bloqueada."
        )

    codigo = f"{secrets.randbelow(900000) + 100000}"
    expiracion = datetime.now() + timedelta(minutes=15)

    await db.execute(
        text("""
            UPDATE users
            SET codigo_desbloqueo = :codigo,
                codigo_expira = :expiracion
            WHERE email = :email
        """),
        {
            "codigo": codigo,
            "expiracion": expiracion,
            "email": req.correo,
        },
    )

    await db.commit()

    # Enviar el correo de desbloqueo
    enviado = enviar_correo_desbloqueo(req.correo, codigo)

    if not enviado:
        raise HTTPException(
            status_code=500,
            detail="No fue posible enviar el correo.",
        )

    return {
        "mensaje": "Código de desbloqueo enviado al correo."
    }


# Desbloquear la cuenta
@router.post("/unlock-account", status_code=status.HTTP_200_OK)
async def unlock_account(
    req: UnlockAccountRequest,
    db: AsyncSession = Depends(get_db),
):

    # Validar el código de desbloqueo
    query = text("""
        SELECT id
        FROM users
        WHERE email = :email
        AND codigo_desbloqueo = :codigo
        AND codigo_expira > :ahora;
    """)

    result = await db.execute(
        query,
        {
            "email": req.correo,
            "codigo": req.codigo,
            "ahora": datetime.now(),
        },
    )

    user = result.mappings().first()

    if not user:
        raise HTTPException(
            status_code=400,
            detail="Código inválido o expirado."
        )

    await db.execute(
        text("""
            UPDATE users
            SET intentos_fallidos = 0,
                bloqueado_hasta = NULL,
                codigo_desbloqueo = NULL,
                codigo_expira = NULL
            WHERE id = :id;
        """),
        {"id": user["id"]}
    )

    await db.commit()

    return {
        "mensaje": "Cuenta desbloqueada correctamente."
    }