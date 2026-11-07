const CAJA_API_URL = "https://serviciocontigo.io/api";

let cajas = [];
let movimientos = [];
let gastos = [];

const money = value => new Intl.NumberFormat("es-CO", {
	style: "currency",
	currency: "COP",
	maximumFractionDigits: 0
}).format(numberValue(value));

function numberValue(value) {
	const number = Number(value ?? 0);
	return Number.isFinite(number) ? number : 0;
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

	if (!caja) {
		status.textContent = "Sin caja activa";
		status.className = "caja-status";
		openButton.hidden = false;
		closeButton.hidden = true;
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
	openButton.hidden = isOpen;
	closeButton.hidden = !isOpen;
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

		const active = cajas.slice().sort((first, second) => numberValue(second.id) - numberValue(first.id)).find(isCajaAbierta);
		renderCaja(active || null);
		if (!active) showCajaMessage("No hay una caja abierta. Abre una nueva manualmente cuando estés listo.");
	} catch (error) {
		showCajaMessage(error instanceof Error ? error.message : "No fue posible cargar los datos de caja.", "error");
	}
}

if (window.lucide) window.lucide.createIcons();
loadCajas();
