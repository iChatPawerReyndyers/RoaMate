import { Platform } from 'react-native';
import { getAuthToken, setAuthToken, clearAuthToken } from '@/services/security/KeyManager';

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
 * Thrown when the request never reached the server at all (device is
 * offline, DNS/connection refused, etc.) - distinct from a non-2xx HTTP
 * response, which means the server *was* reached. Screens that have a local
 * cache (e.g. MyTripsScreen) catch this specifically to decide whether to
 * show an "offline, showing saved data" state.
 */
export class NetworkUnavailableError extends Error {
  readonly cause?: unknown;

  constructor(cause: unknown) {
    super('Network request failed - device appears to be offline');
    this.name = 'NetworkUnavailableError';
    this.cause = cause;
  }
}

/**
 * Thrown for any non-2xx response the server actually sent back (as
 * opposed to NetworkUnavailableError, which means the request never got
 * there). Carries the HTTP status so callers - e.g. AccountContext telling
 * a 409 "username taken" apart from a 401 "wrong password" - don't have to
 * parse it back out of a message string.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/**
 * AccountContext registers itself here on mount. When a request comes back
 * 401 outside of /api/v1/auth/**, it means the cached token is no longer
 * valid (expired, or the server rotated its signing secret) and - unlike
 * the old dev-login bootstrap - there's no way to silently mint a fresh
 * one without real credentials. The cleanest recovery is to drop the local
 * session and send the person back to the sign-in screen.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

async function doFetch(path: string, method: string, token: string | null, body?: unknown, extraHeaders?: Record<string, string>) {
  try {
    return await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...extraHeaders,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    // fetch() itself throwing (not a non-2xx response) means the request
    // never reached the server - no connectivity, not a server-side error.
    throw new NetworkUnavailableError(err);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isAuthPath = path.startsWith('/api/v1/auth');
  const token = isAuthPath ? null : await getAuthToken();

  const response = await doFetch(path, method, token, body);

  if (response.status === 401 && !isAuthPath) {
    await clearAuthToken();
    unauthorizedHandler?.();
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new ApiError(response.status, text || `API ${method} ${path} failed: ${response.status}`);
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
    const token = await getAuthToken();
    const response = await doFetch(path, 'GET', token, undefined, { Accept: 'application/octet-stream' });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new ApiError(response.status, text || `API GET ${path} failed: ${response.status}`);
    }

    return response.arrayBuffer();
  },
};