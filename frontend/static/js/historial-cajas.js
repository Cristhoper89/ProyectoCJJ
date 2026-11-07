const CAJAS_HISTORY_API_URL = "https://serviciocontigo.io/api";

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

async function loadCajaHistory() {
	const token = localStorage.getItem("access_token");
	if (!token) {
		window.location.href = "/";
		return;
	}

	const table = document.getElementById("historyTable");
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

		const orderedCajas = cajas.slice().sort((first, second) => historyNumber(second.id) - historyNumber(first.id));
		if (!orderedCajas.length) {
			table.innerHTML = '<tr><td colspan="8" class="loading">No hay cajas registradas.</td></tr>';
			return;
		}

		table.innerHTML = orderedCajas.map(caja => {
			const isOpen = String(caja.estado ?? "").trim().toLowerCase() === "abierta";
			const cajaMovimientos = movimientos.filter(movimiento => (
				Number(movimiento.id_caja) === Number(caja.id)
				&& movimiento.estado !== false
				&& historyNumber(movimiento.total) > 0
			));
			const cajaGastos = gastos.filter(gasto => Number(gasto.id_caja) === Number(caja.id));
			const income = cajaMovimientos.length
				? cajaMovimientos.reduce((total, movimiento) => total + historyNumber(movimiento.total), 0)
				: historyNumber(caja.ingresos_efectivo)
					+ historyNumber(caja.ingresos_tarjeta)
					+ historyNumber(caja.ingresos_transferencia);
			const expenses = Math.max(
				cajaGastos.reduce((total, gasto) => total + historyNumber(gasto.valor), 0),
				historyNumber(caja.egresos_efectivo)
				+ historyNumber(caja.egresos_tarjeta)
				+ historyNumber(caja.egresos_transferencia)
			);
			const tips = cajaMovimientos.length
				? cajaMovimientos.reduce((total, movimiento) => total + historyNumber(movimiento.propina), 0)
				: historyNumber(caja.total_propinas);
			const opening = historyNumber(caja.balance_inicial);
			const finalBalance = caja.balance_final == null
				? opening + income - expenses - tips
				: historyNumber(caja.balance_final);
			return `<tr>
				<td>#${historyNumber(caja.id)}</td>
				<td>${historyDate(caja.fecha)}</td>
				<td>${historyMoney(opening)}</td>
				<td>${historyMoney(income)}</td>
				<td>${historyMoney(expenses)}</td>
				<td>${historyMoney(tips)}</td>
				<td>${historyMoney(finalBalance)}</td>
				<td><span class="status-badge ${isOpen ? "open" : "closed"}">${isOpen ? "Abierta" : "Cerrada"}</span></td>
			</tr>`;
		}).join("");
	} catch (error) {
		message.textContent = error instanceof Error ? error.message : "No fue posible cargar el historial de cajas.";
		message.className = "caja-message error";
		table.innerHTML = '<tr><td colspan="8" class="loading">No se pudo cargar el historial.</td></tr>';
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

loadCajaHistory();
