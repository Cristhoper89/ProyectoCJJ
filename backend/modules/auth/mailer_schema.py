from pydantic import BaseModel, EmailStr

# Validar el correo para solicitar la recuperación de contraseña
class ForgotPasswordRequest(BaseModel):
    correo: EmailStr


# Validar el correo para solicitar el código de desbloqueo
class SendUnlockCodeRequest(BaseModel):
    correo: EmailStr


# Validar los datos para restablecer la contraseña
class ResetPasswordRequest(BaseModel):
    correo: EmailStr
    codigo: str
    nuevaContrasena: str


# Validar los datos para desbloquear la cuenta
class UnlockAccountRequest(BaseModel):
    correo: EmailStr
    codigo: str