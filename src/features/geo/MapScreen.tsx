import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { apiClient } from '@/services/api/client';
import { requestLocationPermission } from '@/services/location/requestLocationPermission';

interface MemberLocation {
  userId: string;
  lat: number;
  lng: number;
  capturedAt: string;
  stale: boolean;
}

interface Props {
  tripId: string;
}

// MapView with no initialRegion defaults its camera to (0, 0) - open ocean
// off West Africa - which looks like a blank/broken map. This is a
// reasonable fallback center (Philippines) until real member locations
// arrive and the camera reframes to them instead.
const DEFAULT_REGION: Region = {
  latitude: 12.8797,
  longitude: 121.774,
  latitudeDelta: 8,
  longitudeDelta: 8,
};

/**
 * GEO-01..04: opening this screen triggers the server to fan out a silent
 * push to every other member (see SilentPushService.java); each response
 * (or 5s timeout -> last-known-cache fallback) lands here as a marker with
 * a staleness indicator rather than blocking the whole map on one slow
 * device.
 */
export default function MapScreen({ tripId }: Props) {
  const [locations, setLocations] = useState<MemberLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const mapRef = useRef<MapView>(null);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.get<MemberLocation[]>(`/api/v1/geo/trips/${tripId}/locations`);
      setLocations(result);

      if (result.length > 0) {
        mapRef.current?.fitToCoordinates(
          result.map(loc => ({ latitude: loc.lat, longitude: loc.lng })),
          { edgePadding: { top: 80, right: 80, bottom: 80, left: 80 }, animated: true },
        );
      }
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // Best-effort: center on the device's own location first (if permission
  // is granted), so the map doesn't sit on the generic Philippines default
  // any longer than it has to. This runs independently of fetchLocations
  // and just loses gracefully if it's slower or denied - member locations
  // (fetchLocations, above) still reframe the camera again once they load,
  // and take priority since that's the actual point of this screen.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const granted = await requestLocationPermission();
      if (!granted || cancelled) return;

      Geolocation.getCurrentPosition(
        pos => {
          if (cancelled) return;
          mapRef.current?.animateToRegion(
            {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            },
            500,
          );
        },
        err => console.warn('Could not get current location for map default', err),
        { enableHighAccuracy: true, timeout: 5000 },
      );
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <MapView ref={mapRef} style={StyleSheet.absoluteFill} initialRegion={DEFAULT_REGION}>
        {locations.map(loc => (
          <Marker
            key={loc.userId}
            coordinate={{ latitude: loc.lat, longitude: loc.lng }}
            title={loc.userId}
            description={loc.stale ? `Updated ${timeAgo(loc.capturedAt)}` : 'Live'}
            pinColor={loc.stale ? '#999' : '#2f6fed'}
          />
        ))}
      </MapView>
      {loading && (
        <View style={styles.loadingBanner}>
          <Text style={styles.loadingText}>Requesting locations…</Text>
        </View>
      )}
      {!loading && locations.length === 0 && (
        <View style={styles.emptyBanner}>
          <Text style={styles.loadingText}>No member locations shared yet.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingBanner: { position: 'absolute', top: 12, alignSelf: 'center', backgroundColor: '#0009', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  emptyBanner: { position: 'absolute', top: 12, alignSelf: 'center', backgroundColor: '#0009', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  loadingText: { color: '#fff', fontSize: 12 },
});