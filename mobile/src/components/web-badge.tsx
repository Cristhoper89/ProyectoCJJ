import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import { ThemedView } from './themed-view';

export function WebBadge() {
  return (
    <ThemedView style={styles.container}>
      <Image
        source={require('@/assets/images/restaurant-logo.png')}
        style={styles.logo}
        contentFit="contain"
        accessibilityLabel="Logo de La Cabaña"
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  logo: {
    width: 160,
    height: 68,
  },
});
