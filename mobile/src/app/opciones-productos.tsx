import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pencil, Plus, Trash2, X } from 'lucide-react-native';
import HeaderNavbar from '../components/HeaderNavbar';
import { apiRequest, getAccessToken } from '../constants/api';

type Opcion = { id: number; id_grupo_opcion: number; nombre: string };
type Grupo = { id: number; nombre: string; opciones: Opcion[] };

type Editor = { type: 'grupo' | 'opcion'; id?: number; groupId?: number; name: string } | null;

export default function OpcionesProductosScreen() {
  const [groups, setGroups] = useState<Grupo[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [editor, setEditor] = useState<Editor>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadGroups = async () => {
    if (!getAccessToken()) { setError('Inicia sesión para consultar las opciones.'); setLoading(false); return; }
    try {
      setError('');
      const data = await apiRequest<Grupo[]>('/grupos-opciones/');
      setGroups(data);
      setSelectedGroupId((current) => current && data.some((group) => group.id === current) ? current : data[0]?.id || null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No fue posible cargar las opciones.');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadGroups(); }, []);

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) || null;

  const save = async () => {
    if (!editor || !editor.name.trim()) return;
    try {
      setSaving(true);
      if (editor.type === 'grupo') {
        const saved = editor.id
          ? await apiRequest<Grupo>(`/grupos-opciones/${editor.id}`, { method: 'PUT', body: JSON.stringify({ nombre: editor.name.trim() }) })
          : await apiRequest<Grupo>('/grupos-opciones/', { method: 'POST', body: JSON.stringify({ nombre: editor.name.trim() }) });
        setGroups((current) => editor.id ? current.map((group) => group.id === saved.id ? { ...group, ...saved } : group) : [...current, { ...saved, opciones: [] }]);
        if (!editor.id) setSelectedGroupId(saved.id);
      } else {
        if (!editor.groupId) return;
        const saved = editor.id
          ? await apiRequest<Opcion>(`/opciones/${editor.id}`, { method: 'PUT', body: JSON.stringify({ nombre: editor.name.trim() }) })
          : await apiRequest<Opcion>('/opciones/', { method: 'POST', body: JSON.stringify({ id_grupo_opcion: editor.groupId, nombre: editor.name.trim() }) });
        setGroups((current) => current.map((group) => group.id !== editor.groupId ? group : { ...group, opciones: editor.id ? group.opciones.map((option) => option.id === saved.id ? saved : option) : [...group.opciones, saved] }));
      }
      setEditor(null);
    } catch (requestError) { Alert.alert('No se pudo guardar', requestError instanceof Error ? requestError.message : 'Intenta nuevamente.'); }
    finally { setSaving(false); }
  };

  const remove = (type: 'grupo' | 'opcion', id: number) => Alert.alert('Desactivar', 'El registro se retirará de la configuración.', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Desactivar', style: 'destructive', onPress: async () => {
      try {
        await apiRequest(type === 'grupo' ? `/grupos-opciones/${id}` : `/opciones/${id}`, { method: 'DELETE' });
        await loadGroups();
      } catch (requestError) { Alert.alert('No se pudo desactivar', requestError instanceof Error ? requestError.message : 'Intenta nuevamente.'); }
    } },
  ]);

  return <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
    <HeaderNavbar />
    <View style={styles.header}><View style={styles.headerCopy}><Text style={styles.eyebrow}>MENÚ</Text><Text style={styles.title}>Opciones de productos</Text><Text style={styles.subtitle}>Configura términos y personalizaciones.</Text></View><Pressable style={styles.addButton} onPress={() => setEditor({ type: 'grupo', name: '' })}><Plus size={19} color="#251D17" /><Text style={styles.addText}>Nuevo grupo</Text></Pressable></View>
    {loading ? <Text style={styles.empty}>Cargando...</Text> : error ? <View style={styles.empty}><Text style={styles.error}>{error}</Text><Pressable style={styles.retry} onPress={loadGroups}><Text style={styles.retryText}>Reintentar</Text></Pressable></View> : <View style={styles.body}>
      <View style={styles.groupList}><Text style={styles.sectionTitle}>Grupos</Text>{groups.map((group) => <TouchableOpacity key={group.id} style={[styles.groupCard, group.id === selectedGroupId && styles.selectedCard]} onPress={() => setSelectedGroupId(group.id)}><Text style={styles.cardName}>{group.nombre}</Text><Text style={styles.cardMeta}>{group.opciones.length} opciones</Text><View style={styles.cardActions}><Pressable onPress={() => setEditor({ type: 'grupo', id: group.id, name: group.nombre })}><Pencil size={17} color="#F0B35A" /></Pressable><Pressable onPress={() => remove('grupo', group.id)}><Trash2 size={17} color="#D98672" /></Pressable></View></TouchableOpacity>)}</View>
      <View style={styles.optionList}><View style={styles.optionHeader}><Text style={styles.sectionTitle}>{selectedGroup?.nombre || 'Selecciona un grupo'}</Text>{selectedGroup && <Pressable style={styles.smallButton} onPress={() => setEditor({ type: 'opcion', groupId: selectedGroup.id, name: '' })}><Plus size={16} color="#251D17" /><Text style={styles.smallButtonText}>Nueva opción</Text></Pressable>}</View>{selectedGroup?.opciones.map((option) => <View key={option.id} style={styles.optionRow}><Text style={styles.optionName}>{option.nombre}</Text><View style={styles.cardActions}><Pressable onPress={() => setEditor({ type: 'opcion', id: option.id, groupId: selectedGroup.id, name: option.nombre })}><Pencil size={17} color="#F0B35A" /></Pressable><Pressable onPress={() => remove('opcion', option.id)}><Trash2 size={17} color="#D98672" /></Pressable></View></View>)}</View>
    </View>}
    <Modal visible={!!editor} transparent animationType="fade" onRequestClose={() => setEditor(null)}><View style={styles.overlay}><View style={styles.modal}><View style={styles.modalHeader}><Text style={styles.modalTitle}>{editor?.id ? 'Editar' : 'Nuevo'} {editor?.type === 'grupo' ? 'grupo' : 'opción'}</Text><Pressable onPress={() => setEditor(null)}><X color="#F5EBDD" size={22} /></Pressable></View><TextInput autoFocus style={styles.input} placeholder="Nombre" placeholderTextColor="#998C80" value={editor?.name || ''} onChangeText={(name) => setEditor((current) => current ? { ...current, name } : current)} /><View style={styles.modalActions}><Pressable onPress={() => setEditor(null)}><Text style={styles.cancelText}>Cancelar</Text></Pressable><Pressable style={styles.saveButton} onPress={save} disabled={saving}><Text style={styles.saveText}>{saving ? 'Guardando...' : 'Guardar'}</Text></Pressable></View></View></View></Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1D1A17' }, header: { padding: 20, flexDirection: 'column', alignItems: 'flex-start' }, headerCopy: { width: '100%' }, eyebrow: { color: '#F0B35A', fontSize: 11, letterSpacing: 1.5 }, title: { color: '#F5EBDD', fontSize: 25, fontWeight: '800', marginTop: 4 }, subtitle: { color: '#B8A99A', marginTop: 5 }, addButton: { flexDirection: 'row', gap: 6, backgroundColor: '#F0B35A', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 6, marginTop: 15, alignSelf: 'flex-start' }, addText: { color: '#251D17', fontWeight: '800' }, body: { flex: 1, paddingHorizontal: 20 }, groupList: { marginBottom: 18 }, optionList: { flex: 1 }, sectionTitle: { color: '#F5EBDD', fontSize: 18, fontWeight: '700', marginBottom: 10 }, groupCard: { backgroundColor: '#32281F', borderWidth: 1, borderColor: '#45382E', borderRadius: 8, padding: 14, marginBottom: 8 }, selectedCard: { borderColor: '#F0B35A' }, cardName: { color: '#F5EBDD', fontSize: 16, fontWeight: '700' }, cardMeta: { color: '#B8A99A', marginTop: 4 }, cardActions: { position: 'absolute', right: 12, top: 13, flexDirection: 'row', gap: 15 }, optionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }, optionRow: { backgroundColor: '#32281F', borderBottomWidth: 1, borderBottomColor: '#45382E', padding: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, optionName: { color: '#F5EBDD', fontSize: 16 }, smallButton: { flexDirection: 'row', gap: 5, backgroundColor: '#F0B35A', paddingHorizontal: 9, paddingVertical: 7, borderRadius: 5 }, smallButtonText: { color: '#251D17', fontSize: 12, fontWeight: '800' }, empty: { padding: 24, alignItems: 'center' }, error: { color: '#E7A28C', textAlign: 'center' }, retry: { marginTop: 12, backgroundColor: '#F0B35A', padding: 10, borderRadius: 6 }, retryText: { color: '#251D17', fontWeight: '700' }, overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.65)', justifyContent: 'center', padding: 20 }, modal: { backgroundColor: '#29231E', padding: 18, borderRadius: 10 }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }, modalTitle: { color: '#F5EBDD', fontSize: 19, fontWeight: '800' }, input: { backgroundColor: '#1D1A17', borderColor: '#604D3A', borderWidth: 1, borderRadius: 6, padding: 12, color: '#F5EBDD' }, modalActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 18, marginTop: 18 }, cancelText: { color: '#D98672', fontWeight: '700' }, saveButton: { backgroundColor: '#F0B35A', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 6 }, saveText: { color: '#251D17', fontWeight: '800' }
});
