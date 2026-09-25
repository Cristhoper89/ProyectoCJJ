import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, ImageBackground, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Print from 'expo-print';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Clock3, Minus, Plus, Printer, Trash2, X } from 'lucide-react-native';
import HeaderNavbar from '../components/HeaderNavbar';
import { apiRequest, getAccessToken } from '../constants/api';

type Mesa = { id: number; nombre?: string | null; estado?: boolean; tipo?: 'barra' | 'mesa' | null; hora_inicio?: string | null; id_mov?: number | null };
type Categoria = { id: number; nombre: string; estado?: boolean };
type Producto = { id: number; nombre?: string; descripcion?: string; precio?: number; id_categoria?: number; preparacion?: boolean; estado?: boolean };
type Ingredient = { id: number; nombre: string; estado?: boolean };
type ProductIngredient = { id: number; id_producto: number; id_ingrediente: number };
type Option = { id: number; id_grupo_opcion: number; nombre: string };
type OptionGroup = { id: number; nombre: string; opciones: Option[] };
type Consumo = { id: number; id_producto?: number; id_mov?: number | null; cantidad?: number; precio_unitario?: number; subtotal?: number; notas?: string | null };
type Movimiento = { id: number; estado?: boolean; propina?: number; domicilio?: number; total?: number; id_mesa?: number | null; metodo?: string | null };
type Linea = Consumo & { descuento: number };

const money = (value: number) => `$${Math.round(value).toLocaleString('es-CO')}`;

