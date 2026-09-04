import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Pantallas de autenticación y principales fuera de las pestañas */}
        <Stack.Screen name="index" />
        <Stack.Screen name="olvido-contrasena" />
        <Stack.Screen name="desbloquear-cuenta" />
        <Stack.Screen name="dashboard" />
      </Stack>
    </ThemeProvider>
  );
}