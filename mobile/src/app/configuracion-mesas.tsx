import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import * as Print from 'expo-print';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Edit3, LayoutGrid, Plus, QrCode, Search, Trash2, X } from 'lucide-react-native';
import HeaderNavbar from '../components/HeaderNavbar';
import { apiRequest, getAccessToken } from '../constants/api';

type Mesa = {
  id: number;
  nombre?: string | null;
  estado?: boolean | null;
  tipo?: 'barra' | 'mesa' | null;
  hora_inicio?: string | null;
  id_mov?: number | null;
};
type TipoMesa = Mesa['tipo'];
type QrRenderer = { toDataURL: (callback: (data: string) => void) => void };
type QrMesa = Pick<Mesa, 'id' | 'nombre' | 'tipo'>;

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

export default function ConfiguracionMesasScreen() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'todas' | TipoMesa>('todas');
  const [selected, setSelected] = useState<Mesa | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<TipoMesa>('mesa');
  const [modalVisible, setModalVisible] = useState(false);
  const [qrMesa, setQrMesa] = useState<QrMesa | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const qrRef = useRef<QrRenderer | null>(null);

  const loadMesas = useCallback(async () => {
    if (!getAccessToken()) {
      setError('Inicia sesión para consultar las mesas.');
      setLoading(false);
      return;
    }
    try {
      setError('');
      setMesas(await apiRequest<Mesa[]>('/mesas/'));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No fue posible cargar las mesas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadMesas(); }, [loadMesas]);

  const visibleMesas = useMemo(() => mesas.filter((mesa) => {
    const matchesSearch = (mesa.nombre || `Mesa ${mesa.id}`).toLowerCase().includes(search.trim().toLowerCase());
    return matchesSearch && (filter === 'todas' || mesa.tipo === filter);
  }), [filter, mesas, search]);

  const openCreate = () => {
    setSelected(null);
    setName('');
    setType('mesa');
    setModalVisible(true);
  };

  const openEdit = (mesa: Mesa) => {
    setSelected(mesa);
    setName(mesa.nombre || '');
    setType(mesa.tipo || 'mesa');
    setModalVisible(true);
  };

  const saveMesa = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      Alert.alert('Falta el nombre', 'Escribe un nombre para la mesa.');
      return;
    }
    try {
      setSaving(true);
      const saved = selected
        ? await apiRequest<Mesa>(`/mesas/${selected.id}`, {
            method: 'PUT',
            body: JSON.stringify({ nombre: cleanName }),
          })
        : await apiRequest<Mesa>('/mesas/', {
            method: 'POST',
            body: JSON.stringify({ nombre: cleanName, estado: false, tipo: type }),
          });
      setMesas((current) => selected
        ? current.map((mesa) => mesa.id === saved.id ? saved : mesa)
        : [...current, saved].sort((left, right) => left.id - right.id));
      setModalVisible(false);
      setSelected(null);
    } catch (requestError) {
      Alert.alert('No se pudo guardar', requestError instanceof Error ? requestError.message : 'Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  const deleteMesa = (mesa: Mesa) => {
    const mesaName = mesa.nombre || `Mesa ${mesa.id}`;
    Alert.alert('Eliminar mesa', `¿Deseas eliminar “${mesaName}”?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              setSaving(true);
              await apiRequest<void>(`/mesas/${mesa.id}`, { method: 'DELETE' });
              setMesas((current) => current.filter((item) => item.id !== mesa.id));
            } catch (requestError) {
              Alert.alert('No se pudo eliminar', requestError instanceof Error ? requestError.message : 'Intenta nuevamente.');
            } finally {
              setSaving(false);
            }
          })();
        },
      },
    ]);
  };

  const printQr = async () => {
    const qr = qrRef.current;
    if (!qrMesa || !qr) {
      Alert.alert('QR no disponible', 'Espera a que el código QR termine de generarse.');
      return;
    }
    try {
      const data = await new Promise<string>((resolve) => qr.toDataURL(resolve));
      const image = data.startsWith('data:') ? data : `data:image/png;base64,${data}`;
      const title = escapeHtml(qrMesa.nombre || `Mesa ${qrMesa.id}`);
      await Print.printAsync({
        html: `<html><body style="font-family: sans-serif; text-align: center; padding: 32px"><h1>${title}</h1><img alt="Código QR de ${title}" src="${image}" style="width: 260px; height: 260px" /><p>Escanea para abrir la carta de esta mesa.</p></body></html>`,
      });
    } catch (printError) {
      Alert.alert('No se pudo imprimir el QR', printError instanceof Error ? printError.message : 'Intenta nuevamente.');
    }
  };

  const renderMesa = ({ item }: { item: Mesa }) => {
    const available = item.estado === false && item.id_mov == null;
    const title = item.nombre || (item.tipo === 'barra' ? 'Barra' : `Mesa ${item.id}`);
    return <View style={styles.row}>
      <View style={styles.iconBox}><LayoutGrid size={20} color="#F0B35A" /></View>
      <View style={styles.rowContent}>
        <Text style={styles.rowName}>{title}</Text>
        <Text style={styles.typeText}>{item.tipo === 'barra' ? 'Barra' : 'Mesa'} · #{item.id}</Text>
        <View style={[styles.badge, item.estado ? styles.occupiedBadge : styles.availableBadge]}>
          <Text style={styles.badgeText}>{item.estado ? 'OCUPADA' : 'DISPONIBLE'}</Text>
        </View>
      </View>
      {item.tipo === 'mesa' && available && <Pressable style={styles.iconButton} onPress={() => setQrMesa(item)} accessibilityLabel={`Ver QR de ${title}`}><QrCode size={19} color="#F0B35A" /></Pressable>}
      <Pressable style={styles.iconButton} onPress={() => openEdit(item)} accessibilityLabel={`Editar ${title}`}><Edit3 size={18} color="#F0B35A" /></Pressable>
      {available && <Pressable style={styles.iconButton} onPress={() => deleteMesa(item)} accessibilityLabel={`Eliminar ${title}`}><Trash2 size={18} color="#D98672" /></Pressable>}
    </View>;
  };

  return <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
    <HeaderNavbar />
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={styles.eyebrow}>CONFIGURACIÓN</Text>
        <Text style={styles.title}>Mesas</Text>
        <Text style={styles.subtitle}>Administra mesas, barras y sus códigos QR.</Text>
      </View>
      <Pressable style={styles.addButton} onPress={openCreate}><Plus size={20} color="#251D17" /><Text style={styles.addText}>Nueva</Text></Pressable>
    </View>
    <View style={styles.searchBox}><Search size={18} color="#A99A8B" /><TextInput value={search} onChangeText={setSearch} placeholder="Buscar mesa" placeholderTextColor="#998C80" style={styles.searchInput} /></View>
    <View style={styles.filters}>
      {(['todas', 'mesa', 'barra'] as const).map((item) => <Pressable key={item} style={[styles.filter, filter === item && styles.filterSelected]} onPress={() => setFilter(item)}><Text style={[styles.filterText, filter === item && styles.filterTextSelected]}>{item === 'todas' ? 'Todas' : item === 'mesa' ? 'Mesas' : 'Barras'}</Text></Pressable>)}
      <Text style={styles.counter}>{visibleMesas.length} {visibleMesas.length === 1 ? 'resultado' : 'resultados'}</Text>
    </View>
    {loading ? <ActivityIndicator color="#F0B35A" style={styles.loader} /> : error
      ? <View style={styles.empty}><Text style={styles.error}>{error}</Text><Pressable style={styles.retry} onPress={() => { setLoading(true); void loadMesas(); }}><Text style={styles.retryText}>Reintentar</Text></Pressable></View>
      : <FlatList
          data={visibleMesas}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={renderMesa}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>No hay mesas</Text><Text style={styles.emptyText}>Registra una mesa o barra para comenzar.</Text></View>}
        />}

    <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
      <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View><Text style={styles.eyebrow}>{selected ? 'EDITAR' : 'NUEVO REGISTRO'}</Text><Text style={styles.modalTitle}>{selected ? 'Editar mesa' : 'Nueva mesa'}</Text></View>
            <Pressable onPress={() => setModalVisible(false)} accessibilityLabel="Cerrar"><X size={23} color="#F5EBDD" /></Pressable>
          </View>
          <Text style={styles.label}>Nombre</Text>
          <TextInput autoFocus value={name} onChangeText={setName} placeholder="Ej. Mesa terraza" placeholderTextColor="#998C80" style={styles.input} maxLength={100} />
          {!selected && <>
            <Text style={[styles.label, styles.typeLabel]}>Tipo</Text>
            <View style={styles.typeChoices}>
              {(['mesa', 'barra'] as const).map((item) => <Pressable key={item} style={[styles.typeChoice, type === item && styles.typeChoiceSelected]} onPress={() => setType(item)}><Text style={[styles.typeChoiceText, type === item && styles.typeChoiceTextSelected]}>{item === 'mesa' ? 'Mesa' : 'Barra'}</Text></Pressable>)}
            </View>
          </>}
          <Pressable style={styles.saveButton} onPress={() => void saveMesa()} disabled={saving}>{saving ? <ActivityIndicator color="#251D17" /> : <><Check size={18} color="#251D17" /><Text style={styles.saveText}>{selected ? 'Guardar cambios' : 'Crear mesa'}</Text></>}</Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    <Modal visible={qrMesa !== null} transparent animationType="fade" onRequestClose={() => setQrMesa(null)}>
      <View style={styles.qrBackdrop}>
        <View style={styles.qrCard}>
          <View style={styles.modalHeader}>
            <View><Text style={styles.eyebrow}>CÓDIGO DE MESA</Text><Text style={styles.modalTitle}>{qrMesa?.nombre || `Mesa ${qrMesa?.id ?? ''}`}</Text></View>
            <Pressable onPress={() => setQrMesa(null)} accessibilityLabel="Cerrar QR"><X size={23} color="#F5EBDD" /></Pressable>
          </View>
          {qrMesa && <View style={styles.qrCode}><QRCode value={JSON.stringify({ mesa_id: qrMesa.id })} size={220} getRef={(component: QrRenderer | null) => { qrRef.current = component; }} /></View>}
          <Text style={styles.qrHint}>Imprime este código y colócalo en la mesa para abrir su carta.</Text>
          <Pressable style={styles.saveButton} onPress={() => void printQr()}><Text style={styles.saveText}>Imprimir QR</Text></Pressable>
        </View>
      </View>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1D1A17' },
  header: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerCopy: { flex: 1, paddingRight: 8 },
  eyebrow: { color: '#F0B35A', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  title: { color: '#F5EBDD', fontSize: 30, fontWeight: '800', marginTop: 4 },
  subtitle: { color: '#B8A99A', marginTop: 5 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F0B35A', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 7 },
  addText: { color: '#251D17', fontWeight: '800' },
  searchBox: { marginHorizontal: 20, height: 48, borderRadius: 8, borderWidth: 1, borderColor: '#4A3D31', backgroundColor: '#2D2620', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 9 },
  searchInput: { flex: 1, color: '#F5EBDD', fontSize: 15 },
  filters: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 16 },
  filter: { borderWidth: 1, borderColor: '#4A3D31', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6 },
  filterSelected: { backgroundColor: '#F0B35A', borderColor: '#F0B35A' },
  filterText: { color: '#B8A99A', fontWeight: '700', fontSize: 12 },
  filterTextSelected: { color: '#251D17' },
  counter: { color: '#87796C', fontSize: 12, marginLeft: 'auto' },
  loader: { marginTop: 40 },
  list: { paddingHorizontal: 20, paddingBottom: 30 },
  row: { minHeight: 80, backgroundColor: '#32281F', borderWidth: 1, borderColor: '#45382E', borderRadius: 10, padding: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 42, height: 42, borderRadius: 8, backgroundColor: '#604332', alignItems: 'center', justifyContent: 'center' },
  rowContent: { flex: 1, marginLeft: 10, gap: 4 },
  rowName: { color: '#F5EBDD', fontSize: 15, fontWeight: '700' },
  typeText: { color: '#B8A99A', fontSize: 11 },
  badge: { alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3, marginTop: 2 },
  availableBadge: { backgroundColor: '#29483D' },
  occupiedBadge: { backgroundColor: '#604332' },
  badgeText: { color: '#EBDCCE', fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  iconButton: { width: 36, height: 40, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', padding: 30 },
  emptyTitle: { color: '#F5EBDD', fontSize: 17, fontWeight: '700' },
  emptyText: { color: '#B8A99A', marginTop: 8, textAlign: 'center' },
  error: { color: '#E7A28C', textAlign: 'center' },
  retry: { marginTop: 15, backgroundColor: '#F0B35A', padding: 10, borderRadius: 6 },
  retryText: { color: '#251D17', fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' },
  modalCard: { backgroundColor: '#32281F', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 22, paddingBottom: 34 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  modalTitle: { color: '#F5EBDD', fontSize: 22, fontWeight: '800', marginTop: 4 },
  label: { color: '#F5EBDD', fontWeight: '700', marginBottom: 8 },
  input: { height: 50, borderWidth: 1, borderColor: '#604D3A', borderRadius: 8, color: '#F5EBDD', backgroundColor: '#2D2620', paddingHorizontal: 14, fontSize: 16 },
  typeLabel: { marginTop: 18 },
  typeChoices: { flexDirection: 'row', gap: 10 },
  typeChoice: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 7, borderWidth: 1, borderColor: '#604D3A', backgroundColor: '#2D2620' },
  typeChoiceSelected: { backgroundColor: '#604332', borderColor: '#F0B35A' },
  typeChoiceText: { color: '#B8A99A', fontWeight: '700' },
  typeChoiceTextSelected: { color: '#F0B35A' },
  saveButton: { height: 50, marginTop: 22, borderRadius: 7, backgroundColor: '#F0B35A', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  saveText: { color: '#251D17', fontWeight: '800' },
  qrBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.72)', padding: 20 },
  qrCard: { width: '100%', maxWidth: 420, backgroundColor: '#32281F', borderWidth: 1, borderColor: '#604D3A', borderRadius: 18, padding: 22 },
  qrCode: { alignSelf: 'center', padding: 14, backgroundColor: '#FFFFFF', borderRadius: 8 },
  qrHint: { color: '#C9B9A9', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 18 },
});
