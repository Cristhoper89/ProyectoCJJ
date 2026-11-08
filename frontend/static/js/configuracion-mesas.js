// ======================================================
// CONFIGURACIÓN DE MESAS
// Misma lógica del módulo móvil "Configuración mesa":
// listar, buscar, filtrar, crear, editar, eliminar y QR.
// ======================================================

const API_URL = "https://serviciocontigo.io/api";
const ROLES_PERMITIDOS = ["Administrador", "Cajero"];

// ======================================================
// ELEMENTOS
// ======================================================

const mensaje = document.getElementById("mesaConfigMessage");
const cargando = document.getElementById("mesaConfigLoading");
const restringido = document.getElementById("mesaConfigRestricted");
const reintentar = document.getElementById("mesaConfigRetry");
const tarjeta = document.getElementById("mesaConfigCard");
const tabla = document.getElementById("mesasTabla");

const totalMesas = document.getElementById("totalMesas");
const totalMesasTipo = document.getElementById("totalMesasTipo");
const totalBarras = document.getElementById("totalBarras");
const totalDisponibles = document.getElementById("totalDisponibles");
const contador = document.getElementById("mesaCounter");

const buscarMesa = document.getElementById("buscarMesa");
const filtros = [...document.querySelectorAll(".mesa-config-filter")];
const btnNuevaMesa = document.getElementById("nuevaMesa");

const modal = document.getElementById("mesaModal");
const modalEyebrow = document.getElementById("mesaModalEyebrow");
const modalTitulo = document.getElementById("mesaModalTitle");
const modalDescripcion = document.getElementById("mesaModalDescription");
const form = document.getElementById("mesaForm");
const nombreInput = document.getElementById("mesaNombre");
const tipoField = document.getElementById("mesaTipoField");
const formMessage = document.getElementById("mesaFormMessage");
const btnGuardar = document.getElementById("guardarMesa");
const cerrarModal = document.getElementById("cerrarMesaModal");
const cancelarModal = document.getElementById("cancelarMesaModal");

const confirmModal = document.getElementById("mesaConfirmModal");
const confirmMensaje = document.getElementById("mesaConfirmMessage");
const cancelarConfirmar = document.getElementById("cancelarConfirmar");
const confirmarEliminar = document.getElementById("confirmarEliminar");

const qrModal = document.getElementById("qrModal");
const qrTitulo = document.getElementById("qrModalTitle");
const qrCanvas = document.getElementById("qrCanvas");
const cerrarQr = document.getElementById("cerrarQrModal");
const imprimirQr = document.getElementById("imprimirQr");
const descargarQr = document.getElementById("descargarQr");

// ======================================================
// ESTADO
// ======================================================

const estado = {
    mesas: [],
    busqueda: "",
    filtro: "todas",
    editando: null,
    guardando: false,
    eliminando: null,
    qrMesa: null
};

let temporizadorMensaje = null;

// ======================================================
// API
// ======================================================

function getHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("access_token") || ""}`
    };
}

async function apiRequest(ruta, opciones = {}) {
    const response = await fetch(`${API_URL}${ruta}`, {
        ...opciones,
        headers: { ...getHeaders(), ...(opciones.headers || {}) }
    });

    if (response.status === 401) {
        localStorage.removeItem("access_token");
        window.location.href = "/";
        throw new Error("La sesión expiró. Inicia sesión nuevamente.");
    }

    if (response.status === 204) {
        return null;
    }

    const texto = await response.text();
    let data = null;
    if (texto) {
        try {
            data = JSON.parse(texto);
        } catch {
            data = texto;
        }
    }

    if (!response.ok) {
        const detalle = data && typeof data === "object" ? data.detail || data.message : data;
        throw new Error(typeof detalle === "string" ? detalle : "No fue posible completar la solicitud.");
    }

    return data;
}

// ======================================================
// AYUDA
// ======================================================

function escapeHtml(valor) {
    return String(valor ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function esBarra(mesa) {
    return mesa && mesa.tipo === "barra";
}

function nombreMesa(mesa) {
    if (!mesa) { return ""; }
    return mesa.nombre || (esBarra(mesa) ? "Barra" : `Mesa ${mesa.id}`);
}

// Misma regla que la app: disponible y sin movimiento activo.
function estaDisponible(mesa) {
    return mesa.estado === false && mesa.id_mov == null;
}

function tipoSeleccionado() {
    const opcion = form.querySelector('input[name="tipoMesa"]:checked');
    return opcion && opcion.value === "barra" ? "barra" : "mesa";
}

function mostrarMensaje(texto = "", tipo = "") {
    clearTimeout(temporizadorMensaje);
    mensaje.textContent = texto;
    mensaje.className = `mesa-config-message ${tipo} ${texto ? "visible" : ""}`;
    if (texto) {
        temporizadorMensaje = setTimeout(() => mostrarMensaje(), 5000);
    }
}

function mostrarMensajeFormulario(texto = "") {
    formMessage.textContent = texto;
    formMessage.classList.toggle("visible", Boolean(texto));
}

function mostrarEstado(nombre) {
    cargando.hidden = nombre !== "loading";
    restringido.hidden = nombre !== "restricted";
    reintentar.hidden = nombre !== "error";
    tarjeta.hidden = nombre !== "ready";
}

// ======================================================
// CARGA
// ======================================================

async function iniciar() {
    if (!localStorage.getItem("access_token")) {
        window.location.href = "/";
        return;
    }

    mostrarEstado("loading");
    mostrarMensaje();

    try {
        const usuario = await apiRequest("/auth/me", { cache: "no-store" });
        if (!ROLES_PERMITIDOS.includes(usuario.role_name)) {
            mostrarEstado("restricted");
            return;
        }

        await cargarMesas();
        mostrarEstado("ready");
    } catch (error) {
        mostrarEstado("error");
        mostrarMensaje(error.message || "No fue posible cargar las mesas.", "error");
    }
}

async function cargarMesas() {
    const data = await apiRequest("/mesas/", { cache: "no-store" });
    estado.mesas = Array.isArray(data) ? data : [];
    renderizar();
}

// ======================================================
// RENDER
// ======================================================

function mesasVisibles() {
    const texto = estado.busqueda.trim().toLowerCase();

    // Misma regla que la app: busca sobre "nombre" o "Mesa {id}".
    return estado.mesas.filter(mesa => {
        const nombre = String(mesa.nombre || `Mesa ${mesa.id}`).toLowerCase();
        const coincideBusqueda = nombre.includes(texto);
        const coincideTipo = estado.filtro === "todas" || mesa.tipo === estado.filtro;
        return coincideBusqueda && coincideTipo;
    });
}

function renderizarResumen() {
    const mesas = estado.mesas;
    totalMesas.textContent = mesas.length;
    totalMesasTipo.textContent = mesas.filter(mesa => mesa.tipo === "mesa").length;
    totalBarras.textContent = mesas.filter(mesa => mesa.tipo === "barra").length;
    totalDisponibles.textContent = mesas.filter(mesa => estaDisponible(mesa)).length;
}

function renderizarTabla() {
    const visibles = mesasVisibles();

    contador.textContent = `${visibles.length} ${visibles.length === 1 ? "resultado" : "resultados"}`;

    if (visibles.length === 0) {
        const texto = estado.mesas.length === 0
            ? "No hay mesas registradas. Crea una mesa o barra para comenzar."
            : "No se encontraron mesas con ese criterio.";
        tabla.innerHTML = `<tr><td colspan="4" class="mesa-config-placeholder">${texto}</td></tr>`;
        return;
    }

    tabla.innerHTML = visibles.map(mesa => {
        const barra = esBarra(mesa);
        const disponible = estaDisponible(mesa);
        const ocupada = mesa.estado === true;
        const nombre = escapeHtml(nombreMesa(mesa));
        const tipo = barra ? "Barra" : "Mesa";

        return `
            <tr>
                <td>
                    <div class="mesa-config-name">
                        <span class="mesa-config-name-icon"><i data-lucide="${barra ? "beer" : "utensils"}"></i></span>
                        <div>
                            <strong>${nombre}</strong>
                            <small>#${mesa.id}</small>
                        </div>
                    </div>
                </td>
                <td><span class="mesa-config-tag">${tipo}</span></td>
                <td>
                    <span class="mesa-config-status ${ocupada ? "ocupada" : ""}">
                        ${ocupada ? "Ocupada" : "Disponible"}
                    </span>
                </td>
                <td class="mesa-config-actions-cell">
                    <div class="mesa-config-actions">
                        ${mesa.tipo === "mesa" && disponible ? `
                            <button class="mesa-config-icon-button" type="button" data-action="qr" data-id="${mesa.id}" title="Ver QR de ${nombre}" aria-label="Ver QR de ${nombre}">
                                <i data-lucide="qr-code"></i>
                            </button>
                        ` : ""}
                        <button class="mesa-config-icon-button" type="button" data-action="editar" data-id="${mesa.id}" title="Editar ${nombre}" aria-label="Editar ${nombre}">
                            <i data-lucide="pencil"></i>
                        </button>
                        ${disponible ? `
                            <button class="mesa-config-icon-button danger" type="button" data-action="eliminar" data-id="${mesa.id}" title="Eliminar ${nombre}" aria-label="Eliminar ${nombre}">
                                <i data-lucide="trash-2"></i>
                            </button>
                        ` : ""}
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    lucide.createIcons();
}

