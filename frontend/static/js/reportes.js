const REPORTES_API_URL = "https://serviciocontigo.io/api";
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const PERIOD_LABELS = { all: "Todo", week: "Semana", month: "Mes", year: "Año" };

let reportesData = { movimientos: [], productos: [], categorias: [], consumos: [] };
let selectedPeriod = "all";
let reportesLoaded = false;

const reportesElements = {
    loading: document.getElementById("statisticsLoading"),
    message: document.getElementById("statisticsMessage"),
    content: document.getElementById("statisticsContent"),
    subtitle: document.getElementById("statisticsSubtitle"),
    periodNote: document.getElementById("statisticsPeriodNote"),
    refresh: document.getElementById("statisticsRefresh")
};

function reportesNumber(value) {
    const number = Number(value ?? 0);
    return Number.isFinite(number) ? number : 0;
}

function reportesMoney(value) {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0
    }).format(reportesNumber(value));
}

function reportesHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("access_token") || ""}`
    };
}

async function reportesRequest(path) {
    const response = await fetch(`${REPORTES_API_URL}${path}`, { headers: reportesHeaders() });
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
        throw new Error(typeof detail === "string" ? detail : "No fue posible cargar las estadísticas.");
    }
    return data;
}

function reportesStartOfDay(date) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
}

function reportesDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function reportesEscape(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function reportesQuantity(value) {
    return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(value);
}

function reportesDateLabel(date) {
    return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short" }).replace(".", "");
}

function reportesMonthLabel(date) {
    return date.toLocaleDateString("es-CO", { month: "short" }).replace(".", "");
}

function reportesComputeStatistics() {
    const today = reportesStartOfDay(new Date());
    const uniqueMovimientos = new Map();
    reportesData.movimientos.forEach((item) => uniqueMovimientos.set(item.id, item));

    const datedMovimientos = Array.from(uniqueMovimientos.values())
        .filter((item) => item.estado !== false && reportesNumber(item.total) > 0 && item.fecha_hora)
        .flatMap((item) => {
            const date = new Date(item.fecha_hora);
            return Number.isNaN(date.getTime()) ? [] : [{ item, date }];
        });

    const firstMovement = datedMovimientos.reduce((earliest, movement) => {
        const day = reportesStartOfDay(movement.date);
        return earliest === null || day < earliest ? day : earliest;
    }, null);

    const currentStart = new Date(today);
    if (selectedPeriod === "week") {
        currentStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    } else if (selectedPeriod === "month") {
        currentStart.setDate(1);
    } else if (selectedPeriod === "year") {
        currentStart.setMonth(0, 1);
    } else if (firstMovement) {
        currentStart.setTime(firstMovement.getTime());
    }

    const currentEnd = new Date(today);
    currentEnd.setDate(today.getDate() + 1);
    const elapsedDays = Math.max(1, Math.round((currentEnd.getTime() - currentStart.getTime()) / MILLISECONDS_PER_DAY));
    const previousStart = new Date(currentStart);
    if (selectedPeriod === "week") {
        previousStart.setDate(previousStart.getDate() - 7);
    } else if (selectedPeriod === "month") {
        previousStart.setMonth(previousStart.getMonth() - 1, 1);
    } else if (selectedPeriod === "year") {
        previousStart.setFullYear(previousStart.getFullYear() - 1);
    } else {
        previousStart.setDate(previousStart.getDate() - elapsedDays);
    }
    const previousEnd = new Date(previousStart);
    previousEnd.setDate(previousEnd.getDate() + elapsedDays);

    const currentMovimientos = datedMovimientos.filter(({ date }) => date >= currentStart && date < currentEnd);
    const previousMovimientos = datedMovimientos.filter(({ date }) => date >= previousStart && date < previousEnd);
    const currentMovementIds = new Set(currentMovimientos.map(({ item }) => item.id));
    const totalIngresos = currentMovimientos.reduce((sum, { item }) => sum + reportesNumber(item.total), 0);
    const previousIngresos = previousMovimientos.reduce((sum, { item }) => sum + reportesNumber(item.total), 0);
    const averageSale = currentMovimientos.length ? totalIngresos / currentMovimientos.length : 0;
    const growth = previousIngresos > 0
        ? ((totalIngresos - previousIngresos) / previousIngresos) * 100
        : totalIngresos > 0 ? null : 0;

    const chartInterval = selectedPeriod === "year" ? "month" : selectedPeriod === "all" ? "year" : "day";
    const chartStart = new Date(currentStart);
    if (chartInterval === "month") chartStart.setDate(1);
    if (chartInterval === "year") chartStart.setMonth(0, 1);

    const chartBuckets = new Map();
    const chartDate = new Date(chartStart);
    while (chartDate < currentEnd) {
        const key = chartInterval === "day"
            ? reportesDateKey(chartDate)
            : chartInterval === "month"
                ? `${chartDate.getFullYear()}-${String(chartDate.getMonth() + 1).padStart(2, "0")}`
                : String(chartDate.getFullYear());
        chartBuckets.set(key, { date: new Date(chartDate), revenue: 0, count: 0 });
        if (chartInterval === "day") chartDate.setDate(chartDate.getDate() + 1);
        else if (chartInterval === "month") chartDate.setMonth(chartDate.getMonth() + 1);
        else chartDate.setFullYear(chartDate.getFullYear() + 1);
    }

    currentMovimientos.forEach(({ item, date }) => {
        const key = chartInterval === "day"
            ? reportesDateKey(date)
            : chartInterval === "month"
                ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
                : String(date.getFullYear());
        const bucket = chartBuckets.get(key);
        if (bucket) {
            bucket.revenue += reportesNumber(item.total);
            bucket.count += 1;
        }
    });

    const chartRows = Array.from(chartBuckets, ([key, bucket]) => ({
        key,
        label: chartInterval === "day"
            ? reportesDateLabel(bucket.date)
            : chartInterval === "month"
                ? reportesMonthLabel(bucket.date)
                : String(bucket.date.getFullYear()),
        average: bucket.count ? bucket.revenue / bucket.count : 0
    }));

    const productsById = new Map(reportesData.productos.map((item) => [item.id, item]));
    const categoryNames = new Map(reportesData.categorias.map((item) => [item.id, item.nombre]));
    const categoryStats = new Map();
    const topProducts = new Map();

    reportesData.consumos.forEach((consumo) => {
        if (!consumo.id_mov || !currentMovementIds.has(consumo.id_mov) || !consumo.id_producto) return;
        const product = productsById.get(consumo.id_producto);
        if (!product) return;

        const quantity = Math.max(0, reportesNumber(consumo.cantidad));
        const productName = product.nombre || "Producto sin nombre";
        const preparationType = product.preparacion === true ? "preparable" : "no-preparable";
        const typeProducts = topProducts.get(preparationType) || new Map();
        const topProduct = typeProducts.get(product.id) || { nombre: productName, cantidad: 0 };
        topProduct.cantidad += quantity;
        typeProducts.set(product.id, topProduct);
        topProducts.set(preparationType, typeProducts);

        if (!product.id_categoria) return;
        const category = categoryStats.get(product.id_categoria) || { ingresos: 0, products: new Map() };
        category.ingresos += Math.max(0, reportesNumber(consumo.subtotal));
        const categoryProduct = category.products.get(product.id) || { nombre: productName, cantidad: 0 };
        categoryProduct.cantidad += quantity;
        category.products.set(product.id, categoryProduct);
        categoryStats.set(product.id_categoria, category);
    });

    const categoryRows = Array.from(categoryStats, ([id, category]) => {
        const bestProduct = Array.from(category.products.values())
            .sort((first, second) => second.cantidad - first.cantidad)[0];
        return {
            id,
            nombre: categoryNames.get(id) || "Sin categoría",
            ingresos: category.ingresos,
            porcentaje: totalIngresos > 0 ? (category.ingresos / totalIngresos) * 100 : 0,
            productoMasVendido: bestProduct?.nombre || "Sin ventas",
            cantidadVendida: bestProduct?.cantidad || 0
        };
    });

    const categoriesWithSales = new Set(categoryRows.map((item) => item.id));
    reportesData.categorias.forEach((category) => {
        if (!categoriesWithSales.has(category.id)) {
            categoryRows.push({
                id: category.id,
                nombre: category.nombre,
                ingresos: 0,
                porcentaje: 0,
                productoMasVendido: "Sin ventas",
                cantidadVendida: 0
            });
        }
    });
    categoryRows.sort((first, second) => second.ingresos - first.ingresos);

    const bestProduct = (type) => Array.from(topProducts.get(type)?.values() || [])
        .sort((first, second) => second.cantidad - first.cantidad)[0] || null;

    return {
        totalIngresos,
        averageSale,
        dailyAverage: totalIngresos / elapsedDays,
        growth,
        salesCount: currentMovimientos.length,
        elapsedDays,
        chartRows,
        categoryRows,
        topPreparable: bestProduct("preparable"),
        topNonPreparable: bestProduct("no-preparable")
    };
}

function renderStatistics() {
    const statistics = reportesComputeStatistics();
    const periodLabel = PERIOD_LABELS[selectedPeriod].toLowerCase();
    const growthElement = document.getElementById("metricGrowth");
    const isPositive = statistics.growth === null || statistics.growth >= 0;

    document.getElementById("metricRevenue").textContent = reportesMoney(statistics.totalIngresos);
    document.getElementById("metricSalesCount").textContent = `${statistics.salesCount} ${statistics.salesCount === 1 ? "venta registrada" : "ventas registradas"}`;
    document.getElementById("metricAverageSale").textContent = reportesMoney(statistics.averageSale);
    document.getElementById("metricDailyAverage").textContent = reportesMoney(statistics.dailyAverage);
    document.getElementById("metricDailyHint").textContent = `Promedio diario · ${periodLabel}`;
    growthElement.textContent = statistics.growth === null
        ? "Nuevo"
        : `${statistics.growth > 0 ? "+" : ""}${statistics.growth.toFixed(1)}%`;
    growthElement.classList.toggle("growth-negative", !isPositive);
    const growthMetric = growthElement.closest(".statistics-metric");
    document.getElementById("growthIconContainer").innerHTML = `<i data-lucide="${isPositive ? "trending-up" : "trending-down"}"></i>`;
    growthMetric.classList.toggle("metric-negative", !isPositive);
    reportesElements.subtitle.textContent = selectedPeriod === "all" ? "Histórico completo" : `Periodo: ${periodLabel}`;

    document.getElementById("chartTitle").textContent = selectedPeriod === "year"
        ? "Promedio de venta por mes"
        : selectedPeriod === "all" ? "Promedio de venta por año" : "Promedio de venta por día";
    document.getElementById("chartSubtitle").textContent = selectedPeriod === "year"
        ? "Promedio de cada venta en cada mes del año"
        : selectedPeriod === "all" ? "Promedio de cada venta por año" : "Promedio de cada venta en cada día";
    document.getElementById("chartUnit").textContent = selectedPeriod === "year" ? "MESES" : selectedPeriod === "all" ? "AÑOS" : "DÍAS";
    reportesElements.periodNote.textContent = `${statistics.elapsedDays} ${statistics.elapsedDays === 1 ? "día analizado" : "días analizados"}`;

    renderStatisticsChart(statistics.chartRows);
    renderCategoryRevenue(statistics.categoryRows);
    renderTopProducts(statistics.topPreparable, statistics.topNonPreparable);
    renderCategoryLeaders(statistics.categoryRows);
    document.getElementById("statisticsFootnote").textContent = `Ingresos del periodo: ${reportesMoney(statistics.totalIngresos)}`;
    reportesElements.content.hidden = false;
    if (window.lucide) window.lucide.createIcons();
}

function renderStatisticsChart(rows) {
    const chart = document.getElementById("statisticsChart");
    chart.replaceChildren();
    const maxAverage = Math.max(...rows.map((item) => item.average), 0);
    chart.classList.toggle("chart-empty", maxAverage === 0);

    rows.forEach((item) => {
        const column = document.createElement("div");
        column.className = "chart-column";
        const amount = document.createElement("span");
        amount.className = "chart-value";
        amount.textContent = item.average > 0 ? reportesMoney(item.average) : "—";
        const barArea = document.createElement("div");
        barArea.className = "chart-bar-area";
        const bar = document.createElement("div");
        bar.className = "chart-bar";
        const height = maxAverage > 0 ? Math.max(4, (item.average / maxAverage) * 100) : 0;
        bar.style.height = `${height}%`;
        if (item.average > 0) bar.title = `${item.label}: ${reportesMoney(item.average)}`;
        barArea.append(bar);
        const label = document.createElement("span");
        label.className = "chart-label";
        label.textContent = item.label;
        column.setAttribute("aria-label", `${item.label}: ${reportesMoney(item.average)}`);
        column.append(amount, barArea, label);
        chart.append(column);
    });
}

function renderCategoryRevenue(rows) {
    const container = document.getElementById("categoryRevenueList");
    if (!rows.length) {
        container.innerHTML = '<p class="statistics-empty">No hay categorías registradas.</p>';
        return;
    }

    container.innerHTML = rows.map((item) => {
        const width = Math.min(Math.max(item.porcentaje, 0), 100);
        return `
            <article class="category-revenue">
                <div class="category-revenue-heading">
                    <strong>${reportesEscape(item.nombre)}</strong>
                    <span>${item.porcentaje.toFixed(1)}%</span>
                </div>
                <div class="category-progress"><span style="width:${width}%"></span></div>
                <small>${reportesMoney(item.ingresos)}</small>
            </article>`;
    }).join("");
}

function renderTopProducts(preparable, nonPreparable) {
    const container = document.getElementById("topProducts");
    const entries = [
        { label: "PREPARABLE", item: preparable, icon: "chef-hat" },
        { label: "NO PREPARABLE", item: nonPreparable, icon: "package" }
    ];
    container.innerHTML = entries.map(({ label, item, icon }) => `
        <article class="top-product-card">
            <span class="top-product-icon"><i data-lucide="${icon}"></i></span>
            <div class="top-product-copy">
                <span class="top-product-type">${label}</span>
                <strong>${reportesEscape(item?.nombre || "Sin ventas")}</strong>
                <small>${item ? `${reportesQuantity(item.cantidad)} unidades` : "—"}</small>
            </div>
        </article>`).join("");
}

function renderCategoryLeaders(rows) {
    const table = document.getElementById("categoryLeadersTable");
    if (!rows.length) {
        table.innerHTML = '<tr><td class="statistics-empty-cell" colspan="5">No hay productos vendidos por categoría en este periodo.</td></tr>';
        return;
    }

    table.innerHTML = rows.map((item) => `
        <tr>
            <td><span class="category-name-cell">${reportesEscape(item.nombre)}</span></td>
            <td>${reportesEscape(item.productoMasVendido)}</td>
            <td>${reportesQuantity(item.cantidadVendida)}</td>
            <td>${reportesMoney(item.ingresos)}</td>
            <td><span class="share-pill">${item.porcentaje.toFixed(1)}%</span></td>
        </tr>`).join("");
}

async function loadReportes() {
    if (!localStorage.getItem("access_token")) {
        reportesLoaded = false;
        reportesElements.loading.hidden = true;
        reportesElements.content.hidden = true;
        reportesElements.message.textContent = "Inicia sesión para consultar las estadísticas.";
        return;
    }

    reportesLoaded = false;
    reportesElements.loading.hidden = false;
    reportesElements.content.hidden = true;
    reportesElements.message.textContent = "";
    reportesElements.refresh.disabled = true;

    try {
        const [movimientos, productos, categorias, consumos] = await Promise.all([
            reportesRequest("/movimientos/"),
            reportesRequest("/productos/"),
            reportesRequest("/categorias/"),
            reportesRequest("/mesasC/")
        ]);
        reportesData = { movimientos, productos, categorias, consumos };
        reportesLoaded = true;
        renderStatistics();
    } catch (error) {
        reportesElements.message.textContent = error instanceof Error
            ? error.message
            : "No fue posible cargar las estadísticas.";
    } finally {
        reportesElements.loading.hidden = true;
        reportesElements.refresh.disabled = false;
    }
}

document.querySelectorAll(".period-selector button").forEach((button) => {
    button.addEventListener("click", () => {
        selectedPeriod = button.dataset.period;
        document.querySelectorAll(".period-selector button").forEach((option) => {
            option.setAttribute("aria-pressed", String(option === button));
        });
        if (reportesLoaded) renderStatistics();
    });
});

reportesElements.refresh.addEventListener("click", loadReportes);
loadReportes();
