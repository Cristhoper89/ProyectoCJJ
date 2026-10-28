const EMPLOYEES_API_URL = "http://xwho2nzoxgmaxbhkyqnfbiwu.2.24.87.5.sslip.io";
const STAFF_ROLES = new Set(["Cocina", "Cajero", "Mesero"]);

const employeesTable = document.getElementById("employeesTable");
const employeeSearch = document.getElementById("employeeSearch");
const employeeStatus = document.getElementById("employeeStatus");
const employeeModal = document.getElementById("employeeModal");
const employeeConfirmModal = document.getElementById("employeeConfirmModal");
const employeeForm = document.getElementById("employeeForm");
const employeeFormMessage = document.getElementById("employeeFormMessage");
const employeesMessage = document.getElementById("employeesMessage");
const employeeRole = document.getElementById("employeeRole");
const employeeUsername = document.getElementById("employeeUsername");
const employeePassword = document.getElementById("employeePassword");
const saveEmployeeButton = document.getElementById("saveEmployeeButton");

let employees = [];
let staffRoles = [];
let editingEmployee = null;
let pendingStatusEmployee = null;

function getAuthHeaders(includeJson = true) {
    const token = localStorage.getItem("access_token");
    if (!token) {
        throw new Error("Tu sesión no está activa. Inicia sesión para administrar empleados.");
    }

    return {
        ...(includeJson ? {"Content-Type": "application/json"} : {}),
        "Authorization": `Bearer ${token}`
    };
}

