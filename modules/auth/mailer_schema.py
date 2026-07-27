
# Esquemas Pydantic para validar los JSONs
from pydantic import BaseModel, EmailStr

class ForgotPasswordRequest(BaseModel):
    correo: EmailStr

class SendUnlockCodeRequest(BaseModel):
    correo: EmailStr

class ResetPasswordRequest(BaseModel):
    correo: EmailStr
    codigo: str
    nuevaContrasena: str

class UnlockAccountRequest(BaseModel):
    correo: EmailStr
    codigo: str

