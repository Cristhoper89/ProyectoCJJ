const OPCIONES_API_URL = "http://xwho2nzoxgmaxbhkyqnfbiwu.2.24.87.5.sslip.io";

const gruposLista = document.getElementById("gruposLista");
const opcionesLista = document.getElementById("opcionesLista");
const opcionesTitle = document.getElementById("opcionesTitle");
const opcionesMessage = document.getElementById("opcionesMessage");
const opcionesModal = document.getElementById("opcionesModal");
const opcionesForm = document.getElementById("opcionesForm");
const nombreRegistro = document.getElementById("nombreRegistro");
const formError = document.getElementById("formError");
const guardarRegistro = document.getElementById("guardarRegistro");

let grupos = [];
let grupoSeleccionadoId = null;
let editorActual = null;

function getHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + (localStorage.getItem("access_token") || "")
    };
}

async function request(path, options = {}) {
    const response = await fetch(`${OPCIONES_API_URL}${path}`, {
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
    opcionesMessage.textContent = message;
    opcionesMessage.className = `opciones-message visible${success ? " success" : ""}`;
}

function clearMessage() {
    opcionesMessage.textContent = "";
    opcionesMessage.className = "opciones-message";
}

function selectedGroup() {
    return grupos.find((grupo) => grupo.id === grupoSeleccionadoId) || null;
}

function renderGroups() {
    if (!grupos.length) {
        gruposLista.innerHTML = '<p class="opciones-empty">No hay grupos registrados. Crea uno para comenzar.</p>';
        return;
    }

    gruposLista.innerHTML = grupos.map((grupo) => {
        const seleccionada = grupo.id === grupoSeleccionadoId;
        const cantidad = Array.isArray(grupo.opciones) ? grupo.opciones.length : 0;
        return `
            <div class="grupo-card${seleccionada ? " seleccionado" : ""}" data-group-id="${grupo.id}">
                <button class="grupo-card-select" type="button" data-action="select-group" aria-pressed="${seleccionada}">
                    <span class="grupo-nombre">${escapeHtml(grupo.nombre)}</span>
                    <span class="grupo-cantidad">${cantidad} ${cantidad === 1 ? "opción" : "opciones"}</span>
                </button>
                <div class="grupo-acciones">
                    <button class="opciones-icon-button" type="button" data-action="edit-group" aria-label="Editar ${escapeHtml(grupo.nombre)}" title="Editar">
                        <i data-lucide="pencil"></i>
                    </button>
                    <button class="opciones-icon-button danger" type="button" data-action="delete-group" aria-label="Eliminar ${escapeHtml(grupo.nombre)}" title="Eliminar">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </div>
        `;
    }).join("");
    lucide.createIcons();
}

function renderOptions() {
    const grupo = selectedGroup();
    const addButton = document.getElementById("btnNuevaOpcion");
    opcionesTitle.textContent = grupo ? grupo.nombre : "Selecciona un grupo";
    addButton.hidden = !grupo;

    if (!grupo) {
        opcionesLista.innerHTML = '<p class="opciones-empty">Selecciona un grupo para consultar sus opciones.</p>';
        return;
    }

    if (!grupo.opciones.length) {
        opcionesLista.innerHTML = '<p class="opciones-empty">Este grupo todavía no tiene opciones.</p>';
        return;
    }

    opcionesLista.innerHTML = grupo.opciones.map((opcion) => `
        <div class="opcion-row" data-option-id="${opcion.id}">
            <span>${escapeHtml(opcion.nombre)}</span>
            <div class="opcion-acciones">
                <button class="opciones-icon-button" type="button" data-action="edit-option" aria-label="Editar ${escapeHtml(opcion.nombre)}" title="Editar">
                    <i data-lucide="pencil"></i>
                </button>
                <button class="opciones-icon-button danger" type="button" data-action="delete-option" aria-label="Eliminar ${escapeHtml(opcion.nombre)}" title="Eliminar">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        </div>
    `).join("");
    lucide.createIcons();
}

async function loadGroups(preferredSelection = grupoSeleccionadoId) {
    if (!localStorage.getItem("access_token")) {
        gruposLista.innerHTML = '<p class="opciones-empty">Inicia sesión para consultar los grupos.</p>';
        opcionesLista.innerHTML = '<p class="opciones-empty">Inicia sesión para consultar las opciones.</p>';
        return false;
    }

    gruposLista.innerHTML = '<p class="opciones-empty">Cargando grupos...</p>';
    try {
        grupos = await request("/grupos-opciones/");
        grupoSeleccionadoId = grupos.some((grupo) => grupo.id === preferredSelection)
            ? preferredSelection
            : grupos[0]?.id ?? null;
        renderGroups();
        renderOptions();
        return true;
    } catch (error) {
        gruposLista.innerHTML = '<p class="opciones-empty">No fue posible cargar los grupos.</p>';
        opcionesLista.innerHTML = "";
        showMessage(error.message || "No fue posible cargar los grupos.");
        return false;
    }
}

function openEditor(type, group = null, option = null) {
    editorActual = {
        type,
        groupId: group?.id,
        id: type === "grupo" ? group?.id : option?.id
    };
    const editando = Boolean(editorActual.id);
    const esGrupo = type === "grupo";
    document.getElementById("modalTitle").textContent = `${editando ? "Editar" : "Nuevo"} ${esGrupo ? "grupo" : "opción"}`;
    document.getElementById("modalDescription").textContent = esGrupo
        ? "Escribe el nombre que aparecerá en el menú."
        : `Añade una opción para ${group.nombre}.`;
    document.getElementById("nombreLabel").textContent = esGrupo ? "Nombre del grupo" : "Nombre de la opción";
    nombreRegistro.value = option?.nombre ?? group?.nombre ?? "";
    formError.textContent = "";
    opcionesModal.hidden = false;
    nombreRegistro.focus();
}

function closeEditor() {
    opcionesModal.hidden = true;
    opcionesForm.reset();
    formError.textContent = "";
    editorActual = null;
}

async function saveRecord(event) {
    event.preventDefault();
    if (!editorActual) return;

    const nombre = nombreRegistro.value.trim();
    if (!nombre) {
        formError.textContent = "Escribe un nombre.";
        nombreRegistro.focus();
        return;
    }

    const { type, id, groupId } = editorActual;
    const esGrupo = type === "grupo";
    const path = esGrupo
        ? (id ? `/grupos-opciones/${id}` : "/grupos-opciones/")
        : (id ? `/opciones/${id}` : "/opciones/");
    const method = id ? "PUT" : "POST";
    const payload = esGrupo ? { nombre } : { nombre, ...(!id && { id_grupo_opcion: groupId }) };

    guardarRegistro.disabled = true;
    guardarRegistro.textContent = "Guardando...";
    try {
        const saved = await request(path, { method, body: JSON.stringify(payload) });
        closeEditor();
        const preferredSelection = esGrupo ? saved.id : groupId ?? grupoSeleccionadoId;
        if (await loadGroups(preferredSelection)) {
            showMessage(`${esGrupo ? "Grupo" : "Opción"} ${id ? "actualizado" : "creado"} correctamente.`, true);
        }
    } catch (error) {
        formError.textContent = error.message || "No fue posible guardar el registro.";
    } finally {
        guardarRegistro.disabled = false;
        guardarRegistro.textContent = "Guardar";
    }
}

async function deleteRecord(type, group, option = null) {
    const name = option?.nombre ?? group.nombre;
    const label = type === "grupo" ? "el grupo" : "la opción";
    if (!window.confirm(`¿Eliminar ${label} "${name}"? Esta acción no se puede deshacer.`)) return;

    const selectedId = grupoSeleccionadoId;
    try {
        await request(type === "grupo" ? `/grupos-opciones/${group.id}` : `/opciones/${option.id}`, {
            method: "DELETE"
        });
        if (await loadGroups(type === "grupo" && selectedId === group.id ? null : selectedId)) {
            showMessage(`${type === "grupo" ? "Grupo" : "Opción"} eliminado correctamente.`, true);
        }
    } catch (error) {
        showMessage(error.message || `No fue posible eliminar la ${type}.`);
    }
}

document.getElementById("btnNuevoGrupo").addEventListener("click", () => openEditor("grupo"));
document.getElementById("btnNuevaOpcion").addEventListener("click", () => {
    const grupo = selectedGroup();
    if (grupo) openEditor("opcion", grupo);
});
document.getElementById("cerrarModal").addEventListener("click", closeEditor);
document.getElementById("cancelarModal").addEventListener("click", closeEditor);
opcionesForm.addEventListener("submit", saveRecord);
opcionesModal.addEventListener("click", (event) => {
    if (event.target === opcionesModal) closeEditor();
});
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !opcionesModal.hidden) closeEditor();
});

gruposLista.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("[data-action]");
    const card = event.target.closest("[data-group-id]");
    if (!card) return;

    const group = grupos.find((item) => item.id === Number(card.dataset.groupId));
    if (!group) return;
    if (!actionButton || actionButton.dataset.action === "select-group") {
        grupoSeleccionadoId = group.id;
        clearMessage();
        renderGroups();
        renderOptions();
        return;
    }

    if (actionButton.dataset.action === "edit-group") openEditor("grupo", group);
    if (actionButton.dataset.action === "delete-group") await deleteRecord("grupo", group);
});

opcionesLista.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    const row = actionButton.closest("[data-option-id]");
    const group = selectedGroup();
    const option = group?.opciones.find((item) => item.id === Number(row?.dataset.optionId));
    if (!group || !option) return;

    if (actionButton.dataset.action === "edit-option") openEditor("opcion", group, option);
    if (actionButton.dataset.action === "delete-option") await deleteRecord("opcion", group, option);
});

loadGroups();
