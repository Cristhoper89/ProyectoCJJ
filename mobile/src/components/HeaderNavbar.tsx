// components/HeaderNavbar.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, SafeAreaView, Image } from 'react-native';
import { 
  Menu, X, User, WalletCards, Tags, LayoutGrid, ArrowLeftRight,
  Package, Truck, Users, ContactRound, ChartNoAxesCombined, ClipboardList, BookOpen, Settings, Carrot
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { clearAccessToken } from '../constants/api';

const menuItems = [
  { label: 'Perfil', icon: User },
  { label: 'Caja', icon: WalletCards },
  { label: 'Categorías', icon: Tags, route: '/categorias' },
  { label: 'Mesa (página inicial)', icon: LayoutGrid, route: '/mesa' },
  { label: 'Movimientos', icon: ArrowLeftRight },
  { label: 'Productos', icon: Package, route: '/productos' },
  { label: 'Ingredientes', icon: Carrot, route: '/ingredientes' },
  { label: 'Proveedores', icon: Truck },
  { label: 'Empleados', icon: Users },
  { label: 'Clientes', icon: ContactRound },
  { label: 'Estadística', icon: ChartNoAxesCombined },
  { label: 'Pedidos', icon: ClipboardList },
  { label: 'Carta', icon: BookOpen },
  { label: 'Configuración', icon: Settings },
];

export default function HeaderNavbar() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState('');

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

  const renderItem = ({ item }: { item: typeof menuItems[0] }) => {
    const IconComponent = item.icon;
    return (
      <TouchableOpacity style={styles.menuItem} onPress={() => { setIsOpen(false); if (item.route) router.push(item.route as any); }}>
        <IconComponent size={22} color="#D8A85B" style={styles.icon} />
        <Text style={styles.menuText}>{item.label}</Text>
      </TouchableOpacity>
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
        <Image 
          source={require('../../assets/images/icon.png')} 
          style={styles.logo} 
          resizeMode="contain" 
        />
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
            <Text style={styles.modalHeaderTitle}>Menú de Navegación</Text>
            <TouchableOpacity style={styles.closeButton} onPress={() => setIsOpen(false)}>
              <X size={28} color="#F5F5F5" />
            </TouchableOpacity>
          </View>

          <FlatList
            data={menuItems}
            keyExtractor={(item) => item.label}
            renderItem={renderItem}
            contentContainerStyle={styles.listContainer}
          />
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
  logo: {
    width: 32,
    height: 32,
    marginRight: 8,
  },
  brandTitle: {
    color: '#F5F5F5',
    fontSize: 16,
    fontWeight: '750',
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