import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Map, Camera, ViewAnnotation } from '@maplibre/maplibre-react-native';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import type { PressEvent } from '@maplibre/maplibre-react-native';
import Geolocation from '@react-native-community/geolocation';
import { apiClient } from '@/services/api/client';
import { requestLocationPermission } from '@/services/location/requestLocationPermission';
import { MAP_STYLE_URL, MAPTILER_API_KEY } from '@/config/mapTiles';
import OfflineMapControl from './OfflineMapControl';
import type { DestinationPriority } from '@/features/itinerary/ItineraryScreen';

const PRIORITY_OPTIONS: { key: DestinationPriority; label: string }[] = [
  { key: 'REQUIRED', label: 'Required' },
  { key: 'OPTIONAL', label: 'Optional' },
  { key: 'TENTATIVE', label: 'Tentative' },
];

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

  // ITIN-04: place search, backed by MapTiler's geocoding API (same free-tier
  // key already used for map tiles in mapTiles.ts, so no separate account or
  // key is needed). Selecting a result drops a pin exactly like tapping the
  // map does, reusing the same draftPin/confirm-card flow below.
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; placeName: string; lat: number; lng: number }[]>([]);
  const [searching, setSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ITIN-04: pin-drop mode for saving a location to the itinerary. Tapping
  // the map while active drops a draft marker; the confirm card underneath
  // it names it and posts it as a destination (see pinDraftToItinerary).
  const [pinModeActive, setPinModeActive] = useState(false);
  const [draftPin, setDraftPin] = useState<{ lat: number; lng: number } | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftPriority, setDraftPriority] = useState<DestinationPriority>('REQUIRED');
  const [savingPin, setSavingPin] = useState(false);
  const [pinSavedMessage, setPinSavedMessage] = useState<string | null>(null);

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

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    const query = searchQuery.trim();
    if (query.length < 3) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${MAPTILER_API_KEY}&limit=5`,
        );
        if (!response.ok) throw new Error(`Geocoding request failed (${response.status})`);
        const data = await response.json();
        const results = (data.features ?? []).map((feature: any) => ({
          id: feature.id,
          name: feature.text,
          placeName: feature.place_name,
          lng: feature.center[0],
          lat: feature.center[1],
        }));
        setSearchResults(results);
      } catch (err) {
        console.warn('Place search failed', err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  const handleSelectSearchResult = (result: { name: string; lat: number; lng: number }) => {
    setDraftPin({ lat: result.lat, lng: result.lng });
    setDraftName(result.name);
    setDraftPriority('REQUIRED');
    setPinSavedMessage(null);
    setSearchQuery('');
    setSearchResults([]);
    cameraRef.current?.flyTo({ center: [result.lng, result.lat], zoom: 14, duration: 800 });
  };

  const handleMapPress = (event: { nativeEvent: PressEvent }) => {
    if (!pinModeActive) return;
    const [lng, lat] = event.nativeEvent.lngLat;
    setDraftPin({ lat, lng });
    setDraftName('');
    setDraftPriority('REQUIRED');
    setPinSavedMessage(null);
  };

  /**
   * ITIN-04: saves the dropped pin as a destination via the flat lat/lng
   * shape (PinDestinationRequest.java) - it then shows up automatically in
   * the Itinerary tab's list, which reads from the same
   * /destinations endpoint.
   */
  const pinDraftToItinerary = async () => {
    if (!draftPin || !draftName.trim()) return;
    setSavingPin(true);
    try {
      await apiClient.post('/api/v1/itinerary/destinations', {
        tripId,
        name: draftName.trim(),
        lat: draftPin.lat,
        lng: draftPin.lng,
        priority: draftPriority,
      });
      setPinSavedMessage(`Saved "${draftName.trim()}" to the itinerary.`);
      setDraftPin(null);
      setDraftName('');
    } catch (err) {
      console.warn('Failed to save pinned location', err);
      setPinSavedMessage("Couldn't save that pin. Check your connection and try again.");
    } finally {
      setSavingPin(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/*
        androidView="texture": MapLibre's Android default is GLSurfaceView,
        which Android composites at the OS window layer ("punches a hole"
        in the window) rather than through the normal view hierarchy - so
        it draws over every sibling RN view regardless of JSX order,
        hiding the search bar, pin-mode button, and banners below no
        matter how they're positioned. TextureView composites like a
        normal view and respects sibling stacking order. iOS is
        unaffected either way (this prop is Android-only).
      */}
      <Map style={StyleSheet.absoluteFill} mapStyle={MAP_STYLE_URL} onPress={handleMapPress} androidView="texture">
        <Camera ref={cameraRef} initialViewState={{ center: DEFAULT_CENTER, zoom: 5 }} />
        {draftPin ? (
          <ViewAnnotation key="draft-pin" id="draft-pin" lngLat={[draftPin.lng, draftPin.lat]}>
            <View style={styles.markerWrap}>
              <View style={[styles.pin, styles.pinDraft]} />
            </View>
          </ViewAnnotation>
        ) : null}
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

      <View style={styles.searchBar}>
        <View style={styles.searchRow}>
          <View style={styles.searchInputRow}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search a place or address"
              placeholderTextColor="#999"
              returnKeyType="search"
            />
            {searching ? <ActivityIndicator size="small" color="#2f6fed" /> : null}
            {searchQuery.length > 0 && !searching ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={styles.searchClear}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            style={[styles.pinModeButton, pinModeActive && styles.pinModeButtonActive]}
            onPress={() => {
              setPinModeActive(prev => !prev);
              setDraftPin(null);
              setPinSavedMessage(null);
            }}
          >
            <Text style={[styles.pinModeButtonIcon, pinModeActive && styles.pinModeButtonIconActive]}>
              {pinModeActive ? '✕' : '📍'}
            </Text>
          </TouchableOpacity>
        </View>
        {searchResults.length > 0 ? (
          <View style={styles.searchResults}>
            {searchResults.map(result => (
              <TouchableOpacity
                key={result.id}
                style={styles.searchResultRow}
                onPress={() => handleSelectSearchResult(result)}
              >
                <Text style={styles.searchResultName} numberOfLines={1}>
                  {result.name}
                </Text>
                <Text style={styles.searchResultSubtitle} numberOfLines={1}>
                  {result.placeName}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>

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

      {pinModeActive && !draftPin ? (
        <View style={styles.pinHintBanner}>
          <Text style={styles.pinHintText}>Tap anywhere on the map to drop a pin.</Text>
        </View>
      ) : null}

      {draftPin ? (
        <View style={styles.draftCard}>
          <Text style={styles.draftLabel}>New pinned location</Text>
          <Text style={styles.draftCoordinates}>
            {draftPin.lat.toFixed(4)}° N, {draftPin.lng.toFixed(4)}° E
          </Text>
          <TextInput
            style={styles.draftInput}
            value={draftName}
            onChangeText={setDraftName}
            placeholder="Name this location"
            autoFocus
          />
          <View style={styles.draftPriorityRow}>
            {PRIORITY_OPTIONS.map(option => {
              const selected = draftPriority === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.draftPriorityOption, selected && styles.draftPriorityOptionSelected]}
                  onPress={() => setDraftPriority(option.key)}
                >
                  <Text style={[styles.draftPriorityText, selected && styles.draftPriorityTextSelected]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.draftActions}>
            <TouchableOpacity style={styles.draftCancelButton} onPress={() => setDraftPin(null)}>
              <Text style={styles.draftCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.draftSaveButton, !draftName.trim() && styles.draftSaveButtonDisabled]}
              onPress={pinDraftToItinerary}
              disabled={!draftName.trim() || savingPin}
            >
              {savingPin ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.draftSaveButtonText}>Save to itinerary</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {pinSavedMessage ? (
        <View style={styles.pinSavedBanner}>
          <Text style={styles.pinSavedText}>{pinSavedMessage}</Text>
        </View>
      ) : null}
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
  pinDraft: { backgroundColor: '#e0212b' },
  markerLabel: { marginTop: 4, maxWidth: 140, fontSize: 11, color: '#fff', backgroundColor: '#0009', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  loadingBanner: { position: 'absolute', top: 108, alignSelf: 'center', backgroundColor: '#0009', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  emptyBanner: { position: 'absolute', top: 108, alignSelf: 'center', backgroundColor: '#0009', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  loadingText: { color: '#fff', fontSize: 12 },
  searchBar: { position: 'absolute', top: 12, left: 12, right: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInputRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 14, color: '#222', padding: 0 },
  searchClear: { fontSize: 14, color: '#999', paddingHorizontal: 4 },
  searchResults: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginTop: 6,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    overflow: 'hidden',
  },
  searchResultRow: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  searchResultName: { fontSize: 13, fontWeight: '600', color: '#222' },
  searchResultSubtitle: { fontSize: 11, color: '#888', marginTop: 1 },
  pinModeButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  pinModeButtonActive: { backgroundColor: '#e0212b' },
  pinModeButtonIcon: { fontSize: 18 },
  pinModeButtonIconActive: { color: '#fff' },
  pinHintBanner: { position: 'absolute', top: 108, alignSelf: 'center', backgroundColor: '#0009', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  pinHintText: { color: '#fff', fontSize: 12 },
  draftCard: { position: 'absolute', left: 12, right: 12, bottom: 84, backgroundColor: '#fff', borderRadius: 14, padding: 14, elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  draftLabel: { fontSize: 13, fontWeight: '700' },
  draftCoordinates: { fontSize: 11, color: '#888', marginTop: 2, marginBottom: 8 },
  draftInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 14 },
  draftPriorityRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  draftPriorityOption: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  draftPriorityOptionSelected: { backgroundColor: '#2f6fed', borderColor: '#2f6fed' },
  draftPriorityText: { fontSize: 11, fontWeight: '600', color: '#555' },
  draftPriorityTextSelected: { color: '#fff' },
  draftActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  draftCancelButton: { flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: '#ddd' },
  draftCancelButtonText: { fontSize: 13, fontWeight: '700', color: '#666' },
  draftSaveButton: { flex: 2, backgroundColor: '#2f6fed', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  draftSaveButtonDisabled: { backgroundColor: '#9fb8ef' },
  draftSaveButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  pinSavedBanner: { position: 'absolute', bottom: 20, alignSelf: 'center', backgroundColor: '#1e7e34', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, maxWidth: '85%' },
  pinSavedText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});