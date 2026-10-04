const CAJA_API_URL = window.location.protocol === "https:"
	? window.location.origin
	: "https://backend-6ad6b6fa.fastapicloud.dev";

let cajas = [];
let movimientos = [];
let gastos = [];
let cajaActiva = null;
let cajaModalMode = "open";
let savingCaja = false;

const money = value => new Intl.NumberFormat("es-CO", {
	style: "currency",
	currency: "COP",
	maximumFractionDigits: 0
}).format(numberValue(value));

function numberValue(value) {
	const number = Number(value ?? 0);
	return Number.isFinite(number) ? number : 0;
}

function escapeHtml(value) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function cajaHeaders() {
	return {
		"Content-Type": "application/json",
		"Authorization": `Bearer ${localStorage.getItem("access_token") || ""}`
	};
}

async function apiCaja(path, options = {}) {
	const response = await fetch(`${CAJA_API_URL}${path}`, {
		...options,
		headers: {...cajaHeaders(), ...(options.headers || {})}
	});
	const raw = await response.text();
	let data = null;

	if (raw) {
		try {
			data = JSON.parse(raw);
		} catch {
			data = raw;
		}
	}

	if (!response.ok) {
		const detail = typeof data === "object" && data !== null
			? data.detail || data.message
			: data;
		throw new Error(typeof detail === "string" ? detail : "No fue posible completar la solicitud.");
	}
	return data;
}

function showCajaMessage(message, type = "") {
	const element = document.getElementById("cajaMessage");
	element.textContent = message;
	element.className = `caja-message ${type}`;
}

function isCajaAbierta(caja) {
	return String(caja.estado ?? "").trim().toLowerCase() === "abierta";
}

