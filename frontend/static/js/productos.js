// ======================================================
// PRODUCTOS
// ======================================================

const API_URL = "http://127.0.0.1:8000";

// ======================================================
// ELEMENTOS
// ======================================================

const productosTable = document.getElementById("productosTable");

const buscarProducto = document.getElementById("buscarProducto");

const productoModal = document.getElementById("productoModal");
const desactivarModal = document.getElementById("desactivarModal");

const productoForm = document.getElementById("productoForm");

const productoId = document.getElementById("productoId");
const nombre = document.getElementById("nombre");
const descripcion = document.getElementById("descripcion");
const cantidad = document.getElementById("cantidad");
const precio = document.getElementById("precio");
const categoria = document.getElementById("categoria");
const preparacion = document.getElementById("preparacion");

const modalTitle = document.getElementById("modalTitle");

const productoMessage = document.getElementById("productoMessage");

const btnNuevoProducto = document.getElementById("btnNuevoProducto");
const cerrarModal = document.getElementById("cerrarModal");
const cancelarModal = document.getElementById("cancelarModal");

const cancelarDesactivar = document.getElementById("cancelarDesactivar");
const confirmarDesactivar = document.getElementById("confirmarDesactivar");


// ======================================================
// VARIABLES
// ======================================================

let productos = [];

let productoSeleccionado = null;


// ======================================================
// TOKEN
// ======================================================

function getToken(){

    return localStorage.getItem("access_token");

}


// ======================================================
// HEADERS
// ======================================================

