const API_URL = "http://127.0.0.1:8000";

// ======================================================
// ELEMENTOS
// ======================================================

const categoriasTable = document.getElementById("categoriasTable");

const buscarCategoria = document.getElementById("buscarCategoria");

const categoriaModal = document.getElementById("categoriaModal");

const categoriaForm = document.getElementById("categoriaForm");

const nombreCategoria = document.getElementById("nombreCategoria");

const categoriaMessage = document.getElementById("categoriaMessage");

const btnNuevaCategoria = document.getElementById("btnNuevaCategoria");

const cerrarModal = document.getElementById("cerrarModal");

const cancelarModal = document.getElementById("cancelarModal");

const confirmarModal = document.getElementById("confirmarModal");

const cancelarConfirmar = document.getElementById("cancelarConfirmar");

const confirmarAccion = document.getElementById("confirmarAccion");

// ======================================================
// VARIABLES
// ======================================================

let categorias = [];

let accionConfirmar = null;

let categoriaSeleccionada = null;

// ======================================================
// TOKEN
// ======================================================

function getToken() {

return localStorage.getItem("access_token");

}

function getHeaders() {

const token = getToken();

return {

    "Content-Type": "application/json",

    "Authorization": `Bearer ${token}`

};

}

// ======================================================
// ABRIR MODAL
// ======================================================

function abrirModal(categoria = null) {

    // Evita que un evento de click sea interpretado como una categoría
    if (categoria instanceof Event) {
        categoria = null;
    }

    categoriaForm.reset();
    categoriaMessage.textContent = "";
    categoriaMessage.className = "categoria-message";

    if (categoria) {
        categoriaForm.dataset.editandoId = categoria.id;
        nombreCategoria.value = categoria.nombre;
        document.querySelector(".modal-header h2").textContent = "Editar categoría";
        document.querySelector(".modal-header p").textContent =
            "Modifique la información de la categoría.";
        document.getElementById("btnGuardarCategoria").textContent =
            "Guardar cambios";
    } else {
        delete categoriaForm.dataset.editandoId;
        document.querySelector(".modal-header h2").textContent =
            "Registrar categoría";
        document.querySelector(".modal-header p").textContent =
            "Complete la información de la categoría.";
        document.getElementById("btnGuardarCategoria").textContent =
            "Guardar categoría";
    }

    categoriaModal.style.display = "flex";
    nombreCategoria.focus();
}

// ======================================================
// CERRAR MODAL
// ======================================================

function cerrarCategoriaModal() {

categoriaModal.style.display = "none";

categoriaForm.reset();

categoriaMessage.textContent = "";

categoriaMessage.className = "categoria-message";

}

// ======================================================
// REGISTRAR CATEGORÍA
// ======================================================
async function registrarCategoria(event) {
    event.preventDefault();

    const nombre = nombreCategoria.value.trim();
    const editandoId = categoriaForm.dataset.editandoId;

    if (nombre.length < 3) {
        mostrarMensaje(
            "El nombre debe tener mínimo 3 caracteres.",
            "error"
        );
        return;
    }

    if (nombre.length > 50) {
        mostrarMensaje(
            "El nombre no puede superar los 50 caracteres.",
            "error"
        );
        return;
    }

    const boton = document.getElementById("btnGuardarCategoria");

    boton.disabled = true;
    boton.textContent = editandoId
        ? "Guardando cambios..."
        : "Guardando...";

    try {

        let response;

        if (editandoId) {

            // EDITAR CATEGORÍA
            response = await fetch(
                `${API_URL}/categorias/${editandoId}`,
                {
                    method: "PUT",
                    headers: getHeaders(),
                    body: JSON.stringify({
                        nombre: nombre
                    })
                }
            );

        } else {

            // REGISTRAR CATEGORÍA
            response = await fetch(
                `${API_URL}/categorias/`,
                {
                    method: "POST",
                    headers: getHeaders(),
                    body: JSON.stringify({
                        nombre: nombre
                    })
                }
            );
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.detail ||
                "No fue posible guardar la categoría."
            );
        }

        mostrarMensaje(
            editandoId
                ? "Categoría actualizada correctamente."
                : "Categoría registrada correctamente.",
            "success"
        );

        // Volver a cargar la tabla
        await cargarCategorias();

        // Cerrar modal después de guardar
        setTimeout(() => {
            cerrarCategoriaModal();
        }, 1000);

    } catch (error) {

        console.error("Error al guardar categoría:", error);

        mostrarMensaje(
            error.message ||
            "No fue posible conectar con el servidor.",
            "error"
        );

    } finally {

        boton.disabled = false;

        boton.textContent = editandoId
            ? "Guardar cambios"
            : "Guardar categoría";
    }
}



