import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ban as Archive, Check, Edit3, Package, Plus, RotateCcw, Search, TriangleAlert, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HeaderNavbar from '../components/HeaderNavbar';
import { apiRequest, getAccessToken } from '../constants/api';

type Categoria = { id: number; nombre: string; estado?: boolean | null };
type Producto = { id: number; nombre?: string | null; descripcion?: string | null; cantidad?: number | null; precio?: number | null; id_categoria?: number | null; preparacion?: boolean | null; estado?: boolean | null };
type Grupo = { id: number; nombre: string; opciones?: unknown[] };
type Ingrediente = { id: number; nombre: string; estado?: boolean | null };
type ProductoIngrediente = { id: number; id_producto: number; id_ingrediente: number };
type ProductoGrupo = { id_producto: number; id_grupo_opcion: number };
type Pending = { item: Producto; nextState: boolean };

const money = (value?: number | null) => `$${Number(value || 0).toLocaleString('es-CO')}`;

export default function ProductosScreen() {
  const [items, setItems] = useState<Producto[]>([]);
  const [categories, setCategories] = useState<Categoria[]>([]);
  const [groups, setGroups] = useState<Grupo[]>([]);
  const [ingredients, setIngredients] = useState<Ingrediente[]>([]);
  const [productIngredients, setProductIngredients] = useState<ProductoIngrediente[]>([]);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState<Producto | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [preparation, setPreparation] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([]);
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<number[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const normalize = (item: Producto): Producto => ({ ...item, estado: item.estado === true });
  const load = useCallback(async () => {
    if (!getAccessToken()) { setError('Inicia sesión para consultar los productos.'); setLoading(false); return; }
    try {
      setError('');
      const [products, categoryData, groupData, ingredientData, productIngredientData] = await Promise.all([
        apiRequest<Producto[]>('/productos/'),
        apiRequest<Categoria[]>('/categorias/'),
        apiRequest<Grupo[]>('/grupos-opciones/'),
        apiRequest<Ingrediente[]>('/ingredientes/'),
        apiRequest<ProductoIngrediente[]>('/producto-ingredientes/'),
      ]);
      setItems(products.map(normalize));
      setCategories(categoryData.filter((item) => item.estado === true));
      setGroups(groupData);
      setIngredients(ingredientData.filter((item) => item.estado === true));
      setProductIngredients(productIngredientData);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'No fue posible cargar los productos.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => items.filter((item) => (item.nombre || '').toLowerCase().includes(search.trim().toLowerCase()) && (showAll || item.estado === true)), [items, search, showAll]);
  const openCreate = () => {
    setSelected(null); setName(''); setDescription(''); setQuantity(''); setPrice(''); setCategoryId(null);
    setPreparation(false); setSelectedGroupIds([]); setSelectedIngredientIds([]); setModal(true);
  };
  const openEdit = async (item: Producto) => {
    try {
      const currentGroups = await apiRequest<Grupo[]>(`/productos/${item.id}/grupos-opciones/`);
      setSelected(item); setName(item.nombre || ''); setDescription(item.descripcion || ''); setQuantity(String(item.cantidad || '')); setPrice(String(item.precio || '')); setCategoryId(item.id_categoria || null);
      setPreparation(item.preparacion === true);
      setSelectedGroupIds(currentGroups.map((group) => group.id));
      setSelectedIngredientIds(productIngredients.filter((relation) => relation.id_producto === item.id).map((relation) => relation.id_ingrediente));
      setModal(true);
    } catch (requestError) {
      Alert.alert('No se pudo cargar la configuración', requestError instanceof Error ? requestError.message : 'Intenta nuevamente.');
    }
  };

  const togglePreparation = () => {
    setPreparation((current) => {
      if (current) setSelectedIngredientIds([]);
      return !current;
    });
  };

  const toggleGroup = (groupId: number) => {
    setSelectedGroupIds((current) => current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]);
  };

  const toggleIngredient = (ingredientId: number) => {
    setSelectedIngredientIds((current) => current.includes(ingredientId) ? current.filter((id) => id !== ingredientId) : [...current, ingredientId]);
  };

  const syncRelations = async (productId: number) => {
    const currentIngredients = productIngredients.filter((relation) => relation.id_producto === productId);
    const desiredIngredients = preparation ? selectedIngredientIds : [];
    const ingredientDeletes = currentIngredients
      .filter((relation) => !desiredIngredients.includes(relation.id_ingrediente))
      .map((relation) => apiRequest(`/producto-ingredientes/${relation.id}`, { method: 'DELETE' }));
    const ingredientCreates = desiredIngredients
      .filter((ingredientId) => !currentIngredients.some((relation) => relation.id_ingrediente === ingredientId))
      .map((ingredientId) => apiRequest<ProductoIngrediente>('/producto-ingredientes/', { method: 'POST', body: JSON.stringify({ id_producto: productId, id_ingrediente: ingredientId }) }));

    const currentGroups = selected ? await apiRequest<Grupo[]>(`/productos/${productId}/grupos-opciones/`) : [];
    const currentGroupIds = currentGroups.map((group) => group.id);
    const groupDeletes = currentGroupIds
      .filter((groupId) => !selectedGroupIds.includes(groupId))
      .map((groupId) => apiRequest(`/productos/${productId}/grupos-opciones/${groupId}`, { method: 'DELETE' }));
    const groupCreates = selectedGroupIds
      .filter((groupId) => !currentGroupIds.includes(groupId))
      .map((groupId) => apiRequest<ProductoGrupo>('/producto-grupo-opcion/', { method: 'POST', body: JSON.stringify({ id_producto: productId, id_grupo_opcion: groupId }) }));

    await Promise.all(ingredientDeletes);
    const createdIngredients = await Promise.all(ingredientCreates);
    await Promise.all([...groupDeletes, ...groupCreates]);
    setProductIngredients((current) => [
      ...current.filter((relation) => relation.id_producto !== productId || desiredIngredients.includes(relation.id_ingrediente)),
      ...createdIngredients,
    ]);
  };

  const save = async () => {
    const value = name.trim();
    if (value.length < 3) return Alert.alert('Nombre inválido', 'El producto debe tener al menos 3 caracteres.');
    const payload = { nombre: value, descripcion: description.trim() || null, cantidad: Number(quantity) || null, precio: Number(price) || null, id_categoria: categoryId, preparacion: preparation };
    try {
      setSaving(true);
      const saved = selected ? await apiRequest<Producto>(`/productos/${selected.id}`, { method: 'PUT', body: JSON.stringify(payload) }) : await apiRequest<Producto>('/productos/', { method: 'POST', body: JSON.stringify(payload) });
      await syncRelations(saved.id);
      const normalized = normalize(saved);
      setItems((current) => selected ? current.map((item) => item.id === normalized.id ? normalized : item) : [normalized, ...current]);
      setModal(false); setSelected(null);
    } catch (requestError) { Alert.alert('No se pudo guardar', requestError instanceof Error ? requestError.message : 'Revisa los datos e intenta nuevamente.'); }
    finally { setSaving(false); }
  };

  const changeState = async () => {
    if (!pending) return;
    try {
      setSaving(true);
      const updated = await apiRequest<Producto>(`/productos/${pending.item.id}/estado?new_state=${pending.nextState}`, { method: 'PATCH' });
      setItems((current) => current.map((item) => item.id === updated.id ? normalize(updated) : item));
      setPending(null);
    } catch (requestError) { Alert.alert('No se pudo cambiar el estado', requestError instanceof Error ? requestError.message : 'Intenta nuevamente.'); }
    finally { setSaving(false); }
  };

  return <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}><HeaderNavbar /><View style={styles.header}><View><Text style={styles.kicker}>MENÚ</Text><Text style={styles.title}>Productos</Text><Text style={styles.subtitle}>Administra la oferta disponible.</Text></View><Pressable style={styles.addButton} onPress={openCreate}><Plus size={19} color="#251D17" /><Text style={styles.addText}>Nuevo</Text></Pressable></View><View style={styles.search}><Search size={18} color="#A99A8B" /><TextInput value={search} onChangeText={setSearch} placeholder="Buscar producto" placeholderTextColor="#998C80" style={styles.searchInput} /></View><View style={styles.filters}><Pressable style={[styles.filter, !showAll && styles.selectedFilter]} onPress={() => setShowAll(false)}><Text style={[styles.filterText, !showAll && styles.selectedText]}>Activos</Text></Pressable><Pressable style={[styles.filter, showAll && styles.selectedFilter]} onPress={() => setShowAll(true)}><Text style={[styles.filterText, showAll && styles.selectedText]}>Todos</Text></Pressable><Text style={styles.counter}>{visible.length} resultados</Text></View>{loading ? <ActivityIndicator color="#F0B35A" style={styles.loader} /> : error ? <View style={styles.empty}><Text style={styles.error}>{error}</Text><Pressable style={styles.retry} onPress={load}><Text style={styles.retryText}>Reintentar</Text></Pressable></View> : <FlatList data={visible} keyExtractor={(item) => String(item.id)} contentContainerStyle={styles.list} renderItem={({ item }) => <View style={[styles.row, item.estado !== true && styles.inactive]}><View style={styles.iconBox}><Package size={19} color="#F0B35A" /></View><View style={styles.content}><Text style={styles.name}>{item.nombre || 'Sin nombre'}</Text><Text style={styles.detail}>{money(item.precio)}{item.descripcion ? `  ·  ${item.descripcion}` : ''}</Text><View style={[styles.badge, item.estado === true ? styles.activeBadge : styles.inactiveBadge]}><Text style={styles.badgeText}>{item.estado === true ? 'ACTIVO' : 'INACTIVO'}</Text></View></View>{item.estado === true && <Pressable style={styles.iconButton} onPress={() => openEdit(item)}><Edit3 size={18} color="#F0B35A" /></Pressable>}<Pressable style={styles.iconButton} onPress={() => setPending({ item, nextState: item.estado !== true })}>{item.estado === true ? <Archive size={18} color="#D98672" /> : <RotateCcw size={18} color="#35C979" />}</Pressable></View>} ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No hay productos</Text><Text style={styles.emptyText}>Crea el primer producto para comenzar.</Text></View>} />}
    <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}><KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.modalCard}><View style={styles.modalHeader}><View><Text style={styles.kicker}>{selected ? 'EDITAR' : 'NUEVO REGISTRO'}</Text><Text style={styles.modalTitle}>{selected ? 'Editar producto' : 'Nuevo producto'}</Text></View><Pressable onPress={() => setModal(false)}><X size={23} color="#F5EBDD" /></Pressable></View><Text style={styles.label}>Nombre</Text><TextInput autoFocus value={name} onChangeText={setName} placeholder="Ej. Hamburguesa" placeholderTextColor="#998C80" style={styles.input} maxLength={50} /><Text style={styles.label}>Descripción</Text><TextInput value={description} onChangeText={setDescription} placeholder="Descripción breve" placeholderTextColor="#998C80" style={[styles.input, styles.multiline]} multiline maxLength={200} /><View style={styles.twoColumns}><View style={styles.column}><Text style={styles.label}>Cantidad</Text><TextInput value={quantity} onChangeText={setQuantity} placeholder="0" placeholderTextColor="#998C80" keyboardType="numeric" style={styles.input} /></View><View style={styles.column}><Text style={styles.label}>Precio</Text><TextInput value={price} onChangeText={setPrice} placeholder="0" placeholderTextColor="#998C80" keyboardType="decimal-pad" style={styles.input} /></View></View><Text style={styles.label}>Categoría</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>{categories.map((category) => <Pressable key={category.id} style={[styles.categoryChip, categoryId === category.id && styles.categoryChipSelected]} onPress={() => setCategoryId(category.id)}><Text style={[styles.categoryChipText, categoryId === category.id && styles.categoryChipTextSelected]}>{category.nombre}</Text></Pressable>)}</ScrollView><Text style={styles.label}>Grupo opcional</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>{groups.map((group) => <Pressable key={group.id} style={[styles.categoryChip, selectedGroupIds.includes(group.id) && styles.categoryChipSelected]} onPress={() => toggleGroup(group.id)}><Text style={[styles.categoryChipText, selectedGroupIds.includes(group.id) && styles.categoryChipTextSelected]}>{group.nombre}</Text></Pressable>)}</ScrollView><Pressable style={styles.preparation} onPress={togglePreparation}><View style={[styles.checkbox, preparation && styles.checkboxSelected]}>{preparation && <Check size={14} color="#251D17" />}</View><Text style={styles.preparationText}>Requiere preparación</Text></Pressable>{preparation && <View style={styles.ingredientsSection}><Text style={styles.label}>Ingredientes</Text>{ingredients.length === 0 ? <Text style={styles.helperText}>No hay ingredientes activos.</Text> : ingredients.map((ingredient) => { const checked = selectedIngredientIds.includes(ingredient.id); return <Pressable key={ingredient.id} style={styles.ingredientRow} onPress={() => toggleIngredient(ingredient.id)}><View style={[styles.checkbox, checked && styles.checkboxSelected]}>{checked && <Check size={14} color="#251D17" />}</View><Text style={styles.ingredientText}>{ingredient.nombre}</Text></Pressable>; })}</View>}<Pressable style={styles.saveButton} onPress={save} disabled={saving}>{saving ? <ActivityIndicator color="#251D17" /> : <><Check size={18} color="#251D17" /><Text style={styles.saveText}>{selected ? 'Guardar cambios' : 'Crear producto'}</Text></>}</Pressable></ScrollView></KeyboardAvoidingView></Modal>
    <Modal visible={pending !== null} transparent animationType="fade" onRequestClose={() => setPending(null)}><View style={styles.confirmBackdrop}><View style={styles.confirmCard}><View style={[styles.alertIcon, pending?.nextState ? styles.greenBg : styles.redBg]}><TriangleAlert size={28} color={pending?.nextState ? '#35C979' : '#F05245'} /></View><Text style={styles.confirmTitle}>{pending?.nextState ? 'Reactivar producto' : 'Desactivar producto'}</Text><Text style={styles.confirmText}>¿Está seguro de que desea {pending?.nextState ? 'reactivar' : 'desactivar'} el producto &quot;{pending?.item.nombre}&quot;?</Text><View style={styles.actions}><Pressable style={styles.cancelButton} onPress={() => setPending(null)}><Text style={styles.cancelText}>Cancelar</Text></Pressable><Pressable style={[styles.confirmButton, pending?.nextState ? styles.reactivate : styles.deactivate]} onPress={changeState} disabled={saving}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.confirmButtonText}>{pending?.nextState ? 'Reactivar' : 'Desactivar'}</Text>}</Pressable></View></View></View></Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#1D1A17' }, header: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }, kicker: { color: '#F0B35A', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 }, title: { color: '#F5EBDD', fontSize: 30, fontWeight: '800', marginTop: 4 }, subtitle: { color: '#B8A99A', marginTop: 5 }, addButton: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#F0B35A', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 7 }, addText: { color: '#251D17', fontWeight: '800' }, search: { marginHorizontal: 20, height: 48, borderRadius: 8, borderWidth: 1, borderColor: '#4A3D31', backgroundColor: '#2D2620', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 9 }, searchInput: { flex: 1, color: '#F5EBDD', fontSize: 15 }, filters: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 16 }, filter: { paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: '#4A3D31', borderRadius: 6 }, selectedFilter: { backgroundColor: '#F0B35A', borderColor: '#F0B35A' }, filterText: { color: '#B8A99A', fontWeight: '700', fontSize: 12 }, selectedText: { color: '#251D17' }, counter: { marginLeft: 'auto', color: '#87796C', fontSize: 12 }, loader: { marginTop: 40 }, list: { paddingHorizontal: 20, paddingBottom: 30 }, row: { minHeight: 86, padding: 13, marginBottom: 10, borderRadius: 10, borderWidth: 1, borderColor: '#45382E', backgroundColor: '#32281F', flexDirection: 'row', alignItems: 'center' }, inactive: { opacity: 0.65 }, iconBox: { width: 42, height: 42, borderRadius: 8, backgroundColor: '#604332', alignItems: 'center', justifyContent: 'center' }, content: { flex: 1, marginLeft: 12, gap: 5 }, name: { color: '#F5EBDD', fontSize: 16, fontWeight: '700' }, detail: { color: '#B8A99A', fontSize: 12 }, badge: { alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 }, activeBadge: { backgroundColor: '#29483D' }, inactiveBadge: { backgroundColor: '#49362F' }, badgeText: { color: '#EBDCCE', fontSize: 9, fontWeight: '800', letterSpacing: 0.7 }, iconButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }, empty: { alignItems: 'center', padding: 35 }, emptyTitle: { color: '#F5EBDD', fontSize: 17, fontWeight: '700' }, emptyText: { color: '#B8A99A', marginTop: 8, textAlign: 'center' }, error: { color: '#E7A28C', textAlign: 'center' }, retry: { backgroundColor: '#F0B35A', padding: 10, borderRadius: 6, marginTop: 15 }, retryText: { color: '#251D17', fontWeight: '800' }, modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' }, modalCard: { backgroundColor: '#32281F', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 22, paddingBottom: 34 }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22 }, modalTitle: { color: '#F5EBDD', fontSize: 23, fontWeight: '800', marginTop: 4 }, label: { color: '#F5EBDD', fontWeight: '700', marginBottom: 8, marginTop: 10 }, input: { height: 48, borderWidth: 1, borderColor: '#604D3A', borderRadius: 8, color: '#F5EBDD', backgroundColor: '#2D2620', paddingHorizontal: 14, fontSize: 16 }, multiline: { height: 70, paddingTop: 12, textAlignVertical: 'top' }, twoColumns: { flexDirection: 'row', gap: 10 }, column: { flex: 1 }, categoryList: { gap: 8, paddingBottom: 4 }, categoryChip: { borderWidth: 1, borderColor: '#604D3A', borderRadius: 6, paddingHorizontal: 11, paddingVertical: 8 }, categoryChipSelected: { backgroundColor: '#F0B35A', borderColor: '#F0B35A' }, categoryChipText: { color: '#B8A99A', fontSize: 12, fontWeight: '700' }, categoryChipTextSelected: { color: '#251D17' }, preparation: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 18 }, ingredientsSection: { marginTop: 8 }, ingredientRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8 }, ingredientText: { color: '#F5EBDD', flex: 1 }, helperText: { color: '#998C80', fontSize: 12 }, checkbox: { width: 22, height: 22, borderWidth: 1, borderColor: '#806B55', borderRadius: 4, alignItems: 'center', justifyContent: 'center' }, checkboxSelected: { backgroundColor: '#F0B35A', borderColor: '#F0B35A' }, preparationText: { color: '#F5EBDD', fontWeight: '600' }, saveButton: { height: 50, marginTop: 22, borderRadius: 7, backgroundColor: '#F0B35A', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }, saveText: { color: '#251D17', fontWeight: '800' }, confirmBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.72)' }, confirmCard: { width: '88%', maxWidth: 500, backgroundColor: '#32281F', borderWidth: 1, borderColor: '#604D3A', borderRadius: 18, padding: 28, alignItems: 'center' }, alertIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }, greenBg: { backgroundColor: '#29483D' }, redBg: { backgroundColor: '#57352F' }, confirmTitle: { color: '#F5EBDD', fontSize: 24, fontWeight: '800', textAlign: 'center' }, confirmText: { color: '#C9B9A9', fontSize: 16, lineHeight: 23, textAlign: 'center', marginTop: 12 }, actions: { flexDirection: 'row', gap: 12, marginTop: 25, width: '100%' }, cancelButton: { flex: 1, height: 50, borderRadius: 8, borderWidth: 1, borderColor: '#604D3A', alignItems: 'center', justifyContent: 'center' }, cancelText: { color: '#F5EBDD', fontWeight: '700' }, confirmButton: { flex: 1, height: 50, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, deactivate: { backgroundColor: '#F05245' }, reactivate: { backgroundColor: '#35C979' }, confirmButtonText: { color: '#FFFFFF', fontWeight: '800' } });
