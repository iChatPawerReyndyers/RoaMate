import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import NeumorphicView from './NeumorphicView';
import { neuColors, neuRadii } from '@/theme/neumorphic';

interface Option<T extends string> {
  key: T;
  label: string;
}

interface Props<T extends string> {
  label?: string;
  options: Option<T>[];
  value: T;
  onChange: (next: T) => void;
}

/**
 * Matches the component library's "Dropdown" pattern - an inset row
 * showing the current value, tapping it opens a raised list (rendered in
 * a transparent Modal, positioned as a simple centered card rather than
 * anchored under the trigger - anchoring precisely under an arbitrary
 * trigger would need onLayout measurement plumbing that isn't worth the
 * complexity for this app's option lists, which are always short).
 */
export default function NeuDropdown<T extends string>({ label, options, value, onChange }: Props<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.key === value);

  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)}>
        <NeumorphicView variant="inset" radius={neuRadii.md} style={styles.trigger}>
          <Text style={styles.triggerText}>
            {label ? `${label}: ` : ''}
            {selected?.label ?? ''}
          </Text>
          <Text style={styles.chevron}>▾</Text>
        </NeumorphicView>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.listWrapper}>
            <NeumorphicView variant="raised" size="md" radius={neuRadii.md} style={styles.list}>
              {options.map(option => {
                const isSelected = option.key === value;
                return (
                  <TouchableOpacity
                    key={option.key}
                    onPress={() => {
                      onChange(option.key);
                      setOpen(false);
                    }}
                    style={[styles.option, isSelected && styles.optionSelected]}
                  >
                    <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </NeumorphicView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    height: 38,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerText: { fontSize: 12, color: neuColors.textPrimary },
  chevron: { fontSize: 12, color: neuColors.textMuted },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'center', alignItems: 'center' },
  listWrapper: { minWidth: 220 },
  list: { padding: 6 },
  option: { paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8, marginBottom: 2 },
  optionSelected: { backgroundColor: neuColors.accent },
  optionText: { fontSize: 13, color: neuColors.textPrimary },
  optionTextSelected: { color: neuColors.white, fontWeight: '700' },
});