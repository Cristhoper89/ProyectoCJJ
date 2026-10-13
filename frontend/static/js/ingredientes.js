const INGREDIENTES_API_URL = window.location.protocol === "https:"
    ? window.location.origin
    : "https://backend-6ad6b6fa.fastapicloud.dev";

const ingredientesList = document.getElementById("ingredientesList");
const ingredientesMessage = document.getElementById("ingredientesMessage");
const ingredienteModal = document.getElementById("ingredienteModal");
const ingredienteForm = document.getElementById("ingredienteForm");
const nombreIngrediente = document.getElementById("nombreIngrediente");
const nombreCount = document.getElementById("nombreCount");
const formError = document.getElementById("formError");
const guardarIngrediente = document.getElementById("guardarIngrediente");
const buscarIngrediente = document.getElementById("buscarIngrediente");

let ingredientes = [];
let filtroActual = "active";
let ingredienteEditando = null;

function getHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + (localStorage.getItem("access_token") || "")
    };
}

async function request(path, options = {}) {
    const response = await fetch(`${INGREDIENTES_API_URL}${path}`, {
        ...options,
        headers: { ...getHeaders(), ...options.headers }
    });

    if (!response.ok) {
        let detail = `Error HTTP ${response.status}`;
        try {
            const body = await response.json();
            detail = body.detail || body.message || detail;
        } catch (error) {
            // Si la respuesta no contiene JSON, conservamos el estado HTTP.
        }
        throw new Error(detail);
    }

    if (response.status === 204) return null;
    return response.json();
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    })[character]);
}

function showMessage(message, success = false) {
    ingredientesMessage.textContent = message;
    ingredientesMessage.className = `ingredientes-message visible${success ? " success" : ""}`;
}

function clearMessage() {
    ingredientesMessage.textContent = "";
    ingredientesMessage.className = "ingredientes-message";
}

function visibleIngredients() {
    const search = buscarIngrediente.value.trim().toLocaleLowerCase("es");
    return ingredientes.filter((item) => {
        const matchesName = item.nombre.toLocaleLowerCase("es").includes(search);
        return matchesName && (filtroActual === "all" || item.estado);
    });
}

function renderIngredients() {
    const visible = visibleIngredients();
    const counter = document.getElementById("ingredientesCounter");
    counter.textContent = `${visible.length} ${visible.length === 1 ? "resultado" : "resultados"}`;

    if (!visible.length) {
        const hasIngredients = ingredientes.length > 0;
        const message = buscarIngrediente.value.trim()
            ? "Prueba con otro nombre."
            : hasIngredients && filtroActual === "active"
                ? "No hay ingredientes activos."
                : "Crea el primer ingrediente para comenzar.";
        ingredientesList.innerHTML = `
            <div class="ingredientes-empty">
                <strong>No hay ingredientes</strong>
                ${escapeHtml(message)}
            </div>
        `;
        return;
    }

    ingredientesList.innerHTML = visible.map((item) => {
        const active = item.estado === true;
        const initial = item.nombre.trim().charAt(0).toLocaleUpperCase("es");
        return `
            <article class="ingrediente-row${active ? "" : " inactive"}" data-ingredient-id="${item.id}">
                <div class="ingrediente-initial" aria-hidden="true">${escapeHtml(initial)}</div>
                <div class="ingrediente-content">
                    <span class="ingrediente-name">${escapeHtml(item.nombre)}</span>
                    <span class="ingrediente-badge${active ? "" : " inactive"}">${active ? "ACTIVO" : "INACTIVO"}</span>
                </div>
                <div class="ingrediente-actions">
                    ${active ? `
                        <button class="ingrediente-icon-button" type="button" data-action="edit" aria-label="Editar ${escapeHtml(item.nombre)}" title="Editar">
                            <i data-lucide="pencil"></i>
                        </button>
                        <button class="ingrediente-icon-button danger" type="button" data-action="deactivate" aria-label="Desactivar ${escapeHtml(item.nombre)}" title="Desactivar">
                            <i data-lucide="archive"></i>
                        </button>
                    ` : `
                        <button class="ingrediente-icon-button success" type="button" data-action="activate" aria-label="Reactivar ${escapeHtml(item.nombre)}" title="Reactivar">
                            <i data-lucide="rotate-ccw"></i>
                        </button>
                    `}
                </div>
            </article>
        `;
    }).join("");
    lucide.createIcons();
}

async function loadIngredients() {
    if (!localStorage.getItem("access_token")) {
        ingredientesList.innerHTML = '<p class="ingredientes-empty">Inicia sesión para consultar los ingredientes.</p>';
        return;
    }

    ingredientesList.innerHTML = '<p class="ingredientes-empty">Cargando ingredientes...</p>';
    try {
        const data = await request("/ingredientes/");
        ingredientes = data.map((item) => ({ ...item, estado: item.estado === true }));
        renderIngredients();
    } catch (error) {
        ingredientesList.innerHTML = '<p class="ingredientes-empty">No fue posible cargar los ingredientes.</p>';
        showMessage(error.message || "No fue posible cargar los ingredientes.");
    }
}

