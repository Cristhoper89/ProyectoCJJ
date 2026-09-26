import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ChevronDown, ChevronUp, CircleDollarSign, ReceiptText, TriangleAlert, TrendingDown, TrendingUp } from 'lucide-react-native';
import HeaderNavbar from '../components/HeaderNavbar';
import { apiRequest } from '../constants/api';

type TabKey = 'ventas' | 'gastos';
type RangeKey = 'today' | 'week' | 'month';

type Movimiento = {
  id: number;
  estado?: boolean | null;
  propina?: number | string | null;
  domicilio?: number | string | null;
  total?: number | string | null;
  id_mesa?: number | null;
  id_caja?: number | null;
  id_mesero?: string | null;
  metodo?: string | null;
  fecha_hora?: string | null;
};

type Gasto = {
  id: number;
  nombre: string;
  descripcion?: string | null;
  valor?: number | string | null;
  fecha_hora?: string | null;
  categoria?: number | null;
  categoria_nombre?: string | null;
  id_caja?: number | null;
};

type Producto = {
  id: number;
  nombre?: string | null;
  descripcion?: string | null;
  precio?: number | string | null;
};

type Consumo = {
  id: number;
  id_mov?: number | null;
  id_producto?: number | null;
  cantidad?: number | null;
  subtotal?: number | string | null;
  notas?: string | null;
  precio_unitario?: number | string | null;
};

const money = (value: number | string | null | undefined) => {
  const numeric = Number(value ?? 0);
  return `$${Number.isFinite(numeric) ? numeric.toLocaleString('es-CO') : '0'}`;
};

const numberValue = (value: number | string | null | undefined) => Number(value ?? 0) || 0;

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const rangeMatches = (value: string | null | undefined, range: RangeKey) => {
  if (!value) return true;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return true;

  const now = new Date();
  const start = new Date(now);

  if (range === 'today') {
    start.setHours(0, 0, 0, 0);
    return date >= start;
  }

  if (range === 'week') {
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return date >= start;
  }

  start.setMonth(now.getMonth() - 1);
  start.setHours(0, 0, 0, 0);
  return date >= start;
};

