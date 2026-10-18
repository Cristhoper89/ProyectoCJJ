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
import { Building2, Check, Mail, MapPin, Phone, RotateCcw, Save, X } from 'lucide-react-native';
import HeaderNavbar from '../components/HeaderNavbar';
import { apiRequest, getAccessToken } from '../constants/api';

type Empresa = {
  id: string;
  nombre: string;
  direccion: string;
  telefono: string;
  NIT: string;
  correo: string;
};

type PerfilUsuario = {
  role_name: string;
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
  const [form, setForm] = useState<Record<CampoEmpresa, string>>({
    nombre: '',
    direccion: '',
    telefono: '',
    NIT: '',
    correo: '',
  });
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

      const companies = await apiRequest<Empresa[]>('/empresas/');
      const currentCompany = companies[0] || null;
      setEmpresa(currentCompany);
      if (currentCompany) {
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
        body: JSON.stringify(updatedForm),
      });
      setEmpresa(updated);
      setForm({
        nombre: updated.nombre,
        direccion: updated.direccion,
        telefono: updated.telefono,
        NIT: updated.NIT,
        correo: updated.correo,
      });
      setEditing(false);
      Alert.alert('Configuración guardada', 'Los datos de la empresa se actualizaron correctamente.');
    } catch (requestError) {
      Alert.alert('No se pudo guardar', requestError instanceof Error ? requestError.message : 'Intenta nuevamente.');
    } finally {
      setSaving(false);
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
          <Text style={styles.emptyText}>Solo un administrador puede consultar y editar los datos de la empresa.</Text>
        </View>
      ) : !empresa ? (
        <View style={styles.empty}>
          <Building2 size={34} color="#F0B35A" />
          <Text style={styles.emptyTitle}>No hay datos de empresa</Text>
          <Text style={styles.emptyText}>No se encontró una empresa para configurar.</Text>
        </View>
      ) : (
        <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.heading}>
              <Text style={styles.kicker}>DATOS DEL NEGOCIO</Text>
              <Text style={styles.title}>Configuración</Text>
              <Text style={styles.subtitle}>Administra la información de tu empresa.</Text>
            </View>

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
  field: { marginBottom: 18 },
  lastField: { marginBottom: 0 },
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
