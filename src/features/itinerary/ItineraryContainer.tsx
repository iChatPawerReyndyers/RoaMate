import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, StyleSheet, Text } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiClient, ApiError } from '@/services/api/client';
import { useSync } from '@/sync/SyncContext';
import { useTrip } from '@/app/TripContext';
import { useAccount } from '@/app/AccountContext';
import ItineraryScreen, { Destination } from './ItineraryScreen';
import { TripStackParamList } from '@/app/navigation/TripStack';

interface Props {
  tripId: string;
}

const ADMIN_ROLES = new Set(['OWNER', 'CO_ORGANIZER']);

export default function ItineraryContainer({ tripId }: Props) {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Rendered inside the Itinerary tab (see TripTabs.tsx > ItineraryHubScreen),
  // so the nearest stack ancestor is the 'Home' screen that hosts the tabs.
  const navigation = useNavigation<NativeStackNavigationProp<TripStackParamList, 'Home'>>();
  const syncManager = useSync();
  const { currentTrip } = useTrip();
  const { account } = useAccount();

  // TRIP-02: "Admin can edit core itineraries" - everything else in the app
  // is open to all participants, so this is the only place that reads role.
  const myRole = currentTrip?.members.find(m => m.userId === account?.userId)?.role;
  const isAdmin = myRole ? ADMIN_ROLES.has(myRole) : false;

  const loadDestinations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.get<Destination[]>(`/api/v1/itinerary/trips/${tripId}/destinations`);
      setDestinations(result);
    } catch (err) {
      console.warn('Failed to load itinerary destinations', err);
      setError('Unable to load itinerary at this time.');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  // DestinationForm is pushed on top of the Home screen (which hosts this
  // tab) and pops back to it after saving - Home itself never remounts, so
  // a mount-only effect wouldn't pick up the newly added/edited destination.
  // useFocusEffect covers both the initial load and every return to focus.
  useFocusEffect(
    useCallback(() => {
      loadDestinations();
    }, [loadDestinations]),
  );

  const handleReorder = async (orderedIds: string[]) => {
    const previousDestinations = destinations;
    const nextDestinations = orderedIds
      .map(id => destinations.find(destination => destination.id === id))
      .filter((destination): destination is Destination => destination !== undefined);

    setDestinations(nextDestinations);

    try {
      await apiClient.post('/api/v1/itinerary/destinations/reorder', orderedIds);
    } catch (err) {
      // A 403 (TRIP-02: non-admin) is a real, permanent rejection - it'll
      // never succeed by retrying later, so revert the optimistic reorder
      // and surface it, rather than silently queueing it for sync like a
      // transient/offline failure below.
      if (err instanceof ApiError && err.status === 403) {
        setDestinations(previousDestinations);
        Alert.alert("Can't reorder", 'Only trip admins can edit the itinerary.');
        return;
      }
      console.warn('Failed to persist itinerary reorder, queued for sync', err);
      await syncManager.enqueueEvent({
        tripId,
        eventType: 'DESTINATION_REORDERED',
        clientTimestamp: Date.now(),
        payloadJson: JSON.stringify({ reorder: orderedIds }),
      });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <ItineraryScreen
      destinations={destinations}
      isAdmin={isAdmin}
      onReorder={handleReorder}
      onOpenNotes={(destinationId, destinationName) => {
        navigation.navigate('DestinationNotes', { destinationId, destinationName });
      }}
      onStartActivity={(destinationId, destinationName) => {
        navigation.navigate('Activity', { destinationId, destinationName });
      }}
      onAddDestination={() => {
        navigation.navigate('DestinationForm', { tripId });
      }}
      onEditDestination={destinationId => {
        navigation.navigate('DestinationForm', { tripId, destinationId });
      }}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  error: { color: '#b00020', textAlign: 'center' },
});
