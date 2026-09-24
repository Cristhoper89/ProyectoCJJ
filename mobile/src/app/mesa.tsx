import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, ImageBackground, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Print from 'expo-print';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Clock3, Printer, Trash2, X } from 'lucide-react-native';
import HeaderNavbar from '../components/HeaderNavbar';
import { apiRequest, getAccessToken } from '../constants/api';

type Mesa = { id: number; nombre?: string | null; estado?: boolean; tipo?: 'barra' | 'mesa' | null; hora_inicio?: string | null; id_mov?: number | null };
type Categoria = { id: number; nombre: string; estado?: boolean };
type Producto = { id: number; nombre?: string; descripcion?: string; precio?: number; id_categoria?: number; estado?: boolean };
type Consumo = { id: number; id_producto?: number; id_mov?: number | null; cantidad?: number; precio_unitario?: number; subtotal?: number; notas?: string | null; hora?: string | null };
type Movimiento = { id: number; estado?: boolean; propina?: number; domicilio?: number; total?: number; id_mesa?: number | null; metodo?: string };
type Linea = Consumo & { descuento: number };

const money = (value: number) => `$${Math.round(value).toLocaleString('es-CO')}`;

export default function MesaScreen() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [consumos, setConsumos] = useState<Consumo[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);
  const [selectedMovimiento, setSelectedMovimiento] = useState<Movimiento | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Categoria | null>(null);
  const [propina, setPropina] = useState(0);
  const [domicilio, setDomicilio] = useState('0');
  const [discounts, setDiscounts] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    if (!getAccessToken()) { setError('Inicia sesión para consultar las mesas.'); setLoading(false); return; }
    try {
      setError('');
      const [mesaData, categoryData, productData, consumptionData, movimientoData] = await Promise.all([
        apiRequest<Mesa[]>('/mesas/'), apiRequest<Categoria[]>('/categorias/'),
        apiRequest<Producto[]>('/productos/'), apiRequest<Consumo[]>('/mesasC/'), apiRequest<Movimiento[]>('/movimientos/'),
      ]);
      setMesas(mesaData); setCategorias(categoryData.filter((category) => category.estado !== false));
      setProductos(productData.filter((product) => product.estado !== false)); setConsumos(consumptionData); setMovimientos(movimientoData);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'No fue posible cargar las mesas.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);
  const activeMovementId = selectedMesa?.tipo === 'barra' ? selectedMovimiento?.id : selectedMesa?.id_mov;
  const mesaConsumos = useMemo(() => consumos.filter((consumo) => consumo.id_mov === activeMovementId && (consumo.subtotal || 0) > 0), [consumos, activeMovementId]);
  const lineas = useMemo<Linea[]>(() => mesaConsumos.map((consumo) => ({ ...consumo, descuento: Math.min(100, Math.max(0, Number(discounts[consumo.id] || 0))) })), [mesaConsumos, discounts]);
  const subtotal = lineas.reduce((sum, line) => sum + (line.subtotal || 0) * (1 - line.descuento / 100), 0);
  const total = subtotal + propina + Math.max(0, Number(domicilio) || 0);

  const openMesa = (mesa: Mesa) => {
    const currentMovement = mesa.tipo === 'barra'
      ? movimientos.filter((movimiento) => movimiento.id_mesa === mesa.id).at(-1) || null
      : null;
    setSelectedMesa(mesa); setSelectedMovimiento(currentMovement); setSelectedCategory(null); setPropina(currentMovement?.propina || 0); setDomicilio(String(currentMovement?.domicilio || 0));
  };

  const createBarMovement = async () => {
    if (!selectedMesa || selectedMesa.tipo !== 'barra') return;
    try {
      setSaving(true);
      const movement = await apiRequest<Movimiento>('/movimientos/', { method: 'POST', body: JSON.stringify({ estado: true, propina: 0, domicilio: 0, total: 0, metodo: 'Efectivo', id_mesa: selectedMesa.id }) });
      setMovimientos((current) => [...current, movement]); setSelectedMovimiento(movement); setPropina(0); setDomicilio('0');
    } catch (requestError) { Alert.alert('No se pudo crear el movimiento', requestError instanceof Error ? requestError.message : 'Intenta nuevamente.'); }
    finally { setSaving(false); }
  };

  const addProduct = async (product: Producto) => {
    if (!selectedMesa) return;
    try {
      setSaving(true);
      let activeMesa = selectedMesa;
      let activeMovement = selectedMovimiento;
      if (activeMesa.estado !== true) {
        activeMesa = await apiRequest<Mesa>(`/mesas/${activeMesa.id}/estado?new_state=true`, { method: 'PATCH' });
        setSelectedMesa(activeMesa); setMesas((current) => current.map((mesa) => mesa.id === activeMesa.id ? { ...mesa, ...activeMesa } : mesa));
        if (activeMesa.tipo === 'barra') {
          const movementData = await apiRequest<Movimiento[]>('/movimientos/');
          setMovimientos(movementData); activeMovement = movementData.filter((movement) => movement.id_mesa === activeMesa.id).at(-1) || null; setSelectedMovimiento(activeMovement);
        }
      }
      if (activeMesa.tipo === 'barra' && !activeMovement) throw new Error('La barra no tiene un movimiento activo.');
      const movementId = activeMesa.tipo === 'barra' ? activeMovement?.id : activeMesa.id_mov;
      if (!movementId) throw new Error('La mesa no tiene un movimiento activo.');
      const newConsumption = await apiRequest<Consumo>('/mesasC/', { method: 'POST', body: JSON.stringify({ id_producto: product.id, id_mov: movementId, cantidad: 1 }) });
      setConsumos((current) => [...current, newConsumption]);
      setSelectedCategory(null);
    } catch (requestError) { Alert.alert('No se pudo registrar', requestError instanceof Error ? requestError.message : 'Intenta nuevamente.'); }
    finally { setSaving(false); }
  };

  const saveBill = async (close = false) => {
    if (!selectedMesa) return;
    try {
      setSaving(true);
      for (const line of lineas) {
        const adjustedSubtotal = (line.subtotal || 0) * (1 - line.descuento / 100);
        if (adjustedSubtotal !== line.subtotal) await apiRequest(`/mesasC/${line.id}`, { method: 'PUT', body: JSON.stringify({ subtotal: adjustedSubtotal }) });
      }
      if (close) {
        if (selectedMesa.tipo === 'barra' && selectedMovimiento) {
          await apiRequest(`/movimientos/${selectedMovimiento.id}`, { method: 'PUT', body: JSON.stringify({ total, propina, domicilio: Number(domicilio) || 0, metodo: 'Efectivo' }) });
        }
        await apiRequest(`/mesas/${selectedMesa.id}/finalizar`, { method: 'POST', body: JSON.stringify({ total, propina, domicilio: Number(domicilio) || 0, metodo: 'Efectivo' }) });
        setSelectedMesa(null); setSelectedMovimiento(null);
      }
      await loadData();
    } catch (requestError) { Alert.alert('No se pudo guardar', requestError instanceof Error ? requestError.message : 'Intenta nuevamente.'); }
    finally { setSaving(false); }
  };

  const cancelOrder = () => Alert.alert('Cancelar cuenta', 'Se anularán los productos registrados de esta mesa.', [
    { text: 'Volver', style: 'cancel' },
    { text: 'Cancelar cuenta', style: 'destructive', onPress: async () => {
      if (!selectedMesa) return;
      try {
        setSaving(true);
        await Promise.all(mesaConsumos.map((consumo) => apiRequest(`/mesasC/${consumo.id}`, { method: 'PUT', body: JSON.stringify({ subtotal: 0 }) })));
        await apiRequest(`/mesas/${selectedMesa.id}/cerrar`, { method: 'PATCH' }); setSelectedMesa(null); setSelectedMovimiento(null); await loadData();
      } catch (requestError) { Alert.alert('No se pudo cancelar', requestError instanceof Error ? requestError.message : 'Intenta nuevamente.'); }
      finally { setSaving(false); }
    } },
  ]);

  const printBill = async () => {
    if (!selectedMesa) return;
    const displayName = selectedMesa.nombre || (selectedMesa.tipo === 'barra' ? 'Barra' : `Mesa ${selectedMesa.id}`);
    const rows = lineas.map((line) => `${productos.find((item) => item.id === line.id_producto)?.nombre || `Producto ${line.id_producto}`} x${line.cantidad || 0}: ${money((line.subtotal || 0) * (1 - line.descuento / 100))}`).join('\n');
    await Print.printAsync({ html: `<h1>Cuenta ${displayName}</h1><pre>${rows}</pre><p>Subtotal: ${money(subtotal)}</p><p>Propina: ${money(propina)}</p><p>Domicilio: ${money(Number(domicilio) || 0)}</p><h2>Total: ${money(total)}</h2>` });
  };

  const elapsed = (startedAt?: string | null) => {
    if (!startedAt) return 'Disponible';
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m activa`;
  };

  return <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
    <HeaderNavbar />
    {loading ? <ActivityIndicator color="#F0B35A" style={styles.loader} /> : error ? <View style={styles.empty}><Text style={styles.error}>{error}</Text><TouchableOpacity style={styles.retry} onPress={loadData}><Text style={styles.retryText}>Reintentar</Text></TouchableOpacity></View> : <FlatList data={mesas} keyExtractor={(mesa) => String(mesa.id)} contentContainerStyle={styles.grid} renderItem={({ item: mesa }) => { const active = mesa.estado === true; const title = mesa.nombre || (mesa.tipo === 'barra' ? 'Barra' : `Mesa ${mesa.id}`); return <TouchableOpacity style={[styles.mesaCard, active && styles.activeCard]} onPress={() => openMesa(mesa)} activeOpacity={0.85}><View style={styles.cardHeader}><Text style={styles.cardTitle}>{title.toUpperCase()}</Text></View><View style={styles.imageContainer}><ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80' }} style={styles.foodImage} imageStyle={styles.foodImageStyle} /></View><View style={styles.cardFooter}><View style={[styles.status, active ? styles.statusActive : styles.statusFree]}><Text style={styles.statusText}>{active ? 'ACTIVA' : 'DISPONIBLE'}</Text></View>{active && <Text style={styles.elapsed}>{elapsed(mesa.hora_inicio)}</Text>}</View></TouchableOpacity>; }} ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No hay mesas registradas.</Text></View>} />}

    <Modal visible={!!selectedMesa} animationType="slide" onRequestClose={() => setSelectedMesa(null)}><SafeAreaView style={styles.modal}>
      <View style={styles.modalHeader}><View><Text style={styles.modalKicker}>CUENTA</Text><Text style={styles.modalTitle}>{selectedMesa?.nombre || (selectedMesa?.tipo === 'barra' ? 'Barra' : `Mesa ${selectedMesa?.id}`)}</Text></View><Pressable onPress={() => { setSelectedMesa(null); setSelectedMovimiento(null); }}><X color="#F5EBDD" size={25} /></Pressable></View>
      <View style={styles.activeTime}><Clock3 size={15} color="#F0B35A" /><Text style={styles.activeTimeText}>{elapsed(selectedMesa?.hora_inicio)}</Text></View>
      <ScrollView contentContainerStyle={styles.modalContent}>
        {selectedCategory ? <View><Pressable style={styles.backButton} onPress={() => setSelectedCategory(null)}><ChevronLeft color="#F0B35A" size={18} /><Text style={styles.backText}>Categorías</Text></Pressable><Text style={styles.sectionTitle}>{selectedCategory.nombre}</Text>{productos.filter((product) => product.id_categoria === selectedCategory.id).map((product) => <TouchableOpacity key={product.id} style={styles.productRow} onPress={() => addProduct(product)}><View><Text style={styles.productName}>{product.nombre}</Text><Text style={styles.productDescription}>{product.descripcion || 'Producto disponible'}</Text></View><Text style={styles.price}>{money(product.precio || 0)}</Text></TouchableOpacity>)}</View> : <View><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={styles.sectionTitle}>Agregar productos</Text>{selectedMesa?.tipo === 'barra' && <TouchableOpacity style={{ backgroundColor: '#604332', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, marginTop: 10 }} onPress={createBarMovement} disabled={saving}><Text style={{ color: '#F5EBDD', fontSize: 12, fontWeight: '700' }}>Nuevo movimiento</Text></TouchableOpacity>}</View><View style={styles.categoryGrid}>{categorias.map((category) => <TouchableOpacity key={category.id} style={styles.categoryButton} onPress={() => setSelectedCategory(category)}><Text style={styles.categoryText}>{category.nombre}</Text></TouchableOpacity>)}</View></View>}
        <Text style={styles.sectionTitle}>Detalle de la cuenta</Text><View style={styles.table}><View style={styles.tableHeader}><Text style={[styles.tableCell, styles.itemCell]}>Producto</Text><Text style={styles.tableCell}>Hora</Text><Text style={styles.tableCell}>Total</Text></View>{lineas.length === 0 ? <Text style={styles.noItems}>Aún no hay productos registrados.</Text> : lineas.map((line) => { const product = productos.find((item) => item.id === line.id_producto); const lineTotal = (line.subtotal || 0) * (1 - line.descuento / 100); return <View style={styles.tableRow} key={line.id}><Text style={[styles.tableCell, styles.itemCell]} numberOfLines={2}>{product?.nombre || `Producto ${line.id_producto}`} x{line.cantidad || 0}</Text><Text style={styles.tableCell}>{line.hora ? String(line.hora).slice(0, 5) : '--:--'}</Text><View><Text style={styles.tableCell}>{money(lineTotal)}</Text><TextInput style={styles.discountInput} keyboardType="numeric" placeholder="Desc. %" placeholderTextColor="#998C80" value={discounts[line.id] || ''} onChangeText={(value) => setDiscounts((current) => ({ ...current, [line.id]: value }))} /></View></View>; })}</View>
        <View style={styles.totals}><Text style={styles.totalLine}>Subtotal <Text style={styles.amount}>{money(subtotal)}</Text></Text><View style={styles.editLine}><Text style={styles.totalLine}>Propina (10%)</Text><TextInput style={styles.moneyInput} keyboardType="numeric" value={String(propina)} onChangeText={(value) => setPropina(Number(value) || 0)} /><TouchableOpacity onPress={() => setPropina(0)}><Trash2 size={17} color="#D98672" /></TouchableOpacity></View><View style={styles.editLine}><Text style={styles.totalLine}>Domicilio</Text><TextInput style={styles.moneyInput} keyboardType="numeric" value={domicilio} onChangeText={setDomicilio} /></View><View style={styles.grandTotal}><Text style={styles.grandLabel}>TOTAL A PAGAR</Text><Text style={styles.grandAmount}>{money(total)}</Text></View></View>
      </ScrollView>
      <View style={styles.actions}><TouchableOpacity style={styles.secondaryButton} onPress={cancelOrder} disabled={saving}><Text style={styles.cancelText}>Cancelar</Text></TouchableOpacity><TouchableOpacity style={styles.printButton} onPress={printBill} disabled={saving}><Printer size={18} color="#251D17" /><Text style={styles.printText}>Imprimir</Text></TouchableOpacity><TouchableOpacity style={styles.closeButton} onPress={() => saveBill(true)} disabled={saving}><Text style={styles.closeText}>{saving ? 'Guardando...' : 'Finalizar cuenta'}</Text></TouchableOpacity></View>
    </SafeAreaView></Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1D1A17' }, grid: { padding: 16, paddingBottom: 30 }, columns: { gap: 12 }, loader: { marginTop: 40 }, mesaCard: { flex: 1, minHeight: 150, backgroundColor: '#32281F', borderRadius: 12, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: '#45382E' }, activeCard: { borderColor: '#F0B35A' }, mesaLabel: { color: '#B8A99A', fontSize: 12, letterSpacing: 1.5 }, mesaNumber: { color: '#F5EBDD', fontSize: 36, fontWeight: '800', marginTop: 5 }, status: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, marginTop: 10, borderRadius: 4 }, statusActive: { backgroundColor: '#604332' }, statusFree: { backgroundColor: '#29483D' }, statusText: { color: '#F5EBDD', fontSize: 10, fontWeight: '700' }, elapsed: { color: '#F0B35A', fontSize: 11, marginTop: 9 }, empty: { alignItems: 'center', padding: 30 }, emptyText: { color: '#B8A99A' }, error: { color: '#E7A28C', textAlign: 'center' }, retry: { marginTop: 15, backgroundColor: '#F0B35A', padding: 10, borderRadius: 6 }, retryText: { color: '#251D17', fontWeight: '700' }, modal: { flex: 1, backgroundColor: '#1D1A17' }, modalHeader: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#45382E' }, modalKicker: { color: '#F0B35A', fontSize: 11, letterSpacing: 1.5 }, modalTitle: { color: '#F5EBDD', fontSize: 27, fontWeight: '800', marginTop: 3 }, activeTime: { paddingHorizontal: 20, paddingTop: 12, flexDirection: 'row', gap: 6, alignItems: 'center' }, activeTimeText: { color: '#C9B9A9' }, modalContent: { padding: 20, paddingBottom: 30 }, sectionTitle: { color: '#F5EBDD', fontSize: 18, fontWeight: '700', marginTop: 22, marginBottom: 12 }, categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, categoryButton: { backgroundColor: '#3A3027', borderColor: '#604D3A', borderWidth: 1, borderRadius: 7, padding: 13, minWidth: '46%' }, categoryText: { color: '#F5EBDD', fontWeight: '600' }, backButton: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 12 }, backText: { color: '#F0B35A', fontWeight: '600' }, productRow: { backgroundColor: '#32281F', borderBottomWidth: 1, borderBottomColor: '#4A3B30', padding: 14, flexDirection: 'row', justifyContent: 'space-between' }, productName: { color: '#F5EBDD', fontWeight: '700' }, productDescription: { color: '#AA9C8D', fontSize: 12, marginTop: 4 }, price: { color: '#F0B35A', fontWeight: '700' }, table: { borderWidth: 1, borderColor: '#45382E', borderRadius: 7, overflow: 'hidden' }, tableHeader: { backgroundColor: '#3A3027', padding: 10, flexDirection: 'row', justifyContent: 'space-between' }, tableRow: { padding: 10, borderTopWidth: 1, borderTopColor: '#45382E', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 5 }, tableCell: { color: '#E5D8C9', fontSize: 12, textAlign: 'right', minWidth: 45 }, itemCell: { flex: 1, textAlign: 'left', minWidth: 80 }, noItems: { color: '#998C80', padding: 16, textAlign: 'center' }, discountInput: { color: '#F0B35A', fontSize: 10, minWidth: 60, textAlign: 'right', borderBottomWidth: 1, borderBottomColor: '#70583E', paddingVertical: 2 }, totals: { marginTop: 18, gap: 10 }, totalLine: { color: '#C9B9A9', fontSize: 14 }, amount: { color: '#F5EBDD' }, editLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, moneyInput: { color: '#F5EBDD', backgroundColor: '#32281F', borderWidth: 1, borderColor: '#604D3A', borderRadius: 5, padding: 7, minWidth: 90, textAlign: 'right' }, grandTotal: { borderTopWidth: 1, borderTopColor: '#70583E', paddingTop: 14, marginTop: 5, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, grandLabel: { color: '#F0B35A', fontWeight: '800', letterSpacing: 1 }, grandAmount: { color: '#F0B35A', fontSize: 22, fontWeight: '800' }, actions: { padding: 14, borderTopWidth: 1, borderTopColor: '#45382E', flexDirection: 'row', gap: 7 }, secondaryButton: { padding: 13, justifyContent: 'center' }, cancelText: { color: '#D98672', fontWeight: '700' }, printButton: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#D9C29A', padding: 13, borderRadius: 6 }, printText: { color: '#251D17', fontWeight: '700' }, closeButton: { flex: 1, backgroundColor: '#F0B35A', padding: 13, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }, closeText: { color: '#251D17', fontWeight: '800' },
  mesaCardAlt: { backgroundColor: '#32281F', borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#45382E', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  cardHeader: { paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: '#F5F5F5', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
  imageContainer: { paddingHorizontal: 12, paddingBottom: 12 },
  foodImage: { height: 200, width: '100%' },
  foodImageStyle: { borderRadius: 12 },
  cardFooter: { paddingHorizontal: 14, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
