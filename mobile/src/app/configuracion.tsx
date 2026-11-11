import React, { useEffect, useState } from 'react';
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
import { AlertTriangle, Building2, Check, HandCoins, Mail, MapPin, Phone, Printer, RotateCcw, Save, SlidersHorizontal, X } from 'lucide-react-native';
import HeaderNavbar from '../components/HeaderNavbar';
import { apiRequest, getAccessToken } from '../constants/api';

type Empresa = {
  id: string;
  nombre: string;
  direccion: string;
  telefono: string;
  NIT: string;
  correo: string;
  impresion_automatica: boolean;
};

type PerfilUsuario = {
  role_name: string;
};

type ConfiguracionSistema = {
  id: number;
  propina: boolean;
  valor_propina: number;
  alerta_bajo_stock: boolean;
};

type CampoEmpresa = 'nombre' | 'direccion' | 'telefono' | 'NIT' | 'correo';

const campos: {
  key: CampoEmpresa;
  label: string;
  placeholder: string;
  icon: typeof Building2;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'words';
}[] = [
  { key: 'nombre', label: 'Nombre de la empresa', placeholder: 'Nombre comercial', icon: Building2, autoCapitalize: 'words' },
  { key: 'direccion', label: 'Dirección', placeholder: 'Dirección de la empresa', icon: MapPin, autoCapitalize: 'words' },
  { key: 'telefono', label: 'Teléfono', placeholder: 'Teléfono de contacto', icon: Phone, keyboardType: 'phone-pad' },
  { key: 'NIT', label: 'NIT', placeholder: 'Número de identificación tributaria', icon: Building2 },
  { key: 'correo', label: 'Correo electrónico', placeholder: 'empresa@ejemplo.com', icon: Mail, keyboardType: 'email-address', autoCapitalize: 'none' },
];

