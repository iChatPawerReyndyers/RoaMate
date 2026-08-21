import { useEffect, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { apiClient } from '@/services/api/client';
import { downloadOfflinePackForTrip, shouldRefreshOfflinePack, OfflineStorageFullError } from '@/services/maps/OfflineMapManager';

interface DestinationCoordinate {
  lat: number;
  lng: number;
}

// Re-check even while continuously connected, in case OFFLINE_PACK_MAX_AGE_MS
// has elapsed since the last download - matches the interval already used
// for sync triggers in App.tsx, so there's one consistent "how often do we
// poll while the app is open" cadence across the codebase rather than two.
const CONNECTIVITY_RECHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * GEO-05 / offline maps: keeps the current trip's offline map pack
 * downloaded and current automatically, without the person needing to
 * open the Map tab and tap anything. Runs for as long as this hook is
 * mounted (see TripStack.tsx, which mounts it for the whole time a trip
 * is open, not just while the Map tab is active) and re-checks:
 *  - immediately when connectivity becomes available (including on mount,
 *    if already connected)
 *  - once an hour thereafter, in case OFFLINE_PACK_MAX_AGE_MS has passed
 *
 * Deliberately foreground-only, not a true background-fetch-while-killed
 * task: react-native-background-fetch is a project dependency but isn't
 * wired to anything, and doing that properly needs extra native manifest/
 * Info.plist setup (Android headless JS task registration, iOS
 * BGTaskScheduler identifiers) that's a separate, deliberate piece of
 * work - not something to bolt on silently here. This covers the
 * realistic common case (download/refresh maps while you have signal and
 * the app open, before you lose connectivity on the trip itself), which is
 * most of what "auto-download when connected" is actually for.
 *
 * Silent by design: no loading spinners or toasts for this background
 * check - OfflineMapControl (on the Map tab itself) already shows
 * progress/pack status for anyone who wants to see it directly.
 */
export function useAutoOfflineMapSync(tripId: string | null): void {
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!tripId) return undefined;

    const trySync = async () => {
      if (syncingRef.current) return; // already checking/downloading - don't overlap
      const state = await NetInfo.fetch();
      const online = state.isInternetReachable ?? state.isConnected ?? false;
      if (!online) return;

      syncingRef.current = true;
      try {
        const destinations = await apiClient.get<DestinationCoordinate[]>(`/api/v1/itinerary/trips/${tripId}/destinations`);
        const coordinates = destinations.map(d => ({ lat: d.lat, lng: d.lng }));

        if (!(await shouldRefreshOfflinePack(tripId, coordinates))) return;

        await downloadOfflinePackForTrip(tripId, coordinates);
        console.warn(`[offline-map] auto-refreshed offline map for trip ${tripId}`);
      } catch (err) {
        if (err instanceof OfflineStorageFullError) {
          // Deliberately doesn't auto-evict another trip's pack to make
          // room (see OfflineMapManager's own comment on this) - the
          // person needs to free space themselves from the Map tab, so
          // this just logs and tries again next cycle rather than nagging.
          console.warn('[offline-map] auto-refresh skipped, storage cap reached', err.currentBytes);
        } else {
          console.warn('[offline-map] auto-refresh failed', err);
        }
      } finally {
        syncingRef.current = false;
      }
    };

    trySync();

    const unsubscribe = NetInfo.addEventListener(state => {
      const online = state.isInternetReachable ?? state.isConnected ?? false;
      if (online) trySync();
    });

    const interval = setInterval(trySync, CONNECTIVITY_RECHECK_INTERVAL_MS);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [tripId]);
}