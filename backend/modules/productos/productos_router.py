from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.frontend import template_response
from core.database import get_db
from core.security import get_current_user

from modules.productos.productos_schema import (
    ProductoCreate,
    ProductoImagenResponse,
    ProductoResponse,
    ProductoUpdate
)

from modules.productos.productos_service import ProductoService


router = APIRouter(
    prefix="/productos",
    tags=["Productos"]
)
frontend_router = APIRouter()


@frontend_router.get("/productos", include_in_schema=False)
async def productos_page():
    return template_response("productos.html")


# ======================================================
# LISTAR PRODUCTOS
# ======================================================

@router.get(
    "/",
    response_model=list[ProductoResponse],
    status_code=status.HTTP_200_OK
)
async def read_productos(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):

    if current_user["role_name"] not in ["Administrador", "Cajero", "Mesero"]:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Rol insuficiente."
        )

    service = ProductoService(db)

    return await service.get_all_productos()


# ======================================================
# REGISTRAR PRODUCTO
# ======================================================

@router.post(
    "/",
    response_model=ProductoResponse,
    status_code=status.HTTP_201_CREATED
)
async def add_producto(
    producto_in: ProductoCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):

    if current_user["role_name"] not in ["Administrador", "Cajero"]:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Rol insuficiente."
        )

    service = ProductoService(db)

    return await service.create_producto(producto_in)


# ======================================================
# EDITAR PRODUCTO
# ======================================================

@router.put(
    "/{producto_id}",
    response_model=ProductoResponse,
    status_code=status.HTTP_200_OK
)
async def update_existing_producto(
    producto_id: int,
    producto_data: ProductoUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):

    if current_user["role_name"] not in ["Administrador", "Cajero"]:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Rol insuficiente."
        )

    service = ProductoService(db)

    return await service.update_producto(
        producto_id,
        producto_data,
        current_user
    )


@router.get(
    "/{producto_id}/imagen",
    response_model=ProductoImagenResponse | None,
    status_code=status.HTTP_200_OK
)
async def get_producto_image(
    producto_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):

    if current_user["role_name"] not in ["Administrador", "Cajero", "Mesero"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Rol insuficiente."
        )

    service = ProductoService(db)
    return await service.get_producto_image(producto_id)


@router.get(
    "/{producto_id}/imagenes",
    response_model=list[ProductoImagenResponse],
    status_code=status.HTTP_200_OK
)
async def get_producto_images(
    producto_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):

    if current_user["role_name"] not in ["Administrador", "Cajero", "Mesero"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Rol insuficiente."
        )

    service = ProductoService(db)
    return await service.get_producto_images(producto_id)


@router.post(
    "/{producto_id}/imagen",
    response_model=ProductoImagenResponse,
    status_code=status.HTTP_201_CREATED
)
async def upload_producto_image(
    producto_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):

    if current_user["role_name"] not in ["Administrador", "Cajero"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Rol insuficiente."
        )

    image_data = await read_image_file(file)
    service = ProductoService(db)
    saved_images = await service.save_producto_images(
        producto_id,
        [(image_data, file.filename or "imagen")]
    )
    return saved_images[0]


@router.post(
    "/{producto_id}/imagenes",
    response_model=list[ProductoImagenResponse],
    status_code=status.HTTP_201_CREATED
)
async def upload_producto_images(
    producto_id: int,
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):

    if current_user["role_name"] not in ["Administrador", "Cajero"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Rol insuficiente."
        )

    images = [
        (await read_image_file(file), file.filename or "imagen")
        for file in files
    ]
    service = ProductoService(db)
    return await service.save_producto_images(producto_id, images)


@router.patch(
    "/{producto_id}/imagenes/{imagen_id}/principal",
    response_model=ProductoImagenResponse,
    status_code=status.HTTP_200_OK
)
async def set_producto_main_image(
    producto_id: int,
    imagen_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):

    if current_user["role_name"] not in ["Administrador", "Cajero"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Rol insuficiente."
        )

    service = ProductoService(db)
    return await service.set_producto_main_image(producto_id, imagen_id)


async def read_image_file(file: UploadFile) -> bytes:

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Todos los archivos deben ser imágenes."
        )

    image_data = await file.read(10 * 1024 * 1024 + 1)
    if not image_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La imagen está vacía."
        )
    if len(image_data) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Cada imagen no puede superar los 10 MB."
        )

    return image_data


# ======================================================
# DESACTIVAR PRODUCTO
# ======================================================

@router.patch(
    "/{producto_id}/estado",
    response_model=ProductoResponse,
    status_code=status.HTTP_200_OK
)
async def change_producto_state(
    producto_id: int,
    new_state: bool,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):

    if current_user["role_name"] not in ["Administrador", "Cajero"]:

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado. Rol insuficiente."
        )

    service = ProductoService(db)

    return await service.cambiar_estado_producto(
        producto_id,
        new_state
    )