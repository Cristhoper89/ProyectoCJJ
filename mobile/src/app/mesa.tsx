// app/mesa.tsx
import React from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HeaderNavbar from '../components/HeaderNavbar';

// Generamos datos de ejemplo para las mesas de la 1 a la 10 y la barra
const mesasData = [
  { id: '1', title: 'MESA 1' },
  { id: '2', title: 'MESA 2' },
  { id: '3', title: 'MESA 3' },
  { id: '4', title: 'MESA 4' },
  { id: '5', title: 'MESA 5' },
  { id: '6', title: 'MESA 6' },
  { id: '7', title: 'MESA 7' },
  { id: '8', title: 'MESA 8' },
  { id: '9', title: 'MESA 9' },
  { id: '10', title: 'MESA 10' },
  { id: 'bar', title: 'BARRA', isBar: true },
];

export default function MesaScreen() {
  const renderMesaItem = ({ item }: { item: typeof mesasData[0] }) => {
    return (
      <TouchableOpacity 
        style={[styles.mesaCard, item.isBar && styles.barraCard]} 
        activeOpacity={0.8}
        onPress={() => console.log(`Seleccionado: ${item.title}`)}
      >
        {/* Encabezado de la tarjeta con el nombre de la mesa */}
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.title}</Text>
        </View>

        {/* Contenedor de la imagen representativa de la comida */}
        <View style={styles.imageContainer}>
          <ImageBackground 
            source={{ uri: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80' }} 
            style={styles.foodImage}
            imageStyle={{ borderRadius: 12 }}
          >
            {/* Filtro o capa sutil opcional si se requiere */}
          </ImageBackground>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Cabecera reutilizable (Logo, Hamburguesa, Fecha) */}
      <HeaderNavbar />

      {/* Lista de mesas estilo Grid Vertical Fluido */}
      <FlatList
        data={mesasData}
        keyExtractor={(item) => item.id}
        renderItem={renderMesaItem}
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1D1A17',
  },
  gridContainer: {
    padding: 16,
    paddingBottom: 30,
  },
  mesaCard: {
    backgroundColor: '#32281F',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#45382E',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  barraCard: {
    // Estilo especial para la barra inferior si requiere dimensiones o ajustes particulares
    marginBottom: 8,
  },
  cardHeader: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: '#F5F5F5',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  imageContainer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  foodImage: {
    height: 110,
    width: '100%',
    justifyContent: 'flex-end',
  },
});