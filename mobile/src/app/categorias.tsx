import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ban, Check, Edit3, Layers, Plus, RotateCcw, Search, TriangleAlert, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HeaderNavbar from '../components/HeaderNavbar';
import { apiRequest, getAccessToken } from '../constants/api';

type Categoria = { id: number; nombre: string; estado?: boolean | null };
type Pending = { item: Categoria; nextState: boolean };

export default function CategoriasScreen() {
  const [items, setItems] = useState<Categoria[]>([]);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState<Categoria | null>(null);
  const [name, setName] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    if (!getAccessToken()) { setError('Inicia sesión para consultar las categorías.'); setLoading(false); return; }
    try {
      setError('');
      const data = await apiRequest<Categoria[]>('/categorias/');
      setItems(data.map((item) => ({ ...item, estado: item.estado === true })));
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'No fue posible cargar las categorías.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const visible = useMemo(() => items.filter((item) => item.nombre.toLowerCase().includes(search.trim().toLowerCase()) && (showAll || item.estado === true)), [items, search, showAll]);
  const openCreate = () => { setSelected(null); setName(''); setModal(true); };
  const openEdit = (item: Categoria) => { setSelected(item); setName(item.nombre); setModal(true); };

  const save = async () => {
    const value = name.trim();
    if (value.length < 3) return Alert.alert('Nombre inválido', 'La categoría debe tener al menos 3 caracteres.');
    try {
      setSaving(true);
      const saved = selected ? await apiRequest<Categoria>(`/categorias/${selected.id}`, { method: 'PUT', body: JSON.stringify({ nombre: value }) }) : await apiRequest<Categoria>('/categorias/', { method: 'POST', body: JSON.stringify({ nombre: value }) });
      const normalized = { ...saved, estado: saved.estado === true };
      setItems((current) => selected ? current.map((item) => item.id === normalized.id ? normalized : item) : [normalized, ...current]);
      setModal(false); setSelected(null);
    } catch (requestError) { Alert.alert('No se pudo guardar', requestError instanceof Error ? requestError.message : 'Intenta nuevamente.'); }
    finally { setSaving(false); }
  };

  const changeState = async () => {
    if (!pending) return;
    try {
      setSaving(true);
      const updated = await apiRequest<Categoria>(`/categorias/${pending.item.id}/estado?estado=${pending.nextState}`, { method: 'PATCH' });
      setItems((current) => current.map((item) => item.id === updated.id ? { ...updated, estado: updated.estado === true } : item));
      setPending(null);
    } catch (requestError) { Alert.alert('No se pudo cambiar el estado', requestError instanceof Error ? requestError.message : 'Intenta nuevamente.'); }
    finally { setSaving(false); }
  };

  const renderItem = ({ item }: { item: Categoria }) => {
    const active = item.estado === true;
    return <View style={[styles.row, !active && styles.inactive]}><View style={styles.iconBox}><Layers size={19} color="#F0B35A" /></View><View style={styles.content}><Text style={styles.name}>{item.nombre}</Text><View style={[styles.badge, active ? styles.activeBadge : styles.inactiveBadge]}><Text style={styles.badgeText}>{active ? 'ACTIVA' : 'DESACTIVADA'}</Text></View></View>{active && <Pressable style={styles.iconButton} onPress={() => openEdit(item)}><Edit3 size={18} color="#F0B35A" /></Pressable>}<Pressable style={styles.iconButton} onPress={() => setPending({ item, nextState: !active })}>{active ? <Ban size={18} color="#D98672" /> : <RotateCcw size={18} color="#35C979" />}</Pressable></View>;
  };

  return <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}><HeaderNavbar /><View style={styles.header}><View><Text style={styles.kicker}>CONFIGURACIÓN</Text><Text style={styles.title}>Categorías</Text><Text style={styles.subtitle}>Organiza los productos de tu carta.</Text></View><Pressable style={styles.addButton} onPress={openCreate}><Plus size={19} color="#251D17" /><Text style={styles.addText}>Nueva</Text></Pressable></View><View style={styles.search}><Search size={18} color="#A99A8B" /><TextInput value={search} onChangeText={setSearch} placeholder="Buscar categoría" placeholderTextColor="#998C80" style={styles.searchInput} /></View><View style={styles.filters}><Pressable style={[styles.filter, !showAll && styles.selectedFilter]} onPress={() => setShowAll(false)}><Text style={[styles.filterText, !showAll && styles.selectedText]}>Activas</Text></Pressable><Pressable style={[styles.filter, showAll && styles.selectedFilter]} onPress={() => setShowAll(true)}><Text style={[styles.filterText, showAll && styles.selectedText]}>Todas</Text></Pressable><Text style={styles.counter}>{visible.length} resultados</Text></View>{loading ? <ActivityIndicator color="#F0B35A" style={styles.loader} /> : error ? <View style={styles.empty}><Text style={styles.error}>{error}</Text><Pressable style={styles.retry} onPress={load}><Text style={styles.retryText}>Reintentar</Text></Pressable></View> : <FlatList data={visible} keyExtractor={(item) => String(item.id)} contentContainerStyle={styles.list} renderItem={renderItem} ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No hay categorías</Text><Text style={styles.emptyText}>Crea la primera categoría para comenzar.</Text></View>} />}
    <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}><KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={styles.modalCard}><View style={styles.modalHeader}><View><Text style={styles.kicker}>{selected ? 'EDITAR' : 'NUEVO REGISTRO'}</Text><Text style={styles.modalTitle}>{selected ? 'Editar categoría' : 'Nueva categoría'}</Text></View><Pressable onPress={() => setModal(false)}><X size={23} color="#F5EBDD" /></Pressable></View><Text style={styles.label}>Nombre</Text><TextInput autoFocus value={name} onChangeText={setName} placeholder="Ej. Bebidas" placeholderTextColor="#998C80" style={styles.input} maxLength={50} /><Pressable style={styles.saveButton} onPress={save} disabled={saving}>{saving ? <ActivityIndicator color="#251D17" /> : <><Check size={18} color="#251D17" /><Text style={styles.saveText}>{selected ? 'Guardar cambios' : 'Crear categoría'}</Text></>}</Pressable></View></KeyboardAvoidingView></Modal>
    <Modal visible={pending !== null} transparent animationType="fade" onRequestClose={() => setPending(null)}><View style={styles.confirmBackdrop}><View style={styles.confirmCard}><View style={[styles.alertIcon, pending?.nextState ? styles.greenBg : styles.redBg]}><TriangleAlert size={28} color={pending?.nextState ? '#35C979' : '#F05245'} /></View><Text style={styles.confirmTitle}>{pending?.nextState ? 'Reactivar categoría' : 'Desactivar categoría'}</Text><Text style={styles.confirmText}>¿Está seguro de que desea {pending?.nextState ? 'reactivar' : 'desactivar'} la categoría “{pending?.item.nombre}”?</Text><View style={styles.actions}><Pressable style={styles.cancelButton} onPress={() => setPending(null)}><Text style={styles.cancelText}>Cancelar</Text></Pressable><Pressable style={[styles.confirmButton, pending?.nextState ? styles.reactivate : styles.deactivate]} onPress={changeState} disabled={saving}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.confirmButtonText}>{pending?.nextState ? 'Reactivar' : 'Desactivar'}</Text>}</Pressable></View></View></View></Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#1D1A17' }, header: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }, kicker: { color: '#F0B35A', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 }, title: { color: '#F5EBDD', fontSize: 30, fontWeight: '800', marginTop: 4 }, subtitle: { color: '#B8A99A', marginTop: 5 }, addButton: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#F0B35A', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 7 }, addText: { color: '#251D17', fontWeight: '800' }, search: { marginHorizontal: 20, height: 48, borderRadius: 8, borderWidth: 1, borderColor: '#4A3D31', backgroundColor: '#2D2620', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 9 }, searchInput: { flex: 1, color: '#F5EBDD', fontSize: 15 }, filters: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 16 }, filter: { paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: '#4A3D31', borderRadius: 6 }, selectedFilter: { backgroundColor: '#F0B35A', borderColor: '#F0B35A' }, filterText: { color: '#B8A99A', fontWeight: '700', fontSize: 12 }, selectedText: { color: '#251D17' }, counter: { marginLeft: 'auto', color: '#87796C', fontSize: 12 }, loader: { marginTop: 40 }, list: { paddingHorizontal: 20, paddingBottom: 30 }, row: { minHeight: 76, padding: 13, marginBottom: 10, borderRadius: 10, borderWidth: 1, borderColor: '#45382E', backgroundColor: '#32281F', flexDirection: 'row', alignItems: 'center' }, inactive: { opacity: 0.65 }, iconBox: { width: 42, height: 42, borderRadius: 8, backgroundColor: '#604332', alignItems: 'center', justifyContent: 'center' }, content: { flex: 1, marginLeft: 12, gap: 6 }, name: { color: '#F5EBDD', fontSize: 16, fontWeight: '700' }, badge: { alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 }, activeBadge: { backgroundColor: '#29483D' }, inactiveBadge: { backgroundColor: '#49362F' }, badgeText: { color: '#EBDCCE', fontSize: 9, fontWeight: '800', letterSpacing: 0.7 }, iconButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' }, empty: { alignItems: 'center', padding: 35 }, emptyTitle: { color: '#F5EBDD', fontSize: 17, fontWeight: '700' }, emptyText: { color: '#B8A99A', marginTop: 8, textAlign: 'center' }, error: { color: '#E7A28C', textAlign: 'center' }, retry: { backgroundColor: '#F0B35A', padding: 10, borderRadius: 6, marginTop: 15 }, retryText: { color: '#251D17', fontWeight: '800' }, modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' }, modalCard: { backgroundColor: '#32281F', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 22, paddingBottom: 34 }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 26 }, modalTitle: { color: '#F5EBDD', fontSize: 23, fontWeight: '800', marginTop: 4 }, label: { color: '#F5EBDD', fontWeight: '700', marginBottom: 8 }, input: { height: 50, borderWidth: 1, borderColor: '#604D3A', borderRadius: 8, color: '#F5EBDD', backgroundColor: '#2D2620', paddingHorizontal: 14, fontSize: 16 }, saveButton: { height: 50, marginTop: 22, borderRadius: 7, backgroundColor: '#F0B35A', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }, saveText: { color: '#251D17', fontWeight: '800' }, confirmBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.72)' }, confirmCard: { width: '88%', maxWidth: 500, backgroundColor: '#32281F', borderWidth: 1, borderColor: '#604D3A', borderRadius: 18, padding: 28, alignItems: 'center' }, alertIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }, greenBg: { backgroundColor: '#29483D' }, redBg: { backgroundColor: '#57352F' }, confirmTitle: { color: '#F5EBDD', fontSize: 24, fontWeight: '800', textAlign: 'center' }, confirmText: { color: '#C9B9A9', fontSize: 16, lineHeight: 23, textAlign: 'center', marginTop: 12 }, actions: { flexDirection: 'row', gap: 12, marginTop: 25, width: '100%' }, cancelButton: { flex: 1, height: 50, borderRadius: 8, borderWidth: 1, borderColor: '#604D3A', alignItems: 'center', justifyContent: 'center' }, cancelText: { color: '#F5EBDD', fontWeight: '700' }, confirmButton: { flex: 1, height: 50, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, deactivate: { backgroundColor: '#F05245' }, reactivate: { backgroundColor: '#35C979' }, confirmButtonText: { color: '#FFFFFF', fontWeight: '800' } });
