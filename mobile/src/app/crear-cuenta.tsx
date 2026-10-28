import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { API_URL } from '../constants/api';

type FormMessage = { text: string; type: 'success' | 'error' | 'warning' };

const CLIENT_ROLE_ID = 5;

export default function CrearCuentaScreen() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [message, setMessage] = useState<FormMessage>({ text: '', type: 'error' });

  const handleRegister = async () => {
    const cleanName = nombre.trim();
    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = telefono.trim();
    const cleanPassword = password.trim();

    if (!cleanName || !cleanUsername || !cleanEmail || !cleanPassword || !confirmPassword) {
      setMessage({ text: 'Completa todos los campos obligatorios.', type: 'error' });
      return;
    }
    if (cleanUsername.length < 4) {
      setMessage({ text: 'El usuario debe tener al menos 4 caracteres.', type: 'error' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setMessage({ text: 'Ingresa un correo electrónico válido.', type: 'error' });
      return;
    }
    if (cleanPassword.length < 6) {
      setMessage({ text: 'La contraseña debe tener al menos 6 caracteres.', type: 'error' });
      return;
    }
    if (cleanPassword !== confirmPassword.trim()) {
      setMessage({ text: 'Las contraseñas no coinciden.', type: 'error' });
      return;
    }
    if (cleanPhone.length > 10) {
      setMessage({ text: 'El teléfono no puede superar los 10 caracteres.', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage({ text: 'Creando cuenta de cliente...', type: 'warning' });

    try {
      const response = await fetch(`${API_URL}/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUsername,
          email: cleanEmail,
          nombre: cleanName,
          telefono: cleanPhone || null,
          password: cleanPassword,
          role_id: CLIENT_ROLE_ID,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage({
          text: data.detail || 'No fue posible crear la cuenta.',
          type: 'error',
        });
        return;
      }

      setCompleted(true);
      setMessage({
        text: 'Tu cuenta de cliente fue creada. Ya puedes iniciar sesión.',
        type: 'success',
      });
    } catch (error) {
      console.error(error);
      setMessage({ text: 'No fue posible conectar con el servidor.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    options: {
      autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
      keyboardType?: 'default' | 'email-address' | 'phone-pad';
      secureTextEntry?: boolean;
      required?: boolean;
    } = {},
  ) => (
    <View style={styles.formGroup}>
      <Text style={styles.label}>{label}{options.required ? ' *' : ''}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9C9287"
        autoCapitalize={options.autoCapitalize ?? 'sentences'}
        keyboardType={options.keyboardType ?? 'default'}
        secureTextEntry={options.secureTextEntry}
        editable={!loading && !completed}
        maxLength={label === 'Teléfono' ? 10 : undefined}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>Crear cuenta</Text>
          <Text style={styles.subtitle}>
            Regístrate como cliente para realizar pedidos desde la app.
          </Text>

          {message.text ? (
            <View style={[
              styles.messageBox,
              message.type === 'success' && styles.successMessage,
              message.type === 'error' && styles.errorMessage,
              message.type === 'warning' && styles.warningMessage,
            ]}>
              <Text style={styles.messageText}>{message.text}</Text>
            </View>
          ) : null}

          {renderInput('Nombre', nombre, setNombre, 'Tu nombre completo', { required: true })}
          {renderInput('Usuario', username, setUsername, 'Mínimo 4 caracteres', {
            autoCapitalize: 'none',
            required: true,
          })}
          {renderInput('Correo electrónico', email, setEmail, 'correo@ejemplo.com', {
            autoCapitalize: 'none',
            keyboardType: 'email-address',
            required: true,
          })}
          {renderInput('Teléfono', telefono, setTelefono, 'Opcional', {
            keyboardType: 'phone-pad',
          })}
          {renderInput('Contraseña', password, setPassword, 'Mínimo 6 caracteres', {
            autoCapitalize: 'none',
            secureTextEntry: true,
            required: true,
          })}
          {renderInput('Confirmar contraseña', confirmPassword, setConfirmPassword, 'Repite tu contraseña', {
            autoCapitalize: 'none',
            secureTextEntry: true,
            required: true,
          })}

          <TouchableOpacity
            style={[styles.button, (loading || completed) && styles.disabledButton]}
            onPress={completed ? () => router.replace('/') : handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>
                {completed ? 'Volver al inicio de sesión' : 'Crear cuenta'}
              </Text>
            )}
          </TouchableOpacity>

          {!completed ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              disabled={loading}
            >
              <Text style={styles.backButtonText}>Volver al inicio de sesión</Text>
            </TouchableOpacity>
          ) : null}
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
  card: {
    backgroundColor: '#32281F',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#45382E',
  },
  title: {
    color: '#F5F5F5',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#B8B1A8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  formGroup: {
    marginBottom: 14,
  },
  label: {
    color: '#F5F5F5',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 7,
  },
  input: {
    minHeight: 48,
    backgroundColor: '#2D2620',
    borderWidth: 1,
    borderColor: '#4A3D31',
    borderRadius: 10,
    paddingHorizontal: 12,
    color: '#F5F5F5',
    fontSize: 14,
  },
  button: {
    minHeight: 48,
    backgroundColor: '#D8A85B',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.65,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  backButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  backButtonText: {
    color: '#D8A85B',
    fontSize: 14,
    fontWeight: '600',
  },
  messageBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
  },
  successMessage: {
    backgroundColor: 'rgba(46, 204, 113, 0.2)',
    borderColor: '#2ECC71',
  },
  errorMessage: {
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    borderColor: '#E74C3C',
  },
  warningMessage: {
    backgroundColor: 'rgba(216, 168, 91, 0.2)',
    borderColor: '#D8A85B',
  },
  messageText: {
    color: '#F5F5F5',
    fontSize: 14,
    textAlign: 'center',
  },
});
