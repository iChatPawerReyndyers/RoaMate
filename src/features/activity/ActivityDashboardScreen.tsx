import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Geolocation from '@react-native-community/geolocation';
import { getCurrentUserId } from '@/services/security/KeyManager';
import { apiClient, NetworkUnavailableError } from '@/services/api/client';
import { useSync } from '@/sync/SyncContext';
import { TripStackParamList } from '@/app/navigation/TripStack';
import { ElevationTracker } from './ElevationTracker';
import { PedometerService } from './PedometerService';
import NeuTextInput from '@/components/neumorphic/NeuTextInput';
import NeuButton from '@/components/neumorphic/NeuButton';
import NeumorphicView from '@/components/neumorphic/NeumorphicView';
import { neuColors, neuRadii, neuSpacing } from '@/theme/neumorphic';

interface Props {
  tripId: string;
  destinationId?: string;
  destinationName?: string;
  /**
   * ACT-05: this destination's own coordinates, and every other itinerary
   * stop's - both passed straight from ItineraryContainer's already-loaded
   * state (see TripStack's Activity route type), not fetched here. Powers
   * the "looks like you've moved on" auto-detect prompt below entirely
   * from data already on-device, so it works with no network at all.
   */
  destinationLat?: number;
  destinationLng?: number;
  otherDestinations?: { id: string; name: string; lat: number; lng: number }[];
}

const QUICK_STEPS = [100, 500, 1000];

/** ACT-05: how far from the tracked stop before we suspect the traveler has moved on. Generous enough to allow wandering around the stop itself without false-triggering. */
const DEPARTURE_THRESHOLD_METERS = 300;
/** ACT-05: how long "Keep tracking" suppresses the prompt before it can fire again. */
const SNOOZE_DURATION_MS = 10 * 60 * 1000;
/** Coarse geofence, not turn-by-turn navigation - infrequent low-accuracy fixes are plenty and easier on the battery. */
const DEPARTURE_CHECK_DISTANCE_FILTER_METERS = 50;

