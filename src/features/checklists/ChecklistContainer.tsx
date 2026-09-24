import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/react';
import ChecklistScreen, { Item, NewItemOptions } from './ChecklistScreen';
import type { Member } from './checklistViews';
import { TemplateOption } from './TemplatePicker';
import { apiClient } from '@/services/api/client';
import { getCurrentUserId } from '@/services/security/KeyManager';
import { useSync } from '@/sync/SyncContext';
import { TripStackParamList } from '@/app/navigation/TripStack';
import { PACKING_TEMPLATES, GROCERY_TEMPLATE } from './templates';
import ChecklistTemplateModel from '@/db/models/ChecklistTemplate';

type Category = 'PACKING' | 'GROCERY';

interface Props {
  tripId: string;
}

/** CHK-01..04: category-aware checklist (Packing/Grocery), template seeding, and expense conversion. */
export default function ChecklistContainer({ tripId }: Props) {
  const [category, setCategory] = useState<Category>('PACKING');
  const [items, setItems] = useState<Item[]>([]);
  const [customTemplates, setCustomTemplates] = useState<TemplateOption[]>([]);
  // CHK-05: who can be put in charge of a shared item, and who "You" is.
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const syncManager = useSync();
  const database = useDatabase();
  // Rendered inside the Checklist tab (see TripTabs.tsx), so the nearest
  // stack ancestor is the 'Home' screen that hosts the tab navigator.
  const navigation = useNavigation<NativeStackNavigationProp<TripStackParamList, 'Home'>>();

  const loadItems = useCallback(async () => {
    try {
      const userId = await getCurrentUserId();
      const result = await apiClient.get<Item[]>(
        `/api/v1/checklists/trips/${tripId}?category=${category}&requestingUserId=${encodeURIComponent(userId)}`,
      );
      setItems(result);
    } catch (err) {
      console.warn('Failed to load checklist items', err);
    }
  }, [tripId, category]);

  const loadMembers = useCallback(async () => {
    try {
      setCurrentUserId(await getCurrentUserId());
      const result = await apiClient.get<{ userId: string; displayName: string }[]>(`/api/v1/trips/${tripId}/members`);
      setMembers(result.map(m => ({ userId: m.userId, displayName: m.displayName })));
    } catch (err) {
      // Without the list the sheet can only offer "Nobody yet" - items and everything else still work.
      console.warn('Failed to load trip members', err);
    }
  }, [tripId]);

  const loadCustomTemplates = useCallback(async () => {
    try {
      const records = await database
        .get<ChecklistTemplateModel>('checklist_templates')
        .query(Q.where('category', category))
        .fetch();
      setCustomTemplates(
        records.map(record => ({
          key: record.id,
          label: record.name,
          items: JSON.parse(record.itemsJson) as string[],
          isCustom: true,
        })),
      );
    } catch (err) {
      console.warn('Failed to load custom checklist templates', err);
    }
  }, [database, category]);

  useEffect(() => {
    loadItems();
    loadCustomTemplates();
  }, [loadItems, loadCustomTemplates]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const builtInTemplateOptions: TemplateOption[] = useMemo(() => {
    if (category === 'GROCERY') {
      return [{ key: 'grocery-default', label: 'Grocery', items: GROCERY_TEMPLATE }];
    }
    return Object.entries(PACKING_TEMPLATES).map(([label, items]) => ({
      key: `packing-${label}`,
      label,
      items,
    }));
  }, [category]);

  const templateOptions = [...builtInTemplateOptions, ...customTemplates];

  const addSingleItem = async (label: string, visibility: 'PERSONAL' | 'SHARED' = 'SHARED', options: NewItemOptions = {}) => {
    const userId = await getCurrentUserId();
    try {
      const created = await apiClient.post<Item>('/api/v1/checklists/items', {
        tripId,
        category,
        label,
        visibility,
        ownerUserId: userId,
        // CHK-05: only SHARED items can be put in someone's charge (the server rejects it for PERSONAL).
        ...(visibility === 'SHARED' && options.assignedToUserId ? { assignedToUserId: options.assignedToUserId } : {}),
        ...(category === 'GROCERY' ? { quantity: 1, priority: 'MEDIUM' } : {}),
        // The add bar's category is a PackingItemCategory name on the Packing tab and a store section on Grocery.
        ...(category === 'PACKING' && options.category ? { packingItemCategory: options.category } : {}),
        ...(category === 'GROCERY' && options.category ? { storeCategory: options.category } : {}),
      });
      setItems(prev => [...prev, created]);
    } catch (err) {
      console.warn('Failed to add checklist item', err);
    }
  };

  const handlePickTemplate = async (option: TemplateOption) => {
    for (const label of option.items) {
      // eslint-disable-next-line no-await-in-loop -- server assigns IDs; sequential keeps ordering predictable
      await addSingleItem(label);
    }
  };

  const handleSaveCurrentAsTemplate = async () => {
    if (items.length === 0) return;
    const name = `${category === 'GROCERY' ? 'Grocery' : 'Packing'} - saved ${new Date().toLocaleDateString()}`;

    await database.write(async () => {
      await database.get<ChecklistTemplateModel>('checklist_templates').create(record => {
        record.name = name;
        record.category = category;
        record.itemsJson = JSON.stringify(items.map(i => i.label));
        record.createdAt = Date.now();
      });
    });

    await loadCustomTemplates();
  };

  const handleToggle = async (itemId: string) => {
    const now = Date.now();
    await syncManager.enqueueEvent({
      tripId,
      eventType: 'CHECKLIST_ITEM_TOGGLED',
      clientTimestamp: now,
      payloadJson: JSON.stringify({ itemId, toggledAt: new Date(now).toISOString() }),
    });

    try {
      const updated = await apiClient.post<Item>(`/api/v1/checklists/items/${itemId}/toggle`);
      setItems(prev => prev.map(item => (item.id === itemId ? updated : item)));
    } catch (err) {
      console.warn('Failed to toggle checklist item, queued for sync', err);
    }
  };

  /**
   * Applies `change` to the item on screen immediately, then confirms it with
   * the server. If the server refuses (offline, not a member any more...) only
   * THAT item is put back the way it was and the person is told - so a
   * failure can't clobber other edits made in the meantime.
   */
  const updateItemOptimistically = async (itemId: string, change: Partial<Item>, save: () => Promise<Item>) => {
    const original = items.find(i => i.id === itemId);
    if (!original) return;
    setItems(prev => prev.map(i => (i.id === itemId ? { ...i, ...change } : i)));
    try {
      const saved = await save();
      setItems(prev => prev.map(i => (i.id === itemId ? saved : i)));
    } catch (err) {
      console.warn('Failed to update checklist item', err);
      setItems(prev => prev.map(i => (i.id === itemId ? original : i)));
      Alert.alert("Couldn't save that change", 'Check your connection and try again.');
    }
  };

  const handleAssign = (itemId: string, userId: string | null) =>
    updateItemOptimistically(itemId, { assignedToUserId: userId }, () =>
      apiClient.post<Item>(`/api/v1/checklists/items/${itemId}/assignee`, { assignedToUserId: userId }),
    );

  const handleChangeItemCategory = (itemId: string, value: string | null) =>
    updateItemOptimistically(
      itemId,
      category === 'PACKING'
        ? { packingItemCategory: value as Item['packingItemCategory'] }
        : { storeCategory: value },
      () => apiClient.post<Item>(`/api/v1/checklists/items/${itemId}/category`, { category: value }),
    );

  const handleConvertToExpense = (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    navigation.navigate('SelectPaymentSource', {
      itemId: id,
      description: item.label,
    });
  };

  return (
    <ChecklistScreen
      category={category}
      onChangeCategory={setCategory}
      items={items}
      members={members}
      currentUserId={currentUserId}
      onToggle={handleToggle}
      onConvertToExpense={handleConvertToExpense}
      onAddItem={addSingleItem}
      onAssign={handleAssign}
      onChangeItemCategory={handleChangeItemCategory}
      templateOptions={templateOptions}
      onPickTemplate={handlePickTemplate}
      onSaveCurrentAsTemplate={handleSaveCurrentAsTemplate}
    />
  );
}