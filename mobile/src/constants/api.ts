import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_URL = 'https://backend-6ad6b6fa.fastapicloud.dev';
const SESSION_KEY = '@la_cabana_session';
const SESSION_DURATION = 60 * 60 * 1000;

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
  headers.set('Content-Type', 'application/json');

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.detail || 'No fue posible completar la solicitud.');
  }

  return body as T;
}