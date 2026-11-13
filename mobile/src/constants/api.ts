import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_URL = 'https://serviciocontigo.io/api';
const SESSION_KEY = '@la_cabana_session';
const SESSION_DURATION = 60 * 60 * 1000;
export const CONNECTION_ERROR_MESSAGE = 'No fue posible conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
export const SESSION_EXPIRED_MESSAGE = 'Tu sesión venció. Inicia sesión nuevamente.';
export const SERVER_ERROR_MESSAGE = 'No fue posible completar la solicitud. Inténtalo de nuevo más tarde.';

export type AuthenticatedHomeRoute = '/mesa' | '/caja-actual' | '/pedidos' | '/carta';

let accessToken: string | null = null;

export async function setAccessToken(token: string) {
  accessToken = token;
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ token, expiresAt: Date.now() + SESSION_DURATION }));
}

export function getAccessToken() {
  return accessToken;
}

export async function restoreAccessToken() {
  const stored = await AsyncStorage.getItem(SESSION_KEY);
  if (!stored) return null;

  const session = JSON.parse(stored) as { token?: string; expiresAt?: number };
  if (!session.token || !session.expiresAt || session.expiresAt <= Date.now()) {
    await clearAccessToken();
    return null;
  }

  accessToken = session.token;
  return accessToken;
}

export async function clearAccessToken() {
  accessToken = null;
  await AsyncStorage.removeItem(SESSION_KEY);
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  let response: Response;
  let rawText: string;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
    rawText = await response.text();
  } catch (error) {
    console.error('Error de conexión con la API móvil:', error);
    throw new Error(CONNECTION_ERROR_MESSAGE);
  }

  let body: any = null;

  if (rawText) {
    try {
      body = JSON.parse(rawText);
    } catch {
      body = rawText;
    }
  }

  if (response.status === 401) {
    await clearAccessToken();
    throw new Error(SESSION_EXPIRED_MESSAGE);
  }

  if (response.status >= 500) {
    throw new Error(SERVER_ERROR_MESSAGE);
  }

  if (!response.ok) {
    const detail = typeof body === 'object' && body !== null
      ? body.detail ?? body.message ?? JSON.stringify(body)
      : body || `HTTP ${response.status}`;

    throw new Error(typeof detail === 'string' ? detail : 'No fue posible completar la solicitud.');
  }

  return (body ?? null) as T;
}

export async function getAuthenticatedHomeRoute(): Promise<AuthenticatedHomeRoute> {
  const user = await apiRequest<{ role_name: string }>('/auth/me');

  switch (user.role_name) {
    case 'Administrador':
    case 'Cajero':
    case 'Mesero':
      return '/mesa';
    case 'Cocina':
      return '/pedidos';
    case 'Cliente':
      return '/carta';
    default:
      throw new Error(`El rol "${user.role_name}" no tiene un flujo móvil configurado.`);
  }
}