export default function MovimientosScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('ventas');
  const [range, setRange] = useState<RangeKey>('week');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [expandedMovementId, setExpandedMovementId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [consumos, setConsumos] = useState<Consumo[]>([]);
  const [pendingMovement, setPendingMovement] = useState<Movimiento | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const [movimientosResult, gastosResult, productosResult, consumosResult] = await Promise.allSettled([
        apiRequest<Movimiento[]>('/movimientos/'),
        apiRequest<Gasto[]>('/gastos/'),
        apiRequest<Producto[]>('/productos/'),
        apiRequest<Consumo[]>('/mesasC/'),
      ]);

      const movimientosData = movimientosResult.status === 'fulfilled' ? movimientosResult.value : [];
      const gastosData = gastosResult.status === 'fulfilled' ? gastosResult.value : [];
      const productosData = productosResult.status === 'fulfilled' ? productosResult.value : [];
      const consumosData = consumosResult.status === 'fulfilled' ? consumosResult.value : [];

      setMovimientos(movimientosData);
      setGastos(gastosData);
      setProductos(productosData.filter((producto) => producto && producto.id));
      setConsumos(consumosData);

      const failed = [movimientosResult, gastosResult, productosResult, consumosResult].filter((result) => result.status === 'rejected');
      if (failed.length > 0) {
        const firstFailure = failed[0].reason;
        setError(firstFailure instanceof Error ? firstFailure.message : 'No se pudieron cargar los datos del historial.');
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo cargar la información del historial.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filteredMovimientos = useMemo(
    () => movimientos.filter((movimiento) => rangeMatches(movimiento.fecha_hora ?? null, range)),
    [movimientos, range],
  );

  const filteredGastos = useMemo(
    () => gastos.filter((gasto) => rangeMatches(gasto.fecha_hora ?? null, range)),
    [gastos, range],
  );

  const totalIngresos = filteredMovimientos
    .filter((item) => item.estado !== false)
    .reduce((sum, item) => sum + numberValue(item.total), 0);
  const totalGastos = filteredGastos.reduce((sum, item) => sum + numberValue(item.valor), 0);
  const balanceNeto = totalIngresos - totalGastos;

  const deactivateMovement = async () => {
    if (!pendingMovement) return;
    try {
      setSaving(true);
      await apiRequest(`/movimientos/${pendingMovement.id}`, {
        method: 'PUT',
        body: JSON.stringify({ estado: false }),
      });
      setMovimientos((current) => current.map((item) => (
        item.id === pendingMovement.id ? { ...item, estado: false } : item
      )));
      setPendingMovement(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se pudo desactivar el movimiento.');
    } finally {
      setSaving(false);
    }
  };

  const movementDetaisById = useMemo(() => {
    return consumos.reduce<Record<number, Consumo[]>>((accumulator, item) => {
      if (!item.id_mov) return accumulator;
      if (!accumulator[item.id_mov]) accumulator[item.id_mov] = [];
      accumulator[item.id_mov].push(item);
      return accumulator;
    }, {});
  }, [consumos]);

  const renderMovement = ({ item }: { item: Movimiento }) => {
    const isExpanded = expandedMovementId === item.id;
    const productLines = movementDetaisById[item.id] || [];
    const movementSubtotal = productLines.reduce((sum, line) => sum + numberValue(line.subtotal), 0);

    return (
      <View style={styles.cardContainer}>
        <TouchableOpacity
          style={[styles.movementCard, isExpanded && styles.movementCardExpanded]}
          onPress={() => setExpandedMovementId(isExpanded ? null : item.id)}
          activeOpacity={0.9}
        >
          <View style={styles.movementHeader}>
            <View style={styles.movementHeading}>
              <Text style={styles.movementId}># {item.id}</Text>
              <Text style={styles.movementTime}>{formatDateTime(item.fecha_hora)}</Text>
            </View>
            <View style={styles.movementSummary}>
              <Text style={styles.movementTotal}>{money(item.total)}</Text>
              <View style={styles.methodBadge}>
                <Text style={styles.methodText}>{item.metodo || 'Efectivo'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.movementMeta}>
            <Text style={styles.metaText}>Mesero: {item.id_mesero ? item.id_mesero.slice(0, 8) : 'Sin asignar'}</Text>
            <Text style={[styles.metaState, item.estado === false && styles.metaStateInactive]}>
              {item.estado === false ? 'Anulado' : 'Completado'}
            </Text>
          </View>

          {isExpanded ? <ChevronUp size={18} color="#F5D3A7" /> : <ChevronDown size={18} color="#F5D3A7" />}
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandablePanel}>
            {productLines.length > 0 ? productLines.map((line) => {
              const product = productos.find((producto) => producto.id === line.id_producto);
              const quantity = line.cantidad ?? 1;
              const label = `${quantity} x ${product?.nombre || `Producto ${line.id_producto ?? 'N/A'}`}`;
              return (
                <View key={line.id} style={styles.productLine}>
                  <Text style={styles.productLineText}>{label}</Text>
                  <Text style={styles.productLinePrice}>{money(line.subtotal)}</Text>
                  {line.notas ? <Text style={styles.productNotes}>{line.notas}</Text> : null}
                </View>
              );
            }) : <Text style={styles.emptyExpandedText}>Sin productos asociados.</Text>}

            <View style={styles.detailDivider} />
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Subtotal</Text><Text style={styles.detailValue}>{money(movementSubtotal)}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Propina</Text><Text style={styles.detailValue}>{money(item.propina)}</Text></View>
            <View style={styles.detailRow}><Text style={styles.detailLabel}>Domicilio</Text><Text style={styles.detailValue}>{money(item.domicilio)}</Text></View>
            <View style={[styles.detailRow, styles.detailTotalRow]}>
              <Text style={styles.detailTotalLabel}>Total general</Text>
              <Text style={styles.detailTotalValue}>{money(item.total)}</Text>
            </View>
            {item.estado !== false && (
              <TouchableOpacity style={styles.deactivateButton} onPress={() => setPendingMovement(item)}>
                <Text style={styles.deactivateButtonText}>Desactivar movimiento</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderGasto = ({ item }: { item: Gasto }) => (
    <View style={styles.gastoCard}>
      <View style={styles.gastoTopRow}>
        <Text style={styles.gastoName}>{item.nombre}</Text>
        <Text style={styles.gastoValue}>- {money(item.valor)}</Text>
      </View>
      <Text style={styles.gastoDescription}>{item.descripcion || 'Sin descripción'}</Text>
      <View style={styles.gastoMetaRow}>
        <Text style={styles.gastoTime}>{formatDateTime(item.fecha_hora)}</Text>
        <Text style={styles.gastoTag}>{item.categoria_nombre || `Cat. ${item.categoria ?? '--'}`}</Text>
      </View>
      <Text style={styles.gastoCaja}>Caja: {item.id_caja ?? 'General'}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <HeaderNavbar />

      <View style={styles.screenContent}>
        <View style={styles.topBar}>
          <Text style={styles.title}>Historial de Caja</Text>
          <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilterMenu((current) => !current)}>
            <Text style={styles.filterText}>{range === 'today' ? 'Hoy' : range === 'week' ? 'Esta semana' : 'Este mes'}</Text>
            <ChevronDown size={16} color="#F5D3A7" />
          </TouchableOpacity>
        </View>

        {showFilterMenu && (
          <View style={styles.filterMenu}>
            {(['today', 'week', 'month'] as RangeKey[]).map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.filterOption, range === option && styles.filterOptionSelected]}
                onPress={() => {
                  setRange(option);
                  setShowFilterMenu(false);
                }}
              >
                <Text style={styles.filterOptionText}>{option === 'today' ? 'Hoy' : option === 'week' ? 'Esta semana' : 'Este mes'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryIconWrap}><TrendingUp size={18} color="#6DD3A0" /></View>
            <Text style={styles.summaryLabel}>Ingresos</Text>
            <Text style={styles.summaryValuePositive}>{money(totalIngresos)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <View style={styles.summaryIconWrap}><TrendingDown size={18} color="#F28C8C" /></View>
            <Text style={styles.summaryLabel}>Gastos</Text>
            <Text style={styles.summaryValueNegative}>{money(totalGastos)}</Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryCardWide]}>
            <View style={styles.summaryIconWrap}><CircleDollarSign size={18} color="#F5D3A7" /></View>
            <Text style={styles.summaryLabel}>Balance neto</Text>
            <Text style={[styles.summaryValueBalance, balanceNeto >= 0 ? styles.textPositive : styles.textNegative]}>
              {money(balanceNeto)}
            </Text>
          </View>
        </View>

        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'ventas' && styles.tabButtonActive]}
            onPress={() => setActiveTab('ventas')}
          >
            <ReceiptText size={16} color={activeTab === 'ventas' ? '#251D17' : '#F5D3A7'} />
            <Text style={[styles.tabText, activeTab === 'ventas' && styles.tabTextActive]}>Venta / Facturas</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'gastos' && styles.tabButtonActive]}
            onPress={() => setActiveTab('gastos')}
          >
            <TrendingDown size={16} color={activeTab === 'gastos' ? '#251D17' : '#F5D3A7'} />
            <Text style={[styles.tabText, activeTab === 'gastos' && styles.tabTextActive]}>Gastos</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loaderArea}><ActivityIndicator color="#F5D3A7" /></View>
        ) : error ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No pudimos cargar el historial</Text>
            <Text style={styles.emptyStateText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={loadData}><Text style={styles.retryText}>Reintentar</Text></Pressable>
          </View>
        ) : activeTab === 'ventas' ? (
          <FlatList
            data={filteredMovimientos}
            keyExtractor={(item) => `movement-${item.id}`}
            renderItem={renderMovement}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={<View style={styles.emptyState}><Text style={styles.emptyStateTitle}>Sin ventas en este rango</Text></View>}
          />
        ) : (
          <FlatList
            data={filteredGastos}
            keyExtractor={(item) => `gasto-${item.id}`}
            renderItem={renderGasto}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={<View style={styles.emptyState}><Text style={styles.emptyStateTitle}>Sin gastos en este rango</Text></View>}
          />
        )}
      </View>
      <Modal visible={pendingMovement !== null} transparent animationType="fade" onRequestClose={() => setPendingMovement(null)}>
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <View style={styles.alertIcon}><TriangleAlert size={28} color="#F05245" /></View>
            <Text style={styles.confirmTitle}>Desactivar movimiento</Text>
            <Text style={styles.confirmText}>¿Está seguro de que desea desactivar el movimiento #{pendingMovement?.id}?</Text>
            <View style={styles.confirmActions}>
              <Pressable style={styles.cancelButton} onPress={() => setPendingMovement(null)} disabled={saving}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.confirmButton} onPress={deactivateMovement} disabled={saving}>
                {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.confirmButtonText}>Desactivar</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1D1A17',
  },
  screenContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    color: '#F5F5F5',
    fontSize: 26,
    fontWeight: '700',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#32281F',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#45382E',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterText: {
    color: '#F5D3A7',
    fontSize: 12,
    fontWeight: '700',
  },
  filterMenu: {
    backgroundColor: '#32281F',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#45382E',
    marginBottom: 12,
    overflow: 'hidden',
  },
  filterOption: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#45382E',
  },
  filterOptionSelected: {
    backgroundColor: '#493B2F',
  },
  filterOptionText: {
    color: '#F5F5F5',
    fontWeight: '600',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 10,
  },
  summaryCard: {
    width: '31%',
    minWidth: 100,
    backgroundColor: '#32281F',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#45382E',
    padding: 12,
  },
  summaryCardWide: {
    width: '100%',
  },
  summaryIconWrap: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#2A1E18',
    marginBottom: 8,
  },
  summaryLabel: {
    color: '#B8B1A8',
    fontSize: 12,
    marginBottom: 4,
  },
  summaryValuePositive: {
    color: '#6DD3A0',
    fontWeight: '700',
    fontSize: 15,
  },
  summaryValueNegative: {
    color: '#F28C8C',
    fontWeight: '700',
    fontSize: 15,
  },
  summaryValueBalance: {
    fontWeight: '700',
    fontSize: 18,
  },
  textPositive: {
    color: '#6DD3A0',
  },
  textNegative: {
    color: '#F28C8C',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#32281F',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: '#45382E',
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#F5D3A7',
  },
  tabText: {
    color: '#F5D3A7',
    fontWeight: '700',
    fontSize: 13,
  },
  tabTextActive: {
    color: '#251D17',
  },
  listContainer: {
    paddingBottom: 30,
  },
  cardContainer: {
    marginBottom: 12,
  },
  movementCard: {
    flexDirection: 'column',
    backgroundColor: '#32281F',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#45382E',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  movementCardExpanded: {
    borderColor: '#D8A85B',
  },
  movementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  movementHeading: {
    flex: 1,
  },
  movementId: {
    color: '#F5F5F5',
    fontWeight: '700',
    fontSize: 16,
  },
  movementTime: {
    color: '#B8B1A8',
    fontSize: 12,
    marginTop: 4,
  },
  movementSummary: {
    alignItems: 'flex-end',
  },
  movementTotal: {
    color: '#F5F5F5',
    fontSize: 18,
    fontWeight: '700',
  },
  methodBadge: {
    backgroundColor: '#4A3D31',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
  },
  methodText: {
    color: '#F5D3A7',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  movementMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  metaText: {
    color: '#D9D0C8',
    fontSize: 12,
    flex: 1,
  },
  metaState: {
    color: '#6DD3A0',
    fontWeight: '700',
    fontSize: 11,
  },
  metaStateInactive: {
    color: '#F28C8C',
  },
  expandablePanel: {
    backgroundColor: '#251F1B',
    borderRadius: 12,
    marginTop: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#3E3128',
  },
  deactivateButton: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#9D514C',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#3A2422',
  },
  deactivateButtonText: {
    color: '#F28C8C',
    fontSize: 12,
    fontWeight: '700',
  },
  confirmBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  confirmCard: {
    width: '88%',
    maxWidth: 500,
    backgroundColor: '#32281F',
    borderWidth: 1,
    borderColor: '#604D3A',
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
  },
  alertIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    backgroundColor: '#57352F',
  },
  confirmTitle: {
    color: '#F5EBDD',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  confirmText: {
    color: '#C9B9A9',
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
    marginTop: 12,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 25,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#604D3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: '#F5EBDD',
    fontWeight: '700',
  },
  confirmButton: {
    flex: 1,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#F05245',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  productLine: {
    marginBottom: 10,
  },
  productLineText: {
    color: '#F5F5F5',
    fontSize: 13,
    fontWeight: '600',
  },
  productLinePrice: {
    color: '#F5D3A7',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'right',
  },
  productNotes: {
    color: '#B8B1A8',
    fontSize: 11,
    marginTop: 2,
  },
  detailDivider: {
    height: 1,
    backgroundColor: '#45382E',
    marginVertical: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailLabel: {
    color: '#D9D0C8',
    fontSize: 12,
  },
  detailValue: {
    color: '#F5F5F5',
    fontSize: 12,
    fontWeight: '600',
  },
  detailTotalRow: {
    marginTop: 4,
  },
  detailTotalLabel: {
    color: '#F5D3A7',
    fontSize: 13,
    fontWeight: '700',
  },
  detailTotalValue: {
    color: '#F5D3A7',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyExpandedText: {
    color: '#B8B1A8',
    fontSize: 12,
  },
  gastoCard: {
    backgroundColor: '#32281F',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#45382E',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  gastoTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gastoName: {
    color: '#F5F5F5',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  gastoValue: {
    color: '#F28C8C',
    fontSize: 16,
    fontWeight: '700',
  },
  gastoDescription: {
    color: '#B8B1A8',
    fontSize: 12,
    marginTop: 6,
  },
  gastoMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  gastoTime: {
    color: '#D9D0C8',
    fontSize: 11,
  },
  gastoTag: {
    color: '#F5D3A7',
    backgroundColor: '#4A3D31',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: '700',
  },
  gastoCaja: {
    color: '#B8B1A8',
    fontSize: 11,
    marginTop: 6,
  },
  loaderArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyState: {
    backgroundColor: '#32281F',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#45382E',
    padding: 20,
    marginTop: 8,
    alignItems: 'center',
  },
  emptyStateTitle: {
    color: '#F5F5F5',
    fontWeight: '700',
    fontSize: 16,
  },
  emptyStateText: {
    color: '#B8B1A8',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#F5D3A7',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 12,
  },
  retryText: {
    color: '#251D17',
    fontWeight: '700',
  },
});
