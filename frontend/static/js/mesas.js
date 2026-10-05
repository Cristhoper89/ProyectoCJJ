// ======================================================
// MESAS
// Lógica alineada con el módulo Mesas de la app móvil:
// Mesa -> Movimiento -> Mesa Consumo
// ======================================================

const API_URL = window.location.protocol === "https:" ? window.location.origin : "https://backend-6ad6b6fa.fastapicloud.dev";
const API_URL_STORAGE_KEY = "api_base_url";

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
const pedidoLineas = document.getElementById("pedidoLineas");

const campoSubtotal = document.getElementById("campoSubtotal");
const campoPropina = document.getElementById("campoPropina");
const btnQuitarPropina = document.getElementById("btnQuitarPropina");
const campoDomicilio = document.getElementById("campoDomicilio");
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

let mesaActual = null;
let movimientoActual = null;
let categoriaSeleccionada = null;
let descuentos = {};
let accionConfirmar = null;

let configProducto = null;
let configCantidad = 0;
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
        .filter(consumo => consumo.id_mov === idMov && Number(consumo.subtotal) > 0)
        .sort((a, b) => a.id - b.id);
}

function lineasMesaActual() {
    return lineasDeMovimiento(movimientoActivoId());
}

function totalMovimiento(movimiento) {
    if (!movimiento) { return 0; }

    const lineas = lineasDeMovimiento(movimiento.id);
    const subtotal = lineas.length > 0
        ? lineas.reduce((suma, linea) => suma + (Number(linea.subtotal) || 0) * (1 - porcentajeLinea(linea) / 100), 0)
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
    return Math.min(100, Math.max(0, Number(descuentos[linea.id]) || 0));
}

function totalLinea(linea) {
    return (Number(linea.subtotal) || 0) * (1 - porcentajeLinea(linea) / 100);
}

function calcularSubtotal() {
    return lineasMesaActual().reduce((suma, linea) => suma + totalLinea(linea), 0);
}

function calcularTotal() {
    return redondear(calcularSubtotal() + valorInput(campoPropina) + valorInput(campoDomicilio));
}

// ======================================================
// CARGAR DATOS
// ======================================================

function resultado(pedido, porDefecto) {
    return pedido.status === "fulfilled" ? pedido.value : porDefecto;
}

