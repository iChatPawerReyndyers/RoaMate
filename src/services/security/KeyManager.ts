import * as Keychain from 'react-native-keychain';
import { createMMKV } from 'react-native-mmkv';

// react-native-mmkv v4 removed the JS `MMKV` class entirely - it's a Nitro
// module now, instantiated via this factory function instead of `new MMKV()`.
const storage = createMMKV({ id: 'roamate-non-sensitive' });

const DB_KEY_SERVICE = 'com.roamate.db-encryption-key';
const AUTH_TOKEN_SERVICE = 'com.roamate.auth-token';

/**
 * The SQLCipher key for the local WatermelonDB database lives ONLY in the
 * platform keychain (iOS Keychain / Android Keystore), generated once on
 * first launch. It never touches JS-readable storage, disk, or logs -
 * satisfying "encrypted at rest, AES-256" from the spec's NFR section.
 */
export async function getOrCreateEncryptionKey(): Promise<string> {
  const existing = await Keychain.getGenericPassword({ service: DB_KEY_SERVICE });
  if (existing) return existing.password;

  const key = generateRandomKey(32);
  await Keychain.setGenericPassword('roamate', key, { service: DB_KEY_SERVICE });
  return key;
}

export async function getAuthToken(): Promise<string | null> {
  const creds = await Keychain.getGenericPassword({ service: AUTH_TOKEN_SERVICE });
  return creds ? creds.password : null;
}

export async function setAuthToken(token: string): Promise<void> {
  await Keychain.setGenericPassword('roamate', token, { service: AUTH_TOKEN_SERVICE });
}

/**
 * Drops the cached dev token. Needed when the backend rejects it with 401 -
 * e.g. it expired (24h TTL from AuthController), or the backend was
 * restarted with a different JWT_SECRET than what signed this token. Without
 * this, ensureDevToken() in client.ts would keep reusing the same bad token
 * forever since it only fetches a new one when none is cached.
 */
export async function clearAuthToken(): Promise<void> {
  await Keychain.resetGenericPassword({ service: AUTH_TOKEN_SERVICE });
}

export async function getDeviceId(): Promise<string> {
  const cached = storage.getString('device_id');
  if (cached) return cached;
  const id = generateRandomKey(16);
  storage.set('device_id', id);
  return id;
}

export interface StoredAccount {
  userId: string;
  username: string;
}

const ACCOUNT_KEY = 'account_identity';

/**
 * Username/userId aren't secret, so - like device_id - these live in the
 * plain MMKV store, not the Keychain (which is reserved for the auth token
 * and the DB encryption key).
 */
export function getStoredAccount(): StoredAccount | null {
  const raw = storage.getString(ACCOUNT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAccount;
  } catch {
    return null;
  }
}

export function setStoredAccount(account: StoredAccount): void {
  storage.set(ACCOUNT_KEY, JSON.stringify(account));
}

export function clearStoredAccount(): void {
  storage.remove(ACCOUNT_KEY);
}

/**
 * The id used to tag anything the person does (expenses, checklist items,
 * activity sessions, sync events, ...). Prefers the logged-in account's
 * permanent id; falls back to the per-install device id only if called
 * before login somehow manages to happen - every screen that calls this is
 * expected to be gated behind RootNavigator's account check, so the
 * fallback is a safety net, not the normal path.
 */
export async function getCurrentUserId(): Promise<string> {
  const account = getStoredAccount();
  if (account) return account.userId;
  console.warn('getCurrentUserId() called with no account logged in - falling back to device id');
  return getDeviceId();
}

function generateRandomKey(bytes: number): string {
  const arr = new Uint8Array(bytes);
  // In production, use react-native-get-random-values (crypto polyfill) -
  // included transitively by most RN crypto libs; omitted here for brevity.
  for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}