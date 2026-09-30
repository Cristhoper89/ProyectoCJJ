import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, CircleCheck, Clock3, MessageCircle, RefreshCw, TriangleAlert } from 'lucide-react-native';

import HeaderNavbar from '../components/HeaderNavbar';
import { API_URL, apiRequest, getAccessToken } from '../constants/api';

type Modificador = { id: number; id_ingrediente: number; nombre: string; accion: 'agregar' | 'quitar' };
type PedidoItem = {
  id: number;
  id_producto: number;
  producto_nombre: string;
  cantidad: number;
  preparado: boolean;
  notas?: string | null;
  modificadores: Modificador[];
};
type Pedido = { id_movimiento: number; ubicacion: string; fecha_creacion: string; items: PedidoItem[] };
type Tab = 'pending' | 'ready';

const elapsedSeconds = (createdAt: string, now: number) =>
  Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 1000));

const formatElapsed = (createdAt: string, now: number) => {
  const seconds = elapsedSeconds(createdAt, now);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
};

const formatOrderTime = (createdAt: string) => {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
};

export default function PedidosScreen() {
  const [orders, setOrders] = useState<Pedido[]>([]);
  const [tab, setTab] = useState<Tab>('pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [processingItems, setProcessingItems] = useState<Record<number, boolean>>({});
  const [processingOrders, setProcessingOrders] = useState<Record<number, boolean>>({});
  const [now, setNow] = useState(0);

  const loadOrders = useCallback(async () => {
    if (!getAccessToken()) {
      setError('Inicia sesión para consultar los pedidos.');
      setOrders([]);
      setLoading(false);
      return;
    }
    try {
      const result = await apiRequest<Pedido[]>('/pedido/');
      setOrders(result);
      setError('');
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'No fue posible cargar los pedidos.';
      setError(message === 'Not Found'
        ? 'La ruta de pedidos aún no está desplegada en el servidor.'
        : message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [loadOrders]);

  useEffect(() => {
    let stopped = false;
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 1000;

    const connect = () => {
      const token = getAccessToken();
      if (stopped) return;
      if (!token) {
        retryTimer = setTimeout(connect, retryDelay);
        return;
      }

      socket = new WebSocket(`${API_URL.replace(/^http/, 'ws')}/ws/mesas`);
      socket.onopen = () => socket?.send(JSON.stringify({ token }));
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string);
          if (message.type === 'ready' || message.type === 'mesa.updated') void loadOrders();
          if (message.type === 'ready') retryDelay = 1000;
        } catch {
          // Ignore non-JSON socket messages.
        }
      };
      socket.onclose = (event) => {
        if (stopped || event.code === 1008) return;
        retryTimer = setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 15000);
      };
      socket.onerror = () => socket?.close();
    };

    connect();
    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
    };
  }, [loadOrders]);

  const pendingOrders = useMemo(
    () => orders.filter((order) => order.items.some((item) => !item.preparado)),
    [orders],
  );
  const readyOrders = useMemo(
    () => orders.filter((order) => order.items.every((item) => item.preparado)),
    [orders],
  );
  const visibleOrders = tab === 'pending' ? pendingOrders : readyOrders;
  const pendingCount = pendingOrders.length;
  const readyCount = readyOrders.length;

  const refreshOrders = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const setPrepared = async (order: Pedido, items: PedidoItem[]) => {
    const toUpdate = items.filter((item) => !item.preparado && !processingItems[item.id]);
    if (toUpdate.length === 0 || processingOrders[order.id_movimiento]) return;

    setProcessingItems((current) => ({
      ...current,
      ...Object.fromEntries(toUpdate.map((item) => [item.id, true])),
    }));
    setProcessingOrders((current) => ({ ...current, [order.id_movimiento]: true }));
    setOrders((current) => current.map((entry) => entry.id_movimiento === order.id_movimiento
      ? { ...entry, items: entry.items.map((item) => toUpdate.some((target) => target.id === item.id) ? { ...item, preparado: true } : item) }
      : entry));

    try {
      const updates = await Promise.allSettled(toUpdate.map((item) => apiRequest(
        `/pedido/items/${item.id}/preparado`,
        { method: 'PATCH', body: JSON.stringify({ preparado: true }) },
      )));
      const failed = updates.some((result) => result.status === 'rejected');
      if (failed) {
        await loadOrders();
        Alert.alert('No se guardaron todos los cambios', 'El pedido se actualizó desde el servidor. Revisa el estado e inténtalo de nuevo.');
      } else if (Platform.OS !== 'web') {
        Vibration.vibrate(35);
      }
    } catch (requestError) {
      await loadOrders();
      Alert.alert('No se pudo actualizar el pedido', requestError instanceof Error ? requestError.message : 'Intenta nuevamente.');
    } finally {
      setProcessingItems((current) => {
        const next = { ...current };
        toUpdate.forEach((item) => delete next[item.id]);
        return next;
      });
      setProcessingOrders((current) => {
        const next = { ...current };
        delete next[order.id_movimiento];
        return next;
      });
    }
  };

  const renderOrder = ({ item: order }: { item: Pedido }) => {
    const pendingItems = order.items.filter((entry) => !entry.preparado);
    const overdue = pendingItems.some((entry) => elapsedSeconds(order.fecha_creacion, now) > 600);

    return (
      <View style={[styles.orderCard, overdue && styles.overdueCard]}>
        <View style={[styles.orderHeader, overdue && styles.overdueHeader]}>
          <View style={styles.orderHeading}>
            <Text style={styles.location}>{order.ubicacion}</Text>
            <Text style={styles.orderMeta}>Pedido #{order.id_movimiento} · {formatOrderTime(order.fecha_creacion)}</Text>
          </View>
          <View style={[styles.timer, overdue && styles.overdueTimer]}>
            {overdue ? <TriangleAlert size={18} color="#FFFFFF" /> : <Clock3 size={18} color={overdue ? '#FFFFFF' : '#493D32'} />}
            <Text style={[styles.timerText, overdue && styles.overdueTimerText]}>{formatElapsed(order.fecha_creacion, now)}</Text>
          </View>
        </View>

        <View style={styles.items}>
          {order.items.map((entry) => {
            const isProcessing = Boolean(processingItems[entry.id]);
            return (
              <View key={entry.id} style={[styles.itemRow, entry.preparado && styles.preparedItem]}>
                <Text style={[styles.quantity, entry.preparado && styles.preparedText]}>{entry.cantidad}×</Text>
                <View style={styles.itemDetails}>
                  <Text style={[styles.productName, entry.preparado && styles.preparedText]}>{entry.producto_nombre}</Text>
                  {entry.modificadores.map((modifier) => (
                    <Text key={modifier.id} style={modifier.accion === 'agregar' ? styles.addModifier : styles.removeModifier}>
                      {modifier.accion === 'agregar' ? '+ ' : '− '}{modifier.nombre}
                    </Text>
                  ))}
                  {!!entry.notas?.trim() && (
                    <View style={styles.noteBox}>
                      <MessageCircle size={18} color="#77580D" />
                      <Text style={styles.noteText}>{entry.notas.trim()}</Text>
                    </View>
                  )}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={entry.preparado ? `${entry.producto_nombre}, listo` : `Marcar ${entry.producto_nombre} como listo`}
                  disabled={entry.preparado || isProcessing || Boolean(processingOrders[order.id_movimiento])}
                  onPress={() => void setPrepared(order, [entry])}
                  style={({ pressed }) => [styles.checkButton, entry.preparado && styles.checkedButton, pressed && !entry.preparado && styles.pressed, (isProcessing || processingOrders[order.id_movimiento]) && styles.disabledButton]}
                >
                  {isProcessing ? <ActivityIndicator color="#FFFFFF" /> : entry.preparado ? <CircleCheck size={27} color="#FFFFFF" /> : <Check size={27} color="#FFFFFF" />}
                </Pressable>
              </View>
            );
          })}
        </View>

        {pendingItems.length > 0 && (
          <Pressable
            accessibilityRole="button"
            disabled={Boolean(processingOrders[order.id_movimiento]) || pendingItems.some((entry) => processingItems[entry.id])}
            onPress={() => void setPrepared(order, pendingItems)}
            style={({ pressed }) => [styles.completeButton, pressed && styles.completeButtonPressed, processingOrders[order.id_movimiento] && styles.disabledButton]}
          >
            {processingOrders[order.id_movimiento]
              ? <ActivityIndicator color="#FFFFFF" />
              : <><Check size={21} color="#FFFFFF" /><Text style={styles.completeButtonText}>Marcar pedido listo</Text></>}
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <HeaderNavbar />
      <View style={styles.titleBar}>
        <View>
          <Text style={styles.title}>Pedidos</Text>
          <Text style={styles.subtitle}>COCINA · {pendingCount} PENDIENTES</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Actualizar pedidos" onPress={() => void refreshOrders()} style={styles.refreshButton}>
          <RefreshCw size={22} color="#3A322B" />
        </Pressable>
      </View>

      <View style={styles.tabs}>
        <Pressable onPress={() => setTab('pending')} style={[styles.tab, tab === 'pending' && styles.activeTab]}>
          <Text style={[styles.tabText, tab === 'pending' && styles.activeTabText]}>Pendientes</Text>
          <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>{pendingCount}</Text></View>
        </Pressable>
        <Pressable onPress={() => setTab('ready')} style={[styles.tab, tab === 'ready' && styles.activeTab]}>
          <Text style={[styles.tabText, tab === 'ready' && styles.activeTabText]}>Listos / Entregados</Text>
          <View style={[styles.readyBadge, tab === 'ready' && styles.activeReadyBadge]}><Text style={styles.readyBadgeText}>{readyCount}</Text></View>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <TriangleAlert size={19} color="#A23A2C" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void refreshOrders()} style={styles.retryButton}><Text style={styles.retryText}>Reintentar</Text></Pressable>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loading}><ActivityIndicator size="large" color="#B74A35" /></View>
      ) : (
        <FlatList
          data={visibleOrders}
          keyExtractor={(order) => String(order.id_movimiento)}
          renderItem={renderOrder}
          contentContainerStyle={[styles.feed, visibleOrders.length === 0 && styles.emptyFeed]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refreshOrders()} tintColor="#B74A35" />}
          ListEmptyComponent={(
            <View style={styles.emptyState}>
              <CircleCheck size={36} color="#5C8B61" />
              <Text style={styles.emptyTitle}>{tab === 'pending' ? 'Sin pedidos pendientes' : 'Todavía no hay pedidos listos'}</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1D1A17' },
  titleBar: { minHeight: 82, paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#F5EBDD', fontSize: 30, fontWeight: '800' },
  subtitle: { color: '#F0B35A', fontSize: 11, fontWeight: '700', marginTop: 5 },
  refreshButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#32281F', borderRadius: 7, borderWidth: 1, borderColor: '#45382E' },
  tabs: { flexDirection: 'row', backgroundColor: '#32281F', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#45382E' },
  tab: { flex: 1, minHeight: 56, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#F0B35A' },
  tabText: { color: '#B8A99A', fontSize: 15, fontWeight: '700' },
  activeTabText: { color: '#F5EBDD' },
  pendingBadge: { minWidth: 25, height: 25, borderRadius: 13, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#B7352D' },
  pendingBadgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  readyBadge: { minWidth: 25, height: 25, borderRadius: 13, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#45382E' },
  activeReadyBadge: { backgroundColor: '#357346' },
  readyBadgeText: { color: '#F5EBDD', fontSize: 13, fontWeight: '800' },
  errorBanner: { marginHorizontal: 14, marginTop: 10, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#39211D', borderWidth: 1, borderColor: '#8E3C31', borderRadius: 6 },
  errorText: { flex: 1, color: '#F0B0A5', fontSize: 14 },
  retryButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 8 },
  retryText: { color: '#F0B35A', fontWeight: '800' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  feed: { padding: 12, paddingBottom: 28, gap: 12 },
  emptyFeed: { flexGrow: 1, justifyContent: 'center' },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  emptyTitle: { color: '#F5EBDD', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  orderCard: { backgroundColor: '#32281F', borderRadius: 7, borderWidth: 1, borderColor: '#45382E', overflow: 'hidden' },
  overdueCard: { borderColor: '#C43D32', borderWidth: 2 },
  orderHeader: { minHeight: 76, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#45382E' },
  overdueHeader: { backgroundColor: '#B7352D', borderBottomColor: '#B7352D' },
  orderHeading: { flex: 1, paddingRight: 8 },
  location: { color: '#F5EBDD', fontSize: 21, fontWeight: '800' },
  orderMeta: { color: '#B8A99A', fontSize: 13, marginTop: 3 },
  timer: { minHeight: 42, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#45382E', borderRadius: 5 },
  overdueTimer: { backgroundColor: '#972B24' },
  timerText: { color: '#F5EBDD', fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  overdueTimerText: { color: '#FFFFFF' },
  items: { paddingHorizontal: 12 },
  itemRow: { minHeight: 84, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#45382E' },
  preparedItem: { opacity: 0.76 },
  quantity: { width: 48, color: '#F0B35A', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  itemDetails: { flex: 1, gap: 4 },
  productName: { color: '#F5EBDD', fontSize: 17, fontWeight: '700' },
  preparedText: { color: '#69C184', textDecorationLine: 'line-through' },
  addModifier: { color: '#69C184', fontSize: 15, fontWeight: '600' },
  removeModifier: { color: '#F08B7D', fontSize: 15, fontWeight: '600' },
  noteBox: { marginTop: 5, padding: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#514221', borderColor: '#8A7135', borderWidth: 1, borderRadius: 5 },
  noteText: { flex: 1, color: '#F7E5A6', fontSize: 15, fontWeight: '600' },
  checkButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#604D3A', borderRadius: 24 },
  checkedButton: { backgroundColor: '#397B49' },
  pressed: { backgroundColor: '#8E5631' },
  disabledButton: { opacity: 0.55 },
  completeButton: { minHeight: 54, marginHorizontal: 12, marginTop: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: '#F0B35A', borderRadius: 6 },
  completeButtonPressed: { backgroundColor: '#D99A40' },
  completeButtonText: { color: '#251D17', fontSize: 16, fontWeight: '800' },
});