export default function ConfiguracionScreen() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [configuracion, setConfiguracion] = useState<ConfiguracionSistema | null>(null);
  const [impresionAutomatica, setImpresionAutomatica] = useState(true);
  const [propinaAutomatica, setPropinaAutomatica] = useState(false);
  const [valorPropina, setValorPropina] = useState('10');
  const [alertaBajoStock, setAlertaBajoStock] = useState(false);
  const [form, setForm] = useState<Record<CampoEmpresa, string>>({
    nombre: '',
    direccion: '',
    telefono: '',
    NIT: '',
    correo: '',
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    if (!getAccessToken()) {
      setError('Inicia sesión para consultar la configuración de empresa.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const user = await apiRequest<PerfilUsuario>('/auth/me');
      if (user.role_name !== 'Administrador') {
        setIsAdmin(false);
        return;
      }
      setIsAdmin(true);

      const [companies, systemSettings] = await Promise.all([
        apiRequest<Empresa[]>('/empresas/'),
        apiRequest<ConfiguracionSistema>('/configuracion/'),
      ]);
      const currentCompany = companies[0] || null;
      setEmpresa(currentCompany);
      setConfiguracion(systemSettings);
      setPropinaAutomatica(systemSettings.propina);
      setValorPropina(String(systemSettings.valor_propina));
      setAlertaBajoStock(systemSettings.alerta_bajo_stock);
      if (currentCompany) {
        setImpresionAutomatica(currentCompany.impresion_automatica ?? true);
        setForm({
          nombre: currentCompany.nombre || '',
          direccion: currentCompany.direccion || '',
          telefono: currentCompany.telefono || '',
          NIT: currentCompany.NIT || '',
          correo: currentCompany.correo || '',
        });
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No fue posible cargar la configuración de empresa.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startEditing = () => {
    if (!empresa) return;
    setImpresionAutomatica(empresa.impresion_automatica ?? true);
    setForm({
      nombre: empresa.nombre || '',
      direccion: empresa.direccion || '',
      telefono: empresa.telefono || '',
      NIT: empresa.NIT || '',
      correo: empresa.correo || '',
    });
    setEditing(true);
  };

  const cancelEditing = () => {
    if (empresa) {
      setImpresionAutomatica(empresa.impresion_automatica ?? true);
      setForm({
        nombre: empresa.nombre || '',
        direccion: empresa.direccion || '',
        telefono: empresa.telefono || '',
        NIT: empresa.NIT || '',
        correo: empresa.correo || '',
      });
    }
    setEditing(false);
  };

  const save = async () => {
    if (!empresa) return;
    const updatedForm = {
      nombre: form.nombre.trim(),
      direccion: form.direccion.trim(),
      telefono: form.telefono.trim(),
      NIT: form.NIT.trim(),
      correo: form.correo.trim(),
    };

    const missingField = campos.find((field) => !updatedForm[field.key]);
    if (missingField) {
      Alert.alert('Campo requerido', `Completa el campo "${missingField.label}".`);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updatedForm.correo)) {
      Alert.alert('Correo inválido', 'Ingresa un correo electrónico válido.');
      return;
    }

    try {
      setSaving(true);
      const updated = await apiRequest<Empresa>(`/empresas/${empresa.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...updatedForm,
          impresion_automatica: impresionAutomatica,
        }),
      });
      setEmpresa(updated);
      setImpresionAutomatica(updated.impresion_automatica ?? true);
      setForm({
        nombre: updated.nombre,
        direccion: updated.direccion,
        telefono: updated.telefono,
        NIT: updated.NIT,
        correo: updated.correo,
      });
      setEditing(false);
      Alert.alert('Configuración guardada', 'La configuración de la empresa se actualizó correctamente.');
    } catch (requestError) {
      Alert.alert('No se pudo guardar', requestError instanceof Error ? requestError.message : 'Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  const cancelSettingsEditing = () => {
    if (!configuracion) return;
    setPropinaAutomatica(configuracion.propina);
    setValorPropina(String(configuracion.valor_propina));
    setAlertaBajoStock(configuracion.alerta_bajo_stock);
    setEditingSettings(false);
  };

  const saveSettings = async () => {
    if (!configuracion) return;
    const percent = Number(valorPropina);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      Alert.alert('Porcentaje inválido', 'El porcentaje de propina debe estar entre 0 y 100.');
      return;
    }

    try {
      setSavingSettings(true);
      const updated = await apiRequest<ConfiguracionSistema>('/configuracion/', {
        method: 'PUT',
        body: JSON.stringify({
          propina: propinaAutomatica,
          valor_propina: percent,
          alerta_bajo_stock: alertaBajoStock,
        }),
      });
      setConfiguracion(updated);
      setPropinaAutomatica(updated.propina);
      setValorPropina(String(updated.valor_propina));
      setAlertaBajoStock(updated.alerta_bajo_stock);
      setEditingSettings(false);
      Alert.alert('Preferencias guardadas', 'La configuración del sistema se actualizó correctamente.');
    } catch (requestError) {
      Alert.alert('No se pudo guardar', requestError instanceof Error ? requestError.message : 'Intenta nuevamente.');
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <HeaderNavbar />
      {loading ? (
        <ActivityIndicator color="#F0B35A" style={styles.loader} />
      ) : error ? (
        <View style={styles.empty}>
          <Text style={styles.error}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={load}>
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : !isAdmin ? (
        <View style={styles.empty}>
          <Building2 size={34} color="#F0B35A" />
          <Text style={styles.emptyTitle}>Acceso restringido</Text>
          <Text style={styles.emptyText}>Solo un administrador puede consultar y editar las preferencias del sistema.</Text>
        </View>
      ) : (
        <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.heading}>
              <Text style={styles.kicker}>DATOS DEL NEGOCIO</Text>
              <Text style={styles.title}>Configuración</Text>
              <Text style={styles.subtitle}>Administra los datos del negocio y las preferencias del sistema.</Text>
            </View>

            {empresa && <>
            <View style={styles.card}>
              {campos.map((field, index) => {
                const Icon = field.icon;
                return (
                  <View key={field.key} style={[styles.field, index === campos.length - 1 && styles.lastField]}>
                    <View style={styles.fieldHeader}>
                      <Icon size={17} color="#F0B35A" />
                      <Text style={styles.label}>{field.label}</Text>
                    </View>
                    <TextInput
                      value={form[field.key]}
                      onChangeText={(value) => setForm((current) => ({ ...current, [field.key]: value }))}
                      editable={editing && !saving}
                      placeholder={field.placeholder}
                      placeholderTextColor="#998C80"
                      style={[styles.input, !editing && styles.readOnlyInput]}
                      maxLength={255}
                      keyboardType={field.keyboardType || 'default'}
                      autoCapitalize={field.autoCapitalize || 'sentences'}
                      autoCorrect={field.key !== 'correo'}
                    />
                  </View>
                );
              })}
              <View style={[styles.field, styles.printSetting]}>
                <View style={styles.printSettingText}>
                  <View style={styles.fieldHeader}>
                    <Printer size={17} color="#F0B35A" />
                    <Text style={styles.label}>Impresión automática</Text>
                  </View>
                  <Text style={styles.settingDescription}>
                    Abrir el diálogo de impresión al finalizar una cuenta.
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: impresionAutomatica, disabled: !editing || saving }}
                  accessibilityLabel="Impresión automática al finalizar una cuenta"
                  onPress={() => setImpresionAutomatica((current) => !current)}
                  disabled={!editing || saving}
                  style={[
                    styles.toggle,
                    impresionAutomatica && styles.toggleOn,
                    (!editing || saving) && styles.toggleDisabled,
                  ]}
                >
                  <View style={[styles.toggleThumb, impresionAutomatica && styles.toggleThumbOn]} />
                </Pressable>
              </View>
            </View>

            {editing ? (
              <View style={styles.actions}>
                <Pressable style={styles.cancelButton} onPress={cancelEditing} disabled={saving}>
                  <X size={18} color="#F5EBDD" />
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>
                <Pressable style={styles.saveButton} onPress={save} disabled={saving}>
                  {saving ? <ActivityIndicator color="#251D17" /> : <><Check size={18} color="#251D17" /><Text style={styles.saveText}>Guardar cambios</Text></>}
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.saveButton} onPress={startEditing}>
                <Save size={18} color="#251D17" />
                <Text style={styles.saveText}>Editar empresa</Text>
              </Pressable>
            )}

            {!editing && (
              <View style={styles.note}>
                <RotateCcw size={15} color="#C9B9A9" />
                <Text style={styles.noteText}>Los cambios se guardan en la información oficial de la empresa.</Text>
              </View>
            )}
            </>}

            <View style={[styles.card, styles.settingsCard]}>
              <View style={styles.settingsHeading}>
                <SlidersHorizontal size={19} color="#F0B35A" />
                <View style={styles.settingsHeadingText}>
                  <Text style={styles.sectionTitle}>Preferencias del sistema</Text>
                  <Text style={styles.settingDescription}>Configura la propina y las alertas de inventario.</Text>
                </View>
              </View>
              <View style={styles.printSetting}>
                <View style={styles.printSettingText}>
                  <View style={styles.fieldHeader}>
                    <HandCoins size={17} color="#F0B35A" />
                    <Text style={styles.label}>Propina automática</Text>
                  </View>
                  <Text style={styles.settingDescription}>Al activarla, la propina se calcula usando el porcentaje configurado. Si se desactiva, se ingresa manualmente.</Text>
                </View>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: propinaAutomatica, disabled: !editingSettings || savingSettings }}
                  accessibilityLabel="Calcular propina automáticamente"
                  onPress={() => setPropinaAutomatica((current) => !current)}
                  disabled={!editingSettings || savingSettings}
                  style={[styles.toggle, propinaAutomatica && styles.toggleOn, (!editingSettings || savingSettings) && styles.toggleDisabled]}
                >
                  <View style={[styles.toggleThumb, propinaAutomatica && styles.toggleThumbOn]} />
                </Pressable>
              </View>
              <View style={styles.field}>
                <View style={styles.fieldHeader}>
                  <HandCoins size={17} color="#F0B35A" />
                  <Text style={styles.label}>Porcentaje de propina</Text>
                </View>
                <View style={styles.percentInputRow}>
                  <TextInput
                    value={valorPropina}
                    onChangeText={setValorPropina}
                    editable={editingSettings && propinaAutomatica && !savingSettings}
                    keyboardType="decimal-pad"
                    style={[styles.input, styles.percentInput, (!editingSettings || !propinaAutomatica) && styles.readOnlyInput]}
                  />
                  <Text style={styles.percentSuffix}>%</Text>
                </View>
              </View>
              <View style={[styles.printSetting, styles.lastSetting]}>
                <View style={styles.printSettingText}>
                  <View style={styles.fieldHeader}>
                    <AlertTriangle size={17} color="#F0B35A" />
                    <Text style={styles.label}>Alerta de bajo stock</Text>
                  </View>
                  <Text style={styles.settingDescription}>Preferencia lista para activar las alertas de inventario posteriormente.</Text>
                </View>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityState={{ checked: alertaBajoStock, disabled: !editingSettings || savingSettings }}
                  accessibilityLabel="Alerta de bajo stock"
                  onPress={() => setAlertaBajoStock((current) => !current)}
                  disabled={!editingSettings || savingSettings}
                  style={[styles.toggle, alertaBajoStock && styles.toggleOn, (!editingSettings || savingSettings) && styles.toggleDisabled]}
                >
                  <View style={[styles.toggleThumb, alertaBajoStock && styles.toggleThumbOn]} />
                </Pressable>
              </View>
              {editingSettings ? (
                <View style={styles.actions}>
                  <Pressable style={styles.cancelButton} onPress={cancelSettingsEditing} disabled={savingSettings}>
                    <X size={18} color="#F5EBDD" />
                    <Text style={styles.cancelText}>Cancelar</Text>
                  </Pressable>
                  <Pressable style={styles.saveButton} onPress={saveSettings} disabled={savingSettings}>
                    {savingSettings ? <ActivityIndicator color="#251D17" /> : <><Check size={18} color="#251D17" /><Text style={styles.saveText}>Guardar preferencias</Text></>}
                  </Pressable>
                </View>
              ) : (
                <Pressable style={styles.saveButton} onPress={() => setEditingSettings(true)}>
                  <Save size={18} color="#251D17" />
                  <Text style={styles.saveText}>Editar preferencias</Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1D1A17' },
  loader: { flex: 1 },
  content: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 36 },
  heading: { marginBottom: 20 },
  kicker: { color: '#F0B35A', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#F5EBDD', fontSize: 28, fontWeight: '800', marginTop: 5 },
  subtitle: { color: '#B8A99A', fontSize: 14, marginTop: 5 },
  card: { backgroundColor: '#32281F', borderColor: '#45382E', borderWidth: 1, borderRadius: 16, padding: 17 },
  settingsCard: { marginTop: 18 },
  settingsHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  settingsHeadingText: { flex: 1 },
  sectionTitle: { color: '#F5EBDD', fontSize: 17, fontWeight: '800' },
  field: { marginBottom: 18 },
  lastField: { marginBottom: 0 },
  printSetting: { marginTop: 22, marginBottom: 0, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#45382E', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  printSettingText: { flex: 1 },
  settingDescription: { color: '#A99A8B', fontSize: 12, lineHeight: 18 },
  lastSetting: { marginBottom: 0 },
  percentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  percentInput: { flex: 1 },
  percentSuffix: { color: '#F0B35A', fontSize: 16, fontWeight: '700' },
  toggle: { width: 50, height: 30, padding: 3, borderRadius: 16, backgroundColor: '#51463D', justifyContent: 'center' },
  toggleOn: { backgroundColor: '#D8A85B' },
  toggleDisabled: { opacity: 0.75 },
  toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#F5EBDD' },
  toggleThumbOn: { alignSelf: 'flex-end' },
  fieldHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  label: { color: '#D9D0C8', fontSize: 13, fontWeight: '700' },
  input: { minHeight: 48, backgroundColor: '#251F1B', borderWidth: 1, borderColor: '#5A4838', borderRadius: 9, color: '#F5EBDD', fontSize: 15, paddingHorizontal: 12, paddingVertical: 10 },
  readOnlyInput: { color: '#C9B9A9', backgroundColor: '#2A241F', borderColor: '#45382E' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 18 },
  cancelButton: { flex: 1, minHeight: 50, borderRadius: 11, borderWidth: 1, borderColor: '#5A4838', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  cancelText: { color: '#F5EBDD', fontWeight: '700' },
  saveButton: { minHeight: 50, marginTop: 18, borderRadius: 11, backgroundColor: '#F0B35A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveText: { color: '#251D17', fontWeight: '800' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, marginTop: 16 },
  noteText: { color: '#A99A8B', fontSize: 12, flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  emptyTitle: { color: '#F5EBDD', fontSize: 18, fontWeight: '800', marginTop: 14 },
  emptyText: { color: '#B8A99A', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 21 },
  error: { color: '#F0A696', fontSize: 15, textAlign: 'center' },
  retryButton: { marginTop: 18, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, backgroundColor: '#F0B35A' },
  retryText: { color: '#251D17', fontWeight: '800' },
});
