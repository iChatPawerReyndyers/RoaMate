import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Cents } from '@/money/Cents';
import { apiClient } from '@/services/api/client';
import { getCurrentUserId } from '@/services/security/KeyManager';
import { useTrip } from '@/app/TripContext';
import { useSync } from '@/sync/SyncContext';
import { ExpenseDto } from '@/db/repositories/expensesRepository';
import ExpenseEntryScreen from './ExpenseEntryScreen';
import KittyDepositScreen from './KittyDepositScreen';
import ConflictReviewDashboard from './ConflictReviewDashboard';
import SettlementSection from './SettlementSection';
import NeuCard from '@/components/neumorphic/NeuCard';
import NeumorphicView from '@/components/neumorphic/NeumorphicView';
import NeuSegmentedControl from '@/components/neumorphic/NeuSegmentedControl';
import { NeuEmptyState } from '@/components/neumorphic/NueModal';
import { neuColors } from '@/theme/neumorphic';

interface Props {
  tripId: string;
}

type AddTab = 'expense' | 'kitty';

/** FIN-09: the + button's modal now covers both "log a purchase" and "log a kitty deposit" - see the modal's segmented control below. Expense stays the default tab per direct request, since it's the far more common of the two actions. */
const ADD_TABS: { key: AddTab; label: string }[] = [
  { key: 'expense', label: 'Expense' },
  { key: 'kitty', label: 'Kitty' },
];

/**
 * FIN-01/05/08/09: the Expenses tab's main view - a scrollable list of every
 * expense (duplicate-flagged ones marked with a danger-colored edge
 * stripe, since a flat border reads oddly against the neumorphic raised-
 * card language), a floating + button that opens an Expense/Kitty tabbed
 * modal (Expense selected by default - see ADD_TABS) instead of navigating
 * away, and an expandable "Trip settlement" section at the bottom that
 * shows the same content as the old standalone Settlement tab (see
 * SettlementSection.tsx).
 * Reviewing/resolving duplicates is a different kind of action
 * (soft-deletes an expense from balances) rather than a display concern,
 * so it stays as its own modal via the "Review duplicates" link instead
 * of being folded into each row.
 */
