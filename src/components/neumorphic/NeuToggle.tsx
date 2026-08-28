import React from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { neuColors } from '@/theme/neumorphic';

interface Props {
  value: boolean;
  onValueChange: (next: boolean) => void;
}

/** Matches the gallery's Toggle - orange track + inset shadow when on, muted inset track when off. */
export default function NeuToggle({ value, onValueChange }: Props) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onValueChange(!value)}
      style={[styles.track, { backgroundColor: value ? neuColors.accent : neuColors.surfaceInset, justifyContent: value ? 'flex-end' : 'flex-start' }]}
    >
      <View style={styles.knob} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    flexDirection: 'row',
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 1, height: 1 }, shadowOpacity: 0.15, shadowRadius: 3 },
      android: { elevation: 1 },
    }),
  },
  knob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: neuColors.background,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 1, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2 },
      android: { elevation: 2 },
    }),
  },
});
