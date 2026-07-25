import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from modules.auth.mailer_schema import ForgotPasswordRequest, ResetPasswordRequest
from core.database import get_db
from core.mailer import enviar_correo_recuperacion
from core.security import hash_password  # Usamos la función de hash bcrypt de tu core/security.py
from modules.auth.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Autenticación"])

@router.post("/login", status_code=status.HTTP_200_OK)
async def sign_in(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    service = AuthService(db)
    token = await service.login(form_data.username, form_data.password)
    return {"access_token": token, "token_type": "bearer"}

# 1. SOLICITAR CÓDIGO DE RECUPERACIÓN (SQL NATIVO)
@router.post("/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(req: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    # A. Buscar si existe el correo con SQL Nativo (ajusta 'email' o 'users' según tu script DDL de la BD)
    query_search = text("SELECT id FROM users WHERE email = :email;")
    result = await db.execute(query_search, {"email": req.correo})
    user = result.mappings().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="No existe una cuenta asociada a este correo."
        )

    # B. Generar código seguro de 6 dígitos aleatorio
    codigo = f"{secrets.randbelow(900000) + 100000}"
    expiracion = datetime.now() + timedelta(minutes=15)

    # C. Guardar código y expiración con SQL Nativo
    query_update = text("""
        UPDATE users 
        SET codigo_r = :codigo, codigo_exp = :expiracion 
        WHERE email = :email;
    """)
    try:
        await db.execute(query_update, {
            "codigo": codigo, 
            "expiracion": expiracion, 
            "email": req.correo
        })
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al guardar el código de recuperación en la base de datos."
        )

    # D. Enviar correo electrónico
    enviado = enviar_correo_recuperacion(req.correo, codigo)
    if not enviado:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo enviar el correo de verificación."
        )

    return {"mensaje": "Código enviado a tu correo electrónico."}


# 2. CAMBIAR CONTRASEÑA CON EL CÓDIGO (SQL NATIVO)
@router.post("/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(req: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    # A. Verificar el código y que no esté expirado
    query_select = text("""
        SELECT id FROM users 
        WHERE email = :email AND codigo_r = :codigo AND codigo_exp > :ahora;
    """)
    result = await db.execute(query_select, {
        "email": req.correo,
        "codigo": req.codigo,
        "ahora": datetime.now()
    })
    user = result.mappings().first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Código inválido o ha expirado."
        )

    # B. Hashear la nueva contraseña usando hash_password() de tu security.py
    hashed_pwd = hash_password(req.nuevaContrasena)

    # C. Actualizar contraseña y limpiar campos en la BD
    query_reset = text("""
        UPDATE users 
        SET hashed_password = :hashed_password, codigo_r = NULL, codigo_exp = NULL 
        WHERE email = :email;
    """)
    try:
        await db.execute(query_reset, {
            "hashed_password": hashed_pwd,
            "email": req.correo
        })
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar la contraseña."
        )

    return {"mensaje": "¡Contraseña actualizada con éxito! Ya puedes iniciar sesión."}