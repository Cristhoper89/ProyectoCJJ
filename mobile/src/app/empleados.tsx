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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ban, Check, ChefHat, Edit3, Mail, Phone, Plus, RotateCcw, Search, UserRound, Users, X } from 'lucide-react-native';
import HeaderNavbar from '../components/HeaderNavbar';
import { apiRequest, getAccessToken } from '../constants/api';

type Role = { id: number; name: string; description?: string | null };
type Employee = {
  id: string;
  username: string;
  email: string;
  nombre: string | null;
  telefono: string | null;
  is_active: boolean;
  role_id: number;
  created_at: string;
  last_login: string | null;
};

type EmployeeForm = {
  username: string;
  email: string;
  nombre: string;
  telefono: string;
  password: string;
  role_id: number | null;
  is_active: boolean;
};

const STAFF_ROLE_NAMES = ['Cocina', 'Cajero', 'Mesero'];
const EMPTY_FORM: EmployeeForm = {
  username: '',
  email: '',
  nombre: '',
  telefono: '',
  password: '',
  role_id: null,
  is_active: true,
};

export default function EmpleadosScreen() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const staffRoles = useMemo(
    () => roles.filter((role) => STAFF_ROLE_NAMES.includes(role.name)),
    [roles],
  );
  const roleNameById = useMemo(
    () => new Map(roles.map((role) => [role.id, role.name])),
    [roles],
  );

  const load = async () => {
    if (!getAccessToken()) {
      setError('Inicia sesión para consultar los empleados.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [usersData, rolesData] = await Promise.all([
        apiRequest<Employee[]>('/users/'),
        apiRequest<Role[]>('/roles/'),
      ]);
      const roleIds = new Set(
        rolesData.filter((role) => STAFF_ROLE_NAMES.includes(role.name)).map((role) => role.id),
      );
      setEmployees(usersData.filter((employee) => roleIds.has(employee.role_id)));
      setRoles(rolesData);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No fue posible cargar los empleados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visibleEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    return employees.filter((employee) => {
      const matchesSearch = !query || [
        employee.nombre,
        employee.username,
        employee.email,
        employee.telefono,
        roleNameById.get(employee.role_id),
      ].some((value) => value?.toLowerCase().includes(query));
      return matchesSearch && (showInactive || employee.is_active);
    });
  }, [employees, roleNameById, search, showInactive]);

  const openCreate = () => {
    setSelected(null);
    setForm({ ...EMPTY_FORM, role_id: staffRoles[0]?.id ?? null });
    setModalVisible(true);
  };

  const openEdit = (employee: Employee) => {
    setSelected(employee);
    setForm({
      username: employee.username,
      email: employee.email,
      nombre: employee.nombre || '',
      telefono: employee.telefono || '',
      password: '',
      role_id: employee.role_id,
      is_active: employee.is_active,
    });
    setModalVisible(true);
  };

  const save = async () => {
    const nombre = form.nombre.trim();
    const username = form.username.trim();
    const email = form.email.trim();
    const roleId = form.role_id;

    if (nombre.length < 1) {
      Alert.alert('Nombre requerido', 'Ingresa el nombre del empleado.');
      return;
    }
    if (!selected && username.length < 4) {
      Alert.alert('Usuario inválido', 'El usuario debe tener al menos 4 caracteres.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Correo inválido', 'Ingresa un correo electrónico válido.');
      return;
    }
    if (!selected && form.password.length < 6) {
      Alert.alert('Contraseña inválida', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (form.password && form.password.length < 6) {
      Alert.alert('Contraseña inválida', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (form.telefono.trim().length > 10) {
      Alert.alert('Teléfono inválido', 'El teléfono debe tener máximo 10 caracteres.');
      return;
    }
    if (roleId === null || !staffRoles.some((role) => role.id === roleId)) {
      Alert.alert('Rol requerido', 'Selecciona Cocina, Cajero o Mesero.');
      return;
    }

    const details = {
      nombre,
      email,
      telefono: form.telefono.trim() || null,
      role_id: roleId,
    };

    try {
      setSaving(true);
      if (selected) {
        const payload = {
          ...details,
          is_active: form.is_active,
          ...(form.password ? { password: form.password } : {}),
        };
        const updated = await apiRequest<Employee>(`/users/${selected.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setEmployees((current) => current.map((employee) => employee.id === updated.id ? updated : employee));
      } else {
        const created = await apiRequest<Employee>('/users/', {
          method: 'POST',
          body: JSON.stringify({
            ...details,
            username,
            password: form.password,
          }),
        });
        setEmployees((current) => [created, ...current]);
      }
      setModalVisible(false);
      setSelected(null);
      Alert.alert('Empleado guardado', 'Los datos se guardaron correctamente.');
    } catch (requestError) {
      Alert.alert('No se pudo guardar', requestError instanceof Error ? requestError.message : 'Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  const toggleEmployeeState = (employee: Employee) => {
    const nextState = !employee.is_active;
    Alert.alert(
      nextState ? 'Reactivar empleado' : 'Desactivar empleado',
      `¿Quieres ${nextState ? 'reactivar' : 'desactivar'} a ${employee.nombre || employee.username}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: nextState ? 'Reactivar' : 'Desactivar',
          style: nextState ? 'default' : 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              const updated = await apiRequest<Employee>(`/users/${employee.id}`, {
                method: 'PUT',
                body: JSON.stringify({ is_active: nextState }),
              });
              setEmployees((current) => current.map((item) => item.id === updated.id ? updated : item));
            } catch (requestError) {
              Alert.alert('No se pudo actualizar', requestError instanceof Error ? requestError.message : 'Intenta nuevamente.');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const renderEmployee = ({ item }: { item: Employee }) => {
    const active = item.is_active;
    return (
      <View style={[styles.employeeCard, !active && styles.inactiveCard]}>
        <View style={styles.avatar}><UserRound size={21} color="#F0B35A" /></View>
        <View style={styles.employeeInfo}>
          <Text style={styles.employeeName}>{item.nombre || item.username}</Text>
          <Text style={styles.employeeUsername}>@{item.username} · {roleNameById.get(item.role_id) || 'Empleado'}</Text>
          <View style={styles.detailLine}><Mail size={13} color="#A99A8B" /><Text style={styles.detailText}>{item.email}</Text></View>
          {item.telefono ? <View style={styles.detailLine}><Phone size={13} color="#A99A8B" /><Text style={styles.detailText}>{item.telefono}</Text></View> : null}
          <View style={[styles.badge, active ? styles.activeBadge : styles.inactiveBadge]}>
            <Text style={styles.badgeText}>{active ? 'ACTIVO' : 'INACTIVO'}</Text>
          </View>
        </View>
        <View style={styles.employeeActions}>
          <Pressable style={styles.iconButton} onPress={() => openEdit(item)} accessibilityLabel={`Editar ${item.nombre || item.username}`}>
            <Edit3 size={18} color="#F0B35A" />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => toggleEmployeeState(item)} accessibilityLabel={active ? 'Desactivar empleado' : 'Reactivar empleado'}>
            {active ? <Ban size={18} color="#D98672" /> : <RotateCcw size={18} color="#35C979" />}
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <HeaderNavbar />
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>EQUIPO</Text>
          <Text style={styles.title}>Empleados</Text>
          <Text style={styles.subtitle}>Gestiona el personal de cocina, caja y servicio.</Text>
        </View>
        <Pressable style={styles.addButton} onPress={openCreate} disabled={staffRoles.length === 0}>
          <Plus size={19} color="#251D17" />
          <Text style={styles.addText}>Nuevo</Text>
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <Search size={18} color="#A99A8B" />
        <TextInput value={search} onChangeText={setSearch} placeholder="Buscar empleado" placeholderTextColor="#998C80" style={styles.searchInput} />
      </View>
      <View style={styles.filters}>
        <Pressable style={[styles.filter, !showInactive && styles.selectedFilter]} onPress={() => setShowInactive(false)}>
          <Text style={[styles.filterText, !showInactive && styles.selectedFilterText]}>Activos</Text>
        </Pressable>
        <Pressable style={[styles.filter, showInactive && styles.selectedFilter]} onPress={() => setShowInactive(true)}>
          <Text style={[styles.filterText, showInactive && styles.selectedFilterText]}>Todos</Text>
        </Pressable>
        <Text style={styles.counter}>{visibleEmployees.length} resultados</Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#F0B35A" style={styles.loader} />
      ) : error ? (
        <View style={styles.empty}>
          <Text style={styles.error}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={load}><Text style={styles.retryText}>Reintentar</Text></Pressable>
        </View>
      ) : (
        <FlatList
          data={visibleEmployees}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderEmployee}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Users size={31} color="#F0B35A" />
              <Text style={styles.emptyTitle}>No hay empleados</Text>
              <Text style={styles.emptyText}>Registra al personal de cocina, caja o servicio.</Text>
            </View>
          }
        />
      )}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.kicker}>{selected ? 'EDITAR EMPLEADO' : 'NUEVO EMPLEADO'}</Text>
                <Text style={styles.modalTitle}>{selected ? 'Editar datos' : 'Registrar empleado'}</Text>
              </View>
              <Pressable onPress={() => setModalVisible(false)} accessibilityLabel="Cerrar">
                <X size={23} color="#F5EBDD" />
              </Pressable>
            </View>
            <View style={styles.formScroll}>
              <Text style={styles.label}>Nombre completo</Text>
              <TextInput value={form.nombre} onChangeText={(value) => setForm((current) => ({ ...current, nombre: value }))} placeholder="Nombre del empleado" placeholderTextColor="#998C80" style={styles.input} maxLength={100} autoCapitalize="words" />

              <Text style={styles.label}>Usuario</Text>
              <TextInput value={form.username} onChangeText={(value) => setForm((current) => ({ ...current, username: value }))} editable={!selected} placeholder="Mínimo 4 caracteres" placeholderTextColor="#998C80" style={[styles.input, !!selected && styles.readOnlyInput]} maxLength={50} autoCapitalize="none" autoCorrect={false} />

              <Text style={styles.label}>Correo electrónico</Text>
              <TextInput value={form.email} onChangeText={(value) => setForm((current) => ({ ...current, email: value }))} placeholder="empleado@ejemplo.com" placeholderTextColor="#998C80" style={styles.input} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

              <Text style={styles.label}>Teléfono</Text>
              <TextInput value={form.telefono} onChangeText={(value) => setForm((current) => ({ ...current, telefono: value }))} placeholder="Máximo 10 caracteres" placeholderTextColor="#998C80" style={styles.input} keyboardType="phone-pad" maxLength={10} />

              <Text style={styles.label}>{selected ? 'Nueva contraseña (opcional)' : 'Contraseña'}</Text>
              <TextInput value={form.password} onChangeText={(value) => setForm((current) => ({ ...current, password: value }))} placeholder="Mínimo 6 caracteres" placeholderTextColor="#998C80" style={styles.input} secureTextEntry autoCapitalize="none" autoCorrect={false} />

              <Text style={styles.label}>Rol</Text>
              <View style={styles.roleChoices}>
                {staffRoles.map((role) => {
                  const Icon = role.name === 'Cocina' ? ChefHat : Users;
                  const isSelected = form.role_id === role.id;
                  return (
                    <Pressable key={role.id} style={[styles.roleChoice, isSelected && styles.roleChoiceSelected]} onPress={() => setForm((current) => ({ ...current, role_id: role.id }))}>
                      <Icon size={16} color={isSelected ? '#251D17' : '#F0B35A'} />
                      <Text style={[styles.roleChoiceText, isSelected && styles.roleChoiceTextSelected]}>{role.name}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {selected && (
                <>
                  <Text style={styles.label}>Estado</Text>
                  <View style={styles.roleChoices}>
                    {[{ value: true, label: 'Activo' }, { value: false, label: 'Inactivo' }].map((option) => {
                      const isSelected = form.is_active === option.value;
                      return (
                        <Pressable key={option.label} style={[styles.roleChoice, isSelected && styles.roleChoiceSelected]} onPress={() => setForm((current) => ({ ...current, is_active: option.value }))}>
                          <Text style={[styles.roleChoiceText, isSelected && styles.roleChoiceTextSelected]}>{option.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelButton} onPress={() => setModalVisible(false)} disabled={saving}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color="#251D17" /> : <><Check size={18} color="#251D17" /><Text style={styles.saveText}>{selected ? 'Guardar cambios' : 'Registrar'}</Text></>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1D1A17' },
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 15, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  headerCopy: { flex: 1 },
  kicker: { color: '#F0B35A', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: '#F5EBDD', fontSize: 27, fontWeight: '800', marginTop: 4 },
  subtitle: { color: '#B8A99A', fontSize: 12, marginTop: 5 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0B35A', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 7 },
  addText: { color: '#251D17', fontWeight: '800', fontSize: 13 },
  searchBox: { height: 46, marginHorizontal: 20, borderRadius: 8, borderWidth: 1, borderColor: '#4A3D31', backgroundColor: '#2D2620', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, gap: 9 },
  searchInput: { flex: 1, color: '#F5EBDD', fontSize: 14 },
  filters: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 13 },
  filter: { borderWidth: 1, borderColor: '#4A3D31', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7 },
  selectedFilter: { backgroundColor: '#F0B35A', borderColor: '#F0B35A' },
  filterText: { color: '#B8A99A', fontSize: 12, fontWeight: '700' },
  selectedFilterText: { color: '#251D17' },
  counter: { marginLeft: 'auto', color: '#87796C', fontSize: 12 },
  loader: { flex: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 28 },
  employeeCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#32281F', borderColor: '#45382E', borderWidth: 1, borderRadius: 12, padding: 13, marginBottom: 10 },
  inactiveCard: { opacity: 0.68 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#49382A', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  employeeInfo: { flex: 1, gap: 5 },
  employeeName: { color: '#F5EBDD', fontSize: 15, fontWeight: '800' },
  employeeUsername: { color: '#D8B47A', fontSize: 12, fontWeight: '600' },
  detailLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { color: '#B8A99A', fontSize: 12, flexShrink: 1 },
  badge: { alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3, marginTop: 2 },
  activeBadge: { backgroundColor: '#29483D' },
  inactiveBadge: { backgroundColor: '#49362F' },
  badgeText: { color: '#EBDCCE', fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  employeeActions: { marginLeft: 4 },
  iconButton: { width: 36, height: 37, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyTitle: { color: '#F5EBDD', fontSize: 17, fontWeight: '800', marginTop: 12 },
  emptyText: { color: '#B8A99A', marginTop: 7, textAlign: 'center' },
  error: { color: '#F0A696', textAlign: 'center' },
  retryButton: { marginTop: 16, borderRadius: 6, backgroundColor: '#F0B35A', paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: '#251D17', fontWeight: '800' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalCard: { maxHeight: '92%', backgroundColor: '#32281F', borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 26, borderWidth: 1, borderColor: '#604D3A' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 17 },
  modalTitle: { color: '#F5EBDD', fontSize: 21, fontWeight: '800', marginTop: 4 },
  formScroll: { flexShrink: 1 },
  label: { color: '#F5EBDD', fontSize: 13, fontWeight: '700', marginTop: 12, marginBottom: 7 },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#604D3A', borderRadius: 8, color: '#F5EBDD', backgroundColor: '#2D2620', paddingHorizontal: 12, fontSize: 14 },
  readOnlyInput: { color: '#998C80', backgroundColor: '#27221E' },
  roleChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  roleChoice: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#604D3A', borderRadius: 8, paddingHorizontal: 11, paddingVertical: 8 },
  roleChoiceSelected: { backgroundColor: '#F0B35A', borderColor: '#F0B35A' },
  roleChoiceText: { color: '#E2D6C9', fontSize: 12, fontWeight: '700' },
  roleChoiceTextSelected: { color: '#251D17' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  cancelButton: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: '#604D3A', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#F5EBDD', fontWeight: '700' },
  saveButton: { flex: 1, minHeight: 48, backgroundColor: '#F0B35A', borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  saveText: { color: '#251D17', fontSize: 13, fontWeight: '800' },
});
