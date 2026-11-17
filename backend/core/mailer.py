import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from core.config import settings

# Configuración de la cuenta de Gmail
GMAIL_USER = settings.GMAIL_USER
GMAIL_PASS = settings.GMAIL_PASS
GMAIL_USER = settings.GMAIL_USER
GMAIL_PASS = settings.GMAIL_PASS


# Enviar correo de recuperación de contraseña
def enviar_correo_recuperacion(correo_destino: str, codigo: str):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Código de Recuperación de Contraseña - LaCabaña"
    msg["From"] = f"LaCabaña <{GMAIL_USER}>"
    msg["To"] = correo_destino

    html_content = f"""
    <div style="background-color: #141414; color: #ffffff; padding: 20px; font-family: Arial, sans-serif; text-align: center; border: 1px solid #C9A84C; border-radius: 8px;">
        <h2 style="color: #C9A84C;">LaCabaña</h2>
        <p>Has solicitado restablecer tu contraseña.</p>
        <p>Tu código de verificación es:</p>
        <div style="background-color: #000; color: #C9A84C; font-size: 28px; font-weight: bold; letter-spacing: 5px; padding: 15px; display: inline-block; border-radius: 5px; margin: 15px 0;">
            {codigo}
        </div>
        <p style="font-size: 12px; color: #888;">Si no solicitaste este cambio, ignora este mensaje.</p>
    </div>
    """

    # Adjuntar el contenido HTML al correo
    msg.attach(MIMEText(html_content, "html"))

    try:
        # Enviar el correo mediante SMTP de Gmail
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(GMAIL_USER, GMAIL_PASS)
            server.sendmail(GMAIL_USER, correo_destino, msg.as_string())
        return True

    # Manejar errores durante el envío
    except Exception as e:
        print(f"Error al enviar correo: {e}")
        return False


# Enviar correo de desbloqueo de cuenta
def enviar_correo_desbloqueo(correo_destino: str, codigo: str):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Código de Desbloqueo de Cuenta - LaCabaña"
    msg["From"] = f"LaCabaña <{GMAIL_USER}>"
    msg["To"] = correo_destino

    html_content = f"""
    <div style="background-color: #141414; color: #ffffff; padding: 20px; font-family: Arial, sans-serif; text-align: center; border: 1px solid #C9A84C; border-radius: 8px;">
        <h2 style="color: #C9A84C;">LaCabaña</h2>
        <p>Has solicitado desbloquear tu cuenta.</p>
        <p>Tu código de desbloqueo es:</p>
        <div style="background-color: #000; color: #C9A84C; font-size: 28px; font-weight: bold; letter-spacing: 5px; padding: 15px; display: inline-block; border-radius: 5px; margin: 15px 0;">
            {codigo}
        </div>
        <p style="font-size: 12px; color: #888;">Si no solicitaste este desbloqueo, ignora este mensaje.</p>
    </div>
    """

    # Adjuntar el contenido HTML al correo
    msg.attach(MIMEText(html_content, "html"))

    try:
        # Enviar el correo mediante SMTP de Gmail
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(GMAIL_USER, GMAIL_PASS)
            server.sendmail(GMAIL_USER, correo_destino, msg.as_string())
        return True

    except Exception as e:
        print(f"Error al enviar correo: {e}")
        return False


def enviar_alerta_bajo_stock(correo_destino: str, productos: list[dict]) -> None:
    if not GMAIL_USER or not GMAIL_PASS:
        raise RuntimeError("Configura GMAIL_USER y GMAIL_PASS para enviar alertas de inventario.")

    details = "\n".join(
        f"- {producto['nombre']}: quedan {producto['cantidad']} unidades "
        f"(mínimo: {producto['stock_minimo']})."
        for producto in productos
    )
    message = MIMEText(
        "Los siguientes productos cruzaron su mínimo de inventario:\n\n"
        f"{details}\n\nLa Cabaña",
        "plain",
        "utf-8",
    )
    message["Subject"] = "Alerta de bajo stock - La Cabaña"
    message["From"] = f"La Cabaña <{GMAIL_USER}>"
    message["To"] = correo_destino

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_USER, GMAIL_PASS)
        server.sendmail(GMAIL_USER, correo_destino, message.as_string())