import React, { useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiClient } from '@/services/api/client';
import { getCurrentUserId } from '@/services/security/KeyManager';
import { useTrip } from '@/app/TripContext';
import ExpenseEntryScreen from './ExpenseEntryScreen';
import ConflictReviewDashboard from './ConflictReviewDashboard';
import FinanceSummaryScreen from './FinanceSummaryScreen';

interface Props {
  tripId: string;
}

type SubView = 'add' | 'duplicates' | 'settlement';

const SUB_VIEWS: { key: SubView; label: string }[] = [
  { key: 'add', label: 'Add expense' },
  { key: 'duplicates', label: 'Duplicates' },
  { key: 'settlement', label: 'Settlement' },
];

export default function ExpensesHubScreen({ tripId }: Props) {
  const [activeView, setActiveView] = useState<SubView>('add');
  const { currentTrip } = useTrip();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.segmentRow}>
        {SUB_VIEWS.map(view => {
          const isActive = activeView === view.key;
          return (
            <TouchableOpacity
              key={view.key}
              style={[styles.segment, isActive && styles.segmentActive]}
              onPress={() => setActiveView(view.key)}
            >
              <Text style={[styles.segmentLabel, isActive && styles.segmentLabelActive]}>{view.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.content}>
        {activeView === 'add' ? (
          <ExpenseEntryScreen
            tripMembers={currentTrip?.members ?? []}
            onSubmit={async payload => {
              try {
                await apiClient.post('/api/v1/finance/expenses', {
                  ...payload,
                  tripId,
                  createdByUserId: await getCurrentUserId(),
                  expenseDate: new Date().toISOString(),
                  category: null,
                });
                setActiveView('settlement');
              } catch (err) {
                console.warn('Failed to submit expense', err);
                Alert.alert("Couldn't save expense", 'Check your connection and try again.');
              }
            }}
          />
        ) : null}
        {activeView === 'duplicates' ? <ConflictReviewDashboard tripId={tripId} /> : null}
        {activeView === 'settlement' ? <FinanceSummaryScreen tripId={tripId} /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  segmentRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 10, gap: 8 },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7e3ff',
    alignItems: 'center',
  },
  segmentActive: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  segmentLabel: { fontSize: 12, fontWeight: '600', color: '#1d4ed8' },
  segmentLabelActive: { color: '#fff' },
  content: { flex: 1, marginTop: 8 },
});
