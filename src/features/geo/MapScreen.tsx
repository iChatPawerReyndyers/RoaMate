import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import Mapbox, { Camera, MapView, PointAnnotation, Callout } from '@rnmapbox/maps';
import Geolocation from '@react-native-community/geolocation';
import { apiClient } from '@/services/api/client';
import { requestLocationPermission } from '@/services/location/requestLocationPermission';
import OfflineMapControl from './OfflineMapControl';

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

// Mapbox coordinates are [longitude, latitude] - the opposite order of the
// {lat, lng} shape this app's API responses use everywhere else. Centered
// on the Philippines as a reasonable fallback until real member locations
// arrive and the camera reframes to them instead.
const DEFAULT_CENTER: [number, number] = [121.774, 12.8797];

/**
 * GEO-01..04: opening this screen triggers the server to fan out a silent
 * push to every other member (see SilentPushService.java); each response
 * (or 5s timeout -> last-known-cache fallback) lands here as a marker with
 * a staleness indicator rather than blocking the whole map on one slow
 * device.
 *
 * Offline tile caching (ITIN/GEO spec: 500MB cap) is handled by
 * OfflineMapControl + services/maps/OfflineMapManager, layered on top as a
 * download-this-trip's-region control rather than baked into this screen's
 * own fetch logic.
 */
export default function MapScreen({ tripId }: Props) {
  const [locations, setLocations] = useState<MemberLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<Camera>(null);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<MemberLocation[]>(`/api/v1/geo/trips/${tripId}/locations`);
      setLocations(result);

      if (result.length > 0) {
        const lats = result.map(l => l.lat);
        const lngs = result.map(l => l.lng);
        const pad = 0.02;
        cameraRef.current?.fitBounds(
          [Math.max(...lngs) + pad, Math.max(...lats) + pad],
          [Math.min(...lngs) - pad, Math.min(...lats) - pad],
          80,
          500,
        );
      }
    } catch (err) {
      // Previously uncaught here - any failure (expired session, offline,
      // server error) became an unhandled promise rejection since this
      // runs fire-and-forget from a useEffect below, which crashes the
      // whole app with a red-box rather than just this screen misbehaving.
      console.warn('Failed to fetch member locations', err);
      setError("Couldn't load member locations. Pull to refresh to try again.");
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
          cameraRef.current?.flyTo([pos.coords.longitude, pos.coords.latitude], 500);
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
      <MapView style={StyleSheet.absoluteFill} styleURL={Mapbox.StyleURL.Outdoors}>
        <Camera ref={cameraRef} defaultSettings={{ centerCoordinate: DEFAULT_CENTER, zoomLevel: 5 }} />
        {locations.map(loc => (
          <PointAnnotation key={loc.userId} id={loc.userId} coordinate={[loc.lng, loc.lat]}>
            <View style={[styles.pin, loc.stale && styles.pinStale]} />
            <Callout title={`${loc.userId}${loc.stale ? ` · Updated ${timeAgo(loc.capturedAt)}` : ' · Live'}`} />
          </PointAnnotation>
        ))}
      </MapView>
      {loading && (
        <View style={styles.loadingBanner}>
          <Text style={styles.loadingText}>Requesting locations…</Text>
        </View>
      )}
      {!loading && locations.length === 0 && !error && (
        <View style={styles.emptyBanner}>
          <Text style={styles.loadingText}>No member locations shared yet.</Text>
        </View>
      )}
      {error && (
        <View style={styles.emptyBanner}>
          <Text style={styles.loadingText}>{error}</Text>
        </View>
      )}
      <OfflineMapControl tripId={tripId} coordinates={locations.map(l => ({ lat: l.lat, lng: l.lng }))} />
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
  pin: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#2f6fed', borderWidth: 2, borderColor: '#fff' },
  pinStale: { backgroundColor: '#999' },
  loadingBanner: { position: 'absolute', top: 12, alignSelf: 'center', backgroundColor: '#0009', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  emptyBanner: { position: 'absolute', top: 12, alignSelf: 'center', backgroundColor: '#0009', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  loadingText: { color: '#fff', fontSize: 12 },
});
