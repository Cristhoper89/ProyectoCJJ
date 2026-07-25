import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Configuración de Gmail
GMAIL_USER = "obitocamargo89@gmail.com"
GMAIL_PASS = "gdks zzsn wsko jlyc" 

def enviar_correo_recuperacion(correo_destino: str, codigo: str):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Código de Recuperación de Contraseña - LaCabaña"
    msg["From"] = f"LaCabaña <{GMAIL_USER}>"
    msg["To"] = correo_destino

    # Plantilla HTML estilo LaCabaña
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

    msg.attach(MIMEText(html_content, "html"))

    try:
        # Conexión con el servidor SMTP de Gmail
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(GMAIL_USER, GMAIL_PASS)
            server.sendmail(GMAIL_USER, correo_destino, msg.as_string())
        return True
    except Exception as e:
        print(f"Error al enviar correo: {e}")
        return False