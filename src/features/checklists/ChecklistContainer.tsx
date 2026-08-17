import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/react';
import ChecklistScreen, { Item } from './ChecklistScreen';
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

  const addSingleItem = async (label: string, visibility: 'PERSONAL' | 'SHARED' = 'SHARED') => {
    const userId = await getCurrentUserId();
    try {
      const created = await apiClient.post<Item>('/api/v1/checklists/items', {
        tripId,
        category,
        label,
        visibility,
        ownerUserId: userId,
        ...(category === 'GROCERY' ? { quantity: 1, priority: 'MEDIUM' } : {}),
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
      onToggle={handleToggle}
      onConvertToExpense={handleConvertToExpense}
      onAddItem={addSingleItem}
      templateOptions={templateOptions}
      onPickTemplate={handlePickTemplate}
      onSaveCurrentAsTemplate={handleSaveCurrentAsTemplate}
    />
  );
}
