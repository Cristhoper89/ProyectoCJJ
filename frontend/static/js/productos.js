// ======================================================
// PRODUCTOS
// ======================================================

const API_URL = "https://serviciocontigo.io/api";

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
const ingredientesContainer = document.getElementById("ingredientesContainer");
const ingredientesLista = document.getElementById("ingredientesLista");
const gruposOpcionesLista = document.getElementById("gruposOpcionesLista");
const imagenesProductoInput = document.getElementById("imagenesProductoInput");
const btnAgregarImagenes = document.getElementById("btnAgregarImagenes");
const imagenesProductoLista = document.getElementById("imagenesProductoLista");

const modalTitle = document.getElementById("modalTitle");

const productoMessage = document.getElementById("productoMessage");

const btnNuevoProducto = document.getElementById("btnNuevoProducto");
const cerrarModal = document.getElementById("cerrarModal");
const cancelarModal = document.getElementById("cancelarModal");

const cancelarDesactivar = document.getElementById("cancelarDesactivar");
const confirmarDesactivar = document.getElementById("confirmarDesactivar");
const desactivarModalTitle = document.getElementById("desactivarModalTitle");
const desactivarModalMessage = document.getElementById("desactivarModalMessage");


// ======================================================
// VARIABLES
// ======================================================

let productos = [];

let categorias = [];
let ingredientes = [];
let relacionesProductoIngrediente = [];
let ingredientesSeleccionados = new Set();
let gruposOpciones = [];
let gruposOpcionesSeleccionados = new Set();
let imagenesProducto = [];
let archivosImagenes = [];
let imagenPrincipal = null;

let productoSeleccionado = null;

let nuevoEstadoProducto = false;


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

function escapeHtml(value){

    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    })[character]);

}

async function requestApi(path, options = {}){

    const body = options.body;
    const headers = {
        "Authorization": `Bearer ${getToken()}`,
        ...(body instanceof FormData ? {} : body === undefined ? {} : {"Content-Type": "application/json"}),
        ...options.headers
    };
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers
    });
    const data = response.status === 204 ? null : await response.json();

    if(!response.ok){
        const detail = data?.detail;
        throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail || "No fue posible completar la solicitud."));
    }

    return data;

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

async function cargarCategorias(){

    categoria.innerHTML = `
        <option value="">Cargando categorías...</option>
    `;

    try{

        const response = await fetch(`${API_URL}/categorias/`,{
            method: "GET",
            headers: getHeaders()
        });

        const data = await response.json();

        if(!response.ok){

            throw new Error(data.detail || "No fue posible cargar las categorías.");

        }

        categorias = data;

        categoria.innerHTML = `
            <option value="">Seleccione una categoría</option>
            ${categorias.map(item => `
                <option value="${item.id}">${item.nombre}</option>
            `).join("")}
        `;

    }
    catch(error){

        console.error(error);

        categorias = [];

        categoria.innerHTML = `
            <option value="">No fue posible cargar las categorías</option>
        `;

        showMessage(
            "No fue posible cargar las categorías desde la base de datos.",
            "error"
        );

    }

}

async function cargarIngredientes(){

    try{
        const response = await fetch(`${API_URL}/ingredientes/`,{
            method: "GET",
            headers: getHeaders()
        });
        const data = await response.json();

        if(!response.ok){
            throw new Error(data.detail || "No fue posible cargar los ingredientes.");
        }

        ingredientes = data.filter(item => item.estado !== false);
        renderizarIngredientes();
    }
    catch(error){
        console.error(error);
        ingredientes = [];
        ingredientesLista.innerHTML = `<span class="ingredientes-vacio">No fue posible cargar los ingredientes.</span>`;
    }

}

