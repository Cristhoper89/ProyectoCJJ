import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Mail, Key, Lock, Eye, EyeOff } from 'lucide-react-native';
import { useRouter } from 'expo-router';

const API_URL = "http://192.168.101.10:8000"; // Reemplaza con tu IP local de FastAPI

export default function OlvidoContrasenaScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [nuevaContrasena, setNuevaContrasena] = useState('');
  const [confirmarContrasena, setConfirmarContrasena] = useState('');
  
  const [enPaso2, setEnPaso2] = useState(false);
  const [correoGuardado, setCorreoGuardado] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const showMessage = (text: string, type: 'success' | 'error' | 'warning') => {
    setMessage({ text, type });
  };

  const handleEnviarCodigo = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      showMessage("Ingrese su correo electrónico.", "error");
      return;
    }

    setLoading(true);
    showMessage("Enviando código...", "warning");

    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo: trimmedEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        setCorreoGuardado(trimmedEmail);
        showMessage(data.mensaje || "Código enviado con éxito", "success");
        setEnPaso2(true);
      } else {
        showMessage(data.detail || "Error al enviar el código", "error");
      }
    } catch (error) {
      console.error(error);
      showMessage("No fue posible conectar con el servidor.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRestablecer = async () => {
    const trimmedCode = codigo.trim();
    const trimmedNueva = nuevaContrasena.trim();
    const trimmedConfirmar = confirmarContrasena.trim();

    if (!trimmedCode) {
      showMessage("Ingrese el código de verificación.", "error");
      return;
    }
    if (!trimmedNueva) {
      showMessage("Ingrese su nueva contraseña.", "error");
      return;
    }
    if (trimmedNueva.length < 6) {
      showMessage("La contraseña debe tener al menos 6 caracteres.", "error");
      return;
    }
    if (trimmedNueva !== trimmedConfirmar) {
      showMessage("Las contraseñas no coinciden.", "error");
      return;
    }

    setLoading(true);
    showMessage("Restableciendo contraseña...", "warning");

    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          correo: correoGuardado,
          codigo: trimmedCode,
          nuevaContrasena: trimmedNueva,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        showMessage(data.mensaje || "Contraseña restablecida con éxito", "success");
        setTimeout(() => {
          router.replace('/');
        }, 2000);
      } else {
        showMessage(data.detail || "Error al restablecer la contraseña", "error");
      }
    } catch (error) {
      console.error(error);
      showMessage("No fue posible conectar con el servidor.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.card}>
          <Text style={styles.title}>Recuperar Contraseña</Text>
          <Text style={styles.subtitle}>
            {!enPaso2
              ? "Ingrese su correo electrónico para recibir un código de verificación."
              : `Ingrese el código enviado a ${correoGuardado}`}
          </Text>

          {message.text ? (
            <View
              style={[
                styles.messageBox,
                message.type === 'error' && styles.errorBox,
                message.type === 'success' && styles.successBox,
                message.type === 'warning' && styles.warningBox,
              ]}
            >
              <Text style={styles.messageText}>{message.text}</Text>
            </View>
          ) : null}

          {!enPaso2 ? (
            <View>
              <View style={styles.inputContainer}>
                <Mail color="#888" size={20} style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ingrese su correo electrónico"
                  placeholderTextColor="#888"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <TouchableOpacity
                style={styles.button}
                onPress={handleEnviarCodigo}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.buttonText}>Enviar código</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              <View style={styles.inputContainer}>
                <Key color="#888" size={20} style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ingrese el código de 6 dígitos"
                  placeholderTextColor="#888"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={codigo}
                  onChangeText={setCodigo}
                />
              </View>

              <View style={styles.inputContainer}>
                <Lock color="#888" size={20} style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Nueva contraseña"
                  placeholderTextColor="#888"
                  secureTextEntry={!showPassword}
                  value={nuevaContrasena}
                  onChangeText={setNuevaContrasena}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff color="#888" size={20} /> : <Eye color="#888" size={20} />}
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <Lock color="#888" size={20} style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirmar contraseña"
                  placeholderTextColor="#888"
                  secureTextEntry={!showConfirmPassword}
                  value={confirmarContrasena}
                  onChangeText={setConfirmarContrasena}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  {showConfirmPassword ? <EyeOff color="#888" size={20} /> : <Eye color="#888" size={20} />}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.button}
                onPress={handleRestablecer}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.buttonText}>Restablecer contraseña</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.backButtonText}>Volver al inicio de sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#1E1E1E', padding: 20, borderRadius: 12, width: '100%' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#FFF', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#AAA', textAlign: 'center', marginBottom: 20 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  icon: { marginRight: 10 },
  input: { flex: 1, color: '#FFF', height: 50 },
  button: {
    backgroundColor: '#D8A85B',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: { color: '#121212', fontWeight: 'bold', fontSize: 16 },
  backButton: { marginTop: 20, alignItems: 'center' },
  backButtonText: { color: '#D8A85B', fontSize: 14 },
  messageBox: { padding: 10, borderRadius: 6, marginBottom: 15 },
  errorBox: { backgroundColor: '#5c1d1d' },
  successBox: { backgroundColor: '#1d5c2e' },
  warningBox: { backgroundColor: '#5c521d' },
  messageText: { color: '#FFF', textAlign: 'center', fontSize: 14 },
});