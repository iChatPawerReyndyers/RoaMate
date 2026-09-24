import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TemplatePicker, { TemplateOption } from './TemplatePicker';
import ChecklistItemSheet, { Avatar } from './ChecklistItemSheet';
import NeuSegmentedControl from '@/components/neumorphic/NeuSegmentedControl';
import NeuTextInput from '@/components/neumorphic/NeuTextInput';
import NeuButton from '@/components/neumorphic/NeuButton';
import NeumorphicView from '@/components/neumorphic/NeumorphicView';
import { neuColors, neuRadii, neuSpacing } from '@/theme/neumorphic';
import {
  ChecklistViewKey,
  Member,
  Section,
  TodoFilter,
  categoryLabelOf,
  categoryOptionsFor,
  categoryValueOf,
  groupByCategory,
  groupByPerson,
  isPersonal,
  kindText,
  memberName,
  progressOf,
  splitTodoDone,
} from './checklistViews';
import { loadChecklistView, saveChecklistView } from './checklistViewPreference';

export interface Item {
  id: string;
  label: string;
  checked: boolean;
  /** CHK-05: who's in charge of this SHARED item; null/absent = nobody yet. */
  assignedToUserId?: string | null;
  visibility?: 'PERSONAL' | 'SHARED';
  quantity?: number;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  /** GROCERY only: the store section (Produce, Dairy...). */
  storeCategory?: string | null;
  /** CHK-01: PACKING-only sub-category. Unused for GROCERY items (see storeCategory instead). */
  packingItemCategory?: 'CLOTHING' | 'ELECTRONICS' | 'TOILETRIES' | 'GEAR' | null;
}

/** What the add bar can set on a brand-new item beyond its name and Shared/Personal. */
export interface NewItemOptions {
  /** The stored category value: a PackingItemCategory name (packing) or a store section (grocery); null/absent = none ("Other"). */
  category?: string | null;
  /** Only meaningful for SHARED items. */
  assignedToUserId?: string | null;
}

const LIST_TABS: { key: 'PACKING' | 'GROCERY'; label: string }[] = [
  { key: 'PACKING', label: 'Packing' },
  { key: 'GROCERY', label: 'Grocery' },
];
const VISIBILITY_OPTIONS: { key: 'SHARED' | 'PERSONAL'; label: string }[] = [
  { key: 'SHARED', label: 'Shared' },
  { key: 'PERSONAL', label: 'Personal' },
];
const FILTER_OPTIONS: { key: TodoFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'MINE', label: 'Mine' },
  { key: 'SHARED', label: 'Shared' },
  { key: 'PERSONAL', label: 'Personal' },
];

interface Props {
  category: 'PACKING' | 'GROCERY';
  onChangeCategory: (category: 'PACKING' | 'GROCERY') => void;
  items: Item[];
  /** The trip's members (with display names) - who can be put in charge. */
  members: Member[];
  /** The signed-in user's id, to label "You" and drive the Mine filter. */
  currentUserId: string;
  onToggle: (id: string) => void;
  onConvertToExpense?: (id: string) => void;
  onAddItem: (label: string, visibility: 'PERSONAL' | 'SHARED', options?: NewItemOptions) => void;
  onAssign: (itemId: string, userId: string | null) => void;
  onChangeItemCategory: (itemId: string, value: string | null) => void;
  templateOptions: TemplateOption[];
  onPickTemplate: (option: TemplateOption) => void;
  onSaveCurrentAsTemplate: () => void;
}

/**
 * CHK-01..05: shared, checkable packing/grocery list with template seeding
 * and optional expense conversion, now with three views of the same items
 * (By category / To do and done / By person) and a "who's in charge" chip
 * on every shared item.
 */