function renderizar() {
    renderizarResumen();
    renderizarTabla();
}

// ======================================================
// FILTROS
// ======================================================

buscarMesa.addEventListener("input", () => {
    estado.busqueda = buscarMesa.value;
    renderizarTabla();
});

filtros.forEach(boton => {
    boton.addEventListener("click", () => {
        estado.filtro = boton.dataset.filter;
        filtros.forEach(item => {
            const activo = item === boton;
            item.classList.toggle("active", activo);
            item.setAttribute("aria-selected", String(activo));
        });
        renderizarTabla();
    });
});

// ======================================================
// MODAL CREAR / EDITAR
// ======================================================

function abrirModal(mesa = null) {
    estado.editando = mesa;
    form.reset();
    mostrarMensajeFormulario();

    if (mesa) {
        modalEyebrow.textContent = "Editar";
        modalTitulo.textContent = "Editar mesa";
        modalDescripcion.textContent = "Actualiza el nombre visible de la mesa o barra.";
        btnGuardar.textContent = "Guardar cambios";
        nombreInput.value = mesa.nombre || "";
        const radio = form.querySelector(`input[name="tipoMesa"][value="${esBarra(mesa) ? "barra" : "mesa"}"]`);
        if (radio) { radio.checked = true; }
        tipoField.hidden = true;
    } else {
        modalEyebrow.textContent = "Nuevo registro";
        modalTitulo.textContent = "Nueva mesa";
        modalDescripcion.textContent = "Registra una mesa o barra para el servicio.";
        btnGuardar.textContent = "Crear mesa";
        nombreInput.value = "";
        const radio = form.querySelector('input[name="tipoMesa"][value="mesa"]');
        if (radio) { radio.checked = true; }
        tipoField.hidden = false;
    }

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    lucide.createIcons();
    window.setTimeout(() => nombreInput.focus(), 60);
}

function cerrarModalFn() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    estado.editando = null;
    form.reset();
    mostrarMensajeFormulario();
    btnGuardar.disabled = false;
}

