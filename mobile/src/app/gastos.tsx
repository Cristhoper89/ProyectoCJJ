import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ReceiptText } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import HeaderNavbar from '../components/HeaderNavbar';
import { apiRequest } from '../constants/api';
import { Caja, isCajaAbierta } from '../constants/caja';

type Categoria = { id: number; nombre: string; estado?: boolean | null };
type Gasto = { id: number };
const NO_OPEN_CASH_MESSAGE = 'No hay una caja abierta. Abre una caja antes de registrar un gasto.';

export default function GastosScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [value, setValue] = useState('');
  const [categories, setCategories] = useState<Categoria[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [cashId, setCashId] = useState<number | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    const loadOptions = async () => {
      const [categoriesResult, cashResult] = await Promise.allSettled([
        apiRequest<Categoria[]>('/categorias/'),
        apiRequest<Caja[]>('/cajas/'),
      ]);
      if (!active) return;

      const errors: string[] = [];
      let hasOpenCash = false;
      if (categoriesResult.status === 'fulfilled') {
        setCategories(categoriesResult.value.filter((category) => category.estado !== false));
      } else {
        errors.push('No se pudieron cargar las categorías.');
      }

      if (cashResult.status === 'fulfilled') {
        const available = (Array.isArray(cashResult.value) ? cashResult.value : [])
          .filter(isCajaAbierta)
          .sort((first, second) => second.id - first.id);
        setCashId(available[0]?.id ?? null);
        hasOpenCash = available.length > 0;
        if (!available.length) {
          Alert.alert('No hay una caja abierta', NO_OPEN_CASH_MESSAGE);
        }
      } else {
        errors.push('No se pudieron cargar las cajas abiertas.');
      }

      if (errors.length || (cashResult.status === 'fulfilled' && !hasOpenCash)) {
        setError([!hasOpenCash && cashResult.status === 'fulfilled' ? NO_OPEN_CASH_MESSAGE : '', ...errors].filter(Boolean).join(' '));
      }
      setLoadingOptions(false);
    };

    void loadOptions();
    return () => { active = false; };
  }, []);

  const saveExpense = async () => {
    const expenseName = name.trim();
    const normalizedValue = value.trim().replace(',', '.');
    const amount = Number(normalizedValue);
    setSuccess('');

    if (!expenseName) {
      setError('Escribe el nombre del gasto.');
      return;
    }
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalizedValue) || !Number.isFinite(amount) || amount <= 0) {
      setError('Ingresa un valor mayor que cero con hasta dos decimales.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      const cashBoxes = await apiRequest<Caja[]>('/cajas/');
      const activeCash = (Array.isArray(cashBoxes) ? cashBoxes : [])
        .filter(isCajaAbierta)
        .sort((first, second) => second.id - first.id)[0] ?? null;
      setCashId(activeCash?.id ?? null);
      if (!activeCash) {
        setError(NO_OPEN_CASH_MESSAGE);
        Alert.alert('No hay una caja abierta', NO_OPEN_CASH_MESSAGE);
        return;
      }

      await apiRequest<Gasto>('/gastos/', {
        method: 'POST',
        body: JSON.stringify({
          nombre: expenseName,
          descripcion: description.trim() || null,
          valor: amount,
          categoria: categoryId,
          id_caja: activeCash.id,
        }),
      });
      setName('');
      setDescription('');
      setValue('');
      setSuccess('Gasto registrado correctamente.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No fue posible registrar el gasto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <HeaderNavbar />
      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.pageHeader}>
            <View>
              <Text style={styles.kicker}>CAJA Y MOVIMIENTOS</Text>
              <Text style={styles.title}>Registrar gasto</Text>
              <Text style={styles.subtitle}>El gasto se registrará automáticamente en la caja abierta actual.</Text>
            </View>
            <Pressable style={styles.historyLink} onPress={() => router.push('/movimientos' as any)}>
              <ReceiptText size={16} color="#F5D3A7" />
              <Text style={styles.historyLinkText}>Historial de caja</Text>
            </Pressable>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>Nombre del gasto</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ej. Compra de insumos"
              placeholderTextColor="#998C80"
              style={styles.input}
              maxLength={100}
              autoCapitalize="sentences"
            />

            <Text style={styles.label}>Valor</Text>
            <View style={styles.valueInput}>
              <Text style={styles.currency}>$</Text>
              <TextInput
                value={value}
                onChangeText={setValue}
                placeholder="0"
                placeholderTextColor="#998C80"
                style={styles.valueText}
                keyboardType="decimal-pad"
                maxLength={14}
              />
            </View>

            <Text style={styles.label}>Descripción</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Detalle opcional del gasto"
              placeholderTextColor="#998C80"
              style={[styles.input, styles.descriptionInput]}
              multiline
              maxLength={255}
            />

            <View style={styles.selectorHeading}>
              <Text style={styles.label}>Categoría</Text>
              {loadingOptions && <ActivityIndicator size="small" color="#F0B35A" />}
            </View>
            <View style={styles.chips}>
              <Pressable style={[styles.chip, categoryId === null && styles.chipSelected]} onPress={() => setCategoryId(null)}>
                <Text style={[styles.chipText, categoryId === null && styles.chipTextSelected]}>Sin categoría</Text>
              </Pressable>
              {categories.map((category) => (
                <Pressable key={category.id} style={[styles.chip, categoryId === category.id && styles.chipSelected]} onPress={() => setCategoryId(category.id)}>
                  <Text style={[styles.chipText, categoryId === category.id && styles.chipTextSelected]}>{category.nombre}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Caja actual</Text>
            <Text style={styles.currentCash}>{cashId ? `Caja #${cashId} (abierta)` : 'No hay caja abierta'}</Text>

            {!!error && <Text style={styles.error}>{error}</Text>}
            {!!success && <Text style={styles.success}>{success}</Text>}
            <Pressable style={[styles.saveButton, saving && styles.disabledButton]} onPress={saveExpense} disabled={saving}>
              {saving ? <ActivityIndicator color="#251D17" /> : <><Check size={18} color="#251D17" /><Text style={styles.saveButtonText}>Guardar gasto</Text></>}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1D1A17' },
  content: { flex: 1 },
  scrollContent: { width: '100%', maxWidth: 1000, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 36 },
  pageHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, marginBottom: 20 },
  kicker: { color: '#F0B35A', fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  title: { marginTop: 5, color: '#F5EBDD', fontSize: 25, fontWeight: '800' },
  subtitle: { marginTop: 5, color: '#B8B1A8', fontSize: 12, lineHeight: 18 },
  historyLink: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 10, borderWidth: 1, borderColor: '#604D3A', borderRadius: 7 },
  historyLinkText: { color: '#F5D3A7', fontSize: 11, fontWeight: '700' },
  formCard: { padding: 18, borderWidth: 1, borderColor: '#45382E', borderRadius: 10, backgroundColor: '#32281F' },
  label: { marginTop: 14, marginBottom: 7, color: '#D9D0C8', fontSize: 12, fontWeight: '700' },
  input: { minHeight: 46, paddingHorizontal: 12, borderWidth: 1, borderColor: '#604D3A', borderRadius: 7, backgroundColor: '#2D2620', color: '#F5EBDD', fontSize: 14 },
  descriptionInput: { minHeight: 78, paddingTop: 11, textAlignVertical: 'top' },
  valueInput: { height: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderWidth: 1, borderColor: '#604D3A', borderRadius: 7, backgroundColor: '#2D2620' },
  currency: { marginRight: 8, color: '#F0B35A', fontSize: 17, fontWeight: '800' },
  valueText: { flex: 1, color: '#F5EBDD', fontSize: 16, fontWeight: '700' },
  selectorHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: '#604D3A', borderRadius: 7 },
  chipSelected: { borderColor: '#F0B35A', backgroundColor: '#F0B35A' },
  chipText: { color: '#B8B1A8', fontSize: 11, fontWeight: '700' },
  chipTextSelected: { color: '#251D17' },
  currentCash: { minHeight: 42, paddingHorizontal: 12, paddingVertical: 11, borderWidth: 1, borderColor: '#604D3A', borderRadius: 7, backgroundColor: '#2D2620', color: '#F5D3A7', fontSize: 13, fontWeight: '700' },
  error: { marginTop: 14, color: '#F28C8C', fontSize: 12, lineHeight: 18 },
  success: { marginTop: 14, color: '#6DD3A0', fontSize: 12, lineHeight: 18 },
  saveButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 22, borderRadius: 7, backgroundColor: '#F0B35A' },
  disabledButton: { opacity: 0.65 },
  saveButtonText: { color: '#251D17', fontSize: 13, fontWeight: '900' },
});
