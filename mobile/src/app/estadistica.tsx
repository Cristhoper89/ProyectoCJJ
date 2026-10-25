import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RefreshCw, TrendingDown, TrendingUp } from 'lucide-react-native';
import HeaderNavbar from '../components/HeaderNavbar';
import { apiRequest, getAccessToken } from '../constants/api';

type Movimiento = {
  id: number;
  estado?: boolean | null;
  total?: number | string | null;
  fecha_hora?: string | null;
};

type Producto = {
  id: number;
  nombre?: string | null;
  id_categoria?: number | null;
  preparacion?: boolean | null;
};

type Categoria = {
  id: number;
  nombre: string;
};

type Consumo = {
  id: number;
  id_mov?: number | null;
  id_producto?: number | null;
  cantidad?: number | null;
  subtotal?: number | string | null;
};

type VentaDiaria = {
  key: string;
  label: string;
  promedio: number;
};

type CategoriaEstadistica = {
  id: number;
  nombre: string;
  ingresos: number;
  porcentaje: number;
  productoMasVendido: string;
  cantidadVendida: number;
};

type Periodo = 'all' | 'week' | 'month' | 'year';

const periodOptions: { key: Periodo; label: string }[] = [
  { key: 'all', label: 'Todo' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
  { key: 'year', label: 'Año' },
];

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const numberValue = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: number) => `$${Math.round(value).toLocaleString('es-CO')}`;

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfDay = (date: Date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

const dateLabel = (date: Date) => date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }).replace('.', '');

const monthLabel = (date: Date) => date.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '');

