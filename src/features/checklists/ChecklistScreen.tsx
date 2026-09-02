import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TemplatePicker, { TemplateOption } from './TemplatePicker';
import NeuSegmentedControl from '@/components/neumorphic/NeuSegmentedControl';
import NeuTextInput from '@/components/neumorphic/NeuTextInput';
import NeuButton from '@/components/neumorphic/NeuButton';
import NeumorphicView from '@/components/neumorphic/NeumorphicView';
import { neuColors, neuRadii, neuSpacing } from '@/theme/neumorphic';

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
const CATEGORY_TABS: { key: 'PACKING' | 'GROCERY'; label: string }[] = [
  { key: 'PACKING', label: 'Packing' },
  { key: 'GROCERY', label: 'Grocery' },
];
const VISIBILITY_OPTIONS: { key: 'SHARED' | 'PERSONAL'; label: string }[] = [
  { key: 'SHARED', label: 'Shared' },
  { key: 'PERSONAL', label: 'Personal' },
];

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
      <NeuSegmentedControl options={CATEGORY_TABS} value={category} onChange={onChangeCategory} />

      <View style={styles.templateSpacing}>
        <TemplatePicker options={templateOptions} onPick={onPickTemplate} onSaveCurrentAsTemplate={onSaveCurrentAsTemplate} />
      </View>

      <FlatList
        data={items}
        keyExtractor={i => i.id}
        renderItem={({ item, index }) => (
          <View style={[styles.row, index > 0 && styles.rowDivider]}>
            <TouchableOpacity style={styles.checkRow} onPress={() => onToggle(item.id)}>
              <NeumorphicView
                variant={item.checked ? 'raised' : 'inset'}
                radius={6}
                backgroundColor={item.checked ? neuColors.accent : neuColors.surfaceInset}
                style={styles.checkbox}
              >
                {item.checked ? <Text style={styles.checkmark}>✓</Text> : null}
              </NeumorphicView>
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
        {VISIBILITY_OPTIONS.map(option => {
          const selected = newItemVisibility === option.key;
          return (
            <TouchableOpacity key={option.key} onPress={() => setNewItemVisibility(option.key)}>
              <NeumorphicView
                variant={selected ? 'raised' : 'inset'}
                size="sm"
                radius={neuRadii.sm}
                backgroundColor={selected ? neuColors.accent : neuColors.surfaceInset}
                style={styles.pillOption}
              >
                <Text style={[styles.pillOptionText, selected && styles.pillOptionTextSelected]}>{option.label}</Text>
              </NeumorphicView>
            </TouchableOpacity>
          );
        })}
      </View>

      {category === 'PACKING' ? (
        <View style={styles.categoryPickerRow}>
          {PACKING_CATEGORIES.map(c => {
            const selected = newItemPackingCategory === c;
            return (
              <TouchableOpacity key={c} onPress={() => setNewItemPackingCategory(selected ? undefined : c)}>
                <NeumorphicView
                  variant={selected ? 'raised' : 'inset'}
                  size="sm"
                  radius={neuRadii.sm}
                  backgroundColor={selected ? neuColors.accent : neuColors.surfaceInset}
                  style={styles.pillOptionSmall}
                >
                  <Text style={[styles.pillOptionTextSmall, selected && styles.pillOptionTextSelected]}>
                    {formatPackingCategory(c)}
                  </Text>
                </NeumorphicView>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      <View style={styles.addRow}>
        <NeuTextInput
          value={newItemLabel}
          onChangeText={setNewItemLabel}
          placeholder={category === 'GROCERY' ? 'Add a grocery item' : 'Add a packing item'}
          onSubmitEditing={handleAdd}
          style={styles.addInput}
        />
        <NeuButton label="Add" variant="primary" onPress={handleAdd} style={styles.addButton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: neuSpacing.lg, backgroundColor: neuColors.background },
  templateSpacing: { marginTop: neuSpacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  rowDivider: { borderTopWidth: 1, borderTopColor: neuColors.shadowDark },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  checkbox: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  checkmark: { color: neuColors.white, fontSize: 13, fontWeight: '700' },
  labelColumn: { flex: 1 },
  label: { fontSize: 15, color: neuColors.textPrimary },
  labelChecked: { textDecorationLine: 'line-through', color: neuColors.textMuted },
  metaText: { fontSize: 11, color: neuColors.textMuted, marginTop: 2 },
  badgeColumn: { alignItems: 'flex-end', gap: 4 },
  visibilityBadge: { borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8 },
  sharedBadge: { backgroundColor: '#fff6e0' },
  personalBadge: {
    backgroundColor: neuColors.surfaceInset,
    borderWidth: 1,
    borderTopColor: neuColors.shadowDark,
    borderLeftColor: neuColors.shadowDark,
    borderBottomColor: neuColors.shadowLight,
    borderRightColor: neuColors.shadowLight,
  },
  sharedBadgeText: { color: '#8a5a00', fontSize: 10, fontWeight: '700' },
  personalBadgeText: { color: neuColors.textMuted, fontSize: 10, fontWeight: '700' },
  convertLink: { color: neuColors.accent, fontSize: 11, fontWeight: '700' },
  empty: { color: neuColors.textMuted, fontStyle: 'italic', textAlign: 'center', marginTop: 24 },
  visibilityPickerRow: { flexDirection: 'row', gap: neuSpacing.sm, marginTop: 14 },
  pillOption: { paddingVertical: 6, paddingHorizontal: 14 },
  pillOptionText: { fontSize: 11, fontWeight: '700', color: neuColors.textMuted },
  pillOptionTextSelected: { color: neuColors.white },
  categoryPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: neuSpacing.sm, marginTop: 10 },
  pillOptionSmall: { paddingVertical: 6, paddingHorizontal: 12 },
  pillOptionTextSmall: { fontSize: 10, fontWeight: '700', color: neuColors.textMuted },
  addRow: { flexDirection: 'row', gap: neuSpacing.sm, marginTop: 14, alignItems: 'center' },
  addInput: { flex: 1, marginBottom: 0 },
  addButton: { width: 72, justifyContent: 'center' },
});