import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Cents } from '@/money/Cents';
import { apiClient } from '@/services/api/client';
import { useTrip } from '@/app/TripContext';
import NeumorphicView from '@/components/neumorphic/NeumorphicView';
import { neuColors, neuRadii, neuSpacing } from '@/theme/neumorphic';

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
  const { currentTrip } = useTrip();
  const currency = currentTrip?.defaultCurrency ?? 'USD';

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
        contentContainerStyle={styles.listContent}
        renderItem={({ item: group }) => (
          <NeumorphicView variant="raised" radius={neuRadii.lg} style={styles.groupCard}>
            {group.expenses.map((expense, index) => (
              <View key={expense.id} style={[styles.expenseRow, index > 0 && styles.expenseRowDivider]}>
                <View style={styles.expenseBody}>
                  <Text style={styles.description}>{expense.description}</Text>
                  <Text style={styles.meta}>
                    {Cents.format(Cents.of(expense.totalAmountCents), currency)} · logged by {expense.createdByUserId} ·{' '}
                    {new Date(expense.expenseDateIso).toLocaleString()}
                  </Text>
                </View>
                <Switch
                  value={!expense.deleted}
                  onValueChange={() => toggleKeep(expense)}
                  trackColor={{ false: neuColors.surfaceInset, true: neuColors.accent }}
                  thumbColor={neuColors.white}
                  ios_backgroundColor={neuColors.surfaceInset}
                />
              </View>
            ))}
          </NeumorphicView>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: neuSpacing.lg, backgroundColor: neuColors.background },
  header: { fontSize: 18, fontWeight: '700', color: neuColors.textPrimary },
  subheader: { fontSize: 13, color: neuColors.textMuted, marginTop: 4, marginBottom: 16, lineHeight: 18 },
  listContent: { paddingBottom: 24 },
  groupCard: {
    padding: 14,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(245, 166, 35, 0.35)',
  },
  expenseRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: neuSpacing.sm },
  expenseRowDivider: { borderTopWidth: 1, borderTopColor: neuColors.shadowDark },
  expenseBody: { flex: 1 },
  description: { fontSize: 15, fontWeight: '700', color: neuColors.textPrimary },
  meta: { fontSize: 11, color: neuColors.textMuted, marginTop: 2 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: neuColors.textPrimary },
  emptySubtitle: { fontSize: 13, color: neuColors.textMuted, marginTop: 6, textAlign: 'center' },
});