const CUSTOMERS_API_URL = "http://xwho2nzoxgmaxbhkyqnfbiwu.2.24.87.5.sslip.io";

const customersTable = document.getElementById("customersTable");
const customerSearch = document.getElementById("customerSearch");
const customerStatus = document.getElementById("customerStatus");
const customerModal = document.getElementById("customerModal");
const customerConfirmModal = document.getElementById("customerConfirmModal");
const customerHistoryModal = document.getElementById("customerHistoryModal");
const customerForm = document.getElementById("customerForm");
const customerFormMessage = document.getElementById("customerFormMessage");
const customerPassword = document.getElementById("customerPassword");
const saveCustomerButton = document.getElementById("saveCustomerButton");

let customers = [];
let customerRoleId = null;
let movements = [];
let consumptions = [];
let products = [];
let editingCustomer = null;
let pendingStatusCustomer = null;

function getAuthHeaders() {
    const token = localStorage.getItem("access_token");
    if (!token) {
        throw new Error("Tu sesión no está activa. Inicia sesión para administrar clientes.");
    }

    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

async function requestJson(path, options = {}) {
    const response = await fetch(`${CUSTOMERS_API_URL}${path}`, {
        ...options,
        headers: {
            ...getAuthHeaders(),
            ...options.headers
        }
    });
    const data = await response.json();

    if (!response.ok) {
        const detail = data?.detail;
        throw new Error(typeof detail === "string" ? detail : detail ? JSON.stringify(detail) : "La solicitud no pudo completarse.");
    }

    return data;
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    })[character]);
}

function money(value) {
    const amount = Number(value ?? 0);
    return `$${Number.isFinite(amount) ? Math.round(amount).toLocaleString("es-CO") : "0"}`;
}

function parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value) {
    const date = parseDate(value);
    return date
        ? date.toLocaleString("es-CO", {day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"})
        : "Fecha sin registrar";
}

function showCustomersMessage(message, type = "error") {
    const messageElement = document.getElementById("customersMessage");
    messageElement.textContent = message;
    messageElement.className = `customers-message visible ${type}`;
}

function clearCustomersMessage() {
    const messageElement = document.getElementById("customersMessage");
    messageElement.textContent = "";
    messageElement.className = "customers-message";
}

function getCustomerPurchases(customer) {
    return movements
        .filter(movement => movement.id_cliente === customer.id && movement.estado !== false && Number(movement.total) > 0)
        .sort((first, second) => (parseDate(second.fecha_hora)?.getTime() || 0) - (parseDate(first.fecha_hora)?.getTime() || 0));
}

function customerSpent(customer) {
    return getCustomerPurchases(customer).reduce((sum, movement) => sum + (Number(movement.total) || 0), 0);
}

function updateCustomerSummary() {
    document.getElementById("totalCustomers").textContent = customers.length;
    document.getElementById("activeCustomers").textContent = customers.filter(customer => customer.is_active).length;
    document.getElementById("customersWithPurchases").textContent = customers.filter(customer => getCustomerPurchases(customer).length > 0).length;
}

function getVisibleCustomers() {
    const query = customerSearch.value.trim().toLocaleLowerCase();
    const status = customerStatus.value;

    return customers.filter(customer => {
        const matchesQuery = [
            customer.nombre,
            customer.username,
            customer.email,
            customer.telefono
        ].some(value => String(value ?? "").toLocaleLowerCase().includes(query));
        const matchesStatus = status === "all"
            || (status === "active" && customer.is_active)
            || (status === "inactive" && !customer.is_active);
        return matchesQuery && matchesStatus;
    });
}

function renderCustomers() {
    updateCustomerSummary();
    const visibleCustomers = getVisibleCustomers();

    if (!visibleCustomers.length) {
        customersTable.innerHTML = '<tr><td colspan="6" class="customers-placeholder">No se encontraron clientes con esos criterios.</td></tr>';
        return;
    }

    customersTable.innerHTML = visibleCustomers.map(customer => {
        const active = Boolean(customer.is_active);
        const displayName = customer.nombre || customer.username;
        const purchaseCount = getCustomerPurchases(customer).length;
        return `
            <tr>
                <td>
                    <span class="customer-name">${escapeHtml(displayName)}</span>
                    <span class="customer-username">@${escapeHtml(customer.username)}</span>
                </td>
                <td>
                    <span>${escapeHtml(customer.email)}</span>
                    <span class="customer-contact-secondary">${escapeHtml(customer.telefono || "Sin teléfono")}</span>
                </td>
                <td>${purchaseCount} ${purchaseCount === 1 ? "compra" : "compras"}</td>
                <td>${money(customerSpent(customer))}</td>
                <td><span class="customer-status ${active ? "" : "inactive"}">${active ? "Activo" : "Inactivo"}</span></td>
                <td class="customer-actions-cell">
                    <div class="customer-actions">
                        <button class="customer-icon-button" type="button" data-action="history" data-id="${escapeHtml(customer.id)}" aria-label="Ver historial de ${escapeHtml(displayName)}" title="Ver historial">
                            <i data-lucide="receipt-text"></i>
                        </button>
                        <button class="customer-icon-button" type="button" data-action="edit" data-id="${escapeHtml(customer.id)}" aria-label="Editar ${escapeHtml(displayName)}" title="Editar cliente">
                            <i data-lucide="pencil"></i>
                        </button>
                        <button class="customer-icon-button ${active ? "" : "customer-reactivate"}" type="button" data-action="toggle" data-id="${escapeHtml(customer.id)}" aria-label="${active ? "Desactivar" : "Reactivar"} ${escapeHtml(displayName)}" title="${active ? "Desactivar" : "Reactivar"} cliente">
                            <i data-lucide="${active ? "user-round-x" : "user-round-check"}"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
    lucide.createIcons();
}

async function loadCustomers() {
    clearCustomersMessage();
    customersTable.innerHTML = '<tr><td colspan="6" class="customers-placeholder">Cargando clientes...</td></tr>';
    document.getElementById("addCustomerButton").disabled = true;

    try {
        const [users, roles, movementData, consumptionData, productData] = await Promise.all([
            requestJson("/users/"),
            requestJson("/roles/"),
            requestJson("/movimientos/"),
            requestJson("/mesasC/"),
            requestJson("/productos/")
        ]);
        customerRoleId = roles.find(role => role.name === "Cliente")?.id ?? null;
        customers = customerRoleId == null ? [] : users.filter(user => user.role_id === customerRoleId);
        movements = movementData;
        consumptions = consumptionData;
        products = productData;

        if (customerRoleId == null) {
            showCustomersMessage("No se encontró el rol Cliente. Créalo desde Configuración de roles antes de registrar clientes.", "error");
        }

        renderCustomers();
    } catch (error) {
        customers = [];
        movements = [];
        consumptions = [];
        products = [];
        updateCustomerSummary();
        customersTable.innerHTML = '<tr><td colspan="6" class="customers-placeholder">No fue posible cargar los clientes.</td></tr>';
        showCustomersMessage(error.message || "No fue posible cargar los clientes.", "error");
    } finally {
        document.getElementById("addCustomerButton").disabled = customerRoleId == null;
    }
}

function setFormMessage(message = "") {
    customerFormMessage.textContent = message;
    customerFormMessage.classList.toggle("visible", Boolean(message));
}

function openCustomerModal(customer = null) {
    editingCustomer = customer;
    customerForm.reset();
    setFormMessage("");

    document.getElementById("customerModalTitle").textContent = customer ? "Editar cliente" : "Nuevo cliente";
    document.getElementById("customerModalDescription").textContent = customer
        ? "Actualiza los datos de la cuenta del cliente."
        : "Registra una cuenta para que el cliente pueda realizar pedidos.";
    document.getElementById("customerPasswordLabel").textContent = customer ? "Nueva contraseña (opcional)" : "Contraseña";
    document.getElementById("customerPasswordHelp").textContent = customer
        ? "Déjala vacía para conservar la contraseña actual."
        : "Mínimo 6 caracteres.";
    saveCustomerButton.textContent = customer ? "Guardar cambios" : "Crear cliente";

    document.getElementById("customerName").value = customer?.nombre || "";
    document.getElementById("customerUsername").value = customer?.username || "";
    document.getElementById("customerUsername").disabled = Boolean(customer);
    document.getElementById("customerEmail").value = customer?.email || "";
    document.getElementById("customerPhone").value = customer?.telefono || "";
    customerPassword.value = "";

    customerModal.classList.add("open");
    customerModal.setAttribute("aria-hidden", "false");
    document.getElementById("customerName").focus();
}

function closeCustomerModal() {
    customerModal.classList.remove("open");
    customerModal.setAttribute("aria-hidden", "true");
    customerForm.reset();
    editingCustomer = null;
    setFormMessage("");
}

async function saveCustomer(event) {
    event.preventDefault();
    setFormMessage("");
    const isEditing = Boolean(editingCustomer);
    const nombre = document.getElementById("customerName").value.trim();
    const username = document.getElementById("customerUsername").value.trim();
    const emailInput = document.getElementById("customerEmail");
    const email = emailInput.value.trim().toLowerCase();
    const telefono = document.getElementById("customerPhone").value.trim();
    const password = customerPassword.value;

    if (!isEditing && customerRoleId == null) {
        setFormMessage("No se encontró el rol Cliente. No es posible crear la cuenta.");
        return;
    }
    if (!nombre) {
        setFormMessage("Ingresa el nombre del cliente.");
        return;
    }
    if (!isEditing && username.length < 4) {
        setFormMessage("El usuario debe tener al menos 4 caracteres.");
        return;
    }
    if (!email || !emailInput.validity.valid) {
        setFormMessage("Ingresa un correo electrónico válido.");
        return;
    }
    if ((!isEditing || password) && password.length < 6) {
        setFormMessage("La contraseña debe tener al menos 6 caracteres.");
        return;
    }
    if (telefono.length > 10) {
        setFormMessage("El teléfono debe tener máximo 10 caracteres.");
        return;
    }

    const details = {nombre, email, telefono, ...(password ? {password} : {})};
    const payload = isEditing
        ? details
        : {...details, username, password, role_id: customerRoleId};
    saveCustomerButton.disabled = true;
    saveCustomerButton.textContent = isEditing ? "Guardando..." : "Creando...";

    try {
        const savedCustomer = await requestJson(
            isEditing ? `/users/${encodeURIComponent(editingCustomer.id)}` : "/users/",
            {
                method: isEditing ? "PUT" : "POST",
                body: JSON.stringify(payload)
            }
        );
        if (isEditing) {
            customers = customers.map(customer => customer.id === savedCustomer.id ? savedCustomer : customer);
        } else {
            customers = [savedCustomer, ...customers];
        }
        closeCustomerModal();
        renderCustomers();
        showCustomersMessage(isEditing ? "Los datos del cliente se actualizaron." : "El cliente se creó correctamente.", "success");
    } catch (error) {
        setFormMessage(error.message || "No fue posible guardar el cliente.");
    } finally {
        saveCustomerButton.disabled = false;
        saveCustomerButton.textContent = isEditing ? "Guardar cambios" : "Crear cliente";
    }
}

function openStatusConfirmation(customer) {
    pendingStatusCustomer = customer;
    const nextState = !customer.is_active;
    document.getElementById("customerConfirmTitle").textContent = nextState ? "Reactivar cliente" : "Desactivar cliente";
    document.getElementById("customerConfirmMessage").textContent = `¿Quieres ${nextState ? "reactivar" : "desactivar"} a ${customer.nombre || customer.username}?`;
    document.getElementById("confirmCustomerStatus").textContent = nextState ? "Reactivar" : "Desactivar";
    document.getElementById("confirmCustomerStatus").classList.toggle("customer-button-danger", !nextState);
    document.getElementById("confirmCustomerStatus").classList.toggle("customer-button-primary", nextState);
    customerConfirmModal.classList.add("open");
    customerConfirmModal.setAttribute("aria-hidden", "false");
}

function closeStatusConfirmation() {
    customerConfirmModal.classList.remove("open");
    customerConfirmModal.setAttribute("aria-hidden", "true");
    pendingStatusCustomer = null;
}

async function toggleCustomerStatus(customer) {
    const nextState = !customer.is_active;
    try {
        const updated = await requestJson(`/users/${encodeURIComponent(customer.id)}`, {
            method: "PUT",
            body: JSON.stringify({is_active: nextState})
        });
        customers = customers.map(item => item.id === updated.id ? updated : item);
        renderCustomers();
        showCustomersMessage(`El cliente se ${nextState ? "reactivó" : "desactivó"} correctamente.`, "success");
    } catch (error) {
        showCustomersMessage(error.message || "No fue posible actualizar el estado del cliente.", "error");
    }
}

function getPurchasesForHistory(customer) {
    return getCustomerPurchases(customer);
}

function getFavoriteProduct(customer) {
    const purchaseIds = new Set(getCustomerPurchases(customer).map(movement => movement.id));
    const productById = new Map(products.map(product => [product.id, product]));
    const totalsByProduct = new Map();

    consumptions.forEach(item => {
        if (item.id_mov == null || !purchaseIds.has(item.id_mov) || Number(item.subtotal) <= 0 || item.id_producto == null) return;
        const product = productById.get(item.id_producto);
        if (!product) return;
        const current = totalsByProduct.get(item.id_producto) || {name: product.nombre || `Producto ${item.id_producto}`, quantity: 0, total: 0};
        current.quantity += Number(item.cantidad) || 0;
        current.total += Number(item.subtotal) || 0;
        totalsByProduct.set(item.id_producto, current);
    });

    return [...totalsByProduct.values()].sort((first, second) => (
        second.quantity - first.quantity || second.total - first.total || first.name.localeCompare(second.name)
    ))[0] || null;
}

function renderCustomerHistory(customer) {
    const purchases = getPurchasesForHistory(customer);
    const visits = new Set(purchases.map(movement => {
        const date = parseDate(movement.fecha_hora);
        return date ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : null;
    }).filter(Boolean));
    const favorite = getFavoriteProduct(customer);
    const productById = new Map(products.map(product => [product.id, product]));

    document.getElementById("customerHistoryTitle").textContent = customer.nombre || customer.username;
    document.getElementById("customerHistorySubtitle").textContent = `@${customer.username} · ${customer.email}`;

    const purchaseCards = purchases.length
        ? purchases.map(movement => {
            const items = consumptions.filter(item => item.id_mov === movement.id && Number(item.subtotal) > 0);
            const details = items.length
                ? items.map(item => `
                    <div class="customer-purchase-item">
                        <span>${escapeHtml(productById.get(item.id_producto)?.nombre || `Producto ${item.id_producto || ""}`)}</span>
                        <span>${Number(item.cantidad) || 1} × ${money(item.subtotal)}</span>
                    </div>
                `).join("")
                : '<div class="customer-purchase-item"><span>Detalle de productos no disponible.</span></div>';
            return `
                <article class="customer-purchase">
                    <header class="customer-purchase-header">
                        <div>
                            <strong>Compra #${escapeHtml(movement.id)}</strong>
                            <span>${escapeHtml(formatDateTime(movement.fecha_hora))}</span>
                        </div>
                        <div class="customer-purchase-total">
                            <strong>${money(movement.total)}</strong>
                            <span>${escapeHtml(movement.metodo || "Sin método")}</span>
                        </div>
                    </header>
                    ${details}
                </article>
            `;
        }).join("")
        : '<div class="customer-history-empty">Este cliente aún no tiene compras registradas.</div>';

    document.getElementById("customerHistoryContent").innerHTML = `
        <section class="customer-history-summary" aria-label="Resumen del cliente">
            <div class="customer-history-stat"><span>Total gastado</span><strong>${money(customerSpent(customer))}</strong></div>
            <div class="customer-history-stat"><span>Compras</span><strong>${purchases.length}</strong></div>
            <div class="customer-history-stat"><span>Días asistidos</span><strong>${visits.size}</strong></div>
        </section>
        <section class="customer-favorite">
            <div class="customer-favorite-icon"><i data-lucide="shopping-bag"></i></div>
            <div>
                <span>Producto más comprado</span>
                <strong>${escapeHtml(favorite?.name || "Sin compras registradas")}</strong>
                ${favorite ? `<small>${favorite.quantity} unidades · ${money(favorite.total)}</small>` : ""}
            </div>
        </section>
        <h3 class="customer-history-section-title">Historial de compras (${purchases.length})</h3>
        ${purchaseCards}
    `;

    customerHistoryModal.classList.add("open");
    customerHistoryModal.setAttribute("aria-hidden", "false");
    lucide.createIcons();
}

function closeCustomerHistory() {
    customerHistoryModal.classList.remove("open");
    customerHistoryModal.setAttribute("aria-hidden", "true");
}

customersTable.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const customer = customers.find(item => item.id === button.dataset.id);
    if (!customer) return;

    if (button.dataset.action === "history") {
        renderCustomerHistory(customer);
    } else if (button.dataset.action === "edit") {
        openCustomerModal(customer);
    } else if (button.dataset.action === "toggle") {
        openStatusConfirmation(customer);
    }
});

document.getElementById("addCustomerButton").addEventListener("click", () => openCustomerModal());
document.getElementById("closeCustomerModal").addEventListener("click", closeCustomerModal);
document.getElementById("cancelCustomerModal").addEventListener("click", closeCustomerModal);
document.getElementById("customerForm").addEventListener("submit", saveCustomer);
document.getElementById("cancelCustomerStatus").addEventListener("click", closeStatusConfirmation);
document.getElementById("confirmCustomerStatus").addEventListener("click", async () => {
    const customer = pendingStatusCustomer;
    closeStatusConfirmation();
    if (customer) await toggleCustomerStatus(customer);
});
document.getElementById("closeCustomerHistory").addEventListener("click", closeCustomerHistory);
customerSearch.addEventListener("input", renderCustomers);
customerStatus.addEventListener("change", renderCustomers);
customerModal.addEventListener("click", event => {
    if (event.target === customerModal) closeCustomerModal();
});
customerConfirmModal.addEventListener("click", event => {
    if (event.target === customerConfirmModal) closeStatusConfirmation();
});
customerHistoryModal.addEventListener("click", event => {
    if (event.target === customerHistoryModal) closeCustomerHistory();
});
document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    if (customerModal.classList.contains("open")) closeCustomerModal();
    if (customerConfirmModal.classList.contains("open")) closeStatusConfirmation();
    if (customerHistoryModal.classList.contains("open")) closeCustomerHistory();
});

loadCustomers();
