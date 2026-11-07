const CARTA_API_URL = "https://serviciocontigo.io/api";

let cartaCategories = [];
let selectedCategoryId = "all";
let cartaSearch = "";

const cartaElements = {
    categories: document.getElementById("cartaCategories"),
    search: document.getElementById("cartaSearch"),
    title: document.getElementById("cartaSectionTitle"),
    count: document.getElementById("cartaProductCount"),
    message: document.getElementById("cartaMessage"),
    loading: document.getElementById("cartaLoading"),
    grid: document.getElementById("cartaProductGrid"),
    dialog: document.getElementById("cartaProductDialog")
};

function cartaEscape(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function cartaMoney(value) {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0
    }).format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

function cartaImageUrl(value) {
    if (typeof value !== "string" || !value.trim()) return "";
    try {
        const url = new URL(value, window.location.origin);
        return ["https:", "http:"].includes(url.protocol) ? url.href : "";
    } catch (error) {
        return "";
    }
}

function cartaPlaceholder(className = "") {
    return `<div class="carta-image-placeholder ${className}" aria-label="Sin imagen disponible"><i data-lucide="utensils"></i></div>`;
}

function cartaProductImage(product, className = "") {
    const imageUrl = cartaImageUrl(product.imagen_url);
    if (!imageUrl) return cartaPlaceholder(className);
    return `<img class="carta-product-image ${className}" src="${cartaEscape(imageUrl)}" alt="${cartaEscape(product.nombre)}" loading="lazy">`;
}

function getVisibleProducts() {
    const sourceCategories = selectedCategoryId === "all"
        ? cartaCategories
        : cartaCategories.filter((category) => String(category.id) === selectedCategoryId);
    const query = cartaSearch.trim().toLocaleLowerCase("es");
    return sourceCategories.flatMap((category) => category.productos.map((product) => ({
        ...product,
        categoriaNombre: category.nombre
    }))).filter((product) => !query
        || product.nombre.toLocaleLowerCase("es").includes(query)
        || String(product.descripcion || "").toLocaleLowerCase("es").includes(query));
}

function renderCategoryFilters() {
    const categories = [{ id: "all", nombre: "Todos" }, ...cartaCategories];
    cartaElements.categories.innerHTML = categories.map((category) => `
        <button class="carta-category-chip ${String(category.id) === selectedCategoryId ? "selected" : ""}"
            type="button" data-category-id="${cartaEscape(category.id)}"
            aria-pressed="${String(category.id) === selectedCategoryId}">
            ${cartaEscape(category.nombre)}
        </button>
    `).join("");
    cartaElements.categories.querySelectorAll("button").forEach((button) => {
        button.addEventListener("click", () => {
            selectedCategoryId = button.dataset.categoryId;
            renderCategoryFilters();
            renderProducts();
        });
    });
}

