import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { neuColors, neuRadii } from '@/theme/neumorphic';

interface Option<T extends string> {
  key: T;
  label: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (next: T) => void;
}

/** Matches the gallery's segmented control - inset track, raised orange pill for the selected tab. */
export default function NeuSegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.track}>
      {options.map(option => {
        const selected = option.key === value;
        return (
          <TouchableOpacity
            key={option.key}
            style={[styles.tab, selected && styles.tabSelected]}
            onPress={() => onChange(option.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: neuColors.surfaceInset,
    borderRadius: neuRadii.sm,
    padding: 3,
    borderWidth: 1.5,
    borderTopColor: neuColors.shadowDark,
    borderLeftColor: neuColors.shadowDark,
    borderBottomColor: neuColors.shadowLight,
    borderRightColor: neuColors.shadowLight,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 8 },
  tabSelected: {
    backgroundColor: neuColors.accent,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 1, height: 1 }, shadowOpacity: 0.25, shadowRadius: 2 },
      android: { elevation: 2 },
    }),
  },
  label: { fontSize: 11, color: neuColors.textMuted },
  labelSelected: { color: neuColors.white, fontWeight: '700' },
});
