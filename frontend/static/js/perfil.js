const PROFILE_API_URL = "https://serviciocontigo.io/api";

let profile = null;
let editingProfile = false;
let savingProfile = false;

function profileHeaders() {
	const token = localStorage.getItem("access_token");
	return {
		"Content-Type": "application/json",
		"Authorization": `Bearer ${token || ""}`
	};
}

async function profileRequest(path, options = {}) {
	const response = await fetch(`${PROFILE_API_URL}${path}`, {
		...options,
		headers: {...profileHeaders(), ...(options.headers || {})}
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

function formatProfileDate(value) {
	if (!value) return "Sin registro";
	const date = new Date(value);
	return Number.isNaN(date.getTime())
		? "Sin registro"
		: date.toLocaleDateString("es-CO", {day: "numeric", month: "long", year: "numeric"});
}

function setProfileMessage(message = "", type = "") {
	const element = document.getElementById("profileMessage");
	element.textContent = message;
	element.className = `profile-message ${type}`;
}

function setProfileEditing(editing) {
	editingProfile = editing;
	document.getElementById("editProfile").hidden = editing;
	document.getElementById("cancelProfileEdit").hidden = !editing;
	document.getElementById("saveProfile").hidden = !editing;
	document.querySelectorAll(".profile-value").forEach(element => { element.hidden = editing; });
	document.querySelectorAll(".profile-field input").forEach(element => { element.hidden = !editing; });
}

function displayProfile(data) {
	profile = data;
	document.getElementById("profileDisplayName").textContent = data.nombre || data.username;
	document.getElementById("profileUsername").textContent = `@${data.username}`;
	document.getElementById("profileUsernameDetail").textContent = data.username;
	document.getElementById("profileRole").textContent = data.role_name;
	document.getElementById("profileCreatedAt").textContent = formatProfileDate(data.created_at);
	document.getElementById("profileLastLogin").textContent = formatProfileDate(data.last_login);

	const status = document.getElementById("profileStatus");
	status.textContent = data.is_active ? "ACTIVA" : "INACTIVA";
	status.classList.toggle("inactive", !data.is_active);

	const fields = [
		["profileName", "profileNameValue", data.nombre, "Sin configurar"],
		["profileEmail", "profileEmailValue", data.email, "Sin configurar"],
		["profilePhone", "profilePhoneValue", data.telefono, "Sin configurar"]
	];
	fields.forEach(([inputId, valueId, value, fallback]) => {
		document.getElementById(inputId).value = value || "";
		document.getElementById(valueId).textContent = value || fallback;
	});

	document.getElementById("profileLoading").hidden = true;
	document.getElementById("profileRetry").hidden = true;
	document.getElementById("profileCard").hidden = false;
	setProfileEditing(false);
}

async function loadProfile() {
	const token = localStorage.getItem("access_token");
	if (!token) {
		window.location.href = "/";
		return;
	}

	document.getElementById("profileLoading").hidden = false;
	document.getElementById("profileCard").hidden = true;
	document.getElementById("profileRetry").hidden = true;
	setProfileMessage("");
	try {
		displayProfile(await profileRequest("/auth/me", {cache: "no-store"}));
	} catch (error) {
		document.getElementById("profileLoading").hidden = true;
		document.getElementById("profileRetry").hidden = false;
		setProfileMessage(error instanceof Error ? error.message : "No fue posible cargar el perfil.", "error");
	}
}

function cancelProfileEdit() {
	if (!profile) return;
	displayProfile(profile);
	setProfileMessage("");
}

async function saveProfile(event) {
	event.preventDefault();
	if (!profile || savingProfile || !editingProfile) return;

	const name = document.getElementById("profileName").value.trim();
	const email = document.getElementById("profileEmail").value.trim();
	const phone = document.getElementById("profilePhone").value.trim();
	if (!name) {
		setProfileMessage("Ingresa tu nombre para guardar los cambios.", "error");
		document.getElementById("profileName").focus();
		return;
	}
	if (!email) {
		setProfileMessage("Ingresa tu correo electrónico para guardar los cambios.", "error");
		document.getElementById("profileEmail").focus();
		return;
	}
	if (phone.length > 10) {
		setProfileMessage("El teléfono debe tener máximo 10 caracteres.", "error");
		document.getElementById("profilePhone").focus();
		return;
	}

	const saveButton = document.getElementById("saveProfile");
	savingProfile = true;
	saveButton.disabled = true;
	saveButton.textContent = "Guardando...";
	setProfileMessage("");
	try {
		const updated = await profileRequest(`/users/${encodeURIComponent(profile.id)}`, {
			method: "PUT",
			body: JSON.stringify({nombre: name, email, telefono: phone})
		});
		displayProfile({...profile, ...updated});
		setProfileMessage("Tus datos se guardaron correctamente.", "success");
	} catch (error) {
		setProfileMessage(error instanceof Error ? error.message : "No fue posible guardar los cambios.", "error");
	} finally {
		savingProfile = false;
		saveButton.disabled = false;
		saveButton.innerHTML = '<i data-lucide="check"></i>Guardar cambios';
		if (window.lucide) window.lucide.createIcons();
	}
}

document.getElementById("editProfile").addEventListener("click", () => {
	setProfileEditing(true);
	document.getElementById("profileName").focus();
});
document.getElementById("cancelProfileEdit").addEventListener("click", cancelProfileEdit);
document.getElementById("profileForm").addEventListener("submit", saveProfile);
document.getElementById("profileRetry").addEventListener("click", loadProfile);

loadProfile();
