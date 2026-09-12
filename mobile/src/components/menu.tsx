import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, SafeAreaView } from 'react-native';
import { Menu, X, User, DollarSign, Layers, Home, ArrowLeftRight, Package, Truck, Users, UserCheck, BarChart2, ShoppingBag, BookOpen, Settings } from 'lucide-react-native';

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

export default function FullscreenDrawer() {
  const [isOpen, setIsOpen] = useState(false);

  const renderItem = ({ item }) => {
    const IconComponent = item.icon;
    return (
      <TouchableOpacity style={styles.menuItem} onPress={() => setIsOpen(false)}>
        <IconComponent size={22} color="#D8A85B" style={styles.icon} />
        <Text style={styles.menuText}>{item.label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.openButton} onPress={() => setIsOpen(true)}>
        <Menu size={28} color="#D8A85B" />
      </TouchableOpacity>

      <Modal visible={isOpen} animationType="fade" transparent={true}>
        <SafeAreaView style={styles.modalOverlay}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Menú</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#1D1A17',
    justifyContent: 'center',
    alignItems: 'center',
  },
  openButton: {
    padding: 12,
    backgroundColor: '#32281F',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#45382E',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#1D1A17',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#45382E',
    backgroundColor: '#32281F',
  },
  headerTitle: {
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