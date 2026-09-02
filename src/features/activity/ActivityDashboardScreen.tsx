import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getCurrentUserId } from '@/services/security/KeyManager';
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
}

const QUICK_STEPS = [100, 500, 1000];

export default function ActivityDashboardScreen({ tripId, destinationId, destinationName }: Props) {
  const [userId, setUserId] = useState<string>('');
  const [stepCountText, setStepCountText] = useState('100');
  const [status, setStatus] = useState<string>('');
  const [tracking, setTracking] = useState(false);
  const pedometerRef = useRef<PedometerService | null>(null);
  const elevationRef = useRef<ElevationTracker | null>(null);

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
  statusBox: { padding: 16 },
  statusTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8, color: neuColors.textPrimary },
  statusText: { color: neuColors.textMuted },
});