/** Same formula as MapScreen's haversineDistanceMeters - kept as its own copy rather than a shared import, consistent with how that module already duplicates this rather than reaching across features for one formula. */
function haversineDistanceMeters(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const EARTH_RADIUS_METERS = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function ActivityDashboardScreen({
  tripId,
  destinationId,
  destinationName,
  destinationLat,
  destinationLng,
  otherDestinations,
}: Props) {
  const [userId, setUserId] = useState<string>('');
  const [stepCountText, setStepCountText] = useState('100');
  const [status, setStatus] = useState<string>('');
  const [tracking, setTracking] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [movedOnPrompt, setMovedOnPrompt] = useState<{ nearestName: string | null; distanceMeters: number } | null>(null);
  const pedometerRef = useRef<PedometerService | null>(null);
  const elevationRef = useRef<ElevationTracker | null>(null);
  const departureWatchId = useRef<number | null>(null);
  const snoozedUntilRef = useRef<number>(0);
  const isMountedRef = useRef(true);
  const navigation = useNavigation<NativeStackNavigationProp<TripStackParamList, 'Activity'>>();
  const syncManager = useSync();

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    getCurrentUserId().then(setUserId).catch(err => console.warn('Failed to resolve current user id', err));
  }, []);

  useEffect(() => {
    if (!userId) return;
    const service = new PedometerService(tripId, userId, destinationId);
    pedometerRef.current = service;
    service.start();
    setStatus('Step batching is active while this screen remains open.');

    return () => {
      service.stop();
      elevationRef.current?.stop();
    };
  }, [tripId, userId, destinationId]);

  // ACT-05: foreground-only "looks like you've moved on" auto-detect - see
  // this component's Props doc comment for why it doesn't need a network
  // call, and the "true background tracking" alternative that was
  // considered and deliberately deferred (only runs while this screen is
  // open, same as the rest of this screen's tracking - see SyncManager's
  // doc comment on the app's existing no-background-tracking stance).
  useEffect(() => {
    if (!destinationId || destinationLat === undefined || destinationLng === undefined) return;

    const watchId = Geolocation.watchPosition(
      pos => {
        if (!isMountedRef.current) return;
        if (Date.now() < snoozedUntilRef.current) return;

        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const distanceFromTracked = haversineDistanceMeters(here, { lat: destinationLat, lng: destinationLng });
        if (distanceFromTracked < DEPARTURE_THRESHOLD_METERS) {
          setMovedOnPrompt(null);
          return;
        }

        let nearestName: string | null = null;
        let nearestDistance = Infinity;
        for (const other of otherDestinations ?? []) {
          const d = haversineDistanceMeters(here, other);
          if (d < nearestDistance) {
            nearestDistance = d;
            nearestName = other.name;
          }
        }
        // Only worth naming the other stop if it's genuinely closer than
        // the one being tracked - otherwise just report the plain
        // distance from here rather than implying a specific destination.
        const nameToShow = nearestName && nearestDistance < distanceFromTracked ? nearestName : null;

        setMovedOnPrompt({ nearestName: nameToShow, distanceMeters: distanceFromTracked });
      },
      err => console.warn('Departure-detection location watch failed', err),
      { enableHighAccuracy: false, distanceFilter: DEPARTURE_CHECK_DISTANCE_FILTER_METERS },
    );
    departureWatchId.current = watchId;

    return () => {
      Geolocation.clearWatch(watchId);
      departureWatchId.current = null;
    };
  }, [destinationId, destinationLat, destinationLng, otherDestinations]);

  const recordSteps = () => {
    const parsed = parseInt(stepCountText, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      setStatus('Enter a valid positive step count.');
      return;
    }

    pedometerRef.current?.recordSteps(parsed);
    setStatus(`Queued ${parsed} steps for upload.`);
  };

  const startElevationTracking = () => {
    if (!userId) {
      setStatus('Waiting for device ID...');
      return;
    }
    if (tracking) {
      setStatus('Elevation tracking is already active.');
      return;
    }

    const tracker = new ElevationTracker(tripId, userId, destinationId);
    tracker.start();
    elevationRef.current = tracker;
    setTracking(true);
    setStatus('Elevation tracking started. Move and then stop the session to upload data.');
  };

  const stopElevationTracking = async () => {
    if (!tracking || !elevationRef.current) {
      setStatus('No active elevation session to stop.');
      return;
    }

    try {
      await elevationRef.current.stopAndUpload();
      setStatus('Elevation session uploaded successfully.');
    } catch (err) {
      console.warn('Failed to upload elevation session', err);
      setStatus('Elevation upload failed. It will retry when network is available.');
    } finally {
      setTracking(false);
      elevationRef.current = null;
    }
  };

  const quickStep = (count: number) => {
    setStepCountText(String(count));
    pedometerRef.current?.recordSteps(count);
    setStatus(`Queued ${count} steps for upload.`);
  };

  /**
   * ACT-05: stops any tracking still in flight (auto-uploading an active
   * elevation session rather than discarding it), marks this destination's
   * activity as complete, and heads back to the Itinerary tab - which
   * re-fetches on focus (see ItineraryContainer's useFocusEffect) and will
   * now show this stop's metrics. If the mark-complete call can't reach
   * the server, it's queued the same way every other offline mutation in
   * this app is (see SyncManager) and applied once connectivity returns.
   */
  const finishActivity = async () => {
    if (!destinationId) return;
    setFinishing(true);
    setMovedOnPrompt(null);

    try {
      if (tracking && elevationRef.current) {
        try {
          await elevationRef.current.stopAndUpload();
        } catch (err) {
          console.warn('Failed to upload elevation session while finishing activity', err);
        }
        setTracking(false);
        elevationRef.current = null;
      }
      pedometerRef.current?.stop();

      try {
        await apiClient.patch(`/api/v1/itinerary/destinations/${destinationId}/activity-complete`);
      } catch (err) {
        if (err instanceof NetworkUnavailableError) {
          await syncManager.enqueueEvent({
            tripId,
            eventType: 'DESTINATION_ACTIVITY_COMPLETED',
            clientTimestamp: Date.now(),
            payloadJson: JSON.stringify({ destinationId }),
          });
        } else {
          throw err;
        }
      }

      navigation.goBack();
    } catch (err) {
      console.warn('Failed to finish activity', err);
      if (isMountedRef.current) {
        setStatus("Couldn't finish activity here. Check your connection and try again.");
      }
    } finally {
      if (isMountedRef.current) setFinishing(false);
    }
  };

  // Deliberately a plain View, not SafeAreaView: this screen is rendered
  // in two different navigation contexts - nested inside ItineraryHubScreen's
  // Activity tab (where TripHomeScreen's SafeAreaView already covers the
  // top/bottom insets) AND as its own stack push via TripStack's 'Activity'
  // route (which gets top-inset coverage from its native header instead,
  // and wraps this component in its own SafeAreaView for the bottom edge
  // only - see TripStack.tsx). A component used in two different framing
  // contexts shouldn't bake in an assumption that's only correct for one
  // of them; whichever screen embeds this one decides what safe-area
  // handling it actually needs.
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>Activity Dashboard</Text>
        {destinationName ? (
          <Text style={styles.attachedTo}>Logging against: {destinationName}</Text>
        ) : null}
        <Text style={styles.description}>
          Log steps manually or use the elevation tracker for mountain/hike activity. Step batches upload periodically while the screen is open.
        </Text>

        {movedOnPrompt ? (
          <NeumorphicView variant="raised" radius={neuRadii.lg} style={styles.movedOnBanner}>
            <Text style={styles.movedOnTitle}>📍 Looks like you've moved on</Text>
            <Text style={styles.movedOnBody}>
              {movedOnPrompt.nearestName
                ? `You're about ${Math.round(movedOnPrompt.distanceMeters)}m from ${destinationName ?? 'this stop'} and closer to ${movedOnPrompt.nearestName} now. Want to finish tracking your activity there?`
                : `You're about ${Math.round(movedOnPrompt.distanceMeters)}m from ${destinationName ?? 'this stop'} now. Want to finish tracking your activity there?`}
            </Text>
            <View style={styles.movedOnActions}>
              <TouchableOpacity style={styles.movedOnActionFlex} onPress={finishActivity} disabled={finishing}>
                <NeumorphicView variant="raised" radius={neuRadii.md} backgroundColor="#1e7e34" style={styles.movedOnFinishButton}>
                  <Text style={styles.movedOnFinishText}>Finish at {destinationName ?? 'this stop'}</Text>
                </NeumorphicView>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.movedOnActionFlex}
                onPress={() => {
                  snoozedUntilRef.current = Date.now() + SNOOZE_DURATION_MS;
                  setMovedOnPrompt(null);
                }}
              >
                <NeumorphicView variant="raised" radius={neuRadii.md} style={styles.movedOnKeepButton}>
                  <Text style={styles.movedOnKeepText}>Keep tracking</Text>
                </NeumorphicView>
              </TouchableOpacity>
            </View>
          </NeumorphicView>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Manual Step Entry</Text>
          <View style={styles.stepRow}>
            <NeuTextInput
              value={stepCountText}
              keyboardType="number-pad"
              onChangeText={setStepCountText}
              style={styles.stepInput}
            />
            <NeuButton label="Record" variant="primary" onPress={recordSteps} style={styles.recordButton} />
          </View>
          <View style={styles.quickButtons}>
            {QUICK_STEPS.map(value => (
              <TouchableOpacity key={value} onPress={() => quickStep(value)}>
                <NeumorphicView variant="raised" size="sm" radius={neuRadii.md} style={styles.quickButton}>
                  <Text style={styles.quickButtonText}>+{value}</Text>
                </NeumorphicView>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Elevation Tracking</Text>
          <TouchableOpacity disabled={tracking} onPress={startElevationTracking}>
            <NeumorphicView
              variant="raised"
              radius={neuRadii.lg}
              backgroundColor={tracking ? neuColors.surfaceInset : neuColors.accent}
              style={styles.elevationButton}
            >
              <Text style={[styles.elevationButtonText, tracking && styles.elevationButtonTextDisabled]}>
                Start Mountain Session
              </Text>
            </NeumorphicView>
          </TouchableOpacity>
          <TouchableOpacity disabled={!tracking} onPress={stopElevationTracking}>
            <NeumorphicView
              variant="raised"
              radius={neuRadii.lg}
              backgroundColor={!tracking ? neuColors.surfaceInset : neuColors.accent}
              style={styles.elevationButton}
            >
              <Text style={[styles.elevationButtonText, !tracking && styles.elevationButtonTextDisabled]}>
                Stop and Upload
              </Text>
            </NeumorphicView>
          </TouchableOpacity>
        </View>

        {destinationId ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Done here?</Text>
            <TouchableOpacity disabled={finishing} onPress={finishActivity}>
              <NeumorphicView
                variant="raised"
                radius={neuRadii.lg}
                backgroundColor={finishing ? neuColors.surfaceInset : '#1e7e34'}
                style={styles.elevationButton}
              >
                {finishing ? (
                  <ActivityIndicator size="small" color={neuColors.textMuted} />
                ) : (
                  <Text style={styles.finishButtonText}>✓ Finish activity at this stop</Text>
                )}
              </NeumorphicView>
            </TouchableOpacity>
            <Text style={styles.finishHint}>
              Stops tracking, saves the session, and unlocks metrics on the itinerary card.
            </Text>
          </View>
        ) : null}

        <NeumorphicView variant="raised" radius={neuRadii.lg} style={styles.statusBox}>
          <Text style={styles.statusTitle}>Status</Text>
          <Text style={styles.statusText}>{status}</Text>
        </NeumorphicView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: neuColors.background },
  content: { padding: neuSpacing.lg },
  header: { fontSize: 22, fontWeight: '700', marginBottom: 12, color: neuColors.textPrimary },
  attachedTo: { fontSize: 13, color: neuColors.accent, fontWeight: '600', marginBottom: 8 },
  description: { color: neuColors.textMuted, marginBottom: 16, lineHeight: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10, color: neuColors.textPrimary },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: neuSpacing.sm },
  stepInput: { flex: 1, marginBottom: 0 },
  recordButton: { minWidth: 100, justifyContent: 'center' },
  quickButtons: { flexDirection: 'row', gap: neuSpacing.sm, marginTop: 10 },
  quickButton: { paddingVertical: 10, paddingHorizontal: 14 },
  quickButtonText: { color: neuColors.textPrimary, fontWeight: '700' },
  elevationButton: { padding: 14, alignItems: 'center', marginBottom: 10 },
  elevationButtonText: { color: neuColors.white, fontWeight: '700' },
  elevationButtonTextDisabled: { color: neuColors.textMuted },
  finishButtonText: { color: neuColors.white, fontWeight: '700' },
  finishHint: { fontSize: 11, color: neuColors.textMuted, marginTop: 2, textAlign: 'center' },
  statusBox: { padding: 16 },
  statusTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8, color: neuColors.textPrimary },
  statusText: { color: neuColors.textMuted },
  movedOnBanner: { padding: 14, marginBottom: 20 },
  movedOnTitle: { fontSize: 14, fontWeight: '700', color: neuColors.textPrimary, marginBottom: 6 },
  movedOnBody: { fontSize: 12, color: neuColors.textMuted, lineHeight: 17, marginBottom: 12 },
  movedOnActions: { flexDirection: 'row', gap: 8 },
  movedOnActionFlex: { flex: 1 },
  movedOnFinishButton: { paddingVertical: 10, alignItems: 'center' },
  movedOnFinishText: { fontSize: 13, fontWeight: '700', color: neuColors.white, textAlign: 'center' },
  movedOnKeepButton: { paddingVertical: 10, alignItems: 'center' },
  movedOnKeepText: { fontSize: 13, fontWeight: '600', color: neuColors.textPrimary },
});