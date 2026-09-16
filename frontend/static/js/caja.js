const CAJA_API_URL = "http://127.0.0.1:8000";
let cajaActual = null;

const money = value => new Intl.NumberFormat("es-CO", {
	style: "currency",
	currency: "COP",
	maximumFractionDigits: 0
}).format(Number(value || 0));

function cajaHeaders() {
	return {
		"Content-Type": "application/json",
		"Authorization": `Bearer ${localStorage.getItem("access_token") || ""}`
	};
}

function showCajaMessage(message, type = "") {
	const element = document.getElementById("cajaMessage");
	element.textContent = message;
	element.className = `caja-message ${type}`;
}

function getTotalIngresos(caja) {
	return Number(caja.ingresos_efectivo || 0) + Number(caja.ingresos_tarjeta || 0) + Number(caja.ingresos_transferencia || 0);
}

function getTotalGastos(caja) {
	return Number(caja.egresos_efectivo || 0) + Number(caja.egresos_tarjeta || 0) + Number(caja.egresos_transferencia || 0);
}

function renderCaja(caja) {
	cajaActual = caja;
	const ingresos = getTotalIngresos(caja);
	const gastos = getTotalGastos(caja);
	const propinas = Number(caja.total_propinas || 0);
	const balance = Number(caja.balance_final ?? (Number(caja.balance_inicial || 0) + ingresos - gastos - propinas));
	const abierta = caja.estado !== "cerrada";

	document.getElementById("totalIngresos").textContent = money(ingresos);
	document.getElementById("totalGastos").textContent = money(gastos);
	document.getElementById("balanceFinal").textContent = money(balance);
	document.getElementById("ingresoEfectivo").textContent = money(caja.ingresos_efectivo);
	document.getElementById("ingresoTransferencia").textContent = money(caja.ingresos_transferencia);
	document.getElementById("ingresoTarjeta").textContent = money(caja.ingresos_tarjeta);
	document.getElementById("detalleGastos").textContent = money(gastos);
	document.getElementById("detallePropinas").textContent = money(propinas);
	document.getElementById("totalDescontado").textContent = money(gastos + propinas);

	const status = document.getElementById("cajaStatus");
	status.textContent = abierta ? "Caja abierta" : "Caja cerrada";
	status.className = `caja-status ${abierta ? "open" : "closed"}`;
	document.getElementById("cerrarCajaButton").disabled = !abierta;
	document.getElementById("abrirCajaButton").disabled = abierta;
}

function renderHistory(cajas) {
	const table = document.getElementById("cajasTable");
	if (!cajas.length) {
		table.innerHTML = '<tr><td colspan="6" class="loading">No hay cajas registradas.</td></tr>';
		return;
	}

	table.innerHTML = cajas.slice().reverse().map(caja => {
		const ingresos = getTotalIngresos(caja);
		const gastos = getTotalGastos(caja);
		const propinas = Number(caja.total_propinas || 0);
		const balance = Number(caja.balance_final ?? (Number(caja.balance_inicial || 0) + ingresos - gastos - propinas));
		const estado = caja.estado || "abierta";
		return `<tr>
			<td>${caja.fecha ? new Date(caja.fecha).toLocaleDateString("es-CO") : "Sin fecha"}</td>
			<td>${money(ingresos)}</td>
			<td>${money(gastos)}</td>
			<td>${money(propinas)}</td>
			<td>${money(balance)}</td>
			<td><span class="status-badge ${estado === "cerrada" ? "closed" : "open"}">${estado}</span></td>
		</tr>`;
	}).join("");
}

async function loadCajas() {
	const token = localStorage.getItem("access_token");
	if (!token) {
		window.location.href = "/";
		return;
	}

	try {
		const response = await fetch(`${CAJA_API_URL}/cajas/`, {headers: cajaHeaders()});
		const data = await response.json();
		if (!response.ok) throw new Error(data.detail || "No fue posible cargar la caja.");
		const cajas = data || [];
		renderHistory(cajas);
		const abierta = cajas.slice().reverse().find(caja => caja.estado !== "cerrada");
		if (abierta) renderCaja(abierta);
		else if (cajas.length) {
			renderCaja(cajas[cajas.length - 1]);
			document.getElementById("abrirCajaButton").disabled = false;
		} else {
			showCajaMessage("No hay una caja registrada todavía. Puedes abrirla desde este módulo.");
		}
	} catch (error) {
		showCajaMessage(error.message, "error");
	}
}

async function abrirCaja() {
	try {
		const response = await fetch(`${CAJA_API_URL}/cajas/`, {
			method: "POST",
			headers: cajaHeaders(),
			body: JSON.stringify({
				fecha: new Date().toISOString(),
				ingresos_efectivo: 0,
				ingresos_tarjeta: 0,
				ingresos_transferencia: 0,
				egresos_efectivo: 0,
				egresos_tarjeta: 0,
				egresos_transferencia: 0,
				total_propinas: 0,
				balance_inicial: 0,
				balance_final: 0,
				estado: "abierta"
			})
		});
		const data = await response.json();
		if (!response.ok) throw new Error(data.detail || "No fue posible abrir la caja.");
		showCajaMessage("Caja abierta correctamente.", "success");
		await loadCajas();
	} catch (error) {
		showCajaMessage(error.message, "error");
	}
}

async function cerrarCaja() {
	if (!cajaActual) return;
	try {
		const response = await fetch(`${CAJA_API_URL}/cajas/${cajaActual.id}/estado?new_state=cerrada`, {
			method: "PATCH",
			headers: cajaHeaders()
		});
		const data = await response.json();
		if (!response.ok) throw new Error(data.detail || "No fue posible cerrar la caja.");
		document.getElementById("cerrarCajaModal").hidden = true;
		showCajaMessage("Caja cerrada correctamente.", "success");
		await loadCajas();
	} catch (error) {
		showCajaMessage(error.message, "error");
	}
}

document.getElementById("cerrarCajaButton").addEventListener("click", () => {
	document.getElementById("cerrarCajaModal").hidden = false;
});
document.getElementById("abrirCajaButton").addEventListener("click", abrirCaja);
document.getElementById("cancelarCierre").addEventListener("click", () => {
	document.getElementById("cerrarCajaModal").hidden = true;
});
document.getElementById("confirmarCierre").addEventListener("click", cerrarCaja);
lucide.createIcons();
loadCajas();
