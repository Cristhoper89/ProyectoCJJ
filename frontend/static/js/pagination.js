/* ======================================================
   PAGINACIÓN GENERAL DE TABLAS
   Aplica botones numerados (1, 2, 3...) a todas las tablas
   que tengan un <tbody>. Se actualiza automáticamente cuando
   las filas cambian (búsquedas, filtros o nuevos registros).
====================================================== */

(function () {
    "use strict";

    const DEFAULT_PAGE_SIZE = 10;
    const states = new WeakMap();


    // ======================================================
    // CONFIGURACIÓN Y FILAS
    // ======================================================

    function getPageSize(table) {

        const value = Number.parseInt(table.dataset.pageSize, 10);

        return Number.isFinite(value) && value > 0 ? value : DEFAULT_PAGE_SIZE;

    }


    function isPlaceholderRow(row) {

        if (row.dataset.paginationPlaceholder === "true") {
            return true;
        }

        if (row.classList.contains("loading")) {
            return true;
        }

        return row.cells.length === 1 && row.cells[0].hasAttribute("colspan");

    }


    function getDataRows(tbody) {

        return Array.from(tbody.rows).filter(function (row) {
            return !isPlaceholderRow(row);
        });

    }


    // El contenedor con scroll horizontal no debe recortar la paginación,
    // por eso se inserta justo después de la tabla o de su wrapper.
    function getAnchors(table) {

        const wrapper = table.closest(
            ".table-container, [class*='-table-wrap'], [class*='table-container']"
        );

        return wrapper || table;

    }


    // ======================================================
    // CONTROLES
    // ======================================================

    function createControls() {

        const nav = document.createElement("nav");

        nav.className = "table-pagination";
        nav.setAttribute("aria-label", "Paginación de la tabla");
        nav.hidden = true;

        nav.innerHTML = `
            <span class="table-pagination-info" data-pagination-info></span>
            <div class="table-pagination-pages" data-pagination-pages></div>
        `;

        return nav;

    }


    function createPageButton(page, currentPage) {

        const button = document.createElement("button");

        button.type = "button";
        button.dataset.page = String(page);
        button.textContent = String(page);
        button.className = "pagination-page";

        if (page === currentPage) {
            button.classList.add("is-active");
            button.setAttribute("aria-current", "page");
        }

        button.setAttribute("aria-label", `Página ${page}`);

        return button;

    }


    function createArrowButton(label, targetPage, disabled) {

        const button = document.createElement("button");

        button.type = "button";
        button.dataset.page = String(targetPage);
        button.className = "pagination-arrow";
        button.textContent = label;
        button.disabled = disabled;

        return button;

    }


    function createEllipsis() {

        const span = document.createElement("span");

        span.className = "pagination-ellipsis";
        span.setAttribute("aria-hidden", "true");
        span.textContent = "…";

        return span;

    }


    function getPageItems(currentPage, totalPages) {

        if (totalPages <= 7) {

            return Array.from({ length: totalPages }, function (_, index) {
                return index + 1;
            });

        }

        const pages = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);

        if (currentPage <= 3) {
            pages.add(2);
            pages.add(3);
            pages.add(4);
        }

        if (currentPage >= totalPages - 2) {
            pages.add(totalPages - 1);
            pages.add(totalPages - 2);
            pages.add(totalPages - 3);
        }

        const sorted = Array.from(pages)
            .filter(function (page) {
                return page >= 1 && page <= totalPages;
            })
            .sort(function (a, b) {
                return a - b;
            });

        const items = [];
        let previous = 0;

        sorted.forEach(function (page) {

            if (page - previous > 1) {
                items.push("ellipsis");
            }

            items.push(page);
            previous = page;

        });

        return items;

    }


    function renderControls(state, totalRows, totalPages, start, end) {

        const controls = state.controls;
        const pagesContainer = controls.querySelector("[data-pagination-pages]");
        const info = controls.querySelector("[data-pagination-info]");

        if (totalPages <= 1) {

            controls.hidden = true;
            pagesContainer.innerHTML = "";
            info.textContent = "";

            return;

        }

        const from = start + 1;
        const to = Math.min(end, totalRows);

        info.textContent = `Mostrando ${from}–${to} de ${totalRows} registros`;

        pagesContainer.innerHTML = "";

        pagesContainer.appendChild(
            createArrowButton("‹", state.page - 1, state.page === 1)
        );

        getPageItems(state.page, totalPages).forEach(function (item) {

            if (item === "ellipsis") {
                pagesContainer.appendChild(createEllipsis());
                return;
            }

            pagesContainer.appendChild(createPageButton(item, state.page));

        });

        pagesContainer.appendChild(
            createArrowButton("›", state.page + 1, state.page === totalPages)
        );

        controls.hidden = false;

    }


    // ======================================================
    // APLICAR PAGINACIÓN
    // ======================================================

    function applyPagination(state) {

        const pageSize = getPageSize(state.table);
        const rows = getDataRows(state.tbody);
        const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

        state.page = Math.min(Math.max(state.page, 1), totalPages);

        const start = (state.page - 1) * pageSize;
        const end = start + pageSize;

        Array.from(state.tbody.rows).forEach(function (row) {

            if (isPlaceholderRow(row)) {
                row.removeAttribute("data-pagination-hidden");
            }

        });

        rows.forEach(function (row, index) {

            if (index >= start && index < end) {
                row.removeAttribute("data-pagination-hidden");
                return;
            }

            row.setAttribute("data-pagination-hidden", "true");

        });

        renderControls(state, rows.length, totalPages, start, end);

    }


    // ======================================================
    // INICIALIZAR TABLA
    // ======================================================

    function initTable(table) {

        if (states.has(table) || table.dataset.pagination === "off") {
            return;
        }

        const tbody = table.tBodies && table.tBodies[0];

        if (!tbody) {
            return;
        }

        const anchor = getAnchors(table);
        const controls = createControls();

        anchor.insertAdjacentElement("afterend", controls);

        const state = {
            table: table,
            tbody: tbody,
            controls: controls,
            page: 1,
            frame: 0
        };

        states.set(table, state);

        controls.addEventListener("click", function (event) {

            const button = event.target.closest("button[data-page]");

            if (!button || button.disabled) {
                return;
            }

            const targetPage = Number(button.dataset.page);

            if (!Number.isInteger(targetPage) || targetPage === state.page) {
                return;
            }

            state.page = targetPage;
            applyPagination(state);

            const activePage = controls.querySelector("button.is-active");

            if (activePage) {
                activePage.focus({ preventScroll: true });
            }

        });

        const observer = new MutationObserver(function () {

            if (state.frame) {
                return;
            }

            state.frame = requestAnimationFrame(function () {

                state.frame = 0;
                applyPagination(state);

            });

        });

        observer.observe(tbody, { childList: true });

        applyPagination(state);

    }


    function initAll() {

        document.querySelectorAll("table").forEach(initTable);

    }


    if (document.readyState === "loading") {

        document.addEventListener("DOMContentLoaded", initAll, { once: true });

    } else {

        initAll();

    }

})();
