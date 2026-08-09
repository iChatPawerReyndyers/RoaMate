import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getDeviceId } from '@/services/security/KeyManager';
import { ElevationTracker } from './ElevationTracker';
import { PedometerService } from './PedometerService';

interface Props {
  tripId: string;
  destinationId?: string;
  destinationName?: string;
}

export default function ActivityDashboardScreen({ tripId, destinationId, destinationName }: Props) {
  const [userId, setUserId] = useState<string>('');
  const [stepCountText, setStepCountText] = useState('100');
  const [status, setStatus] = useState<string>('');
  const [tracking, setTracking] = useState(false);
  const pedometerRef = useRef<PedometerService | null>(null);
  const elevationRef = useRef<ElevationTracker | null>(null);

  useEffect(() => {
    getDeviceId().then(setUserId).catch(err => console.warn('Failed to resolve device id', err));
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

  return (
    <SafeAreaView style={styles.container}>
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
            <TextInput
              style={styles.stepInput}
              value={stepCountText}
              keyboardType="number-pad"
              onChangeText={setStepCountText}
            />
            <TouchableOpacity style={styles.button} onPress={recordSteps}>
              <Text style={styles.buttonText}>Record</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.quickButtons}>
            {[100, 500, 1000].map(value => (
              <TouchableOpacity key={value} style={styles.quickButton} onPress={() => quickStep(value)}>
                <Text style={styles.quickButtonText}>+{value}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Elevation Tracking</Text>
          <TouchableOpacity
            style={[styles.button, tracking && styles.disabledButton]}
            disabled={tracking}
            onPress={startElevationTracking}
          >
            <Text style={styles.buttonText}>Start Mountain Session</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, !tracking && styles.disabledButton]}
            disabled={!tracking}
            onPress={stopElevationTracking}
          >
            <Text style={styles.buttonText}>Stop and Upload</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statusBox}>
          <Text style={styles.statusTitle}>Status</Text>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  header: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  attachedTo: { fontSize: 13, color: '#2f6fed', fontWeight: '600', marginBottom: 8 },
  description: { color: '#555', marginBottom: 16, lineHeight: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepInput: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 16 },
  button: { backgroundColor: '#2f6fed', borderRadius: 12, padding: 14, alignItems: 'center', minWidth: 120 },
  buttonText: { color: '#fff', fontWeight: '700' },
  quickButtons: { flexDirection: 'row', gap: 10, marginTop: 10 },
  quickButton: { backgroundColor: '#eef2ff', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  quickButtonText: { color: '#2f6fed', fontWeight: '700' },
  disabledButton: { opacity: 0.4 },
  statusBox: { backgroundColor: '#f5f8ff', borderRadius: 16, padding: 16 },
  statusTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  statusText: { color: '#444' },
});
