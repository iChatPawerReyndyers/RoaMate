import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useDatabase } from '@nozbe/watermelondb/react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiClient, ApiError } from '@/services/api/client';
import { useSync } from '@/sync/SyncContext';
import ItineraryScreen, { Destination } from './ItineraryScreen';
import { TripStackParamList } from '@/app/navigation/TripStack';
import { NeuConfirmModal } from '@/components/neumorphic/NueModal';
import { neuColors } from '@/theme/neumorphic';
import { cacheDestinationsFromServer, getCachedLocalDestinations } from '@/db/repositories/destinationsRepository';

interface Props {
  tripId: string;
  /** Called instead of navigating to the full DestinationForm screen when "Edit" is tapped - see ItineraryHubScreen. */
  onRequestEditOnMap: (destinationId: string) => void;
  /** ITIN-05: called when "Get directions" is tapped on a card - see ItineraryHubScreen. */
  onRequestDirectionsOnMap: (destinationId: string) => void;
}

export default function ItineraryContainer({ tripId, onRequestEditOnMap, onRequestDirectionsOnMap }: Props) {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Offline-first: true whenever what's on screen came from the local
  // cache rather than a fresh fetch (see loadDestinations below).
  const [isOffline, setIsOffline] = useState(false);
  const database = useDatabase();
  // Rendered inside the Itinerary tab (see TripTabs.tsx > ItineraryHubScreen),
  // so the nearest stack ancestor is the 'Home' screen that hosts the tabs.
  const navigation = useNavigation<NativeStackNavigationProp<TripStackParamList, 'Home'>>();
  const syncManager = useSync();
  const [pendingRemoval, setPendingRemoval] = useState<{ id: string; name: string } | null>(null);

  /**
   * Offline-first: tries the network first (the source of truth, and the
   * only way to pick up another member's changes), and on any failure -
   * no connection, a timeout, a 5xx - falls back to whatever the last
   * successful fetch cached locally (see destinationsRepository.ts)
   * instead of showing an empty list or an error. The error screen is
   * reserved for the one case caching can't help with: no connection AND
   * nothing has ever been cached (a fresh install's very first load).
   */
  const loadDestinations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiClient.get<Destination[]>(`/api/v1/itinerary/trips/${tripId}/destinations`);
      setDestinations(result);
      setIsOffline(false);
      cacheDestinationsFromServer(database, tripId, result).catch(err =>
        console.warn('Failed to cache itinerary destinations for offline use', err),
      );
    } catch (err) {
      console.warn('Failed to load itinerary destinations, falling back to local cache', err);
      try {
        const cached = await getCachedLocalDestinations(database, tripId);
        if (cached.length > 0) {
          setDestinations(cached);
          setIsOffline(true);
        } else {
          setError('Unable to load itinerary at this time.');
        }
      } catch (cacheErr) {
        console.warn('Failed to read cached itinerary destinations', cacheErr);
        setError('Unable to load itinerary at this time.');
      }
    } finally {
      setLoading(false);
    }
  }, [tripId, database]);

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
      // A 403 here now only means "no longer a member of this trip" (e.g.
      // removed mid-session) rather than "not an admin" - itinerary edits
      // are open to any trip member. Still a permanent rejection, not
      // worth queuing for retry.
      if (err instanceof ApiError && err.status === 403) {
        setDestinations(previousDestinations);
        Alert.alert("Can't reorder", "You're no longer a member of this trip.");
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

  const handleRemove = (destinationId: string, destinationName: string) => {
    setPendingRemoval({ id: destinationId, name: destinationName });
  };

  const confirmRemove = async () => {
    if (!pendingRemoval) return;
    const { id: destinationId } = pendingRemoval;
    setPendingRemoval(null);
    const previousDestinations = destinations;
    setDestinations(prev => prev.filter(d => d.id !== destinationId));
    try {
      await apiClient.delete(`/api/v1/itinerary/destinations/${destinationId}`);
    } catch (err) {
      console.warn('Failed to remove destination', err);
      setDestinations(previousDestinations);
      Alert.alert("Couldn't remove", 'Please check your connection and try again.');
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={neuColors.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <>
      {isOffline ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>You're offline - showing your last saved itinerary.</Text>
        </View>
      ) : null}
      <ItineraryScreen
        destinations={destinations}
        onReorder={handleReorder}
        onOpenNotes={(destinationId, destinationName) => {
          navigation.navigate('DestinationNotes', { destinationId, destinationName });
        }}
        onStartActivity={(destinationId, destinationName) => {
          // ACT-05: hand the Activity screen this destination's own
          // coordinates plus every other stop's, straight from this
          // already-loaded `destinations` state - not a fresh API call -
          // so its "looks like you've moved on" auto-detect prompt works
          // fully offline. See TripStack's Activity route type for why.
          const current = destinations.find(d => d.id === destinationId);
          const otherDestinations = destinations
            .filter((d): d is typeof d & { lat: number; lng: number } => d.id !== destinationId && d.lat !== undefined && d.lng !== undefined)
            .map(d => ({ id: d.id, name: d.name, lat: d.lat, lng: d.lng }));

          navigation.navigate('Activity', {
            destinationId,
            destinationName,
            destinationLat: current?.lat,
            destinationLng: current?.lng,
            otherDestinations,
          });
        }}
        onAddDestination={() => {
          navigation.navigate('DestinationForm', { tripId });
        }}
        onEditDestination={onRequestEditOnMap}
        onRemoveDestination={handleRemove}
        onGetDirections={onRequestDirectionsOnMap}
      />
      <NeuConfirmModal
        visible={pendingRemoval !== null}
        icon="🗑"
        title="Remove destination"
        description={pendingRemoval ? `Remove "${pendingRemoval.name}" from the itinerary?` : ''}
        confirmLabel="Remove"
        destructive
        onConfirm={confirmRemove}
        onCancel={() => setPendingRemoval(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: neuColors.background },
  error: { color: neuColors.danger, textAlign: 'center' },
  offlineBanner: { backgroundColor: neuColors.info, paddingVertical: 6, paddingHorizontal: 16, alignItems: 'center' },
  offlineBannerText: { color: neuColors.white, fontSize: 12 },
});