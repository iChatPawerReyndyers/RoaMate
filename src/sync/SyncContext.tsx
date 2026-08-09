import React, { createContext, useContext } from 'react';
import { SyncManager } from './SyncManager';

const SyncContext = createContext<SyncManager | null>(null);

export function SyncProvider({ manager, children }: { manager: SyncManager; children: React.ReactNode }) {
  return <SyncContext.Provider value={manager}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncManager {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within SyncProvider');
  }
  return context;
}
