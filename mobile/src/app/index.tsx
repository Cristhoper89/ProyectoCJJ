import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { User, Lock, Eye, EyeOff } from 'lucide-react-native';
import { useRouter } from 'expo-router';

const API_URL = "http://192.168.101.10:8000"; // Usa la IP real de tu PC en la red local

export default function LoginScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setMessage({ text: '', type: '' });

    const user = username.trim();
    const pass = password.trim();

    if (!user) {
      setMessage({ text: 'Ingrese su usuario.', type: 'error' });
      return;
    }

    if (!pass) {
      setMessage({ text: 'Ingrese su contraseña.', type: 'error' });
      return;
    }

    setMessage({ text: 'Validando credenciales...', type: 'warning' });
    setLoading(true);

    const formData = new URLSearchParams();
    formData.append("username", user);
    formData.append("password", pass);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: formData.toString()
      });

      const data = await response.json();
      setLoading(false);

      if (response.ok) {
        // En React Native guardamos en AsyncStorage o memoria local, ejemplo con global/state o router param
        setMessage({ text: 'Bienvenido al sistema.', type: 'success' });
        setTimeout(() => {
          router.replace('/dashboard' as any); // Ajusta la ruta a tu panel principal
        }, 1000);
        return;
      }

      if (response.status === 403) {
        setMessage({ text: data.detail, type: 'warning' });
        return;
      }

      setMessage({ text: data.detail || 'Error en las credenciales', type: 'error' });

    } catch (error) {
      setLoading(false);
      console.error(error);
      setMessage({ text: 'No fue posible conectar con el servidor.', type: 'error' });
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.loginCard}>

          {/* Header */}
          <View style={styles.header}>
            <Image
              source={require('../../assets/images/icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Bienvenido</Text>
            <Text style={styles.subtitle}>Ingrese sus credenciales para acceder al sistema.</Text>
          </View>

          {/* Form */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Usuario</Text>
            <View style={styles.inputBox}>
              <User color="#B8B1A8" size={20} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Ingrese su usuario"
                placeholderTextColor="#9C9287"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.inputBox}>
              <Lock color="#B8B1A8" size={20} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Ingrese su contraseña"
                placeholderTextColor="#9C9287"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                {showPassword ? (
                  <EyeOff color="#B8B1A8" size={20} />
                ) : (
                  <Eye color="#B8B1A8" size={20} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Botón */}
          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.loginButtonText}>Iniciar sesión</Text>
            )}
          </TouchableOpacity>

          {/* Mensajes de Alerta */}
          {message.text ? (
            <View style={[
              styles.messageBox,
              message.type === 'success' && styles.successMsg,
              message.type === 'error' && styles.errorMsg,
              message.type === 'warning' && styles.warningMsg,
            ]}>
              <Text style={styles.messageText}>{message.text}</Text>
            </View>
          ) : null}

          {/* Opciones adicionales */}
          <View style={styles.optionsContainer}>
            <TouchableOpacity onPress={() => router.push('/olvido-contrasena')}>
  <Text style={styles.linkText}>¿Olvidaste tu contraseña?</Text>
</TouchableOpacity>
            <View style={styles.separator} />
            <TouchableOpacity onPress={() => router.push('/desbloquear-cuenta')}>
              <Text style={styles.linkText}>¿Cuenta bloqueada?</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1D1A17',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  loginCard: {
    backgroundColor: '#32281F',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#45382E',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F5F5F5',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#B8B1A8',
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F5F5F5',
    marginBottom: 8,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2D2620',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4A3D31',
    paddingHorizontal: 12,
    height: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#F5F5F5',
    fontSize: 14,
  },
  eyeButton: {
    padding: 4,
  },
  loginButton: {
    backgroundColor: '#D8A85B',
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    shadowColor: '#D8A85B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  messageBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  successMsg: {
    backgroundColor: 'rgba(46, 204, 113, 0.2)',
    borderColor: '#2ECC71',
    borderWidth: 1,
  },
  errorMsg: {
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    borderColor: '#E74C3C',
    borderWidth: 1,
  },
  warningMsg: {
    backgroundColor: 'rgba(216, 168, 91, 0.2)',
    borderColor: '#D8A85B',
    borderWidth: 1,
  },
  messageText: {
    color: '#F5F5F5',
    fontSize: 14,
    textAlign: 'center',
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  optionLink: {
    color: '#B8B1A8',
    fontSize: 13,
  },
  separator: {
    width: 1,
    height: 14,
    backgroundColor: '#45382E',
    marginHorizontal: 16,
  },
  linkText: {
    color: '#D8A85B',
    fontSize: 13,
  },
  
});