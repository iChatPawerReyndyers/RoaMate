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
  /** CHK-01: PACKING-only sub-category. Unused for GROCERY items (see storeCategory instead). */
  packingItemCategory?: 'CLOTHING' | 'ELECTRONICS' | 'TOILETRIES' | 'GEAR';
}

const PACKING_CATEGORIES: NonNullable<Item['packingItemCategory']>[] = ['CLOTHING', 'ELECTRONICS', 'TOILETRIES', 'GEAR'];

function formatPackingCategory(value: NonNullable<Item['packingItemCategory']>): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

interface Props {
  category: 'PACKING' | 'GROCERY';
  onChangeCategory: (category: 'PACKING' | 'GROCERY') => void;
  items: Item[];
  onToggle: (id: string) => void;
  onConvertToExpense?: (id: string) => void;
  onAddItem: (label: string, visibility: 'PERSONAL' | 'SHARED', packingItemCategory?: Item['packingItemCategory']) => void;
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
  // CHK-01: was previously hardcoded to SHARED at the call site with no way
  // to actually create a Personal (device/account-only, not synced to the
  // group) item, even though the field, badge and backend filtering all
  // already supported it end-to-end.
  const [newItemVisibility, setNewItemVisibility] = useState<'PERSONAL' | 'SHARED'>('SHARED');
  const [newItemPackingCategory, setNewItemPackingCategory] = useState<Item['packingItemCategory']>(undefined);

  const handleAdd = () => {
    const trimmed = newItemLabel.trim();
    if (!trimmed) return;
    onAddItem(trimmed, newItemVisibility, category === 'PACKING' ? newItemPackingCategory : undefined);
    setNewItemLabel('');
    setNewItemPackingCategory(undefined);
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
                {category === 'PACKING' && item.packingItemCategory ? (
                  <Text style={styles.metaText}>{formatPackingCategory(item.packingItemCategory)}</Text>
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

      <View style={styles.visibilityPickerRow}>
        <TouchableOpacity
          style={[styles.visibilityChip, newItemVisibility === 'SHARED' && styles.visibilityChipActive]}
          onPress={() => setNewItemVisibility('SHARED')}
        >
          <Text style={[styles.visibilityChipText, newItemVisibility === 'SHARED' && styles.visibilityChipTextActive]}>
            Shared
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.visibilityChip, newItemVisibility === 'PERSONAL' && styles.visibilityChipActive]}
          onPress={() => setNewItemVisibility('PERSONAL')}
        >
          <Text style={[styles.visibilityChipText, newItemVisibility === 'PERSONAL' && styles.visibilityChipTextActive]}>
            Personal
          </Text>
        </TouchableOpacity>
      </View>
      {category === 'PACKING' ? (
        <View style={styles.categoryPickerRow}>
          {PACKING_CATEGORIES.map(c => (
            <TouchableOpacity
              key={c}
              style={[styles.categoryChip, newItemPackingCategory === c && styles.categoryChipActive]}
              onPress={() => setNewItemPackingCategory(newItemPackingCategory === c ? undefined : c)}
            >
              <Text style={[styles.categoryChipText, newItemPackingCategory === c && styles.categoryChipTextActive]}>
                {formatPackingCategory(c)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
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
  visibilityPickerRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  visibilityChip: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: '#ddd' },
  visibilityChipActive: { backgroundColor: '#2f6fed', borderColor: '#2f6fed' },
  visibilityChipText: { fontSize: 12, fontWeight: '600', color: '#666' },
  visibilityChipTextActive: { color: '#fff' },
  categoryPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  categoryChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: '#ddd' },
  categoryChipActive: { backgroundColor: '#eef2ff', borderColor: '#2f6fed' },
  categoryChipText: { fontSize: 12, fontWeight: '600', color: '#666' },
  categoryChipTextActive: { color: '#2f6fed' },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  addInput: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10 },
  addButton: { backgroundColor: '#2f6fed', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  addButtonText: { color: '#fff', fontWeight: '700' },
});