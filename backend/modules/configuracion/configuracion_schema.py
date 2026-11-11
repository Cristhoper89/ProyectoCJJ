from pydantic import BaseModel, ConfigDict, Field


class ConfiguracionResponse(BaseModel):
    id: int
    propina: bool
    valor_propina: float = Field(ge=0, le=100)
    alerta_bajo_stock: bool

    model_config = ConfigDict(from_attributes=True)


class ConfiguracionUpdate(BaseModel):
    propina: bool
    valor_propina: float = Field(ge=0, le=100)
    alerta_bajo_stock: bool
