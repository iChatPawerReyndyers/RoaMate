import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, Text, TextInput, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Map, Camera, ViewAnnotation, GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { CameraRef } from '@maplibre/maplibre-react-native';
import type { PressEvent } from '@maplibre/maplibre-react-native';
import { apiClient } from '@/services/api/client';
import { MAP_STYLE_URL, MAPTILER_API_KEY } from '@/config/mapTiles';
import OfflineMapControl from './OfflineMapControl';
import type { Destination, DestinationPriority } from '@/features/itinerary/ItineraryScreen';
import NeumorphicView from '@/components/neumorphic/NeumorphicView';
import { neuColors, neuRadii } from '@/theme/neumorphic';

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
  /**
   * Set by ItineraryHubScreen when the user taps "Edit" on a destination
   * in the Itinerary tab - editing now happens here instead of a separate
   * full-screen form, since a quick edit only needs Name + Priority. Once
   * consumed (camera flown to it, edit card opened), this screen calls
   * onEditHandled so the hub can clear it - otherwise switching away and
   * back to this tab would immediately reopen the same edit card.
   */
  editDestinationId?: string | null;
  onEditHandled?: () => void;
}

// Map coordinates are [longitude, latitude] - the opposite order of the
// {lat, lng} shape this app's API responses use everywhere else.
const DEFAULT_CENTER: [number, number] = [121.774, 12.8797];

/**
 * [west, south, east, north] - covers the Philippines end to end (Batanes
 * in the north down to Tawi-Tawi in the south). Used as the true fallback
 * view whenever there's nothing else to frame the camera to (no live
 * member locations, no pinned itinerary destinations): fitBounds to this
 * rather than a fixed center+zoom, since a single hardcoded zoom level
 * doesn't reliably show "the whole country" across different device
 * screen sizes and aspect ratios the way fitting to an actual bounding
 * box does.
 */
const PHILIPPINES_BOUNDS: [number, number, number, number] = [116.9, 4.6, 126.6, 21.1];

/**
 * GEO-01..04: opening this screen triggers the server to fan out a silent
 * push to every other member (see SilentPushService.java); each response
 * (or 5s timeout -> last-known-cache fallback) lands here as a marker with
 * a staleness indicator rather than blocking the whole map on one slow
 * device.
 *
 * ITIN-04: every destination pinned on the Itinerary tab also renders here
 * as its own marker (see fetchDestinations/destinationPinStyle below),
 * color-coded by priority the same way the priority picker on
 * DestinationFormScreen is - REQUIRED navy blue, OPTIONAL medium gray,
 * TENTATIVE muted purple. A real, road-following route connects them in
 * the same order the Itinerary tab lists them in (1st->2nd, 2nd->3rd, ...
 * - see fetchRouteSegment/routeSegments), each labeled with its estimated
 * travel time and distance. Routed via OSRM's public demo server, not
 * MapTiler (see the long comment on OSRM_ROUTE_URL for why) - any segment
 * that fails to route falls back to a straight line with a rough
 * haversine-based estimate instead, shown dashed and marked "(est.)" so
 * it's clear that one segment didn't get a real route. Refetched every time this screen gains
 * focus, not just on mount, since the Itinerary tab is a sibling tab
 * under the same TripTabs navigator rather than a separate stack -
 * switching tabs doesn't unmount either screen, so a stop added or
 * reordered on the Itinerary tab needs this screen's own refetch to
 * actually show up here. The camera also auto-frames to fit every pinned
 * destination with coordinates (see the effect right after
 * fetchDestinations) - deferring to member locations' own framing if any
 * are currently live, since that's this screen's primary purpose and
 * destinations are a secondary overlay.
 *
 * Offline tile caching (ITIN/GEO spec: 500MB cap) is handled by
 * OfflineMapControl + services/maps/OfflineMapManager, layered on top as a
 * download-this-trip's-region control rather than baked into this screen's
 * own fetch logic.
 *
 * Renders with MapLibre + MapTiler tiles (see src/config/mapTiles.ts)
 * rather than Mapbox - no account/corporate email needed, MapLibre's API
 * is a near-1:1 fork of what this screen used to call.
 *
 * Visual note: the map tiles and pin markers stay as-is - only the
 * RoaMate-drawn chrome floating on top (search bar, pin-mode button,
 * draft-pin card) picks up the app's neumorphic surface, so it reads as
 * part of the same app rather than a generic maps SDK overlay.
 */