async function cargarRelacionesProductoIngrediente(){

    try{
        const response = await fetch(`${API_URL}/producto-ingredientes/`,{
            method: "GET",
            headers: getHeaders()
        });
        const data = await response.json();

        if(!response.ok){
            throw new Error(data.detail || "No fue posible cargar las relaciones de ingredientes.");
        }

        relacionesProductoIngrediente = data;
    }
    catch(error){
        console.error(error);
        relacionesProductoIngrediente = [];
    }

}

function renderizarIngredientes(){

    if(!ingredientesContainer || !preparacion.checked){
        return;
    }

    if(ingredientes.length === 0){
        ingredientesLista.innerHTML = `<span class="ingredientes-vacio">No hay ingredientes activos registrados.</span>`;
        return;
    }

    ingredientesLista.innerHTML = ingredientes.map(ingrediente => `
        <label class="ingrediente-item">
            <input type="checkbox" value="${ingrediente.id}" ${ingredientesSeleccionados.has(ingrediente.id) ? "checked" : ""}>
            <span>${ingrediente.nombre}</span>
        </label>
    `).join("");

}

function actualizarVisibilidadIngredientes(){

    ingredientesContainer.hidden = !preparacion.checked;

    if(preparacion.checked){
        renderizarIngredientes();
    }

}

async function sincronizarIngredientes(productoId){

    const actuales = relacionesProductoIngrediente.filter(
        relacion => relacion.id_producto === Number(productoId)
    );
    const deseados = preparacion.checked ? [...ingredientesSeleccionados] : [];

    const eliminaciones = actuales
        .filter(relacion => !deseados.includes(relacion.id_ingrediente))
        .map(relacion => fetch(`${API_URL}/producto-ingredientes/${relacion.id}`,{
            method: "DELETE",
            headers: getHeaders()
        }));
    const creaciones = deseados
        .filter(ingredienteId => !actuales.some(relacion => relacion.id_ingrediente === ingredienteId))
        .map(ingredienteId => fetch(`${API_URL}/producto-ingredientes/`,{
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({ id_producto: Number(productoId), id_ingrediente: ingredienteId })
        }));

    const respuestas = await Promise.all([...eliminaciones, ...creaciones]);
    const respuestaFallida = respuestas.find(response => !response.ok);

    if(respuestaFallida){
        const data = await respuestaFallida.json();
        throw new Error(data.detail || "No fue posible guardar los ingredientes del producto.");
    }

    const nuevasRelaciones = await Promise.all(
        creaciones.map(response => response.json())
    );
    relacionesProductoIngrediente = relacionesProductoIngrediente
        .filter(relacion => relacion.id_producto !== Number(productoId) || deseados.includes(relacion.id_ingrediente));
    relacionesProductoIngrediente.push(...nuevasRelaciones);

}

async function cargarGruposOpciones(){

    try{
        gruposOpciones = await requestApi("/grupos-opciones/");
        renderizarGruposOpciones();
    }
    catch(error){
        console.error(error);
        gruposOpciones = [];
        gruposOpcionesLista.innerHTML = `<span class="opciones-producto-vacio">No fue posible cargar los grupos de opciones.</span>`;
        showMessage(error.message, "error");
    }

}

function renderizarGruposOpciones(){

    if(gruposOpciones.length === 0){
        gruposOpcionesLista.innerHTML = `<span class="opciones-producto-vacio">No hay grupos de opciones registrados.</span>`;
        return;
    }

    gruposOpcionesLista.innerHTML = gruposOpciones.map(grupo => `
        <label class="opcion-producto-item">
            <input type="checkbox" value="${grupo.id}" ${gruposOpcionesSeleccionados.has(grupo.id) ? "checked" : ""}>
            <span>${escapeHtml(grupo.nombre)}</span>
        </label>
    `).join("");

}