function getHeaders(){

    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getToken()}`
    };

}


// ======================================================
// MENSAJES
// ======================================================

function clearMessage(){

    productoMessage.className = "producto-message";
    productoMessage.textContent = "";

}


function showMessage(text, type){

    productoMessage.className = `producto-message show ${type}`;
    productoMessage.textContent = text;

}


// ======================================================
// CARGAR PRODUCTOS
// ======================================================

async function cargarProductos(){

    productosTable.innerHTML = `
        <tr>
            <td colspan="9" class="loading">
                Cargando productos...
            </td>
        </tr>
    `;

    try{

        const response = await fetch(`${API_URL}/productos/`,{
            method: "GET",
            headers: getHeaders()
        });


        const data = await response.json();


        if(!response.ok){

            if(response.status === 401){

                productosTable.innerHTML = `
                    <tr>
                        <td colspan="9" class="loading">
                            Sesión expirada.
                        </td>
                    </tr>
                `;

                return;
            }

            throw new Error(data.detail || "No fue posible cargar los productos.");

        }


        productos = data;

        mostrarProductos(productos);

    }
    catch(error){

        console.error(error);

        productosTable.innerHTML = `
            <tr>
                <td colspan="9" class="loading">
                    No fue posible conectar con el servidor.
                </td>
            </tr>
        `;

    }

}


// ======================================================
// MOSTRAR PRODUCTOS
// ======================================================

function mostrarProductos(lista){

    if(lista.length === 0){

        productosTable.innerHTML = `
            <tr>
                <td colspan="9" class="loading">
                    No hay productos registrados.
                </td>
            </tr>
        `;

        return;
    }


    productosTable.innerHTML = "";


    lista.forEach(producto => {

        const fila = document.createElement("tr");


        const estadoActivo = producto.estado !== false;


        const categoriaNombre = obtenerCategoria(producto.id_categoria);


        fila.innerHTML = `

            <td>${producto.id}</td>

            <td>
                <strong>${producto.nombre || "Sin nombre"}</strong>
            </td>

            <td>
                ${producto.descripcion || "Sin descripción"}
            </td>

            <td>
                ${producto.cantidad ?? 0}
            </td>

            <td>
                $${formatearPrecio(producto.precio)}
            </td>

            <td>
                ${categoriaNombre}
            </td>

            <td>
                ${producto.preparacion ? "Sí" : "No"}
            </td>

            <td>

                <span class="status ${estadoActivo ? "active" : "inactive"}">

                    ${estadoActivo ? "Activo" : "Inactivo"}

                </span>

            </td>

            <td>

                <div class="actions">

                    <button
                        type="button"
                        class="action-button"
                        title="Editar"
                        onclick="editarProducto(${producto.id})"
                    >
                        <i data-lucide="pencil"></i>
                    </button>


                    ${
                        estadoActivo
                        ?
                        `
                        <button
                            type="button"
                            class="action-button danger"
                            title="Desactivar"
                            onclick="abrirDesactivar(${producto.id})"
                        >
                            <i data-lucide="ban"></i>
                        </button>
                        `
                        :
                        ""
                    }

                </div>

            </td>

        `;


        productosTable.appendChild(fila);

    });


    lucide.createIcons();

}


// ======================================================
// OBTENER CATEGORÍA
// ======================================================

function obtenerCategoria(id){

    const categorias = {

        1: "Comidas",
        2: "Bebidas",
        3: "Postres"

    };

    return categorias[id] || "Sin categoría";

}


// ======================================================
// FORMATEAR PRECIO
// ======================================================

function formatearPrecio(valor){

    return Number(valor || 0).toLocaleString("es-CO",{
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

}


// ======================================================
// BUSCAR PRODUCTO
// ======================================================

buscarProducto.addEventListener("input",()=>{

    const texto = buscarProducto.value.toLowerCase().trim();


    const filtrados = productos.filter(producto => {

        const nombreProducto =
            String(producto.nombre || "").toLowerCase();

        const descripcionProducto =
            String(producto.descripcion || "").toLowerCase();


        return (
            nombreProducto.includes(texto) ||
            descripcionProducto.includes(texto)
        );

    });


    mostrarProductos(filtrados);

});


// ======================================================
// ABRIR MODAL REGISTRAR
// ======================================================

btnNuevoProducto.addEventListener("click",()=>{

    abrirModal();

});


// ======================================================
// ABRIR MODAL
// ======================================================

function abrirModal(){

    productoForm.reset();

    productoId.value = "";

    modalTitle.textContent = "Registrar producto";

    clearMessage();

    productoModal.classList.add("active");

}


// ======================================================
// CERRAR MODAL
// ======================================================

function cerrarProductoModal(){

    productoForm.reset();

    productoId.value = "";

    clearMessage();

    productoModal.classList.remove("active");

}


cerrarModal.addEventListener("click",cerrarProductoModal);

cancelarModal.addEventListener("click",cerrarProductoModal);


// ======================================================
// EDITAR PRODUCTO
// ======================================================

async function editarProducto(id){

    const producto = productos.find(item => item.id === id);


    if(!producto){

        showMessage("No se encontró el producto.","error");

        return;
    }


    productoId.value = producto.id;

    nombre.value = producto.nombre || "";

    descripcion.value = producto.descripcion || "";

    cantidad.value = producto.cantidad ?? "";

    precio.value = producto.precio ?? "";

    categoria.value = producto.id_categoria ?? "";

    preparacion.checked = producto.preparacion === true;


    modalTitle.textContent = "Editar producto";

    clearMessage();

    productoModal.classList.add("active");

}


// ======================================================
// VALIDAR FORMULARIO
// ======================================================

function validarFormulario(){

    const nombreValue = nombre.value.trim();

    const descripcionValue = descripcion.value.trim();

    const cantidadValue = cantidad.value;

    const precioValue = precio.value;

    const categoriaValue = categoria.value;


    if(nombreValue === ""){

        showMessage(
            "Ingrese el nombre del producto.",
            "error"
        );

        nombre.focus();

        return false;
    }


    if(nombreValue.length < 3){

        showMessage(
            "El nombre debe tener mínimo 3 caracteres.",
            "error"
        );

        nombre.focus();

        return false;
    }


    if(cantidadValue === "" || Number(cantidadValue) <= 0){

        showMessage(
            "Ingrese una cantidad válida.",
            "error"
        );

        cantidad.focus();

        return false;
    }


    if(precioValue === "" || Number(precioValue) <= 0){

        showMessage(
            "Ingrese un precio válido.",
            "error"
        );

        precio.focus();

        return false;
    }


    if(categoriaValue === ""){

        showMessage(
            "Seleccione una categoría.",
            "error"
        );

        categoria.focus();

        return false;
    }


    return true;

}


// ======================================================
// GUARDAR PRODUCTO
// ======================================================

productoForm.addEventListener("submit", async (e)=>{

    e.preventDefault();

    clearMessage();


    if(!validarFormulario()){

        return;
    }


    const id = productoId.value;


    const productoData = {

        nombre: nombre.value.trim(),

        descripcion:
            descripcion.value.trim() || null,

        cantidad:
            Number(cantidad.value),

        precio:
            Number(precio.value),

        id_categoria:
            Number(categoria.value),

        preparacion:
            preparacion.checked

    };


    try{

        let response;


        // ==================================================
        // EDITAR
        // ==================================================

        if(id){

            response = await fetch(
                `${API_URL}/productos/${id}`,
                {
                    method: "PUT",
                    headers: getHeaders(),
                    body: JSON.stringify(productoData)
                }
            );

        }


        // ==================================================
        // REGISTRAR
        // ==================================================

        else{

            response = await fetch(
                `${API_URL}/productos/`,
                {
                    method: "POST",
                    headers: getHeaders(),
                    body: JSON.stringify(productoData)
                }
            );

        }


        const data = await response.json();


        if(!response.ok){

            showMessage(
                data.detail || "No fue posible guardar el producto.",
                "error"
            );

            return;
        }


        showMessage(
            id
                ? "Producto actualizado exitosamente."
                : "Producto registrado exitosamente.",
            "success"
        );


        setTimeout(()=>{

            cerrarProductoModal();

            cargarProductos();

        },800);

    }
    catch(error){

        console.error(error);

        showMessage(
            "No fue posible conectar con el servidor.",
            "error"
        );

    }

});


// ======================================================
// ABRIR MODAL DESACTIVAR
// ======================================================

function abrirDesactivar(id){

    productoSeleccionado = id;

    desactivarModal.classList.add("active");

}


// ======================================================
// CERRAR MODAL DESACTIVAR
// ======================================================

function cerrarDesactivar(){

    productoSeleccionado = null;

    desactivarModal.classList.remove("active");

}


cancelarDesactivar.addEventListener(
    "click",
    cerrarDesactivar
);


// ======================================================
// CONFIRMAR DESACTIVACIÓN
// ======================================================

confirmarDesactivar.addEventListener("click", async ()=>{

    if(!productoSeleccionado){

        return;
    }


    try{

        const response = await fetch(
            `${API_URL}/productos/${productoSeleccionado}/estado?new_state=false`,
            {
                method: "PATCH",
                headers: getHeaders()
            }
        );


        const data = await response.json();


        if(!response.ok){

            alert(
                data.detail ||
                "No fue posible desactivar el producto."
            );

            return;
        }


        cerrarDesactivar();

        cargarProductos();

    }
    catch(error){

        console.error(error);

        alert(
            "No fue posible conectar con el servidor."
        );

    }

});


// ======================================================
// INICIAR
// ======================================================

cargarProductos();