function renderProducts() {
    const products = getVisibleProducts();
    const selectedCategory = cartaCategories.find((category) => String(category.id) === selectedCategoryId);
    cartaElements.title.textContent = selectedCategory ? selectedCategory.nombre : "Todos los platos";
    cartaElements.count.textContent = `${products.length} ${products.length === 1 ? "plato" : "platos"}`;

    if (!products.length) {
        cartaElements.grid.innerHTML = `
            <div class="carta-empty">
                <span class="carta-empty-icon"><i data-lucide="${cartaSearch ? "search-x" : "utensils"}"></i></span>
                <h3>${cartaSearch ? "No encontramos resultados" : "Pronto tendremos novedades"}</h3>
                <p>${cartaSearch ? "Prueba con otro nombre o elige una categoría diferente." : "Aún no hay platos disponibles en esta categoría."}</p>
            </div>`;
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    cartaElements.grid.innerHTML = products.map((product) => `
        <button class="carta-product-card" type="button" data-product-id="${Number(product.id)}">
            <span class="carta-card-image-wrap">
                ${cartaProductImage(product)}
                <span class="carta-card-category">${cartaEscape(product.categoriaNombre)}</span>
            </span>
            <span class="carta-card-copy">
                <span class="carta-card-title-row">
                    <strong>${cartaEscape(product.nombre)}</strong>
                    <span class="carta-card-price">${cartaMoney(product.precio)}</span>
                </span>
                <span class="carta-card-description">${cartaEscape(product.descripcion || "Preparado al momento con ingredientes seleccionados.")}</span>
                <span class="carta-card-more">Ver detalles <i data-lucide="arrow-up-right"></i></span>
            </span>
        </button>
    `).join("");
    cartaElements.grid.querySelectorAll(".carta-product-card").forEach((button) => {
        button.addEventListener("click", () => {
            const product = products.find((item) => item.id === Number(button.dataset.productId));
            if (product) openProductDetails(product);
        });
    });
    cartaElements.grid.querySelectorAll(".carta-product-image").forEach((image) => {
        image.addEventListener("error", () => {
            image.replaceWith(Object.assign(document.createElement("div"), {
                className: "carta-image-placeholder",
                innerHTML: '<i data-lucide="utensils"></i>'
            }));
            if (window.lucide) window.lucide.createIcons();
        }, { once: true });
    });
    if (window.lucide) window.lucide.createIcons();
}

function openProductDetails(product) {
    document.getElementById("dialogProductCategory").textContent = product.categoriaNombre;
    document.getElementById("dialogProductName").textContent = product.nombre;
    document.getElementById("dialogProductDescription").textContent = product.descripcion
        || "Preparado al momento con ingredientes seleccionados.";
    document.getElementById("dialogProductPrice").textContent = cartaMoney(product.precio);

    const imageContainer = document.getElementById("dialogProductImage");
    const imageUrl = cartaImageUrl(product.imagen_url);
    imageContainer.innerHTML = imageUrl
        ? `<img src="${cartaEscape(imageUrl)}" alt="${cartaEscape(product.nombre)}">`
        : cartaPlaceholder();
    const details = document.getElementById("dialogProductDetails");
    const sections = [];
    if (product.ingredientes?.length) {
        sections.push(`
            <section class="dialog-detail-section">
                <h3>Ingredientes</h3>
                <ul class="ingredient-chips">${product.ingredientes.map((ingredient) => `<li>${cartaEscape(ingredient.nombre)}</li>`).join("")}</ul>
            </section>`);
    }
    (product.grupos_opciones || []).forEach((group) => {
        if (!group.opciones?.length) return;
        sections.push(`
            <section class="dialog-detail-section">
                <h3>${cartaEscape(group.nombre)}</h3>
                <ul class="ingredient-chips">${group.opciones.map((option) => `<li>${cartaEscape(option.nombre)}</li>`).join("")}</ul>
            </section>`);
    });
    details.innerHTML = sections.join("");
    cartaElements.dialog.showModal();
    if (window.lucide) window.lucide.createIcons();
}

async function loadCarta() {
    cartaElements.loading.hidden = false;
    cartaElements.message.textContent = "";
    cartaElements.grid.replaceChildren();
    try {
        const response = await fetch(`${CARTA_API_URL}/carta/`, { cache: "no-store" });
        const raw = await response.text();
        let data;
        try {
            data = raw ? JSON.parse(raw) : null;
        } catch (error) {
            throw new Error("La respuesta de la carta no tiene un formato válido.");
        }
        if (!response.ok) {
            const detail = typeof data === "object" && data !== null ? data.detail || data.message : null;
            throw new Error(typeof detail === "string" ? detail : "No se pudo cargar la carta.");
        }
        if (!data || !Array.isArray(data.categorias)) {
            throw new Error("La carta recibida no tiene un formato válido.");
        }
        cartaCategories = data.categorias;
        renderCategoryFilters();
        renderProducts();
    } catch (error) {
        cartaElements.message.textContent = error instanceof Error ? error.message : "No se pudo cargar la carta.";
        cartaElements.grid.innerHTML = `
            <div class="carta-empty carta-load-error">
                <span class="carta-empty-icon"><i data-lucide="circle-alert"></i></span>
                <h3>No pudimos cargar la carta</h3>
                <p>${cartaEscape(cartaElements.message.textContent)}</p>
                <button class="carta-retry" type="button">Intentar de nuevo</button>
            </div>`;
        cartaElements.grid.querySelector(".carta-retry").addEventListener("click", loadCarta);
        if (window.lucide) window.lucide.createIcons();
    } finally {
        cartaElements.loading.hidden = true;
    }
}

cartaElements.search.addEventListener("input", () => {
    cartaSearch = cartaElements.search.value;
    renderProducts();
});
document.getElementById("closeProductDialog").addEventListener("click", () => cartaElements.dialog.close());
cartaElements.dialog.addEventListener("click", (event) => {
    if (event.target === cartaElements.dialog) cartaElements.dialog.close();
});
document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
        event.preventDefault();
        cartaElements.search.focus();
    }
});

loadCarta();
