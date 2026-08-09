import React, { useCallback, useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ChecklistScreen from './ChecklistScreen';
import { apiClient } from '@/services/api/client';
import { getDeviceId } from '@/services/security/KeyManager';
import { useSync } from '@/sync/SyncContext';
import { TripStackParamList } from '@/app/navigation/TripStack';

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  assignedToUserId?: string;
  convertedExpenseId?: string;
}

interface Props {
  tripId: string;
}

export default function ChecklistContainer({ tripId }: Props) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const syncManager = useSync();
  const navigation = useNavigation<NativeStackNavigationProp<TripStackParamList, 'Checklist'>>();

  const loadItems = useCallback(async () => {
    try {
      const userId = await getDeviceId();
      const result = await apiClient.get<ChecklistItem[]>(
        `/api/v1/checklists/trips/${tripId}?category=PACKING&requestingUserId=${encodeURIComponent(userId)}`,
      );
      setItems(result);
    } catch (err) {
      console.warn('Failed to load checklist items', err);
    }
  }, [tripId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleToggle = async (itemId: string) => {
    const now = Date.now();
    await syncManager.enqueueEvent({
      tripId,
      eventType: 'CHECKLIST_ITEM_TOGGLED',
      clientTimestamp: now,
      payloadJson: JSON.stringify({ itemId, toggledAt: new Date(now).toISOString() }),
    });

    try {
      const updated = await apiClient.post<ChecklistItem>(`/api/v1/checklists/items/${itemId}/toggle`);
      setItems(prev => prev.map(item => (item.id === itemId ? updated : item)));
    } catch (err) {
      console.warn('Failed to toggle checklist item, queued for sync', err);
    }
  };

  const handleConvertToExpense = (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    navigation.navigate('AddExpense', {
      itemId: id,
      description: item.label,
    });
  };

  return (
    <ChecklistScreen
      title="Packing List"
      items={items}
      onToggle={handleToggle}
      onConvertToExpense={handleConvertToExpense}
    />
  );
}