export default function MapScreen({ tripId, editDestinationId, onEditHandled }: Props) {
  const [locations, setLocations] = useState<MemberLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<CameraRef>(null);

  // ITIN-04 (map side): every destination pinned on the Itinerary tab shows
  // up here too, as its own marker - see fetchDestinations below and the
  // markers rendered inside <Map>. Refetched on every focus (not just
  // mount), since this screen and the Itinerary tab are separate mounted
  // tabs under TripTabs rather than separate navigator stacks - switching
  // tabs doesn't remount either one, so a mount-only fetch here would go
  // stale the moment someone adds/edits a stop from the Itinerary tab and
  // switches back without a full app reload.
  const [destinations, setDestinations] = useState<Destination[]>([]);

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
  // Set when the draft card above represents an EXISTING destination being
  // quick-edited (Name + Priority only, position unchanged) rather than a
  // brand-new pin being dropped - drives both the card's title/button
  // wording and whether saving updates that id or creates a new one.
  const [editingDestinationId, setEditingDestinationId] = useState<string | null>(null);
  const [pinSavedMessage, setPinSavedMessage] = useState<string | null>(null);

  /**
   * Coordinates this screen's several independent camera-movers so they
   * don't fight each other. Set to true the moment ANY of member-location
   * fitBounds or itinerary-destination fitBounds/flyTo actually moves the
   * camera somewhere meaningful. The Philippines-fallback effect checks
   * this before firing and backs off if it's already true - without this,
   * the destination-fit effect below could successfully frame the
   * itinerary pins on screen, only for the Philippines fallback to fire
   * moments later and snap the camera back out to the whole-country view,
   * undoing it. The itinerary-destination effect itself does NOT check
   * this ref before firing - it always wins and re-frames whenever the
   * destination list changes, since showing the itinerary is meant to
   * take priority the moment there's one to show.
   */
  const hasFramedCameraRef = useRef(false);

  /**
   * Set by <Map>'s onDidFinishLoadingStyle callback (a real, confirmed
   * prop on this component - see MapProps in the library's own source).
   * All the fitBounds/flyTo calls in this screen are imperative commands
   * to the native map view, and calling them before the underlying map
   * has actually finished loading its style is a well-documented footgun
   * with MapLibre/Mapbox-based wrappers: the native side silently drops
   * the command instead of queuing it, so "zoom to X" just doesn't happen
   * with no error anywhere. This was previously worked around with a bare
   * 300ms setTimeout - fine when a real device-location GPS lookup was
   * also in the mix (slow enough that the map had usually finished
   * loading by the time anything tried to move the camera), but once the
   * destinations-fit effect started firing near-instantly (mock data
   * resolves in milliseconds), it could easily race ahead of the map
   * actually being ready, and silently do nothing. Gating on the real
   * "is it ready" signal instead of guessing a delay fixes that for good,
   * regardless of how fast or slow the data happens to load.
   */
  const [mapReady, setMapReady] = useState(false);

  /**
   * True fallback view: the whole Philippines, whenever there's nothing
   * more specific to show (no live member locations, no pinned itinerary
   * destinations - see hasFramedCameraRef). Waits for mapReady rather
   * than firing on a timer, then gives destinations/locations a brief
   * head start (300ms) in case they're already in flight, before
   * defaulting to the whole-country view. duration: 0 makes it an
   * instant jump, not a visible animated flight, so it just looks like
   * the map opening in the right place.
   */
  useEffect(() => {
    if (!mapReady) return;
    const timeout = setTimeout(() => {
      if (hasFramedCameraRef.current) return;
      cameraRef.current?.fitBounds(PHILIPPINES_BOUNDS, { padding: { top: 40, right: 40, bottom: 40, left: 40 }, duration: 0 });
    }, 300);
    return () => clearTimeout(timeout);
  }, [mapReady]);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<MemberLocation[]>(`/api/v1/geo/trips/${tripId}/locations`);
      setLocations(result);
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

  /**
   * Frames the camera to fit every live member location - the highest
   * camera priority on this screen (see hasFramedCameraRef). Split out
   * from fetchLocations itself into its own effect, reactive to
   * [locations, mapReady], for the same reason the destinations fit is:
   * the fetch can resolve before the native map has finished loading its
   * style, and an imperative fitBounds call made at that point is
   * silently dropped rather than queued (see mapReady's own comment).
   * This way the fit reliably (re-)fires once both are true, regardless
   * of which one happens to resolve first.
   */
  useEffect(() => {
    if (!mapReady || locations.length === 0) return;
    const lats = locations.map(l => l.lat);
    const lngs = locations.map(l => l.lng);
    const pad = 0.02;
    cameraRef.current?.fitBounds(
      [Math.min(...lngs) - pad, Math.min(...lats) - pad, Math.max(...lngs) + pad, Math.max(...lats) + pad],
      { padding: { top: 80, right: 80, bottom: 80, left: 80 }, duration: 500 },
    );
    hasFramedCameraRef.current = true;
  }, [locations, mapReady]);

  const fetchDestinations = useCallback(async () => {
    try {
      const result = await apiClient.get<Destination[]>(`/api/v1/itinerary/trips/${tripId}/destinations`);
      setDestinations(result);
    } catch (err) {
      // Destination pins are a secondary overlay on this screen (member
      // locations are the main point) - fail quietly here rather than
      // stacking a second error banner on top of fetchLocations' own.
      console.warn('Failed to load itinerary destinations for map pins', err);
    }
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      fetchDestinations();
    }, [fetchDestinations]),
  );

  /**
   * Frames the camera to fit every pinned destination with coordinates.
   * Deliberately skipped whenever there are live member locations
   * (locations.length > 0) - fetchLocations above already frames the
   * camera to those, and that framing takes priority: this screen's main
   * purpose is showing where people are right now, with itinerary pins as
   * a secondary overlay (see fetchDestinations' own comment). Auto-fitting
   * to destinations too would mean two effects fighting over the same
   * camera depending purely on which network response happened to land
   * last - confusing and non-deterministic. This only ever fires as a
   * fallback framing for when there's nothing else driving the camera yet.
   *
   * A single destination has no "bounds" to fit (min === max on both
   * axes), so that case just flies to it directly at a reasonable zoom
   * instead of calling fitBounds with a zero-size box.
   */
  useEffect(() => {
    if (!mapReady) return;
    if (locations.length > 0) return;

    const withCoords = destinations.filter(
      (d): d is Destination & { lat: number; lng: number } => d.lat !== undefined && d.lng !== undefined,
    );
    if (withCoords.length === 0) return;

    if (withCoords.length === 1) {
      const only = withCoords[0];
      if (only) {
        cameraRef.current?.flyTo({ center: [only.lng, only.lat], zoom: 14, duration: 500 });
        hasFramedCameraRef.current = true;
      }
      return;
    }

    const lats = withCoords.map(d => d.lat);
    const lngs = withCoords.map(d => d.lng);
    const pad = 0.02;
    cameraRef.current?.fitBounds(
      [Math.min(...lngs) - pad, Math.min(...lats) - pad, Math.max(...lngs) + pad, Math.max(...lats) + pad],
      { padding: { top: 80, right: 80, bottom: 80, left: 80 }, duration: 500 },
    );
    hasFramedCameraRef.current = true;
  }, [destinations, locations.length, mapReady]);

  const [routeSegments, setRouteSegments] = useState<RouteSegment[]>([]);

  /**
   * One real road-following route per consecutive pair of ordered
   * destinations (1st->2nd, 2nd->3rd, ...), via OSRM's public routing
   * demo server - not MapTiler, whose own Directions API is beta-only and
   * needs separate account enrollment (see the comment on OSRM_ROUTE_URL
   * below for the full reasoning and its real limitations). Segments are
   * appended to state as each fetch resolves, one at a time, rather than
   * all at once at the end - with several stops this can take a few
   * seconds total, and showing the first segment the moment it's ready
   * reads as "loading in," not "frozen."
   *
   * If a given segment's request fails (network hiccup, or the demo
   * server's explicit "no uptime guarantee"), that one segment falls back
   * to a straight line with a haversine-estimated time/distance instead
   * of silently showing nothing - see fetchRouteSegment.
   */
  useEffect(() => {
    let cancelled = false;
    setRouteSegments([]);

    const withCoords = destinations.filter(
      (d): d is Destination & { lat: number; lng: number } => d.lat !== undefined && d.lng !== undefined,
    );

    (async () => {
      for (let i = 0; i < withCoords.length - 1; i++) {
        if (cancelled) return;
        const from = withCoords[i];
        const to = withCoords[i + 1];
        if (!from || !to) continue;

        const segment = await fetchRouteSegment(from, to);
        if (cancelled) return;
        setRouteSegments(prev => [...prev, segment]);

        // OSRM's demo server asks for no more than 1 request/second - a
        // small pause between calls keeps a multi-stop itinerary well
        // under that even accounting for fast network round-trips.
        if (i < withCoords.length - 2) {
          await new Promise<void>(resolve => setTimeout(resolve, 350));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [destinations]);

  /**
   * Consumes an edit request from ItineraryHubScreen (see that file):
   * finds the target destination once `destinations` has loaded, flies
   * the camera to it, and opens the same draft-pin card used for dropping
   * a new pin - pre-filled with its current Name/Priority, with
   * editingDestinationId set so pinDraftToItinerary knows to update this
   * destination rather than create a new one. Waits on `destinations`
   * (not just `editDestinationId`) since the target might not be loaded
   * yet the instant this screen mounts/becomes focused.
   */
  useEffect(() => {
    if (!editDestinationId) return;
    const target = destinations.find(d => d.id === editDestinationId);
    if (!target || target.lat === undefined || target.lng === undefined) return;

    setEditingDestinationId(target.id);
    setDraftPin({ lat: target.lat, lng: target.lng });
    setDraftName(target.name);
    setDraftPriority(target.priority ?? 'REQUIRED');
    setPinSavedMessage(null);
    cameraRef.current?.flyTo({ center: [target.lng, target.lat], zoom: 15, duration: 600 });
    onEditHandled?.();
  }, [editDestinationId, destinations, onEditHandled]);

  // Device's-own-location centering was here previously (best-effort,
  // lowest-priority fallback) but was removed per explicit direction: the
  // fallback view when there's nothing else to show should always be the
  // whole Philippines (see PHILIPPINES_BOUNDS and the defensive-reset
  // effect above), not wherever the viewer's own device happens to be.
  // Member locations and itinerary destinations remain the two things
  // that DO override the Philippines default - see hasFramedCameraRef.

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
        ...(editingDestinationId ? { id: editingDestinationId } : {}),
        tripId,
        name: draftName.trim(),
        lat: draftPin.lat,
        lng: draftPin.lng,
        priority: draftPriority,
      });
      setPinSavedMessage(
        editingDestinationId ? `Updated "${draftName.trim()}".` : `Saved "${draftName.trim()}" to the itinerary.`,
      );
      setDraftPin(null);
      setDraftName('');
      setEditingDestinationId(null);
      fetchDestinations();
    } catch (err) {
      console.warn('Failed to save pinned location', err);
      setPinSavedMessage("Couldn't save that pin. Check your connection and try again.");
    } finally {
      setSavingPin(false);
    }
  };

  return (
    <View style={styles.container}>
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
      {/*
        attributionPosition: OfflineMapControl now sits bottom-left (see
        that file), which is also MapLibre's default spot for the
        required "MapLibre/OpenStreetMap" attribution text. That
        attribution has to stay visible and uncovered per MapTiler/OSM's
        terms - most SDKs enforce this regardless - so it's moved to
        bottom-right instead of letting the two fight over the same
        corner.
      */}
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={MAP_STYLE_URL}
        onPress={handleMapPress}
        androidView="texture"
        attributionPosition={{ bottom: 6, right: 6 }}
        onDidFinishLoadingStyle={() => setMapReady(true)}
      >
        <Camera ref={cameraRef} initialViewState={{ center: DEFAULT_CENTER, zoom: 5 }} />
        {routeSegments.map((segment, index) => (
          <React.Fragment key={`route-${segment.fromId}-${segment.toId}`}>
            <GeoJSONSource
              id={`itinerary-route-source-${index}`}
              data={{ type: 'Feature', properties: {}, geometry: segment.geometry }}
            >
              <Layer
                id={`itinerary-route-line-${index}`}
                type="line"
                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                paint={
                  segment.isEstimate
                    ? { 'line-color': '#8891A5', 'line-width': 2.5, 'line-dasharray': [2, 2] }
                    : { 'line-color': '#8891A5', 'line-width': 3.5 }
                }
              />
            </GeoJSONSource>
            <ViewAnnotation
              id={`itinerary-route-label-${index}`}
              lngLat={segment.midpoint}
            >
              <View style={styles.routeLabelWrap}>
                <Text style={styles.routeLabelText}>
                  {formatDuration(segment.durationSeconds)} · {formatDistanceKm(segment.distanceMeters)}
                  {segment.isEstimate ? ' (est.)' : ''}
                </Text>
              </View>
            </ViewAnnotation>
          </React.Fragment>
        ))}
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
        {destinations
          .filter((d): d is Destination & { lat: number; lng: number } => d.lat !== undefined && d.lng !== undefined)
          .map(d => (
            <ViewAnnotation key={`destination-${d.id}`} id={`destination-${d.id}`} lngLat={[d.lng, d.lat]}>
              <TouchableOpacity
                onPress={() => cameraRef.current?.flyTo({ center: [d.lng, d.lat], zoom: 15, duration: 500 })}
              >
                <View style={styles.markerWrap}>
                  <View style={destinationPinStyle(d.priority)} />
                  <Text style={styles.markerLabel} numberOfLines={1}>
                    {d.name}
                  </Text>
                </View>
              </TouchableOpacity>
            </ViewAnnotation>
          ))}
      </Map>

      <View style={styles.searchBar}>
        <View style={styles.searchRow}>
          <NeumorphicView variant="raised" radius={neuRadii.lg} style={styles.searchInputRow}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search a place or address"
              placeholderTextColor={neuColors.textMuted}
              returnKeyType="search"
            />
            {searching ? <ActivityIndicator size="small" color={neuColors.accent} /> : null}
            {searchQuery.length > 0 && !searching ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={styles.searchClear}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </NeumorphicView>
          <TouchableOpacity
            onPress={() => {
              setPinModeActive(prev => !prev);
              setDraftPin(null);
              setPinSavedMessage(null);
            }}
          >
            <NeumorphicView
              variant="raised"
              radius={neuRadii.lg}
              backgroundColor={pinModeActive ? neuColors.danger : neuColors.background}
              style={styles.pinModeButton}
            >
              <Text style={[styles.pinModeButtonIcon, pinModeActive && styles.pinModeButtonIconActive]}>
                {pinModeActive ? '✕' : '📍'}
              </Text>
            </NeumorphicView>
          </TouchableOpacity>
        </View>
        {searchResults.length > 0 ? (
          <NeumorphicView variant="raised" radius={neuRadii.lg} style={styles.searchResults}>
            {searchResults.map((result, index) => (
              <TouchableOpacity
                key={result.id}
                style={[styles.searchResultRow, index > 0 && styles.searchResultRowDivider]}
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
          </NeumorphicView>
        ) : null}
      </View>

      {loading && (
        <View style={styles.loadingBanner}>
          <Text style={styles.bannerText}>Requesting locations…</Text>
        </View>
      )}
      {!loading && locations.length === 0 && !error && (
        <View style={styles.emptyBanner}>
          <Text style={styles.bannerText}>No member locations shared yet.</Text>
        </View>
      )}
      {error && (
        <View style={styles.emptyBanner}>
          <Text style={styles.bannerText}>{error}</Text>
        </View>
      )}
      <OfflineMapControl tripId={tripId} coordinates={locations.map(l => ({ lat: l.lat, lng: l.lng }))} />

      {pinModeActive && !draftPin ? (
        <View style={styles.pinHintBanner}>
          <Text style={styles.bannerText}>Tap anywhere on the map to drop a pin.</Text>
        </View>
      ) : null}

      {draftPin ? (
        <NeumorphicView variant="raised" radius={neuRadii.lg} style={styles.draftCard}>
          <Text style={styles.draftLabel}>{editingDestinationId ? 'Edit destination' : 'New pinned location'}</Text>
          <Text style={styles.draftCoordinates}>
            {draftPin.lat.toFixed(4)}° N, {draftPin.lng.toFixed(4)}° E
          </Text>
          <NeumorphicView variant="inset" radius={neuRadii.md} style={styles.draftInputWrap}>
            <TextInput
              style={styles.draftInput}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Name this location"
              placeholderTextColor={neuColors.textMuted}
              autoFocus
            />
          </NeumorphicView>
          <View style={styles.draftPriorityRow}>
            {PRIORITY_OPTIONS.map(option => {
              const selected = draftPriority === option.key;
              return (
                <TouchableOpacity key={option.key} onPress={() => setDraftPriority(option.key)} style={styles.draftPriorityFlex}>
                  <NeumorphicView
                    variant={selected ? 'raised' : 'inset'}
                    radius={neuRadii.sm}
                    backgroundColor={selected ? neuColors.accent : neuColors.surfaceInset}
                    style={styles.draftPriorityOption}
                  >
                    <Text style={[styles.draftPriorityText, selected && styles.draftPriorityTextSelected]}>
                      {option.label}
                    </Text>
                  </NeumorphicView>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.draftActions}>
            <TouchableOpacity
              style={styles.draftCancelFlex}
              onPress={() => {
                setDraftPin(null);
                setEditingDestinationId(null);
              }}
            >
              <NeumorphicView variant="raised" radius={neuRadii.md} style={styles.draftCancelButton}>
                <Text style={styles.draftCancelButtonText}>Cancel</Text>
              </NeumorphicView>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.draftSaveFlex}
              onPress={pinDraftToItinerary}
              disabled={!draftName.trim() || savingPin}
            >
              <NeumorphicView
                variant="raised"
                radius={neuRadii.md}
                backgroundColor={!draftName.trim() ? neuColors.shadowDark : neuColors.accent}
                style={styles.draftSaveButton}
              >
                {savingPin ? (
                  <ActivityIndicator color={neuColors.white} size="small" />
                ) : (
                  <Text style={styles.draftSaveButtonText}>{editingDestinationId ? 'Save changes' : 'Save to itinerary'}</Text>
                )}
              </NeumorphicView>
            </TouchableOpacity>
          </View>
        </NeumorphicView>
      ) : null}

      {pinSavedMessage ? (
        <View style={styles.pinSavedBanner}>
          <Text style={styles.pinSavedText}>{pinSavedMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
}

interface RouteSegment {
  fromId: string;
  toId: string;
  geometry: GeoJSON.LineString;
  distanceMeters: number;
  durationSeconds: number;
  /** Midpoint along the route, used to place the time/distance label. */
  midpoint: [number, number];
  /** True when this is a straight-line/haversine fallback, not a real routed path (see fetchRouteSegment). */
  isEstimate: boolean;
}

/**
 * OSRM's public routing demo server (router.project-osrm.org), not
 * MapTiler - MapTiler's own Directions API is beta-only and needs
 * separate account enrollment
 * (https://www.maptiler.com/news/2026/07/a-new-approach-to-enterprise-routing-join-the-maptiler-beta/),
 * so it isn't a drop-in fit alongside the MAPTILER_API_KEY already used
 * for tiles/geocoding in this file. OSRM's demo server is free, doesn't
 * need an API key, and has a simple, stable, well-documented REST API -
 * but it's explicitly a community-run demo, not a production SLA: FOSSGIS
 * (who host it) ask for "reasonable, non-commercial use" and no more than
 * 1 request/second, and give no uptime or latency guarantees
 * (https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server). That's
 * why every call through this is wrapped to fail soft into a straight-
 * line/haversine estimate (see fetchRouteSegment) rather than assuming
 * it's always reachable. Before this app has real production traffic,
 * this should move to either a self-hosted OSRM instance or a paid
 * routing provider (MapTiler's Directions API once it's out of beta,
 * Mapbox Directions, etc.) - swapping OSRM_ROUTE_URL and the response
 * parsing in fetchRouteSegment is the only change that should need.
 */
const OSRM_ROUTE_URL = 'https://router.project-osrm.org/route/v1/driving';

/**
 * Fetches one real, road-following route between two points. Falls back
 * to a straight line with a haversine-distance-based time/distance
 * estimate on any failure (network error, non-2xx response, or an
 * unexpected response shape) - see the file-level comment on
 * OSRM_ROUTE_URL for why this demo server specifically needs a fallback
 * rather than being treated as always-available. The fallback still shows
 * *something* connecting consecutive stops rather than nothing, clearly
 * marked via isEstimate (see the dashed-vs-solid line style and the
 * "(est.)" suffix on the label where this is rendered).
 */
async function fetchRouteSegment(
  from: Destination & { lat: number; lng: number },
  to: Destination & { lat: number; lng: number },
): Promise<RouteSegment> {
  try {
    const url = `${OSRM_ROUTE_URL}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Routing request failed (${response.status})`);
    const data = await response.json();
    const route = data?.routes?.[0];
    const geometry = route?.geometry;
    if (!geometry || typeof route.distance !== 'number' || typeof route.duration !== 'number') {
      throw new Error('Unexpected routing response shape');
    }

    return {
      fromId: from.id,
      toId: to.id,
      geometry,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      midpoint: midpointOfCoordinates(geometry.coordinates),
      isEstimate: false,
    };
  } catch (err) {
    console.warn(`Failed to fetch road route from ${from.id} to ${to.id}, using straight-line estimate`, err);
    return buildEstimatedSegment(from, to);
  }
}

function midpointOfCoordinates(coordinates: number[][]): [number, number] {
  const mid = coordinates[Math.floor(coordinates.length / 2)];
  return mid ? [mid[0] ?? 0, mid[1] ?? 0] : [0, 0];
}

const EARTH_RADIUS_METERS = 6371000;
/** Rough average speed used only for the straight-line fallback's time estimate - not meant to be precise, just better than showing no estimate at all. */
const ESTIMATED_AVERAGE_SPEED_KMH = 30;

function haversineDistanceMeters(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildEstimatedSegment(
  from: Destination & { lat: number; lng: number },
  to: Destination & { lat: number; lng: number },
): RouteSegment {
  const distanceMeters = haversineDistanceMeters(from, to);
  const durationSeconds = (distanceMeters / 1000 / ESTIMATED_AVERAGE_SPEED_KMH) * 3600;
  return {
    fromId: from.id,
    toId: to.id,
    geometry: { type: 'LineString', coordinates: [[from.lng, from.lat], [to.lng, to.lat]] },
    distanceMeters,
    durationSeconds,
    midpoint: [(from.lng + to.lng) / 2, (from.lat + to.lat) / 2],
    isEstimate: true,
  };
}

function formatDistanceKm(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}

/**
 * Itinerary pins are visually distinct from member-location dots (bigger,
 * white-bordered) and from each other by priority: REQUIRED gets a deep
 * navy blue, OPTIONAL a medium gray, TENTATIVE a muted purple - same
 * solid, white-bordered shape for all three, differentiated purely by
 * hue so they read as one consistent pin family rather than three
 * different marker styles. Deliberately its own palette rather than
 * reusing neuColors.accent - the priority picker's orange selection color
 * needs to mean "currently selected," not "required," so conflating the
 * two would make every priority option look like the map's REQUIRED pin.
 */
function destinationPinStyle(priority: DestinationPriority | undefined): StyleProp<ViewStyle> {
  if (priority === 'OPTIONAL') return [styles.destinationPin, styles.destinationPinOptional];
  if (priority === 'TENTATIVE') return [styles.destinationPin, styles.destinationPinTentative];
  return [styles.destinationPin, styles.destinationPinRequired];
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  markerWrap: { alignItems: 'center' },
  routeLabelWrap: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(136,145,165,0.4)',
  },
  routeLabelText: { fontSize: 10, fontWeight: '700', color: neuColors.textPrimary },
  pin: { width: 16, height: 16, borderRadius: 8, backgroundColor: neuColors.accent, borderWidth: 2, borderColor: '#fff' },
  pinStale: { backgroundColor: '#999' },
  pinDraft: { backgroundColor: neuColors.danger },
  destinationPin: { width: 22, height: 22, borderRadius: 11 },
  destinationPinRequired: { backgroundColor: '#1B2A4A', borderWidth: 2.5, borderColor: '#fff' },
  destinationPinOptional: { backgroundColor: '#8891A5', borderWidth: 2.5, borderColor: '#fff' },
  destinationPinTentative: { backgroundColor: '#8471A6', borderWidth: 2.5, borderColor: '#fff' },
  markerLabel: { marginTop: 4, maxWidth: 140, fontSize: 11, color: '#fff', backgroundColor: '#0009', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  // Transient status banners stay on a semi-transparent dark pill rather
  // than the app's neumorphic surface - they float over live map tiles of
  // unpredictable color, so a fixed light background could lose contrast
  // depending on what's underneath; the dark pill reads reliably either way.
  loadingBanner: { position: 'absolute', top: 108, alignSelf: 'center', backgroundColor: '#0009', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  emptyBanner: { position: 'absolute', top: 108, alignSelf: 'center', backgroundColor: '#0009', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  bannerText: { color: '#fff', fontSize: 12 },
  searchBar: { position: 'absolute', top: 12, left: 12, right: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInputRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 42,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 14, color: neuColors.textPrimary, padding: 0 },
  searchClear: { fontSize: 14, color: neuColors.textMuted, paddingHorizontal: 4 },
  searchResults: { marginTop: 6, overflow: 'hidden' },
  searchResultRow: { paddingHorizontal: 12, paddingVertical: 10 },
  searchResultRowDivider: { borderTopWidth: 1, borderTopColor: neuColors.shadowDark },
  searchResultName: { fontSize: 13, fontWeight: '600', color: neuColors.textPrimary },
  searchResultSubtitle: { fontSize: 11, color: neuColors.textMuted, marginTop: 1 },
  pinModeButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinModeButtonIcon: { fontSize: 18 },
  pinModeButtonIconActive: { color: neuColors.white },
  pinHintBanner: { position: 'absolute', top: 108, alignSelf: 'center', backgroundColor: '#0009', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  draftCard: { position: 'absolute', left: 12, right: 12, bottom: 84, padding: 14 },
  draftLabel: { fontSize: 13, fontWeight: '700', color: neuColors.textPrimary },
  draftCoordinates: { fontSize: 11, color: neuColors.textMuted, marginTop: 2, marginBottom: 8 },
  draftInputWrap: { height: 40 },
  draftInput: { flex: 1, paddingHorizontal: 12, fontSize: 14, color: neuColors.textPrimary },
  draftPriorityRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  draftPriorityFlex: { flex: 1 },
  draftPriorityOption: { paddingVertical: 8, alignItems: 'center' },
  draftPriorityText: { fontSize: 11, fontWeight: '600', color: neuColors.textMuted },
  draftPriorityTextSelected: { color: neuColors.white },
  draftActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  draftCancelFlex: { flex: 1 },
  draftCancelButton: { paddingVertical: 11, alignItems: 'center' },
  draftCancelButtonText: { fontSize: 13, fontWeight: '700', color: neuColors.textMuted },
  draftSaveFlex: { flex: 2 },
  draftSaveButton: { paddingVertical: 11, alignItems: 'center' },
  draftSaveButtonText: { color: neuColors.white, fontWeight: '700', fontSize: 13 },
  pinSavedBanner: { position: 'absolute', bottom: 20, alignSelf: 'center', backgroundColor: '#1e7e34', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, maxWidth: '85%' },
  pinSavedText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});