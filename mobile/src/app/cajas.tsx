import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalendarDays, ChevronDown, CircleArrowDown, CircleArrowUp, X } from 'lucide-react-native';
import HeaderNavbar from '../components/HeaderNavbar';
import { amount, Caja, formatCajaDate, GastoCaja, isCajaAbierta, loadCajaData, money, MovimientoCaja, summarizeCaja } from '../constants/caja';

type Range = 'today' | 'week' | 'month' | 'all';
type DetailRow = { id: string; title: string; subtitle: string; value: number; kind: 'income' | 'expense' };

const matchesRange = (value: string | null | undefined, range: Range) => {
  if (range === 'all' || !value) return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return true;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (range === 'week') start.setDate(start.getDate() - 6);
  if (range === 'month') start.setMonth(start.getMonth() - 1);
  return date >= start;
};

const dateTime = (value?: string | null) => value ? new Date(value).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Sin fecha';

export default function CajasScreen() {
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [gastos, setGastos] = useState<GastoCaja[]>([]);
  const [range, setRange] = useState<Range>('month');
  const [filterOpen, setFilterOpen] = useState(false);
  const [selected, setSelected] = useState<Caja | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await loadCajaData();
      setCajas(data.cajas);
      setMovimientos(data.movimientos);
      setGastos(data.gastos);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No fue posible cargar el historial de cajas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visibleCajas = useMemo(() => cajas
    .filter((caja) => matchesRange(caja.fecha, range))
    .slice()
    .sort((first, second) => second.id - first.id), [cajas, range]);

  const details = useMemo<DetailRow[]>(() => {
    if (!selected) return [];
    const sales: DetailRow[] = movimientos
      .filter((item) => item.id_caja === selected.id && item.estado !== false && amount(item.total) > 0)
      .map((item) => ({
        id: `venta-${item.id}`,
        title: `Movimiento #${item.id}`,
        subtitle: `${item.metodo || 'Sin método'} · ${dateTime(item.fecha_hora)}`,
        value: amount(item.total),
        kind: 'income',
      }));
    const expenses: DetailRow[] = gastos
      .filter((item) => item.id_caja === selected.id)
      .map((item) => ({
        id: `gasto-${item.id}`,
        title: item.nombre,
        subtitle: `${item.descripcion || 'Gasto registrado'} · ${dateTime(item.fecha_hora)}`,
        value: amount(item.valor),
        kind: 'expense',
      }));
    return [...sales, ...expenses].sort((first, second) => second.id.localeCompare(first.id));
  }, [selected, movimientos, gastos]);

  const renderCaja = ({ item }: { item: Caja }) => {
    const summary = summarizeCaja(item, movimientos, gastos);
    const open = isCajaAbierta(item);
    const endingBalance = !open && item.balance_final != null ? amount(item.balance_final) : summary.balanceEstimado;
    return (
      <Pressable style={styles.cashCard} onPress={() => setSelected(item)}>
        <View style={styles.cardTop}>
          <View style={styles.idGroup}>
            <Text style={styles.cashId}>Caja #{item.id}</Text>
            {open && <Text style={styles.currentLabel}>Actual</Text>}
          </View>
          <View style={[styles.statusBadge, open ? styles.openBadge : styles.closedBadge]}>
            <View style={[styles.statusDot, open ? styles.openDot : styles.closedDot]} />
            <Text style={[styles.statusText, open ? styles.openText : styles.closedText]}>{open ? 'Abierta' : 'Cerrada'}</Text>
          </View>
        </View>
        <View style={styles.cardDate}><CalendarDays size={14} color="#A9B7B4" /><Text style={styles.dateText}>{formatCajaDate(item.fecha)}</Text></View>
        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Inicial <Text style={styles.balanceValue}>{money(item.balance_inicial)}</Text></Text>
          <Text style={styles.balanceArrow}>→</Text>
          <Text style={styles.balanceLabel}>{open ? 'Actual' : 'Final'} <Text style={[styles.balanceValue, open && styles.highlightValue]}>{money(endingBalance)}</Text></Text>
        </View>
        {!open && item.diferencia_caja != null && (
          <Text style={styles.differenceText}>Arqueo {amount(item.diferencia_caja) >= 0 ? 'sobrante' : 'faltante'}: {money(Math.abs(amount(item.diferencia_caja)))}</Text>
        )}
      </Pressable>
    );
  };

  const ranges: { value: Range; label: string }[] = [
    { value: 'today', label: 'Hoy' }, { value: 'week', label: '7 días' }, { value: 'month', label: '30 días' }, { value: 'all', label: 'Todo' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <HeaderNavbar />
      <View style={styles.header}>
        <View><Text style={styles.kicker}>CONTROL FINANCIERO</Text><Text style={styles.title}>Historial de cajas</Text></View>
        <Pressable style={styles.filterButton} onPress={() => setFilterOpen((current) => !current)}>
          <CalendarDays size={16} color="#F1B85B" /><Text style={styles.filterText}>{ranges.find((option) => option.value === range)?.label}</Text><ChevronDown size={15} color="#F1B85B" />
        </Pressable>
      </View>
      {filterOpen && <View style={styles.filterMenu}>{ranges.map((option) => (
        <Pressable key={option.value} style={[styles.filterOption, range === option.value && styles.filterSelected]} onPress={() => { setRange(option.value); setFilterOpen(false); }}>
          <Text style={[styles.filterOptionText, range === option.value && styles.filterSelectedText]}>{option.label}</Text>
        </Pressable>
      ))}</View>}
      {loading ? <ActivityIndicator color="#F1B85B" style={styles.loader} /> : error ? (
        <View style={styles.empty}><Text style={styles.emptyTitle}>No se pudo cargar</Text><Text style={styles.errorText}>{error}</Text><Pressable style={styles.retryButton} onPress={load}><Text style={styles.retryText}>Reintentar</Text></Pressable></View>
      ) : (
        <FlatList data={visibleCajas} keyExtractor={(item) => String(item.id)} renderItem={renderCaja} contentContainerStyle={styles.list} ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>Sin cajas en este periodo</Text></View>} />
      )}
      <Modal visible={selected !== null} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <SafeAreaView style={styles.detailSheet}>
            <View style={styles.detailHeader}>
              <View><Text style={styles.kicker}>DETALLE DE CAJA</Text><Text style={styles.detailTitle}>Caja #{selected?.id}</Text><Text style={styles.detailDate}>{formatCajaDate(selected?.fecha)}</Text></View>
              <Pressable style={styles.closeButton} onPress={() => setSelected(null)}><X size={23} color="#E9EFED" /></Pressable>
            </View>
            <View style={styles.detailSummary}>
              <View><Text style={styles.detailLabel}>Ingresos</Text><Text style={styles.detailAmount}>{money(details.filter((item) => item.kind === 'income').reduce((sum, item) => sum + item.value, 0))}</Text></View>
              <View><Text style={styles.detailLabel}>Egresos</Text><Text style={[styles.detailAmount, styles.expenseText]}>{money(details.filter((item) => item.kind === 'expense').reduce((sum, item) => sum + item.value, 0))}</Text></View>
            </View>
            <FlatList
              data={details}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.detailList}
              ListEmptyComponent={<Text style={styles.emptyDetail}>Esta caja no tiene movimientos ni gastos registrados.</Text>}
              renderItem={({ item }) => (
                <View style={styles.detailRow}>
                  {item.kind === 'income' ? <CircleArrowUp size={19} color="#6CC7A1" /> : <CircleArrowDown size={19} color="#E58B7E" />}
                  <View style={styles.detailCopy}><Text style={styles.detailRowTitle}>{item.title}</Text><Text style={styles.detailRowSubtitle}>{item.subtitle}</Text></View>
                  <Text style={[styles.detailRowValue, item.kind === 'expense' && styles.expenseText]}>{item.kind === 'expense' ? '− ' : '+ '}{money(item.value)}</Text>
                </View>
              )}
            />
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1D1A17' },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  kicker: { color: '#F0B35A', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: '#F5EBDD', fontSize: 26, fontWeight: '800', marginTop: 5 },
  filterButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: '#45382E', borderRadius: 7, backgroundColor: '#32281F' },
  filterText: { color: '#F5D3A7', fontWeight: '700', fontSize: 12 },
  filterMenu: { marginHorizontal: 20, marginBottom: 10, borderWidth: 1, borderColor: '#45382E', borderRadius: 7, backgroundColor: '#32281F', overflow: 'hidden' },
  filterOption: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#45382E' },
  filterSelected: { backgroundColor: '#F5D3A7' },
  filterOptionText: { color: '#F5EBDD', fontWeight: '600' },
  filterSelectedText: { color: '#251D17' },
  loader: { marginTop: 48 },
  list: { paddingHorizontal: 20, paddingBottom: 32 },
  cashCard: { backgroundColor: '#32281F', borderColor: '#45382E', borderWidth: 1, borderRadius: 10, padding: 15, marginBottom: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  idGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cashId: { color: '#F5F5F5', fontWeight: '800', fontSize: 17 },
  currentLabel: { color: '#251D17', backgroundColor: '#35C979', overflow: 'hidden', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, fontSize: 10, fontWeight: '800' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 5 },
  openBadge: { backgroundColor: '#2B4435' },
  closedBadge: { backgroundColor: '#4A3D31' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  openDot: { backgroundColor: '#35C979' },
  closedDot: { backgroundColor: '#B8B1A8' },
  statusText: { fontSize: 11, fontWeight: '800' },
  openText: { color: '#6DD3A0' },
  closedText: { color: '#D9D0C8' },
  cardDate: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  dateText: { color: '#B8B1A8', fontSize: 12 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 14, paddingTop: 11, borderTopWidth: 1, borderTopColor: '#45382E' },
  balanceLabel: { flex: 1, color: '#B8B1A8', fontSize: 12 },
  balanceValue: { color: '#F5F5F5', fontSize: 13, fontWeight: '800' },
  balanceArrow: { color: '#F0B35A', fontSize: 17 },
  highlightValue: { color: '#F5D3A7' },
  differenceText: { marginTop: 9, color: '#C9B9A9', fontSize: 11 },
  empty: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 52 },
  emptyTitle: { color: '#F5F5F5', fontWeight: '800', fontSize: 16 },
  errorText: { color: '#F28C8C', textAlign: 'center', marginTop: 8 },
  retryButton: { marginTop: 18, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 6, backgroundColor: '#F5D3A7' },
  retryText: { color: '#251D17', fontWeight: '800' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.72)' },
  detailSheet: { height: '88%', backgroundColor: '#1D1A17', borderTopLeftRadius: 14, borderTopRightRadius: 14, paddingTop: 10 },
  detailHeader: { paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#45382E' },
  detailTitle: { color: '#F5EBDD', fontSize: 23, fontWeight: '800', marginTop: 4 },
  detailDate: { color: '#B8B1A8', marginTop: 3 },
  closeButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  detailSummary: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#45382E' },
  detailLabel: { color: '#B8B1A8', fontSize: 11 },
  detailAmount: { color: '#6DD3A0', fontSize: 18, fontWeight: '800', marginTop: 4 },
  expenseText: { color: '#F28C8C' },
  detailList: { paddingHorizontal: 20, paddingBottom: 30 },
  detailRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: '#3E3128' },
  detailCopy: { flex: 1 },
  detailRowTitle: { color: '#F5F5F5', fontSize: 13, fontWeight: '700' },
  detailRowSubtitle: { color: '#B8B1A8', fontSize: 11, marginTop: 4 },
  detailRowValue: { color: '#6DD3A0', fontSize: 13, fontWeight: '800' },
  emptyDetail: { color: '#B8B1A8', textAlign: 'center', padding: 24 },
});