async function guardar(event) {
    event.preventDefault();
    if (estado.guardando) { return; }

    const nombre = nombreInput.value.trim();
    if (!nombre) {
        mostrarMensajeFormulario("Escribe un nombre para la mesa.");
        nombreInput.focus();
        return;
    }

    estado.guardando = true;
    btnGuardar.disabled = true;
    const etiqueta = btnGuardar.textContent;
    btnGuardar.textContent = "Guardando...";
    mostrarMensajeFormulario();

    try {
        const editando = estado.editando;
        const tipo = tipoSeleccionado();

        const guardada = editando
            ? await apiRequest(`/mesas/${editando.id}`, {
                method: "PUT",
                body: JSON.stringify({ nombre })
            })
            : await apiRequest("/mesas/", {
                method: "POST",
                body: JSON.stringify({ nombre, estado: false, tipo })
            });

        // Misma actualización local que la app: reemplaza o agrega y ordena por id.
        if (guardada && guardada.id != null) {
            estado.mesas = editando
                ? estado.mesas.map(mesa => mesa.id === guardada.id ? guardada : mesa)
                : [...estado.mesas, guardada].sort((a, b) => a.id - b.id);
            renderizar();
        } else {
            await cargarMesas();
        }

        mostrarMensaje(
            editando
                ? `Mesa "${nombre}" actualizada correctamente.`
                : `${tipo === "barra" ? "Barra" : "Mesa"} "${nombre}" creada correctamente.`,
            "success"
        );
        cerrarModalFn();
    } catch (error) {
        mostrarMensajeFormulario(error.message || "No se pudo guardar la mesa.");
    } finally {
        estado.guardando = false;
        btnGuardar.disabled = false;
        btnGuardar.textContent = etiqueta;
    }
}

btnNuevaMesa.addEventListener("click", () => abrirModal());
form.addEventListener("submit", guardar);
cerrarModal.addEventListener("click", cerrarModalFn);
cancelarModal.addEventListener("click", cerrarModalFn);
modal.addEventListener("click", event => {
    if (event.target === modal) { cerrarModalFn(); }
});

// ======================================================
// ELIMINAR
// ======================================================

function abrirConfirmacion(mesa) {
    estado.eliminando = mesa;
    confirmMensaje.textContent = `¿Deseas eliminar "${nombreMesa(mesa)}"? Esta acción no se puede deshacer.`;
    confirmModal.classList.add("open");
    confirmModal.setAttribute("aria-hidden", "false");
}

function cerrarConfirmacionFn() {
    confirmModal.classList.remove("open");
    confirmModal.setAttribute("aria-hidden", "true");
    estado.eliminando = null;
    confirmarEliminar.disabled = false;
    confirmarEliminar.textContent = "Eliminar";
}

async function eliminar() {
    if (!estado.eliminando) { return; }

    const mesa = estado.eliminando;
    confirmarEliminar.disabled = true;
    confirmarEliminar.textContent = "Eliminando...";

    try {
        await apiRequest(`/mesas/${mesa.id}`, { method: "DELETE" });
        estado.mesas = estado.mesas.filter(item => item.id !== mesa.id);
        renderizar();
        cerrarConfirmacionFn();
        mostrarMensaje(`"${nombreMesa(mesa)}" eliminada correctamente.`, "success");
    } catch (error) {
        cerrarConfirmacionFn();
        mostrarMensaje(error.message || "No se pudo eliminar la mesa.", "error");
    }
}

cancelarConfirmar.addEventListener("click", cerrarConfirmacionFn);
confirmarEliminar.addEventListener("click", eliminar);
confirmModal.addEventListener("click", event => {
    if (event.target === confirmModal) { cerrarConfirmacionFn(); }
});

// ======================================================
// CÓDIGO QR
// ======================================================

