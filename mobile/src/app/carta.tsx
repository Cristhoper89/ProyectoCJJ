import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, Camera, Check, ChevronRight, Minus, Plus, ShoppingBag, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { apiRequest } from '../constants/api';

type CartaIngrediente = { id: number; nombre: string };
type CartaOpcion = { id: number; nombre: string };
type CartaGrupo = { id: number; nombre: string; opciones: CartaOpcion[] };
type ProductoCarta = {
  id: number;
  nombre: string;
  descripcion?: string | null;
  precio: number;
  preparacion: boolean;
  imagen_url?: string | null;
  ingredientes: CartaIngrediente[];
  grupos_opciones: CartaGrupo[];
};
type CategoriaCarta = { id: number; nombre: string; productos: ProductoCarta[] };
type CatalogoCarta = { categorias: CategoriaCarta[] };
type MesaCartaItem = {
  id: number;
  id_producto: number;
  producto_nombre: string;
  cantidad: number;
  subtotal: number;
  notas?: string | null;
  personalizaciones?: string | null;
};
type MesaCarta = {
  mesa_id: number;
  mesa_nombre: string;
  activa: boolean;
  total: number;
  items: MesaCartaItem[];
};
type LineaCarrito = {
  id: string;
  producto: ProductoCarta;
  cantidad: number;
  ingredientes: Record<number, boolean>;
  opciones: Record<number, number>;
  notas: string;
};

const CART_KEY = '@carta_carrito';
const TABLE_KEY = '@carta_mesa';
const money = (value: number) => `$${Number(value || 0).toLocaleString('es-CO')}`;

function parseMesaQr(rawValue: string): number | null {
  const value = rawValue.trim();
  if (/^\d+$/.test(value)) return Number(value);

  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed === 'object' && parsed !== null && 'mesa_id' in parsed) {
      const mesaId = Number((parsed as { mesa_id: unknown }).mesa_id);
      if (Number.isInteger(mesaId) && mesaId > 0) return mesaId;
    }
  } catch {
    const match = value.match(/(?:mesa\/|mesa_id=)(\d+)/i);
    if (match) return Number(match[1]);
  }
  return null;
}

