const MENU_API_URL = "https://serviciocontigo.io/api";
const MENU_HTML_CACHE_KEY = "cabana_menu_html";
const MENU_USER_CACHE_KEY = "cabana_menu_user";
const menuModules = {
	admin: [
		["Persona", "users-round", null, [
			["Perfil", "user-round", "/perfil"],
			["Empleados", "users-round", "/usuarios"],
			["Clientes", "contact-round", "/clientes"]
		]],
		["Caja", "wallet-cards", null, [
			["Historial de cajas", "history", "/cajas"],
			["Caja actual", "wallet-cards", "/caja"],
			["Cerrar y abrir caja", "lock-keyhole", "/cierre-caja"]
		]],
		["Mesa", "layout-grid", null, [
			["Mesas", "layout-grid", "/mesas"],
			["Configuración de mesas", "qr-code", "/configuracion-mesas"]
		]], ["Categorías", "tags", "/categorias"],
		["Movimientos", "arrow-left-right", "/movimientos"],
		["Productos", "package", null, [
			["Productos", "package", "/productos"],
			["Opciones de productos", "tags", "/opciones-productos"],
			["Ingredientes", "carrot", "/ingredientes"]
		]],
		["Estadística", "chart-no-axes-combined", "/reportes"],
		["Pedidos", "clipboard-list", "/pedidos"], ["Carta", "book-open", "/carta"],
		["Configuración", "settings", "/configuracion"]
	],
	cajero: [
		["Perfil", "user-round", "/perfil"],
		["Caja", "wallet-cards", null, [
			["Historial de cajas", "history", "/cajas"],
			["Caja actual", "wallet-cards", "/caja"],
			["Cerrar y abrir caja", "lock-keyhole", "/cierre-caja"]
		]],
		["Mesa", "layout-grid", null, [
			["Mesas", "layout-grid", "/mesas"],
			["Configuración de mesas", "qr-code", "/configuracion-mesas"]
		]], ["Movimientos", "arrow-left-right", "/movimientos"],
		["Categorías", "tags", "/categorias"],
		["Productos", "package", null, [
			["Productos", "package", "/productos"],
			["Opciones de productos", "tags", "/opciones-productos"],
			["Ingredientes", "carrot", "/ingredientes"]
		]]
	]
};

function renderMenuItem([name, icon, href, children], currentPath) {
	if (children) {
		const isActive = children.some(([, , childHref]) => childHref === currentPath);
		return `
			<details class="nav-group">
				<summary class="nav-item ${isActive ? "active" : ""}" aria-label="${name}">
					<i data-lucide="${icon}"></i><span>${name}</span><i class="nav-chevron" data-lucide="chevron-down"></i>
				</summary>
				<div class="nav-dropdown">
					${children.map(([childName, childIcon, childHref]) => `
						<a class="nav-dropdown-item ${childHref === currentPath ? "active" : ""}" href="${childHref}">
							<i data-lucide="${childIcon}"></i><span>${childName}</span>
						</a>
					`).join("")}
				</div>
			</details>
		`;
	}

	return `
		<a class="nav-item ${href === currentPath ? "active" : ""} ${href ? "" : "is-coming-soon"}" href="${href || "#"}" ${href ? "" : "data-coming-soon=\"true\""}>
			<i data-lucide="${icon}"></i><span>${name}</span>${href ? "" : "<small>Próximamente</small>"}
		</a>
	`;
}

function positionOpenDropdown(group) {
	const summary = group.querySelector("summary");
	const dropdown = group.querySelector(".nav-dropdown");
	if (!summary || !dropdown) return;
	const bounds = summary.getBoundingClientRect();
	const left = Math.max(8, Math.min(bounds.left, window.innerWidth - dropdown.offsetWidth - 8));
	dropdown.style.top = `${bounds.bottom + 6}px`;
	dropdown.style.left = `${left}px`;
}

function renderMenu(user) {
	const role = user?.role_name?.toLowerCase() === "cajero" ? "cajero" : "admin";
	const sideNav = document.getElementById("sideNav");
	if (!sideNav) return;
	const currentPath = `${window.location.pathname}${window.location.hash}`;

	sideNav.innerHTML = menuModules[role].map(item => renderMenuItem(item, currentPath)).join("");
	sideNav.querySelectorAll(".nav-group").forEach(group => {
		group.addEventListener("toggle", () => {
			if (group.open) positionOpenDropdown(group);
		});
	});
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
