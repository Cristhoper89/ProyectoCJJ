import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Archive, Check, Edit3, Plus, RotateCcw, Search, TriangleAlert, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HeaderNavbar from '../components/HeaderNavbar';
import { apiRequest, getAccessToken } from '../constants/api';

type Ingrediente = { id: number; nombre: string; estado: boolean };
type Filter = 'active' | 'all';
type PendingStateChange = { item: Ingrediente; nextState: boolean };

export default function IngredientesScreen() {
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('active');
  const [selected, setSelected] = useState<Ingrediente | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [pendingStateChange, setPendingStateChange] = useState<PendingStateChange | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadIngredientes = async () => {
    if (!getAccessToken()) {
      setError('Inicia sesión para consultar los ingredientes.');
      setLoading(false);
      return;
    }
    try {
      setError('');
      const response = await apiRequest<Array<Ingrediente & { estado?: boolean | null }>>('/ingredientes/');
      setIngredientes(response.map((item) => ({ ...item, estado: item.estado === true })));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No fue posible cargar los ingredientes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadIngredientes(); }, []);

  const visibleIngredientes = useMemo(() => ingredientes.filter((item) => {
    const matchesSearch = item.nombre.toLowerCase().includes(search.trim().toLowerCase());
    return matchesSearch && (filter === 'all' || item.estado);
  }), [filter, ingredientes, search]);

  const openCreate = () => { setSelected(null); setName(''); setModalVisible(true); };
  const openEdit = (item: Ingrediente) => { setSelected(item); setName(item.nombre); setModalVisible(true); };

  const save = async () => {
    const cleanName = name.trim();
    if (!cleanName) return Alert.alert('Falta el nombre', 'Escribe un nombre para el ingrediente.');
    try {
      setSaving(true);
      const saved = selected
        ? await apiRequest<Ingrediente>(`/ingredientes/${selected.id}`, { method: 'PUT', body: JSON.stringify({ nombre: cleanName }) })
        : await apiRequest<Ingrediente>('/ingredientes/', { method: 'POST', body: JSON.stringify({ nombre: cleanName }) });
      setIngredientes((current) => selected ? current.map((item) => item.id === saved.id ? { ...saved, estado: saved.estado === true } : item) : [{ ...saved, estado: saved.estado === true }, ...current]);
      setSelected(null);
      setModalVisible(false);
    } catch (requestError) {
      Alert.alert('No se pudo guardar', requestError instanceof Error ? requestError.message : 'Intenta nuevamente.');
    } finally { setSaving(false); }
  };

  const requestStateChange = (item: Ingrediente) => setPendingStateChange({ item, nextState: !item.estado });

  const confirmStateChange = async () => {
    if (!pendingStateChange) return;
    const { item, nextState } = pendingStateChange;
    try {
      setSaving(true);
      const updated = await apiRequest<Ingrediente>(`/ingredientes/${item.id}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({ estado: nextState }),
      });
      setIngredientes((current) => current.map((currentItem) => currentItem.id === item.id ? { ...updated, estado: updated.estado === true } : currentItem));
      setPendingStateChange(null);
    } catch (requestError) {
      Alert.alert(nextState ? 'No se pudo reactivar' : 'No se pudo desactivar', requestError instanceof Error ? requestError.message : 'Intenta nuevamente.');
    } finally { setSaving(false); }
  };

  return <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
    <HeaderNavbar />
    <View style={styles.header}><View><Text style={styles.eyebrow}>INVENTARIO</Text><Text style={styles.title}>Ingredientes</Text><Text style={styles.subtitle}>Administra los insumos de tu cocina.</Text></View><Pressable style={styles.addButton} onPress={openCreate}><Plus size={20} color="#251D17" /><Text style={styles.addText}>Nuevo</Text></Pressable></View>
    <View style={styles.searchBox}><Search size={18} color="#A99A8B" /><TextInput value={search} onChangeText={setSearch} placeholder="Buscar ingrediente" placeholderTextColor="#998C80" style={styles.searchInput} /></View>
    <View style={styles.filters}><Pressable style={[styles.filter, filter === 'active' && styles.filterSelected]} onPress={() => setFilter('active')}><Text style={[styles.filterText, filter === 'active' && styles.filterTextSelected]}>Activos</Text></Pressable><Pressable style={[styles.filter, filter === 'all' && styles.filterSelected]} onPress={() => setFilter('all')}><Text style={[styles.filterText, filter === 'all' && styles.filterTextSelected]}>Todos</Text></Pressable><Text style={styles.counter}>{visibleIngredientes.length} {visibleIngredientes.length === 1 ? 'resultado' : 'resultados'}</Text></View>
    {loading ? <ActivityIndicator color="#F0B35A" style={styles.loader} /> : error ? <View style={styles.empty}><Text style={styles.error}>{error}</Text><Pressable style={styles.retry} onPress={loadIngredientes}><Text style={styles.retryText}>Reintentar</Text></Pressable></View> : <FlatList data={visibleIngredientes} keyExtractor={(item) => String(item.id)} contentContainerStyle={styles.list} renderItem={({ item }) => <View style={[styles.row, !item.estado && styles.inactiveRow]}><View style={styles.iconBox}><Text style={styles.initial}>{item.nombre.charAt(0).toUpperCase()}</Text></View><View style={styles.rowContent}><Text style={styles.rowName}>{item.nombre}</Text><View style={[styles.badge, item.estado ? styles.activeBadge : styles.inactiveBadge]}><Text style={styles.badgeText}>{item.estado ? 'ACTIVO' : 'INACTIVO'}</Text></View></View>{item.estado && <Pressable style={styles.iconButton} onPress={() => openEdit(item)}><Edit3 size={18} color="#F0B35A" /></Pressable>}{item.estado ? <Pressable style={styles.iconButton} onPress={() => requestStateChange(item)}><Archive size={18} color="#D98672" /></Pressable> : <Pressable style={styles.iconButton} onPress={() => requestStateChange(item)}><RotateCcw size={18} color="#35C979" /></Pressable>}</View>} ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No hay ingredientes</Text><Text style={styles.emptyText}>{search ? 'Prueba con otro nombre.' : 'Crea el primer ingrediente para comenzar.'}</Text></View>} />}

    <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
      <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={styles.modal}><View style={styles.modalHeader}><View><Text style={styles.eyebrow}>{selected ? 'EDITAR' : 'NUEVO REGISTRO'}</Text><Text style={styles.modalTitle}>{selected ? 'Editar ingrediente' : 'Nuevo ingrediente'}</Text></View><Pressable onPress={() => setModalVisible(false)}><X size={23} color="#F5EBDD" /></Pressable></View><Text style={styles.label}>Nombre</Text><TextInput autoFocus value={name} onChangeText={setName} placeholder="Ej. Tomate" placeholderTextColor="#998C80" style={styles.input} maxLength={100} /><Text style={styles.helper}>{name.trim().length}/100 caracteres</Text><Pressable style={styles.saveButton} onPress={save} disabled={saving}>{saving ? <ActivityIndicator color="#251D17" /> : <><Check size={18} color="#251D17" /><Text style={styles.saveText}>{selected ? 'Guardar cambios' : 'Crear ingrediente'}</Text></>}</Pressable></View></KeyboardAvoidingView>
    </Modal>
    <Modal visible={pendingStateChange !== null} transparent animationType="fade" onRequestClose={() => setPendingStateChange(null)}>
      <View style={styles.confirmBackdrop}><View style={styles.confirmModal}><View style={[styles.warningIcon, pendingStateChange?.nextState ? styles.warningIconActive : styles.warningIconDanger]}><TriangleAlert size={28} color={pendingStateChange?.nextState ? '#35C979' : '#F05245'} /></View><Text style={styles.confirmTitle}>{pendingStateChange?.nextState ? 'Reactivar ingrediente' : 'Desactivar ingrediente'}</Text><Text style={styles.confirmText}>¿Está seguro de que desea {pendingStateChange?.nextState ? 'reactivar' : 'desactivar'} el ingrediente “{pendingStateChange?.item.nombre}”?</Text><View style={styles.confirmActions}><Pressable style={styles.cancelButton} onPress={() => setPendingStateChange(null)}><Text style={styles.cancelText}>Cancelar</Text></Pressable><Pressable style={[styles.confirmButton, pendingStateChange?.nextState ? styles.reactivateButton : styles.deactivateButton]} onPress={confirmStateChange} disabled={saving}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.confirmButtonText}>{pendingStateChange?.nextState ? 'Reactivar' : 'Desactivar'}</Text>}</Pressable></View></View></View>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1D1A17' }, header: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }, eyebrow: { color: '#F0B35A', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 }, title: { color: '#F5EBDD', fontSize: 30, fontWeight: '800', marginTop: 4 }, subtitle: { color: '#B8A99A', marginTop: 5 }, addButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0B35A', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 7 }, addText: { color: '#251D17', fontWeight: '800' }, searchBox: { marginHorizontal: 20, height: 48, borderRadius: 8, borderWidth: 1, borderColor: '#4A3D31', backgroundColor: '#2D2620', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 9 }, searchInput: { flex: 1, color: '#F5EBDD', fontSize: 15 }, filters: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 16 }, filter: { borderWidth: 1, borderColor: '#4A3D31', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6 }, filterSelected: { backgroundColor: '#F0B35A', borderColor: '#F0B35A' }, filterText: { color: '#B8A99A', fontWeight: '700', fontSize: 12 }, filterTextSelected: { color: '#251D17' }, counter: { color: '#87796C', fontSize: 12, marginLeft: 'auto' }, loader: { marginTop: 40 }, list: { paddingHorizontal: 20, paddingBottom: 30 }, row: { minHeight: 76, backgroundColor: '#32281F', borderWidth: 1, borderColor: '#45382E', borderRadius: 10, padding: 13, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }, inactiveRow: { opacity: 0.65 }, iconBox: { width: 42, height: 42, borderRadius: 8, backgroundColor: '#604332', alignItems: 'center', justifyContent: 'center' }, initial: { color: '#F0B35A', fontSize: 19, fontWeight: '800' }, rowContent: { flex: 1, marginLeft: 12, gap: 6 }, rowName: { color: '#F5EBDD', fontSize: 16, fontWeight: '700' }, badge: { alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 }, activeBadge: { backgroundColor: '#29483D' }, inactiveBadge: { backgroundColor: '#49362F' }, badgeText: { color: '#EBDCCE', fontSize: 9, fontWeight: '800', letterSpacing: 0.7 }, iconButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }, empty: { alignItems: 'center', padding: 35 }, emptyTitle: { color: '#F5EBDD', fontSize: 17, fontWeight: '700' }, emptyText: { color: '#B8A99A', marginTop: 8, textAlign: 'center' }, error: { color: '#E7A28C', textAlign: 'center' }, retry: { backgroundColor: '#F0B35A', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 6, marginTop: 15 }, retryText: { color: '#251D17', fontWeight: '800' }, modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' }, modal: { backgroundColor: '#32281F', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 22, paddingBottom: 34, borderTopWidth: 1, borderColor: '#604D3A' }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 26 }, modalTitle: { color: '#F5EBDD', fontSize: 23, fontWeight: '800', marginTop: 4 }, label: { color: '#F5EBDD', fontWeight: '700', marginBottom: 8 }, input: { height: 50, borderWidth: 1, borderColor: '#604D3A', borderRadius: 8, color: '#F5EBDD', backgroundColor: '#2D2620', paddingHorizontal: 14, fontSize: 16 }, helper: { color: '#998C80', fontSize: 12, textAlign: 'right', marginTop: 7 }, saveButton: { height: 50, marginTop: 22, borderRadius: 7, backgroundColor: '#F0B35A', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }, saveText: { color: '#251D17', fontWeight: '800' }, confirmBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.72)' }, confirmModal: { width: '88%', maxWidth: 500, backgroundColor: '#32281F', borderWidth: 1, borderColor: '#604D3A', borderRadius: 18, padding: 28, alignItems: 'center' }, warningIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }, warningIconDanger: { backgroundColor: '#57352F' }, warningIconActive: { backgroundColor: '#29483D' }, confirmTitle: { color: '#F5EBDD', fontSize: 24, fontWeight: '800', textAlign: 'center' }, confirmText: { color: '#C9B9A9', fontSize: 16, lineHeight: 23, textAlign: 'center', marginTop: 12 }, confirmActions: { flexDirection: 'row', gap: 12, marginTop: 25, width: '100%' }, cancelButton: { flex: 1, height: 50, borderRadius: 8, borderWidth: 1, borderColor: '#604D3A', alignItems: 'center', justifyContent: 'center' }, cancelText: { color: '#F5EBDD', fontSize: 15, fontWeight: '700' }, confirmButton: { flex: 1, height: 50, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, deactivateButton: { backgroundColor: '#F05245' }, reactivateButton: { backgroundColor: '#35C979' }, confirmButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});