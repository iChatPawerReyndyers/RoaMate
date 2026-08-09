import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import EmergencyBeacon from './EmergencyBeacon';
import LocationSharingToggle from './LocationSharingToggle';
import { getDeviceId } from '@/services/security/KeyManager';

interface Props {
  tripId: string;
}

export default function GeoScreen({ tripId }: Props) {
  const [sharingEnabled, setSharingEnabled] = useState(true);
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    getDeviceId().then(setUserId).catch(err => console.warn('Failed to resolve device id', err));
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>Safety Hub</Text>
        <Text style={styles.description}>
          When location sharing is enabled, your device may respond to on-demand location requests while the app is open.
        </Text>
        <LocationSharingToggle enabled={sharingEnabled} onToggle={setSharingEnabled} />
        {userId ? <EmergencyBeacon tripId={tripId} userId={userId} /> : null}
        <View style={styles.noteContainer}>
          <Text style={styles.noteHeader}>Note</Text>
          <Text style={styles.noteText}>
            Silent push support is not active unless the app has a Firebase configuration, so the map fetch currently falls back to the last-known location state.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  header: { fontSize: 22, fontWeight: '700', marginBottom: 10 },
  description: { color: '#555', marginBottom: 20 },
  noteContainer: { marginTop: 24, padding: 16, backgroundColor: '#f5f8ff', borderRadius: 14, borderWidth: 1, borderColor: '#d7e3ff' },
  noteHeader: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  noteText: { color: '#444', lineHeight: 20 },
});
