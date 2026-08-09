import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import TemplatePicker, { TemplateOption } from './TemplatePicker';

export interface Item {
  id: string;
  label: string;
  checked: boolean;
  assignedToUserId?: string;
  visibility?: 'PERSONAL' | 'SHARED';
  quantity?: number;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  storeCategory?: string;
}

interface Props {
  category: 'PACKING' | 'GROCERY';
  onChangeCategory: (category: 'PACKING' | 'GROCERY') => void;
  items: Item[];
  onToggle: (id: string) => void;
  onConvertToExpense?: (id: string) => void;
  onAddItem: (label: string) => void;
  templateOptions: TemplateOption[];
  onPickTemplate: (option: TemplateOption) => void;
  onSaveCurrentAsTemplate: () => void;
}

/** CHK-01..04: shared, checkable packing/grocery list with template seeding and optional expense conversion. */
export default function ChecklistScreen({
  category,
  onChangeCategory,
  items,
  onToggle,
  onConvertToExpense,
  onAddItem,
  templateOptions,
  onPickTemplate,
  onSaveCurrentAsTemplate,
}: Props) {
  const [newItemLabel, setNewItemLabel] = useState('');

  const handleAdd = () => {
    const trimmed = newItemLabel.trim();
    if (!trimmed) return;
    onAddItem(trimmed);
    setNewItemLabel('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, category === 'PACKING' && styles.tabActive]}
          onPress={() => onChangeCategory('PACKING')}
        >
          <Text style={[styles.tabText, category === 'PACKING' && styles.tabTextActive]}>Packing</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, category === 'GROCERY' && styles.tabActive]}
          onPress={() => onChangeCategory('GROCERY')}
        >
          <Text style={[styles.tabText, category === 'GROCERY' && styles.tabTextActive]}>Grocery</Text>
        </TouchableOpacity>
      </View>

      <TemplatePicker
        options={templateOptions}
        onPick={onPickTemplate}
        onSaveCurrentAsTemplate={onSaveCurrentAsTemplate}
      />

      <FlatList
        data={items}
        keyExtractor={i => i.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <TouchableOpacity style={styles.checkRow} onPress={() => onToggle(item.id)}>
              <View style={[styles.checkbox, item.checked && styles.checkboxChecked]} />
              <View style={styles.labelColumn}>
                <Text style={[styles.label, item.checked && styles.labelChecked]}>{item.label}</Text>
                {category === 'GROCERY' && (item.quantity || item.storeCategory) ? (
                  <Text style={styles.metaText}>
                    {item.quantity ? `Qty ${item.quantity}` : ''}
                    {item.quantity && item.storeCategory ? ' · ' : ''}
                    {item.storeCategory ?? ''}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
            <View style={styles.badgeColumn}>
              {item.visibility ? (
                <View style={[styles.visibilityBadge, item.visibility === 'SHARED' ? styles.sharedBadge : styles.personalBadge]}>
                  <Text style={item.visibility === 'SHARED' ? styles.sharedBadgeText : styles.personalBadgeText}>
                    {item.visibility === 'SHARED' ? 'Shared' : 'Personal'}
                  </Text>
                </View>
              ) : null}
              {onConvertToExpense && (
                <TouchableOpacity onPress={() => onConvertToExpense(item.id)}>
                  <Text style={styles.convertLink}>+ Expense</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No items yet - pick a template above or add one below.</Text>}
      />

      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          value={newItemLabel}
          onChangeText={setNewItemLabel}
          placeholder={category === 'GROCERY' ? 'Add a grocery item' : 'Add a packing item'}
          onSubmitEditing={handleAdd}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: { flex: 1, backgroundColor: '#f7f8fb', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e2e2e2' },
  tabActive: { backgroundColor: '#eef2ff', borderColor: '#2f6fed', borderWidth: 2 },
  tabText: { fontSize: 13, fontWeight: '600', color: '#666' },
  tabTextActive: { color: '#2f6fed' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: '#999' },
  checkboxChecked: { backgroundColor: '#2f6fed', borderColor: '#2f6fed' },
  labelColumn: { flex: 1 },
  label: { fontSize: 15 },
  labelChecked: { textDecorationLine: 'line-through', color: '#999' },
  metaText: { fontSize: 11, color: '#888', marginTop: 2 },
  badgeColumn: { alignItems: 'flex-end', gap: 4 },
  visibilityBadge: { borderRadius: 10, paddingVertical: 2, paddingHorizontal: 8 },
  sharedBadge: { backgroundColor: '#eef2ff' },
  personalBadge: { backgroundColor: '#f2f2f2' },
  sharedBadgeText: { color: '#2f6fed', fontSize: 11, fontWeight: '600' },
  personalBadgeText: { color: '#777', fontSize: 11, fontWeight: '600' },
  convertLink: { color: '#2f6fed', fontSize: 12, fontWeight: '600' },
  empty: { color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: 24 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  addInput: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 },
  addButton: { backgroundColor: '#2f6fed', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  addButtonText: { color: '#fff', fontWeight: '700' },
});
