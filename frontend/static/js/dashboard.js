const API_URL = "http://127.0.0.1:8000";
const token = localStorage.getItem("access_token");
let sideNav;
let moduleGrid;
let sidebar;
let mobileBackdrop;
let dashboardToast;
let menuButton;
let logoutButton;
let toastTimeout;

const modules = {
	admin: [
		["Perfil", "user-round", "#perfil"], ["Caja", "wallet-cards", "/caja"],
		["Categorías", "tags", "/categorias"], ["Mesa", "layout-grid", "/mesas"],
		["Movimientos", "arrow-left-right", null], ["Productos", "package", "/productos"],
		["Proveedores", "truck", null], ["Empleados", "users-round", "/usuarios"],
		["Clientes", "contact-round", null], ["Estadística", "chart-no-axes-combined", "/reportes"],
		["Pedidos", "clipboard-list", "/pedidos"], ["Carta", "book-open", null],
		["Configuración", "settings-2", "/configuracion"]
	],
	cajero: [
		["Perfil", "user-round", "#perfil"], ["Mesa", "layout-grid", "/mesas"],
		["Movimientos", "arrow-left-right", null], ["Caja", "wallet-cards", "/caja"],
		["Categorías", "tags", "/categorias"], ["Productos", "package", "/productos"]
	]
};

function getHeaders(){
	return {"Authorization": `Bearer ${token}`};
}

function getDashboardElements(){
	sideNav = document.getElementById("sideNav");
	moduleGrid = document.getElementById("moduleGrid");
	sidebar = document.getElementById("sidebar");
	mobileBackdrop = document.getElementById("mobileBackdrop");
	dashboardToast = document.getElementById("dashboardToast");
	menuButton = document.getElementById("menuButton");
	logoutButton = document.getElementById("logoutButton");
}

function initSidebarEvents(){
	if(!menuButton || !mobileBackdrop || !sidebar || !logoutButton) return;
	menuButton.addEventListener("click", () => {
		sidebar.classList.add("open");
		mobileBackdrop.classList.add("visible");
	});
	mobileBackdrop.addEventListener("click", () => {
		sidebar.classList.remove("open");
		mobileBackdrop.classList.remove("visible");
	});
	logoutButton.addEventListener("click", () => {
		localStorage.clear();
		window.location.href = "/";
	});
}

function setUser(user){
	if(!sideNav || !moduleGrid) return;
	const role = user.role_name.toLowerCase() === "cajero" ? "cajero" : "admin";
	const availableModules = modules[role];
	const firstName = user.username || "Usuario";
	document.getElementById("userName").textContent = firstName;
	document.getElementById("userRole").textContent = user.role_name;
	document.getElementById("userAvatar").textContent = firstName.slice(0, 2).toUpperCase();
	document.getElementById("welcomeTitle").textContent = `Hola, ${firstName}`;
	document.getElementById("rolePill").textContent = user.role_name;
	document.getElementById("accessCount").textContent = availableModules.length;

	sideNav.innerHTML = availableModules.map(([name, icon, href], index) => `
		<a class="nav-item ${index === 0 ? "active" : ""} ${href ? "" : "is-coming-soon"}" href="${href || "#"}" ${href ? "" : "data-coming-soon=\"true\""}>
			<i data-lucide="${icon}"></i><span>${name}</span>${href ? "" : "<small>Próximamente</small>"}
		</a>
	`).join("");

	moduleGrid.innerHTML = availableModules.map(([name, icon, href]) => `
		<a class="module-card ${href ? "" : "is-coming-soon"}" href="${href || "#"}" ${href ? "" : "data-coming-soon=\"true\""}>
			<div class="module-card-icon"><i data-lucide="${icon}"></i></div>
			<div class="module-card-copy"><h3>${name}</h3><p>${href ? "Abrir módulo" : "Disponible próximamente"}</p></div>
			<i class="module-arrow" data-lucide="${href ? "arrow-up-right" : "lock-keyhole"}"></i>
		</a>
	`).join("");
	lucide.createIcons();
}

async function loadMenu(){
	const menuContainer = document.getElementById("menu-container");
	if(!menuContainer) return;
	try{
		const response = await fetch("/static/components/menu.html");
		if(!response.ok) throw new Error("No se pudo cargar el menú");
		menuContainer.innerHTML = await response.text();
		getDashboardElements();
		initSidebarEvents();
		lucide.createIcons();
	}catch(error){
		console.error(error);
	}
}

async function loadDashboard(){
	if(!token){ window.location.href = "/"; return; }
	try{
		const response = await fetch(`${API_URL}/auth/me`, {headers: getHeaders()});
		if(!response.ok) throw new Error("Sesión inválida");
		setUser(await response.json());
	}catch(error){
		localStorage.removeItem("access_token");
		window.location.href = "/";
	}
}

document.getElementById("currentDate").textContent = new Intl.DateTimeFormat("es-CO", {day: "numeric", month: "long", year: "numeric"}).format(new Date());

document.addEventListener("click", event => {
	const unavailableModule = event.target.closest("[data-coming-soon='true']");
	if(!unavailableModule) return;
	event.preventDefault();
	dashboardToast?.classList.add("visible");
	clearTimeout(toastTimeout);
	toastTimeout = setTimeout(() => dashboardToast?.classList.remove("visible"), 3200);
});

async function initDashboard(){
	await loadMenu();
	await loadDashboard();
}

initDashboard();
