import { Platform } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  requestPermission,
  AuthorizationStatus,
  getToken,
  onMessage,
  onTokenRefresh,
  type RemoteMessage,
} from '@react-native-firebase/messaging';
import Geolocation from '@react-native-community/geolocation';
import { apiClient } from '@/services/api/client';
import { getCurrentUserId } from '@/services/security/KeyManager';

/**
 * GEO-02/03: handles incoming SILENT push messages to trigger an on-demand
 * location fix (see MapScreen.tsx / SilentPushService.java on the backend
 * for the full flow this is one half of).
 *
 * The push payload carries its own tripId (set by SilentPushService when it
 * dispatches the push), so this handles a location request for whichever
 * trip it's for - it isn't scoped to "the trip currently open on screen",
 * since the app could receive this while backgrounded or on a different
 * screen entirely.
 */
async function handleLocationRequestMessage(message: RemoteMessage, userId: string): Promise<void> {
  const data = message.data;
  if (!data || data.type !== 'LOCATION_REQUEST' || typeof data.tripId !== 'string') {
    return;
  }
  const tripId = data.tripId;

  await new Promise<void>(resolve => {
    Geolocation.getCurrentPosition(
      async position => {
        try {
          const { latitude, longitude } = position.coords;
          await apiClient.post(
            `/api/v1/geo/trips/${tripId}/locations?userId=${encodeURIComponent(userId)}&lat=${latitude}&lng=${longitude}`,
          );
        } catch (err) {
          console.warn('Failed to report location after silent push', err);
        }
        resolve();
      },
      err => {
        // Losing gracefully here is the point of GEO-04: the requester's
        // SilentPushService.refreshTripLocations() times out after 5s
        // regardless and falls back to this device's last cached position.
        console.warn('Failed to get GPS fix for silent push location request', err);
        resolve();
      },
      { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 },
    );
  });
}

/**
 * Registered separately in index.js via setBackgroundMessageHandler, for
 * delivery while the app is backgrounded or fully killed - there's no
 * mounted React tree at that point to have captured a userId in closure,
 * so this resolves the currently logged-in account itself.
 */
export async function handleBackgroundLocationRequest(message: RemoteMessage): Promise<void> {
  const userId = await getCurrentUserId();
  await handleLocationRequestMessage(message, userId);
}

async function registerToken(userId: string): Promise<string | null> {
  try {
    const messaging = getMessaging(getApp());
    const authStatus = await requestPermission(messaging);
    const granted = authStatus === AuthorizationStatus.AUTHORIZED || authStatus === AuthorizationStatus.PROVISIONAL;
    if (!granted) {
      console.warn('Push permission not granted - GEO-02/03 silent location requests will fall back to GEO-04 cached positions for this device');
      return null;
    }

    const token = await getToken(messaging);
    await apiClient.post('/api/v1/push/device-tokens', {
      token,
      platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
    });
    return token;
  } catch (err) {
    // Most commonly: no Firebase project configured yet (missing
    // google-services.json / GoogleService-Info.plist) - see
    // docs/firebase-setup.md. Fails soft rather than crashing the app,
    // same philosophy as the Mapbox integration's credential gap.
    console.warn('Failed to register for push notifications - GEO-02/03 is unavailable, falling back to GEO-04 cached positions', err);
    return null;
  }
}

/**
 * Call once per logged-in session (see AccountContext), not per-trip -
 * registers this device's push token with the backend and wires up the
 * foreground message handler. Returns a cleanup function to call on
 * logout.
 *
 * The BACKGROUND message handler is separate and lives in index.js at the
 * true top level, outside any React component - Firebase requires that
 * for background/killed-state delivery, it can't be registered from here.
 */
export function registerPushHandlers(userId: string): () => void {
  let unsubscribeMessage: (() => void) | null = null;
  let unsubscribeTokenRefresh: (() => void) | null = null;
  let cancelled = false;

  (async () => {
    const token = await registerToken(userId);
    if (cancelled || !token) return;

    const messaging = getMessaging(getApp());
    unsubscribeMessage = onMessage(messaging, message => handleLocationRequestMessage(message, userId));
    unsubscribeTokenRefresh = onTokenRefresh(messaging, async refreshedToken => {
      try {
        await apiClient.post('/api/v1/push/device-tokens', {
          token: refreshedToken,
          platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
        });
      } catch (err) {
        console.warn('Failed to re-register refreshed push token', err);
      }
    });
  })();

  return () => {
    cancelled = true;
    unsubscribeMessage?.();
    unsubscribeTokenRefresh?.();
  };
}