export default function ExpensesHubScreen({ tripId }: Props) {
  const [expenses, setExpenses] = useState<ExpenseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addTab, setAddTab] = useState<AddTab>('expense');
  const [duplicatesModalVisible, setDuplicatesModalVisible] = useState(false);
  const [settlementExpanded, setSettlementExpanded] = useState(false);
  const { currentTrip } = useTrip();
  const syncManager = useSync();

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<ExpenseDto[]>(`/api/v1/finance/trips/${tripId}/expenses`);
      setExpenses(result);
    } catch (err) {
      console.warn('Failed to load expenses', err);
      setError('Unable to load expenses right now.');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  // Mirrors ItineraryContainer's pattern: this tab never unmounts once the
  // trip is open, so a mount-only effect would miss expenses added via the
  // modal below or reordered/resolved elsewhere - useFocusEffect re-runs it
  // every time the tab (re)gains focus too.
  useFocusEffect(
    useCallback(() => {
      loadExpenses();
    }, [loadExpenses]),
  );

  const duplicateCount = expenses.filter(e => e.flaggedDuplicate).length;

  const handleSubmitExpense = async (payload: {
    description: string;
    totalAmountCents: number;
    payments: { source: 'KITTY' | 'MEMBER_ABONO'; payerUserId?: string; amountCents: number }[];
    participantShares: { userId: string; amountCents: number }[];
  }) => {
    const expensePayload = {
      ...payload,
      tripId,
      createdByUserId: await getCurrentUserId(),
      expenseDate: new Date().toISOString(),
      category: null,
    };
    try {
      await apiClient.post('/api/v1/finance/expenses', expensePayload);
    } catch (err) {
      // FIN-01/03: same offline-queue fallback as TripStack's AddExpense
      // route - a failed post here queues for the next sync instead of the
      // expense silently vanishing.
      console.warn('Failed to submit expense, queued for sync', err);
      await syncManager.enqueueEvent({
        tripId,
        eventType: 'EXPENSE_CREATED',
        clientTimestamp: Date.now(),
        payloadJson: JSON.stringify(expensePayload),
      });
    }
    setAddModalVisible(false);
    loadExpenses();
  };

  // Outer wrapper deliberately a plain View, not SafeAreaView: this screen
  // is a tab embedded inside TripTabs, which sits inside TripHomeScreen's
  // own SafeAreaView - stacking a second one here just doubles up the same
  // top/bottom inset as dead space. The two <Modal> SafeAreaViews below are
  // NOT the same situation and are kept as-is: RN's Modal renders as its
  // own separate native layer outside this component's view hierarchy, so
  // it doesn't inherit TripHomeScreen's safe-area handling at all - those
  // two genuinely need their own.
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Text style={styles.header}>Expenses</Text>
          {duplicateCount > 0 ? (
            <TouchableOpacity onPress={() => setDuplicatesModalVisible(true)}>
              <Text style={styles.reviewDuplicatesLink}>
                Review {duplicateCount} possible duplicate{duplicateCount === 1 ? '' : 's'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {loading ? <ActivityIndicator style={styles.spinner} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!loading && expenses.length === 0 && !error ? (
          <NeuEmptyState icon="🧾" title="No expenses yet" description="Tap the + button to add your first expense for this trip." />
        ) : null}

        {expenses.map(expense => (
          <NeuCard key={expense.id} size="md" style={styles.expenseCard}>
            {expense.flaggedDuplicate ? <View style={styles.duplicateEdge} /> : null}
            <View style={styles.expenseRowTop}>
              <Text style={styles.expenseDescription} numberOfLines={1}>
                {expense.description}
              </Text>
              <Text style={styles.expenseAmount}>{Cents.formatPlain(Cents.of(expense.totalAmountCents))}</Text>
            </View>
            <View style={styles.expenseRowBottom}>
              <Text style={styles.expenseMeta}>
                {expense.createdByUserId} · {new Date(expense.expenseDate).toLocaleDateString()}
              </Text>
              {expense.flaggedDuplicate ? <Text style={styles.duplicateTag}>Possible duplicate</Text> : null}
            </View>
          </NeuCard>
        ))}

        <TouchableOpacity onPress={() => setSettlementExpanded(prev => !prev)} activeOpacity={0.85}>
          <NeuCard size="sm" style={styles.settlementHeader}>
            <View style={styles.settlementHeaderRow}>
              <Text style={styles.settlementHeaderText}>Trip settlement</Text>
              <Text style={styles.settlementChevron}>{settlementExpanded ? '▾' : '▸'}</Text>
            </View>
          </NeuCard>
        </TouchableOpacity>
        {settlementExpanded ? (
          <View style={styles.settlementContent}>
            <SettlementSection tripId={tripId} />
          </View>
        ) : null}
      </ScrollView>

      <TouchableOpacity
        onPress={() => {
          // Always reopens on the Expense tab, per direct request - the far
          // more common of the two actions, regardless of which tab was
          // last used.
          setAddTab('expense');
          setAddModalVisible(true);
        }}
        style={styles.fabTouchable}
        activeOpacity={0.85}
      >
        <NeumorphicView variant="raised" size="fab" radius={28} backgroundColor={neuColors.accent} style={styles.fab}>
          <Text style={styles.fabIcon}>+</Text>
        </NeumorphicView>
      </TouchableOpacity>

      <Modal visible={addModalVisible} animationType="slide" onRequestClose={() => setAddModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setAddModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>
          <View style={styles.addTabsWrap}>
            <NeuSegmentedControl options={ADD_TABS} value={addTab} onChange={setAddTab} />
          </View>
          {addTab === 'expense' ? (
            <ExpenseEntryScreen tripMembers={currentTrip?.members ?? []} onSubmit={handleSubmitExpense} />
          ) : (
            <KittyDepositScreen
              tripId={tripId}
              tripMembers={currentTrip?.members ?? []}
              currency={currentTrip?.defaultCurrency ?? 'USD'}
            />
          )}
        </SafeAreaView>
      </Modal>

      <Modal
        visible={duplicatesModalVisible}
        animationType="slide"
        onRequestClose={() => setDuplicatesModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setDuplicatesModalVisible(false);
                loadExpenses();
              }}
            >
              <Text style={styles.modalCancel}>Done</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Review duplicates</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>
          <ConflictReviewDashboard tripId={tripId} />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: neuColors.background },
  scroll: { padding: 16, paddingBottom: 100 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  header: { fontSize: 20, fontWeight: '700', color: neuColors.textPrimary },
  reviewDuplicatesLink: { fontSize: 12, fontWeight: '700', color: neuColors.accent },
  spinner: { marginVertical: 16 },
  error: { color: neuColors.danger, marginBottom: 12 },
  expenseCard: { padding: 14, marginBottom: 12 },
  duplicateEdge: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, backgroundColor: neuColors.danger },
  expenseRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  expenseDescription: { fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8, color: neuColors.textPrimary },
  expenseAmount: { fontSize: 14, fontWeight: '700', color: neuColors.textPrimary },
  expenseRowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  expenseMeta: { fontSize: 12, color: neuColors.textMuted },
  duplicateTag: { fontSize: 11, fontWeight: '700', color: neuColors.danger },
  settlementHeader: { padding: 14, marginTop: 8 },
  settlementHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settlementHeaderText: { fontSize: 15, fontWeight: '700', color: neuColors.textPrimary },
  settlementChevron: { fontSize: 14, color: neuColors.textMuted },
  settlementContent: { marginTop: 10 },
  fabTouchable: { position: 'absolute', right: 20, bottom: 24 },
  fab: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  fabIcon: { color: neuColors.white, fontSize: 28, fontWeight: '300', marginTop: -2 },
  modalContainer: { flex: 1, backgroundColor: neuColors.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: neuColors.shadowDark,
  },
  modalCancel: { fontSize: 14, color: neuColors.accent, fontWeight: '600' },
  modalTitle: { fontSize: 15, fontWeight: '700', color: neuColors.textPrimary },
  modalHeaderSpacer: { width: 50 },
  addTabsWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
});