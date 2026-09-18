// ======================================================
// MESAS
// ======================================================

const API_URL = "http://127.0.0.1:8000";

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

const confirmarModal = document.getElementById("confirmarModal");
const cancelarConfirmar = document.getElementById("cancelarConfirmar");
const confirmarAccion = document.getElementById("confirmarAccion");
const confirmarTitulo = document.getElementById("confirmarTitulo");
const confirmarMensaje = document.getElementById("confirmarMensaje");

const cuentaModal = document.getElementById("cuentaModal");
const comprobanteImpresion = document.getElementById("comprobanteImpresion");
const btnImprimirCuentaFinal = document.getElementById("btnImprimirCuentaFinal");
const btnCerrarCuenta = document.getElementById("btnCerrarCuenta");

// ======================================================
// VARIABLES
// ======================================================

let mesas = [];
let productos = [];
let categorias = [];
let consumos = [];
let empresa = null;

let mesaActual = null;
let categoriaSeleccionada = null;
let accionConfirmar = null;

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

function localDatetime() {
    const d = new Date();
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
           `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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

function obtenerTiempoTranscurrido(horaInicio) {
    if (!horaInicio) { return null; }
    const inicio = new Date(horaInicio).getTime();
    if (isNaN(inicio)) { return null; }
    return Date.now() - inicio;
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
// CARGAR DATOS
// ======================================================

async function cargarMesas() {
    mesasTable.innerHTML = `
        <div class="mesa-loading">
            <i data-lucide="loader-circle"></i>
            <span>Cargando mesas...</span>
        </div>
    `;

    try {
        const data = await api("/mesas/");
        mesas = data;
        mostrarMesas(buscarMesa.value.trim().toLowerCase());
        lucide.createIcons();
    } catch (error) {
        console.error(error);
        mesasTable.innerHTML = `
            <div class="mesa-loading">
                <i data-lucide="alert-triangle"></i>
                <span>No fue posible conectar con el servidor.</span>
            </div>
        `;
        lucide.createIcons();
    }
}

async function cargarCatalogos() {
    const [prods, cats] = await Promise.all([
        api("/productos/"),
        api("/categorias/")
    ]);
    productos = prods;
    categorias = cats;
}

async function cargarConsumos() {
    consumos = await api("/mesasC/");
}

async function cargarEmpresa() {
    try {
        const data = await api("/empresas/");
        empresa = Array.isArray(data) && data.length ? data[0] : null;
    } catch (error) {
        empresa = null;
    }
}

async function cargarTodo() {
    await Promise.all([
        cargarCatalogos(),
        cargarConsumos(),
        cargarEmpresa()
    ]);
    await cargarMesas();
}

// ======================================================
// MOSTRAR MESAS
// ======================================================

function mostrarMesas(filtro = "") {
    mesasTable.innerHTML = "";

    const lista = filtro
        ? mesas.filter(mesa => {
            const nombre = String(mesa.nombre || mesa.id);
            const texto = nombre + " " + (mesa.tipo ? "mesa" : "barra");
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
        tarjeta.className = `mesa-card${mesa.estado === true ? " ocupada" : ""}`;

        const nombreMesa = esc(mesa.nombre || `Mesa ${mesa.id}`);
        const ocupada = mesa.estado === true;
        const tieneConsumo = consumos.some(c => c.id_mesa === mesa.id);
        const ms = obtenerTiempoTranscurrido(mesa.hora_inicio);

        tarjeta.innerHTML = `

            <div class="mesa-card-img ${ocupada ? "ocupada" : "disponible"}">
                <span class="mesa-card-emoji">${mesa.tipo ? "🍔" : "🍺"}</span>
                <span class="estado-mesa-badge tipo-badge">
                    ${mesa.tipo ? "Mesa" : "Barra"}
                </span>
            </div>

            <div class="mesa-card-body">

                <div class="mesa-card-cabecera">
                    <strong class="mesa-card-nombre">${nombreMesa}</strong>
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
                    ${formatearPrecio(mesa.total)}
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

                    ${tieneConsumo ? `
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
    tipoMesa.value = "true";
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
            tipo: tipoMesa.value === "true"
        });

        mesaMessage.textContent = "Mesa registrada correctamente.";
        mesaMessage.className = "mesa-message success";

        await cargarMesas();

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
    return productos.filter(p => p.estado !== false);
}

function categoriasConProductos() {
    const prods = productosActivos();
    const ids = new Set(prods.map(p => p.id_categoria));
    return categorias.filter(c => c.estado !== false && ids.has(c.id));
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
        : productosActivos().filter(p => p.id_categoria === categoriaSeleccionada);

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
            <strong>${producto.nombre}</strong>
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

async function abrirPedido(mesaId) {
    const mesa = mesas.find(m => m.id === Number(mesaId));
    if (!mesa) { return; }

    mesaActual = mesa;
    categoriaSeleccionada = null;

    pedidoMesaNombre.textContent = `${mesa.tipo ? "Mesa" : "Barra"} ${mesa.id}`;
    pedidoEstadoBadge.className = "estado-mesa-badge " + (mesa.estado ? "ocupada" : "disponible");
    pedidoEstadoBadge.textContent = mesa.estado ? "Ocupada" : "Disponible";

    campoPropina.value = mesa.propina || 0;
    campoDomicilio.value = mesa.domicilio || 0;

    pedidoModal.classList.add("active");
    renderChips();
    renderProductos();
    await refrescarResumen();
    actualizarTiempos();
}

function cerrarPedidoFn() {
    pedidoModal.classList.remove("active");
    mesaActual = null;
}

function lineasMesaActual() {
    if (!mesaActual) { return []; }
    return consumos.filter(c => c.id_mesa === mesaActual.id)
                  .sort((a, b) => a.id - b.id);
}

function calcularSubtotal() {
    return lineasMesaActual().reduce((suma, linea) => suma + Number(linea.subtotal || 0), 0);
}

function valorInput(elemento) {
    const valor = parseFloat(elemento.value);
    return isNaN(valor) || valor < 0 ? 0 : valor;
}

function calcularTotal() {
    return Math.round((calcularSubtotal() + valorInput(campoPropina) + valorInput(campoDomicilio)) * 100) / 100;
}

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
        const producto = productos.find(p => p.id === linea.id_producto);
        const precioMax = Number(linea.precio_unitario) * Number(linea.cantidad);

        const fila = document.createElement("div");
        fila.className = "pedido-linea";
        fila.innerHTML = `
            <div class="linea-nombre">
                <strong>${producto ? producto.nombre : `Producto ${linea.id_producto}`}</strong>
                <span>${formatearPrecio(linea.precio_unitario)} x ${linea.cantidad}</span>
            </div>

            <div class="linea-acciones">
                <div class="stepper">
                    <button type="button" class="step-btn" data-accion="menos" data-id="${linea.id}">
                        <i data-lucide="minus"></i>
                    </button>
                    <span>${linea.cantidad}</span>
                    <button type="button" class="step-btn" data-accion="mas" data-id="${linea.id}">
                        <i data-lucide="plus"></i>
                    </button>
                </div>

                <div class="linea-descuento">
                    <input
                        type="number"
                        class="descuento-input"
                        data-id="${linea.id}"
                        data-max="${precioMax.toFixed(2)}"
                        min="0"
                        max="${precioMax.toFixed(2)}"
                        step="0.01"
                        placeholder="Descuento $"
                        value="${Number(linea.descuento || 0).toFixed(2)}"
                    >
                </div>

                <strong class="linea-subtotal">
                    ${formatearPrecio(linea.subtotal)}
                </strong>

                <button type="button" class="action-button danger" data-accion="eliminar" data-id="${linea.id}">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        `;
        pedidoLineas.appendChild(fila);
    });

    lucide.createIcons();
}

async function refrescarResumen() {
    renderLineas();
    campoSubtotal.textContent = formatearPrecio(calcularSubtotal());
    campoTotal.textContent = formatearPrecio(calcularTotal());
}

async function persistirMesa() {
    if (!mesaActual) { return; }

    const lineas = lineasMesaActual();

    try {
        if (lineas.length > 0) {
            const datos = {
                estado: true,
                hora_inicio: mesaActual.hora_inicio || localDatetime(),
                total: calcularTotal(),
                propina: valorInput(campoPropina),
                domicilio: valorInput(campoDomicilio)
            };
            const actualizada = await api(`/mesas/${mesaActual.id}`, "PUT", datos);
            mesaActual.hora_inicio = actualizada.hora_inicio || mesaActual.hora_inicio;
            mesaActual.estado = true;
        } else {
            await api(`/mesas/${mesaActual.id}`, "PUT", {
                estado: false,
                total: 0,
                propina: 0,
                domicilio: 0
            });
            await api(`/mesas/${mesaActual.id}/cerrar`, "PATCH", null);
            mesaActual.estado = false;
            mesaActual.hora_inicio = null;
        }
    } catch (error) {
        console.error("Error al persistir la mesa:", error);
    }
}

async function agregarProducto(producto) {
    if (!mesaActual) { return; }

    const teniaLineas = lineasMesaActual().length > 0;

    // Si la mesa estaba inactiva pero conservaba consumos de un pedido cerrado,
    // se limpian para comenzar un nuevo pedido.
    if (!mesaActual.estado && teniaLineas) {
        await api(`/mesasC/mesa/${mesaActual.id}/todo`, "DELETE", null);
        await cargarConsumos();
        campoPropina.value = 0;
        campoDomicilio.value = 0;
        mesaActual.hora_inicio = null;
    }

    const eraVacia = lineasMesaActual().length === 0;

    try {
        await api("/mesasC/", "POST", {
            id_producto: producto.id,
            id_mesa: mesaActual.id,
            cantidad: 1
        });

        await cargarConsumos();
        await refrescarResumen();

        // Propina por defecto (10%) al registrar el primer producto
        if (eraVacia && valorInput(campoPropina) === 0) {
            campoPropina.value = Math.round(calcularSubtotal() * 0.10 * 100) / 100;
            await refrescarResumen();
        }

        await persistirMesa();
        pedidoEstadoBadge.className = "estado-mesa-badge ocupada";
        pedidoEstadoBadge.textContent = "Ocupada";
        actualizarTiempos();
    } catch (error) {
        console.error(error);
        alert(error.message || "No fue posible registrar el producto.");
    }
}

// ======================================================
// ACCIONES SOBRE LÍNEAS
// ======================================================

pedidoLineas.addEventListener("click", async event => {
    const boton = event.target.closest("[data-accion]");
    if (!boton) { return; }

    const id = Number(boton.getAttribute("data-id"));
    const accion = boton.getAttribute("data-accion");
    const linea = consumos.find(c => c.id === id);
    if (!linea) { return; }

    boton.disabled = true;

    try {
        if (accion === "mas") {
            await api(`/mesasC/${id}`, "PUT", {
                id_mesa: linea.id_mesa,
                cantidad: Number(linea.cantidad) + 1
            });
        } else if (accion === "menos") {
            const nueva = Number(linea.cantidad) - 1;
            if (nueva <= 0) {
                await api(`/mesasC/${id}`, "DELETE", null);
            } else {
                await api(`/mesasC/${id}`, "PUT", {
                    id_mesa: linea.id_mesa,
                    cantidad: nueva
                });
            }
        } else if (accion === "eliminar") {
            await api(`/mesasC/${id}`, "DELETE", null);
        }

        await cargarConsumos();
        await refrescarResumen();
        await persistirMesa();
        actualizarTiempos();
    } catch (error) {
        console.error(error);
        alert(error.message || "No fue posible modificar el producto.");
    } finally {
        boton.disabled = false;
    }
});

pedidoLineas.addEventListener("change", async event => {
    const input = event.target.closest(".descuento-input");
    if (!input) { return; }

    const id = Number(input.getAttribute("data-id"));
    const linea = consumos.find(c => c.id === id);
    if (!linea) { return; }

    let valor = parseFloat(input.value);
    if (isNaN(valor) || valor < 0) { valor = 0; }

    const maximo = parseFloat(input.getAttribute("data-max") || 0);
    if (valor > maximo) { valor = maximo; }

    input.value = valor.toFixed(2);

    try {
        await api(`/mesasC/${id}`, "PUT", {
            id_mesa: linea.id_mesa,
            cantidad: linea.cantidad,
            descuento: valor
        });

        await cargarConsumos();
        await refrescarResumen();
        await persistirMesa();
    } catch (error) {
        console.error(error);
        alert(error.message || "No fue posible aplicar el descuento.");
    }
});

// ======================================================
// PROpina / DOMICILIO
// ======================================================

btnQuitarPropina.addEventListener("click", () => {
    campoPropina.value = 0;
    refrescarTotalesYGuardar();
});

campoPropina.addEventListener("change", refrescarTotalesYGuardar);
campoPropina.addEventListener("input", () => {
    campoTotal.textContent = formatearPrecio(calcularTotal());
});

campoDomicilio.addEventListener("change", refrescarTotalesYGuardar);
campoDomicilio.addEventListener("input", () => {
    campoTotal.textContent = formatearPrecio(calcularTotal());
});

async function refrescarTotalesYGuardar() {
    await refrescarResumen();
    await persistirMesa();
}

// ======================================================
// CANCELAR PEDIDO
// ======================================================

btnCancelarPedido.addEventListener("click", () => {
    if (!mesaActual) { return; }
    accionConfirmar = "cancelar";
    confirmarTitulo.textContent = "Cancelar pedido";
    confirmarMensaje.textContent =
        `¿Está seguro de que desea cancelar el pedido de la ${mesaActual.tipo ? "mesa" : "barra"} ${mesaActual.id}? Todos los productos registrados serán eliminados.`;
    document.getElementById("confirmarAccion").textContent = "Sí, cancelar";
    confirmarModal.classList.add("active");
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
        await api(`/mesasC/mesa/${mesaActual.id}/todo`, "DELETE", null);
        await api(`/mesas/${mesaActual.id}`, "PUT", {
            estado: false,
            total: 0,
            propina: 0,
            domicilio: 0
        });
        await api(`/mesas/${mesaActual.id}/cerrar`, "PATCH", null);

        confirmarModal.classList.remove("active");
        accionConfirmar = null;

        const mesaCerrada = mesaActual.id;
        cerrarPedidoFn();
        await cargarTodo();
    } catch (error) {
        console.error(error);
        alert(error.message || "No fue posible cancelar el pedido.");
    } finally {
        boton.disabled = false;
        document.getElementById("confirmarAccion").textContent = "Sí, cancelar";
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
        const producto = productos.find(p => p.id === linea.id_producto);
        const descuento = Number(linea.descuento || 0);
        return `
            <tr>
                <td>${producto ? producto.nombre : `Producto ${linea.id_producto}`}</td>
                <td class="texto-centro">${linea.cantidad}</td>
                <td class="texto-derecha">${formatearPrecio(linea.precio_unitario)}</td>
                <td class="texto-derecha">${descuento > 0 ? formatearPrecio(descuento) : "—"}</td>
                <td class="texto-derecha">${formatearPrecio(linea.subtotal)}</td>
            </tr>
        `;
    }).join("");

    comprobanteImpresion.innerHTML = `
        <div class="comprobante-cabecera">
            <h2>${empresa && empresa.nombre ? empresa.nombre : "RESTAURANTE"}</h2>
            ${empresa && empresa.direccion ? `<p>${empresa.direccion}</p>` : ""}
            ${empresa && empresa.telefono ? `<p>Tel: ${empresa.telefono}</p>` : ""}
            ${empresa && empresa.NIT ? `<p>NIT: ${empresa.NIT}</p>` : ""}
        </div>

        <div class="comprobante-datos">
            <p><strong>${mesaActual.tipo ? "MESA" : "BARRA"} #${mesaActual.id}</strong></p>
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

btnImprimirCuenta.addEventListener("click", async () => {
    if (!mesaActual) { return; }

    const lineas = lineasMesaActual();
    if (lineas.length === 0) {
        alert("No hay productos registrados en esta mesa.");
        return;
    }

    const boton = btnImprimirCuenta;
    boton.disabled = true;

    try {
        // Al imprimir, la mesa pasa a estado terminada
        await api(`/mesas/${mesaActual.id}/cerrar`, "PATCH", null);
        mesaActual.estado = false;
        mesaActual.hora_inicio = null;

        await cargarConsumos();
        await refrescarResumen();
        await construirComprobante();
        cuentaModal.classList.add("active");
    } catch (error) {
        console.error(error);
        alert(error.message || "No fue posible generar la cuenta.");
    } finally {
        boton.disabled = false;
    }
});

btnImprimirCuentaFinal.addEventListener("click", () => {
    window.print();
});

btnCerrarCuenta.addEventListener("click", async () => {
    cuentaModal.classList.remove("active");
    cerrarPedidoFn();
    await cargarTodo();
});

window.onafterprint = async () => {
    if (cuentaModal.classList.contains("active")) {
        cuentaModal.classList.remove("active");
        cerrarPedidoFn();
        await cargarTodo();
    }
};

// ======================================================
// BUSCAR
// ======================================================

buscarMesa.addEventListener("input", () => {
    mostrarMesas(buscarMesa.value.trim().toLowerCase());
});

// ======================================================
// ACCIONES DE LA TABLA
// ======================================================

mesasTable.addEventListener("click", async event => {
    const boton = event.target.closest("[data-accion]");
    if (!boton) { return; }

    const accion = boton.getAttribute("data-accion");
    const id = Number(boton.getAttribute("data-id"));

    if (accion === "pedido") {
        await abrirPedido(id);
    } else if (accion === "cuenta") {
        const mesa = mesas.find(m => m.id === id);
        if (mesa) {
            mesaActual = mesa;
            campoPropina.value = mesa.propina || 0;
            campoDomicilio.value = mesa.domicilio || 0;
            const lineas = consumos.filter(c => c.id_mesa === id);
            if (lineas.length === 0) {
                alert("No hay productos registrados en esta mesa.");
                mesaActual = null;
                return;
            }
            try {
                await api(`/mesas/${id}/cerrar`, "PATCH", null);
                await cargarConsumos();
                await construirComprobante();
                cuentaModal.classList.add("active");
            } catch (error) {
                console.error(error);
                alert(error.message || "No fue posible generar la cuenta.");
            }
        }
    } else if (accion === "cancelar") {
        const mesa = mesas.find(m => m.id === id);
        if (mesa) {
            mesaActual = mesa;
            accionConfirmar = "cancelar";
            confirmarTitulo.textContent = "Cancelar pedido";
            confirmarMensaje.textContent =
                `¿Está seguro de que desea cancelar el pedido de la ${mesa.tipo ? "mesa" : "barra"} ${mesa.id}? Todos los productos registrados serán eliminados.`;
            document.getElementById("confirmarAccion").textContent = "Sí, cancelar";
            confirmarModal.classList.add("active");
        }
    }
});

// ======================================================
// CERRAR MODALES (CLICK FUERA)
// ======================================================

pedidoModal.addEventListener("click", event => {
    if (event.target === pedidoModal) { cerrarPedidoFn(); }
});

cuentaModal.addEventListener("click", event => {
    if (event.target === cuentaModal) { btnCerrarCuenta.click(); }
});

confirmarModal.addEventListener("click", event => {
    if (event.target === confirmarModal) { cancelarConfirmar.click(); }
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
cerrarPedido.addEventListener("click", cerrarPedidoFn);

setInterval(actualizarTiempos, 1000);
cargarTodo();