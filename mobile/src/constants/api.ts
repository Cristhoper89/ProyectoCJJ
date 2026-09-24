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
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const rawText = await response.text();
  let body: any = null;

  if (rawText) {
    try {
      body = JSON.parse(rawText);
    } catch {
      body = rawText;
    }
  }

  if (!response.ok) {
    const detail = typeof body === 'object' && body !== null
      ? body.detail ?? body.message ?? JSON.stringify(body)
      : body || `HTTP ${response.status}`;

    throw new Error(typeof detail === 'string' ? detail : 'No fue posible completar la solicitud.');
  }

  return (body ?? null) as T;
}