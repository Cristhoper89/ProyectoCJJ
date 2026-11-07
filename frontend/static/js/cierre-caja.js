const CASH_FLOW_API_URL = "https://serviciocontigo.io/api";

let activeCash = null;
let cashSummary = null;
let cashFlowSaving = false;

function cashFlowNumber(value) {
	const amount = Number(value ?? 0);
	return Number.isFinite(amount) ? amount : 0;
}

function cashFlowMoney(value) {
	return new Intl.NumberFormat("es-CO", {
		style: "currency",
		currency: "COP",
		maximumFractionDigits: 0
	}).format(cashFlowNumber(value));
}

function cashFlowHeaders() {
	return {
		"Content-Type": "application/json",
		"Authorization": `Bearer ${localStorage.getItem("access_token") || ""}`
	};
}

async function cashFlowRequest(path, options = {}) {
	const response = await fetch(`${CASH_FLOW_API_URL}${path}`, {
		...options,
		headers: {...cashFlowHeaders(), ...(options.headers || {})}
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
		const detail = typeof data === "object" && data !== null ? data.detail || data.message : data;
		throw new Error(typeof detail === "string" ? detail : "No fue posible completar la solicitud.");
	}
	return data;
}

function isCashOpen(caja) {
	return String(caja.estado ?? "").trim().toLowerCase() === "abierta";
}

function summarizeCash(caja, movimientos, gastos) {
	const sales = movimientos.filter(movimiento => (
		Number(movimiento.id_caja) === Number(caja.id)
		&& movimiento.estado !== false
		&& cashFlowNumber(movimiento.total) > 0
	));
	const cajaGastos = gastos.filter(gasto => Number(gasto.id_caja) === Number(caja.id));
	const income = sales.length
		? sales.reduce((total, movimiento) => total + cashFlowNumber(movimiento.total), 0)
		: cashFlowNumber(caja.ingresos_efectivo)
			+ cashFlowNumber(caja.ingresos_tarjeta)
			+ cashFlowNumber(caja.ingresos_transferencia);
	const tips = sales.length
		? sales.reduce((total, movimiento) => total + cashFlowNumber(movimiento.propina), 0)
		: cashFlowNumber(caja.total_propinas);
	const recordedExpenses = cajaGastos.reduce((total, gasto) => total + cashFlowNumber(gasto.valor), 0);
	const classifiedExpenses = cashFlowNumber(caja.egresos_efectivo)
		+ cashFlowNumber(caja.egresos_tarjeta)
		+ cashFlowNumber(caja.egresos_transferencia);
	const expenses = Math.max(recordedExpenses, classifiedExpenses);

	return {
		income,
		expenses,
		tips,
		balance: cashFlowNumber(caja.balance_inicial) + income - expenses - tips
	};
}

function setCashFlowMessage(message, type = "") {
	const element = document.getElementById("cashFlowMessage");
	element.textContent = message;
	element.className = `caja-message ${type}`;
}

function renderCashFlow() {
	document.getElementById("cashFlowLoading").hidden = true;
	document.getElementById("cashFlowRetry").hidden = true;
	setCashFlowMessage("");

	if (activeCash && cashSummary) {
		document.getElementById("cashFlowKicker").textContent = "Cierre de turno";
		document.getElementById("cashFlowTitle").textContent = "Cerrar caja";
		document.getElementById("cashFlowSubtitle").textContent = `Revisa los valores del turno antes de cerrar la caja #${activeCash.id}.`;
		document.getElementById("closeCashHeading").textContent = `Cierre de caja #${activeCash.id}`;
		document.getElementById("closeCashDescription").textContent = "La caja se cerrará con el balance calculado en el sistema.";
		document.getElementById("closeCashIncome").textContent = cashFlowMoney(cashSummary.income);
		document.getElementById("closeCashExpenses").textContent = cashFlowMoney(cashSummary.expenses);
		document.getElementById("closeCashTips").textContent = cashFlowMoney(cashSummary.tips);
		document.getElementById("closeCashBalance").textContent = cashFlowMoney(cashSummary.balance);
		document.getElementById("closeCashPanel").hidden = false;
		document.getElementById("openCashPanel").hidden = true;
		return;
	}

	document.getElementById("cashFlowKicker").textContent = "Nuevo turno";
	document.getElementById("cashFlowTitle").textContent = "Abrir caja";
	document.getElementById("cashFlowSubtitle").textContent = "Registra el balance inicial para iniciar un nuevo turno.";
	document.getElementById("closeCashPanel").hidden = true;
	document.getElementById("openCashPanel").hidden = false;
}

async function loadCashFlow() {
	if (!localStorage.getItem("access_token")) {
		window.location.href = "/";
		return;
	}
	document.getElementById("cashFlowLoading").hidden = false;
	document.getElementById("closeCashPanel").hidden = true;
	document.getElementById("openCashPanel").hidden = true;
	document.getElementById("cashFlowRetry").hidden = true;
	setCashFlowMessage("");
	try {
		const [cajas, movimientos, gastos] = await Promise.all([
			cashFlowRequest("/cajas/"),
			cashFlowRequest("/movimientos/"),
			cashFlowRequest("/gastos/")
		]);
		if (!Array.isArray(cajas) || !Array.isArray(movimientos) || !Array.isArray(gastos)) {
			throw new Error("Los datos recibidos para la caja tienen un formato no válido.");
		}
		activeCash = cajas.slice()
			.sort((first, second) => cashFlowNumber(second.id) - cashFlowNumber(first.id))
			.find(isCashOpen) || null;
		cashSummary = activeCash ? summarizeCash(activeCash, movimientos, gastos) : null;
		renderCashFlow();
	} catch (error) {
		document.getElementById("cashFlowLoading").hidden = true;
		document.getElementById("cashFlowRetry").hidden = false;
		setCashFlowMessage(error instanceof Error ? error.message : "No fue posible cargar los datos de caja.", "error");
	}
}

function parseOpeningBalance(value) {
	return Number(String(value).replace(/\D/g, "")) || 0;
}

async function closeActiveCash() {
	if (cashFlowSaving || !activeCash) return;
	const button = document.getElementById("confirmCloseCash");
	cashFlowSaving = true;
	button.disabled = true;
	button.textContent = "Cerrando...";
	setCashFlowMessage("");
	try {
		await cashFlowRequest(`/cajas/${activeCash.id}/cierre`, {method: "POST"});
		window.location.href = "/caja";
	} catch (error) {
		setCashFlowMessage(error instanceof Error ? error.message : "No fue posible cerrar la caja.", "error");
		button.disabled = false;
		button.textContent = "Cerrar caja";
		cashFlowSaving = false;
	}
}

async function openCash(event) {
	event.preventDefault();
	if (cashFlowSaving) return;
	const input = document.getElementById("openingBalance");
	const errorElement = document.getElementById("openCashError");
	if (!input.value.trim()) {
		errorElement.textContent = "Ingresa el balance inicial para continuar.";
		input.focus();
		return;
	}

	const balance = parseOpeningBalance(input.value);
	const button = document.getElementById("confirmOpenCash");
	cashFlowSaving = true;
	button.disabled = true;
	button.textContent = "Abriendo...";
	errorElement.textContent = "";
	try {
		await cashFlowRequest("/cajas/", {
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
				balance_inicial: balance,
				balance_final: balance,
				estado: "abierta"
			})
		});
		window.location.href = "/caja";
	} catch (error) {
		errorElement.textContent = error instanceof Error ? error.message : "No fue posible abrir la caja.";
		button.disabled = false;
		button.textContent = "Abrir caja";
		cashFlowSaving = false;
	}
}

document.getElementById("confirmCloseCash").addEventListener("click", closeActiveCash);
document.getElementById("openCashForm").addEventListener("submit", openCash);
document.getElementById("cashFlowRetry").addEventListener("click", loadCashFlow);

if (window.lucide) window.lucide.createIcons();
loadCashFlow();