function abrirQr(mesa) {
    estado.qrMesa = mesa;
    qrTitulo.textContent = nombreMesa(mesa);
    qrCanvas.innerHTML = "";

    qrModal.classList.add("open");
    qrModal.setAttribute("aria-hidden", "false");
    lucide.createIcons();

    if (typeof QRCode === "undefined") {
        mostrarMensaje("No se pudo cargar el generador de códigos QR. Revisa tu conexión.", "error");
        return;
    }

    new QRCode(qrCanvas, {
        text: JSON.stringify({ mesa_id: mesa.id }),
        width: 220,
        height: 220,
        correctLevel: QRCode.CorrectLevel.M
    });
}

function cerrarQrFn() {
    qrModal.classList.remove("open");
    qrModal.setAttribute("aria-hidden", "true");
    estado.qrMesa = null;
    qrCanvas.innerHTML = "";
}

function qrImagen() {
    const canvas = qrCanvas.querySelector("canvas");
    if (canvas) {
        return canvas.toDataURL("image/png");
    }
    const imagen = qrCanvas.querySelector("img");
    return imagen ? imagen.src : "";
}

function imprimirQrFn() {
    const mesa = estado.qrMesa;
    const imagen = qrImagen();

    if (!mesa || !imagen) {
        mostrarMensaje("Espera a que el código QR termine de generarse.", "error");
        return;
    }

    const nombre = escapeHtml(nombreMesa(mesa));
    const ventana = window.open("", "_blank", "width=520,height=680");

    if (!ventana) {
        mostrarMensaje("Permite las ventanas emergentes para imprimir el código QR.", "error");
        return;
    }

    ventana.document.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="utf-8">
            <title>QR ${nombre}</title>
            <style>
                body { margin: 0; padding: 38px 24px; font-family: Manrope, Arial, sans-serif; text-align: center; color: #1D1A17; }
                h1 { margin: 0 0 6px; font-size: 26px; }
                p { margin: 0; color: #6B5C4D; font-size: 13px; }
                img { width: 260px; height: 260px; margin: 26px 0; }
                small { display: block; color: #8A7A6A; font-size: 11px; }
            </style>
        </head>
        <body>
            <h1>${nombre}</h1>
            <p>Escanea para abrir la carta de esta mesa.</p>
            <img src="${imagen}" alt="Código QR de ${nombre}">
            <small>La Cabaña</small>
            <script>window.onload = function () { window.focus(); window.print(); };<\/script>
        </body>
        </html>
    `);
    ventana.document.close();
}

function descargarQrFn() {
    const mesa = estado.qrMesa;
    const imagen = qrImagen();

    if (!mesa || !imagen) {
        mostrarMensaje("Espera a que el código QR termine de generarse.", "error");
        return;
    }

    const enlace = document.createElement("a");
    enlace.href = imagen;
    enlace.download = `mesa-${mesa.id}-qr.png`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
}

cerrarQr.addEventListener("click", cerrarQrFn);
imprimirQr.addEventListener("click", imprimirQrFn);
descargarQr.addEventListener("click", descargarQrFn);
qrModal.addEventListener("click", event => {
    if (event.target === qrModal) { cerrarQrFn(); }
});

// ======================================================
// TABLA: ACCIONES
// ======================================================

tabla.addEventListener("click", event => {
    const boton = event.target.closest("[data-action]");
    if (!boton) { return; }

    const mesa = estado.mesas.find(item => item.id === Number(boton.dataset.id));
    if (!mesa) { return; }

    const accion = boton.dataset.action;
    if (accion === "qr") { abrirQr(mesa); }
    if (accion === "editar") { abrirModal(mesa); }
    if (accion === "eliminar") { abrirConfirmacion(mesa); }
});

// ======================================================
// TECLADO
// ======================================================

document.addEventListener("keydown", event => {
    if (event.key !== "Escape") { return; }
    if (qrModal.classList.contains("open")) { cerrarQrFn(); return; }
    if (confirmModal.classList.contains("open")) { cerrarConfirmacionFn(); return; }
    if (modal.classList.contains("open")) { cerrarModalFn(); }
});

// ======================================================
// INICIO
// ======================================================

reintentar.addEventListener("click", iniciar);
iniciar();
