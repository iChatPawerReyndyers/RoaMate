import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
          <TouchableOpacity key={option.key} style={styles.chip} onPress={() => onPick(option)}>
            <Text style={styles.chipText}>{option.label}</Text>
            {option.isCustom ? <Text style={styles.customBadge}>custom</Text> : null}
          </TouchableOpacity>
        ))}
      </ScrollView>
      <TouchableOpacity style={styles.saveButton} onPress={onSaveCurrentAsTemplate}>
        <Text style={styles.saveButtonText}>💾 Save current list as template</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 12, color: '#666', fontWeight: '600', marginBottom: 8 },
  row: { gap: 8, paddingRight: 8 },
  chip: { backgroundColor: '#f7f8fb', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: '#e2e2e2' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#333' },
  customBadge: { fontSize: 9, color: '#2f6fed', marginTop: 2 },
  saveButton: { marginTop: 10, alignSelf: 'flex-start' },
  saveButtonText: { fontSize: 12, color: '#3b4ba0', fontWeight: '600' },
});
