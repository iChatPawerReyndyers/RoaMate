import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiClient } from '@/services/api/client';
import { useSync } from '@/sync/SyncContext';
import ItineraryScreen, { Destination } from './ItineraryScreen';
import { TripStackParamList } from '@/app/navigation/TripStack';

interface Props {
  tripId: string;
}

export default function ItineraryContainer({ tripId }: Props) {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation<NativeStackNavigationProp<TripStackParamList, 'Itinerary'>>();
  const syncManager = useSync();

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

  useEffect(() => {
    loadDestinations();
  }, [loadDestinations]);

  const handleReorder = async (orderedIds: string[]) => {
    const nextDestinations = orderedIds
      .map(id => destinations.find(destination => destination.id === id))
      .filter((destination): destination is Destination => destination !== undefined);

    setDestinations(nextDestinations);

    try {
      await apiClient.post('/api/v1/itinerary/destinations/reorder', orderedIds);
    } catch (err) {
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
