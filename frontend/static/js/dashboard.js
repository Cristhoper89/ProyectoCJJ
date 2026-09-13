const API_URL = "http://127.0.0.1:8000";
const token = localStorage.getItem("access_token");
const sideNav = document.getElementById("sideNav");
const moduleGrid = document.getElementById("moduleGrid");
const sidebar = document.getElementById("sidebar");
const mobileBackdrop = document.getElementById("mobileBackdrop");
const dashboardToast = document.getElementById("dashboardToast");
let toastTimeout;

const modules = {
	admin: [
		["Perfil", "user-round", "#perfil"], ["Caja", "wallet-cards", "../templates/caja.html"],
		["Categorías", "tags", "../templates/categorias.html"], ["Mesa", "layout-grid", "../templates/mesas.html"],
		["Movimientos", "arrow-left-right", null], ["Productos", "package", "../templates/productos.html"],
		["Proveedores", "truck", null], ["Empleados", "users-round", "../templates/usuarios.html"],
		["Clientes", "contact-round", null], ["Estadística", "chart-no-axes-combined", "../templates/reportes.html"],
		["Pedidos", "clipboard-list", "../templates/pedidos.html"], ["Carta", "book-open", null],
		["Configuración", "settings-2", "../templates/configuracion.html"]
	],
	cajero: [
		["Perfil", "user-round", "#perfil"], ["Mesa", "layout-grid", "../templates/mesas.html"],
		["Movimientos", "arrow-left-right", null], ["Caja", "wallet-cards", "../templates/caja.html"],
		["Categorías", "tags", "../templates/categorias.html"], ["Productos", "package", "../templates/productos.html"]
	]
};

function getHeaders(){
	return {"Authorization": `Bearer ${token}`};
}

function setUser(user){
	const role = user.role_name.toLowerCase() === "cajero" ? "cajero" : "admin";
	const availableModules = modules[role];
	const firstName = user.username || "Usuario";
	document.getElementById("userName").textContent = firstName;
	document.getElementById("userRole").textContent = user.role_name;
	document.getElementById("userAvatar").textContent = firstName.slice(0, 2).toUpperCase();
	document.getElementById("welcomeTitle").textContent = `Hola, ${firstName}`;
	document.getElementById("rolePill").textContent = user.role_name;
	document.getElementById("accessCount").textContent = availableModules.length;

	sideNav.innerHTML = availableModules.slice(0, 7).map(([name, icon, href], index) => `
		<a class="nav-item ${index === 0 ? "active" : ""} ${href ? "" : "disabled"}" href="${href || "#"}" ${href ? "" : "aria-disabled=\"true\""}>
			<i data-lucide="${icon}"></i><span>${name}</span>${href ? "" : "<small>Próximamente</small>"}
		</a>
	`).join("");

	moduleGrid.innerHTML = availableModules.map(([name, icon, href]) => `
		<a class="module-card ${href ? "" : "is-disabled"}" href="${href || "#"}" ${href ? "" : "aria-disabled=\"true\""}>
			<div class="module-card-icon"><i data-lucide="${icon}"></i></div>
			<div class="module-card-copy"><h3>${name}</h3><p>${href ? "Abrir módulo" : "Disponible próximamente"}</p></div>
			<i class="module-arrow" data-lucide="${href ? "arrow-up-right" : "lock-keyhole"}"></i>
		</a>
	`).join("");
	lucide.createIcons();
}

async function loadDashboard(){
	if(!token){ window.location.href = "../templates/login.html"; return; }
	try{
		const response = await fetch(`${API_URL}/auth/me`, {headers: getHeaders()});
		if(!response.ok) throw new Error("Sesión inválida");
		setUser(await response.json());
	}catch(error){
		localStorage.removeItem("access_token");
		window.location.href = "../templates/login.html";
	}
}

document.getElementById("currentDate").textContent = new Intl.DateTimeFormat("es-CO", {day: "numeric", month: "long", year: "numeric"}).format(new Date());
document.getElementById("logoutButton").addEventListener("click", () => { localStorage.clear(); window.location.href = "../templates/login.html"; });
document.getElementById("menuButton").addEventListener("click", () => { sidebar.classList.add("open"); mobileBackdrop.classList.add("visible"); });
mobileBackdrop.addEventListener("click", () => { sidebar.classList.remove("open"); mobileBackdrop.classList.remove("visible"); });
document.addEventListener("click", event => {
	const unavailableModule = event.target.closest("[aria-disabled='true']");
	if(!unavailableModule) return;
	event.preventDefault();
	dashboardToast.classList.add("visible");
	clearTimeout(toastTimeout);
	toastTimeout = setTimeout(() => dashboardToast.classList.remove("visible"), 3200);
});
loadDashboard();