async function sincronizarGruposOpciones(productoId){

    const actuales = await requestApi(`/productos/${productoId}/grupos-opciones/`);
    const actualesIds = actuales.map(grupo => grupo.id);
    const deseados = [...gruposOpcionesSeleccionados];
    const eliminaciones = actualesIds
        .filter(groupId => !deseados.includes(groupId))
        .map(groupId => requestApi(`/productos/${productoId}/grupos-opciones/${groupId}`, {method: "DELETE"}));
    const creaciones = deseados
        .filter(groupId => !actualesIds.includes(groupId))
        .map(groupId => requestApi("/producto-grupo-opcion/", {
            method: "POST",
            body: JSON.stringify({id_producto: Number(productoId), id_grupo_opcion: groupId})
        }));

    await Promise.all([...eliminaciones, ...creaciones]);

}

function limpiarImagenesTemporales(){

    archivosImagenes.forEach(image => URL.revokeObjectURL(image.previewUrl));
    archivosImagenes = [];

}

function renderizarImagenesProducto(){

    const savedImages = imagenesProducto.map(image => {
        const selected = imagenPrincipal?.tipo === "guardada" && imagenPrincipal.id === image.id;
        return `
            <button type="button" class="imagen-producto-opcion ${selected ? "selected" : ""}" data-saved-image="${image.id}" aria-label="Elegir imagen guardada como principal">
                <img src="${escapeHtml(image.url)}" alt="Imagen del producto">
                ${selected ? "<span>Principal</span>" : ""}
            </button>
        `;
    });
    const pendingImages = archivosImagenes.map((image, index) => {
        const selected = imagenPrincipal?.tipo === "pendiente" && imagenPrincipal.index === index;
        return `
            <button type="button" class="imagen-producto-opcion ${selected ? "selected" : ""}" data-pending-image="${index}" aria-label="Elegir imagen nueva ${index + 1} como principal">
                <img src="${image.previewUrl}" alt="Vista previa de imagen">
                ${selected ? "<span>Principal</span>" : ""}
            </button>
        `;
    });

    imagenesProductoLista.innerHTML = [...savedImages, ...pendingImages].join("");

}

async function cargarImagenesProducto(productoId){

    imagenesProducto = await requestApi(`/productos/${productoId}/imagenes`);
    const principal = imagenesProducto.find(image => image.es_principal);
    imagenPrincipal = principal ? {tipo: "guardada", id: principal.id} : null;
    renderizarImagenesProducto();

}

async function sincronizarImagenesProducto(productoId){

    if(archivosImagenes.length > 0){
        const formData = new FormData();
        archivosImagenes.forEach(image => formData.append("files", image.file, image.file.name));
        const uploaded = await requestApi(`/productos/${productoId}/imagenes`, {
            method: "POST",
            body: formData
        });

        imagenesProducto.push(...uploaded);
        if(imagenPrincipal?.tipo === "pendiente"){
            const uploadedPrincipal = uploaded[imagenPrincipal.index];
            if(uploadedPrincipal){
                imagenPrincipal = {tipo: "guardada", id: uploadedPrincipal.id};
            }
        }
        limpiarImagenesTemporales();
        imagenesProductoInput.value = "";
        renderizarImagenesProducto();
    }

    if(imagenPrincipal?.tipo === "guardada"){
        await requestApi(`/productos/${productoId}/imagenes/${imagenPrincipal.id}/principal`, {
            method: "PATCH"
        });
    }

    await cargarImagenesProducto(productoId);

}

