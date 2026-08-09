import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, SafeAreaView, StyleSheet, Switch, Text, View } from 'react-native';
import { Cents } from '@/money/Cents';
import { apiClient } from '@/services/api/client';

interface FlaggedExpense {
  id: string;
  description: string;
  totalAmountCents: number;
  expenseDateIso: string;
  createdByUserId: string;
  deleted: boolean;
}

interface DuplicateGroup {
  expenses: FlaggedExpense[];
}

interface Props {
  tripId: string;
}

/**
 * FIN-08: the human-in-the-loop review screen. Every group here is a
 * cluster the backend's DuplicateDetectionService flagged as matching on
 * amount + description + a 5-10 minute window (FIN-07). Nothing is ever
 * auto-deleted - each entry starts "checked" (kept) unless a prior
 * reviewer already unchecked it, and toggling a switch soft-deletes or
 * restores that single expense from every settlement calculation.
 */
export default function ConflictReviewDashboard({ tripId }: Props) {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.get<DuplicateGroup[]>(`/api/v1/finance/trips/${tripId}/duplicates`);
      setGroups(result);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleKeep = async (expense: FlaggedExpense) => {
    const nextKeep = expense.deleted; // currently deleted -> switching ON means "keep"
    // Optimistic local update so the switch feels instant offline too.
    setGroups(prev =>
      prev.map(group => ({
        expenses: group.expenses.map(e => (e.id === expense.id ? { ...e, deleted: !nextKeep } : e)),
      })),
    );
    try {
      await apiClient.post(`/api/v1/finance/expenses/${expense.id}/resolve-duplicate?keep=${nextKeep}`);
    } catch (err) {
      // Sync will reconcile on next reconnect; revert optimistic flip on failure.
      console.warn('Failed to resolve duplicate, will retry on next sync', err);
      load();
    }
  };

  if (!loading && groups.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No flagged expenses</Text>
          <Text style={styles.emptySubtitle}>Potential duplicates will show up here for the group to review.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Review Flagged Expenses</Text>
      <Text style={styles.subheader}>
        These entries matched on amount, description, and timing. Uncheck the ones that were duplicate
        entries — they'll be excluded from balances but not permanently erased.
      </Text>
      <FlatList
        data={groups}
        keyExtractor={(_, i) => `group-${i}`}
        renderItem={({ item: group }) => (
          <View style={styles.groupCard}>
            {group.expenses.map(expense => (
              <View key={expense.id} style={styles.expenseRow}>
                <View style={styles.expenseBody}>
                  <Text style={styles.description}>{expense.description}</Text>
                  <Text style={styles.meta}>
                    {Cents.format(expense.totalAmountCents as any)} · logged by {expense.createdByUserId} ·{' '}
                    {new Date(expense.expenseDateIso).toLocaleString()}
                  </Text>
                </View>
                <Switch value={!expense.deleted} onValueChange={() => toggleKeep(expense)} />
              </View>
            ))}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { fontSize: 18, fontWeight: '700' },
  subheader: { fontSize: 13, color: '#666', marginTop: 4, marginBottom: 16 },
  groupCard: { backgroundColor: '#fff8e6', borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#f0dfa0' },
  expenseRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  expenseBody: { flex: 1 },
  description: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12, color: '#777', marginTop: 2 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptySubtitle: { fontSize: 13, color: '#777', marginTop: 6, textAlign: 'center' },
});
