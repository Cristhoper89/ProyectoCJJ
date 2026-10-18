import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarDays, ChefHat, Clock3, ContactRound, Mail, Search, ShoppingBag, X } from 'lucide-react-native';
import HeaderNavbar from '../components/HeaderNavbar';
import { apiRequest, getAccessToken } from '../constants/api';

type Role = { id: number; name: string };
type Customer = {
  id: string;
  username: string;
  email: string;
  nombre: string | null;
  telefono: string | null;
  is_active: boolean;
  role_id: number;
};
type Movement = {
  id: number;
  id_cliente?: string | null;
  estado?: boolean | null;
  total?: number | string | null;
  metodo?: string | null;
  fecha_hora?: string | null;
};
type Consumption = {
  id: number;
  id_mov?: number | null;
  id_producto?: number | null;
  cantidad?: number | null;
  subtotal?: number | string | null;
};
type Product = {
  id: number;
  nombre?: string | null;
  preparacion?: boolean | null;
};
type Visit = { key: string; date: Date };
type ProductStat = { id: number; nombre: string; cantidad: number; total: number };

const money = (value: number | string | null | undefined) => {
  const numeric = Number(value ?? 0);
  return `$${Number.isFinite(numeric) ? Math.round(numeric).toLocaleString('es-CO') : '0'}`;
};

const dateKey = (value: Date) => [
  value.getFullYear(),
  String(value.getMonth() + 1).padStart(2, '0'),
  String(value.getDate()).padStart(2, '0'),
].join('-');

const parseDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateTime = (value?: string | null) => {
  const date = parseDate(value);
  return date
    ? date.toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Fecha sin registrar';
};

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const topProduct = (
  consumptions: Consumption[],
  productById: Map<number, Product>,
  needsPreparation: boolean,
): ProductStat | null => {
  const totals = new Map<number, ProductStat>();
  consumptions.forEach((consumption) => {
    const productId = consumption.id_producto;
    if (productId == null) return;
    const product = productById.get(productId);
    if (!product || product.preparacion !== needsPreparation) return;
    const stat = totals.get(productId) || {
      id: productId,
      nombre: product.nombre || `Producto ${productId}`,
      cantidad: 0,
      total: 0,
    };
    stat.cantidad += Number(consumption.cantidad) || 0;
    stat.total += Number(consumption.subtotal) || 0;
    totals.set(productId, stat);
  });
  return [...totals.values()].sort((first, second) => (
    second.cantidad - first.cantidad || second.total - first.total || first.nombre.localeCompare(second.nombre)
  ))[0] || null;
};