async function cargarProductos(){

    productosTable.innerHTML = `
        <tr>
            <td colspan="10" class="loading">
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
                        <td colspan="10" class="loading">
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
                <td colspan="10" class="loading">
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
                <td colspan="10" class="loading">
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
                ${
                    producto.imagen_url
                    ? `<img class="product-image-thumb" src="${escapeHtml(producto.imagen_url)}" alt="Imagen de ${escapeHtml(producto.nombre || "producto")}">`
                    : `<span class="product-image-placeholder"><i data-lucide="image"></i></span>`
                }
            </td>

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
                            onclick="abrirCambioEstado(${producto.id}, false)"
                        >
                            <i data-lucide="ban"></i>
                        </button>
                        `
                        :
                        `
                        <button
                            type="button"
                            class="action-button danger"
                            title="Activar"
                            onclick="abrirCambioEstado(${producto.id}, true)"
                        >
                            <i data-lucide="rotate-ccw"></i>
                        </button>
                        `
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

    const categoriaEncontrada = categorias.find(item => item.id === id);

    return categoriaEncontrada?.nombre || "Sin categoría";

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
    limpiarImagenesTemporales();

    productoId.value = "";
    ingredientesSeleccionados = new Set();
    gruposOpcionesSeleccionados = new Set();
    imagenesProducto = [];
    imagenPrincipal = null;

    modalTitle.textContent = "Registrar producto";

    clearMessage();

    renderizarGruposOpciones();
    renderizarImagenesProducto();
    actualizarVisibilidadIngredientes();

    productoModal.classList.add("active");

}


// ======================================================
// CERRAR MODAL
// ======================================================

function cerrarProductoModal(){

    productoForm.reset();
    limpiarImagenesTemporales();

    productoId.value = "";
    ingredientesSeleccionados = new Set();
    gruposOpcionesSeleccionados = new Set();
    imagenesProducto = [];
    imagenPrincipal = null;

    clearMessage();

    renderizarGruposOpciones();
    renderizarImagenesProducto();
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


    try{
        const [currentGroups, currentImages] = await Promise.all([
            requestApi(`/productos/${producto.id}/grupos-opciones/`),
            requestApi(`/productos/${producto.id}/imagenes`)
        ]);

        limpiarImagenesTemporales();
        productoId.value = producto.id;

        nombre.value = producto.nombre || "";

        descripcion.value = producto.descripcion || "";

        cantidad.value = producto.cantidad ?? "";

        precio.value = producto.precio ?? "";

        categoria.value = producto.id_categoria ?? "";

        preparacion.checked = producto.preparacion === true;
        ingredientesSeleccionados = new Set(
            relacionesProductoIngrediente
                .filter(relacion => relacion.id_producto === producto.id)
                .map(relacion => relacion.id_ingrediente)
        );
        gruposOpcionesSeleccionados = new Set(currentGroups.map(group => group.id));
        gruposOpcionesLista.querySelectorAll("input[type='checkbox']").forEach(input => {
            input.checked = gruposOpcionesSeleccionados.has(Number(input.value));
        });
        imagenesProducto = currentImages;
        const principal = currentImages.find(image => image.es_principal);
        imagenPrincipal = principal ? {tipo: "guardada", id: principal.id} : null;

        modalTitle.textContent = "Editar producto";

        clearMessage();

        renderizarGruposOpciones();
        renderizarImagenesProducto();
        productoModal.classList.add("active");
        actualizarVisibilidadIngredientes();
    }
    catch(error){
        alert(error.message || "No fue posible cargar las opciones e imágenes del producto.");
    }

}

preparacion.addEventListener("change",()=>{

    if(!preparacion.checked){
        ingredientesSeleccionados = new Set();
    }

    actualizarVisibilidadIngredientes();

});

ingredientesLista.addEventListener("change",(event)=>{

    if(!event.target.matches("input[type='checkbox']")){
        return;
    }

    const ingredienteId = Number(event.target.value);

    if(event.target.checked){
        ingredientesSeleccionados.add(ingredienteId);
    }
    else{
        ingredientesSeleccionados.delete(ingredienteId);
    }

});

gruposOpcionesLista.addEventListener("change", event => {

    if(!event.target.matches("input[type='checkbox']")){
        return;
    }

    const groupId = Number(event.target.value);
    if(event.target.checked){
        gruposOpcionesSeleccionados.add(groupId);
    }
    else{
        gruposOpcionesSeleccionados.delete(groupId);
    }

});

btnAgregarImagenes.addEventListener("click", () => imagenesProductoInput.click());

