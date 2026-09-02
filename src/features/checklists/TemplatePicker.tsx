import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import NeumorphicView from '@/components/neumorphic/NeumorphicView';
import { neuColors, neuRadii, neuSpacing } from '@/theme/neumorphic';

export interface TemplateOption {
  key: string;
  label: string;
  items: string[];
  isCustom?: boolean;
}

interface Props {
  options: TemplateOption[];
  onPick: (option: TemplateOption) => void;
  onSaveCurrentAsTemplate: () => void;
}

/** CHK-02: horizontal picker for built-in trip-type templates plus any locally-saved custom ones. */
export default function TemplatePicker({ options, onPick, onSaveCurrentAsTemplate }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Start from a template</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {options.map(option => (
          <TouchableOpacity key={option.key} onPress={() => onPick(option)}>
            <NeumorphicView variant="raised" size="sm" radius={neuRadii.md} style={styles.chip}>
              <Text style={styles.chipText}>{option.label}</Text>
              {option.isCustom ? <Text style={styles.customBadge}>custom</Text> : null}
            </NeumorphicView>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <TouchableOpacity onPress={onSaveCurrentAsTemplate}>
        <Text style={styles.saveButtonText}>💾 Save current list as template</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: neuSpacing.lg },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: neuColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  row: { gap: neuSpacing.sm, paddingRight: neuSpacing.sm, paddingVertical: 2 },
  chip: { paddingVertical: 9, paddingHorizontal: 14 },
  chipText: { fontSize: 12, fontWeight: '700', color: neuColors.textPrimary },
  customBadge: { fontSize: 8, color: neuColors.accent, fontWeight: '700', marginTop: 2 },
  saveButtonText: { marginTop: 10, fontSize: 11, fontWeight: '700', color: neuColors.accent, alignSelf: 'flex-start' },
});