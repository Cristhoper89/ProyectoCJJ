const PEDIDOS_API_URL = "http://xwho2nzoxgmaxbhkyqnfbiwu.2.24.87.5.sslip.io";

let pedidos = [];
let tabActivo = "pendientes";
let cargando = true;
let refrescando = false;
let error = "";
let ahora = Date.now();
let temporizador = null;
let socketWeb = null;
let intentoReconexion = null;
let retrasoReconexion = 1000;
let detenido = false;
const procesandoItems = {};
const procesandoOrdenes = {};

const listaPedidos = document.getElementById("pedList");
const mensajePedidos = document.getElementById("pedMessage");
const errorBox = document.getElementById("pedError");
const errorTexto = document.getElementById("pedErrorTexto");
const botonRefrescar = document.getElementById("btnRefrescar");
const botonReintentar = document.getElementById("btnReintentar");
const totalPendientes = document.getElementById("totalPendientes");
const totalListos = document.getElementById("totalListos");
const totalRiesgo = document.getElementById("totalRiesgo");
const tabPendientes = document.getElementById("tabPendientes");
const tabListos = document.getElementById("tabListos");
const badgePendientes = document.getElementById("badgePendientes");
const badgeListos = document.getElementById("badgeListos");

const LIMITE_RIESGO = 600;

function headersPedidos() {
	return {
		"Content-Type": "application/json",
		"Authorization": `Bearer ${localStorage.getItem("access_token") || ""}`
	};
}

async function apiPedidos(ruta, metodo = "GET", cuerpo = null) {
	const opciones = {method: metodo, headers: headersPedidos()};
	if (cuerpo !== null) {
		opciones.body = JSON.stringify(cuerpo);
	}
	const response = await fetch(`${PEDIDOS_API_URL}${ruta}`, opciones);
	if (response.status === 204) {
		return null;
	}
	const data = await response.json().catch(() => null);
	if (!response.ok) {
		throw new Error(data?.detail || `No fue posible completar la operación. (${response.status})`);
	}
	return data;
}

// ======================================================
// AYUDA
// ======================================================