export default function EstadisticaScreen() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [consumos, setConsumos] = useState<Consumo[]>([]);
  const [periodo, setPeriodo] = useState<Periodo>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!getAccessToken()) {
      setError('Inicia sesión para consultar las estadísticas.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [movimientosData, productosData, categoriasData, consumosData] = await Promise.all([
        apiRequest<Movimiento[]>('/movimientos/'),
        apiRequest<Producto[]>('/productos/'),
        apiRequest<Categoria[]>('/categorias/'),
        apiRequest<Consumo[]>('/mesasC/'),
      ]);

      const uniqueMovimientos = new Map<number, Movimiento>();
      movimientosData.forEach((item) => uniqueMovimientos.set(item.id, item));
      setMovimientos(Array.from(uniqueMovimientos.values()));
      setProductos(productosData);
      setCategorias(categoriasData);
      setConsumos(consumosData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No fue posible cargar las estadísticas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const statistics = useMemo(() => {
    const today = startOfDay(new Date());
    const validMovimientos = movimientos.filter((item) => item.estado !== false && numberValue(item.total) > 0);
    const datedMovimientos = validMovimientos.flatMap((item) => {
      if (!item.fecha_hora) return [];
      const date = new Date(item.fecha_hora);
      return Number.isNaN(date.getTime()) ? [] : [{ item, date }];
    });
    const firstMovement = datedMovimientos.reduce<Date | null>((earliest, movement) => {
      const day = startOfDay(movement.date);
      return earliest === null || day < earliest ? day : earliest;
    }, null);

    const currentStart = new Date(today);
    if (periodo === 'week') {
      const daysSinceMonday = (today.getDay() + 6) % 7;
      currentStart.setDate(today.getDate() - daysSinceMonday);
    } else if (periodo === 'month') {
      currentStart.setDate(1);
    } else if (periodo === 'year') {
      currentStart.setMonth(0, 1);
    } else if (firstMovement) {
      currentStart.setTime(firstMovement.getTime());
    }

    const currentEnd = new Date(today);
    currentEnd.setDate(today.getDate() + 1);
    const elapsedDays = Math.max(1, Math.round((currentEnd.getTime() - currentStart.getTime()) / MILLISECONDS_PER_DAY));
    const previousStart = new Date(currentStart);
    if (periodo === 'week') {
      previousStart.setDate(previousStart.getDate() - 7);
    } else if (periodo === 'month') {
      previousStart.setMonth(previousStart.getMonth() - 1, 1);
    } else if (periodo === 'year') {
      previousStart.setFullYear(previousStart.getFullYear() - 1);
    } else {
      previousStart.setDate(previousStart.getDate() - elapsedDays);
    }
    const previousEnd = new Date(previousStart);
    previousEnd.setDate(previousEnd.getDate() + elapsedDays);

    const currentMovimientos = datedMovimientos
      .filter(({ date }) => date >= currentStart && date < currentEnd)
      .map(({ item }) => item);
    const previousMovimientos = datedMovimientos
      .filter(({ date }) => date >= previousStart && date < previousEnd)
      .map(({ item }) => item);
    const currentMovementIds = new Set(currentMovimientos.map((item) => item.id));

    const totalIngresos = currentMovimientos.reduce((sum, item) => sum + numberValue(item.total), 0);
    const previousIngresos = previousMovimientos.reduce((sum, item) => sum + numberValue(item.total), 0);
    const promedioVenta = currentMovimientos.length > 0 ? totalIngresos / currentMovimientos.length : 0;
    const crecimiento = previousIngresos > 0
      ? ((totalIngresos - previousIngresos) / previousIngresos) * 100
      : totalIngresos > 0 ? null : 0;

    const chartInterval: 'day' | 'month' | 'year' = periodo === 'year' ? 'month' : periodo === 'all' ? 'year' : 'day';
    const chartStart = new Date(currentStart);
    if (chartInterval === 'month') chartStart.setDate(1);
    if (chartInterval === 'year') chartStart.setMonth(0, 1);
    const chartBuckets = new Map<string, { fecha: Date; ingresos: number; cantidad: number }>();
    const chartDate = new Date(chartStart);
    while (chartDate < currentEnd) {
      const key = chartInterval === 'day'
        ? dateKey(chartDate)
        : chartInterval === 'month'
          ? `${chartDate.getFullYear()}-${String(chartDate.getMonth() + 1).padStart(2, '0')}`
          : String(chartDate.getFullYear());
      chartBuckets.set(key, { fecha: new Date(chartDate), ingresos: 0, cantidad: 0 });
      if (chartInterval === 'day') chartDate.setDate(chartDate.getDate() + 1);
      else if (chartInterval === 'month') chartDate.setMonth(chartDate.getMonth() + 1);
      else chartDate.setFullYear(chartDate.getFullYear() + 1);
    }

    datedMovimientos.forEach(({ item, date }) => {
      if (!currentMovementIds.has(item.id)) return;
      const key = chartInterval === 'day'
        ? dateKey(date)
        : chartInterval === 'month'
          ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          : String(date.getFullYear());
      const bucket = chartBuckets.get(key);
      if (bucket) {
        bucket.ingresos += numberValue(item.total);
        bucket.cantidad += 1;
      }
    });

    const ventasDiarias: VentaDiaria[] = Array.from(chartBuckets, ([key, bucket]) => {
      const label = chartInterval === 'day'
        ? dateLabel(bucket.fecha)
        : chartInterval === 'month'
          ? monthLabel(bucket.fecha)
          : String(bucket.fecha.getFullYear());
      return {
        key,
        label,
        promedio: bucket.cantidad > 0 ? bucket.ingresos / bucket.cantidad : 0,
      };
    });

    const productsById = new Map(productos.map((item) => [item.id, item]));
    const categoryNames = new Map(categorias.map((item) => [item.id, item.nombre]));
    const categoryStats = new Map<number, {
      ingresos: number;
      products: Map<number, { nombre: string; cantidad: number }>;
    }>();
    const topProducts = new Map<number, Map<number, { nombre: string; cantidad: number }>>();

    consumos.forEach((consumo) => {
      if (!consumo.id_mov || !currentMovementIds.has(consumo.id_mov) || !consumo.id_producto) return;
      const product = productsById.get(consumo.id_producto);
      if (!product) return;

      const quantity = Math.max(0, numberValue(consumo.cantidad));
      const productName = product.nombre || 'Producto sin nombre';
      const preparationType = product.preparacion === true ? 1 : 0;
      const typeProducts = topProducts.get(preparationType) || new Map();
      const topProduct = typeProducts.get(product.id) || { nombre: productName, cantidad: 0 };
      topProduct.cantidad += quantity;
      typeProducts.set(product.id, topProduct);
      if (!topProducts.has(preparationType)) {
        topProducts.set(preparationType, typeProducts);
      }

      if (!product.id_categoria) return;
      const category = categoryStats.get(product.id_categoria) || { ingresos: 0, products: new Map() };
      category.ingresos += Math.max(0, numberValue(consumo.subtotal));
      const categoryProduct = category.products.get(product.id) || { nombre: productName, cantidad: 0 };
      categoryProduct.cantidad += quantity;
      category.products.set(product.id, categoryProduct);
      categoryStats.set(product.id_categoria, category);
    });

    const categoryRows: CategoriaEstadistica[] = Array.from(categoryStats, ([id, category]) => {
      const bestProduct = Array.from(category.products.values())
        .sort((first, second) => second.cantidad - first.cantidad)[0];
      return {
        id,
        nombre: categoryNames.get(id) || 'Sin categoría',
        ingresos: category.ingresos,
        porcentaje: totalIngresos > 0 ? (category.ingresos / totalIngresos) * 100 : 0,
        productoMasVendido: bestProduct?.nombre || 'Sin ventas',
        cantidadVendida: bestProduct?.cantidad || 0,
      };
    });
    const salesCategoryIds = new Set(categoryRows.map((item) => item.id));
    categorias.forEach((category) => {
      if (!salesCategoryIds.has(category.id)) {
        categoryRows.push({
          id: category.id,
          nombre: category.nombre,
          ingresos: 0,
          porcentaje: 0,
          productoMasVendido: 'Sin ventas',
          cantidadVendida: 0,
        });
      }
    });
    categoryRows.sort((first, second) => second.ingresos - first.ingresos);

    return {
      totalIngresos,
      promedioVenta,
      promedioDiario: totalIngresos / elapsedDays,
      crecimiento,
      ventasDiarias,
      categoryRows,
      topPreparables: Array.from(topProducts.get(1)?.values() || []).sort((first, second) => second.cantidad - first.cantidad)[0],
      topNoPreparables: Array.from(topProducts.get(0)?.values() || []).sort((first, second) => second.cantidad - first.cantidad)[0],
      maxDailyAverage: Math.max(...ventasDiarias.map((item) => item.promedio), 0),
    };
  }, [categorias, consumos, movimientos, periodo, productos]);

  const growthIsPositive = statistics.crecimiento === null || statistics.crecimiento >= 0;
  const GrowthIcon = growthIsPositive ? TrendingUp : TrendingDown;
  const periodLabel = periodOptions.find((item) => item.key === periodo)?.label.toLowerCase() || 'periodo';
  const chartTitle = periodo === 'year'
    ? 'Promedio de venta por mes'
    : periodo === 'all'
      ? 'Promedio de venta por año'
      : 'Promedio de venta por día';
  const chartSubtitle = periodo === 'year'
    ? 'Promedio de cada venta en cada mes del año'
    : periodo === 'all'
      ? 'Promedio de cada venta por año'
      : 'Promedio de cada venta en cada día';
  const chartUnit = periodo === 'year' ? 'MESES' : periodo === 'all' ? 'AÑOS' : 'DÍAS';
  const growthText = statistics.crecimiento === null
    ? 'Nuevo'
    : `${statistics.crecimiento > 0 ? '+' : ''}${statistics.crecimiento.toFixed(1)}%`;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <HeaderNavbar />
      <View style={styles.heading}>
        <View>
          <Text style={styles.kicker}>RESUMEN DE VENTAS</Text>
          <Text style={styles.title}>Estadística</Text>
          <Text style={styles.subtitle}>{periodo === 'all' ? 'Histórico completo' : `Periodo: ${periodLabel}`}</Text>
        </View>
        <Pressable accessibilityLabel="Actualizar estadísticas" style={styles.refreshButton} onPress={load} disabled={loading}>
          <RefreshCw size={19} color="#F0B35A" />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color="#F0B35A" style={styles.loader} />
      ) : error ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No se pudieron cargar las estadísticas</Text>
          <Text style={styles.error}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={load}><Text style={styles.retryText}>Reintentar</Text></Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.periodSelector}>
            {periodOptions.map((option) => (
              <Pressable
                key={option.key}
                accessibilityRole="button"
                accessibilityState={{ selected: periodo === option.key }}
                style={[styles.periodOption, periodo === option.key && styles.periodOptionSelected]}
                onPress={() => setPeriodo(option.key)}>
                <Text style={[styles.periodOptionText, periodo === option.key && styles.periodOptionTextSelected]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.metricRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Venta promedio</Text>
              <Text style={styles.metricValue}>{money(statistics.promedioVenta)}</Text>
              <Text style={styles.metricHint}>Por venta registrada</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Ingreso diario promedio</Text>
              <Text style={styles.metricValue}>{money(statistics.promedioDiario)}</Text>
              <Text style={styles.metricHint}>Promedio diario · {periodLabel}</Text>
            </View>
          </View>

          <View style={styles.growthCard}>
            <View style={[styles.growthIcon, growthIsPositive ? styles.growthPositive : styles.growthNegative]}>
              <GrowthIcon size={20} color={growthIsPositive ? '#6DD3A0' : '#F28C8C'} />
            </View>
            <View style={styles.growthCopy}>
              <Text style={styles.cardLabel}>Crecimiento de ventas</Text>
              <Text style={styles.cardHint}>Frente al periodo anterior equivalente</Text>
            </View>
            <Text style={[styles.growthValue, !growthIsPositive && styles.growthValueNegative]}>{growthText}</Text>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeading}>
              <View><Text style={styles.sectionTitle}>{chartTitle}</Text><Text style={styles.sectionSubtitle}>{chartSubtitle}</Text></View>
              <Text style={styles.sectionTag}>{chartUnit}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chart}>
                {statistics.ventasDiarias.map((item) => {
                  const height = statistics.maxDailyAverage > 0
                    ? Math.max(4, (item.promedio / statistics.maxDailyAverage) * 76)
                    : 0;
                  return (
                    <View key={item.key} style={styles.chartColumn}>
                      <Text style={styles.chartValue}>{item.promedio > 0 ? money(item.promedio) : '—'}</Text>
                      <View style={styles.barArea}>
                        <View style={[styles.bar, { height }]} />
                      </View>
                      <Text style={styles.chartLabel}>{item.label}</Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeading}>
              <View><Text style={styles.sectionTitle}>Ingresos por categoría</Text><Text style={styles.sectionSubtitle}>Porcentaje de los ingresos totales</Text></View>
            </View>
            {statistics.categoryRows.length > 0 ? statistics.categoryRows.map((item) => (
              <View key={item.id} style={styles.categoryRevenue}>
                <View style={styles.categoryTopline}>
                  <Text style={styles.categoryName} numberOfLines={1}>{item.nombre}</Text>
                  <Text style={styles.categoryPercent}>{item.porcentaje.toFixed(1)}%</Text>
                </View>
                <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(item.porcentaje, 100)}%` }]} /></View>
                <Text style={styles.categoryIncome}>{money(item.ingresos)}</Text>
              </View>
            )) : <Text style={styles.noData}>Aún no hay ventas por categoría en este periodo.</Text>}
          </View>

          <View style={styles.sectionHeadingStandalone}>
            <Text style={styles.sectionTitle}>Productos más vendidos</Text>
            <Text style={styles.sectionSubtitle}>Según unidades vendidas · {periodLabel}</Text>
          </View>
          <View style={styles.topProductRow}>
            <View style={styles.topProductCard}>
              <Text style={styles.topProductType}>PREPARABLE</Text>
              <Text style={styles.topProductName} numberOfLines={2}>{statistics.topPreparables?.nombre || 'Sin ventas'}</Text>
              <Text style={styles.topProductCount}>{statistics.topPreparables ? `${statistics.topPreparables.cantidad} unidades` : '—'}</Text>
            </View>
            <View style={styles.topProductCard}>
              <Text style={styles.topProductType}>NO PREPARABLE</Text>
              <Text style={styles.topProductName} numberOfLines={2}>{statistics.topNoPreparables?.nombre || 'Sin ventas'}</Text>
              <Text style={styles.topProductCount}>{statistics.topNoPreparables ? `${statistics.topNoPreparables.cantidad} unidades` : '—'}</Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeading}>
              <View><Text style={styles.sectionTitle}>Más vendido por categoría</Text><Text style={styles.sectionSubtitle}>Producto líder en cada categoría</Text></View>
            </View>
            {statistics.categoryRows.length > 0 ? statistics.categoryRows.map((item) => (
              <View key={item.id} style={styles.bestSellerRow}>
                <View style={styles.categoryBadge}><Text style={styles.categoryInitial}>{item.nombre.charAt(0).toUpperCase()}</Text></View>
                <View style={styles.bestSellerCopy}>
                  <Text style={styles.bestSellerCategory} numberOfLines={1}>{item.nombre}</Text>
                  <Text style={styles.bestSellerProduct} numberOfLines={1}>{item.productoMasVendido}</Text>
                </View>
                <Text style={styles.bestSellerCount}>{item.cantidadVendida}</Text>
              </View>
            )) : <Text style={styles.noData}>No hay productos vendidos por categoría en este periodo.</Text>}
          </View>

          <Text style={styles.footerNote}>Ingresos del periodo: {money(statistics.totalIngresos)}</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1D1A17' },
  heading: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { color: '#F0B35A', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: '#F5EBDD', fontSize: 26, fontWeight: '800', marginTop: 5 },
  subtitle: { color: '#B8B1A8', fontSize: 11, marginTop: 5 },
  refreshButton: { width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: '#604D3A', alignItems: 'center', justifyContent: 'center' },
  loader: { marginTop: 50 },
  scroll: { paddingHorizontal: 20, paddingBottom: 30 },
  periodSelector: { flexDirection: 'row', gap: 7, marginBottom: 13, padding: 4, borderRadius: 9, backgroundColor: '#32281F', borderWidth: 1, borderColor: '#45382E' },
  periodOption: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  periodOptionSelected: { backgroundColor: '#D8A85B' },
  periodOptionText: { color: '#B8B1A8', fontSize: 11, fontWeight: '700' },
  periodOptionTextSelected: { color: '#251D17' },
  metricRow: { flexDirection: 'row', gap: 10, marginBottom: 11 },
  metricCard: { flex: 1, minHeight: 112, padding: 14, borderRadius: 10, backgroundColor: '#32281F', borderWidth: 1, borderColor: '#45382E', justifyContent: 'space-between' },
  metricLabel: { color: '#B8B1A8', fontSize: 11, fontWeight: '600', minHeight: 29 },
  metricValue: { color: '#F5EBDD', fontSize: 19, fontWeight: '800', marginTop: 6 },
  metricHint: { color: '#9B8F83', fontSize: 10, marginTop: 5 },
  growthCard: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, marginBottom: 14, borderRadius: 10, backgroundColor: '#32281F', borderWidth: 1, borderColor: '#45382E' },
  growthIcon: { width: 38, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  growthPositive: { backgroundColor: '#263B2F' },
  growthNegative: { backgroundColor: '#402725' },
  growthCopy: { flex: 1 },
  cardLabel: { color: '#F5EBDD', fontSize: 13, fontWeight: '700' },
  cardHint: { color: '#A99A8B', fontSize: 10, marginTop: 4 },
  growthValue: { color: '#6DD3A0', fontSize: 19, fontWeight: '800' },
  growthValueNegative: { color: '#F28C8C' },
  sectionCard: { padding: 15, marginBottom: 14, borderRadius: 10, backgroundColor: '#32281F', borderWidth: 1, borderColor: '#45382E' },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  sectionTitle: { color: '#F5EBDD', fontSize: 15, fontWeight: '800' },
  sectionSubtitle: { color: '#A99A8B', fontSize: 10, marginTop: 4 },
  sectionTag: { color: '#F0B35A', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  chart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 3 },
  chartColumn: { width: 47, alignItems: 'center' },
  chartValue: { color: '#C9B9A9', fontSize: 8, marginBottom: 5 },
  barArea: { height: 76, justifyContent: 'flex-end', width: '100%', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#5B4938' },
  bar: { width: '56%', minHeight: 0, backgroundColor: '#D8A85B', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  chartLabel: { color: '#A99A8B', fontSize: 9, marginTop: 7 },
  categoryRevenue: { marginBottom: 14 },
  categoryTopline: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 7 },
  categoryName: { color: '#E5D9CC', fontSize: 12, flex: 1 },
  categoryPercent: { color: '#F0B35A', fontSize: 12, fontWeight: '800' },
  progressTrack: { height: 6, overflow: 'hidden', borderRadius: 4, backgroundColor: '#4A3D31' },
  progressFill: { height: 6, borderRadius: 4, backgroundColor: '#D8A85B' },
  categoryIncome: { color: '#A99A8B', fontSize: 10, marginTop: 5 },
  noData: { color: '#A99A8B', fontSize: 12, paddingVertical: 4, lineHeight: 18 },
  sectionHeadingStandalone: { marginTop: 2, marginBottom: 11 },
  topProductRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  topProductCard: { flex: 1, minHeight: 128, padding: 14, justifyContent: 'space-between', borderRadius: 10, backgroundColor: '#32281F', borderWidth: 1, borderColor: '#45382E' },
  topProductType: { color: '#F0B35A', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  topProductName: { color: '#F5EBDD', fontSize: 14, fontWeight: '700', marginTop: 12 },
  topProductCount: { color: '#A99A8B', fontSize: 10, marginTop: 10 },
  bestSellerRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: '#45382E' },
  categoryBadge: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4A3D31' },
  categoryInitial: { color: '#F0B35A', fontSize: 14, fontWeight: '800' },
  bestSellerCopy: { flex: 1 },
  bestSellerCategory: { color: '#A99A8B', fontSize: 10 },
  bestSellerProduct: { color: '#F5EBDD', fontSize: 12, fontWeight: '700', marginTop: 3 },
  bestSellerCount: { color: '#F0B35A', fontSize: 12, fontWeight: '800', minWidth: 30, textAlign: 'right' },
  footerNote: { color: '#A99A8B', textAlign: 'center', fontSize: 10, marginTop: 2 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  emptyTitle: { color: '#F5EBDD', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  error: { color: '#F28C8C', fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 8 },
  retryButton: { minHeight: 44, marginTop: 17, paddingHorizontal: 22, justifyContent: 'center', borderRadius: 7, backgroundColor: '#F0B35A' },
  retryText: { color: '#251D17', fontWeight: '800' },
});
