import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import type { Database } from '@nozbe/watermelondb';
import { createDatabase } from '@/db/database';
import { SyncManager } from '@/sync/SyncManager';
import { SyncProvider } from '@/sync/SyncContext';
import { AccountProvider } from '@/app/AccountContext';
import { TripProvider } from '@/app/TripContext';
import SessionGuard from '@/app/SessionGuard';
import RootNavigator from '@/app/navigation/RootNavigator';
import { warmUpBackend } from '@/services/api/client';

/**
 * The actual app root. This file previously contained a stray copy of
 * CreateTripScreen's code instead of bootstrapping anything - which meant
 * the app booted straight into a raw "create trip" form with no session,
 * no providers, and no navigation. RootNavigator, TripStack, MyTripsScreen,
 * AccountAuthScreen and SessionGuard all existed and were fully wired to
 * each other, just never mounted from here.
 *
 * Two more root-level gaps surfaced once real screens became reachable:
 * MyTripsScreen and ChecklistContainer call useDatabase() (from
 * @nozbe/watermelondb/react), and ChecklistContainer/EmergencyBeacon/
 * ItineraryContainer all call useSync() (from sync/SyncContext) - both
 * hooks throw if their provider was never mounted, and neither provider
 * existed anywhere in the codebase. This mounts both, alongside the
 * providers above.
 *
 * Provider order: SessionGuard bridges AccountContext -> TripContext
 * (clears the trip on logout - see its own comment), so it sits inside
 * both. Database and sync sit outermost since Account/Trip state doesn't
 * depend on them, but screens further down the tree depend on all four.
 *
 * GestureHandlerRootView wraps everything because ItineraryScreen's
 * drag-to-reorder (ITIN-01) uses react-native-gesture-handler's
 * PanGestureHandler - without this wrapper gesture recognition silently
 * fails to attach on Android.
 */

// SyncManager's own doc comment calls for three triggers: network
// reconnect, app foreground, and a periodic timer while the app is open.
// This wires up the latter two using only APIs already in the dependency
// tree (React Native's own AppState). Network-reconnect needs
// @react-native-community/netinfo, which isn't a project dependency yet -
// left as a follow-up rather than silently adding a new native module.
const FOREGROUND_SYNC_INTERVAL_MS = 60_000;

function useSyncTriggers(syncManager: SyncManager | null) {
  useEffect(() => {
    if (!syncManager) return undefined;

    syncManager.syncNow();

    const interval = setInterval(() => {
      syncManager.syncNow();
    }, FOREGROUND_SYNC_INTERVAL_MS);

    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        syncManager.syncNow();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [syncManager]);
}

export default function App() {
  const [database, setDatabase] = useState<Database | null>(null);
  const [syncManager, setSyncManager] = useState<SyncManager | null>(null);

  // Wake the (free-tier) backend now, and again whenever the app comes back
  // to the foreground, so its slow cold start overlaps with the splash /
  // sign-in screen rather than the person's first real request.
  useEffect(() => {
    warmUpBackend();
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        warmUpBackend();
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let cancelled = false;
    createDatabase().then(db => {
      if (cancelled) return;
      setDatabase(db);
      setSyncManager(new SyncManager(db));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useSyncTriggers(syncManager);

  if (!database || !syncManager) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <DatabaseProvider database={database}>
          <SyncProvider manager={syncManager}>
            <AccountProvider>
              <TripProvider>
                <SessionGuard />
                <RootNavigator />
              </TripProvider>
            </AccountProvider>
          </SyncProvider>
        </DatabaseProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}