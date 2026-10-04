from pydantic import BaseModel, Field


class CartaIngredienteResponse(BaseModel):
    id: int
    nombre: str


class CartaOpcionResponse(BaseModel):
    id: int
    nombre: str


class CartaGrupoOpcionResponse(BaseModel):
    id: int
    nombre: str
    opciones: list[CartaOpcionResponse] = Field(default_factory=list)


class CartaProductoResponse(BaseModel):
    id: int
    nombre: str
    descripcion: str | None = None
    precio: float
    preparacion: bool
    imagen_url: str | None = None
    ingredientes: list[CartaIngredienteResponse] = Field(default_factory=list)
    grupos_opciones: list[CartaGrupoOpcionResponse] = Field(default_factory=list)


class CartaCategoriaResponse(BaseModel):
    id: int
    nombre: str
    productos: list[CartaProductoResponse] = Field(default_factory=list)


class CartaCatalogoResponse(BaseModel):
    categorias: list[CartaCategoriaResponse]


class CartaIngredienteSeleccion(BaseModel):
    id_ingrediente: int = Field(..., gt=0)
    incluido: bool = True


class CartaOpcionSeleccion(BaseModel):
    id_grupo_opcion: int = Field(..., gt=0)
    id_opcion: int = Field(..., gt=0)


class CartaLineaPedidoCreate(BaseModel):
    id_producto: int = Field(..., gt=0)
    cantidad: int = Field(..., gt=0, le=99)
    ingredientes: list[CartaIngredienteSeleccion] = Field(default_factory=list)
    opciones: list[CartaOpcionSeleccion] = Field(default_factory=list)
    notas: str | None = Field(None, max_length=500)


class CartaPedidoCreate(BaseModel):
    items: list[CartaLineaPedidoCreate] = Field(..., min_length=1, max_length=50)


class CartaMesaItemResponse(BaseModel):
    id: int
    id_producto: int
    producto_nombre: str
    cantidad: int
    subtotal: float
    notas: str | None = None
    personalizaciones: str | None = None


class CartaMesaResponse(BaseModel):
    mesa_id: int
    mesa_nombre: str
    activa: bool
    total: float
    items: list[CartaMesaItemResponse] = Field(default_factory=list)
