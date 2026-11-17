const GASTOS_API_URL = "https://serviciocontigo.io/api";

const gastoForm = document.getElementById("gastoForm");
const gastoMessage = document.getElementById("gastosMessage");
const saveExpenseButton = document.getElementById("guardarGasto");
const categorySelect = document.getElementById("gastoCategoria");
const cashSelect = document.getElementById("gastoCaja");
let savingExpense = false;

function showExpenseMessage(message, success = false) {
	gastoMessage.textContent = message;
	gastoMessage.className = `gastos-message visible${success ? " success" : ""}`;
}

function clearExpenseMessage() {
	gastoMessage.textContent = "";
	gastoMessage.className = "gastos-message";
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

	if (categoriesResult.status === "fulfilled") {
		const categories = categoriesResult.value.filter(category => category.estado !== false);
		categorySelect.insertAdjacentHTML("beforeend", categories.map(category => (
			`<option value="${Number(category.id)}">${String(category.nombre).replace(/[&<>"']/g, char => ({
				"&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
			})[char])}</option>`
		)).join(""));
	} else {
		errors.push("No se pudieron cargar las categorías.");
	}

	if (cashResult.status === "fulfilled") {
		const openCashBoxes = cashResult.value
			.filter(cash => String(cash.estado ?? "").trim().toLowerCase() === "abierta")
			.sort((first, second) => second.id - first.id);
		cashSelect.insertAdjacentHTML("beforeend", openCashBoxes.map(cash => (
			`<option value="${Number(cash.id)}">Caja #${Number(cash.id)}</option>`
		)).join(""));
		if (openCashBoxes.length) cashSelect.value = String(openCashBoxes[0].id);
	} else {
		errors.push("No se pudieron cargar las cajas abiertas.");
	}

	if (errors.length) showExpenseMessage(errors.join(" "));
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
		await expenseRequest("/gastos/", {
			method: "POST",
			body: JSON.stringify({
				nombre,
				descripcion: document.getElementById("gastoDescripcion").value.trim() || null,
				valor,
				categoria: categorySelect.value ? Number(categorySelect.value) : null,
				id_caja: cashSelect.value ? Number(cashSelect.value) : null
			})
		});
		gastoForm.reset();
		if (cashSelect.options.length > 1) cashSelect.selectedIndex = 1;
		showExpenseMessage("Gasto registrado correctamente.", true);
	} catch (error) {
		showExpenseMessage(error instanceof Error ? error.message : "No fue posible registrar el gasto.");
	} finally {
		savingExpense = false;
		saveExpenseButton.disabled = false;
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
