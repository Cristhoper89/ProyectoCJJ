const CAJAS_HISTORY_API_URL = "https://serviciocontigo.io/api";

let cajaHistory = [];
let cajaMovements = [];
let cajaExpenses = [];

function historyMoney(value) {
	const amount = Number(value ?? 0);
	return new Intl.NumberFormat("es-CO", {
		style: "currency",
		currency: "COP",
		maximumFractionDigits: 0
	}).format(Number.isFinite(amount) ? amount : 0);
}

function historyNumber(value) {
	const amount = Number(value ?? 0);
	return Number.isFinite(amount) ? amount : 0;
}

function historyDate(value) {
	if (!value) return "Sin fecha";
	const date = new Date(value);
	return Number.isNaN(date.getTime())
		? "Sin fecha"
		: date.toLocaleString("es-CO", {day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"});
}

function matchesCajaRange(value, range) {
	if (range === "all" || !value) return true;
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return true;
	const start = new Date();
	start.setHours(0, 0, 0, 0);
	if (range === "week") start.setDate(start.getDate() - 6);
	if (range === "month") start.setMonth(start.getMonth() - 1);
	return date >= start;
}

function renderCajaHistory() {
	const search = document.getElementById("cajaSearch").value.trim().toLowerCase();
	const range = document.getElementById("cajaRange").value;
	const statusFilter = document.getElementById("cajaStatusFilter").value;
	const visibleCajas = cajaHistory.filter(caja => {
		const status = String(caja.estado ?? "").trim().toLowerCase() === "abierta" ? "abierta" : "cerrada";
		return (statusFilter === "all" || status === statusFilter)
			&& matchesCajaRange(caja.fecha, range)
			&& (!search || String(caja.id).includes(search));
	});

	document.getElementById("cajaCount").textContent = `${visibleCajas.length} ${visibleCajas.length === 1 ? "caja" : "cajas"}`;
	const table = document.getElementById("historyTable");
	if (!visibleCajas.length) {
		table.innerHTML = `<tr><td colspan="8" class="loading">${cajaHistory.length ? "No hay cajas que coincidan con los filtros." : "No hay cajas registradas."}</td></tr>`;
		return;
	}

	table.innerHTML = visibleCajas.map(caja => {
		const isOpen = String(caja.estado ?? "").trim().toLowerCase() === "abierta";
		const sales = cajaMovements.filter(movimiento => (
			Number(movimiento.id_caja) === Number(caja.id)
			&& movimiento.estado !== false
			&& historyNumber(movimiento.total) > 0
		));
		const expensesForCaja = cajaExpenses.filter(gasto => Number(gasto.id_caja) === Number(caja.id));
		const income = sales.length
			? sales.reduce((total, movimiento) => total + historyNumber(movimiento.total), 0)
			: historyNumber(caja.ingresos_efectivo)
				+ historyNumber(caja.ingresos_tarjeta)
				+ historyNumber(caja.ingresos_transferencia);
		const expenses = Math.max(
			expensesForCaja.reduce((total, gasto) => total + historyNumber(gasto.valor), 0),
			historyNumber(caja.egresos_efectivo)
				+ historyNumber(caja.egresos_tarjeta)
				+ historyNumber(caja.egresos_transferencia)
		);
		const tips = sales.length
			? sales.reduce((total, movimiento) => total + historyNumber(movimiento.propina), 0)
			: historyNumber(caja.total_propinas);
		const opening = historyNumber(caja.balance_inicial);
		const finalBalance = caja.balance_final == null
			? opening + income - expenses - tips
			: historyNumber(caja.balance_final);
		return `<tr>
			<td><strong>#${historyNumber(caja.id)}</strong></td>
			<td>${historyDate(caja.fecha)}</td>
			<td>${historyMoney(opening)}</td>
			<td>${historyMoney(income)}</td>
			<td>${historyMoney(expenses)}</td>
			<td>${historyMoney(tips)}</td>
			<td>${historyMoney(finalBalance)}</td>
			<td><span class="status-badge ${isOpen ? "open" : "closed"}">${isOpen ? "Abierta" : "Cerrada"}</span></td>
		</tr>`;
	}).join("");
}

async function loadCajaHistory() {
	const token = localStorage.getItem("access_token");
	if (!token) {
		window.location.href = "/";
		return;
	}

	const message = document.getElementById("historyMessage");
	try {
		const [cajas, movimientos, gastos] = await Promise.all([
			requestHistoryData("/cajas/", token),
			requestHistoryData("/movimientos/", token),
			requestHistoryData("/gastos/", token)
		]);
		if (!Array.isArray(cajas) || !Array.isArray(movimientos) || !Array.isArray(gastos)) {
			throw new Error("El historial de cajas devolvió datos con un formato no válido.");
		}
		cajaHistory = cajas.slice().sort((first, second) => historyNumber(second.id) - historyNumber(first.id));
		cajaMovements = movimientos;
		cajaExpenses = gastos;
		renderCajaHistory();
	} catch (error) {
		message.textContent = error instanceof Error ? error.message : "No fue posible cargar el historial de cajas.";
		message.className = "caja-message error";
		document.getElementById("historyTable").innerHTML = '<tr><td colspan="8" class="loading">No se pudo cargar el historial.</td></tr>';
	}
}

async function requestHistoryData(path, token) {
	const response = await fetch(`${CAJAS_HISTORY_API_URL}${path}`, {
		headers: {"Authorization": `Bearer ${token}`, "Content-Type": "application/json"},
		cache: "no-store"
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
		throw new Error(typeof detail === "string" ? detail : "No fue posible cargar el historial de cajas.");
	}
	return data;
}

document.getElementById("cajaSearch").addEventListener("input", renderCajaHistory);
document.getElementById("cajaRange").addEventListener("change", renderCajaHistory);
document.getElementById("cajaStatusFilter").addEventListener("change", renderCajaHistory);

loadCajaHistory();
