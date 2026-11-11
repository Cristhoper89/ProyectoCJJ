// ======================================================
// MESAS
// Lógica alineada con el módulo Mesas de la app móvil:
// Mesa -> Movimiento -> Mesa Consumo
// ======================================================

const API_URL = "https://serviciocontigo.io/api";
const API_URL_STORAGE_KEY = "api_base_url";

// La propina se calcula automaticamente al abrir el pedido. El porcentaje se
// cachea en localStorage para no recalcularlo en cada apertura.
const PROPINA_CACHE_KEY = "mesas_propina_porcentaje";
const PROPINA_PORCENTAJE_PREDETERMINADO = 10;

if (localStorage.getItem(API_URL_STORAGE_KEY) !== API_URL) {
    localStorage.removeItem("access_token");
    localStorage.setItem(API_URL_STORAGE_KEY, API_URL);
    window.location.replace("/");
}

// ======================================================
// ELEMENTOS
// ======================================================

const mesasTable = document.getElementById("mesasTable");
const buscarMesa = document.getElementById("buscarMesa");
const btnRegistrarMesa = document.getElementById("btnRegistrarMesa");

const mesaModal = document.getElementById("mesaModal");
const mesaForm = document.getElementById("mesaForm");
const tipoMesa = document.getElementById("tipoMesa");
const mesaMessage = document.getElementById("mesaMessage");
const cerrarMesaModal = document.getElementById("cerrarMesaModal");
const cancelarMesaModal = document.getElementById("cancelarMesaModal");

const pedidoModal = document.getElementById("pedidoModal");
const pedidoMesaNombre = document.getElementById("pedidoMesaNombre");
const pedidoEstadoBadge = document.getElementById("pedidoEstadoBadge");
const pedidoTiempo = document.getElementById("pedidoTiempo");
const cerrarPedido = document.getElementById("cerrarPedido");

const pedidoMovimientos = document.getElementById("pedidoMovimientos");
const pedidoMovimientosLista = document.getElementById("pedidoMovimientosLista");
const btnNuevoMovimiento = document.getElementById("btnNuevoMovimiento");

const categoriasChips = document.getElementById("categoriasChips");
const productosGrid = document.getElementById("productosGrid");
const descuentoProducto = document.getElementById("descuentoProducto");
const pedidoLineas = document.getElementById("pedidoLineas");

const campoSubtotal = document.getElementById("campoSubtotal");
const campoPropina = document.getElementById("campoPropina");
const propinaEtiqueta = document.getElementById("propinaEtiqueta");
const btnQuitarPropina = document.getElementById("btnQuitarPropina");
const campoDomicilio = document.getElementById("campoDomicilio");
const domicilioDatos = document.getElementById("domicilioDatos");
const domicilioNombre = document.getElementById("domicilioNombre");
const domicilioTelefono = document.getElementById("domicilioTelefono");
const campoTotal = document.getElementById("campoTotal");

const btnCancelarPedido = document.getElementById("btnCancelarPedido");
const btnImprimirCuenta = document.getElementById("btnImprimirCuenta");
const btnFinalizarCuenta = document.getElementById("btnFinalizarCuenta");

const confirmarModal = document.getElementById("confirmarModal");
const cancelarConfirmar = document.getElementById("cancelarConfirmar");
const confirmarAccion = document.getElementById("confirmarAccion");
const confirmarTitulo = document.getElementById("confirmarTitulo");
const confirmarMensaje = document.getElementById("confirmarMensaje");

const cuentaModal = document.getElementById("cuentaModal");
const comprobanteImpresion = document.getElementById("comprobanteImpresion");
const btnImprimirCuentaFinal = document.getElementById("btnImprimirCuentaFinal");
const btnCerrarCuenta = document.getElementById("btnCerrarCuenta");

const configModal = document.getElementById("configModal");
const configTitulo = document.getElementById("configTitulo");
const configCuerpo = document.getElementById("configCuerpo");
const cerrarConfig = document.getElementById("cerrarConfig");
const cancelarConfig = document.getElementById("cancelarConfig");
const btnGuardarConfig = document.getElementById("btnGuardarConfig");

const avisoModal = document.getElementById("avisoModal");
const avisoTitulo = document.getElementById("avisoTitulo");
const avisoMensaje = document.getElementById("avisoMensaje");
const cerrarAviso = document.getElementById("cerrarAviso");

// ======================================================
// VARIABLES
// ======================================================

let mesas = [];
let productos = [];
let categorias = [];
let ingredientes = [];
let productoIngredientes = [];
let consumos = [];
let movimientos = [];
let empresa = null;
let operador = null;
let datosComprobanteCargados = false;

let mesaActual = null;
let movimientoActual = null;
let categoriaSeleccionada = null;
let propinaAutomatica = true;
let accionConfirmar = null;

let configProducto = null;
let configCantidad = 0;
let configLineaId = null;
let configIngredientes = {};
let configGrupos = [];
let configOpciones = {};

// ======================================================
// TOKEN / HEADERS
// ======================================================

function getToken() {
    return localStorage.getItem("access_token");
}

function getHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getToken()}`
    };
}

async function api(ruta, metodo = "GET", cuerpo = null) {
    const opciones = {
        method: metodo,
        headers: getHeaders()
    };
    if (cuerpo !== null) {
        opciones.body = JSON.stringify(cuerpo);
    }
    const response = await fetch(`${API_URL}${ruta}`, opciones);
    if (response.status === 204) {
        return null;
    }
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.detail || "No fue posible completar la operación.");
    }
    return data;
}

// ======================================================
// AYUDA
// ======================================================

function formatearPrecio(valor) {
    return `$${Number(valor || 0).toLocaleString("es-CO", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

function esc(texto) {
    return String(texto ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function redondear(valor) {
    return Math.round((Number(valor) || 0) * 100) / 100;
}

function formatearReloj(ms) {
    if (ms < 0) { ms = 0; }
    const seg = Math.floor(ms / 1000);
    const h = Math.floor(seg / 3600);
    const m = Math.floor((seg % 3600) / 60);
    const s = seg % 60;
    const pad = n => String(n).padStart(2, "0");
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatearFechaMovimiento(valor) {
    if (!valor) { return "Sin hora"; }
    const fecha = new Date(valor);
    if (isNaN(fecha.getTime())) { return "Sin hora"; }
    return fecha.toLocaleString("es-CO", {
        day: "numeric",
        month: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}

function obtenerTiempoTranscurrido(horaInicio) {
    if (!horaInicio) { return null; }
    const inicio = new Date(horaInicio).getTime();
    if (isNaN(inicio)) { return null; }
    return Date.now() - inicio;
}

function valorInput(elemento) {
    const valor = parseFloat(elemento.value);
    return isNaN(valor) || valor < 0 ? 0 : valor;
}

function esBarra(mesa) {
    return mesa && mesa.tipo === "barra";
}

function nombreMesa(mesa) {
    return mesa.nombre || (esBarra(mesa) ? "Barra" : `Mesa ${mesa.id}`);
}

function filtroMesas() {
    return buscarMesa.value.trim().toLowerCase();
}

function mostrarAviso(titulo, mensaje) {
    avisoTitulo.textContent = titulo;
    avisoMensaje.textContent = mensaje;
    avisoModal.classList.add("active");
}

function manejarError(error, porDefecto) {
    const mensaje = (error && error.message) || porDefecto;
    if (String(mensaje).toLowerCase().includes("caja abierta")) {
        mostrarAviso("Caja cerrada", "Debes abrir una caja antes de registrar el movimiento.");
        return;
    }
    alert(mensaje);
}

function guardarEstadoBotones(ocupado) {
    [btnImprimirCuenta, btnFinalizarCuenta, btnCancelarPedido, btnNuevoMovimiento]
        .forEach(boton => { if (boton) { boton.disabled = ocupado; } });
}

function actualizarTiempos() {
    document.querySelectorAll("[data-hora]").forEach(celda => {
        const ms = obtenerTiempoTranscurrido(celda.getAttribute("data-hora"));
        celda.textContent = ms === null ? "—" : formatearReloj(ms);
    });
    if (mesaActual && pedidoModal.classList.contains("active")) {
        const ms = obtenerTiempoTranscurrido(mesaActual.hora_inicio);
        pedidoTiempo.textContent = ms === null ? "00:00:00" : formatearReloj(ms);
    }
}

// ======================================================
// RELACIÓN MESA -> MOVIMIENTO -> MESA CONSUMO
// ======================================================

// Una mesa normal usa directamente el movimiento asociado (mesa.id_mov).
// Una barra usa el movimiento que se está atendiendo en este momento.
function movimientoActivoId() {
    if (!mesaActual) { return null; }
    return esBarra(mesaActual)
        ? (movimientoActual ? movimientoActual.id : null)
        : mesaActual.id_mov;
}

function movimientosBarra(mesa) {
    const objetivo = mesa || mesaActual;
    if (!esBarra(objetivo)) { return []; }
    return movimientos
        .filter(movimiento => movimiento.id_mesa === objetivo.id)
        .slice()
        .reverse();
}

// Movimiento que representa la cuenta: el último de la barra o el de la mesa.
function movimientoDeMesa(mesa) {
    if (!mesa) { return null; }
    if (esBarra(mesa)) {
        const lista = movimientos.filter(movimiento => movimiento.id_mesa === mesa.id);
        return lista[lista.length - 1] || null;
    }
    return movimientos.find(movimiento => movimiento.id === mesa.id_mov) || null;
}

// El movimiento que se está editando en este momento (tipos de barra en vivo).
function movimientoEsActivo(movimiento) {
    if (!movimiento || !mesaActual) { return false; }
    if (esBarra(mesaActual)) {
        return !!movimientoActual && movimientoActual.id === movimiento.id;
    }
    return mesaActual.id_mov === movimiento.id;
}

function lineasDeMovimiento(idMov) {
    if (!idMov) { return []; }
    return consumos
        .filter(consumo => consumo.id_mov === idMov)
        .sort((a, b) => a.id - b.id);
}

function lineasMesaActual() {
    return lineasDeMovimiento(movimientoActivoId());
}

function totalMovimiento(movimiento) {
    if (!movimiento) { return 0; }

    const lineas = lineasDeMovimiento(movimiento.id);
    const subtotal = lineas.length > 0
        ? lineas.reduce((suma, linea) => suma + totalLinea(linea), 0)
        : Math.max(0,
            (Number(movimiento.total) || 0) -
            (Number(movimiento.propina) || 0) -
            (Number(movimiento.domicilio) || 0)
        );

    const seleccionado = movimientoEsActivo(movimiento);

    return subtotal
        + (seleccionado ? valorInput(campoPropina) : Number(movimiento.propina) || 0)
        + (seleccionado ? valorInput(campoDomicilio) : Number(movimiento.domicilio) || 0);
}

function totalMesa(mesa) {
    if (esBarra(mesa)) {
        return movimientos
            .filter(movimiento => movimiento.id_mesa === mesa.id)
            .reduce((suma, movimiento) => suma + totalMovimiento(movimiento), 0);
    }
    const movimiento = movimientos.find(item => item.id === mesa.id_mov);
    return movimiento ? totalMovimiento(movimiento) : 0;
}

function tieneConsumos(mesa) {
    if (esBarra(mesa)) {
        return movimientos.some(movimiento => movimiento.id_mesa === mesa.id && lineasDeMovimiento(movimiento.id).length > 0);
    }
    return lineasDeMovimiento(mesa.id_mov).length > 0;
}

function cantidadProductoEnMesa(idProducto) {
    return lineasMesaActual()
        .filter(linea => linea.id_producto === idProducto)
        .reduce((suma, linea) => suma + (Number(linea.cantidad) || 0), 0);
}

// ======================================================
// DESCUENTOS, PROPINA, DOMICILIO Y TOTALES
// ======================================================

function porcentajeLinea(linea) {
    const precio = Number(linea.precio_unitario) || 0;
    const descuento = Number(linea.descuento) || 0;
    if (precio <= 0) { return 0; }
    return Math.min(100, Math.max(0, descuento / precio * 100));
}

function totalLinea(linea) {
    return Number(linea.subtotal) || 0;
}

function calcularSubtotal() {
    return lineasMesaActual().reduce((suma, linea) => suma + totalLinea(linea), 0);
}

function calcularTotal() {
    return redondear(calcularSubtotal() + valorInput(campoPropina) + valorInput(campoDomicilio));
}

// Porcentaje de propina guardado en cache (10% por defecto).
function porcentajePropina() {
    const valorGuardado = localStorage.getItem(PROPINA_CACHE_KEY);
    const cacheado = Number(valorGuardado);
    if (valorGuardado !== null && Number.isFinite(cacheado) && cacheado > 0 && cacheado <= 100) {
        return cacheado;
    }
    localStorage.setItem(PROPINA_CACHE_KEY, String(PROPINA_PORCENTAJE_PREDETERMINADO));
    return PROPINA_PORCENTAJE_PREDETERMINADO;
}

// Propina sugerida: 10% del subtotal (ya con descuentos aplicados).
function propinaAutomaticaValor() {
    return redondear(calcularSubtotal() * porcentajePropina() / 100);
}

// Porcentaje digitado en el campo de descuento del panel de productos.
function porcentajeDescuentoProducto() {
    let valor = parseFloat(descuentoProducto.value);
    if (isNaN(valor) || valor < 0) { valor = 0; }
    if (valor > 100) { valor = 100; }
    return valor;
}

// ======================================================
// CARGAR DATOS
// ======================================================

function resultado(pedido, porDefecto) {
    return pedido.status === "fulfilled" ? pedido.value : porDefecto;
}

async function cargarDatosComprobante() {
    if (datosComprobanteCargados) { return; }

    const [empresaResult, operadorResult] = await Promise.allSettled([
        api("/empresas/"),
        api("/auth/me")
    ]);

    if (empresaResult.status === "fulfilled") {
        const data = empresaResult.value;
        empresa = Array.isArray(data) && data.length ? data[0] : null;
    } else {
        empresa = null;
        console.error("No se pudieron cargar los datos de la empresa para el comprobante.", empresaResult.reason);
    }

    if (operadorResult.status === "fulfilled") {
        operador = operadorResult.value;
    } else {
        operador = null;
        console.error("No se pudo cargar el usuario que imprime el comprobante.", operadorResult.reason);
    }

    datosComprobanteCargados =
        empresaResult.status === "fulfilled" && operadorResult.status === "fulfilled";
}

let cargaEnCurso = null;
let recargaPendiente = false;

// La base de datos es remota: cada endpoint tarda ~1s. Los catalogos
// (categorias, productos, ingredientes) casi nunca cambian, asi que en una
// actualizacion en vivo solo se recargan mesas, consumos y movimientos.
function cargarTodo(opciones = {}) {
    if (cargaEnCurso) {
        recargaPendiente = true;
        return cargaEnCurso;
    }

    cargaEnCurso = ejecutarCarga(opciones.soloEstado === true).finally(() => {
        cargaEnCurso = null;
        if (recargaPendiente) {
            recargaPendiente = false;
            cargarTodo();
        }
    });

    return cargaEnCurso;
}

async function ejecutarCarga(soloEstado) {
    const endpoint = soloEstado
        ? {
            mesas: api("/mesas/"),
            consumos: api("/mesasC/"),
            movimientos: api("/movimientos/")
        }
        : {
            mesas: api("/mesas/"),
            categorias: api("/categorias/"),
            productos: api("/productos/"),
            ingredientes: api("/ingredientes/"),
            productoIngredientes: api("/producto-ingredientes/"),
            consumos: api("/mesasC/"),
            movimientos: api("/movimientos/")
        };

    const claves = Object.keys(endpoint);
    const resultados = await Promise.allSettled(Object.values(endpoint));
    const pedidos = {};
    claves.forEach((clave, indice) => { pedidos[clave] = resultados[indice]; });

    const mesasPedido = pedidos.mesas;
    const consumosPedido = pedidos.consumos;
    const movimientosPedido = pedidos.movimientos;

    mesas = resultado(mesasPedido, mesas);
    consumos = resultado(consumosPedido, consumos);
    movimientos = resultado(movimientosPedido, movimientos);

    if (pedidos.categorias) {
        categorias = resultado(pedidos.categorias, categorias).filter(categoria => categoria.estado !== false);
    }
    if (pedidos.productos) {
        productos = resultado(pedidos.productos, productos).filter(producto => producto.estado !== false);
    }
    if (pedidos.ingredientes) {
        ingredientes = resultado(pedidos.ingredientes, ingredientes).filter(ingrediente => ingrediente.estado !== false);
    }
    if (pedidos.productoIngredientes) {
        productoIngredientes = resultado(pedidos.productoIngredientes, productoIngredientes);
    }

    if (mesaActual && pedidoModal.classList.contains("active")) {
        mesaActual = mesas.find(mesa => mesa.id === mesaActual.id) || mesaActual;
        if (esBarra(mesaActual)) {
            const movimientoId = movimientoActual && movimientoActual.id;
            movimientoActual = movimientos.find(movimiento => movimiento.id === movimientoId) || movimientoDeMesa(mesaActual);
        }
        const referencia = movimientoActual || movimientoDeMesa(mesaActual);
        if (!propinaAutomatica) {
            campoPropina.value = Number(referencia && referencia.propina) || 0;
        }
        campoDomicilio.value = Number(referencia && referencia.domicilio) || 0;
        pedidoMesaNombre.textContent = nombreMesa(mesaActual);
        pedidoEstadoBadge.className = "estado-mesa-badge " + (mesaActual.estado ? "ocupada" : "disponible");
        pedidoEstadoBadge.textContent = mesaActual.estado ? "Ocupada" : "Disponible";
        renderChips();
        renderProductos();
        refrescarResumen();
        actualizarTiempos();
    }

    if (mesasPedido.status === "rejected") {
        mesasTable.innerHTML = `
            <div class="mesa-loading">
                <i data-lucide="alert-triangle"></i>
                <span>No fue posible conectar con el servidor.</span>
            </div>
        `;
    } else {
        mostrarMesas(filtroMesas());
    }

    const fallo = resultados.find(pedido => pedido.status === "rejected");
    if (fallo) {
        mostrarAviso(
            "No se pudo cargar todo",
            (fallo.reason && fallo.reason.message) || "Intenta nuevamente."
        );
    }

    await cargarDatosComprobante();
}

// ======================================================
// MOSTRAR MESAS
// ======================================================

function mostrarMesas(filtro = "") {
    mesasTable.innerHTML = "";

    const lista = filtro
        ? mesas.filter(mesa => {
            const texto = nombreMesa(mesa) + " " + (esBarra(mesa) ? "barra" : "mesa");
            return texto.toLowerCase().includes(filtro);
        })
        : mesas;

    if (lista.length === 0) {
        mesasTable.innerHTML = `
            <div class="mesa-loading">
                <i data-lucide="inbox"></i>
                <span>No hay mesas registradas.</span>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    lista.forEach(mesa => {
        const tarjeta = document.createElement("div");
        const ocupada = mesa.estado === true;
        const barra = esBarra(mesa);
        const ms = obtenerTiempoTranscurrido(mesa.hora_inicio);

        tarjeta.className = `mesa-card${ocupada ? " ocupada" : ""}`;
        tarjeta.dataset.id = mesa.id;
        tarjeta.tabIndex = 0;
        tarjeta.setAttribute("aria-label", `Abrir pedido de ${nombreMesa(mesa)}`);
        tarjeta.innerHTML = `

            <div class="mesa-card-img ${ocupada ? "ocupada" : "disponible"}">
                <span class="mesa-card-emoji">${barra ? "🍺" : "🍔"}</span>
                <span class="estado-mesa-badge tipo-badge">
                    ${barra ? "Barra" : "Mesa"}
                </span>
            </div>

            <div class="mesa-card-body">

                <div class="mesa-card-cabecera">
                    <strong class="mesa-card-nombre">${esc(nombreMesa(mesa))}</strong>
                    <span class="estado-mesa-badge ${ocupada ? "ocupada" : "disponible"}">
                        ${ocupada ? "Ocupada" : "Disponible"}
                    </span>
                </div>

                <div class="mesa-card-row">
                    <i data-lucide="clock"></i>
                    <span>
                        ${mesa.hora_inicio ? String(mesa.hora_inicio).replace("T", " ").slice(0, 19) : "—"}
                    </span>
                </div>

                <div class="mesa-card-row">
                    <i data-lucide="timer"></i>
                    <span class="mesa-tiempo" data-hora="${mesa.hora_inicio || ""}">
                        ${ms === null ? "—" : formatearReloj(ms)}
                    </span>
                </div>

                <div class="mesa-card-total">
                    ${formatearPrecio(totalMesa(mesa))}
                </div>

                <div class="actions">

                    ${tieneConsumos(mesa) ? `
                        <button
                            type="button"
                            class="action-button success"
                            title="Imprimir cuenta"
                            data-accion="cuenta"
                            data-id="${mesa.id}"
                        >
                            <i data-lucide="printer"></i>
                        </button>
                    ` : ""}

                    ${ocupada ? `
                        <button
                            type="button"
                            class="action-button danger"
                            title="Cancelar pedido"
                            data-accion="cancelar"
                            data-id="${mesa.id}"
                        >
                            <i data-lucide="ban"></i>
                        </button>
                    ` : ""}

                </div>

            </div>
        `;

        mesasTable.appendChild(tarjeta);
    });

    lucide.createIcons();
}

// ======================================================
// REGISTRAR MESA
// ======================================================

function abrirMesaModal() {
    mesaForm.reset();
    tipoMesa.value = "mesa";
    mesaMessage.textContent = "";
    mesaMessage.className = "mesa-message";
    mesaModal.classList.add("active");
}

function cerrarMesaModalFn() {
    mesaModal.classList.remove("active");
    mesaForm.reset();
    mesaMessage.textContent = "";
    mesaMessage.className = "mesa-message";
}

mesaForm.addEventListener("submit", async event => {
    event.preventDefault();

    const boton = document.getElementById("btnGuardarMesa");
    boton.disabled = true;
    boton.textContent = "Registrando...";

    try {
        await api("/mesas/", "POST", {
            estado: false,
            tipo: tipoMesa.value === "barra" ? "barra" : "mesa"
        });

        mesaMessage.textContent = "Mesa registrada correctamente.";
        mesaMessage.className = "mesa-message success";

        await cargarTodo();

        setTimeout(cerrarMesaModalFn, 900);
    } catch (error) {
        console.error(error);
        mesaMessage.textContent = error.message || "No fue posible registrar la mesa.";
        mesaMessage.className = "mesa-message error";
    } finally {
        boton.disabled = false;
        boton.textContent = "Registrar mesa";
    }
});

// ======================================================
// PRODUCTOS DEL PEDIDO
// ======================================================

function productosActivos() {
    return productos.filter(producto => producto.estado !== false);
}

function categoriasConProductos() {
    const prods = productosActivos();
    const ids = new Set(prods.map(producto => producto.id_categoria));
    return categorias.filter(categoria => ids.has(categoria.id));
}

function renderChips() {
    categoriasChips.innerHTML = "";

    const cats = categoriasConProductos();

    if (cats.length === 0) {
        categoriasChips.innerHTML = `
            <span class="loading-chip">No hay categorías con productos.</span>
        `;
        productosGrid.innerHTML = `
            <span class="loading-chip">No hay productos disponibles.</span>
        `;
        return;
    }

    const chipTodas = document.createElement("button");
    chipTodas.type = "button";
    chipTodas.className = "chip-categoria" + (categoriaSeleccionada === null ? " activa" : "");
    chipTodas.textContent = "Todas";
    chipTodas.addEventListener("click", () => {
        categoriaSeleccionada = null;
        renderChips();
        renderProductos();
    });
    categoriasChips.appendChild(chipTodas);

    cats.forEach(cat => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip-categoria" + (categoriaSeleccionada === cat.id ? " activa" : "");
        chip.textContent = cat.nombre;
        chip.addEventListener("click", () => {
            categoriaSeleccionada = cat.id;
            renderChips();
            renderProductos();
        });
        categoriasChips.appendChild(chip);
    });
}

function renderProductos() {
    productosGrid.innerHTML = "";

    const lista = categoriaSeleccionada === null
        ? productosActivos()
        : productosActivos().filter(producto => producto.id_categoria === categoriaSeleccionada);

    if (lista.length === 0) {
        productosGrid.innerHTML = `
            <span class="loading-chip">No hay productos en esta categoría.</span>
        `;
        return;
    }

    lista.forEach(producto => {
        const tarjeta = document.createElement("button");
        tarjeta.type = "button";
        tarjeta.className = "producto-tarjeta";
        tarjeta.innerHTML = `
            <strong>${esc(producto.nombre)}</strong>
            <span>${formatearPrecio(producto.precio)}</span>
            ${producto.cantidad > 0 ? `<small>Disponible: ${producto.cantidad}</small>` : "<small>Sin stock</small>"}
            <i data-lucide="plus-circle"></i>
        `;
        tarjeta.addEventListener("click", () => agregarProducto(producto));
        productosGrid.appendChild(tarjeta);
    });

    lucide.createIcons();
}

// ======================================================
// PEDIDO
// ======================================================

function abrirPedido(mesaId) {
    const mesa = mesas.find(item => item.id === Number(mesaId));
    if (!mesa) { return; }

    mesaActual = mesa;
    categoriaSeleccionada = null;

    // En la barra se atiende el último movimiento; la mesa normal usa el suyo.
    movimientoActual = esBarra(mesa) ? movimientoDeMesa(mesa) : null;

    const referencia = movimientoActual || movimientoDeMesa(mesa);
    campoDomicilio.value = Number(referencia && referencia.domicilio) || 0;
    // Al abrir el pedido la propina se calcula automaticamente (10% del subtotal).
    propinaAutomatica = true;
    descuentoProducto.value = "";
    domicilioNombre.value = "";
    domicilioTelefono.value = "";
    actualizarDatosDomicilio();

    pedidoMesaNombre.textContent = nombreMesa(mesa);
    pedidoEstadoBadge.className = "estado-mesa-badge " + (mesa.estado ? "ocupada" : "disponible");
    pedidoEstadoBadge.textContent = mesa.estado ? "Ocupada" : "Disponible";

    pedidoModal.classList.add("active");
    renderChips();
    renderProductos();
    refrescarResumen();
    actualizarTiempos();
}

function cerrarPedidoFn() {
    pedidoModal.classList.remove("active");
    mesaActual = null;
    movimientoActual = null;
    propinaAutomatica = true;
    descuentoProducto.value = "";
    domicilioNombre.value = "";
    domicilioTelefono.value = "";
    actualizarDatosDomicilio();
    cerrarConfigModal();
}

// ======================================================
// MOVIMIENTOS DE LA BARRA
// ======================================================

function renderMovimientosBarra() {
    if (!pedidoMovimientos) { return; }

    const visible = !!mesaActual && esBarra(mesaActual);
    pedidoMovimientos.hidden = !visible;
    if (!visible) { return; }

    pedidoMovimientosLista.innerHTML = "";

    const lista = movimientosBarra();

    if (lista.length === 0) {
        pedidoMovimientosLista.innerHTML = `
            <span class="loading-chip">No hay movimientos registrados.</span>
        `;
        return;
    }

    lista.forEach(movimiento => {
        const tarjeta = document.createElement("button");
        const seleccionada = movimientoActual && movimientoActual.id === movimiento.id;
        tarjeta.type = "button";
        tarjeta.className = "movimiento-card" + (seleccionada ? " seleccionada" : "");
        tarjeta.innerHTML = `
            <span>${esc(formatearFechaMovimiento(movimiento.fecha_hora))}</span>
            <strong>${formatearPrecio(totalMovimiento(movimiento))}</strong>
        `;
        tarjeta.addEventListener("click", () => seleccionarMovimiento(movimiento));
        pedidoMovimientosLista.appendChild(tarjeta);
    });
}

function seleccionarMovimiento(movimiento) {
    movimientoActual = movimiento;
    // Cada movimiento de la barra es una cuenta aparte: recalcula el 10%.
    propinaAutomatica = true;
    campoDomicilio.value = Number(movimiento.domicilio) || 0;
    refrescarResumen();
    mostrarMesas(filtroMesas());
}

async function crearMovimientoBarra() {
    if (!mesaActual || !esBarra(mesaActual)) { return; }

    guardarEstadoBotones(true);

    try {
        if (mesaActual.estado !== true) {
            const mesa = await api(`/mesas/${mesaActual.id}/estado?new_state=true`, "PATCH");
            mesaActual = mesa;
            mesas = mesas.map(item => item.id === mesa.id ? { ...item, ...mesa } : item);
            pedidoEstadoBadge.className = "estado-mesa-badge ocupada";
            pedidoEstadoBadge.textContent = "Ocupada";
        }

        const movimiento = await api("/movimientos/", "POST", {
            estado: true,
            propina: 0,
            domicilio: 0,
            total: 0,
            metodo: "Efectivo",
            id_mesa: mesaActual.id,
            fecha_hora: new Date().toISOString()
        });

        movimientos = [...movimientos, movimiento];
        movimientoActual = movimiento;
        propinaAutomatica = true;
        campoDomicilio.value = 0;

        renderMovimientosBarra();
        refrescarResumen();
        mostrarMesas(filtroMesas());
    } catch (error) {
        manejarError(error, "No se pudo crear el movimiento de la barra.");
    } finally {
        guardarEstadoBotones(false);
    }
}

// ======================================================
// LÍNEAS DEL PEDIDO
// ======================================================

function renderLineas() {
    pedidoLineas.innerHTML = "";

    const lineas = lineasMesaActual();

    if (lineas.length === 0) {
        pedidoLineas.innerHTML = `
            <p class="pedido-vacio">Aún no se han registrado productos.</p>
        `;
        return;
    }

    lineas.forEach(linea => {
        const producto = productos.find(item => item.id === linea.id_producto);
        const porcentaje = porcentajeLinea(linea);
        const configurable = !!producto && !!producto.preparacion;

        const fila = document.createElement("div");
        fila.className = "pedido-linea";
        fila.setAttribute("data-linea", linea.id);
        fila.innerHTML = `
            <div class="linea-cabecera">
                <div class="linea-nombre">
                    <strong>${producto ? esc(producto.nombre) : `Producto ${linea.id_producto}`}</strong>
                    <span>${formatearPrecio(linea.precio_unitario)} x ${linea.cantidad}</span>
                    ${porcentaje > 0 ? `<span class="linea-descuento-badge">Descuento -${porcentaje}%</span>` : ""}
                </div>

                <strong class="linea-subtotal">
                    ${formatearPrecio(totalLinea(linea))}
                </strong>
            </div>

            ${linea.notas ? `<div class="linea-notas">${esc(linea.notas)}</div>` : ""}

            <div class="linea-acciones">
                <div class="stepper">
                    <button type="button" class="step-btn" data-accion="menos" data-id="${linea.id}" title="Quitar uno">
                        <i data-lucide="minus"></i>
                    </button>
                    <span>${linea.cantidad}</span>
                    <button type="button" class="step-btn" data-accion="mas" data-id="${linea.id}" title="Agregar uno">
                        <i data-lucide="plus"></i>
                    </button>
                </div>

                ${configurable ? `
                    <button type="button" class="linea-config-btn" data-accion="configurar" data-id="${linea.id}">
                        <i data-lucide="sliders-horizontal"></i>
                        Configurar
                    </button>
                ` : ""}

                <button type="button" class="action-button danger" data-accion="eliminar" data-id="${linea.id}" title="Eliminar">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        `;
        pedidoLineas.appendChild(fila);
    });

    lucide.createIcons();
}

function refrescarResumen() {
    // Mientras el usuario no edite la propina manualmente, se mantiene el 10%.
    if (propinaAutomatica) {
        campoPropina.value = propinaAutomaticaValor();
    }
    renderLineas();
    campoSubtotal.textContent = formatearPrecio(calcularSubtotal());
    campoTotal.textContent = formatearPrecio(calcularTotal());
    renderMovimientosBarra();
}

// ======================================================
// AGREGAR / MODIFICAR / ELIMINAR PRODUCTOS
// ======================================================

function notasDeConfiguracion(configuracion) {
    if (!configuracion) { return ""; }
    return (configuracion.grupos || [])
        .map(grupo => {
            const opcionId = (configuracion.opciones || {})[grupo.id];
            const opcion = (grupo.opciones || []).find(item => item.id === opcionId);
            return opcion ? `${grupo.nombre}: ${opcion.nombre}` : null;
        })
        .filter(Boolean)
        .join("; ");
}

function accionesDeIngredientes(producto, configuracion) {
    if (!producto.preparacion) { return []; }

    const seleccion = configuracion && configuracion.ingredientes
        ? configuracion.ingredientes
        : Object.fromEntries(
            productoIngredientes
                .filter(relacion => relacion.id_producto === producto.id)
                .map(relacion => [relacion.id_ingrediente, true])
        );

    return Object.entries(seleccion).map(([idIngrediente, incluido]) => ({
        id_ingrediente: Number(idIngrediente),
        accion: incluido ? "mantener" : "quitar"
    }));
}

async function registrarProducto(producto, cantidad, configuracion = null, lineaObjetivoId = null, descuentoPorUnidad = 0) {
    if (!mesaActual) { return; }

    const nuevaCantidad = Math.max(0, Math.floor(cantidad));
    guardarEstadoBotones(true);

    try {
        let mesa = mesaActual;
        let movimiento = movimientoActual;

        // La mesa debe estar activa: el backend crea el movimiento asociado.
        if (mesa.estado !== true) {
            mesa = await api(`/mesas/${mesa.id}/estado?new_state=true`, "PATCH");
            mesaActual = mesa;
            mesas = mesas.map(item => item.id === mesa.id ? { ...item, ...mesa } : item);
            pedidoEstadoBadge.className = "estado-mesa-badge ocupada";
            pedidoEstadoBadge.textContent = "Ocupada";
            if (esBarra(mesa)) {
                movimientos = await api("/movimientos/");
                const lista = movimientos.filter(item => item.id_mesa === mesa.id);
                movimiento = lista[lista.length - 1] || null;
                movimientoActual = movimiento;
            }
        }

        if (esBarra(mesa) && !movimiento) {
            throw new Error("La barra no tiene un movimiento activo.");
        }

        const idMov = esBarra(mesa) ? movimiento.id : mesa.id_mov;
        if (!idMov) {
            throw new Error("La mesa no tiene un movimiento activo.");
        }

        const todasExistentes = lineasDeMovimiento(idMov).filter(linea => linea.id_producto === producto.id);
        const existentes = producto.preparacion
            ? todasExistentes
            : lineaObjetivoId
                ? todasExistentes.filter(linea => linea.id === lineaObjetivoId)
                : todasExistentes.filter(linea => (
                    Math.round((Number(linea.descuento) || 0) * 100) === Math.round(descuentoPorUnidad * 100)
                ));
        const notas = notasDeConfiguracion(configuracion);

        if (producto.preparacion) {
            const cantidadActual = existentes.reduce(
                (suma, linea) => suma + (Number(linea.cantidad) || 0),
                0
            );
            const acciones = accionesDeIngredientes(producto, configuracion);

            if (configuracion && lineaObjetivoId) {
                const lineaObjetivo = existentes.find(linea => linea.id === lineaObjetivoId);
                if (!lineaObjetivo) {
                    throw new Error("No se encontró el detalle que se intenta configurar.");
                }

                await api(`/mesasC/${lineaObjetivo.id}`, "PUT", {
                    cantidad: Number(lineaObjetivo.cantidad) || 1,
                    subtotal: Number(producto.precio || 0) * (Number(lineaObjetivo.cantidad) || 1),
                    notas: notas || null,
                    ingredientes: acciones
                });
            } else if (nuevaCantidad > cantidadActual) {
                await api("/mesasC/", "POST", {
                    id_producto: producto.id,
                    id_mov: idMov,
                    cantidad: nuevaCantidad - cantidadActual,
                    descuento: descuentoPorUnidad,
                    notas: notas || null,
                    ingredientes: acciones
                });
            } else if (nuevaCantidad < cantidadActual) {
                let cantidadRestante = cantidadActual - nuevaCantidad;
                for (const linea of [...existentes].reverse()) {
                    if (cantidadRestante <= 0) { break; }

                    const cantidadLinea = Number(linea.cantidad) || 0;
                    if (cantidadLinea <= cantidadRestante) {
                        await api(`/mesasC/${linea.id}`, "DELETE");
                        cantidadRestante -= cantidadLinea;
                    } else {
                        await api(`/mesasC/${linea.id}`, "PUT", {
                            cantidad: cantidadLinea - cantidadRestante,
                            subtotal: Number(linea.precio_unitario || producto.precio || 0) * (cantidadLinea - cantidadRestante)
                        });
                        cantidadRestante = 0;
                    }
                }
            }

            consumos = await api("/mesasC/");
            cerrarConfigModal();
            refrescarResumen();
            mostrarMesas(filtroMesas());
            actualizarTiempos();
            return;
        }

        if (nuevaCantidad === 0) {
            for (const linea of existentes) {
                await api(`/mesasC/${linea.id}`, "DELETE");
            }
            consumos = consumos.filter(linea => !existentes.some(item => item.id === linea.id));
        } else if (existentes.length > 0) {
            const objetivo = existentes[0];
            const totalPrecio = Number(producto.precio || 0) * nuevaCantidad;

            const cuerpo = {
                cantidad: nuevaCantidad,
                subtotal: totalPrecio,
                notas: notas || objetivo.notas || null
            };
            // Solo enviar ingredientes si el usuario abrió "Configurar".
            // Si no se envía, el backend conserva los ya registrados.
            if (configuracion) {
                cuerpo.ingredientes = accionesDeIngredientes(producto, configuracion);
            }
            const actualizado = await api(`/mesasC/${objetivo.id}`, "PUT", cuerpo);

            const sobrantes = existentes.slice(1);
            for (const extra of sobrantes) {
                await api(`/mesasC/${extra.id}`, "DELETE");
            }

            consumos = consumos
                .filter(linea => !sobrantes.some(item => item.id === linea.id))
                .map(linea => linea.id === objetivo.id
                    ? actualizado
                    : linea);
        } else {
            const nuevo = await api("/mesasC/", "POST", {
                id_producto: producto.id,
                id_mov: idMov,
                cantidad: nuevaCantidad,
                descuento: descuentoPorUnidad,
                notas: notas || null,
                ingredientes: accionesDeIngredientes(producto, configuracion)
            });
            consumos = [...consumos, nuevo];
        }

        cerrarConfigModal();
        refrescarResumen();
        mostrarMesas(filtroMesas());
        actualizarTiempos();
    } catch (error) {
        console.error(error);
        manejarError(error, "No se pudo registrar el producto.");
    } finally {
        guardarEstadoBotones(false);
    }
}

async function agregarProducto(producto) {
    if (!mesaActual) { return; }

    const porcentaje = porcentajeDescuentoProducto();
    const descuentoPorUnidad = redondear(Number(producto.precio || 0) * porcentaje / 100);
    const lineasProducto = lineasMesaActual().filter(linea => linea.id_producto === producto.id);
    const lineasMismoDescuento = lineasProducto.filter(linea => (
        Math.round((Number(linea.descuento) || 0) * 100) === Math.round(descuentoPorUnidad * 100)
    ));
    const cantidadActual = producto.preparacion
        ? lineasProducto.reduce((suma, linea) => suma + (Number(linea.cantidad) || 0), 0)
        : lineasMismoDescuento.reduce((suma, linea) => suma + (Number(linea.cantidad) || 0), 0);
    await registrarProducto(producto, cantidadActual + 1, null, null, descuentoPorUnidad);
    descuentoProducto.value = "";
    refrescarResumen();
    mostrarMesas(filtroMesas());
}

// ======================================================
// CONFIGURAR PRODUCTO (INGREDIENTES Y OPCIONES)
// ======================================================

function opcionesDesdeNotas(notas) {
    const seleccion = {};
    if (!notas || !configGrupos.length) { return seleccion; }

    String(notas).split(";").forEach(parte => {
        const segmentos = parte.split(":").map(texto => (texto || "").trim());
        if (segmentos.length < 2) { return; }
        const grupo = configGrupos.find(item => item.nombre === segmentos[0]);
        if (!grupo) { return; }
        const opcion = (grupo.opciones || []).find(item => item.nombre === segmentos[1]);
        if (opcion) { seleccion[grupo.id] = opcion.id; }
    });

    return seleccion;
}

function renderConfigCuerpo() {
    if (!configProducto) { return; }

    const partes = [];
    const relaciones = productoIngredientes.filter(relacion => relacion.id_producto === configProducto.id);

    if (configProducto.preparacion && relaciones.length > 0) {
        partes.push(`
            <div>
                <h3 class="config-seccion-titulo">Ingredientes principales</h3>
                <div class="config-lista">
                    ${relaciones.map(relacion => {
                        const ingrediente = ingredientes.find(item => item.id === relacion.id_ingrediente);
                        if (!ingrediente) { return ""; }
                        const marcado = configIngredientes[ingrediente.id] !== false;
                        return `
                            <button type="button" class="config-item${marcado ? " seleccionado" : ""}" data-ingrediente="${ingrediente.id}">
                                <span class="config-marca">${marcado ? "&#10003;" : ""}</span>
                                <span>${esc(ingrediente.nombre)}</span>
                            </button>
                        `;
                    }).join("")}
                </div>
            </div>
        `);
    }

    configGrupos.forEach(grupo => {
        partes.push(`
            <div>
                <h3 class="config-seccion-titulo">Seleccionar ${esc(grupo.nombre)}</h3>
                <div class="config-lista">
                    ${(grupo.opciones || []).map(opcion => {
                        const marcado = configOpciones[grupo.id] === opcion.id;
                        return `
                            <button type="button" class="config-item${marcado ? " seleccionado" : ""}" data-grupo="${grupo.id}" data-opcion="${opcion.id}">
                                <span class="config-marca">${marcado ? "&#10003;" : ""}</span>
                                <span>${esc(opcion.nombre)}</span>
                            </button>
                        `;
                    }).join("")}
                </div>
            </div>
        `);
    });

    if (partes.length === 0) {
        partes.push(`<span class="loading-chip">Este producto no tiene ingredientes ni opciones configurados.</span>`);
    }

    configCuerpo.innerHTML = partes.join("");
}

async function abrirConfigModal(linea) {
    const producto = productos.find(item => item.id === linea.id_producto);
    if (!producto) { return; }

    try {
        const [grupos, modificaciones] = await Promise.all([
            api(`/productos/${producto.id}/grupos-opciones/`),
            api("/mesa-consumo-ingredientes/")
        ]);

        configProducto = producto;
        configCantidad = Number(linea.cantidad) || 0;
        configLineaId = linea.id;
        configGrupos = Array.isArray(grupos) ? grupos : [];
        configIngredientes = Object.fromEntries(
            productoIngredientes
                .filter(relacion => relacion.id_producto === producto.id)
                .map(relacion => [relacion.id_ingrediente, true])
        );
        modificaciones
            .filter(item => item.id_mesa_consumo === linea.id)
            .forEach(item => {
                configIngredientes[item.id_ingrediente] = item.accion !== "quitar";
            });
        configOpciones = opcionesDesdeNotas(linea.notas);

        configTitulo.textContent = `Configurar: ${producto.nombre}`;
        renderConfigCuerpo();
        configModal.classList.add("active");
    } catch (error) {
        manejarError(error, "No se pudo cargar la configuración del producto.");
    }
}

function cerrarConfigModal() {
    if (configModal) { configModal.classList.remove("active"); }
    configProducto = null;
    configLineaId = null;
    configGrupos = [];
    configOpciones = {};
}

configCuerpo.addEventListener("click", event => {
    const ingrediente = event.target.closest("[data-ingrediente]");
    if (ingrediente) {
        const id = Number(ingrediente.getAttribute("data-ingrediente"));
        configIngredientes = { ...configIngredientes, [id]: configIngredientes[id] === false };
        renderConfigCuerpo();
        return;
    }

    const opcion = event.target.closest("[data-opcion]");
    if (opcion) {
        const grupo = Number(opcion.getAttribute("data-grupo"));
        const id = Number(opcion.getAttribute("data-opcion"));
        configOpciones = { ...configOpciones, [grupo]: id };
        renderConfigCuerpo();
    }
});

btnGuardarConfig.addEventListener("click", async () => {
    if (!configProducto) { return; }
    const producto = configProducto;
    const cantidad = configCantidad;
    const configuracion = {
        ingredientes: configIngredientes,
        grupos: configGrupos,
        opciones: configOpciones
    };
    await registrarProducto(producto, cantidad, configuracion, configLineaId);
});

cerrarConfig.addEventListener("click", cerrarConfigModal);
cancelarConfig.addEventListener("click", cerrarConfigModal);
configModal.addEventListener("click", event => {
    if (event.target === configModal) { cerrarConfigModal(); }
});

// ======================================================
// ACCIONES SOBRE LÍNEAS
// ======================================================

pedidoLineas.addEventListener("click", async event => {
    const boton = event.target.closest("[data-accion]");
    if (!boton) { return; }

    const id = Number(boton.getAttribute("data-id"));
    const accion = boton.getAttribute("data-accion");
    const linea = consumos.find(consumo => consumo.id === id);
    if (!linea) { return; }

    if (accion === "configurar") {
        await abrirConfigModal(linea);
        return;
    }

    const producto = productos.find(item => item.id === linea.id_producto);
    if (!producto) { return; }

    boton.disabled = true;

    const cantidadActual = Number(linea.cantidad) || 0;
    const cantidad = producto.preparacion
        ? accion === "mas"
            ? cantidadProductoEnMesa(producto.id) + 1
            : accion === "menos"
                ? Math.max(0, cantidadProductoEnMesa(producto.id) - 1)
                : 0
        : accion === "mas"
            ? cantidadActual + 1
            : accion === "menos"
                ? cantidadActual - 1
                : 0;

    const descuentoPorUnidad = producto.preparacion && accion === "mas"
        ? Number(linea.descuento) || 0
        : 0;
    await registrarProducto(
        producto,
        cantidad,
        null,
        producto.preparacion ? null : linea.id,
        descuentoPorUnidad
    );
});

// ======================================================
// DESCUENTOS
// ======================================================

// El descuento se digita en el panel de productos (campo "Descuento al
// agregar") y se aplica al producto en el momento de agregarlo.

// ======================================================
// PROpina / DOMICILIO
// ======================================================

btnQuitarPropina.addEventListener("click", () => {
    // El usuario quita la propina: se desactiva el calculo automatico.
    propinaAutomatica = false;
    campoPropina.value = 0;
    refrescarResumen();
    mostrarMesas(filtroMesas());
});

campoPropina.addEventListener("input", () => {
    // Si el usuario edita la propina, se respeta su valor.
    propinaAutomatica = false;
    campoTotal.textContent = formatearPrecio(calcularTotal());
});

campoPropina.addEventListener("change", () => {
    refrescarResumen();
    mostrarMesas(filtroMesas());
});

campoDomicilio.addEventListener("input", () => {
    campoTotal.textContent = formatearPrecio(calcularTotal());
    actualizarDatosDomicilio();
});

campoDomicilio.addEventListener("change", () => {
    refrescarResumen();
    actualizarDatosDomicilio();
    mostrarMesas(filtroMesas());
});

function actualizarDatosDomicilio() {
    domicilioDatos.hidden = valorInput(campoDomicilio) <= 0;
}

// ======================================================
// CANCELAR PEDIDO
// ======================================================

function pedirConfirmacionCancelar(mesa) {
    mesaActual = mesa;
    movimientoActual = esBarra(mesa) ? movimientoDeMesa(mesa) : null;
    accionConfirmar = "cancelar";
    confirmarTitulo.textContent = "Cancelar pedido";
    confirmarMensaje.textContent =
        `¿Está seguro de que desea cancelar el pedido de ${nombreMesa(mesa)}? Todos los productos registrados serán eliminados.`;
    confirmarAccion.textContent = "Sí, cancelar";
    confirmarModal.classList.add("active");
}

btnCancelarPedido.addEventListener("click", () => {
    if (!mesaActual) { return; }
    pedirConfirmacionCancelar(mesaActual);
});

cancelarConfirmar.addEventListener("click", () => {
    confirmarModal.classList.remove("active");
    accionConfirmar = null;
});

confirmarAccion.addEventListener("click", async () => {
    if (accionConfirmar !== "cancelar" || !mesaActual) { return; }

    const boton = confirmarAccion;
    boton.disabled = true;

    try {
        // Cerrar la cuenta anula los consumos, sus ingredientes y los movimientos.
        await api(`/mesas/${mesaActual.id}/cerrar`, "PATCH");

        confirmarModal.classList.remove("active");
        accionConfirmar = null;

        cerrarPedidoFn();
        await cargarTodo();
    } catch (error) {
        console.error(error);
        manejarError(error, "No se pudo cancelar el pedido.");
    } finally {
        boton.disabled = false;
        confirmarAccion.textContent = "Sí, cancelar";
    }
});

// ======================================================
// FINALIZAR CUENTA
// ======================================================

btnFinalizarCuenta.addEventListener("click", async () => {
    if (!mesaActual) { return; }

    guardarEstadoBotones(true);

    const comprobante = capturarDatosComprobante();

    try {
        const total = calcularTotal();
        const propina = valorInput(campoPropina);
        const domicilio = valorInput(campoDomicilio);

        if (esBarra(mesaActual) && movimientoActual) {
            await api(`/movimientos/${movimientoActual.id}`, "PUT", {
                total,
                propina,
                domicilio,
                metodo: "Efectivo"
            });
        }

        const resultadoCierre = await api(`/mesas/${mesaActual.id}/finalizar`, "POST", {
            total,
            propina,
            domicilio,
            metodo: "Efectivo"
        });
        comprobante.referencia = comprobante.referencia || (resultadoCierre && resultadoCierre.id);
        comprobante.fecha = new Date();
    } catch (error) {
        console.error(error);
        manejarError(error, "No se pudo finalizar la cuenta.");
        guardarEstadoBotones(false);
        return;
    }

    cerrarPedidoFn();

    try {
        await construirComprobante(comprobante);
        cuentaModal.classList.add("active");
        if (!empresa || empresa.impresion_automatica !== false) {
            await imprimirComprobante();
        }
    } catch (error) {
        console.error("La cuenta se finalizó, pero no se pudo abrir la impresión.", error);
        mostrarAviso(
            "Cuenta finalizada",
            "La cuenta se cerró correctamente, pero no se pudo abrir la impresión automática."
        );
    }

    await cargarTodo();
    guardarEstadoBotones(false);
});

// ======================================================
// IMPRIMIR CUENTA
// ======================================================

function capturarDatosComprobante() {
    const mesa = mesaActual;
    const movimiento = movimientoActual || movimientoDeMesa(mesa);
    const lineas = lineasMesaActual().map(linea => ({
        ...linea,
        descuentoPorcentaje: porcentajeLinea(linea),
        totalConDescuento: totalLinea(linea)
    }));
    const propina = valorInput(campoPropina);
    const domicilio = valorInput(campoDomicilio);

    return {
        empresa: empresa ? { ...empresa } : null,
        operador: operador ? { ...operador } : null,
        mesa: nombreMesa(mesa),
        lineas,
        subtotal: lineas.reduce((suma, linea) => (
            suma + (Number(linea.precio_unitario) || 0) * (Number(linea.cantidad) || 0)
        ), 0),
        descuento: lineas.reduce((suma, linea) => (
            suma + (Number(linea.descuento) || 0) * (Number(linea.cantidad) || 0)
        ), 0),
        propina,
        domicilio,
        total: redondear(lineas.reduce((suma, linea) => suma + linea.totalConDescuento, 0) + propina + domicilio),
        cliente: "CLIENTES EN GENERAL",
        domicilioNombre: domicilio > 0 ? domicilioNombre.value.trim() : "",
        domicilioTelefono: domicilio > 0 ? domicilioTelefono.value.trim() : "",
        metodo: "Efectivo",
        fecha: new Date(),
        referencia: movimiento && movimiento.id
    };
}

async function construirComprobante(datos = capturarDatosComprobante()) {
    const filas = datos.lineas.map(linea => {
        const producto = productos.find(item => item.id === linea.id_producto);
        const cantidad = Number(linea.cantidad) || 0;
        const descripcion = producto ? producto.nombre : `Producto ${linea.id_producto}`;
        const notas = linea.notas ? `<small>${esc(linea.notas)}</small>` : "";
        return `
            <div class="recibo-producto">
                <div>
                    <strong>${cantidad} x ${esc(descripcion)}</strong>
                    ${notas}
                </div>
                <strong>${formatearPrecio(linea.totalConDescuento)}</strong>
            </div>
        `;
    }).join("");

    const ahora = datos.fecha instanceof Date ? datos.fecha : new Date(datos.fecha);
    const datosEmpresa = datos.empresa || {};
    const datosOperador = datos.operador || {};
    const direccionDomicilio = datos.domicilio > 0
        ? `
            <div class="recibo-seccion">
                <strong>DATOS DOMICILIO</strong>
                ${datos.domicilioNombre ? `<span>Recibe: ${esc(datos.domicilioNombre)}</span>` : ""}
                ${datos.domicilioTelefono ? `<span>Teléfono: ${esc(datos.domicilioTelefono)}</span>` : ""}
            </div>
        `
        : "";

    comprobanteImpresion.innerHTML = `
        <article class="recibo-termico">
            <header class="recibo-cabecera">
                <h2>${datosEmpresa.nombre ? esc(datosEmpresa.nombre) : "RESTAURANTE"}</h2>
                ${datosEmpresa.direccion ? `<span>${esc(datosEmpresa.direccion)}</span>` : ""}
                ${datosEmpresa.telefono ? `<span>Tel: ${esc(datosEmpresa.telefono)}</span>` : ""}
                ${datosEmpresa.NIT ? `<span>NIT: ${esc(datosEmpresa.NIT)}</span>` : ""}
                ${datosEmpresa.correo ? `<span>${esc(datosEmpresa.correo)}</span>` : ""}
                <strong>COMPROBANTE DE VENTA</strong>
                <span>INFORMATIVO - NO FISCAL</span>
            </header>

            <section class="recibo-seccion">
                <div class="recibo-par">
                    <span>Referencia interna</span>
                    <strong>${datos.referencia ? `#${esc(datos.referencia)}` : "—"}</strong>
                </div>
                <div class="recibo-par">
                    <span>Mesa</span>
                    <strong>${esc(datos.mesa)}</strong>
                </div>
                <div class="recibo-par">
                    <span>Fecha de expedición</span>
                    <strong>${ahora.toLocaleString("es-CO")}</strong>
                </div>
                <div class="recibo-par">
                    <span>Tipo de pago</span>
                    <strong>CONTADO</strong>
                </div>
                <div class="recibo-par">
                    <span>Método de pago</span>
                    <strong>${esc(datos.metodo)}</strong>
                </div>
                <div class="recibo-par">
                    <span>Cliente</span>
                    <strong>${esc(datos.cliente)}</strong>
                </div>
            </section>

            <section class="recibo-seccion">
                <strong>DETALLE DE PRODUCTOS</strong>
                ${filas || `<span>Sin productos registrados</span>`}
            </section>

            <section class="recibo-totales">
                <div class="recibo-par">
                    <span>Subtotal</span>
                    <strong>${formatearPrecio(datos.subtotal)}</strong>
                </div>
                ${datos.descuento > 0 ? `
                    <div class="recibo-par">
                        <span>Descuento</span>
                        <strong>-${formatearPrecio(datos.descuento)}</strong>
                    </div>
                ` : ""}
                <div class="recibo-par">
                    <span>Propina</span>
                    <strong>${formatearPrecio(datos.propina)}</strong>
                </div>
                <div class="recibo-par">
                    <span>Domicilio</span>
                    <strong>${formatearPrecio(datos.domicilio)}</strong>
                </div>
                <div class="recibo-par recibo-total">
                    <span>TOTAL</span>
                    <strong>${formatearPrecio(datos.total)}</strong>
                </div>
            </section>

            ${direccionDomicilio}

            <footer class="recibo-pie">
                <strong>ORIGINAL</strong>
                <span>Impreso: ${ahora.toLocaleString("es-CO")}</span>
                <span>Impreso por: ${esc(datosOperador.nombre || datosOperador.username || "Personal")}</span>
                <span>Este comprobante es informativo y no es una factura electrónica.</span>
                <span>¡Gracias por su visita!</span>
            </footer>
        </article>
    `;
}

function ajustarPaginaImpresion() {
    let estilo = document.getElementById("paginaReciboTermico");
    if (!estilo) {
        estilo = document.createElement("style");
        estilo.id = "paginaReciboTermico";
        document.head.appendChild(estilo);
    }

    const alturaMm = Math.max(50, Math.ceil(comprobanteImpresion.scrollHeight * 25.4 / 96 + 2));
    estilo.textContent = `@media print { @page { size: 80mm ${alturaMm}mm; margin: 0; } }`;
}

function imprimirComprobante() {
    return new Promise((resolve, reject) => {
        requestAnimationFrame(() => {
            try {
                ajustarPaginaImpresion();
                window.print();
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    });
}

async function imprimirCuenta() {
    if (!mesaActual) { return; }

    if (lineasMesaActual().length === 0) {
        alert("No hay productos registrados en esta cuenta.");
        return;
    }

    try {
        await construirComprobante(capturarDatosComprobante());
        cuentaModal.classList.add("active");
    } catch (error) {
        console.error(error);
        manejarError(error, "No se posible generar la cuenta.");
    }
}

btnImprimirCuenta.addEventListener("click", imprimirCuenta);

btnImprimirCuentaFinal.addEventListener("click", () => {
    imprimirComprobante().catch(error => {
        console.error(error);
        manejarError(error, "No se pudo abrir la impresión.");
    });
});

btnCerrarCuenta.addEventListener("click", () => {
    cuentaModal.classList.remove("active");
    mostrarMesas(filtroMesas());
});

window.onafterprint = () => {
    if (cuentaModal.classList.contains("active")) {
        cuentaModal.classList.remove("active");
        mostrarMesas(filtroMesas());
    }
};

// ======================================================
// BUSCAR
// ======================================================

buscarMesa.addEventListener("input", () => {
    mostrarMesas(filtroMesas());
});

// ======================================================
// ACCIONES DE LA TARJETA
// ======================================================

mesasTable.addEventListener("click", async event => {
    const boton = event.target.closest("[data-accion]");
    if (!boton) {
        const tarjeta = event.target.closest(".mesa-card");
        if (tarjeta) { abrirPedido(tarjeta.dataset.id); }
        return;
    }

    const accion = boton.getAttribute("data-accion");
    const id = Number(boton.getAttribute("data-id"));
    const mesa = mesas.find(item => item.id === id);
    if (!mesa) { return; }

    if (accion === "cuenta") {
        mesaActual = mesa;
        movimientoActual = esBarra(mesa) ? movimientoDeMesa(mesa) : null;
        const referencia = movimientoActual || movimientoDeMesa(mesa);
        campoPropina.value = Number(referencia && referencia.propina) || 0;
        campoDomicilio.value = Number(referencia && referencia.domicilio) || 0;
        await imprimirCuenta();
    } else if (accion === "cancelar") {
        pedirConfirmacionCancelar(mesa);
    }
});

mesasTable.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") { return; }
    const tarjeta = event.target.closest(".mesa-card");
    if (!tarjeta || event.target !== tarjeta) { return; }
    event.preventDefault();
    abrirPedido(tarjeta.dataset.id);
});

// ======================================================
// CERRAR MODALES (CLICK FUERA)
// ======================================================

pedidoModal.addEventListener("click", event => {
    if (event.target === pedidoModal) { cerrarPedidoFn(); mostrarMesas(filtroMesas()); }
});

cuentaModal.addEventListener("click", event => {
    if (event.target === cuentaModal) { btnCerrarCuenta.click(); }
});

confirmarModal.addEventListener("click", event => {
    if (event.target === confirmarModal) { cancelarConfirmar.click(); }
});

avisoModal.addEventListener("click", event => {
    if (event.target === avisoModal) { cerrarAviso.click(); }
});

mesaModal.addEventListener("click", event => {
    if (event.target === mesaModal) { cerrarMesaModalFn(); }
});

// ======================================================
// EVENTOS / INICIO
// ======================================================

// El boton "Registrar mesa" esta oculto por ahora; si no existe no se registra el listener.
if (btnRegistrarMesa) { btnRegistrarMesa.addEventListener("click", abrirMesaModal); }
cerrarMesaModal.addEventListener("click", cerrarMesaModalFn);
cancelarMesaModal.addEventListener("click", cerrarMesaModalFn);
cerrarPedido.addEventListener("click", () => { cerrarPedidoFn(); mostrarMesas(filtroMesas()); });
btnNuevoMovimiento.addEventListener("click", crearMovimientoBarra);
cerrarAviso.addEventListener("click", () => { avisoModal.classList.remove("active"); });

// Refleja el porcentaje de propina cacheado en la etiqueta del resumen.
if (propinaEtiqueta) {
    propinaEtiqueta.textContent = `Propina (${porcentajePropina()}%)`;
}

setInterval(actualizarTiempos, 1000);
cargarTodo();

let mesaSocketRetryTimer = null;
let mesaSocketRetryDelay = 1000;
let mesaRefreshTimer = null;

function conectarWebSocketMesas() {
    const token = getToken();
    if (!token) { return; }

    const socket = new WebSocket(`${API_URL.replace(/^http/, "ws")}/ws/mesas`);
    socket.addEventListener("open", () => socket.send(JSON.stringify({ token })));
    socket.addEventListener("message", event => {
        let message;
        try {
            message = JSON.parse(event.data);
        } catch (error) {
            return;
        }
        if (message.type !== "ready" && message.type !== "mesa.updated") { return; }
        if (message.type === "ready") { mesaSocketRetryDelay = 1000; }
        clearTimeout(mesaRefreshTimer);
        mesaRefreshTimer = setTimeout(() => cargarTodo({ soloEstado: true }), 400);
    });
    socket.addEventListener("close", event => {
        if (event.code === 1008) { return; }
        clearTimeout(mesaSocketRetryTimer);
        mesaSocketRetryTimer = setTimeout(conectarWebSocketMesas, mesaSocketRetryDelay);
        mesaSocketRetryDelay = Math.min(mesaSocketRetryDelay * 2, 15000);
    });
    socket.addEventListener("error", () => socket.close());
}

conectarWebSocketMesas();
