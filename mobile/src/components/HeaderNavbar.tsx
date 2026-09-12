// components/HeaderNavbar.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, SafeAreaView, Image } from 'react-native';
import { 
  Menu, X, User, DollarSign, Layers, Home, ArrowLeftRight, 
  Package, Truck, Users, UserCheck, BarChart2, ShoppingBag, BookOpen, Settings 
} from 'lucide-react-native';

const menuItems = [
  { label: 'Perfil', icon: User },
  { label: 'Caja', icon: DollarSign },
  { label: 'Categorías', icon: Layers },
  { label: 'Mesa (página inicial)', icon: Home },
  { label: 'Movimientos', icon: ArrowLeftRight },
  { label: 'Productos', icon: Package },
  { label: 'Proveedores', icon: Truck },
  { label: 'Empleados', icon: Users },
  { label: 'Clientes', icon: UserCheck },
  { label: 'Estadística', icon: BarChart2 },
  { label: 'Pedidos', icon: ShoppingBag },
  { label: 'Carta', icon: BookOpen },
  { label: 'Configuración', icon: Settings },
];

export default function HeaderNavbar() {
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
      <TouchableOpacity style={styles.menuItem} onPress={() => setIsOpen(false)}>
        <IconComponent size={22} color="#D8A85B" style={styles.icon} />
        <Text style={styles.menuText}>{item.label}</Text>
      </TouchableOpacity>
    );
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
});