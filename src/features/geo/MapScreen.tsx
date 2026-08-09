import React, { useCallback, useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { apiClient } from '@/services/api/client';

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

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.get<MemberLocation[]>(`/api/v1/geo/trips/${tripId}/locations`);
      setLocations(result);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  return (
    <SafeAreaView style={styles.container}>
      <MapView style={StyleSheet.absoluteFill}>
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
  loadingText: { color: '#fff', fontSize: 12 },
});
