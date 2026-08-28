import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export interface TripMember {
  id: string;
  tripId: string;
  userId: string;
  displayName: string;
  role: string;
}

export interface CurrentTrip {
  tripId: string;
  inviteCode: string;
  name?: string;
  description?: string;
  defaultCurrency: string;
  members: TripMember[];
}

interface TripContextValue {
  currentTrip: CurrentTrip | null;
  setCurrentTrip: (trip: Omit<CurrentTrip, 'members'>) => void;
  setTripMembers: (members: TripMember[]) => void;
  clearTrip: () => void;
}

const TripContext = createContext<TripContextValue | undefined>(undefined);

export function TripProvider({ children }: { children: React.ReactNode }) {
  const [currentTrip, setCurrentTripState] = useState<CurrentTrip | null>(null);

  const setCurrentTrip = useCallback((trip: Omit<CurrentTrip, 'members'>) => {
    setCurrentTripState({ ...trip, members: [] });
  }, []);

  const setTripMembers = useCallback((members: TripMember[]) => {
    setCurrentTripState(current => (current ? { ...current, members } : current));
  }, []);

  const clearTrip = useCallback(() => {
    setCurrentTripState(null);
  }, []);

  const value = useMemo(
    () => ({ currentTrip, setCurrentTrip, setTripMembers, clearTrip }),
    [currentTrip, setCurrentTrip, setTripMembers, clearTrip],
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip() {
  const context = useContext(TripContext);
  if (!context) {
    throw new Error('useTrip must be used within TripProvider');
  }
  return context;
}
