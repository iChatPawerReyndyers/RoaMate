import { Platform } from 'react-native';
import { getAuthToken, setAuthToken } from '@/services/security/KeyManager';

/**
 * Android emulators run in their own virtual network - `localhost` from
 * inside the emulator refers to the emulator itself, not your host
 * machine. `10.0.2.2` is the special alias Android's emulator provides
 * specifically to reach the host's localhost. iOS Simulator shares the
 * host's network stack directly, so plain `localhost` works there.
 * Physical devices need your machine's real LAN IP instead of either -
 * not handled here, since it varies per network.
 */
const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const BASE_URL = __DEV__ ? `http://${DEV_HOST}:8080` : 'https://api.roamate.app';

/**
 * DEV-ONLY bootstrap: if no token is cached yet, silently obtain one from
 * the backend's dev-login endpoint (see backend AuthController) using a
 * per-install device id as the userId. This exists purely so screens don't
 * all need to manually wire up a login step before this real auth flow
 * (or a proper login screen) is built. Remove before shipping.
 */
async function ensureDevToken(): Promise<string | null> {
  const existing = await getAuthToken();
  if (existing) return existing;

  const { getDeviceId } = await import('@/services/security/KeyManager');
  const deviceId = await getDeviceId();

  const response = await fetch(`${BASE_URL}/api/v1/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: deviceId }),
  });

  if (!response.ok) {
    console.warn('Dev auto-login failed:', response.status);
    return null;
  }

  const data = await response.json();
  await setAuthToken(data.accessToken);
  return data.accessToken;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = path.startsWith('/api/v1/auth') ? null : await ensureDevToken();

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`API ${method} ${path} failed: ${response.status} ${text}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
  download: async (path: string): Promise<ArrayBuffer> => {
    const token = await ensureDevToken();
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        Accept: 'application/octet-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`API GET ${path} failed: ${response.status} ${text}`);
    }

    return response.arrayBuffer();
  },
};
