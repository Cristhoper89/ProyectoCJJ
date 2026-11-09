import cloudinary

from core.config import settings


def configure_cloudinary() -> None:
    credentials = {
        "CLOUDINARY_CLOUD_NAME": settings.CLOUDINARY_CLOUD_NAME,
        "CLOUDINARY_API_KEY": settings.CLOUDINARY_API_KEY,
        "CLOUDINARY_API_SECRET": settings.CLOUDINARY_API_SECRET,
    }
    missing = [name for name, value in credentials.items() if not value]
    if missing:
        raise RuntimeError(
            "Faltan variables de entorno requeridas para Cloudinary: "
            + ", ".join(missing)
        )

    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )
