const MENU_API_URL = "http://127.0.0.1:8000";
const MENU_HTML_CACHE_KEY = "cabana_menu_html";
const MENU_USER_CACHE_KEY = "cabana_menu_user";
const menuModules = {
	admin: [
		["Perfil", "user-round", "/dashboard"], ["Caja", "wallet-cards", "/caja"],
		["Categorías", "tags", "/categorias"], ["Mesa", "layout-grid", "/mesas"],
		["Movimientos", "arrow-left-right", null], ["Productos", "package", "/productos"],
		["Ingredientes", "carrot", null], ["Proveedores", "truck", null], ["Empleados", "users-round", "/usuarios"],
		["Clientes", "contact-round", null], ["Estadística", "chart-no-axes-combined", "/reportes"],
		["Pedidos", "clipboard-list", "/pedidos"], ["Carta", "book-open", null],
		["Configuración", "settings", "/configuracion"]
	],
	cajero: [
		["Perfil", "user-round", "/dashboard"], ["Mesa", "layout-grid", "/mesas"],
		["Movimientos", "arrow-left-right", null], ["Caja", "wallet-cards", "/caja"],
		["Categorías", "tags", "/categorias"], ["Productos", "package", "/productos"]
	]
};

function renderMenu(user) {
	const role = user?.role_name?.toLowerCase() === "cajero" ? "cajero" : "admin";
	const sideNav = document.getElementById("sideNav");
	if (!sideNav) return;
	const currentPath = window.location.pathname;

	sideNav.innerHTML = menuModules[role].map(([name, icon, href]) => `
		<a class="nav-item ${href === currentPath ? "active" : ""} ${href ? "" : "is-coming-soon"}" href="${href || "#"}" ${href ? "" : "data-coming-soon=\"true\""}>
			<i data-lucide="${icon}"></i><span>${name}</span>${href ? "" : "<small>Próximamente</small>"}
		</a>
	`).join("");
	lucide.createIcons();
}

function initMenuEvents() {
	const logoutButton = document.getElementById("logoutButton");
	logoutButton?.addEventListener("click", () => {
		localStorage.clear();
		window.location.href = "/";
	});
}

function getCachedUser(token) {
	try {
		const cached = JSON.parse(sessionStorage.getItem(MENU_USER_CACHE_KEY) || "null");
		return cached?.token === token ? cached.user : null;
	} catch (error) {
		return null;
	}
}

function cacheUser(token, user) {
	sessionStorage.setItem(MENU_USER_CACHE_KEY, JSON.stringify({token, user}));
}

async function refreshUser(token) {
	const userResponse = await fetch(`${MENU_API_URL}/auth/me`, {
		headers: {"Authorization": `Bearer ${token}`},
		cache: "no-store"
	});
	const user = userResponse.ok ? await userResponse.json() : null;
	if (user) cacheUser(token, user);
	return user;
}

async function loadReusableMenu() {
	const container = document.getElementById("menu-container");
	if (!container) return;

	const cachedHtml = sessionStorage.getItem(MENU_HTML_CACHE_KEY);
	if (cachedHtml) {
		container.innerHTML = cachedHtml;
	} else {
		const response = await fetch("/static/components/menu.html");
		if (!response.ok) throw new Error("No se pudo cargar el menú");
		const html = await response.text();
		sessionStorage.setItem(MENU_HTML_CACHE_KEY, html);
		container.innerHTML = html;
	}
	initMenuEvents();
	lucide.createIcons();

	const token = localStorage.getItem("access_token");
	if (!token) {
		renderMenu();
		return;
	}

	const cachedUser = getCachedUser(token);
	if (cachedUser) renderMenu(cachedUser);

	try {
		renderMenu(await refreshUser(token));
	} catch (error) {
		if (!cachedUser) renderMenu();
	}
}

loadReusableMenu().catch(error => console.error(error));
