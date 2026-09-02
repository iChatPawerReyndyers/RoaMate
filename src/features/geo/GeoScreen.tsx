import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import EmergencyBeacon from './EmergencyBeacon';
import LocationSharingToggle from './LocationSharingToggle';
import { getCurrentUserId } from '@/services/security/KeyManager';
import NeumorphicView from '@/components/neumorphic/NeumorphicView';
import { neuColors, neuRadii, neuSpacing } from '@/theme/neumorphic';

interface Props {
  tripId: string;
}

export default function GeoScreen({ tripId }: Props) {
  const [sharingEnabled, setSharingEnabled] = useState(false);
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    getCurrentUserId().then(setUserId).catch(err => console.warn('Failed to resolve device id', err));
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>Safety Hub</Text>
        <Text style={styles.description}>
          When location sharing is enabled, your device may respond to on-demand location requests while the app is open.
        </Text>
        <View style={styles.spaced}>
          <LocationSharingToggle enabled={sharingEnabled} onToggle={setSharingEnabled} />
        </View>
        {userId ? (
          <View style={styles.spaced}>
            <EmergencyBeacon tripId={tripId} userId={userId} />
          </View>
        ) : null}
        <NeumorphicView variant="raised" radius={neuRadii.lg} style={styles.noteContainer}>
          <Text style={styles.noteHeader}>Note</Text>
          <Text style={styles.noteText}>
            Silent push support is not active unless the app has a Firebase configuration, so the map fetch currently falls back to the last-known location state.
          </Text>
        </NeumorphicView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: neuColors.background },
  content: { padding: neuSpacing.lg },
  header: { fontSize: 22, fontWeight: '700', marginBottom: 10, color: neuColors.textPrimary },
  description: { color: neuColors.textMuted, marginBottom: 20, lineHeight: 19 },
  spaced: { marginBottom: neuSpacing.lg },
  noteContainer: { marginTop: 8, padding: 16 },
  noteHeader: { fontSize: 15, fontWeight: '700', marginBottom: 6, color: neuColors.textPrimary },
  noteText: { color: neuColors.textMuted, lineHeight: 20 },
});