function openEditor(item = null) {
    ingredienteEditando = item;
    document.getElementById("modalEyebrow").textContent = item ? "Editar" : "Nuevo registro";
    document.getElementById("modalTitle").textContent = item ? "Editar ingrediente" : "Nuevo ingrediente";
    guardarIngrediente.textContent = item ? "Guardar cambios" : "Crear ingrediente";
    nombreIngrediente.value = item?.nombre ?? "";
    nombreCount.textContent = String(nombreIngrediente.value.length);
    formError.textContent = "";
    ingredienteModal.hidden = false;
    nombreIngrediente.focus();
}

function closeEditor() {
    ingredienteModal.hidden = true;
    ingredienteForm.reset();
    nombreCount.textContent = "0";
    formError.textContent = "";
    ingredienteEditando = null;
}

async function saveIngredient(event) {
    event.preventDefault();
    const nombre = nombreIngrediente.value.trim();
    if (!nombre) {
        formError.textContent = "Escribe un nombre para el ingrediente.";
        nombreIngrediente.focus();
        return;
    }

    const editing = ingredienteEditando;
    guardarIngrediente.disabled = true;
    guardarIngrediente.textContent = "Guardando...";
    try {
        const saved = editing
            ? await request(`/ingredientes/${editing.id}`, { method: "PUT", body: JSON.stringify({ nombre }) })
            : await request("/ingredientes/", { method: "POST", body: JSON.stringify({ nombre }) });
        if (editing) {
            ingredientes = ingredientes.map((item) => item.id === saved.id
                ? { ...saved, estado: saved.estado === true }
                : item);
        } else {
            ingredientes = [{ ...saved, estado: saved.estado === true }, ...ingredientes];
            filtroActual = "active";
            setFilter("active");
        }
        closeEditor();
        renderIngredients();
        showMessage(`Ingrediente ${editing ? "actualizado" : "creado"} correctamente.`, true);
    } catch (error) {
        formError.textContent = error.message || "No fue posible guardar el ingrediente.";
    } finally {
        guardarIngrediente.disabled = false;
        guardarIngrediente.textContent = ingredienteEditando ? "Guardar cambios" : "Crear ingrediente";
    }
}

function setFilter(filter) {
    filtroActual = filter;
    const active = filter === "active";
    document.getElementById("filterActive").classList.toggle("selected", active);
    document.getElementById("filterActive").setAttribute("aria-pressed", String(active));
    document.getElementById("filterAll").classList.toggle("selected", !active);
    document.getElementById("filterAll").setAttribute("aria-pressed", String(!active));
    renderIngredients();
}

async function changeIngredientState(item, nextState) {
    const verb = nextState ? "reactivar" : "desactivar";
    if (!window.confirm(`¿Está seguro de que desea ${verb} el ingrediente "${item.nombre}"?`)) return;

    try {
        const updated = await request(`/ingredientes/${item.id}/estado`, {
            method: "PATCH",
            body: JSON.stringify({ estado: nextState })
        });
        ingredientes = ingredientes.map((current) => current.id === item.id
            ? { ...updated, estado: updated.estado === true }
            : current);
        renderIngredients();
        showMessage(`Ingrediente ${nextState ? "reactivado" : "desactivado"} correctamente.`, true);
    } catch (error) {
        showMessage(error.message || `No fue posible ${verb} el ingrediente.`);
    }
}

document.getElementById("btnNuevoIngrediente").addEventListener("click", () => openEditor());
document.getElementById("cerrarModal").addEventListener("click", closeEditor);
document.getElementById("cancelarModal").addEventListener("click", closeEditor);
ingredienteForm.addEventListener("submit", saveIngredient);
nombreIngrediente.addEventListener("input", () => {
    nombreCount.textContent = String(nombreIngrediente.value.length);
});
buscarIngrediente.addEventListener("input", () => {
    clearMessage();
    renderIngredients();
});
document.getElementById("filterActive").addEventListener("click", () => setFilter("active"));
document.getElementById("filterAll").addEventListener("click", () => setFilter("all"));
ingredienteModal.addEventListener("click", (event) => {
    if (event.target === ingredienteModal) closeEditor();
});
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !ingredienteModal.hidden) closeEditor();
});

ingredientesList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    const row = event.target.closest("[data-ingredient-id]");
    if (!button || !row) return;
    const item = ingredientes.find((ingredient) => ingredient.id === Number(row.dataset.ingredientId));
    if (!item) return;

    if (button.dataset.action === "edit") openEditor(item);
    if (button.dataset.action === "deactivate") await changeIngredientState(item, false);
    if (button.dataset.action === "activate") await changeIngredientState(item, true);
});

loadIngredients();
