const API_URL = "http://127.0.0.1:8000";
const token = localStorage.getItem("access_token");
const MENU_HTML_CACHE_KEY = "cabana_menu_html";
const MENU_USER_CACHE_KEY = "cabana_menu_user";
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
		["Perfil", "user-round", "/dashboard"], ["Caja", "wallet-cards", "/caja"],
		["Categorías", "tags", "/categorias"], ["Mesa", "layout-grid", "/mesas"],
		["Movimientos", "arrow-left-right", null], ["Productos", "package", "/productos"],
		["Proveedores", "truck", null], ["Empleados", "users-round", "/usuarios"],
		["Clientes", "contact-round", null], ["Estadística", "chart-no-axes-combined", "/reportes"],
		["Pedidos", "clipboard-list", "/pedidos"], ["Carta", "book-open", null],
		["Configuración", "settings-2", "/configuracion"]
	],
	cajero: [
		["Perfil", "user-round", "/dashboard"], ["Mesa", "layout-grid", "/mesas"],
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
	if(!sideNav || !user) return;
	const role = user.role_name.toLowerCase() === "cajero" ? "cajero" : "admin";
	const availableModules = modules[role];
	const firstName = user.username || "Usuario";
	const currentPath = window.location.pathname;
	document.getElementById("userName").textContent = firstName;
	document.getElementById("userRole").textContent = user.role_name;
	document.getElementById("userAvatar").textContent = firstName.slice(0, 2).toUpperCase();
	document.getElementById("welcomeTitle").textContent = `Hola, ${firstName}`;
	document.getElementById("accessCount").textContent = availableModules.length;

	sideNav.innerHTML = availableModules.map(([name, icon, href]) => `
		<a class="nav-item ${href === currentPath ? "active" : ""} ${href ? "" : "is-coming-soon"}" href="${href || "#"}" ${href ? "" : "data-coming-soon=\"true\""}>
			<i data-lucide="${icon}"></i><span>${name}</span>${href ? "" : "<small>Próximamente</small>"}
		</a>
	`).join("");

	lucide.createIcons();
}

async function loadMenu(){
	const menuContainer = document.getElementById("menu-container");
	if(!menuContainer) return;
	try{
		const cachedHtml = sessionStorage.getItem(MENU_HTML_CACHE_KEY);
		if (cachedHtml) {
			menuContainer.innerHTML = cachedHtml;
		} else {
			const response = await fetch("/static/components/menu.html");
			if(!response.ok) throw new Error("No se pudo cargar el menú");
			const html = await response.text();
			sessionStorage.setItem(MENU_HTML_CACHE_KEY, html);
			menuContainer.innerHTML = html;
		}
		getDashboardElements();
		initSidebarEvents();
		lucide.createIcons();
	}catch(error){
		console.error(error);
	}
}

async function loadDashboard(){
	if(!token){ window.location.href = "/"; return; }
	try {
		const cached = JSON.parse(sessionStorage.getItem(MENU_USER_CACHE_KEY) || "null");
		if (cached?.token === token) setUser(cached.user);
	} catch (error) {
		console.warn("No se pudo leer la sesión guardada.");
	}
	try{
		const response = await fetch(`${API_URL}/auth/me`, {headers: getHeaders()});
		if(!response.ok) throw new Error("Sesión inválida");
		const user = await response.json();
		sessionStorage.setItem(MENU_USER_CACHE_KEY, JSON.stringify({token, user}));
		setUser(user);
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
