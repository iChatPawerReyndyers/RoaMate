import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient, ApiError, setUnauthorizedHandler } from '@/services/api/client';
import {
  clearAuthToken,
  clearStoredAccount,
  getAuthToken,
  getDeviceId,
  getStoredAccount,
  setAuthToken,
  setStoredAccount,
  StoredAccount,
} from '@/services/security/KeyManager';
import { registerPushHandlers } from '@/services/push/PushService';
import { getApp } from '@react-native-firebase/app';
import { getMessaging, getToken } from '@react-native-firebase/messaging';

interface TokenResponse {
  accessToken: string;
  tokenType: string;
  expiresInSeconds: number;
  userId: string;
  username: string | null;
}

export class UsernameTakenError extends Error {}
export class InvalidCredentialsError extends Error {}

interface AccountContextValue {
  account: StoredAccount | null;
  isLoading: boolean;
  register: (username: string, password: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AccountContext = createContext<AccountContextValue | undefined>(undefined);

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<StoredAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // A cached account identity with no token is a real reachable state -
    // e.g. the Keychain entry (token) gets cleared independently of the
    // plain MMKV entry (account) on some reinstall/OS-level resets - and
    // previously this went undetected here: the app would render as
    // "logged in" while every authenticated request silently 401'd
    // underneath it (MyTripsScreen's generic error banner, MapScreen
    // crashing on an unhandled rejection, etc). Treat it as logged out.
    (async () => {
      const stored = getStoredAccount();
      const token = stored ? await getAuthToken() : null;
      if (stored && token) {
        setAccount(stored);
      } else if (stored && !token) {
        console.warn('Cached account found with no auth token - treating as logged out');
        clearStoredAccount();
      }
      setIsLoading(false);
    })();
  }, []);

  // GEO-02/03: registers this device's push token once per logged-in
  // session (not per-trip - a single token addresses whichever trip a
  // silent push turns out to be for). No-op-with-warning if push isn't
  // available (e.g. no Firebase project configured yet - see
  // docs/firebase-setup.md), same fail-soft posture as everything else
  // that depends on optional external config.
  useEffect(() => {
    if (!account) return undefined;
    return registerPushHandlers(account.userId);
  }, [account?.userId]);

  const logout = useCallback(async () => {
    // Best-effort: stop this device's token from silently addressing
    // future pushes for an account nobody's signed into anymore. Never
    // block logout on this - a Firebase hiccup here shouldn't trap someone
    // in a broken session they're actively trying to leave.
    try {
      const token = await getToken(getMessaging(getApp()));
      await apiClient.post('/api/v1/push/device-tokens/unregister', { token });
    } catch (err) {
      console.warn('Failed to unregister push token on logout (non-fatal)', err);
    }

    await clearAuthToken();
    clearStoredAccount();
    setAccount(null);
  }, []);

  // If a request ever comes back 401 outside of login/register themselves,
  // the cached token is dead and there's no way to silently refresh it
  // (see client.ts) - drop the local session so RootNavigator sends the
  // person back to the sign-in screen instead of every screen erroring.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const applySession = useCallback(async (token: TokenResponse) => {
    await setAuthToken(token.accessToken);
    const stored: StoredAccount = { userId: token.userId, username: token.username ?? '' };
    setStoredAccount(stored);
    setAccount(stored);
  }, []);

  const register = useCallback(
    async (username: string, password: string) => {
      try {
        // Carries the current device's anonymous id along so the backend
        // can reassign any trips/expenses/etc. this install already
        // created (pre-login) onto the brand-new account instead of
        // stranding them under the old anonymous identity.
        const previousUserId = await getDeviceId();
        const token = await apiClient.post<TokenResponse>('/api/v1/auth/register', {
          username,
          password,
          previousUserId,
        });
        await applySession(token);
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          throw new UsernameTakenError(`"${username}" is already taken`);
        }
        throw err;
      }
    },
    [applySession],
  );

  const login = useCallback(
    async (username: string, password: string) => {
      try {
        const token = await apiClient.post<TokenResponse>('/api/v1/auth/login', { username, password });
        await applySession(token);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          throw new InvalidCredentialsError('Incorrect username or password');
        }
        throw err;
      }
    },
    [applySession],
  );

  const value = useMemo(
    () => ({ account, isLoading, register, login, logout }),
    [account, isLoading, register, login, logout],
  );

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error('useAccount must be used within AccountProvider');
  }
  return context;
}