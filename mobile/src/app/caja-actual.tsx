import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowDownRight, ArrowUpRight, Banknote, CircleAlert, LockKeyhole, Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import HeaderNavbar from '../components/HeaderNavbar';
import { Caja, formatCajaDate, isCajaAbierta, loadCajaData, money, MovimientoCaja, GastoCaja, summarizeCaja } from '../constants/caja';

export default function CajaActualScreen() {
  const router = useRouter();
  const [caja, setCaja] = useState<Caja | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [gastos, setGastos] = useState<GastoCaja[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await loadCajaData();
      setCaja(data.cajas.slice().sort((first, second) => second.id - first.id).find(isCajaAbierta) || null);
      setMovimientos(data.movimientos);
      setGastos(data.gastos);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No fue posible cargar la caja actual.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const summary = caja ? summarizeCaja(caja, movimientos, gastos) : null;
  const methodRows = [
    { label: 'Efectivo', value: summary?.ingresos.efectivo || 0, icon: Banknote },
    { label: 'Tarjeta', value: summary?.ingresos.tarjeta || 0, icon: ArrowUpRight },
    { label: 'Transferencia', value: summary?.ingresos.transferencia || 0, icon: ArrowUpRight },
  ];
  const expenseRows = [
    { label: 'Efectivo', value: summary?.egresos.efectivo || 0 },
    { label: 'Tarjeta', value: summary?.egresos.tarjeta || 0 },
    { label: 'Transferencia', value: summary?.egresos.transferencia || 0 },
    { label: 'Sin método asignado', value: summary?.egresos.sinMetodo || 0 },
  ].filter((item) => item.value > 0);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <HeaderNavbar />
      <View style={styles.heading}>
        <View><Text style={styles.kicker}>TURNO EN CURSO</Text><Text style={styles.title}>Caja actual{caja ? ` #${caja.id}` : ''}</Text></View>
        {caja && <View style={styles.activeBadge}><View style={styles.activeDot} /><Text style={styles.activeText}>Activa</Text></View>}
      </View>
      {loading ? <ActivityIndicator color="#F0B35A" style={styles.loader} /> : error ? (
        <View style={styles.empty}><Text style={styles.emptyTitle}>No se pudo cargar</Text><Text style={styles.error}>{error}</Text><Pressable style={styles.secondaryButton} onPress={load}><Text style={styles.secondaryText}>Reintentar</Text></Pressable></View>
      ) : !caja || !summary ? (
        <View style={styles.empty}>
          <CircleAlert size={34} color="#F0B35A" />
          <Text style={styles.emptyTitle}>No hay una caja abierta</Text>
          <Text style={styles.emptyCopy}>Inicia la caja del siguiente turno desde el flujo de cierre y apertura.</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.push('/cierre-caja' as any)}><Text style={styles.primaryText}>Abrir caja</Text></Pressable>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.initialPanel}>
              <View style={styles.initialIcon}><Banknote size={21} color="#F5D3A7" /></View>
              <View style={styles.initialCopy}><Text style={styles.panelLabel}>Balance inicial</Text><Text style={styles.initialValue}>{money(caja.balance_inicial)}</Text></View>
              <Text style={styles.openDate}>{formatCajaDate(caja.fecha)}</Text>
            </View>

            <View style={styles.sectionHeader}><View style={styles.sectionIcon}><ArrowUpRight size={17} color="#6DD3A0" /></View><Text style={styles.sectionTitle}>Ingresos</Text><Text style={styles.sectionTotal}>{money(summary.totalIngresos)}</Text></View>
            <View style={styles.rows}>
              {methodRows.map((row) => {
                const Icon = row.icon;
                return <View key={row.label} style={styles.dataRow}><View style={styles.rowLead}><Icon size={17} color="#C9B9A9" /><Text style={styles.rowLabel}>{row.label}</Text></View><Text style={styles.rowValue}>{money(row.value)}</Text></View>;
              })}
              {summary.ingresos.otros > 0 && <View style={styles.dataRow}><Text style={styles.rowLabel}>Otros métodos</Text><Text style={styles.rowValue}>{money(summary.ingresos.otros)}</Text></View>}
            </View>

            <View style={[styles.sectionHeader, styles.expenseHeader]}><View style={[styles.sectionIcon, styles.expenseIcon]}><ArrowDownRight size={17} color="#F28C8C" /></View><Text style={styles.sectionTitle}>Egresos y gastos</Text><Text style={[styles.sectionTotal, styles.expenseValue]}>{money(summary.totalEgresos)}</Text></View>
            <View style={styles.rows}>
              {expenseRows.length ? expenseRows.map((row) => <View key={row.label} style={styles.dataRow}><Text style={styles.rowLabel}>{row.label}</Text><Text style={[styles.rowValue, styles.expenseValue]}>{money(row.value)}</Text></View>) : <Text style={styles.noRows}>No hay egresos registrados.</Text>}
            </View>

            <View style={styles.tipPanel}><View style={styles.tipIcon}><Sparkles size={17} color="#F5D3A7" /></View><Text style={styles.tipLabel}>Propinas recolectadas</Text><Text style={styles.tipValue}>{money(summary.propinas)}</Text></View>

            <View style={styles.balancePanel}>
              <View style={styles.balanceTop}><Text style={styles.balanceLabel}>Balance estimado</Text><Text style={styles.balanceCaption}>Incluye ingresos, gastos y propinas</Text></View>
              <Text style={styles.balanceValue}>{money(summary.balanceEstimado)}</Text>
            </View>
          </ScrollView>
          <View style={styles.footer}><Pressable style={styles.closeCashButton} onPress={() => router.push('/cierre-caja' as any)}><LockKeyhole size={19} color="#251D17" /><Text style={styles.closeCashText}>Cerrar esta caja</Text></Pressable></View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1D1A17' },
  heading: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { color: '#F0B35A', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: '#F5EBDD', fontSize: 26, fontWeight: '800', marginTop: 5 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#2B4435', borderRadius: 5 },
  activeDot: { width: 8, height: 8, borderRadius: 5, backgroundColor: '#35C979' },
  activeText: { color: '#6DD3A0', fontSize: 12, fontWeight: '800' },
  loader: { marginTop: 45 },
  scroll: { paddingHorizontal: 20, paddingBottom: 26 },
  initialPanel: { padding: 15, borderRadius: 10, backgroundColor: '#32281F', borderWidth: 1, borderColor: '#45382E', flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 19 },
  initialIcon: { width: 42, height: 42, borderRadius: 7, backgroundColor: '#4A3D31', justifyContent: 'center', alignItems: 'center' },
  initialCopy: { flex: 1 },
  panelLabel: { color: '#B8B1A8', fontSize: 12 },
  initialValue: { color: '#F5EBDD', fontWeight: '800', fontSize: 19, marginTop: 3 },
  openDate: { color: '#B8B1A8', fontSize: 10, textAlign: 'right', maxWidth: 83 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 },
  sectionIcon: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#2A1E18', justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { flex: 1, color: '#F5EBDD', fontWeight: '800', fontSize: 15 },
  sectionTotal: { color: '#6DD3A0', fontWeight: '800', fontSize: 15 },
  rows: { paddingHorizontal: 12, paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: '#45382E', marginBottom: 15 },
  dataRow: { minHeight: 42, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  rowLabel: { color: '#D9D0C8', fontSize: 13 },
  rowValue: { color: '#F5F5F5', fontSize: 13, fontWeight: '700' },
  expenseHeader: { marginTop: 1 },
  expenseIcon: { backgroundColor: '#3A2422' },
  expenseValue: { color: '#F28C8C' },
  noRows: { color: '#B8B1A8', fontSize: 12, paddingVertical: 9 },
  tipPanel: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, paddingVertical: 14, marginBottom: 13, borderRadius: 8, backgroundColor: '#32281F', borderWidth: 1, borderColor: '#45382E' },
  tipIcon: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4A3D31' },
  tipLabel: { flex: 1, color: '#F5D3A7', fontSize: 13, fontWeight: '700' },
  tipValue: { color: '#F5D3A7', fontSize: 15, fontWeight: '800' },
  balancePanel: { padding: 16, borderRadius: 9, backgroundColor: '#32281F', borderWidth: 1, borderColor: '#D8A85B' },
  balanceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  balanceLabel: { color: '#F5D3A7', fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  balanceCaption: { color: '#C9B9A9', fontSize: 10, textAlign: 'right', flexShrink: 1 },
  balanceValue: { color: '#F5EBDD', fontSize: 30, fontWeight: '900', marginTop: 10 },
  footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#45382E', backgroundColor: '#1D1A17' },
  closeCashButton: { minHeight: 50, borderRadius: 7, backgroundColor: '#F0B35A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  closeCashText: { color: '#251D17', fontWeight: '900', fontSize: 14, textTransform: 'uppercase' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { color: '#F5EBDD', fontSize: 19, fontWeight: '800', marginTop: 15, textAlign: 'center' },
  emptyCopy: { color: '#B8B1A8', lineHeight: 21, textAlign: 'center', marginTop: 8 },
  error: { color: '#F28C8C', textAlign: 'center', marginTop: 8 },
  primaryButton: { marginTop: 20, borderRadius: 7, paddingHorizontal: 24, paddingVertical: 13, backgroundColor: '#F0B35A' },
  primaryText: { color: '#251D17', fontWeight: '800' },
  secondaryButton: { marginTop: 17, borderWidth: 1, borderColor: '#604D3A', borderRadius: 7, paddingHorizontal: 18, paddingVertical: 11 },
  secondaryText: { color: '#F5EBDD', fontWeight: '700' },
});