function esc(texto) {
	return String(texto ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function formatearHoraPedido(fecha) {
	if (!fecha) return "";
	const date = new Date(fecha);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleTimeString("es-CO", {hour: "2-digit", minute: "2-digit"});
}

function segundosTranscurridos(fecha, now) {
	return Math.max(0, Math.floor((now - new Date(fecha).getTime()) / 1000));
}

function formatearTranscurrido(fecha, now) {
	const segundos = segundosTranscurridos(fecha, now);
	const horas = Math.floor(segundos / 3600);
	const minutos = Math.floor((segundos % 3600) / 60);
	const resto = segundos % 60;
	return horas > 0
		? `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}:${String(resto).padStart(2, "0")}`
		: `${String(minutos).padStart(2, "0")}:${String(resto).padStart(2, "0")}`;
}

function ordenPendiente(orden) {
	return orden.items.some(item => !item.preparado);
}

function ordenLista(orden) {
	return orden.items.every(item => item.preparado);
}

function pedidosPendientes() {
	return pedidos.filter(ordenPendiente);
}

function pedidosListos() {
	return pedidos.filter(ordenLista);
}

function pedidosRiesgo() {
	return pedidosPendientes().filter(orden => segundosTranscurridos(orden.fecha_creacion, ahora) > LIMITE_RIESGO);
}

function pedidoEnRiesgo(orden) {
	return ordenPendiente(orden) && segundosTranscurridos(orden.fecha_creacion, ahora) > LIMITE_RIESGO;
}

// ======================================================
// RENDER
// ======================================================

function pintarTabs() {
	const pendientes = pedidosPendientes();
	const listos = pedidosListos();
	totalPendientes.textContent = pendientes.length;
	totalListos.textContent = listos.length;
	totalRiesgo.textContent = pedidosRiesgo().length;
	badgePendientes.textContent = pendientes.length;
	badgeListos.textContent = listos.length;
	tabPendientes.classList.toggle("is-active", tabActivo === "pendientes");
	tabPendientes.setAttribute("aria-selected", tabActivo === "pendientes");
	tabListos.classList.toggle("is-active", tabActivo === "listos");
	tabListos.setAttribute("aria-selected", tabActivo === "listos");
}

function htmlItem(item, orden) {
	const modificadores = (item.modificadores || []).map(mod => `
		<span class="ped-item-mod ${mod.accion === "agregar" ? "add" : "remove"}">
			${mod.accion === "agregar" ? "+ " : "− "}${esc(mod.nombre)}
		</span>`).join("");
	const notas = item.notas && item.notas.trim()
		? `<span class="ped-item-notes"><i data-lucide="message-circle"></i>${esc(item.notas.trim())}</span>`
		: "";
	const procesando = Boolean(procesandoItems[item.id]) || Boolean(procesandoOrdenes[orden.id_movimiento]);
	return `
		<div class="ped-item ${item.preparado ? "is-ready" : ""}">
			<span class="ped-item-qty">${item.cantidad}×</span>
			<span class="ped-item-body">
				<span class="ped-item-name">${esc(item.producto_nombre)}</span>
				${modificadores}
				${notas}
			</span>
			<button class="ped-check ${item.preparado ? "is-ready" : ""}" type="button"
				data-accion="item" data-mov="${orden.id_movimiento}" data-item-id="${item.id}"
				${item.preparado || procesando ? "disabled" : ""}
				aria-label="${item.preparado ? `${esc(item.producto_nombre)}, listo` : `Marcar ${esc(item.producto_nombre)} como listo`}">
				<i data-lucide="${item.preparado ? "circle-check" : "check"}"></i>
			</button>
		</div>`;
}

function htmlOrden(orden) {
	const enRiesgo = pedidoEnRiesgo(orden);
	const itemsPendientes = orden.items.filter(item => !item.preparado);
	const ordenProcesando = Boolean(procesandoOrdenes[orden.id_movimiento]);
	const filas = orden.items.map(item => htmlItem(item, orden)).join("");
	const botonCompletar = itemsPendientes.length > 0
		? `<button class="ped-complete" type="button" data-accion="completar" data-mov="${orden.id_movimiento}"
			${ordenProcesando ? "disabled" : ""}>
			<i data-lucide="check"></i> Marcar pedido listo
		</button>`
		: "";
	return `
		<article class="ped-card ${enRiesgo ? "is-overdue" : ""}">
			<div class="ped-card-head">
				<div>
					<div class="ped-card-location">${esc(orden.ubicacion)}</div>
					<span class="ped-card-meta">Pedido #${orden.id_movimiento} · ${formatearHoraPedido(orden.fecha_creacion)}</span>
				</div>
				<span class="ped-timer">
					<i data-lucide="clock-3"></i>
					<span data-tiempo="${esc(orden.fecha_creacion)}">${formatearTranscurrido(orden.fecha_creacion, ahora)}</span>
				</span>
			</div>
			<div class="ped-card-items">${filas}</div>
			${botonCompletar}
		</article>`;
}

function pintarLista() {
	if (cargando) {
		listaPedidos.innerHTML = `
			<div class="ped-state loading">
				<i data-lucide="loader-circle"></i>
				<h3>Cargando pedidos...</h3>
			</div>`;
	} else {
		const visibles = tabActivo === "pendientes" ? pedidosPendientes() : pedidosListos();
		if (visibles.length === 0) {
			listaPedidos.innerHTML = `
				<div class="ped-state">
					<i data-lucide="circle-check"></i>
					<h3>${tabActivo === "pendientes" ? "Sin pedidos pendientes" : "Todavía no hay pedidos listos"}</h3>
				</div>`;
		} else {
			listaPedidos.innerHTML = visibles.map(htmlOrden).join("");
			actualizarTemporizadores();
		}
	}
	if (window.lucide) window.lucide.createIcons();
}

function render() {
	pintarTabs();
	pintarLista();
}

// ======================================================
// TEMPORIZADORES
// ======================================================

function actualizarTemporizadores() {
	document.querySelectorAll(".ped-card [data-tiempo]").forEach(el => {
		const creado = el.getAttribute("data-tiempo");
		el.textContent = formatearTranscurrido(creado, ahora);
		const tarjeta = el.closest(".ped-card");
		if (!tarjeta) return;
		const tienePendientes = tarjeta.querySelector(".ped-item:not(.is-ready)");
		tarjeta.classList.toggle("is-overdue", Boolean(tienePendientes) && segundosTranscurridos(creado, ahora) > LIMITE_RIESGO);
	});
}

function iniciarTemporizador() {
	if (temporizador) return;
	temporizador = setInterval(() => {
		ahora = Date.now();
		actualizarTemporizadores();
		pintarTabs();
	}, 1000);
}

// ======================================================
// ACCIONES
// ======================================================

async function marcarPreparado(orden, items) {
	const aActualizar = items.filter(item => !item.preparado && !procesandoItems[item.id]);
	if (aActualizar.length === 0 || procesandoOrdenes[orden.id_movimiento]) return;

	aActualizar.forEach(item => {
		procesandoItems[item.id] = true;
	});
	procesandoOrdenes[orden.id_movimiento] = true;
	pedidos = pedidos.map(entrada => entrada.id_movimiento === orden.id_movimiento
		? {...entrada, items: entrada.items.map(item =>
			aActualizar.some(objetivo => objetivo.id === item.id) ? {...item, preparado: true} : item)}
		: entrada);
	render();

	try {
		const resultados = await Promise.allSettled(aActualizar.map(item => apiPedidos(
			`/pedido/items/${item.id}/preparado`,
			"PATCH",
			{preparado: true}
		)));
		if (resultados.some(resultado => resultado.status === "rejected")) {
			await cargarPedidos();
			mostrarMensaje("No se guardaron todos los cambios. El pedido se actualizó desde el servidor.", "error");
		}
	} catch (requestError) {
		await cargarPedidos();
		mostrarMensaje(requestError instanceof Error ? requestError.message : "No se pudo actualizar el pedido.", "error");
	} finally {
		aActualizar.forEach(item => {
			delete procesandoItems[item.id];
		});
		delete procesandoOrdenes[orden.id_movimiento];
		render();
	}
}

// ======================================================
// CARGA DE DATOS
// ======================================================

function mostrarError(texto) {
	error = texto || "";
	errorTexto.textContent = error;
	errorBox.hidden = error === "";
}

function mostrarMensaje(texto, tipo) {
	mensajePedidos.textContent = texto || "";
	mensajePedidos.className = `ped-message${tipo ? ` ${tipo}` : ""}`;
}

async function cargarPedidos() {
	if (!localStorage.getItem("access_token")) {
		mostrarError("Inicia sesión para consultar los pedidos.");
		pedidos = [];
		cargando = false;
		render();
		return;
	}
	try {
		const resultado = await apiPedidos("/pedido/");
		pedidos = resultado || [];
		mostrarError("");
	} catch (requestError) {
		mostrarError(requestError instanceof Error && requestError.message === "Not Found"
			? "La ruta de pedidos aún no está disponible en el servidor."
			: (requestError instanceof Error ? requestError.message : "No fue posible cargar los pedidos."));
	} finally {
		cargando = false;
		render();
	}
}

// ======================================================
// TIEMPO REAL (WebSocket)
// ======================================================

function conectarWebSocket() {
	const token = localStorage.getItem("access_token");
	if (!token) {
		reintentarConexion();
		return;
	}
	socketWeb = new WebSocket(`${PEDIDOS_API_URL.replace(/^http/, "ws")}/ws/mesas`);
	socketWeb.onopen = () => socketWeb?.send(JSON.stringify({token}));
	socketWeb.onmessage = (event) => {
		try {
			const mensaje = JSON.parse(event.data);
			if (mensaje.type === "ready" || mensaje.type === "mesa.updated") void cargarPedidos();
			if (mensaje.type === "ready") retrasoReconexion = 1000;
		} catch (ignorado) {
			// Ignorar mensajes que no son JSON.
		}
	};
	socketWeb.onclose = (event) => {
		if (detenido || event.code === 1008) return;
		reintentarConexion();
	};
	socketWeb.onerror = () => socketWeb?.close();
}

function reintentarConexion() {
	if (detenido || intentoReconexion) return;
	intentoReconexion = setTimeout(() => {
		intentoReconexion = null;
		conectarWebSocket();
	}, retrasoReconexion);
	retrasoReconexion = Math.min(retrasoReconexion * 2, 15000);
}

// ======================================================
// EVENTOS
// ======================================================

function cambiarTab(tab) {
	tabActivo = tab;
	render();
}

function refrescar() {
	if (refrescando) return;
	refrescando = true;
	botonRefrescar.disabled = true;
	botonRefrescar.classList.add("is-refreshing");
	void cargarPedidos().finally(() => {
		refrescando = false;
		botonRefrescar.disabled = false;
		botonRefrescar.classList.remove("is-refreshing");
	});
}

botonRefrescar.addEventListener("click", refrescar);
botonReintentar.addEventListener("click", refrescar);
tabPendientes.addEventListener("click", () => cambiarTab("pendientes"));
tabListos.addEventListener("click", () => cambiarTab("listos"));

listaPedidos.addEventListener("click", (event) => {
	const boton = event.target.closest("button[data-accion]");
	if (!boton) return;
	const movimiento = Number(boton.dataset.mov);
	const orden = pedidos.find(entrada => entrada.id_movimiento === movimiento);
	if (!orden) return;

	if (boton.dataset.accion === "completar") {
		void marcarPreparado(orden, orden.items.filter(item => !item.preparado));
	} else if (boton.dataset.accion === "item") {
		const item = orden.items.find(entrada => entrada.id === Number(boton.dataset.itemId));
		if (item) void marcarPreparado(orden, [item]);
	}
});

// ======================================================
// INICIO
// ======================================================

window.addEventListener("beforeunload", () => {
	detenido = true;
});

document.addEventListener("visibilitychange", () => {
	if (!document.hidden) void cargarPedidos();
});

void cargarPedidos();
ahora = Date.now();
iniciarTemporizador();
conectarWebSocket();