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
import { AtSign, CalendarDays, Check, Edit3, Mail, Phone, ShieldCheck, User, X } from 'lucide-react-native';
import HeaderNavbar from '../components/HeaderNavbar';
import { apiRequest, getAccessToken } from '../constants/api';

type UserProfile = {
  id: string;
  username: string;
  nombre: string | null;
  email: string;
  telefono: string | null;
  role_name: string;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Sin registro';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Sin registro'
    : date.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
};

export default function PerfilScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadProfile = async () => {
    if (!getAccessToken()) {
      setError('Inicia sesión para consultar tu perfil.');
      setLoading(false);
      return;
    }

    try {
      setError('');
      const data = await apiRequest<UserProfile>('/auth/me');
      setProfile(data);
      setName(data.nombre || '');
      setEmail(data.email || '');
      setPhone(data.telefono || '');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No fue posible cargar tu perfil.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const cancelEditing = () => {
    setName(profile?.nombre || '');
    setEmail(profile?.email || '');
    setPhone(profile?.telefono || '');
    setEditing(false);
  };

  const saveProfile = async () => {
    if (!profile) return;
    if (!name.trim()) {
      Alert.alert('Nombre requerido', 'Ingresa tu nombre para guardar los cambios.');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Correo requerido', 'Ingresa tu correo electrónico para guardar los cambios.');
      return;
    }
    if (phone.trim().length > 10) {
      Alert.alert('Teléfono inválido', 'El teléfono debe tener máximo 10 caracteres.');
      return;
    }

    try {
      setSaving(true);
      const updated = await apiRequest<UserProfile>(`/users/${profile.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          nombre: name.trim(),
          email: email.trim(),
          telefono: phone.trim(),
        }),
      });
      setProfile((current) => current ? { ...current, ...updated } : updated);
      setName(updated.nombre || '');
      setEmail(updated.email);
      setPhone(updated.telefono || '');
      setEditing(false);
      Alert.alert('Perfil actualizado', 'Tus datos se guardaron correctamente.');
    } catch (requestError) {
      Alert.alert('No se pudo guardar', requestError instanceof Error ? requestError.message : 'Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  const startEditing = () => {
    setName(profile?.nombre || '');
    setEmail(profile?.email || '');
    setPhone(profile?.telefono || '');
    setEditing(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <HeaderNavbar />
      {loading ? (
        <ActivityIndicator color="#F0B35A" style={styles.loader} />
      ) : error ? (
        <View style={styles.empty}>
          <Text style={styles.error}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={loadProfile}>
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : profile ? (
        <KeyboardAvoidingView
          style={styles.content}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.heading}>
              <Text style={styles.kicker}>MI CUENTA</Text>
              <Text style={styles.title}>Perfil</Text>
              <Text style={styles.subtitle}>Consulta y actualiza tus datos personales.</Text>
            </View>

            <View style={styles.profileCard}>
              <View style={styles.identity}>
                <View style={styles.avatar}><User size={30} color="#251D17" /></View>
                <View style={styles.identityText}>
                  <Text style={styles.displayName}>{profile.nombre || profile.username}</Text>
                  <Text style={styles.username}>@{profile.username}</Text>
                </View>
                <View style={[styles.statusBadge, profile.is_active ? styles.statusActive : styles.statusInactive]}>
                  <Text style={styles.statusText}>{profile.is_active ? 'ACTIVA' : 'INACTIVA'}</Text>
                </View>
              </View>

              <View style={styles.separator} />

              <View style={styles.field}>
                <View style={styles.fieldHeading}><User size={17} color="#F0B35A" /><Text style={styles.label}>Nombre completo</Text></View>
                {editing ? (
                  <TextInput value={name} onChangeText={setName} placeholder="Tu nombre" placeholderTextColor="#998C80" style={styles.input} maxLength={100} autoCapitalize="words" />
                ) : <Text style={styles.value}>{profile.nombre || 'Sin configurar'}</Text>}
              </View>

              <View style={styles.field}>
                <View style={styles.fieldHeading}><Mail size={17} color="#F0B35A" /><Text style={styles.label}>Correo electrónico</Text></View>
                {editing ? (
                  <TextInput value={email} onChangeText={setEmail} placeholder="correo@ejemplo.com" placeholderTextColor="#998C80" style={styles.input} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={254} />
                ) : <Text style={styles.value}>{profile.email}</Text>}
              </View>

              <View style={styles.field}>
                <View style={styles.fieldHeading}><Phone size={17} color="#F0B35A" /><Text style={styles.label}>Teléfono</Text></View>
                {editing ? (
                  <TextInput value={phone} onChangeText={setPhone} placeholder="Tu teléfono" placeholderTextColor="#998C80" style={styles.input} keyboardType="phone-pad" maxLength={10} />
                ) : <Text style={styles.value}>{profile.telefono || 'Sin configurar'}</Text>}
              </View>

              <View style={styles.separator} />

              <View style={styles.detailsRow}>
                <View style={styles.fieldHeading}><AtSign size={17} color="#F0B35A" /><Text style={styles.label}>Usuario</Text></View>
                <Text style={styles.value}>{profile.username}</Text>
              </View>
              <View style={styles.detailsRow}>
                <View style={styles.fieldHeading}><ShieldCheck size={17} color="#F0B35A" /><Text style={styles.label}>Rol</Text></View>
                <Text style={styles.value}>{profile.role_name}</Text>
              </View>
              <View style={styles.detailsRow}>
                <View style={styles.fieldHeading}><CalendarDays size={17} color="#F0B35A" /><Text style={styles.label}>Miembro desde</Text></View>
                <Text style={styles.value}>{formatDate(profile.created_at)}</Text>
              </View>
              <View style={styles.detailsRow}>
                <View style={styles.fieldHeading}><CalendarDays size={17} color="#F0B35A" /><Text style={styles.label}>Último acceso</Text></View>
                <Text style={styles.value}>{formatDate(profile.last_login)}</Text>
              </View>
            </View>

            {editing ? (
              <View style={styles.actions}>
                <Pressable style={styles.cancelButton} onPress={cancelEditing} disabled={saving}>
                  <X size={18} color="#F5EBDD" />
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>
                <Pressable style={styles.saveButton} onPress={saveProfile} disabled={saving}>
                  {saving ? <ActivityIndicator color="#251D17" /> : <><Check size={18} color="#251D17" /><Text style={styles.saveText}>Guardar cambios</Text></>}
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.editButton} onPress={startEditing}>
                <Edit3 size={18} color="#251D17" />
                <Text style={styles.editText}>Editar perfil</Text>
              </Pressable>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1D1A17' },
  loader: { flex: 1 },
  content: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 36 },
  heading: { marginBottom: 20 },
  kicker: { color: '#F0B35A', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#F5EBDD', fontSize: 28, fontWeight: '800', marginTop: 5 },
  subtitle: { color: '#B8A99A', fontSize: 14, marginTop: 5 },
  profileCard: { backgroundColor: '#32281F', borderColor: '#45382E', borderWidth: 1, borderRadius: 18, padding: 18 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F0B35A', alignItems: 'center', justifyContent: 'center' },
  identityText: { flex: 1 },
  displayName: { color: '#F5EBDD', fontSize: 18, fontWeight: '800' },
  username: { color: '#B8A99A', fontSize: 13, marginTop: 3 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  statusActive: { backgroundColor: '#244735' },
  statusInactive: { backgroundColor: '#59322D' },
  statusText: { color: '#F5EBDD', fontSize: 10, fontWeight: '800' },
  separator: { height: 1, backgroundColor: '#514238', marginVertical: 18 },
  field: { marginBottom: 17 },
  fieldHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: '#B8A99A', fontSize: 13, fontWeight: '700' },
  value: { color: '#F5EBDD', fontSize: 15, fontWeight: '600', marginTop: 7 },
  input: { backgroundColor: '#251F1B', borderWidth: 1, borderColor: '#5A4838', borderRadius: 10, color: '#F5EBDD', fontSize: 15, paddingHorizontal: 12, paddingVertical: 11, marginTop: 8 },
  detailsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 18 },
  cancelButton: { flex: 1, minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: '#5A4838', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  cancelText: { color: '#F5EBDD', fontWeight: '700' },
  saveButton: { flex: 1, minHeight: 50, borderRadius: 12, backgroundColor: '#F0B35A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveText: { color: '#251D17', fontWeight: '800' },
  editButton: { minHeight: 50, marginTop: 18, borderRadius: 12, backgroundColor: '#F0B35A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  editText: { color: '#251D17', fontWeight: '800' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { color: '#F0A696', fontSize: 15, textAlign: 'center' },
  retryButton: { marginTop: 18, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, backgroundColor: '#F0B35A' },
  retryText: { color: '#251D17', fontWeight: '800' },
});