imagenesProductoInput.addEventListener("change", () => {

    const chosenFiles = [...imagenesProductoInput.files];
    const invalidFile = chosenFiles.find(file => !file.type.startsWith("image/") || file.size > 10 * 1024 * 1024);
    if(invalidFile){
        showMessage("Selecciona imágenes válidas de máximo 10 MB cada una.", "error");
        imagenesProductoInput.value = "";
        return;
    }

    const firstNewImage = archivosImagenes.length;
    archivosImagenes.push(...chosenFiles.map(file => ({
        file,
        previewUrl: URL.createObjectURL(file)
    })));
    if(chosenFiles.length > 0 && !imagenPrincipal && imagenesProducto.length === 0){
        imagenPrincipal = {tipo: "pendiente", index: firstNewImage};
    }
    imagenesProductoInput.value = "";
    clearMessage();
    renderizarImagenesProducto();

});

imagenesProductoLista.addEventListener("click", event => {

    const button = event.target.closest("button[data-saved-image], button[data-pending-image]");
    if(!button){
        return;
    }

    if(button.dataset.savedImage){
        imagenPrincipal = {tipo: "guardada", id: Number(button.dataset.savedImage)};
    }
    else{
        imagenPrincipal = {tipo: "pendiente", index: Number(button.dataset.pendingImage)};
    }
    renderizarImagenesProducto();

});


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

    let productoGuardado = false;

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

        productoGuardado = true;
        productoId.value = data.id;
        modalTitle.textContent = "Editar producto";
        await sincronizarIngredientes(data.id);
        await sincronizarGruposOpciones(data.id);
        await sincronizarImagenesProducto(data.id);

        showMessage(
            id
                ? "Producto actualizado exitosamente."
                : "Producto registrado exitosamente.",
            "success"
        );


        cerrarProductoModal();
        await cargarProductos();

    }

    catch(error){

        console.error(error);

        showMessage(
            productoGuardado
                ? `El producto se guardó, pero no se completó su configuración: ${error.message}`
                : `No fue posible guardar el producto: ${error.message}`,
            "error"
        );

    }

});


// ======================================================
// ABRIR MODAL CAMBIAR ESTADO
// ======================================================

function abrirCambioEstado(id, nuevoEstado){

    productoSeleccionado = id;
    nuevoEstadoProducto = nuevoEstado;

    const activar = nuevoEstado === true;

    desactivarModalTitle.textContent = activar
        ? "Activar producto"
        : "Desactivar producto";

    desactivarModalMessage.textContent = activar
        ? "¿Está seguro de que desea activar este producto?"
        : "¿Está seguro de que desea desactivar este producto?";

    confirmarDesactivar.textContent = activar
        ? "Activar"
        : "Desactivar";

    confirmarDesactivar.classList.toggle("btn-danger", !activar);
    confirmarDesactivar.classList.toggle("btn-primary", activar);

    desactivarModal.classList.add("active");

}


// ======================================================
// CERRAR MODAL DESACTIVAR
// ======================================================

function cerrarDesactivar(){

    productoSeleccionado = null;
    nuevoEstadoProducto = false;

    desactivarModal.classList.remove("active");

}


cancelarDesactivar.addEventListener(
    "click",
    cerrarDesactivar
);


// ======================================================
// CONFIRMAR CAMBIO DE ESTADO
// ======================================================

confirmarDesactivar.addEventListener("click", async ()=>{

    if(!productoSeleccionado){

        return;
    }


    try{

        const response = await fetch(
            `${API_URL}/productos/${productoSeleccionado}/estado?new_state=${nuevoEstadoProducto}`,
            {
                method: "PATCH",
                headers: getHeaders()
            }
        );


        const data = await response.json();


        if(!response.ok){

            alert(
                data.detail ||
                "No fue posible cambiar el estado del producto."
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

cargarCategorias();
cargarIngredientes();
cargarRelacionesProductoIngrediente();
cargarGruposOpciones();

cargarProductos();
