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

// ======================================================
// VARIABLES
// ======================================================

let categorias = [];

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
            colspan="3"
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
                colspan="3"
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

if (lista.length === 0) {

    categoriasTable.innerHTML = `

        <tr>

            <td
                colspan="3"
                class="loading"
            >
                No hay categorías registradas.
            </td>

        </tr>

    `;

    return;

}


categoriasTable.innerHTML = "";


lista.forEach(categoria => {

    const fila = document.createElement("tr");


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

            <div class="actions">

                <button
                    type="button"
                    class="action-button btn-editar"
                    title="${categoria.estado === false ? 'Categoría desactivada' : 'Editar'}"
                    data-id="${categoria.id}"
                    ${categoria.estado === false ? 'disabled' : ''}
                >
                    <i data-lucide="pencil"></i>
                </button>

                <button
                    type="button"
                    class="action-button danger"
                    title="Desactivar"
                    onclick="desactivarCategoria(${categoria.id})"
                >
                    <i data-lucide="ban"></i>
                </button>

            </div>

        </td>

    `;


    categoriasTable.appendChild(fila);

});


lucide.createIcons();

}


window.editarCategoria = function(id) {

    console.log("EDITAR CATEGORIA CARGADO", id);

    const categoria = categorias.find(c => c.id === Number(id));

    if (!categoria) {
        alert("No se encontró la categoría.");
        return;
    }

    abrirModal(categoria);
};

categoriasTable.addEventListener("click", function(event) {
    console.log("LISTENER DE CATEGORIAS ACTIVO");
    const botonEditar = event.target.closest(".btn-editar");

    if (!botonEditar) {
        return;
    }

    const id = botonEditar.getAttribute("data-id");

    console.log("CLICK EN EDITAR", id);

    editarCategoria(id);
});


// ======================================================
// DESACTIVAR CATEGORÍA
// ======================================================

async function desactivarCategoria(id) {

    const confirmar = confirm(
        "¿Está seguro de que desea desactivar esta categoría?"
    );

    if (!confirmar) {
        return;
    }

    try {

        const response = await fetch(
            `${API_URL}/categorias/${id}`,
            {
                method: "DELETE",
                headers: getHeaders()
            }
        );

        const data = await response.json();

        if (!response.ok) {

            throw new Error(
                data.detail ||
                "No fue posible desactivar la categoría."
            );

        }

        alert("Categoría desactivada correctamente.");

        await cargarCategorias();

    } catch (error) {

        console.error(error);

        alert(
            error.message ||
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
abrirModal
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

// ======================================================
// INICIO
// ======================================================

cargarCategorias();