export default function ChecklistScreen({
  category,
  onChangeCategory,
  items,
  members,
  currentUserId,
  onToggle,
  onConvertToExpense,
  onAddItem,
  onAssign,
  onChangeItemCategory,
  templateOptions,
  onPickTemplate,
  onSaveCurrentAsTemplate,
}: Props) {
  const text = kindText(category);
  const categoryOptions = categoryOptionsFor(category);

  // Each tab remembers its own view; switching tabs loads that tab's choice.
  const [view, setView] = useState<ChecklistViewKey>(() => loadChecklistView(category));
  useEffect(() => {
    setView(loadChecklistView(category));
  }, [category]);
  const handleChangeView = (next: ChecklistViewKey) => {
    setView(next);
    saveChecklistView(category, next);
  };

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [todoFilter, setTodoFilter] = useState<TodoFilter>('ALL');
  const [doneOpen, setDoneOpen] = useState(false);
  const [sheetItemId, setSheetItemId] = useState<string | null>(null);

  // --- add bar ---
  const [newItemLabel, setNewItemLabel] = useState('');
  const [addOptionsOpen, setAddOptionsOpen] = useState(false);
  // CHK-01: Personal (device/account-only, not synced to the group) vs Shared.
  const [newItemVisibility, setNewItemVisibility] = useState<'PERSONAL' | 'SHARED'>('SHARED');
  const [newItemCategory, setNewItemCategory] = useState<string | null>(null);
  const [newItemAssignee, setNewItemAssignee] = useState<string | null>(null);
  const [addAssigneeSheetOpen, setAddAssigneeSheetOpen] = useState(false);

  useEffect(() => {
    // Category values mean different things on each tab (CLOTHING vs Produce).
    setNewItemCategory(null);
  }, [category]);

  const handleAdd = () => {
    const trimmed = newItemLabel.trim();
    if (!trimmed) return;
    const shared = newItemVisibility === 'SHARED';
    onAddItem(trimmed, newItemVisibility, {
      category: newItemCategory,
      assignedToUserId: shared ? newItemAssignee : null,
    });
    // Keep the chosen category / Shared-Personal so several items in a row are quick; the assignee is per item.
    setNewItemLabel('');
    setNewItemAssignee(null);
  };

  const toggleCollapsed = (key: string) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  const progress = progressOf(items);
  const sheetItem = sheetItemId ? items.find(i => i.id === sheetItemId) : undefined;

  const categorySections = useMemo(() => groupByCategory(items, category), [items, category]);
  const personSections = useMemo(() => groupByPerson(items, members, currentUserId), [items, members, currentUserId]);
  const { todo, done } = useMemo(() => splitTodoDone(items, todoFilter, currentUserId), [items, todoFilter, currentUserId]);

  /** "Electronics · Qty 2" - the category only where the view isn't already grouped by it. */
  const subLine = (item: Item, withCategory: boolean): string => {
    const parts: string[] = [];
    if (withCategory) {
      parts.push(categoryLabelOf(categoryValueOf(item, category), category));
    }
    if (category === 'GROCERY' && item.quantity && item.quantity > 1) {
      parts.push(`Qty ${item.quantity}`);
    }
    return parts.join(' · ');
  };

  const renderRight = (item: Item, showName: boolean) => {
    if (isPersonal(item)) {
      return (
        <TouchableOpacity
          onPress={() => setSheetItemId(item.id)}
          accessibilityRole="button"
          accessibilityLabel="Personal item - change category"
          hitSlop={8}
        >
          <Text style={styles.lock}>🔒</Text>
        </TouchableOpacity>
      );
    }
    const assigned = item.assignedToUserId ?? null;
    const name = memberName(assigned, members, currentUserId);
    return (
      <TouchableOpacity
        onPress={() => setSheetItemId(item.id)}
        accessibilityRole="button"
        accessibilityLabel={assigned ? `In charge: ${name}. Tap to change` : 'Nobody in charge yet. Tap to assign'}
        hitSlop={6}
      >
        {assigned ? (
          <View style={styles.assigneeChip}>
            <Avatar userId={assigned} name={name} size={20} />
            {showName ? (
              <Text style={styles.assigneeName} numberOfLines={1}>
                {name}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.assignChip}>
            <Text style={styles.assignChipText}>Assign</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderItem = (item: Item, opts: { withCategory: boolean; showName: boolean }) => {
    const sub = subLine(item, opts.withCategory);
    return (
      <View key={item.id} style={styles.row}>
        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => onToggle(item.id)}
          accessibilityRole="checkbox"
          accessibilityLabel={item.label}
          accessibilityState={{ checked: item.checked }}
        >
          <NeumorphicView
            variant={item.checked ? 'raised' : 'inset'}
            radius={6}
            backgroundColor={item.checked ? neuColors.accent : neuColors.surfaceInset}
            style={styles.checkbox}
          >
            {item.checked ? <Text style={styles.checkmark}>✓</Text> : null}
          </NeumorphicView>
          <View style={styles.labelColumn}>
            <Text style={[styles.label, item.checked && styles.labelChecked]} numberOfLines={1}>
              {item.label}
            </Text>
            {sub ? <Text style={styles.metaText}>{sub}</Text> : null}
          </View>
        </TouchableOpacity>
        <View style={styles.rightColumn}>
          {renderRight(item, opts.showName)}
          {onConvertToExpense ? (
            <TouchableOpacity onPress={() => onConvertToExpense(item.id)}>
              <Text style={styles.convertLink}>+ Expense</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  const renderSection = (section: Section<Item>, keyPrefix: string, opts: { withCategory: boolean; showName: boolean; personUserId?: boolean }) => {
    const key = `${keyPrefix}-${category}-${section.key}`;
    const isCollapsed = !!collapsed[key];
    return (
      <View key={key}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => toggleCollapsed(key)}
          accessibilityRole="button"
          accessibilityLabel={`${section.title}, ${section.doneCount} of ${section.items.length} done`}
          accessibilityState={{ expanded: !isCollapsed }}
        >
          {opts.personUserId ? <Avatar userId={section.userId ?? null} name={section.title} size={20} /> : null}
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionCount}>
            {section.doneCount}/{section.items.length}
          </Text>
          <Text style={styles.chevron}>{isCollapsed ? '›' : '⌄'}</Text>
        </TouchableOpacity>
        {isCollapsed ? null : section.items.map(item => renderItem(item, opts))}
      </View>
    );
  };

  const renderBody = () => {
    if (items.length === 0) {
      return <Text style={styles.empty}>No items yet - pick a template above or add one below.</Text>;
    }
    if (view === 'category') {
      return categorySections.map(section => renderSection(section, 'cat', { withCategory: false, showName: true }));
    }
    if (view === 'people') {
      return personSections.map(section => renderSection(section, 'who', { withCategory: true, showName: false, personUserId: true }));
    }
    return (
      <View>
        <View style={styles.filterRow}>
          {FILTER_OPTIONS.map(option => {
            const selected = todoFilter === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                onPress={() => setTodoFilter(option.key)}
                accessibilityRole="button"
                accessibilityLabel={`Show ${option.label}`}
                accessibilityState={{ selected }}
              >
                <NeumorphicView
                  variant={selected ? 'raised' : 'inset'}
                  size="sm"
                  radius={neuRadii.sm}
                  backgroundColor={selected ? neuColors.accent : neuColors.surfaceInset}
                  style={styles.pillOptionSmall}
                >
                  <Text style={[styles.pillOptionTextSmall, selected && styles.pillOptionTextSelected]}>{option.label}</Text>
                </NeumorphicView>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.todoHeading}>
          {text.todo} ({todo.length})
        </Text>
        {todo.length === 0 ? <Text style={styles.nothingLeft}>Nothing left here.</Text> : todo.map(item => renderItem(item, { withCategory: true, showName: true }))}
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => setDoneOpen(prev => !prev)}
          accessibilityRole="button"
          accessibilityLabel={`${text.done}, ${done.length} items`}
          accessibilityState={{ expanded: doneOpen }}
        >
          <Text style={styles.sectionTitle}>
            {text.done} ({done.length})
          </Text>
          <Text style={styles.chevron}>{doneOpen ? '⌄' : '›'}</Text>
        </TouchableOpacity>
        {doneOpen ? done.map(item => renderItem(item, { withCategory: true, showName: true })) : null}
      </View>
    );
  };

  const addAssigneeName = memberName(newItemAssignee, members, currentUserId);

  return (
    <View style={styles.container}>
      <NeuSegmentedControl options={LIST_TABS} value={category} onChange={onChangeCategory} />

      <View style={styles.viewSwitchSpacing}>
        <NeuSegmentedControl
          options={[
            { key: 'category' as const, label: text.categoryView },
            { key: 'todo' as const, label: text.todoView },
            { key: 'people' as const, label: 'People' },
          ]}
          value={view}
          onChange={handleChangeView}
        />
      </View>

      <View style={styles.progressBlock}>
        <View style={styles.progressTextRow}>
          <Text style={styles.progressText}>
            {progress.done} of {progress.total} {text.progressUnit}
          </Text>
          <Text style={styles.progressPercent}>{progress.percent}%</Text>
        </View>
        <NeumorphicView variant="inset" radius={4} style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress.percent}%` }]} />
        </NeumorphicView>
      </View>

      <View style={styles.templateSpacing}>
        <TemplatePicker options={templateOptions} onPick={onPickTemplate} onSaveCurrentAsTemplate={onSaveCurrentAsTemplate} />
      </View>

      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        {renderBody()}
      </ScrollView>

      <View style={styles.addArea}>
        {addOptionsOpen ? (
          <View style={styles.addOptions}>
            <View style={styles.addOptionsHeader}>
              <Text style={styles.addOptionsLabel}>{text.categoryNoun}</Text>
              <TouchableOpacity onPress={() => setAddOptionsOpen(false)} accessibilityRole="button" accessibilityLabel="Hide options" hitSlop={8}>
                <Text style={styles.hideOptions}>Hide</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.categoryPickerRow}>
              {categoryOptions.map(option => {
                const selected = option.value === newItemCategory;
                return (
                  <TouchableOpacity
                    key={option.label}
                    onPress={() => setNewItemCategory(option.value)}
                    accessibilityRole="button"
                    accessibilityLabel={`${text.categoryNoun}: ${option.label}`}
                    accessibilityState={{ selected }}
                  >
                    <NeumorphicView
                      variant={selected ? 'raised' : 'inset'}
                      size="sm"
                      radius={neuRadii.sm}
                      backgroundColor={selected ? neuColors.accent : neuColors.surfaceInset}
                      style={styles.pillOptionSmall}
                    >
                      <Text style={[styles.pillOptionTextSmall, selected && styles.pillOptionTextSelected]}>{option.label}</Text>
                    </NeumorphicView>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.visibilityPickerRow}>
              {VISIBILITY_OPTIONS.map(option => {
                const selected = newItemVisibility === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    onPress={() => setNewItemVisibility(option.key)}
                    accessibilityRole="button"
                    accessibilityLabel={option.label}
                    accessibilityState={{ selected }}
                  >
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
              {newItemVisibility === 'SHARED' ? (
                <TouchableOpacity
                  onPress={() => setAddAssigneeSheetOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`New item, in charge: ${addAssigneeName}. Tap to change`}
                >
                  <NeumorphicView variant="inset" size="sm" radius={neuRadii.sm} style={styles.pillOption}>
                    <Text style={styles.pillOptionText}>In charge: {addAssigneeName} ▾</Text>
                  </NeumorphicView>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}
        <View style={styles.addRow}>
          <NeuTextInput
            value={newItemLabel}
            onChangeText={setNewItemLabel}
            onFocus={() => setAddOptionsOpen(true)}
            placeholder={category === 'GROCERY' ? 'Add a grocery item' : 'Add a packing item'}
            onSubmitEditing={handleAdd}
            style={styles.addInput}
          />
          <NeuButton label="Add" variant="primary" onPress={handleAdd} style={styles.addButton} />
        </View>
      </View>

      <ChecklistItemSheet
        visible={!!sheetItem}
        title={sheetItem && isPersonal(sheetItem) ? text.categoryNoun : undefined}
        showMembers={!!sheetItem && !isPersonal(sheetItem)}
        subtitle={sheetItem ? `${sheetItem.label} · ${categoryLabelOf(categoryValueOf(sheetItem, category), category)}` : ''}
        members={members}
        currentUserId={currentUserId}
        assignedToUserId={sheetItem?.assignedToUserId ?? null}
        onAssign={userId => sheetItem && onAssign(sheetItem.id, userId)}
        categoryLabel={text.categoryNoun}
        categoryOptions={categoryOptions}
        category={sheetItem ? categoryValueOf(sheetItem, category) : null}
        onChangeCategory={value => sheetItem && onChangeItemCategory(sheetItem.id, value)}
        onClose={() => setSheetItemId(null)}
      />

      <ChecklistItemSheet
        visible={addAssigneeSheetOpen}
        subtitle="New item"
        members={members}
        currentUserId={currentUserId}
        assignedToUserId={newItemAssignee}
        onAssign={setNewItemAssignee}
        onClose={() => setAddAssigneeSheetOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: neuSpacing.lg, backgroundColor: neuColors.background },
  viewSwitchSpacing: { marginTop: neuSpacing.sm },
  progressBlock: { marginTop: neuSpacing.md },
  progressTextRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  progressText: { fontSize: 12, fontWeight: '700', color: neuColors.textPrimary },
  progressPercent: { fontSize: 12, color: neuColors.textMuted },
  progressTrack: { height: 8, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: neuColors.accent, borderRadius: 4 },
  templateSpacing: { marginTop: neuSpacing.md },
  list: { flex: 1, marginTop: neuSpacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderTopWidth: 1, borderTopColor: neuColors.shadowDark },
  sectionTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: neuColors.textPrimary },
  sectionCount: { fontSize: 12, color: neuColors.textMuted },
  chevron: { fontSize: 16, color: neuColors.textMuted, width: 14, textAlign: 'center' },
  filterRow: { flexDirection: 'row', gap: neuSpacing.sm, marginVertical: neuSpacing.sm },
  todoHeading: { fontSize: 12, fontWeight: '700', color: neuColors.textPrimary, marginTop: 4 },
  nothingLeft: { fontSize: 12, color: neuColors.textMuted, marginVertical: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, gap: 8 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  checkbox: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  checkmark: { color: neuColors.white, fontSize: 13, fontWeight: '700' },
  labelColumn: { flex: 1 },
  label: { fontSize: 15, color: neuColors.textPrimary },
  labelChecked: { textDecorationLine: 'line-through', color: neuColors.textMuted },
  metaText: { fontSize: 11, color: neuColors.textMuted, marginTop: 2 },
  rightColumn: { alignItems: 'flex-end', gap: 4 },
  assigneeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingLeft: 2,
    paddingRight: 8,
    borderRadius: 14,
    backgroundColor: neuColors.white,
    borderWidth: 1,
    borderColor: neuColors.shadowLight,
    maxWidth: 110,
  },
  assigneeName: { fontSize: 11, color: neuColors.textPrimary, flexShrink: 1 },
  assignChip: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: neuColors.accent },
  assignChipText: { fontSize: 11, color: neuColors.accent, fontWeight: '600' },
  lock: { fontSize: 14 },
  convertLink: { color: neuColors.accent, fontSize: 11, fontWeight: '700' },
  empty: { color: neuColors.textMuted, fontStyle: 'italic', textAlign: 'center', marginTop: 24 },
  addArea: { marginTop: neuSpacing.sm },
  addOptions: { marginBottom: neuSpacing.sm },
  addOptionsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  addOptionsLabel: { fontSize: 11, fontWeight: '700', color: neuColors.textMuted },
  hideOptions: { fontSize: 11, fontWeight: '700', color: neuColors.accent },
  visibilityPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: neuSpacing.sm, marginTop: 10 },
  pillOption: { paddingVertical: 6, paddingHorizontal: 14 },
  pillOptionText: { fontSize: 11, fontWeight: '700', color: neuColors.textMuted },
  pillOptionTextSelected: { color: neuColors.white },
  categoryPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: neuSpacing.sm },
  pillOptionSmall: { paddingVertical: 6, paddingHorizontal: 12 },
  pillOptionTextSmall: { fontSize: 10, fontWeight: '700', color: neuColors.textMuted },
  addRow: { flexDirection: 'row', gap: neuSpacing.sm, alignItems: 'center' },
  addInput: { flex: 1, marginBottom: 0 },
  addButton: { width: 72, justifyContent: 'center' },
});