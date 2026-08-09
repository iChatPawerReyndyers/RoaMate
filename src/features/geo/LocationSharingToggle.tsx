import React from 'react';
import { Switch, Text, View, StyleSheet } from 'react-native';

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
    <View style={styles.row}>
      <View style={styles.flexFill}>
        <Text style={styles.title}>Share my location</Text>
        <Text style={styles.subtitle}>
          Only shared on-demand when someone opens the map. No background tracking.
        </Text>
      </View>
      <Switch value={enabled} onValueChange={onToggle} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  flexFill: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600' },
  subtitle: { fontSize: 12, color: '#777', marginTop: 2 },
});