export default function ClientesScreen() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [consumptions, setConsumptions] = useState<Consumption[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!getAccessToken()) {
      setError('Inicia sesión para consultar los clientes.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [userData, roleData, movementData, consumptionData, productData] = await Promise.all([
        apiRequest<Customer[]>('/users/'),
        apiRequest<Role[]>('/roles/'),
        apiRequest<Movement[]>('/movimientos/'),
        apiRequest<Consumption[]>('/mesasC/'),
        apiRequest<Product[]>('/productos/'),
      ]);
      const customerRoleIds = new Set(roleData.filter((role) => role.name === 'Cliente').map((role) => role.id));
      setCustomers(userData.filter((user) => customerRoleIds.has(user.role_id)));
      setRoles(roleData);
      setMovements(movementData);
      setConsumptions(consumptionData);
      setProducts(productData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No fue posible cargar los clientes y sus compras.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const customerRoleIds = useMemo(
    () => new Set(roles.filter((role) => role.name === 'Cliente').map((role) => role.id)),
    [roles],
  );
  const visibleCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return customers.filter((customer) => {
      const matchesQuery = !query || [
        customer.nombre,
        customer.username,
        customer.email,
        customer.telefono,
      ].some((value) => value?.toLowerCase().includes(query));
      return matchesQuery && (showInactive || customer.is_active);
    });
  }, [customers, search, showInactive]);

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const customerMovements = useMemo(() => {
    if (!selected) return [];
    return movements
      .filter((movement) => movement.id_cliente === selected.id && movement.estado !== false && Number(movement.total) > 0)
      .sort((first, second) => (parseDate(second.fecha_hora)?.getTime() || 0) - (parseDate(first.fecha_hora)?.getTime() || 0));
  }, [movements, selected]);

  const analytics = useMemo(() => {
    if (!selected) {
      return { totalSpent: 0, visits: [] as Visit[], favoriteWeekdays: [] as string[], frequentDayCount: 0, topPrepared: null as ProductStat | null, topOther: null as ProductStat | null };
    }

    const visitsByDay = new Map<string, Visit>();
    customerMovements.forEach((movement) => {
      const date = parseDate(movement.fecha_hora);
      if (date) visitsByDay.set(dateKey(date), { key: dateKey(date), date });
    });
    const visits = [...visitsByDay.values()].sort((first, second) => second.date.getTime() - first.date.getTime());
    const weekdayCounts = new Map<number, number>();
    visits.forEach(({ date }) => {
      weekdayCounts.set(date.getDay(), (weekdayCounts.get(date.getDay()) || 0) + 1);
    });
    const frequentDayCount = Math.max(0, ...weekdayCounts.values());
    const favoriteWeekdays = [...weekdayCounts.entries()]
      .filter(([, count]) => count === frequentDayCount && count > 0)
      .sort(([first], [second]) => first - second)
      .map(([day]) => WEEKDAYS[day]);

    const movementIds = new Set(customerMovements.map((movement) => movement.id));
    const purchasedItems = consumptions.filter((item) => (
      item.id_mov != null && movementIds.has(item.id_mov) && Number(item.subtotal) > 0
    ));

    return {
      totalSpent: customerMovements.reduce((sum, movement) => sum + (Number(movement.total) || 0), 0),
      visits,
      favoriteWeekdays,
      frequentDayCount,
      topPrepared: topProduct(purchasedItems, productById, true),
      topOther: topProduct(purchasedItems, productById, false),
    };
  }, [consumptions, customerMovements, productById, selected]);

  const consumptionsByMovement = useMemo(() => {
    const grouped = new Map<number, Consumption[]>();
    customerMovements.forEach((movement) => grouped.set(movement.id, []));
    consumptions.forEach((item) => {
      if (item.id_mov != null && grouped.has(item.id_mov) && Number(item.subtotal) > 0) {
        grouped.get(item.id_mov)?.push(item);
      }
    });
    return grouped;
  }, [consumptions, customerMovements]);

  const renderCustomer = ({ item }: { item: Customer }) => {
    const purchaseCount = movements.filter((movement) => (
      movement.id_cliente === item.id && movement.estado !== false && Number(movement.total) > 0
    )).length;
    const totalSpent = movements.reduce((sum, movement) => (
      movement.id_cliente === item.id && movement.estado !== false ? sum + (Number(movement.total) || 0) : sum
    ), 0);
    return (
      <Pressable style={[styles.customerCard, !item.is_active && styles.inactiveCard]} onPress={() => setSelected(item)}>
        <View style={styles.avatar}><ContactRound size={21} color="#F0B35A" /></View>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>{item.nombre || item.username}</Text>
          <Text style={styles.username}>@{item.username}</Text>
          <View style={styles.detailLine}><Mail size={13} color="#A99A8B" /><Text style={styles.detailText}>{item.email}</Text></View>
          <View style={styles.summaryLine}>
            <Text style={styles.summaryText}>{purchaseCount} {purchaseCount === 1 ? 'compra' : 'compras'}</Text>
            <Text style={styles.summarySpent}>{money(totalSpent)}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, item.is_active ? styles.activeBadge : styles.inactiveBadge]}>
          <Text style={styles.statusText}>{item.is_active ? 'ACTIVO' : 'INACTIVO'}</Text>
        </View>
      </Pressable>
    );
  };

  const canViewCustomers = customerRoleIds.size > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <HeaderNavbar />
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>RELACIÓN CON CLIENTES</Text>
          <Text style={styles.title}>Clientes</Text>
          <Text style={styles.subtitle}>Consulta sus compras, visitas y productos favoritos.</Text>
        </View>
      </View>
      <View style={styles.searchBox}>
        <Search size={18} color="#A99A8B" />
        <TextInput value={search} onChangeText={setSearch} placeholder="Buscar cliente" placeholderTextColor="#998C80" style={styles.searchInput} />
      </View>
      <View style={styles.filters}>
        <Pressable style={[styles.filter, !showInactive && styles.filterSelected]} onPress={() => setShowInactive(false)}>
          <Text style={[styles.filterText, !showInactive && styles.filterTextSelected]}>Activos</Text>
        </Pressable>
        <Pressable style={[styles.filter, showInactive && styles.filterSelected]} onPress={() => setShowInactive(true)}>
          <Text style={[styles.filterText, showInactive && styles.filterTextSelected]}>Todos</Text>
        </Pressable>
        <Text style={styles.counter}>{visibleCustomers.length} resultados</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#F0B35A" style={styles.loader} />
      ) : error ? (
        <View style={styles.empty}>
          <Text style={styles.error}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={load}><Text style={styles.retryText}>Reintentar</Text></Pressable>
        </View>
      ) : !canViewCustomers ? (
        <View style={styles.empty}>
          <ContactRound size={32} color="#F0B35A" />
          <Text style={styles.emptyTitle}>No hay rol de cliente</Text>
          <Text style={styles.emptyText}>No se encontró el rol Cliente en la configuración de roles.</Text>
        </View>
      ) : (
        <FlatList
          data={visibleCustomers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderCustomer}
          ListEmptyComponent={<View style={styles.empty}><ContactRound size={31} color="#F0B35A" /><Text style={styles.emptyTitle}>No hay clientes</Text><Text style={styles.emptyText}>No se encontraron clientes para mostrar.</Text></View>}
        />
      )}

      <Modal visible={selected !== null} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <SafeAreaView style={styles.detailSheet}>
            <View style={styles.detailHeader}>
              <View style={styles.detailHeading}>
                <Text style={styles.kicker}>HISTORIAL DEL CLIENTE</Text>
                <Text style={styles.detailTitle}>{selected?.nombre || selected?.username}</Text>
                <Text style={styles.detailSubtitle}>@{selected?.username} · {selected?.email}</Text>
              </View>
              <Pressable style={styles.closeButton} onPress={() => setSelected(null)} accessibilityLabel="Cerrar historial">
                <X size={23} color="#E9EFED" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.detailContent}>
              <View style={styles.spentCard}>
                <ShoppingBag size={18} color="#F0B35A" />
                <View style={styles.spentCopy}>
                  <Text style={styles.statLabel}>Total gastado en el restaurante</Text>
                  <Text style={styles.spentValue}>{money(analytics.totalSpent)}</Text>
                </View>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <CalendarDays size={17} color="#F0B35A" />
                  <Text style={styles.statValue}>{analytics.visits.length}</Text>
                  <Text style={styles.statLabel}>Días asistidos</Text>
                </View>
                <View style={styles.statCard}>
                  <Clock3 size={17} color="#F0B35A" />
                  <Text style={styles.statValue}>{analytics.favoriteWeekdays.length ? analytics.favoriteWeekdays.join(', ') : '—'}</Text>
                  <Text style={styles.statLabel}>
                    {analytics.favoriteWeekdays.length ? `Día más frecuente · ${analytics.frequentDayCount} visitas` : 'Día más frecuente'}
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Productos más comprados</Text>
              <View style={styles.favoriteProducts}>
                <View style={styles.favoriteProduct}>
                  <View style={styles.productTypeIcon}><ChefHat size={17} color="#F0B35A" /></View>
                  <View style={styles.favoriteCopy}>
                    <Text style={styles.favoriteLabel}>Requiere preparación</Text>
                    <Text style={styles.favoriteName}>{analytics.topPrepared?.nombre || 'Sin compras registradas'}</Text>
                    {analytics.topPrepared && <Text style={styles.favoriteMeta}>{analytics.topPrepared.cantidad} unidades · {money(analytics.topPrepared.total)}</Text>}
                  </View>
                </View>
                <View style={styles.favoriteProduct}>
                  <View style={styles.productTypeIcon}><ShoppingBag size={17} color="#F0B35A" /></View>
                  <View style={styles.favoriteCopy}>
                    <Text style={styles.favoriteLabel}>No requiere preparación</Text>
                    <Text style={styles.favoriteName}>{analytics.topOther?.nombre || 'Sin compras registradas'}</Text>
                    {analytics.topOther && <Text style={styles.favoriteMeta}>{analytics.topOther.cantidad} unidades · {money(analytics.topOther.total)}</Text>}
                  </View>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Compras ({customerMovements.length})</Text>
              {customerMovements.length === 0 ? (
                <Text style={styles.emptyPurchases}>Este cliente aún no tiene compras registradas.</Text>
              ) : customerMovements.map((movement) => {
                const items = consumptionsByMovement.get(movement.id) || [];
                return (
                  <View key={movement.id} style={styles.purchaseCard}>
                    <View style={styles.purchaseHeader}>
                      <View>
                        <Text style={styles.purchaseId}>Compra #{movement.id}</Text>
                        <Text style={styles.purchaseDate}>{formatDateTime(movement.fecha_hora)}</Text>
                      </View>
                      <View style={styles.purchaseTotal}>
                        <Text style={styles.purchaseAmount}>{money(movement.total)}</Text>
                        <Text style={styles.purchaseMethod}>{movement.metodo || 'Sin método'}</Text>
                      </View>
                    </View>
                    {items.length > 0 ? items.map((item) => (
                      <View key={item.id} style={styles.purchaseItem}>
                        <Text style={styles.purchaseItemName}>
                          {productById.get(item.id_producto || -1)?.nombre || `Producto ${item.id_producto || ''}`}
                        </Text>
                        <Text style={styles.purchaseItemAmount}>
                          {item.cantidad || 1} × {money(item.subtotal)}
                        </Text>
                      </View>
                    )) : <Text style={styles.noPurchaseDetails}>Detalle de productos no disponible.</Text>}
                  </View>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1D1A17' },
  header: { paddingHorizontal: 20, paddingTop: 19, paddingBottom: 14 },
  kicker: { color: '#F0B35A', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: '#F5EBDD', fontSize: 27, fontWeight: '800', marginTop: 4 },
  subtitle: { color: '#B8A99A', fontSize: 12, marginTop: 5 },
  searchBox: { height: 46, marginHorizontal: 20, borderRadius: 8, borderWidth: 1, borderColor: '#4A3D31', backgroundColor: '#2D2620', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, gap: 9 },
  searchInput: { flex: 1, color: '#F5EBDD', fontSize: 14 },
  filters: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 13 },
  filter: { borderWidth: 1, borderColor: '#4A3D31', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7 },
  filterSelected: { backgroundColor: '#F0B35A', borderColor: '#F0B35A' },
  filterText: { color: '#B8A99A', fontSize: 12, fontWeight: '700' },
  filterTextSelected: { color: '#251D17' },
  counter: { marginLeft: 'auto', color: '#87796C', fontSize: 12 },
  loader: { flex: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 28 },
  customerCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#32281F', borderColor: '#45382E', borderWidth: 1, borderRadius: 12, padding: 13, marginBottom: 10 },
  inactiveCard: { opacity: 0.65 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#49382A', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  customerInfo: { flex: 1, gap: 5 },
  customerName: { color: '#F5EBDD', fontSize: 15, fontWeight: '800' },
  username: { color: '#D8B47A', fontSize: 12, fontWeight: '600' },
  detailLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { color: '#B8A99A', fontSize: 12, flexShrink: 1 },
  summaryLine: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 3 },
  summaryText: { color: '#A99A8B', fontSize: 11 },
  summarySpent: { color: '#6DD3A0', fontSize: 12, fontWeight: '800' },
  statusBadge: { borderRadius: 5, paddingHorizontal: 7, paddingVertical: 4 },
  activeBadge: { backgroundColor: '#29483D' },
  inactiveBadge: { backgroundColor: '#49362F' },
  statusText: { color: '#EBDCCE', fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  emptyTitle: { color: '#F5EBDD', fontSize: 17, fontWeight: '800', marginTop: 12 },
  emptyText: { color: '#B8A99A', marginTop: 7, textAlign: 'center', lineHeight: 20 },
  error: { color: '#F0A696', textAlign: 'center' },
  retryButton: { marginTop: 16, borderRadius: 6, backgroundColor: '#F0B35A', paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: '#251D17', fontWeight: '800' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.72)' },
  detailSheet: { height: '94%', backgroundColor: '#1D1A17', borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  detailHeader: { paddingHorizontal: 19, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#45382E' },
  detailHeading: { flex: 1, paddingRight: 8 },
  detailTitle: { color: '#F5EBDD', fontSize: 21, fontWeight: '800', marginTop: 4 },
  detailSubtitle: { color: '#B8A99A', fontSize: 11, marginTop: 3 },
  closeButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  detailContent: { paddingHorizontal: 18, paddingTop: 15, paddingBottom: 32 },
  spentCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#32281F', borderWidth: 1, borderColor: '#604D3A', borderRadius: 11, padding: 14 },
  spentCopy: { flex: 1 },
  spentValue: { color: '#6DD3A0', fontSize: 22, fontWeight: '900', marginTop: 3 },
  statsGrid: { flexDirection: 'row', gap: 10, marginTop: 10 },
  statCard: { flex: 1, minHeight: 104, backgroundColor: '#32281F', borderWidth: 1, borderColor: '#45382E', borderRadius: 10, padding: 12 },
  statValue: { color: '#F5EBDD', fontSize: 16, fontWeight: '800', marginTop: 7, textTransform: 'capitalize' },
  statLabel: { color: '#B8A99A', fontSize: 11, marginTop: 4 },
  sectionTitle: { color: '#F5EBDD', fontSize: 16, fontWeight: '800', marginTop: 20, marginBottom: 10 },
  favoriteProducts: { backgroundColor: '#32281F', borderRadius: 10, borderWidth: 1, borderColor: '#45382E', paddingHorizontal: 13 },
  favoriteProduct: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#45382E' },
  productTypeIcon: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#49382A', alignItems: 'center', justifyContent: 'center' },
  favoriteCopy: { flex: 1 },
  favoriteLabel: { color: '#A99A8B', fontSize: 10, fontWeight: '700' },
  favoriteName: { color: '#F5EBDD', fontSize: 13, fontWeight: '800', marginTop: 3 },
  favoriteMeta: { color: '#D8B47A', fontSize: 11, marginTop: 3 },
  purchaseCard: { backgroundColor: '#32281F', borderRadius: 10, borderWidth: 1, borderColor: '#45382E', paddingHorizontal: 13, paddingVertical: 11, marginBottom: 9 },
  purchaseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 9 },
  purchaseId: { color: '#F5EBDD', fontSize: 13, fontWeight: '800' },
  purchaseDate: { color: '#A99A8B', fontSize: 10, marginTop: 4 },
  purchaseTotal: { alignItems: 'flex-end' },
  purchaseAmount: { color: '#6DD3A0', fontSize: 14, fontWeight: '900' },
  purchaseMethod: { color: '#B8A99A', fontSize: 10, marginTop: 3 },
  purchaseItem: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#45382E' },
  purchaseItemName: { flex: 1, color: '#D9D0C8', fontSize: 11 },
  purchaseItemAmount: { color: '#B8A99A', fontSize: 11 },
  noPurchaseDetails: { color: '#A99A8B', fontSize: 11, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#45382E' },
  emptyPurchases: { color: '#A99A8B', fontSize: 12, textAlign: 'center', padding: 20, backgroundColor: '#32281F', borderRadius: 9 },
});