export default function MesaScreen() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ingredientes, setIngredientes] = useState<Ingredient[]>([]);
  const [productoIngredientes, setProductoIngredientes] = useState<ProductIngredient[]>([]);
  const [consumos, setConsumos] = useState<Consumo[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);
  const [selectedMovimiento, setSelectedMovimiento] = useState<Movimiento | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Categoria | null>(null);
  const [propina, setPropina] = useState(0);
  const [domicilio, setDomicilio] = useState('0');
  const [discounts, setDiscounts] = useState<Record<number, string>>({});
  const [productQuantities, setProductQuantities] = useState<Record<number, number>>({});
  const [configProduct, setConfigProduct] = useState<Producto | null>(null);
  const [configQuantity, setConfigQuantity] = useState(1);
  const [configIngredients, setConfigIngredients] = useState<Record<number, boolean>>({});
  const [configGroups, setConfigGroups] = useState<OptionGroup[]>([]);
  const [configOptions, setConfigOptions] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const loadData = async () => {
    if (!getAccessToken()) { setError('Inicia sesión para consultar las mesas.'); setLoading(false); return; }
    try {
      setError('');
      const [mesaResult, categoryResult, productResult, ingredientResult, productIngredientResult, consumptionResult, movimientoResult] = await Promise.allSettled([
        apiRequest<Mesa[]>('/mesas/'),
        apiRequest<Categoria[]>('/categorias/'),
        apiRequest<Producto[]>('/productos/'),
        apiRequest<Ingredient[]>('/ingredientes/'),
        apiRequest<ProductIngredient[]>('/producto-ingredientes/'),
        apiRequest<Consumo[]>('/mesasC/'),
        apiRequest<Movimiento[]>('/movimientos/'),
      ]);

      const mesaData = mesaResult.status === 'fulfilled' ? mesaResult.value : [];
      const categoryData = categoryResult.status === 'fulfilled' ? categoryResult.value : [];
      const productData = productResult.status === 'fulfilled' ? productResult.value : [];
      const ingredientData = ingredientResult.status === 'fulfilled' ? ingredientResult.value : [];
      const productIngredientData = productIngredientResult.status === 'fulfilled' ? productIngredientResult.value : [];
      const consumptionData = consumptionResult.status === 'fulfilled' ? consumptionResult.value : [];
      const movimientoData = movimientoResult.status === 'fulfilled' ? movimientoResult.value : [];

      setMesas(mesaData);
      setCategorias(categoryData.filter((category) => category.estado !== false));
      setProductos(productData.filter((product) => product.estado !== false));
      setIngredientes(ingredientData.filter((ingredient) => ingredient.estado !== false));
      setProductoIngredientes(productIngredientData);
      setConsumos(consumptionData);
      setMovimientos(movimientoData);

      const failed = [mesaResult, categoryResult, productResult, ingredientResult, productIngredientResult, consumptionResult, movimientoResult].filter((result) => result.status === 'rejected');
      if (failed.length > 0) {
        const firstMessage = failed[0].reason instanceof Error ? failed[0].reason.message : 'El backend respondió con un error.';
        setError(firstMessage);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No fue posible cargar las mesas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const activeMovementId = selectedMesa?.tipo === 'barra' ? selectedMovimiento?.id : selectedMesa?.id_mov;
  const mesaConsumos = useMemo(() => consumos.filter((consumo) => consumo.id_mov === activeMovementId && (consumo.subtotal || 0) > 0), [consumos, activeMovementId]);
  const lineas = useMemo<Linea[]>(() => mesaConsumos.map((consumo) => ({ ...consumo, descuento: Math.min(100, Math.max(0, Number(discounts[consumo.id] || 0))) })), [mesaConsumos, discounts]);
  const subtotal = lineas.reduce((sum, line) => sum + (line.subtotal || 0) * (1 - line.descuento / 100), 0);
  const total = subtotal + propina + Math.max(0, Number(domicilio) || 0);

  const openMesa = (mesa: Mesa) => {
    const currentMovement = mesa.tipo === 'barra'
      ? [...movimientos].filter((movimiento) => movimiento.id_mesa === mesa.id).slice(-1)[0] || null
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

  const prepareProduct = async (product: Producto, quantity: number) => {
    try {
      const groups = await apiRequest<OptionGroup[]>(`/productos/${product.id}/grupos-opciones/`);
      const ingredientIds = productoIngredientes
        .filter((relation) => relation.id_producto === product.id)
        .map((relation) => relation.id_ingrediente);
      if (!product.preparacion && groups.length === 0) {
        await addProduct(product, quantity);
        return;
      }
      setConfigProduct(product);
      setConfigQuantity(quantity);
      setConfigGroups(groups);
      setConfigOptions({});
      setConfigIngredients(Object.fromEntries(ingredientIds.map((id) => [id, true])));
    } catch (requestError) {
      Alert.alert('No se pudo cargar la configuración', requestError instanceof Error ? requestError.message : 'Intenta nuevamente.');
    }
  };

  const addProduct = async (
    product: Producto,
    requestedQuantity: number,
    selectedIngredients?: Record<number, boolean>,
    selectedGroups?: OptionGroup[],
    selectedOptions?: Record<number, number>,
  ) => {
    if (!selectedMesa) return;
    const quantity = Math.max(1, Math.floor(requestedQuantity));
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
      const optionNotes = (selectedGroups || [])
        .map((group) => {
          const optionId = selectedOptions?.[group.id];
          return group.opciones.find((option) => option.id === optionId)?.nombre
            ? `${group.nombre}: ${group.opciones.find((option) => option.id === optionId)?.nombre}`
            : null;
        })
        .filter(Boolean)
        .join('; ');
      const defaultIngredients = product.preparacion
        ? Object.fromEntries(productoIngredientes
            .filter((relation) => relation.id_producto === product.id)
            .map((relation) => [relation.id_ingrediente, true]))
        : undefined;
      const ingredientActions = (selectedIngredients || defaultIngredients)
        ? Object.entries(selectedIngredients || defaultIngredients || {}).map(([ingredientId, included]) => ({
            id_ingrediente: Number(ingredientId),
            accion: included ? 'mantener' : 'quitar',
          }))
        : [];
      const newConsumption = await apiRequest<Consumo>('/mesasC/', { method: 'POST', body: JSON.stringify({ id_producto: product.id, id_mov: movementId, cantidad: quantity, notas: optionNotes || null, ingredientes: ingredientActions }) });
      setConsumos((current) => [...current, newConsumption]);
      setProductQuantities((current) => ({ ...current, [product.id]: 1 }));
      setConfigProduct(null);
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
    const minutes = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60000));
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m activa`;
  };

  return <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
    <HeaderNavbar />
    {loading ? <ActivityIndicator color="#F0B35A" style={styles.loader} /> : error ? <View style={styles.empty}><Text style={styles.error}>{error}</Text><TouchableOpacity style={styles.retry} onPress={loadData}><Text style={styles.retryText}>Reintentar</Text></TouchableOpacity></View> : <FlatList data={mesas} keyExtractor={(mesa) => String(mesa.id)} contentContainerStyle={styles.grid} renderItem={({ item: mesa }) => { const active = mesa.estado === true; const title = mesa.nombre || (mesa.tipo === 'barra' ? 'Barra' : `Mesa ${mesa.id}`); return <TouchableOpacity style={[styles.mesaCard, active && styles.activeCard]} onPress={() => openMesa(mesa)} activeOpacity={0.85}><View style={styles.cardHeader}><Text style={styles.cardTitle}>{title.toUpperCase()}</Text></View><View style={styles.imageContainer}><ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80' }} style={styles.foodImage} imageStyle={styles.foodImageStyle} /></View><View style={styles.cardFooter}><View style={[styles.status, active ? styles.statusActive : styles.statusFree]}><Text style={styles.statusText}>{active ? 'ACTIVA' : 'DISPONIBLE'}</Text></View>{active && <Text style={styles.elapsed}>{elapsed(mesa.hora_inicio)}</Text>}</View></TouchableOpacity>; }} ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>No hay mesas registradas.</Text></View>} />}

    <Modal visible={!!selectedMesa} animationType="slide" onRequestClose={() => setSelectedMesa(null)}><SafeAreaView style={styles.modal}>
      <View style={styles.modalHeader}><View><Text style={styles.modalKicker}>CUENTA</Text><Text style={styles.modalTitle}>{selectedMesa?.nombre || (selectedMesa?.tipo === 'barra' ? 'Barra' : `Mesa ${selectedMesa?.id}`)}</Text></View><Pressable onPress={() => { setSelectedMesa(null); setSelectedMovimiento(null); }}><X color="#F5EBDD" size={25} /></Pressable></View>
      <View style={styles.activeTime}><Clock3 size={15} color="#F0B35A" /><Text style={styles.activeTimeText}>{elapsed(selectedMesa?.hora_inicio)}</Text></View>
      <ScrollView contentContainerStyle={styles.modalContent}>
        {selectedCategory ? <View><Pressable style={styles.backButton} onPress={() => setSelectedCategory(null)}><ChevronLeft color="#F0B35A" size={18} /><Text style={styles.backText}>Categorías</Text></Pressable><Text style={styles.sectionTitle}>{selectedCategory.nombre}</Text>{productos.filter((product) => product.id_categoria === selectedCategory.id).map((product) => { const quantity = productQuantities[product.id] || 1; return <View key={product.id} style={styles.productRow}><View style={styles.productInfo}><Text style={styles.productName}>{product.nombre}</Text><Text style={styles.productDescription}>{product.descripcion || 'Producto disponible'}</Text><TouchableOpacity onPress={() => prepareProduct(product, quantity)} disabled={saving}><Text style={styles.configureHint}>+ Personalizar ingredientes / opciones</Text></TouchableOpacity><Text style={styles.price}>{money(product.precio || 0)}</Text></View><View style={styles.productActions}><View style={styles.quantityControl}><TouchableOpacity style={styles.quantityButton} onPress={() => setProductQuantities((current) => ({ ...current, [product.id]: Math.max(1, quantity - 1) }))} disabled={saving}><Minus size={16} color="#F5EBDD" /></TouchableOpacity><Text style={styles.quantityText}>{quantity}</Text><TouchableOpacity style={styles.quantityButton} onPress={() => setProductQuantities((current) => ({ ...current, [product.id]: quantity + 1 }))} disabled={saving}><Plus size={16} color="#F5EBDD" /></TouchableOpacity></View><TouchableOpacity style={styles.addProductButton} onPress={() => addProduct(product, quantity)} disabled={saving}><Text style={styles.addProductText}>Agregar</Text></TouchableOpacity></View></View>; })}</View> : <View><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={styles.sectionTitle}>Agregar productos</Text>{selectedMesa?.tipo === 'barra' && <TouchableOpacity style={{ backgroundColor: '#604332', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, marginTop: 10 }} onPress={createBarMovement} disabled={saving}><Text style={{ color: '#F5EBDD', fontSize: 12, fontWeight: '700' }}>Nuevo movimiento</Text></TouchableOpacity>}</View><View style={styles.categoryGrid}>{categorias.map((category) => <TouchableOpacity key={category.id} style={styles.categoryButton} onPress={() => setSelectedCategory(category)}><Text style={styles.categoryText}>{category.nombre}</Text></TouchableOpacity>)}</View></View>}
        <Text style={styles.sectionTitle}>Detalle de la cuenta</Text><View style={styles.table}><View style={styles.tableHeader}><Text style={[styles.tableCell, styles.itemCell]}>Producto</Text><Text style={styles.tableCell}>Cant.</Text><Text style={styles.tableCell}>Total</Text></View>{lineas.length === 0 ? <Text style={styles.noItems}>Aún no hay productos registrados.</Text> : lineas.map((line) => { const product = productos.find((item) => item.id === line.id_producto); const lineTotal = (line.subtotal || 0) * (1 - line.descuento / 100); return <View style={styles.tableRow} key={line.id}><Text style={[styles.tableCell, styles.itemCell]} numberOfLines={2}>{product?.nombre || `Producto ${line.id_producto}`}</Text><Text style={styles.tableCell}>{line.cantidad || 0}</Text><View><Text style={styles.tableCell}>{money(lineTotal)}</Text><TextInput style={styles.discountInput} keyboardType="numeric" placeholder="Desc. %" placeholderTextColor="#998C80" value={discounts[line.id] || ''} onChangeText={(value) => setDiscounts((current) => ({ ...current, [line.id]: value }))} /></View></View>; })}</View>
        <View style={styles.totals}><Text style={styles.totalLine}>Subtotal <Text style={styles.amount}>{money(subtotal)}</Text></Text><View style={styles.editLine}><Text style={styles.totalLine}>Propina (10%)</Text><TextInput style={styles.moneyInput} keyboardType="numeric" value={String(propina)} onChangeText={(value) => setPropina(Number(value) || 0)} /><TouchableOpacity onPress={() => setPropina(0)}><Trash2 size={17} color="#D98672" /></TouchableOpacity></View><View style={styles.editLine}><Text style={styles.totalLine}>Domicilio</Text><TextInput style={styles.moneyInput} keyboardType="numeric" value={domicilio} onChangeText={setDomicilio} /></View><View style={styles.grandTotal}><Text style={styles.grandLabel}>TOTAL A PAGAR</Text><Text style={styles.grandAmount}>{money(total)}</Text></View></View>
      </ScrollView>
      <View style={styles.actions}><TouchableOpacity style={styles.secondaryButton} onPress={cancelOrder} disabled={saving}><Text style={styles.cancelText}>Cancelar</Text></TouchableOpacity><TouchableOpacity style={styles.printButton} onPress={printBill} disabled={saving}><Printer size={18} color="#251D17" /><Text style={styles.printText}>Imprimir</Text></TouchableOpacity><TouchableOpacity style={styles.closeButton} onPress={() => saveBill(true)} disabled={saving}><Text style={styles.closeText}>{saving ? 'Guardando...' : 'Finalizar cuenta'}</Text></TouchableOpacity></View>
    </SafeAreaView></Modal>
    <Modal visible={!!configProduct} animationType="fade" transparent onRequestClose={() => setConfigProduct(null)}>
      <View style={styles.configOverlay}>
        <View style={styles.configModal}>
          <View style={styles.configHeader}>
            <View style={styles.productInfo}>
              <Text style={styles.configTitle}>Modificar: {configProduct?.nombre}</Text>
              <Text style={styles.productDescription}>{configProduct?.descripcion || 'Personaliza este producto.'}</Text>
            </View>
            <Pressable onPress={() => setConfigProduct(null)}><X color="#F5EBDD" size={22} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.configContent}>
            {configProduct?.preparacion && <View>
              <Text style={styles.configSectionTitle}>Ingredientes principales</Text>
              {productoIngredientes.filter((relation) => relation.id_producto === configProduct.id).map((relation) => {
                const ingredient = ingredientes.find((item) => item.id === relation.id_ingrediente);
                if (!ingredient) return null;
                const checked = configIngredients[ingredient.id] !== false;
                return <Pressable key={ingredient.id} style={styles.ingredientRow} onPress={() => setConfigIngredients((current) => ({ ...current, [ingredient.id]: !checked }))}>
                  <View style={[styles.checkbox, checked && styles.checkboxChecked]}>{checked && <Text style={styles.checkboxMark}>✓</Text>}</View>
                  <Text style={styles.ingredientName}>{ingredient.nombre}</Text>
                </Pressable>;
              })}
            </View>}
            {configGroups.map((group) => <View key={group.id} style={styles.optionGroup}>
              <Text style={styles.configSectionTitle}>Seleccionar {group.nombre}</Text>
              {group.opciones.map((option) => {
                const selected = configOptions[group.id] === option.id;
                return <Pressable key={option.id} style={[styles.optionRow, selected && styles.optionRowSelected]} onPress={() => setConfigOptions((current) => ({ ...current, [group.id]: option.id }))}>
                  <View style={[styles.radio, selected && styles.radioSelected]} />
                  <Text style={styles.optionName}>{option.nombre}</Text>
                </Pressable>;
              })}
            </View>)}
          </ScrollView>
          <View style={styles.configActions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setConfigProduct(null)} disabled={saving}><Text style={styles.cancelText}>Cancelar</Text></TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={() => {
              if (!configProduct) return;
              addProduct(configProduct, configQuantity, configIngredients, configGroups, configOptions);
            }} disabled={saving}><Text style={styles.closeText}>{saving ? 'Guardando...' : 'Agregar producto'}</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  configOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.65)', justifyContent: 'center', padding: 18 },
  configModal: { maxHeight: '85%', backgroundColor: '#29231E', borderRadius: 10, borderWidth: 1, borderColor: '#604D3A', overflow: 'hidden' },
  configHeader: { padding: 18, flexDirection: 'row', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: '#45382E' },
  configTitle: { color: '#F5EBDD', fontSize: 20, fontWeight: '800', marginBottom: 5 },
  configContent: { padding: 18 },
  configSectionTitle: { color: '#F5EBDD', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  checkbox: { width: 24, height: 24, borderRadius: 4, borderWidth: 1, borderColor: '#998C80', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  checkboxChecked: { backgroundColor: '#F0B35A', borderColor: '#F0B35A' },
  checkboxMark: { color: '#251D17', fontSize: 18, fontWeight: '900' },
  ingredientName: { color: '#F5EBDD', fontSize: 16 },
  optionGroup: { marginTop: 18 },
  optionRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#604D3A', borderRadius: 6, padding: 11, marginBottom: 8 },
  optionRowSelected: { backgroundColor: '#604332', borderColor: '#F0B35A' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#998C80', marginRight: 10 },
  radioSelected: { backgroundColor: '#F0B35A', borderColor: '#F0B35A' },
  optionName: { color: '#F5EBDD', fontSize: 15 },
  configActions: { flexDirection: 'row', gap: 10, padding: 14, borderTopWidth: 1, borderTopColor: '#45382E' },
  configureHint: { color: '#F0B35A', fontSize: 13, marginTop: 5, textDecorationLine: 'underline' },
  productInfo: { flex: 1, paddingRight: 10 },
  productActions: { alignItems: 'flex-end', gap: 8 },
  quantityControl: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#604332', borderRadius: 6, overflow: 'hidden' },
  quantityButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  quantityText: { color: '#F5EBDD', minWidth: 28, textAlign: 'center', fontSize: 15, fontWeight: '700' },
  addProductButton: { backgroundColor: '#F0B35A', borderRadius: 5, paddingHorizontal: 12, paddingVertical: 7 },
  addProductText: { color: '#251D17', fontSize: 12, fontWeight: '800' },
  container: { flex: 1, backgroundColor: '#1D1A17' }, grid: { padding: 16, paddingBottom: 30 }, columns: { gap: 12 }, loader: { marginTop: 40 }, mesaCard: { flex: 1, minHeight: 150, backgroundColor: '#32281F', borderRadius: 12, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: '#45382E' }, activeCard: { borderColor: '#F0B35A' }, mesaLabel: { color: '#B8A99A', fontSize: 12, letterSpacing: 1.5 }, mesaNumber: { color: '#F5EBDD', fontSize: 36, fontWeight: '800', marginTop: 5 }, status: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, marginTop: 10, borderRadius: 4 }, statusActive: { backgroundColor: '#604332' }, statusFree: { backgroundColor: '#29483D' }, statusText: { color: '#F5EBDD', fontSize: 10, fontWeight: '700' }, elapsed: { color: '#F0B35A', fontSize: 11, marginTop: 9 }, empty: { alignItems: 'center', padding: 30 }, emptyText: { color: '#B8A99A' }, error: { color: '#E7A28C', textAlign: 'center' }, retry: { marginTop: 15, backgroundColor: '#F0B35A', padding: 10, borderRadius: 6 }, retryText: { color: '#251D17', fontWeight: '700' }, modal: { flex: 1, backgroundColor: '#1D1A17' }, modalHeader: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#45382E' }, modalKicker: { color: '#F0B35A', fontSize: 11, letterSpacing: 1.5 }, modalTitle: { color: '#F5EBDD', fontSize: 27, fontWeight: '800', marginTop: 3 }, activeTime: { paddingHorizontal: 20, paddingTop: 12, flexDirection: 'row', gap: 6, alignItems: 'center' }, activeTimeText: { color: '#C9B9A9' }, modalContent: { padding: 20, paddingBottom: 30 }, sectionTitle: { color: '#F5EBDD', fontSize: 18, fontWeight: '700', marginTop: 22, marginBottom: 12 }, categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, categoryButton: { backgroundColor: '#3A3027', borderColor: '#604D3A', borderWidth: 1, borderRadius: 7, padding: 13, minWidth: '46%' }, categoryText: { color: '#F5EBDD', fontWeight: '600' }, backButton: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 12 }, backText: { color: '#F0B35A', fontWeight: '600' }, productRow: { backgroundColor: '#32281F', borderBottomWidth: 1, borderBottomColor: '#4A3B30', padding: 14, flexDirection: 'row', justifyContent: 'space-between' }, productName: { color: '#F5EBDD', fontWeight: '700' }, productDescription: { color: '#AA9C8D', fontSize: 12, marginTop: 4 }, price: { color: '#F0B35A', fontWeight: '700' }, table: { borderWidth: 1, borderColor: '#45382E', borderRadius: 7, overflow: 'hidden' }, tableHeader: { backgroundColor: '#3A3027', padding: 10, flexDirection: 'row', justifyContent: 'space-between' }, tableRow: { padding: 10, borderTopWidth: 1, borderTopColor: '#45382E', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 5 }, tableCell: { color: '#E5D8C9', fontSize: 12, textAlign: 'right', minWidth: 45 }, itemCell: { flex: 1, textAlign: 'left', minWidth: 80 }, noItems: { color: '#998C80', padding: 16, textAlign: 'center' }, discountInput: { color: '#F0B35A', fontSize: 10, minWidth: 60, textAlign: 'right', borderBottomWidth: 1, borderBottomColor: '#70583E', paddingVertical: 2 }, totals: { marginTop: 18, gap: 10 }, totalLine: { color: '#C9B9A9', fontSize: 14 }, amount: { color: '#F5EBDD' }, editLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, moneyInput: { color: '#F5EBDD', backgroundColor: '#32281F', borderWidth: 1, borderColor: '#604D3A', borderRadius: 5, padding: 7, minWidth: 90, textAlign: 'right' }, grandTotal: { borderTopWidth: 1, borderTopColor: '#70583E', paddingTop: 14, marginTop: 5, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, grandLabel: { color: '#F0B35A', fontWeight: '800', letterSpacing: 1 }, grandAmount: { color: '#F0B35A', fontSize: 22, fontWeight: '800' }, actions: { padding: 14, borderTopWidth: 1, borderTopColor: '#45382E', flexDirection: 'row', gap: 7 }, secondaryButton: { padding: 13, justifyContent: 'center' }, cancelText: { color: '#D98672', fontWeight: '700' }, printButton: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#D9C29A', padding: 13, borderRadius: 6 }, printText: { color: '#251D17', fontWeight: '700' }, closeButton: { flex: 1, backgroundColor: '#F0B35A', padding: 13, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }, closeText: { color: '#251D17', fontWeight: '800' },
  mesaCardAlt: { backgroundColor: '#32281F', borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#45382E', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  cardHeader: { paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: '#F5F5F5', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
  imageContainer: { paddingHorizontal: 12, paddingBottom: 12 },
  foodImage: { height: 200, width: '100%' },
  foodImageStyle: { borderRadius: 12 },
  cardFooter: { paddingHorizontal: 14, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