// ======================================================
// CARGAR CATEGORÍAS
// ======================================================

async function cargarCategorias() {

categoriasTable.innerHTML = `

    <tr>

        <td
            colspan="4"
            class="loading"
        >
            Cargando categorías...
        </td>

    </tr>

`;


try {

    const response = await fetch(
        `${API_URL}/categorias/`,
        {
            method: "GET",
            headers: getHeaders()
        }
    );


    const data = await response.json();


    if (!response.ok) {

        throw new Error(
            data.detail ||
            "No fue posible cargar las categorías."
        );

    }


    categorias = data;

    mostrarCategorias(categorias);


} catch (error) {

    console.error(error);

    categoriasTable.innerHTML = `

        <tr>

            <td
                colspan="4"
                class="loading"
            >
                No fue posible conectar con el servidor.
            </td>

        </tr>

    `;

}

}

// ======================================================
// MOSTRAR CATEGORÍAS
// ======================================================

function mostrarCategorias(lista) {

categoriasTable.innerHTML = "";

if (lista.length === 0) {

    categoriasTable.innerHTML = `
        <tr>
            <td
                colspan="4"
                class="loading"
            >
                No hay categorías registradas.
            </td>
        </tr>
    `;

    return;
}

lista.forEach(categoria => {

    const fila = document.createElement("tr");

    const estadoActivo = categoria.estado !== false;

    fila.innerHTML = `
        <td>
            ${categoria.id}
        </td>

        <td>
            <strong>
                ${categoria.nombre}
            </strong>
        </td>

        <td>
            <span class="estado-categoria ${estadoActivo ? 'activo' : 'desactivado'}">
                ${estadoActivo ? 'Activo' : 'Desactivado'}
            </span>
        </td>

        <td>
            <div class="actions">

                ${
                    estadoActivo
                    ?
                    `
                    <button
                        type="button"
                        class="action-button btn-editar"
                        title="Editar"
                        data-id="${categoria.id}"
                    >
                        <i data-lucide="pencil"></i>
                    </button>

                    <button
                        type="button"
                        class="action-button danger"
                        title="Desactivar"
                        data-action="desactivar"
                        data-id="${categoria.id}"
                    >
                        <i data-lucide="ban"></i>
                    </button>
                    `
                    :
                    `
                    <button
                        type="button"
                        class="action-button success"
                        title="Reactivar"
                        data-action="reactivar"
                        data-id="${categoria.id}"
                    >
                        <i data-lucide="rotate-ccw"></i>
                    </button>
                    `
                }

            </div>
        </td>
    `;

    categoriasTable.appendChild(fila);
});

lucide.createIcons();

}


window.editarCategoria = function(id) {

    const categoria = categorias.find(c => c.id === Number(id));

    if (!categoria) {
        alert("No se encontró la categoría.");
        return;
    }

    abrirModal(categoria);
};

categoriasTable.addEventListener("click", function(event) {

    const botonAccion = event.target.closest("[data-action]");

    if (botonAccion) {

        const accion = botonAccion.getAttribute("data-action");

        const id = botonAccion.getAttribute("data-id");

        abrirConfirmar(accion, id);

        return;
    }

    const botonEditar = event.target.closest(".btn-editar");

    if (!botonEditar) {
        return;
    }

    const id = botonEditar.getAttribute("data-id");

    editarCategoria(id);
});


