import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Map, Camera, ViewAnnotation } from '@maplibre/maplibre-react-native';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import Geolocation from '@react-native-community/geolocation';
import { apiClient } from '@/services/api/client';
import { requestLocationPermission } from '@/services/location/requestLocationPermission';
import { MAP_STYLE_URL } from '@/config/mapTiles';
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

// Map coordinates are [longitude, latitude] - the opposite order of the
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
 *
 * Renders with MapLibre + MapTiler tiles (see src/config/mapTiles.ts)
 * rather than Mapbox - no account/corporate email needed, MapLibre's API
 * is a near-1:1 fork of what this screen used to call.
 */
export default function MapScreen({ tripId }: Props) {
  const [locations, setLocations] = useState<MemberLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<CameraRef>(null);

  /**
   * Defensive re-apply of the default center shortly after mount.
   * initialViewState (see <Camera> below) is supposed to cover this on
   * mount, but on-device testing showed the camera landing on an
   * unrelated default position instead. Rather than guess at an event
   * prop name for "style finished loading" that I couldn't confirm
   * exists on this component in this SDK version, this uses flyTo -
   * already confirmed elsewhere in this file to exist with this exact
   * {center, duration} shape - fired on a short delay after mount as a
   * pragmatic, verified-API-only fallback. duration: 0 makes it an
   * instant jump, not a visible animated flight, so it just looks like
   * the map opening in the right place.
   */
  useEffect(() => {
    const timeout = setTimeout(() => {
      cameraRef.current?.flyTo({ center: DEFAULT_CENTER, duration: 0 });
    }, 300);
    return () => clearTimeout(timeout);
  }, []);

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
          [Math.min(...lngs) - pad, Math.min(...lats) - pad, Math.max(...lngs) + pad, Math.max(...lats) + pad],
          { padding: { top: 80, right: 80, bottom: 80, left: 80 }, duration: 500 },
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
          cameraRef.current?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], duration: 500 });
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
      <Map style={StyleSheet.absoluteFill} mapStyle={MAP_STYLE_URL}>
        <Camera ref={cameraRef} initialViewState={{ center: DEFAULT_CENTER, zoom: 5 }} />
        {locations.map(loc => (
          <ViewAnnotation key={loc.userId} id={loc.userId} lngLat={[loc.lng, loc.lat]}>
            <View style={styles.markerWrap}>
              <View style={[styles.pin, loc.stale && styles.pinStale]} />
              <Text style={styles.markerLabel} numberOfLines={1}>
                {loc.userId}
                {loc.stale ? ` · ${timeAgo(loc.capturedAt)}` : ' · Live'}
              </Text>
            </View>
          </ViewAnnotation>
        ))}
      </Map>
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
  markerWrap: { alignItems: 'center' },
  pin: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#2f6fed', borderWidth: 2, borderColor: '#fff' },
  pinStale: { backgroundColor: '#999' },
  markerLabel: { marginTop: 4, maxWidth: 140, fontSize: 11, color: '#fff', backgroundColor: '#0009', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  loadingBanner: { position: 'absolute', top: 12, alignSelf: 'center', backgroundColor: '#0009', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  emptyBanner: { position: 'absolute', top: 12, alignSelf: 'center', backgroundColor: '#0009', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  loadingText: { color: '#fff', fontSize: 12 },
});