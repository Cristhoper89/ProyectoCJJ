const CONFIGURATION_API_URL = "https://serviciocontigo.io/api";

let company = null;
let editing = false;
let saving = false;

const configurationForm = document.getElementById("configurationForm");
const configurationMessage = document.getElementById("configurationMessage");
const configurationLoading = document.getElementById("configurationLoading");
const configurationRestricted = document.getElementById("configurationRestricted");
const configurationEmpty = document.getElementById("configurationEmpty");
const configurationRetry = document.getElementById("configurationRetry");
const editConfiguration = document.getElementById("editConfiguration");
const cancelConfiguration = document.getElementById("cancelConfiguration");
const saveConfiguration = document.getElementById("saveConfiguration");
const automaticPrint = document.getElementById("automaticPrint");
const companyInputs = [...configurationForm.querySelectorAll(".configuration-field input")];

function configurationHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("access_token") || ""}`
    };
}

async function configurationRequest(path, options = {}) {
    const response = await fetch(`${CONFIGURATION_API_URL}${path}`, {
        ...options,
        headers: { ...configurationHeaders(), ...(options.headers || {}) }
    });
    const raw = await response.text();
    let data = null;
    if (raw) {
        try {
            data = JSON.parse(raw);
        } catch {
            data = raw;
        }
    }
    if (!response.ok) {
        const detail = typeof data === "object" && data !== null ? data.detail || data.message : data;
        throw new Error(typeof detail === "string" ? detail : "No fue posible completar la solicitud.");
    }
    return data;
}

function setConfigurationMessage(message = "", type = "") {
    configurationMessage.textContent = message;
    configurationMessage.className = `configuration-message ${type}`;
}

function showConfigurationState(state) {
    configurationLoading.hidden = state !== "loading";
    configurationRestricted.hidden = state !== "restricted";
    configurationEmpty.hidden = state !== "empty";
    configurationRetry.hidden = state !== "error";
    configurationForm.hidden = state !== "ready";
}

function renderCompany(data) {
    company = data;
    document.getElementById("companyName").value = data.nombre || "";
    document.getElementById("companyNit").value = data.NIT || "";
    document.getElementById("companyAddress").value = data.direccion || "";
    document.getElementById("companyPhone").value = data.telefono || "";
    document.getElementById("companyEmail").value = data.correo || "";
    automaticPrint.checked = data.impresion_automatica ?? true;
    setConfigurationEditing(false);
    showConfigurationState("ready");
}

function setConfigurationEditing(value) {
    editing = value;
    companyInputs.forEach(input => { input.disabled = !value || saving; });
    automaticPrint.disabled = !value || saving;
    editConfiguration.hidden = value;
    cancelConfiguration.hidden = !value;
    saveConfiguration.hidden = !value;
}

async function loadConfiguration() {
    if (!localStorage.getItem("access_token")) {
        window.location.href = "/";
        return;
    }

    showConfigurationState("loading");
    setConfigurationMessage();
    try {
        const user = await configurationRequest("/auth/me", { cache: "no-store" });
        if (user.role_name !== "Administrador") {
            showConfigurationState("restricted");
            return;
        }

        const companies = await configurationRequest("/empresas/", { cache: "no-store" });
        if (!Array.isArray(companies) || companies.length === 0) {
            showConfigurationState("empty");
            return;
        }
        renderCompany(companies[0]);
    } catch (error) {
        showConfigurationState("error");
        setConfigurationMessage(error.message || "No fue posible cargar la configuración.", "error");
    }
}

function cancelConfigurationEdit() {
    if (company) renderCompany(company);
}

editConfiguration.addEventListener("click", () => setConfigurationEditing(true));
cancelConfiguration.addEventListener("click", cancelConfigurationEdit);
configurationRetry.addEventListener("click", loadConfiguration);

configurationForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!company || saving) return;

    const data = Object.fromEntries(companyInputs.map(input => [input.name, input.value.trim()]));
    const missing = companyInputs.find(input => !data[input.name]);
    if (missing) {
        setConfigurationMessage(`Completa el campo "${missing.previousElementSibling.textContent}".`, "error");
        missing.focus();
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.correo)) {
        setConfigurationMessage("Ingresa un correo electrónico válido.", "error");
        document.getElementById("companyEmail").focus();
        return;
    }

    saving = true;
    saveConfiguration.disabled = true;
    setConfigurationEditing(true);
    setConfigurationMessage("Guardando configuración...");
    try {
        const updated = await configurationRequest(`/empresas/${encodeURIComponent(company.id)}`, {
            method: "PUT",
            body: JSON.stringify({
                ...data,
                impresion_automatica: automaticPrint.checked
            })
        });
        renderCompany(updated);
        setConfigurationMessage("Configuración guardada correctamente.", "success");
    } catch (error) {
        setConfigurationMessage(error.message || "No se pudo guardar la configuración.", "error");
    } finally {
        saving = false;
        saveConfiguration.disabled = false;
        if (editing) setConfigurationEditing(true);
    }
});

loadConfiguration();
