import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import NeuToggle from '@/components/neumorphic/NeuToggle';
import NeuCard from '@/components/neumorphic/NeuCard';
import { neuColors } from '@/theme/neumorphic';

interface Props {
  enabled: boolean;
  onToggle: (next: boolean) => void;
}

/**
 * GEO-01: explicit, per-session opt-in. There is no persistent
 * "always share" state - toggling this on only makes the member respond
 * to silent-push location requests while it stays on; closing the app or
 * turning it off means the device will not respond to future requests.
 */
export default function LocationSharingToggle({ enabled, onToggle }: Props) {
  return (
    <NeuCard size="md" style={styles.card}>
      <View style={styles.row}>
        <View style={styles.flexFill}>
          <Text style={styles.title}>Share my location</Text>
          <Text style={styles.subtitle}>
            Only shared on-demand when someone opens the map. No background tracking.
          </Text>
        </View>
        <NeuToggle value={enabled} onValueChange={onToggle} />
      </View>
    </NeuCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flexFill: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: neuColors.textPrimary },
  subtitle: { fontSize: 11, color: neuColors.textMuted, marginTop: 2 },
});