(function (global) {
	"use strict";

	const ROLES = ["Administrador", "Cajero", "Mesero", "Cocina", "Cliente"];

	const MENU_MODULES = {
		Administrador: [
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
			]],
			["Categorías", "tags", "/categorias"],
			["Movimientos", "arrow-left-right", "/movimientos"],
			["Productos", "package", null, [
				["Productos", "package", "/productos"],
				["Opciones de productos", "tags", "/opciones-productos"],
				["Ingredientes", "carrot", "/ingredientes"]
			]],
			["Estadística", "chart-no-axes-combined", "/reportes"],
			["Pedidos", "clipboard-list", "/pedidos"],
			["Carta", "book-open", "/carta"],
			["Configuración", "settings", "/configuracion"]
		],
		Cajero: [
			["Perfil", "user-round", "/perfil"],
			["Caja", "wallet-cards", null, [
				["Historial de cajas", "history", "/cajas"],
				["Caja actual", "wallet-cards", "/caja"],
				["Cerrar y abrir caja", "lock-keyhole", "/cierre-caja"]
			]],
			["Mesa", "layout-grid", null, [
				["Mesas", "layout-grid", "/mesas"],
				["Configuración de mesas", "qr-code", "/configuracion-mesas"]
			]],
			["Movimientos", "arrow-left-right", "/movimientos"],
			["Categorías", "tags", "/categorias"],
			["Productos", "package", null, [
				["Productos", "package", "/productos"],
				["Opciones de productos", "tags", "/opciones-productos"],
				["Ingredientes", "carrot", "/ingredientes"]
			]],
			["Carta", "book-open", "/carta"]
		],
		Mesero: [
			["Perfil", "user-round", "/perfil"],
			["Mesas", "layout-grid", "/mesas"],
			["Productos", "package", null, [
				["Productos", "package", "/productos"]
			]],
			["Carta", "book-open", "/carta"]
		],
		Cocina: [
			["Perfil", "user-round", "/perfil"],
			["Productos", "package", null, [
				["Productos", "package", "/productos"]
			]],
			["Pedidos", "clipboard-list", "/pedidos"],
			["Carta", "book-open", "/carta"]
		],
		Cliente: [
			["Perfil", "user-round", "/perfil"],
			["Carta", "book-open", "/carta"]
		]
	};

	const HOME_ROUTES = {
		Administrador: "/mesas",
		Cajero: "/mesas",
		Mesero: "/mesas",
		Cocina: "/pedidos",
		Cliente: "/carta"
	};

	function normalizePath(path) {
		const value = String(path || "/").split(/[?#]/)[0];
		return value.length > 1 ? value.replace(/\/+$/, "") : "/";
	}

	function getRole(user) {
		const role = user?.role_name;
		return ROLES.includes(role) ? role : null;
	}

	function getMenuModules(role) {
		return MENU_MODULES[role] || [];
	}

	function getAllowedPaths(role) {
		const paths = new Set();
		getMenuModules(role).forEach(([, , href, children]) => {
			if (href) paths.add(normalizePath(href));
			(children || []).forEach(([, , childHref]) => {
				if (childHref) paths.add(normalizePath(childHref));
			});
		});
		return paths;
	}

	function isPathAllowed(role, path) {
		if (!ROLES.includes(role)) return false;
		return getAllowedPaths(role).has(normalizePath(path));
	}

	function getHomeRoute(role) {
		return HOME_ROUTES[role] || "/";
	}

	global.CabanaPermissions = {
		ROLES,
		MENU_MODULES,
		HOME_ROUTES,
		normalizePath,
		getRole,
		getMenuModules,
		getAllowedPaths,
		isPathAllowed,
		getHomeRoute
	};
})(window);