export default function CartaScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [catalog, setCatalog] = useState<CategoriaCarta[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cacheReady, setCacheReady] = useState(false);
  const [cart, setCart] = useState<LineaCarrito[]>([]);
  const [mesaId, setMesaId] = useState<number | null>(null);
  const [mesa, setMesa] = useState<MesaCarta | null>(null);
  const [mesaError, setMesaError] = useState('');
  const [product, setProduct] = useState<ProductoCarta | null>(null);
  const [ingredientSelection, setIngredientSelection] = useState<Record<number, boolean>>({});
  const [optionSelection, setOptionSelection] = useState<Record<number, number>>({});
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [mesaOpen, setMesaOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const scannedRef = useRef(false);

  const loadCatalog = useCallback(async () => {
    try {
      setError('');
      setLoading(true);
      const result = await apiRequest<CatalogoCarta>('/carta/');
      setCatalog(result.categorias);
      setCategoryId((current) => current ?? result.categorias[0]?.id ?? null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No fue posible cargar la carta.');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshMesa = useCallback(async (currentMesaId: number) => {
    try {
      const result = await apiRequest<MesaCarta>(`/carta/mesas/${currentMesaId}`);
      if (!result.activa) {
        await AsyncStorage.removeItem(TABLE_KEY);
        setMesaId(null);
        setMesa(null);
        setMesaError('');
        Alert.alert('Mesa finalizada', 'La mesa ya fue cerrada. Escanea el código QR de una mesa activa para vincularte de nuevo.');
        return;
      }
      setMesa(result);
      setMesaError('');
    } catch (requestError) {
      setMesaError(requestError instanceof Error ? requestError.message : 'No fue posible consultar la mesa.');
    }
  }, []);

  useEffect(() => {
    let active = true;
    const restoreCache = async () => {
      try {
        const [savedCart, savedMesa] = await Promise.all([
          AsyncStorage.getItem(CART_KEY),
          AsyncStorage.getItem(TABLE_KEY),
        ]);
        if (!active) return;
        if (savedCart) setCart(JSON.parse(savedCart) as LineaCarrito[]);
        if (savedMesa && /^\d+$/.test(savedMesa)) setMesaId(Number(savedMesa));
      } catch (cacheError) {
        Alert.alert(
          'No se pudo recuperar el carrito',
          cacheError instanceof Error ? cacheError.message : 'El almacenamiento local no está disponible.',
        );
      } finally {
        if (active) setCacheReady(true);
      }
    };
    void restoreCache();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (cacheReady) {
      void AsyncStorage.setItem(CART_KEY, JSON.stringify(cart)).catch((cacheError: unknown) => {
        Alert.alert(
          'No se pudo guardar el carrito',
          cacheError instanceof Error ? cacheError.message : 'El almacenamiento local no está disponible.',
        );
      });
    }
  }, [cacheReady, cart]);

  useFocusEffect(useCallback(() => {
    void loadCatalog();
    if (mesaId !== null) void refreshMesa(mesaId);
  }, [loadCatalog, mesaId, refreshMesa]));

  useEffect(() => {
    if (mesaId === null) return;
    const timer = setInterval(() => { void refreshMesa(mesaId); }, 15000);
    return () => clearInterval(timer);
  }, [mesaId, refreshMesa]);

  const categories = useMemo(() => [
    { id: null, nombre: 'Todos', productos: catalog.flatMap((category) => category.productos) },
    ...catalog,
  ], [catalog]);

  const filteredProducts = useMemo(() => {
    const selectedCategory = categories.find((category) => category.id === categoryId);
    const products = selectedCategory?.productos || [];
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return normalizedSearch
      ? products.filter((item) => item.nombre.toLocaleLowerCase().includes(normalizedSearch))
      : products;
  }, [categories, categoryId, search]);

  const cartTotal = useMemo(
    () => cart.reduce((total, line) => total + Number(line.producto.precio) * line.cantidad, 0),
    [cart],
  );
  const cartCount = useMemo(
    () => cart.reduce((total, line) => total + line.cantidad, 0),
    [cart],
  );

  const openProduct = (item: ProductoCarta) => {
    setProduct(item);
    setQuantity(1);
    setNotes('');
    setIngredientSelection(Object.fromEntries(item.ingredientes.map((ingredient) => [ingredient.id, true])));
    setOptionSelection({});
  };

  const addToCart = () => {
    if (!product) return;
    const line: LineaCarrito = {
      id: `${product.id}-${Date.now()}`,
      producto: product,
      cantidad: quantity,
      ingredientes: ingredientSelection,
      opciones: optionSelection,
      notas: notes.trim(),
    };
    setCart((current) => [...current, line]);
    setProduct(null);
  };

  const updateCartLine = (lineId: string, delta: number) => {
    setCart((current) => current.flatMap((line) => {
      if (line.id !== lineId) return [line];
      const nextQuantity = line.cantidad + delta;
      return nextQuantity > 0 ? [{ ...line, cantidad: nextQuantity }] : [];
    }));
  };

  const startQrScan = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Se necesita acceso a la cámara', 'Permite el acceso a la cámara para escanear el QR de la mesa.');
        return;
      }
    }
    scannedRef.current = false;
    setScannerOpen(true);
  };

  const onQrScanned = async ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    const scannedMesaId = parseMesaQr(data);
    if (!scannedMesaId) {
      scannedRef.current = false;
      Alert.alert('Código QR inválido', 'El código debe contener el identificador de la mesa.');
      return;
    }

    try {
      setSaving(true);
      const result = await apiRequest<MesaCarta>(`/carta/mesas/${scannedMesaId}`);
      if (!result.activa) {
        scannedRef.current = false;
        Alert.alert('Mesa no disponible', 'La mesa todavía no está abierta o ya fue finalizada.');
        return;
      }
      await AsyncStorage.setItem(TABLE_KEY, String(scannedMesaId));
      setMesaId(scannedMesaId);
      setMesa(result);
      setMesaError('');
      setScannerOpen(false);
    } catch (requestError) {
      scannedRef.current = false;
      Alert.alert('No se pudo vincular la mesa', requestError instanceof Error ? requestError.message : 'Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  const submitOrder = async () => {
    if (cart.length === 0) return;
    if (mesaId === null) {
      setCartOpen(false);
      await startQrScan();
      return;
    }
    try {
      setSaving(true);
      const order = await apiRequest<MesaCarta>(`/carta/mesas/${mesaId}/pedidos`, {
        method: 'POST',
        body: JSON.stringify({
          items: cart.map((line) => ({
            id_producto: line.producto.id,
            cantidad: line.cantidad,
            ingredientes: line.producto.preparacion
              ? line.producto.ingredientes.map((ingredient) => ({
                  id_ingrediente: ingredient.id,
                  incluido: line.ingredientes[ingredient.id] !== false,
                }))
              : [],
            opciones: Object.entries(line.opciones).map(([groupId, optionId]) => ({
              id_grupo_opcion: Number(groupId),
              id_opcion: Number(optionId),
            })),
            notas: line.notas || null,
          })),
        }),
      });
      if (!order.activa) {
        await AsyncStorage.removeItem(TABLE_KEY);
        setMesaId(null);
        setMesa(null);
        setMesaError('');
        throw new Error('La mesa se finalizó antes de registrar el pedido. Escanea un código QR activo.');
      }
      setMesa(order);
      setMesaError('');
      setCart([]);
      await AsyncStorage.setItem(CART_KEY, '[]');
      setCartOpen(false);
      setMesaOpen(true);
    } catch (requestError) {
      Alert.alert('No se pudo enviar el pedido', requestError instanceof Error ? requestError.message : 'Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={21} color="#D8A85B" />
        </Pressable>
        <View style={styles.brand}>
          <Text style={styles.brandEyebrow}>LA CABAÑA</Text>
          <Text style={styles.brandTitle}>Nuestra carta</Text>
        </View>
        <Pressable style={styles.mesaButton} onPress={() => mesa ? setMesaOpen(true) : void startQrScan()}>
          {mesa ? <Text style={styles.mesaButtonText}>{mesa.mesa_nombre}</Text> : <Camera size={19} color="#D8A85B" />}
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Sabores para disfrutar</Text>
        <Text style={styles.heroSubtitle}>Elige tus favoritos y personalízalos a tu gusto.</Text>
      </View>

      <View style={styles.searchBox}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar en la carta"
          placeholderTextColor="#9C9287"
          style={styles.searchInput}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
        {categories.map((category) => (
          <Pressable
            key={category.id ?? 'all'}
            style={[styles.categoryChip, categoryId === category.id && styles.categoryChipSelected]}
            onPress={() => setCategoryId(category.id)}
          >
            <Text style={[styles.categoryText, categoryId === category.id && styles.categoryTextSelected]}>
              {category.nombre}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color="#D8A85B" style={styles.loading} />
      ) : error ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No pudimos cargar la carta</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadCatalog()}>
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.productList}>
          {filteredProducts.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No encontramos productos</Text>
              <Text style={styles.emptyText}>Prueba con otra categoría o búsqueda.</Text>
            </View>
          ) : filteredProducts.map((item) => (
            <Pressable key={item.id} style={styles.productCard} onPress={() => openProduct(item)}>
              <View style={styles.productCopy}>
                <Text style={styles.productName}>{item.nombre}</Text>
                <Text style={styles.productDescription} numberOfLines={2}>{item.descripcion || 'Preparado al momento con ingredientes seleccionados.'}</Text>
                <View style={styles.productFooter}>
                  <Text style={styles.productPrice}>{money(item.precio)}</Text>
                  <View style={styles.addButton}>
                    <Plus size={17} color="#1D1A17" />
                  </View>
                </View>
              </View>
              {item.imagen_url
                ? <Image source={{ uri: item.imagen_url }} style={styles.productImage} resizeMode="cover" />
                : <View style={[styles.productImage, styles.imagePlaceholder]}><ShoppingBag size={25} color="#D8A85B" /></View>}
            </Pressable>
          ))}
        </ScrollView>
      )}

      <View style={styles.bottomBar}>
        {!!mesaError && <Text style={styles.mesaError}>{mesaError}</Text>}
        {mesa ? (
          <Pressable style={styles.linkedMesa} onPress={() => setMesaOpen(true)}>
            <Check size={16} color="#2ECC71" />
            <Text style={styles.linkedMesaText}>Vinculado a {mesa.mesa_nombre}</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.scanPrompt} onPress={() => void startQrScan()}>
            <Camera size={17} color="#D8A85B" />
            <Text style={styles.scanPromptText}>Escanea el QR de tu mesa</Text>
          </Pressable>
        )}
        <Pressable style={styles.cartButton} onPress={() => setCartOpen(true)}>
          <ShoppingBag size={19} color="#1D1A17" />
          <Text style={styles.cartButtonText}>Mi pedido{cartCount > 0 ? ` · ${cartCount}` : ''}</Text>
          {cartCount > 0 && <Text style={styles.cartButtonText}>{money(cartTotal)}</Text>}
        </Pressable>
      </View>

      <Modal visible={product !== null} transparent animationType="slide" onRequestClose={() => setProduct(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.detailSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Personaliza tu plato</Text>
              <Pressable onPress={() => setProduct(null)}><X size={22} color="#F5F5F5" /></Pressable>
            </View>
            <ScrollView>
              {product?.imagen_url && <Image source={{ uri: product.imagen_url }} style={styles.detailImage} resizeMode="cover" />}
              <Text style={styles.detailTitle}>{product?.nombre}</Text>
              <Text style={styles.detailDescription}>{product?.descripcion}</Text>
              <Text style={styles.detailPrice}>{money(product?.precio || 0)}</Text>
              {product?.preparacion && product.ingredientes.length ? (
                <View style={styles.customSection}>
                  <Text style={styles.sectionTitle}>Ingredientes</Text>
                  <Text style={styles.sectionHint}>Quita lo que prefieras.</Text>
                  {product.ingredientes.map((ingredient) => {
                    const included = ingredientSelection[ingredient.id] !== false;
                    return (
                      <Pressable
                        key={ingredient.id}
                        style={styles.selectionRow}
                        onPress={() => setIngredientSelection((current) => ({ ...current, [ingredient.id]: !included }))}
                      >
                        <View style={[styles.checkbox, included && styles.checkboxSelected]}>{included && <Check size={13} color="#1D1A17" />}</View>
                        <Text style={styles.selectionText}>{ingredient.nombre}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              {product?.grupos_opciones.map((group) => (
                <View key={group.id} style={styles.customSection}>
                  <Text style={styles.sectionTitle}>{group.nombre}</Text>
                  {group.opciones.map((option) => {
                    const selected = optionSelection[group.id] === option.id;
                    return (
                      <Pressable
                        key={option.id}
                        style={styles.selectionRow}
                        onPress={() => setOptionSelection((current) => {
                          const next = { ...current };
                          if (selected) delete next[group.id];
                          else next[group.id] = option.id;
                          return next;
                        })}
                      >
                        <View style={[styles.radio, selected && styles.radioSelected]} />
                        <Text style={styles.selectionText}>{option.nombre}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
              <Text style={styles.fieldLabel}>Instrucciones especiales</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Ej. Sin picante"
                placeholderTextColor="#9C9287"
                style={styles.notesInput}
                maxLength={500}
              />
              <View style={styles.quantityRow}>
                <Text style={styles.sectionTitle}>Cantidad</Text>
                <View style={styles.quantityControls}>
                  <Pressable style={styles.quantityButton} onPress={() => setQuantity((value) => Math.max(1, value - 1))}><Minus size={16} color="#F5F5F5" /></Pressable>
                  <Text style={styles.quantityText}>{quantity}</Text>
                  <Pressable style={styles.quantityButton} onPress={() => setQuantity((value) => Math.min(99, value + 1))}><Plus size={16} color="#F5F5F5" /></Pressable>
                </View>
              </View>
            </ScrollView>
            <Pressable style={styles.primaryButton} onPress={addToCart}>
              <Text style={styles.primaryButtonText}>Agregar · {money((product?.precio || 0) * quantity)}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={cartOpen} transparent animationType="slide" onRequestClose={() => setCartOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.detailSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Tu pedido</Text>
              <Pressable onPress={() => setCartOpen(false)}><X size={22} color="#F5F5F5" /></Pressable>
            </View>
            <ScrollView style={styles.cartLines}>
              {cart.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>Tu carrito está vacío</Text>
                  <Text style={styles.emptyText}>Agrega productos de la carta para empezar.</Text>
                </View>
              ) : cart.map((line) => (
                <View key={line.id} style={styles.cartLine}>
                  <View style={styles.cartLineCopy}>
                    <Text style={styles.selectionText}>{line.producto.nombre}</Text>
                    <Text style={styles.sectionHint}>{money(line.producto.precio)} · {money(line.producto.precio * line.cantidad)}</Text>
                    {!!line.notas && <Text style={styles.sectionHint}>{line.notas}</Text>}
                    {Object.entries(line.ingredientes).some(([, included]) => !included) && (
                      <Text style={styles.sectionHint}>
                        Sin {line.producto.ingredientes.filter((ingredient) => !line.ingredientes[ingredient.id]).map((ingredient) => ingredient.nombre).join(', ')}
                      </Text>
                    )}
                    {Object.entries(line.opciones).map(([groupId, optionId]) => {
                      const group = line.producto.grupos_opciones.find((entry) => entry.id === Number(groupId));
                      const option = group?.opciones.find((entry) => entry.id === optionId);
                      return option && group
                        ? <Text key={groupId} style={styles.sectionHint}>{group.nombre}: {option.nombre}</Text>
                        : null;
                    })}
                    <View style={styles.quantityControls}>
                      <Pressable style={styles.quantityButton} onPress={() => updateCartLine(line.id, -1)}><Minus size={14} color="#F5F5F5" /></Pressable>
                      <Text style={styles.quantityText}>{line.cantidad}</Text>
                      <Pressable style={styles.quantityButton} onPress={() => updateCartLine(line.id, 1)}><Plus size={14} color="#F5F5F5" /></Pressable>
                    </View>
                  </View>
                  {line.producto.imagen_url
                    ? <Image source={{ uri: line.producto.imagen_url }} style={styles.cartImage} />
                    : <View style={[styles.cartImage, styles.imagePlaceholder]}><ShoppingBag size={20} color="#D8A85B" /></View>}
                </View>
              ))}
            </ScrollView>
            <View style={styles.totalRow}>
              <Text style={styles.sectionTitle}>Total</Text>
              <Text style={styles.detailPrice}>{money(cartTotal)}</Text>
            </View>
            <Pressable style={styles.primaryButton} onPress={() => void submitOrder()} disabled={saving || cart.length === 0}>
              {saving ? <ActivityIndicator color="#1D1A17" /> : <Text style={styles.primaryButtonText}>{mesa ? 'Enviar pedido a la mesa' : 'Escanear QR para enviar'}</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={mesaOpen} transparent animationType="slide" onRequestClose={() => setMesaOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.detailSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{mesa?.mesa_nombre || 'Mi mesa'}</Text>
              <Pressable onPress={() => setMesaOpen(false)}><X size={22} color="#F5F5F5" /></Pressable>
            </View>
            {mesa?.items.length ? mesa.items.map((item) => (
              <View key={item.id} style={styles.tableLine}>
                <View style={styles.cartLineCopy}>
                  <Text style={styles.selectionText}>{item.cantidad} × {item.producto_nombre}</Text>
                  {!!item.notas && <Text style={styles.sectionHint}>{item.notas}</Text>}
                  {!!item.personalizaciones && <Text style={styles.sectionHint}>{item.personalizaciones}</Text>}
                </View>
                <Text style={styles.selectionText}>{money(item.subtotal)}</Text>
              </View>
            )) : <Text style={styles.emptyText}>Aún no hay productos registrados en esta mesa.</Text>}
            <View style={styles.totalRow}>
              <Text style={styles.sectionTitle}>Total de la mesa</Text>
              <Text style={styles.detailPrice}>{money(mesa?.total || 0)}</Text>
            </View>
            <Pressable style={styles.secondaryButton} onPress={() => { setMesaOpen(false); void startQrScan(); }}>
              <Text style={styles.secondaryButtonText}>Cambiar de mesa · escanear QR</Text>
              <ChevronRight size={18} color="#D8A85B" />
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={scannerOpen} animationType="slide" onRequestClose={() => setScannerOpen(false)}>
        <SafeAreaView style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <Text style={styles.sheetTitle}>Escanea el QR de tu mesa</Text>
            <Pressable onPress={() => setScannerOpen(false)}><X size={24} color="#F5F5F5" /></Pressable>
          </View>
          {permission?.granted ? (
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={onQrScanned}
            />
          ) : (
            <View style={styles.empty}><Text style={styles.emptyText}>Se requiere permiso de cámara para escanear el código.</Text></View>
          )}
          <Text style={styles.scannerHint}>Ubica el código QR de la mesa dentro del marco.</Text>
          {saving && <ActivityIndicator color="#D8A85B" />}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1D1A17' },
  header: { minHeight: 70, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#45382E' },
  backButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  brand: { flex: 1 },
  brandEyebrow: { color: '#D8A85B', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  brandTitle: { color: '#F5F5F5', fontSize: 19, fontWeight: '800', marginTop: 2 },
  mesaButton: { minWidth: 42, minHeight: 42, paddingHorizontal: 10, borderWidth: 1, borderColor: '#604D3A', borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  mesaButtonText: { color: '#D8A85B', fontWeight: '700' },
  hero: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 14 },
  heroTitle: { color: '#F5F5F5', fontSize: 25, fontWeight: '800' },
  heroSubtitle: { color: '#B8B1A8', fontSize: 13, marginTop: 6 },
  searchBox: { marginHorizontal: 18, marginBottom: 14, minHeight: 46, justifyContent: 'center', paddingHorizontal: 14, backgroundColor: '#2D2620', borderWidth: 1, borderColor: '#4A3D31', borderRadius: 10 },
  searchInput: { color: '#F5F5F5', fontSize: 14 },
  categoryList: { gap: 8, paddingHorizontal: 18, paddingBottom: 14 },
  categoryChip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 15, backgroundColor: '#32281F', borderWidth: 1, borderColor: '#45382E', borderRadius: 18 },
  categoryChipSelected: { backgroundColor: '#D8A85B', borderColor: '#D8A85B' },
  categoryText: { color: '#B8B1A8', fontSize: 12, fontWeight: '700' },
  categoryTextSelected: { color: '#1D1A17' },
  loading: { marginTop: 48 },
  productList: { paddingHorizontal: 16, paddingBottom: 20 },
  productCard: { minHeight: 145, flexDirection: 'row', marginBottom: 12, padding: 12, backgroundColor: '#32281F', borderWidth: 1, borderColor: '#45382E', borderRadius: 16, gap: 12 },
  productCopy: { flex: 1, justifyContent: 'space-between' },
  productName: { color: '#F5F5F5', fontSize: 16, fontWeight: '800' },
  productDescription: { color: '#B8B1A8', fontSize: 12, lineHeight: 17, marginTop: 5 },
  productFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  productPrice: { color: '#F5F5F5', fontSize: 15, fontWeight: '800' },
  addButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D8A85B', borderRadius: 18 },
  productImage: { width: 112, height: 118, alignSelf: 'center', borderRadius: 12, backgroundColor: '#251F1A' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#604D3A' },
  bottomBar: { padding: 12, paddingBottom: 8, backgroundColor: '#32281F', borderTopWidth: 1, borderTopColor: '#45382E' },
  linkedMesa: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 9 },
  linkedMesaText: { color: '#2ECC71', fontSize: 12, fontWeight: '700' },
  mesaError: { color: '#E7A28C', fontSize: 11, textAlign: 'center', marginBottom: 8 },
  scanPrompt: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, marginBottom: 9 },
  scanPromptText: { color: '#D8A85B', fontSize: 12, fontWeight: '700' },
  cartButton: { minHeight: 50, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#D8A85B', borderRadius: 10 },
  cartButtonText: { color: '#1D1A17', fontSize: 14, fontWeight: '800' },
  empty: { alignItems: 'center', paddingHorizontal: 30, paddingVertical: 35 },
  emptyTitle: { color: '#F5F5F5', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: '#B8B1A8', fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 8 },
  retryButton: { marginTop: 18, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: '#D8A85B', borderRadius: 8 },
  retryText: { color: '#1D1A17', fontWeight: '800' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.68)' },
  detailSheet: { maxHeight: '90%', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 22, backgroundColor: '#32281F', borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: '#45382E' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14 },
  sheetTitle: { color: '#F5F5F5', fontSize: 19, fontWeight: '800' },
  detailImage: { width: '100%', height: 185, borderRadius: 12, marginBottom: 15 },
  detailTitle: { color: '#F5F5F5', fontSize: 23, fontWeight: '800' },
  detailDescription: { color: '#B8B1A8', fontSize: 13, lineHeight: 19, marginTop: 6 },
  detailPrice: { color: '#D8A85B', fontSize: 18, fontWeight: '800', marginTop: 10 },
  customSection: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#45382E' },
  sectionTitle: { color: '#F5F5F5', fontSize: 15, fontWeight: '700' },
  sectionHint: { color: '#9C9287', fontSize: 11, marginTop: 3 },
  selectionRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectionText: { color: '#F5F5F5', fontSize: 13, flex: 1 },
  checkbox: { width: 21, height: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#806B55', borderRadius: 4 },
  checkboxSelected: { backgroundColor: '#D8A85B', borderColor: '#D8A85B' },
  radio: { width: 20, height: 20, borderWidth: 1, borderColor: '#806B55', borderRadius: 10 },
  radioSelected: { borderWidth: 6, borderColor: '#D8A85B' },
  fieldLabel: { color: '#F5F5F5', fontSize: 13, fontWeight: '700', marginTop: 16, marginBottom: 7 },
  notesInput: { minHeight: 44, paddingHorizontal: 12, color: '#F5F5F5', backgroundColor: '#2D2620', borderWidth: 1, borderColor: '#4A3D31', borderRadius: 8 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15 },
  quantityControls: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  quantityButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#604D3A', borderRadius: 17 },
  quantityText: { minWidth: 18, color: '#F5F5F5', textAlign: 'center', fontSize: 15, fontWeight: '700' },
  primaryButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 14, paddingHorizontal: 12, backgroundColor: '#D8A85B', borderRadius: 9 },
  primaryButtonText: { color: '#1D1A17', fontSize: 14, fontWeight: '800' },
  cartLines: { maxHeight: 400 },
  cartLine: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#45382E' },
  cartLineCopy: { flex: 1, gap: 4 },
  cartImage: { width: 68, height: 68, borderRadius: 10, backgroundColor: '#251F1A' },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16 },
  tableLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#45382E' },
  secondaryButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, borderWidth: 1, borderColor: '#604D3A', borderRadius: 8 },
  secondaryButtonText: { color: '#D8A85B', fontWeight: '700' },
  scannerContainer: { flex: 1, backgroundColor: '#1D1A17', padding: 18 },
  scannerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52 },
  camera: { flex: 1, overflow: 'hidden', marginVertical: 20, borderRadius: 16 },
  scannerHint: { color: '#B8B1A8', textAlign: 'center', marginBottom: 18 },
});