async function cargarEmpresa() {
    try {
        const data = await api("/empresas/");
        empresa = Array.isArray(data) && data.length ? data[0] : null;
    } catch (error) {
        empresa = null;
    }
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
        campoPropina.value = Number(referencia && referencia.propina) || 0;
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

    const fallo = pedidos.find(pedido => pedido.status === "rejected");
    if (fallo) {
        mostrarAviso(
            "No se pudo cargar todo",
            (fallo.reason && fallo.reason.message) || "Intenta nuevamente."
        );
    }

    await cargarEmpresa();
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

                    <button
                        type="button"
                        class="action-button"
                        title="Abrir pedido"
                        data-accion="pedido"
                        data-id="${mesa.id}"
                    >
                        <i data-lucide="utensils-crossed"></i>
                    </button>

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
    campoPropina.value = Number(referencia && referencia.propina) || 0;
    campoDomicilio.value = Number(referencia && referencia.domicilio) || 0;

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
    descuentos = {};
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
    campoPropina.value = Number(movimiento.propina) || 0;
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
        campoPropina.value = 0;
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

                <div class="linea-descuento">
                    <input
                        type="number"
                        class="descuento-input"
                        data-id="${linea.id}"
                        min="0"
                        max="100"
                        step="1"
                        placeholder="0"
                        value="${porcentaje > 0 ? porcentaje : ""}"
                    >
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

async function registrarProducto(producto, cantidad, configuracion = null) {
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

        const existentes = lineasDeMovimiento(idMov).filter(linea => linea.id_producto === producto.id);
        const notas = notasDeConfiguracion(configuracion);

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
            await api(`/mesasC/${objetivo.id}`, "PUT", cuerpo);

            const sobrantes = existentes.slice(1);
            for (const extra of sobrantes) {
                await api(`/mesasC/${extra.id}`, "DELETE");
            }

            consumos = consumos
                .filter(linea => !sobrantes.some(item => item.id === linea.id))
                .map(linea => linea.id === objetivo.id
                    ? { ...linea, cantidad: nuevaCantidad, subtotal: totalPrecio, notas: notas || linea.notas || null }
                    : linea);
        } else {
            const nuevo = await api("/mesasC/", "POST", {
                id_producto: producto.id,
                id_mov: idMov,
                cantidad: nuevaCantidad,
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
    await registrarProducto(producto, cantidadProductoEnMesa(producto.id) + 1);
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
        const grupos = await api(`/productos/${producto.id}/grupos-opciones/`);

        configProducto = producto;
        configCantidad = Number(linea.cantidad) || 0;
        configGrupos = Array.isArray(grupos) ? grupos : [];
        configIngredientes = Object.fromEntries(
            productoIngredientes
                .filter(relacion => relacion.id_producto === producto.id)
                .map(relacion => [relacion.id_ingrediente, true])
        );
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
    await registrarProducto(producto, cantidad, configuracion);
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
    const cantidad = accion === "mas"
        ? cantidadActual + 1
        : accion === "menos"
            ? cantidadActual - 1
            : 0;

    await registrarProducto(producto, cantidad);
});

// ======================================================
// DESCUENTOS
// ======================================================

pedidoLineas.addEventListener("input", event => {
    const input = event.target.closest(".descuento-input");
    if (!input) { return; }

    const id = Number(input.getAttribute("data-id"));
    let valor = parseFloat(input.value);
    if (isNaN(valor) || valor < 0) { valor = 0; }
    if (valor > 100) { valor = 100; }

    descuentos = { ...descuentos, [id]: valor };

    const linea = lineasMesaActual().find(item => item.id === id);
    const fila = pedidoLineas.querySelector(`.pedido-linea[data-linea="${id}"] .linea-subtotal`);
    if (linea && fila) {
        fila.textContent = formatearPrecio(totalLinea(linea));
    }

    campoSubtotal.textContent = formatearPrecio(calcularSubtotal());
    campoTotal.textContent = formatearPrecio(calcularTotal());
    renderMovimientosBarra();
});

// ======================================================
// PROpina / DOMICILIO
// ======================================================

btnQuitarPropina.addEventListener("click", () => {
    campoPropina.value = 0;
    refrescarResumen();
    mostrarMesas(filtroMesas());
});

campoPropina.addEventListener("input", () => {
    campoTotal.textContent = formatearPrecio(calcularTotal());
});

campoPropina.addEventListener("change", () => {
    refrescarResumen();
    mostrarMesas(filtroMesas());
});

campoDomicilio.addEventListener("input", () => {
    campoTotal.textContent = formatearPrecio(calcularTotal());
});

campoDomicilio.addEventListener("change", () => {
    refrescarResumen();
    mostrarMesas(filtroMesas());
});

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

    try {
        // Los descuentos se aplican sobre el subtotal de cada línea.
        for (const linea of lineasMesaActual()) {
            const porcentaje = porcentajeLinea(linea);
            const cantidad = Number(linea.cantidad) || 0;
            const unidad = Number(linea.precio_unitario) || 0;
            if (porcentaje <= 0 || cantidad <= 0 || unidad <= 0) { continue; }
            const descuento = redondear(unidad * porcentaje / 100);
            if (descuento > 0) {
                await api(`/mesasC/${linea.id}`, "PUT", { descuento });
            }
        }

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

        await api(`/mesas/${mesaActual.id}/finalizar`, "POST", {
            total,
            propina,
            domicilio,
            metodo: "Efectivo"
        });

        cerrarPedidoFn();
        await cargarTodo();
    } catch (error) {
        console.error(error);
        manejarError(error, "No se pudo finalizar la cuenta.");
    } finally {
        guardarEstadoBotones(false);
    }
});

// ======================================================
// IMPRIMIR CUENTA
// ======================================================

