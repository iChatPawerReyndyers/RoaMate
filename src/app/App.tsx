import React, { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { Database } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import RootNavigator from './navigation/RootNavigator';
import { createDatabase } from '@/db/database';
import { TripProvider } from '@/app/TripContext';
import { SyncManager } from '@/sync/SyncManager';
import { SyncProvider } from '@/sync/SyncContext';

/**
 * App bootstrap: sets up the encrypted local database before rendering
 * anything else, since every screen in the app reads/writes through it
 * even while fully offline.
 */
export default function App() {
  const [database, setDatabase] = useState<Database | null>(null);
  const [syncManager, setSyncManager] = useState<SyncManager | null>(null);

  useEffect(() => {
    createDatabase()
      .then(db => {
        setDatabase(db);
        const manager = new SyncManager(db);
        setSyncManager(manager);
        manager.syncNow().catch(err => console.warn('Initial sync failed', err));
      })
      .catch(err => {
        console.error('Failed to initialize local database', err);
      });
  }, []);

  useEffect(() => {
    if (!syncManager) return;

    const interval = setInterval(() => {
      syncManager.syncNow().catch(err => console.warn('Automatic sync failed', err));
    }, 20000);

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        syncManager.syncNow().catch(err => console.warn('Foreground sync failed', err));
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [syncManager]);

  if (!database || !syncManager) {
    return null; // swap in a branded splash screen component here
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TripProvider>
          <DatabaseProvider database={database}>
            <SyncProvider manager={syncManager}>
              <RootNavigator />
            </SyncProvider>
          </DatabaseProvider>
        </TripProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
