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
import { Mail, Key } from 'lucide-react-native';
import { useRouter } from 'expo-router';

const API_URL = "http://192.168.101.10:8000"; // Reemplaza con tu IP local de FastAPI

export default function DesbloquearCuentaScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [enPaso2, setEnPaso2] = useState(false);
  const [correoGuardado, setCorreoGuardado] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const showMessage = (text: string, type: 'success' | 'error' | 'warning') => {
    setMessage({ text, type });
  };

  const handleEnviarCodigoDesbloqueo = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      showMessage("Ingrese su correo electrónico.", "error");
      return;
    }

    setLoading(true);
    showMessage("Enviando código...", "warning");

    try {
      const response = await fetch(`${API_URL}/auth/send-unlock-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo: trimmedEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        setCorreoGuardado(trimmedEmail);
        showMessage(data.mensaje || "Código de desbloqueo enviado", "success");
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

  const handleDesbloquear = async () => {
    const trimmedCode = codigo.trim();
    if (!trimmedCode) {
      showMessage("Ingrese el código de desbloqueo.", "error");
      return;
    }

    setLoading(true);
    showMessage("Desbloqueando cuenta...", "warning");

    try {
      const response = await fetch(`${API_URL}/auth/unlock-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          correo: correoGuardado,
          codigo: trimmedCode,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        showMessage(data.mensaje || "Cuenta desbloqueada con éxito", "success");
        setTimeout(() => {
          router.replace('/');
        }, 2000);
      } else {
        showMessage(data.detail || "Error al desbloquear la cuenta", "error");
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
          <Text style={styles.title}>Desbloquear Cuenta</Text>
          <Text style={styles.subtitle}>
            {!enPaso2
              ? "Ingrese su correo electrónico para recibir un código de desbloqueo."
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
                onPress={handleEnviarCodigoDesbloqueo}
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
                  placeholder="Ingrese el código"
                  placeholderTextColor="#888"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={codigo}
                  onChangeText={setCodigo}
                />
              </View>

              <TouchableOpacity
                style={styles.button}
                onPress={handleDesbloquear}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.buttonText}>Desbloquear cuenta</Text>
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