async function construirComprobante() {
    if (!mesaActual) { return; }

    const lineas = lineasMesaActual();

    const ahora = new Date();
    const fecha = ahora.toLocaleDateString("es-CO");
    const hora = ahora.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });

    const filas = lineas.map(linea => {
        const producto = productos.find(item => item.id === linea.id_producto);
        const porcentaje = porcentajeLinea(linea);
        const descuento = (Number(linea.subtotal) || 0) - totalLinea(linea);
        return `
            <tr>
                <td>${producto ? esc(producto.nombre) : `Producto ${linea.id_producto}`}${linea.notas ? `<br><small>${esc(linea.notas)}</small>` : ""}</td>
                <td class="texto-centro">${linea.cantidad}</td>
                <td class="texto-derecha">${formatearPrecio(linea.precio_unitario)}</td>
                <td class="texto-derecha">${porcentaje > 0 ? `${formatearPrecio(descuento)}` : "—"}</td>
                <td class="texto-derecha">${formatearPrecio(totalLinea(linea))}</td>
            </tr>
        `;
    }).join("");

    comprobanteImpresion.innerHTML = `
        <div class="comprobante-cabecera">
            <h2>${empresa && empresa.nombre ? esc(empresa.nombre) : "RESTAURANTE"}</h2>
            ${empresa && empresa.direccion ? `<p>${esc(empresa.direccion)}</p>` : ""}
            ${empresa && empresa.telefono ? `<p>Tel: ${esc(empresa.telefono)}</p>` : ""}
            ${empresa && empresa.NIT ? `<p>NIT: ${esc(empresa.NIT)}</p>` : ""}
        </div>

        <div class="comprobante-datos">
            <p><strong>${esc(nombreMesa(mesaActual))}</strong></p>
            <p>Fecha: ${fecha} — ${hora}</p>
        </div>

        <table class="comprobante-tabla">
            <thead>
                <tr>
                    <th>Producto</th>
                    <th class="texto-centro">Cant.</th>
                    <th class="texto-derecha">P. Unit.</th>
                    <th class="texto-derecha">Desc.</th>
                    <th class="texto-derecha">Subtotal</th>
                </tr>
            </thead>
            <tbody>
                ${filas}
            </tbody>
        </table>

        <div class="comprobante-totales">
            <p><span>Subtotal</span><strong>${formatearPrecio(calcularSubtotal())}</strong></p>
            <p><span>Propina</span><strong>${formatearPrecio(valorInput(campoPropina))}</strong></p>
            <p><span>Domicilio</span><strong>${formatearPrecio(valorInput(campoDomicilio))}</strong></p>
            <p class="comprobante-total"><span>Total</span><strong>${formatearPrecio(calcularTotal())}</strong></p>
        </div>

        <div class="comprobante-pie">
            <p>¡Gracias por su visita!</p>
        </div>
    `;
}

async function imprimirCuenta() {
    if (!mesaActual) { return; }

    if (lineasMesaActual().length === 0) {
        alert("No hay productos registrados en esta cuenta.");
        return;
    }

    try {
        await construirComprobante();
        cuentaModal.classList.add("active");
    } catch (error) {
        console.error(error);
        manejarError(error, "No se posible generar la cuenta.");
    }
}

btnImprimirCuenta.addEventListener("click", imprimirCuenta);

btnImprimirCuentaFinal.addEventListener("click", () => {
    window.print();
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
    if (!boton) { return; }

    const accion = boton.getAttribute("data-accion");
    const id = Number(boton.getAttribute("data-id"));
    const mesa = mesas.find(item => item.id === id);
    if (!mesa) { return; }

    if (accion === "pedido") {
        abrirPedido(id);
    } else if (accion === "cuenta") {
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

btnRegistrarMesa.addEventListener("click", abrirMesaModal);
cerrarMesaModal.addEventListener("click", cerrarMesaModalFn);
cancelarMesaModal.addEventListener("click", cerrarMesaModalFn);
cerrarPedido.addEventListener("click", () => { cerrarPedidoFn(); mostrarMesas(filtroMesas()); });
btnNuevoMovimiento.addEventListener("click", crearMovimientoBarra);
cerrarAviso.addEventListener("click", () => { avisoModal.classList.remove("active"); });

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
