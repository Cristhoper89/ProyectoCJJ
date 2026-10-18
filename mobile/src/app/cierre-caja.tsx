import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowDownRight, ArrowUpRight, Check, Plus } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import HeaderNavbar from '../components/HeaderNavbar';
import { apiRequest } from '../constants/api';
import { Caja, isCajaAbierta, loadCajaData, money, parsePesos, summarizeCaja } from '../constants/caja';

export default function CierreCajaScreen() {
  const router = useRouter();
  const [caja, setCaja] = useState<Caja | null>(null);
  const [movimientos, setMovimientos] = useState<Awaited<ReturnType<typeof loadCajaData>>['movimientos']>([]);
  const [gastos, setGastos] = useState<Awaited<ReturnType<typeof loadCajaData>>['gastos']>([]);
  const [nextOpening, setNextOpening] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await loadCajaData();
      const active = data.cajas.slice().sort((first, second) => second.id - first.id).find(isCajaAbierta) || null;
      setCaja(active);
      setMovimientos(data.movimientos);
      setGastos(data.gastos);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No fue posible cargar los datos de caja.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => caja ? summarizeCaja(caja, movimientos, gastos) : null, [caja, movimientos, gastos]);
  const expectedCash = summary?.balanceEstimado || 0;
  const canConfirm = !!caja || nextOpening.trim().length > 0;

  const confirm = async () => {
    if (!canConfirm) return;
    try {
      setSaving(true);
      if (caja) {
        await apiRequest(`/cajas/${caja.id}/cierre`, {
          method: 'POST',
        });
      } else {
        const openingBalance = parsePesos(nextOpening);
        await apiRequest('/cajas/', {
          method: 'POST',
          body: JSON.stringify({
            fecha: new Date().toISOString(),
            ingresos_efectivo: 0,
            ingresos_tarjeta: 0,
            ingresos_transferencia: 0,
            egresos_efectivo: 0,
            egresos_tarjeta: 0,
            egresos_transferencia: 0,
            total_propinas: 0,
            balance_inicial: openingBalance,
            balance_final: openingBalance,
            estado: 'abierta',
          }),
        });
      }
      Alert.alert(
        caja ? 'Caja cerrada' : 'Caja abierta',
        caja ? 'La caja quedó cerrada. Abre la siguiente manualmente cuando estés listo.' : 'La caja quedó activa para este turno.',
      );
      router.replace('/caja-actual' as any);
    } catch (requestError) {
      Alert.alert('No se pudo completar', requestError instanceof Error ? requestError.message : 'Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <HeaderNavbar />
      <View style={styles.header}><Text style={styles.kicker}>{caja ? 'CIERRE DE TURNO' : 'NUEVO TURNO'}</Text><Text style={styles.title}>{caja ? 'Cerrar caja' : 'Apertura de caja'}</Text></View>
      {loading ? <ActivityIndicator color="#F0B35A" style={styles.loader} /> : error ? (
        <View style={styles.errorState}><Text style={styles.errorText}>{error}</Text><Pressable style={styles.retryButton} onPress={load}><Text style={styles.retryText}>Reintentar</Text></Pressable></View>
      ) : (
        <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {caja && summary ? <>
              <View style={styles.stepHeading}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View><View><Text style={styles.stepKicker}>ARQUEO</Text><Text style={styles.stepTitle}>Cierre de caja #{caja.id}</Text></View></View>
              <View style={styles.expectedPanel}>
                <View style={styles.expectedTop}><Text style={styles.expectedLabel}>Balance esperado en sistema</Text><Text style={styles.expectedValue}>{money(expectedCash)}</Text></View>
                <View style={styles.expectedRow}><ArrowUpRight size={15} color="#6DD3A0" /><Text style={styles.expectedRowLabel}>Ingresos</Text><Text style={styles.expectedRowValue}>{money(summary.totalIngresos)}</Text></View>
                <View style={styles.expectedRow}><ArrowDownRight size={15} color="#F28C8C" /><Text style={styles.expectedRowLabel}>Egresos y gastos</Text><Text style={[styles.expectedRowValue, styles.expenseColor]}>{money(summary.totalEgresos)}</Text></View>
                <View style={styles.expectedRow}><Text style={styles.tipMark}>✳</Text><Text style={styles.expectedRowLabel}>Propinas separadas</Text><Text style={styles.expectedRowValue}>{money(summary.propinas)}</Text></View>
              </View>

              <View style={styles.firstOpenNotice}><Check size={18} color="#E4B45F" /><Text style={styles.firstOpenText}>Al cerrar, la caja quedará cerrada. Para iniciar otro turno tendrás que abrir una nueva caja manualmente.</Text></View>
            </> : <>
              <View style={styles.firstOpenNotice}><Plus size={18} color="#E4B45F" /><Text style={styles.firstOpenText}>No hay una caja abierta. Ingresa el balance inicial para abrir una caja manualmente.</Text></View>
              <View style={[styles.stepHeading, styles.openStepHeading]}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View><View><Text style={styles.stepKicker}>NUEVO TURNO</Text><Text style={styles.stepTitle}>Abrir nueva caja</Text></View></View>
              <Text style={styles.label}>Balance inicial</Text>
              <View style={styles.moneyInput}><Text style={styles.currencyPrefix}>$</Text><TextInput value={nextOpening} onChangeText={setNextOpening} placeholder="50.000" placeholderTextColor="#998C80" keyboardType="number-pad" style={styles.input} /></View>
            </>}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable style={[styles.confirmButton, (!canConfirm || saving) && styles.disabledButton]} onPress={confirm} disabled={saving || !canConfirm}>
              {saving ? <ActivityIndicator color="#251D17" /> : caja ? <><Check size={19} color="#251D17" /><Text style={styles.confirmText}>Cerrar caja</Text></> : <><Plus size={19} color="#251D17" /><Text style={styles.confirmText}>Abrir caja</Text></>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1D1A17' },
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 13 },
  kicker: { color: '#F0B35A', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: '#F5EBDD', fontSize: 26, fontWeight: '800', marginTop: 5 },
  loader: { marginTop: 48 },
  content: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 22 },
  stepHeading: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 14 },
  stepNumber: { width: 32, height: 32, borderRadius: 6, backgroundColor: '#F0B35A', alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: '#251D17', fontWeight: '900', fontSize: 15 },
  stepKicker: { color: '#F0B35A', fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  stepTitle: { color: '#F5EBDD', fontWeight: '800', fontSize: 16, marginTop: 2 },
  expectedPanel: { borderWidth: 1, borderColor: '#45382E', backgroundColor: '#32281F', borderRadius: 8, padding: 14, marginBottom: 17 },
  expectedTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9, paddingBottom: 11, borderBottomWidth: 1, borderBottomColor: '#45382E' },
  expectedLabel: { color: '#D9D0C8', fontSize: 12, fontWeight: '700' },
  expectedValue: { color: '#F5D3A7', fontSize: 19, fontWeight: '900' },
  expectedRow: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 8 },
  expectedRowLabel: { flex: 1, color: '#B8B1A8', fontSize: 12 },
  expectedRowValue: { color: '#F5F5F5', fontSize: 12, fontWeight: '700' },
  expenseColor: { color: '#F28C8C' },
  tipMark: { width: 15, textAlign: 'center', color: '#F5D3A7' },
  label: { color: '#D9D0C8', fontWeight: '700', fontSize: 12, marginBottom: 7, marginTop: 3 },
  moneyInput: { height: 50, borderWidth: 1, borderColor: '#604D3A', borderRadius: 7, flexDirection: 'row', alignItems: 'center', backgroundColor: '#32281F', paddingHorizontal: 13, marginBottom: 11 },
  currencyPrefix: { color: '#F5D3A7', fontSize: 17, fontWeight: '800', marginRight: 8 },
  input: { flex: 1, color: '#F5EBDD', fontSize: 17, fontWeight: '700', paddingVertical: 0 },
  openStepHeading: { marginTop: 13 },
  firstOpenNotice: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: '#32281F', borderWidth: 1, borderColor: '#45382E', padding: 13, borderRadius: 7, marginBottom: 18 },
  firstOpenText: { flex: 1, color: '#C9B9A9', lineHeight: 19, fontSize: 12 },
  footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, backgroundColor: '#1D1A17', borderTopWidth: 1, borderTopColor: '#45382E' },
  confirmButton: { minHeight: 51, borderRadius: 7, backgroundColor: '#F0B35A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 12 },
  disabledButton: { opacity: 0.65 },
  confirmText: { color: '#251D17', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', flexShrink: 1, textAlign: 'center' },
  errorState: { padding: 24, alignItems: 'center' },
  errorText: { color: '#F28C8C', textAlign: 'center' },
  retryButton: { marginTop: 14, backgroundColor: '#F5D3A7', paddingHorizontal: 17, paddingVertical: 10, borderRadius: 6 },
  retryText: { color: '#251D17', fontWeight: '800' },
});