// ======================================================
// CONFIRMAR ACCIÓN (DESACTIVAR / REACTIVAR)
// ======================================================

function abrirConfirmar(accion, id) {

    const categoria = categorias.find(c => c.id === Number(id));

    if (!categoria) {
        return;
    }

    accionConfirmar = accion;
    categoriaSeleccionada = id;

    confirmarModal.classList.toggle(
        "confirmar-reactivar",
        accion === "reactivar"
    );

    const titulo = document.getElementById("confirmarTitulo");
    const mensaje = document.getElementById("confirmarMensaje");
    const boton = document.getElementById("confirmarAccion");

    if (accion === "desactivar") {

        titulo.textContent = "Desactivar categoría";

        mensaje.textContent =
            `¿Está seguro de que desea desactivar la categoría "${categoria.nombre}"?`;

        boton.textContent = "Desactivar";

    } else {

        titulo.textContent = "Reactivar categoría";

        mensaje.textContent =
            `¿Está seguro de que desea reactivar la categoría "${categoria.nombre}"?`;

        boton.textContent = "Reactivar";

    }

    confirmarModal.classList.add("active");
}

function cerrarConfirmar() {

    confirmarModal.classList.remove("active");

    accionConfirmar = null;

    categoriaSeleccionada = null;
}

async function ejecutarConfirmacion() {

    if (!accionConfirmar || !categoriaSeleccionada) {
        return;
    }

    const id = categoriaSeleccionada;

    try {

        let response;

        if (accionConfirmar === "desactivar") {

            response = await fetch(
                `${API_URL}/categorias/${id}`,
                {
                    method: "DELETE",
                    headers: getHeaders()
                }
            );

        } else {

            response = await fetch(
                `${API_URL}/categorias/${id}/estado?new_state=true`,
                {
                    method: "PATCH",
                    headers: getHeaders()
                }
            );
        }

        const data = await response.json();

        if (!response.ok) {

            alert(
                data.detail ||
                "No fue posible realizar la operación."
            );

            return;
        }

        cerrarConfirmar();

        await cargarCategorias();

    } catch (error) {

        console.error(error);

        alert(
            "No fue posible conectar con el servidor."
        );
    }
}

// ======================================================
// BUSCAR CATEGORÍA
// ======================================================

function filtrarCategorias() {

const texto = buscarCategoria.value
    .toLowerCase()
    .trim();


const resultado = categorias.filter(categoria =>

    categoria.nombre
        .toLowerCase()
        .includes(texto)

);


mostrarCategorias(resultado);

}

// ======================================================
// MENSAJES
// ======================================================

function mostrarMensaje(mensaje, tipo) {

categoriaMessage.textContent = mensaje;

categoriaMessage.className =
    `categoria-message ${tipo}`;

}

// ======================================================
// EVENTOS
// ======================================================

btnNuevaCategoria.addEventListener(
    "click",
    () => {
        abrirModal();
    }
);

cerrarModal.addEventListener(
"click",
cerrarCategoriaModal
);

cancelarModal.addEventListener(
"click",
cerrarCategoriaModal
);

categoriaForm.addEventListener(
"submit",
registrarCategoria
);

buscarCategoria.addEventListener(
"input",
filtrarCategorias
);

// ======================================================
// CERRAR AL HACER CLICK FUERA
// ======================================================

categoriaModal.addEventListener(
"click",
function(event) {

    if (event.target === categoriaModal) {

        cerrarCategoriaModal();

    }

}

);

cancelarConfirmar.addEventListener(
"click",
cerrarConfirmar
);

confirmarAccion.addEventListener(
"click",
ejecutarConfirmacion
);

confirmarModal.addEventListener(
"click",
function(event) {

    if (event.target === confirmarModal) {

        cerrarConfirmar();

    }

}

);

// ======================================================
// INICIO
// ======================================================

cargarCategorias();