async function requestJson(path, options = {}) {
    const response = await fetch(`${EMPLOYEES_API_URL}${path}`, {
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

function showEmployeesMessage(message, type = "error") {
    employeesMessage.textContent = message;
    employeesMessage.className = `employees-message visible ${type}`;
}

function clearEmployeesMessage() {
    employeesMessage.textContent = "";
    employeesMessage.className = "employees-message";
}

function updateEmployeeSummary() {
    const active = employees.filter(employee => employee.is_active).length;
    document.getElementById("totalEmployees").textContent = employees.length;
    document.getElementById("activeEmployees").textContent = active;
    document.getElementById("inactiveEmployees").textContent = employees.length - active;
}

function getVisibleEmployees() {
    const query = employeeSearch.value.trim().toLocaleLowerCase();
    const status = employeeStatus.value;

    return employees.filter(employee => {
        const role = staffRoles.find(item => item.id === employee.role_id)?.name || "";
        const matchesQuery = [
            employee.nombre,
            employee.username,
            employee.email,
            employee.telefono,
            role
        ].some(value => String(value ?? "").toLocaleLowerCase().includes(query));
        const matchesStatus = status === "all"
            || (status === "active" && employee.is_active)
            || (status === "inactive" && !employee.is_active);
        return matchesQuery && matchesStatus;
    });
}

function renderEmployees() {
    updateEmployeeSummary();
    const filteredEmployees = getVisibleEmployees();

    if (!filteredEmployees.length) {
        employeesTable.innerHTML = '<tr><td colspan="5" class="employees-placeholder">No se encontraron empleados con esos criterios.</td></tr>';
        return;
    }

    employeesTable.innerHTML = filteredEmployees.map(employee => {
        const roleName = staffRoles.find(role => role.id === employee.role_id)?.name || "Sin rol";
        const active = Boolean(employee.is_active);
        const displayName = employee.nombre || employee.username;
        return `
            <tr>
                <td>
                    <span class="employee-name">${escapeHtml(displayName)}</span>
                    <span class="employee-username">@${escapeHtml(employee.username)}</span>
                </td>
                <td><span class="employee-role">${escapeHtml(roleName)}</span></td>
                <td>
                    <span>${escapeHtml(employee.email)}</span>
                    <span class="employee-contact-secondary">${escapeHtml(employee.telefono || "Sin teléfono")}</span>
                </td>
                <td><span class="employee-status ${active ? "" : "inactive"}">${active ? "Activo" : "Inactivo"}</span></td>
                <td class="employee-actions-cell">
                    <div class="employee-actions">
                        <button class="employee-icon-button" type="button" data-action="edit" data-id="${escapeHtml(employee.id)}" aria-label="Editar ${escapeHtml(displayName)}" title="Editar empleado">
                            <i data-lucide="pencil"></i>
                        </button>
                        <button class="employee-icon-button ${active ? "" : "employee-reactivate"}" type="button" data-action="toggle" data-id="${escapeHtml(employee.id)}" aria-label="${active ? "Desactivar" : "Reactivar"} ${escapeHtml(displayName)}" title="${active ? "Desactivar" : "Reactivar"} empleado">
                            <i data-lucide="${active ? "user-round-x" : "user-round-check"}"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
    lucide.createIcons();
}

async function loadEmployees() {
    clearEmployeesMessage();
    employeesTable.innerHTML = '<tr><td colspan="5" class="employees-placeholder">Cargando empleados...</td></tr>';
    document.getElementById("addEmployeeButton").disabled = true;

    try {
        const [users, roles] = await Promise.all([
            requestJson("/users/"),
            requestJson("/roles/")
        ]);
        staffRoles = roles.filter(role => STAFF_ROLES.has(role.name));
        const staffRoleIds = new Set(staffRoles.map(role => role.id));
        employees = users.filter(user => staffRoleIds.has(user.role_id));

        if (!staffRoles.length) {
            showEmployeesMessage("No se encontraron los roles Cocina, Cajero o Mesero. Configúralos antes de registrar empleados.", "error");
        }

        renderEmployees();
    } catch (error) {
        employees = [];
        updateEmployeeSummary();
        employeesTable.innerHTML = '<tr><td colspan="5" class="employees-placeholder">No fue posible cargar los empleados.</td></tr>';
        showEmployeesMessage(error.message || "No fue posible cargar los empleados.", "error");
    } finally {
        document.getElementById("addEmployeeButton").disabled = staffRoles.length === 0;
    }
}

function setFormMessage(message = "") {
    employeeFormMessage.textContent = message;
    employeeFormMessage.classList.toggle("visible", Boolean(message));
}

function populateRoleOptions(selectedId = null) {
    employeeRole.innerHTML = staffRoles.map(role => `
        <option value="${escapeHtml(role.id)}" ${role.id === selectedId ? "selected" : ""}>${escapeHtml(role.name)}</option>
    `).join("");
}

function openEmployeeModal(employee = null) {
    editingEmployee = employee;
    employeeForm.reset();
    setFormMessage("");
    populateRoleOptions(employee?.role_id ?? staffRoles[0]?.id);

    document.getElementById("employeeModalTitle").textContent = employee ? "Editar empleado" : "Nuevo empleado";
    document.getElementById("employeeModalDescription").textContent = employee
        ? "Actualiza la información y el rol de esta cuenta."
        : "Completa los datos para crear una cuenta de personal.";
    document.getElementById("employeePasswordLabel").textContent = employee ? "Nueva contraseña (opcional)" : "Contraseña";
    document.getElementById("employeePasswordHelp").textContent = employee
        ? "Déjala vacía para conservar la contraseña actual."
        : "Mínimo 6 caracteres.";
    saveEmployeeButton.textContent = employee ? "Guardar cambios" : "Crear empleado";

    employeeUsername.disabled = Boolean(employee);
    employeeUsername.value = employee?.username || "";
    document.getElementById("employeeName").value = employee?.nombre || "";
    document.getElementById("employeeEmail").value = employee?.email || "";
    document.getElementById("employeePhone").value = employee?.telefono || "";
    employeePassword.value = "";
    employeeModal.classList.add("open");
    employeeModal.setAttribute("aria-hidden", "false");
    document.getElementById("employeeName").focus();
}

function closeEmployeeModal() {
    employeeModal.classList.remove("open");
    employeeModal.setAttribute("aria-hidden", "true");
    employeeForm.reset();
    editingEmployee = null;
    setFormMessage("");
}

async function saveEmployee(event) {
    event.preventDefault();
    setFormMessage("");

    const isEditing = Boolean(editingEmployee);
    const formData = new FormData(employeeForm);
    const nombre = String(formData.get("nombre") || "").trim();
    const username = String(formData.get("username") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const telefono = String(formData.get("telefono") || "").trim();
    const password = employeePassword.value;
    const roleId = Number(formData.get("role_id"));

    if (!nombre) {
        setFormMessage("Ingresa el nombre del empleado.");
        return;
    }
    if (!isEditing && username.length < 4) {
        setFormMessage("El usuario debe tener al menos 4 caracteres.");
        return;
    }
    if (!email || !document.getElementById("employeeEmail").validity.valid) {
        setFormMessage("Ingresa un correo electrónico válido.");
        return;
    }
    if (!isEditing && password.length < 6) {
        setFormMessage("La contraseña debe tener al menos 6 caracteres.");
        return;
    }
    if (password && password.length < 6) {
        setFormMessage("La contraseña debe tener al menos 6 caracteres.");
        return;
    }
    if (telefono.length > 10) {
        setFormMessage("El teléfono debe tener máximo 10 caracteres.");
        return;
    }
    if (!staffRoles.some(role => role.id === roleId)) {
        setFormMessage("Selecciona un rol de empleado válido.");
        return;
    }

    const details = {
        nombre,
        email,
        telefono,
        role_id: roleId
    };
    const payload = isEditing
        ? {...details, ...(password ? {password} : {})}
        : {...details, username, password};

    saveEmployeeButton.disabled = true;
    saveEmployeeButton.textContent = isEditing ? "Guardando..." : "Creando...";

    try {
        const savedEmployee = await requestJson(
            isEditing ? `/users/${encodeURIComponent(editingEmployee.id)}` : "/users/",
            {
                method: isEditing ? "PUT" : "POST",
                body: JSON.stringify(payload)
            }
        );
        if (isEditing) {
            employees = employees.map(employee => employee.id === savedEmployee.id ? savedEmployee : employee);
        } else {
            employees = [savedEmployee, ...employees];
        }
        closeEmployeeModal();
        renderEmployees();
        showEmployeesMessage(isEditing ? "Los datos del empleado se actualizaron." : "El empleado se creó correctamente.", "success");
    } catch (error) {
        setFormMessage(error.message || "No fue posible guardar el empleado.");
    } finally {
        saveEmployeeButton.disabled = false;
        saveEmployeeButton.textContent = isEditing ? "Guardar cambios" : "Crear empleado";
    }
}

async function toggleEmployee(employee) {
    const nextState = !employee.is_active;
    try {
        const updated = await requestJson(`/users/${encodeURIComponent(employee.id)}`, {
            method: "PUT",
            body: JSON.stringify({is_active: nextState})
        });
        employees = employees.map(item => item.id === updated.id ? updated : item);
        renderEmployees();
        showEmployeesMessage(`El empleado se ${nextState ? "reactivó" : "desactivó"} correctamente.`, "success");
    } catch (error) {
        showEmployeesMessage(error.message || "No fue posible actualizar el estado del empleado.", "error");
    }
}

function openStatusConfirmation(employee) {
    pendingStatusEmployee = employee;
    const nextState = !employee.is_active;
    document.getElementById("employeeConfirmTitle").textContent = nextState ? "Reactivar empleado" : "Desactivar empleado";
    document.getElementById("employeeConfirmMessage").textContent = `¿Quieres ${nextState ? "reactivar" : "desactivar"} a ${employee.nombre || employee.username}?`;
    document.getElementById("confirmEmployeeStatus").textContent = nextState ? "Reactivar" : "Desactivar";
    document.getElementById("confirmEmployeeStatus").classList.toggle("employee-button-danger", !nextState);
    employeeConfirmModal.classList.add("open");
    employeeConfirmModal.setAttribute("aria-hidden", "false");
}

function closeStatusConfirmation() {
    employeeConfirmModal.classList.remove("open");
    employeeConfirmModal.setAttribute("aria-hidden", "true");
    pendingStatusEmployee = null;
}

employeesTable.addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const employee = employees.find(item => item.id === button.dataset.id);
    if (!employee) return;

    if (button.dataset.action === "edit") {
        openEmployeeModal(employee);
    } else if (button.dataset.action === "toggle") {
        openStatusConfirmation(employee);
    }
});

document.getElementById("addEmployeeButton").addEventListener("click", () => openEmployeeModal());
document.getElementById("closeEmployeeModal").addEventListener("click", closeEmployeeModal);
document.getElementById("cancelEmployeeModal").addEventListener("click", closeEmployeeModal);
document.getElementById("cancelEmployeeStatus").addEventListener("click", closeStatusConfirmation);
document.getElementById("confirmEmployeeStatus").addEventListener("click", async () => {
    const employee = pendingStatusEmployee;
    closeStatusConfirmation();
    if (employee) await toggleEmployee(employee);
});
document.getElementById("employeeForm").addEventListener("submit", saveEmployee);
employeeSearch.addEventListener("input", renderEmployees);
employeeStatus.addEventListener("change", renderEmployees);
employeeModal.addEventListener("click", event => {
    if (event.target === employeeModal) closeEmployeeModal();
});
employeeConfirmModal.addEventListener("click", event => {
    if (event.target === employeeConfirmModal) closeStatusConfirmation();
});
document.addEventListener("keydown", event => {
    if (event.key === "Escape" && employeeModal.classList.contains("open")) closeEmployeeModal();
    if (event.key === "Escape" && employeeConfirmModal.classList.contains("open")) closeStatusConfirmation();
});

loadEmployees();