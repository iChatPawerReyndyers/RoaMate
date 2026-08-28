import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import NeumorphicView from './NeumorphicView';
import { neuColors } from '@/theme/neumorphic';

interface Props {
  checked: boolean;
  onToggle: () => void;
  label?: string;
  strikethroughWhenChecked?: boolean;
}

/** Matches the gallery's Checkboxes section - raised orange square when checked, inset when not. */
export default function NeuCheckbox({ checked, onToggle, label, strikethroughWhenChecked = true }: Props) {
  return (
    <TouchableOpacity style={styles.row} onPress={onToggle} activeOpacity={0.7}>
      {checked ? (
        <NeumorphicView variant="raised" size="sm" radius={5} backgroundColor={neuColors.accent} style={styles.box} />
      ) : (
        <NeumorphicView variant="inset" radius={5} style={styles.box} />
      )}
      {label ? (
        <Text
          style={[
            styles.label,
            { color: checked ? neuColors.textMuted : neuColors.textPrimary },
            checked && strikethroughWhenChecked && styles.strikethrough,
          ]}
        >
          {label}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  box: { width: 18, height: 18 },
  label: { fontSize: 13 },
  strikethrough: { textDecorationLine: 'line-through' },
});
