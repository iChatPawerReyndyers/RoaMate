import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { neuColors } from '@/theme/neumorphic';

interface Props {
  selected: boolean;
  onSelect: () => void;
  label?: string;
}

/** Matches the component library's "Radio & checkbox" section - a bordered ring with a filled accent dot when selected. */
export default function NeuRadio({ selected, onSelect, label }: Props) {
  return (
    <TouchableOpacity style={styles.row} onPress={onSelect} activeOpacity={0.7}>
      <View style={[styles.ring, selected ? styles.ringSelected : styles.ringUnselected]}>
        {selected ? <View style={styles.dot} /> : null}
      </View>
      {label ? (
        <Text style={[styles.label, { color: selected ? neuColors.textPrimary : neuColors.textMuted }]}>{label}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ring: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringSelected: { borderColor: neuColors.accent },
  ringUnselected: { borderColor: neuColors.shadowDark },
  dot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: neuColors.accent },
  label: { fontSize: 13 },
});