function formatCajaDate(value, withTime = false) {
	if (!value) return "Sin fecha";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "Sin fecha";
	return date.toLocaleString("es-CO", withTime
		? {day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"}
		: {day: "2-digit", month: "short", year: "numeric"});
}

function movementsForCaja(caja) {
	return movimientos.filter(movimiento => (
		Number(movimiento.id_caja) === Number(caja.id) &&
		movimiento.estado !== false &&
		numberValue(movimiento.total) > 0
	));
}

function expensesForCaja(caja) {
	return gastos.filter(gasto => Number(gasto.id_caja) === Number(caja.id));
}

function summarizeCaja(caja) {
	const sales = movementsForCaja(caja);
	const expenses = expensesForCaja(caja);
	const income = {efectivo: 0, tarjeta: 0, transferencia: 0, otros: 0};

	sales.forEach(sale => {
		const method = String(sale.metodo || "").trim().toLowerCase();
		if (method === "efectivo") income.efectivo += numberValue(sale.total);
		else if (method === "tarjeta") income.tarjeta += numberValue(sale.total);
		else if (method === "transferencia") income.transferencia += numberValue(sale.total);
		else income.otros += numberValue(sale.total);
	});

	if (!sales.length) {
		income.efectivo = numberValue(caja.ingresos_efectivo);
		income.tarjeta = numberValue(caja.ingresos_tarjeta);
		income.transferencia = numberValue(caja.ingresos_transferencia);
	}

	const expense = {
		efectivo: numberValue(caja.egresos_efectivo),
		tarjeta: numberValue(caja.egresos_tarjeta),
		transferencia: numberValue(caja.egresos_transferencia),
		sinMetodo: 0
	};
	const expenseTotal = expenses.reduce((total, item) => total + numberValue(item.valor), 0);
	const classifiedExpenses = expense.efectivo + expense.tarjeta + expense.transferencia;
	expense.sinMetodo = Math.max(0, expenseTotal - classifiedExpenses);

	const totalIncome = income.efectivo + income.tarjeta + income.transferencia + income.otros;
	const totalExpenses = Math.max(expenseTotal, classifiedExpenses);
	const tips = sales.length
		? sales.reduce((total, sale) => total + numberValue(sale.propina), 0)
		: numberValue(caja.total_propinas);

	return {
		income,
		expense,
		totalIncome,
		totalExpenses,
		tips,
		estimatedBalance: numberValue(caja.balance_inicial) + totalIncome - totalExpenses - tips
	};
}

function renderCaja(caja) {
	const status = document.getElementById("cajaStatus");
	const openButton = document.getElementById("abrirCajaButton");
	const closeButton = document.getElementById("cerrarCajaButton");
	const isOpen = Boolean(caja && isCajaAbierta(caja));
	cajaActiva = isOpen ? caja : null;

	if (!caja) {
		status.textContent = "Sin caja activa";
		status.className = "caja-status";
		openButton.disabled = false;
		closeButton.disabled = true;
		document.getElementById("balanceLabel").textContent = "Balance estimado";
		[
			"totalIngresos", "totalGastos", "balanceFinal", "ingresoEfectivo",
			"ingresoTransferencia", "ingresoTarjeta", "ingresoOtros", "balanceInicial",
			"detalleGastos", "detallePropinas", "totalDescontado"
		].forEach(id => { document.getElementById(id).textContent = money(0); });
		return;
	}

	const summary = summarizeCaja(caja);
	const totalExpenses = summary.totalExpenses;
	const finalBalance = isOpen || caja.balance_final == null
		? summary.estimatedBalance
		: numberValue(caja.balance_final);

	document.getElementById("totalIngresos").textContent = money(summary.totalIncome);
	document.getElementById("totalGastos").textContent = money(totalExpenses);
	document.getElementById("balanceFinal").textContent = money(finalBalance);
	document.getElementById("balanceLabel").textContent = isOpen ? "Balance estimado" : "Balance final";
	document.getElementById("ingresoEfectivo").textContent = money(summary.income.efectivo);
	document.getElementById("ingresoTransferencia").textContent = money(summary.income.transferencia);
	document.getElementById("ingresoTarjeta").textContent = money(summary.income.tarjeta);
	document.getElementById("ingresoOtros").textContent = money(summary.income.otros);
	document.getElementById("balanceInicial").textContent = money(caja.balance_inicial);
	document.getElementById("detalleGastos").textContent = money(totalExpenses);
	document.getElementById("detallePropinas").textContent = money(summary.tips);
	document.getElementById("totalDescontado").textContent = money(totalExpenses + summary.tips);

	status.textContent = isOpen ? `Caja #${caja.id} · Abierta` : `Caja #${caja.id} · Cerrada`;
	status.className = `caja-status ${isOpen ? "open" : "closed"}`;
	openButton.disabled = isOpen;
	closeButton.disabled = !isOpen;
}

function renderHistory() {
	const table = document.getElementById("cajasTable");
	const ordered = cajas.slice().sort((first, second) => numberValue(second.id) - numberValue(first.id));
	if (!ordered.length) {
		table.innerHTML = '<tr><td colspan="8" class="loading">No hay cajas registradas.</td></tr>';
		return;
	}

	table.innerHTML = ordered.map(caja => {
		const summary = summarizeCaja(caja);
		const isOpen = isCajaAbierta(caja);
		const balance = !isOpen && caja.balance_final != null
			? numberValue(caja.balance_final)
			: summary.estimatedBalance;
		const status = isOpen ? "Abierta" : "Cerrada";
		return `<tr class="caja-history-row" data-caja-id="${escapeHtml(caja.id)}" tabindex="0" role="button" aria-label="Ver detalle de caja ${escapeHtml(caja.id)}">
			<td>#${escapeHtml(caja.id)}</td>
			<td>${escapeHtml(formatCajaDate(caja.fecha, true))}</td>
			<td>${money(caja.balance_inicial)}</td>
			<td>${money(summary.totalIncome)}</td>
			<td>${money(summary.totalExpenses)}</td>
			<td>${money(summary.tips)}</td>
			<td>${money(balance)}</td>
			<td><span class="status-badge ${isOpen ? "open" : "closed"}">${status}</span></td>
		</tr>`;
	}).join("");
}

function renderCajaDetails(caja) {
	const summary = summarizeCaja(caja);
	const sales = movementsForCaja(caja).map(item => ({
		id: `venta-${item.id}`,
		title: `Movimiento #${item.id}`,
		description: `${item.metodo || "Sin método"} · ${formatCajaDate(item.fecha_hora, true)}`,
		value: numberValue(item.total),
		kind: "income",
		date: item.fecha_hora
	}));
	const expenseRows = expensesForCaja(caja).map(item => ({
		id: `gasto-${item.id}`,
		title: item.nombre || "Gasto",
		description: `${item.descripcion || "Gasto registrado"} · ${formatCajaDate(item.fecha_hora, true)}`,
		value: numberValue(item.valor),
		kind: "expense",
		date: item.fecha_hora
	}));
	const rows = [...sales, ...expenseRows].sort((first, second) => (
		new Date(second.date || 0).getTime() - new Date(first.date || 0).getTime()
	));

	document.getElementById("detalleCajaTitle").textContent = `Caja #${caja.id}`;
	document.getElementById("detalleCajaSummary").innerHTML = `
		<div><span>Ingresos</span><strong>${money(summary.totalIncome)}</strong></div>
		<div><span>Gastos</span><strong>${money(summary.totalExpenses)}</strong></div>
		<div><span>Propinas</span><strong>${money(summary.tips)}</strong></div>`;
	document.getElementById("detalleCajaList").innerHTML = rows.length
		? rows.map(row => `<article class="caja-detail-row ${row.kind}">
			<i data-lucide="${row.kind === "income" ? "circle-arrow-up" : "circle-arrow-down"}"></i>
			<div><strong>${escapeHtml(row.title)}</strong><span>${escapeHtml(row.description)}</span></div>
			<b>${row.kind === "expense" ? "− " : "+ "}${money(row.value)}</b>
		</article>`).join("")
		: '<p class="caja-detail-empty">Esta caja no tiene movimientos ni gastos registrados.</p>';
	document.getElementById("detalleCajaModal").hidden = false;
	if (window.lucide) window.lucide.createIcons();
}

async function loadCajas() {
	const token = localStorage.getItem("access_token");
	if (!token) {
		window.location.href = "/";
		return;
	}

	showCajaMessage("");
	try {
		const [loadedCajas, loadedMovimientos, loadedGastos] = await Promise.all([
			apiCaja("/cajas/"),
			apiCaja("/movimientos/"),
			apiCaja("/gastos/")
		]);
		cajas = Array.isArray(loadedCajas) ? loadedCajas : [];
		movimientos = Array.isArray(loadedMovimientos) ? loadedMovimientos : [];
		gastos = Array.isArray(loadedGastos) ? loadedGastos : [];

		const ordered = cajas.slice().sort((first, second) => numberValue(second.id) - numberValue(first.id));
		const active = ordered.find(isCajaAbierta);
		renderHistory();
		renderCaja(active || ordered[0] || null);
		if (!cajas.length) showCajaMessage("No hay una caja registrada todavía. Abre una para iniciar el turno.");
	} catch (error) {
		showCajaMessage(error instanceof Error ? error.message : "No fue posible cargar los datos de caja.", "error");
	}
}

function parsePesos(value) {
	return Number(String(value).replace(/\D/g, "")) || 0;
}

function cajaInput(id, label, placeholder = "0") {
	return `<label class="caja-form-field" for="${id}">${label}
		<span><b>$</b><input id="${id}" name="${id}" type="text" inputmode="numeric" autocomplete="off" placeholder="${placeholder}" required></span>
	</label>`;
}

function openCajaModal(mode) {
	cajaModalMode = mode;
	const modal = document.getElementById("cajaModal");
	const fields = document.getElementById("cajaModalFields");
	const isClosing = mode === "close";
	document.getElementById("cajaModalTitle").textContent = isClosing ? "Cierre y apertura de caja" : "Apertura de caja";
	document.getElementById("cajaModalDescription").textContent = isClosing
		? "Registra el efectivo contado y la base inicial del siguiente turno."
		: "Ingresa el balance inicial para comenzar el turno.";
	document.getElementById("confirmarCaja").textContent = isClosing ? "Confirmar cierre y abrir caja" : "Abrir caja";
	document.getElementById("confirmarCaja").className = isClosing ? "btn-danger" : "btn-primary";
	fields.innerHTML = isClosing
		? `<div class="caja-expected"><span>Balance esperado en sistema</span><strong id="cajaExpected">$0</strong></div>
			${cajaInput("efectivoContado", "Efectivo contado en caja")}
			<div class="caja-difference" id="cajaDifference">Ingresa el conteo físico</div>
			${cajaInput("balanceInicialNuevo", "Balance inicial del nuevo turno")}`
		: cajaInput("balanceInicialNuevo", "Balance inicial");

	if (isClosing && cajaActiva) {
		document.getElementById("cajaExpected").textContent = money(summarizeCaja(cajaActiva).estimatedBalance);
	}
	document.getElementById("cajaModalError").textContent = "";
	modal.hidden = false;
	const firstInput = fields.querySelector("input");
	if (firstInput) firstInput.focus();
}

function updateCajaDifference() {
	if (cajaModalMode !== "close" || !cajaActiva) return;
	const input = document.getElementById("efectivoContado");
	const difference = document.getElementById("cajaDifference");
	if (!input.value.trim()) {
		difference.textContent = "Ingresa el conteo físico";
		difference.className = "caja-difference";
		return;
	}
	const expected = summarizeCaja(cajaActiva).estimatedBalance;
	const amount = parsePesos(input.value) - expected;
	difference.textContent = amount === 0
		? "Caja cuadrada"
		: `${amount > 0 ? "Sobrante" : "Faltante"}: ${money(Math.abs(amount))}`;
	difference.className = `caja-difference ${amount === 0 ? "even" : amount > 0 ? "surplus" : "shortage"}`;
}

async function submitCaja(event) {
	event.preventDefault();
	if (savingCaja) return;

	const initialInput = document.getElementById("balanceInicialNuevo");
	if (!initialInput || !initialInput.value.trim()) {
		document.getElementById("cajaModalError").textContent = "Ingresa el balance inicial para continuar.";
		if (initialInput) initialInput.focus();
		return;
	}

	const openingBalance = parsePesos(initialInput.value);
	const confirmButton = document.getElementById("confirmarCaja");
	savingCaja = true;
	confirmButton.disabled = true;
	confirmButton.textContent = "Guardando...";
	document.getElementById("cajaModalError").textContent = "";

	try {
		if (cajaModalMode === "close" && cajaActiva) {
			const cashInput = document.getElementById("efectivoContado");
			if (!cashInput || !cashInput.value.trim()) {
				throw new Error("Ingresa el efectivo contado para cerrar la caja.");
			}
			await apiCaja(`/cajas/${cajaActiva.id}/cierre-apertura`, {
				method: "POST",
				body: JSON.stringify({
					efectivo_contado: parsePesos(cashInput.value),
					balance_inicial: openingBalance
				})
			});
		} else {
			await apiCaja("/cajas/", {
				method: "POST",
				body: JSON.stringify({
					fecha: new Date().toISOString(),
					ingresos_efectivo: 0,
					ingresos_tarjeta: 0,
					ingresos_transferencia: 0,
					egresos_efectivo: 0,
					egresos_tarjeta: 0,
					egresos_transferencia: 0,
					total_propinas: 0,
					balance_inicial: openingBalance,
					balance_final: openingBalance,
					estado: "abierta"
				})
			});
		}

		document.getElementById("cajaModal").hidden = true;
		showCajaMessage(cajaModalMode === "close"
			? "Caja cerrada y siguiente turno abierto correctamente."
			: "Caja abierta correctamente.", "success");
		await loadCajas();
	} catch (error) {
		const message = error instanceof Error ? error.message : "No fue posible completar la operación.";
		document.getElementById("cajaModalError").textContent = message;
		showCajaMessage(message, "error");
	} finally {
		savingCaja = false;
		confirmButton.disabled = false;
		confirmButton.textContent = cajaModalMode === "close" ? "Confirmar cierre y abrir caja" : "Abrir caja";
	}
}

document.getElementById("abrirCajaButton").addEventListener("click", () => openCajaModal("open"));
document.getElementById("cerrarCajaButton").addEventListener("click", () => openCajaModal("close"));
document.getElementById("cancelarCaja").addEventListener("click", () => {
	document.getElementById("cajaModal").hidden = true;
});
document.getElementById("cajaForm").addEventListener("submit", submitCaja);
document.getElementById("cajaModalFields").addEventListener("input", updateCajaDifference);
document.getElementById("cajasTable").addEventListener("click", event => {
	const row = event.target.closest("[data-caja-id]");
	if (!row) return;
	const caja = cajas.find(item => Number(item.id) === Number(row.dataset.cajaId));
	if (caja) renderCajaDetails(caja);
});
document.getElementById("cajasTable").addEventListener("keydown", event => {
	if (event.key !== "Enter" && event.key !== " ") return;
	const row = event.target.closest("[data-caja-id]");
	if (!row) return;
	event.preventDefault();
	const caja = cajas.find(item => Number(item.id) === Number(row.dataset.cajaId));
	if (caja) renderCajaDetails(caja);
});
document.getElementById("cerrarDetalleCaja").addEventListener("click", () => {
	document.getElementById("detalleCajaModal").hidden = true;
});
document.querySelectorAll(".modal-overlay").forEach(modal => {
	modal.addEventListener("click", event => {
		if (event.target === modal) modal.hidden = true;
	});
});
document.addEventListener("keydown", event => {
	if (event.key !== "Escape") return;
	document.querySelectorAll(".modal-overlay:not([hidden])").forEach(modal => { modal.hidden = true; });
});

if (window.lucide) window.lucide.createIcons();
loadCajas();
