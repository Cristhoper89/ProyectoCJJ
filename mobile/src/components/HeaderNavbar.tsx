// components/HeaderNavbar.tsx
import React, { Fragment, useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, SafeAreaView } from 'react-native';
import { 
  Menu, X, User, WalletCards, Tags, LayoutGrid, ArrowLeftRight, QrCode,
  Package, Users, ContactRound, ChartNoAxesCombined, ClipboardList, BookOpen, Settings, Carrot, ChevronDown
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { apiRequest, clearAccessToken } from '../constants/api';

type RoleName = 'Administrador' | 'Cajero' | 'Mesero' | 'Cocina' | 'Cliente';

type MenuItem = {
  label: string;
  icon: typeof User;
  roles: RoleName[];
  route?: string;
  children?: MenuItem[];
};

const allRoles: RoleName[] = ['Administrador', 'Cajero', 'Mesero', 'Cocina', 'Cliente'];

const menuItems: MenuItem[] = [
  { label: 'Perfil', icon: User, roles: allRoles, route: '/perfil' },
  { label: 'Caja', icon: WalletCards, roles: ['Administrador', 'Cajero'], children: [
    { label: 'Historial de cajas', icon: WalletCards, roles: ['Administrador', 'Cajero'], route: '/cajas' },
    { label: 'Caja actual', icon: WalletCards, roles: ['Administrador', 'Cajero'], route: '/caja-actual' },
    { label: 'Cerrar y abrir caja', icon: WalletCards, roles: ['Administrador', 'Cajero'], route: '/cierre-caja' },
  ] },
  { label: 'Categorías', icon: Tags, roles: ['Administrador', 'Cajero'], route: '/categorias' },
  { label: 'Mesas', icon: LayoutGrid, roles: ['Administrador', 'Cajero', 'Mesero'], route: '/mesa' },
  { label: 'Configuración mesa', icon: QrCode, roles: ['Administrador', 'Cajero'], route: '/configuracion-mesas' },
  { label: 'Movimientos', icon: ArrowLeftRight, roles: ['Administrador', 'Cajero'], route: '/movimientos' },
  { label: 'Productos', icon: Package, roles: ['Administrador', 'Cajero', 'Mesero', 'Cocina'], children: [
    { label: 'Productos', icon: Package, roles: ['Administrador', 'Cajero', 'Mesero', 'Cocina'], route: '/productos' },
    { label: 'Ingredientes', icon: Carrot, roles: ['Administrador', 'Cajero'], route: '/ingredientes' },
    { label: 'Opciones de productos', icon: Tags, roles: ['Administrador', 'Cajero'], route: '/opciones-productos' },
  ] },
  { label: 'Empleados', icon: Users, roles: ['Administrador'], route: '/empleados' },
  { label: 'Clientes', icon: ContactRound, roles: ['Administrador'], route: '/clientes' },
  { label: 'Estadística', icon: ChartNoAxesCombined, roles: ['Administrador'], route: '/estadistica' },
  { label: 'Pedidos', icon: ClipboardList, roles: ['Administrador', 'Cocina'], route: '/pedidos' },
  { label: 'Carta', icon: BookOpen, roles: ['Administrador', 'Cajero', 'Mesero', 'Cliente'], route: '/carta' },
  { label: 'Configuración', icon: Settings, roles: ['Administrador'], route: '/configuracion' },
];

function isRoleName(role: string): role is RoleName {
  return role === 'Administrador'
    || role === 'Cajero'
    || role === 'Mesero'
    || role === 'Cocina'
    || role === 'Cliente';
}

export default function HeaderNavbar() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [cashExpanded, setCashExpanded] = useState(false);
  const [productsExpanded, setProductsExpanded] = useState(false);
  const [currentDate, setCurrentDate] = useState('');
  const [userRole, setUserRole] = useState<RoleName | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [roleError, setRoleError] = useState<string | null>(null);

  const loadRole = useCallback(async () => {
    setRoleLoading(true);
    setRoleError(null);

    try {
      const user = await apiRequest<{ role_name: string }>('/auth/me');
      if (!isRoleName(user.role_name)) {
        throw new Error(`El rol "${user.role_name}" no está configurado para la navegación móvil.`);
      }
      setUserRole(user.role_name);
    } catch (error) {
      console.error('No fue posible verificar el rol para el menú móvil:', error);
      setRoleError(error instanceof Error ? error.message : 'Error inesperado al verificar el rol.');
    } finally {
      setRoleLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRole();
  }, [loadRole]);

  useEffect(() => {
    // Formato de fecha similar al diseño de la imagen ("08 may. 2025" o actual)
    const updateDateTime = () => {
      const now = new Date();
      const optionsDate: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
      const optionsTime: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
      
      const formattedDate = now.toLocaleDateString('es-ES', optionsDate).replace('.', '');
      const formattedTime = now.toLocaleTimeString('es-ES', optionsTime);
      setCurrentDate(`${formattedDate}\n${formattedTime}`);
    };

    updateDateTime();
  }, []);

  const visibleMenuItems = userRole
    ? menuItems.flatMap((item) => {
      if (!item.roles.includes(userRole)) return [];
      const children = item.children?.filter((child) => child.roles.includes(userRole));
      if (item.children && !children?.length) return [];
      return [{ ...item, children }];
    })
    : [];

  const navigate = (item: MenuItem) => {
    setIsOpen(false);
    if (item.route) router.push(item.route as any);
  };

  const renderItem = ({ item }: { item: MenuItem }) => {
    const IconComponent = item.icon;
    return (
      <Fragment>
        <TouchableOpacity style={styles.menuItem} onPress={() => item.children ? (
          item.label === 'Caja'
            ? setCashExpanded((current) => !current)
            : setProductsExpanded((current) => !current)
        ) : navigate(item)}>
          <IconComponent size={22} color="#D8A85B" style={styles.icon} />
          <Text style={styles.menuText}>{item.label}</Text>
          {item.children && <ChevronDown size={19} color="#D8A85B" style={(item.label === 'Caja' ? cashExpanded : productsExpanded) && styles.chevronExpanded} />}
        </TouchableOpacity>
        {item.children && (item.label === 'Caja' ? cashExpanded : productsExpanded) && item.children.map((child) => {
          const ChildIcon = child.icon;
          return <TouchableOpacity key={child.label} style={styles.subMenuItem} onPress={() => navigate(child)}>
            <ChildIcon size={19} color="#C9B9A9" style={styles.icon} />
            <Text style={styles.subMenuText}>{child.label}</Text>
          </TouchableOpacity>;
        })}
      </Fragment>
    );
  };

  const handleLogout = async () => {
    await clearAccessToken();
    setIsOpen(false);
    router.replace('/');
  };

  return (
    <View style={styles.navbarContainer}>
      {/* Botón para abrir el menú */}
      <TouchableOpacity style={styles.menuButton} onPress={() => setIsOpen(true)}>
        <Menu size={26} color="#D8A85B" />
      </TouchableOpacity>

      {/* Logo y Título */}
      <View style={styles.logoContainer}>
        <Text style={styles.brandTitle}>LA CABAÑA</Text>
      </View>

      {/* Fecha y Hora */}
      <View style={styles.dateContainer}>
        <Text style={styles.dateText}>{currentDate}</Text>
      </View>

      {/* Menú Desplegable Fullscreen */}
      <Modal visible={isOpen} animationType="fade" transparent={true}>
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalHeaderTitle}>Menú de Navegación</Text>
              {userRole && <Text style={styles.roleLabel}>{userRole}</Text>}
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={() => setIsOpen(false)}>
              <X size={28} color="#F5F5F5" />
            </TouchableOpacity>
          </View>

          {roleLoading ? (
            <Text style={styles.statusText}>Cargando permisos del menú...</Text>
          ) : roleError ? (
            <View style={styles.roleErrorContainer}>
              <Text style={styles.roleErrorText}>No fue posible cargar el menú: {roleError}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => void loadRole()}>
                <Text style={styles.retryText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={visibleMenuItems}
              keyExtractor={(item) => item.label}
              renderItem={renderItem}
              contentContainerStyle={styles.listContainer}
            />
          )}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Cerrar sesión</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  navbarContainer: {
    height: 70,
    backgroundColor: '#32281F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#45382E',
  },
  menuButton: {
    padding: 8,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    color: '#F5F5F5',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  dateContainer: {
    alignItems: 'flex-end',
  },
  dateText: {
    color: '#B8B1A8',
    fontSize: 11,
    textAlign: 'right',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#1D1A17',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#45382E',
    backgroundColor: '#32281F',
  },
  modalHeaderTitle: {
    color: '#F5F5F5',
    fontSize: 18,
    fontWeight: '700',
  },
  roleLabel: {
    color: '#D8A85B',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
  },
  closeButton: {
    height: 48,
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  statusText: {
    color: '#D8D0C8',
    fontSize: 15,
    padding: 24,
    textAlign: 'center',
  },
  roleErrorContainer: {
    alignItems: 'center',
    padding: 24,
  },
  roleErrorText: {
    color: '#E7A28C',
    fontSize: 15,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D8A85B',
  },
  retryText: {
    color: '#D8A85B',
    fontSize: 15,
    fontWeight: '600',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#32281F',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#45382E',
    minHeight: 48,
  },
  icon: {
    marginRight: 16,
  },
  menuText: {
    color: '#F5F5F5',
    fontSize: 16,
    fontWeight: '600',
  },
  chevronExpanded: {
    transform: [{ rotate: '180deg' }],
  },
  subMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#251F1B',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
    marginBottom: 8,
    marginLeft: 18,
    borderWidth: 1,
    borderColor: '#45382E',
  },
  subMenuText: {
    color: '#D8D0C8',
    fontSize: 15,
    fontWeight: '600',
  },
  logoutButton: {
    margin: 20,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B86B57',
    alignItems: 'center',
  },
  logoutText: {
    color: '#E7A28C',
    fontSize: 16,
    fontWeight: '700',
  },
});