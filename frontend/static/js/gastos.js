const GASTOS_API_URL = "https://serviciocontigo.io/api";

const gastoForm = document.getElementById("gastoForm");
const gastoMessage = document.getElementById("gastosMessage");
const saveExpenseButton = document.getElementById("guardarGasto");
const categorySelect = document.getElementById("gastoCategoria");
const currentCashLabel = document.getElementById("gastoCajaActual");
const NO_OPEN_CASH_MESSAGE = "No hay una caja abierta. Abre una caja antes de registrar un gasto.";
let activeCashId = null;
let savingExpense = false;

function showExpenseMessage(message, success = false) {
	gastoMessage.textContent = message;
	gastoMessage.className = `gastos-message visible${success ? " success" : ""}`;
}

function clearExpenseMessage() {
	gastoMessage.textContent = "";
	gastoMessage.className = "gastos-message";
}

function findActiveCashBox(cashBoxes) {
	if (!Array.isArray(cashBoxes)) return null;
	return cashBoxes
		.filter(cash => String(cash.estado ?? "").trim().toLowerCase() === "abierta")
		.sort((first, second) => Number(second.id) - Number(first.id))[0] || null;
}

function updateCurrentCashLabel(cash) {
	activeCashId = cash ? Number(cash.id) : null;
	currentCashLabel.textContent = cash ? `Caja #${activeCashId} (abierta)` : "No hay caja abierta";
	saveExpenseButton.disabled = !activeCashId;
}

async function expenseRequest(path, options = {}) {
	const response = await fetch(`${GASTOS_API_URL}${path}`, {
		...options,
		headers: {
			"Content-Type": "application/json",
			"Authorization": `Bearer ${localStorage.getItem("access_token") || ""}`,
			...options.headers
		}
	});

	const rawText = await response.text();
	let body = null;
	if (rawText) {
		try {
			body = JSON.parse(rawText);
		} catch {
			body = rawText;
		}
	}

	if (!response.ok) {
		const detail = typeof body === "object" && body !== null
			? body.detail || body.message
			: body;
		throw new Error(detail || `Error HTTP ${response.status}`);
	}
	return body;
}

async function loadExpenseOptions() {
	const [categoriesResult, cashResult] = await Promise.allSettled([
		expenseRequest("/categorias/"),
		expenseRequest("/cajas/")
	]);
	const errors = [];
	let noOpenCash = false;

	if (categoriesResult.status === "fulfilled") {
		const categories = Array.isArray(categoriesResult.value)
			? categoriesResult.value.filter(category => category.estado !== false)
			: [];
		categorySelect.insertAdjacentHTML("beforeend", categories.map(category => (
			`<option value="${Number(category.id)}">${String(category.nombre).replace(/[&<>"']/g, char => ({
				"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
			})[char])}</option>`
		)).join(""));
	} else {
		errors.push("No se pudieron cargar las categorías.");
	}

	if (cashResult.status === "fulfilled") {
		const activeCash = findActiveCashBox(cashResult.value);
		updateCurrentCashLabel(activeCash);
		noOpenCash = !activeCash;
	} else {
		updateCurrentCashLabel(null);
		errors.push("No se pudieron cargar las cajas abiertas.");
	}

	if (noOpenCash || errors.length) {
		showExpenseMessage([noOpenCash ? NO_OPEN_CASH_MESSAGE : "", ...errors].filter(Boolean).join(" "));
	}
}

gastoForm.addEventListener("submit", async event => {
	event.preventDefault();
	if (savingExpense) return;

	const nombre = document.getElementById("gastoNombre").value.trim();
	const rawValue = document.getElementById("gastoValor").value.trim().replace(",", ".");
	const valor = Number(rawValue);
	if (!nombre) {
		showExpenseMessage("Escribe el nombre del gasto.");
		document.getElementById("gastoNombre").focus();
		return;
	}
	if (!/^\d+(?:\.\d{1,2})?$/.test(rawValue) || !Number.isFinite(valor) || valor <= 0) {
		showExpenseMessage("Ingresa un valor mayor que cero con hasta dos decimales.");
		document.getElementById("gastoValor").focus();
		return;
	}

	savingExpense = true;
	saveExpenseButton.disabled = true;
	saveExpenseButton.textContent = "Guardando...";
	clearExpenseMessage();
	try {
		const activeCash = findActiveCashBox(await expenseRequest("/cajas/"));
		updateCurrentCashLabel(activeCash);
		if (!activeCashId) {
			showExpenseMessage(NO_OPEN_CASH_MESSAGE);
			return;
		}

		await expenseRequest("/gastos/", {
			method: "POST",
			body: JSON.stringify({
				nombre,
				descripcion: document.getElementById("gastoDescripcion").value.trim() || null,
				valor,
				categoria: categorySelect.value ? Number(categorySelect.value) : null,
				id_caja: activeCashId
			})
		});
		gastoForm.reset();
		showExpenseMessage("Gasto registrado correctamente.", true);
	} catch (error) {
		showExpenseMessage(error instanceof Error ? error.message : "No fue posible registrar el gasto.");
	} finally {
		savingExpense = false;
		saveExpenseButton.disabled = !activeCashId;
		saveExpenseButton.innerHTML = '<i data-lucide="check"></i> Guardar gasto';
		lucide.createIcons();
	}
});

if (!localStorage.getItem("access_token")) {
	window.location.href = "/";
} else {
	loadExpenseOptions().catch(error => {
		console.error("No se pudieron cargar las opciones del gasto:", error);
		showExpenseMessage("No se pudieron cargar las opciones. Actualiza la página e inténtalo de nuevo.");
	});
}
