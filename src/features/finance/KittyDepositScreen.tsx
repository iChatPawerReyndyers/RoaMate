import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Cents } from '@/money/Cents';
import { apiClient } from '@/services/api/client';

interface KittyDeposit {
  id: string;
  depositorUserId: string;
  amount: number;
}

interface Member {
  userId: string;
  displayName: string;
}

interface Props {
  tripId: string;
  tripMembers: Member[];
}

/**
 * FIN-06: per-member deposit breakdown, e.g. "Alice: $2,000, Bob: $2,000,
 * Charlie: $0". Posts to the existing /kitty-deposits endpoints - those
 * already existed on the backend, this screen was the missing piece.
 */
export default function KittyDepositScreen({ tripId, tripMembers }: Props) {
  const [deposits, setDeposits] = useState<KittyDeposit[]>([]);
  const [depositorUserId, setDepositorUserId] = useState(tripMembers[0]?.userId ?? '');
  const [amountDollars, setAmountDollars] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDeposits = useCallback(async () => {
    try {
      const result = await apiClient.get<KittyDeposit[]>(`/api/v1/finance/trips/${tripId}/kitty-deposits`);
      setDeposits(result);
    } catch (err) {
      console.warn('Failed to load kitty deposits', err);
      setError('Unable to load kitty deposits right now.');
    }
  }, [tripId]);

  useEffect(() => {
    loadDeposits();
  }, [loadDeposits]);

  const totalsByUser = useMemo(() => {
    const totals = new Map<string, number>();
    for (const member of tripMembers) totals.set(member.userId, 0);
    for (const deposit of deposits) {
      totals.set(deposit.depositorUserId, (totals.get(deposit.depositorUserId) ?? 0) + deposit.amount);
    }
    return totals;
  }, [deposits, tripMembers]);

  const totalCents = Array.from(totalsByUser.values()).reduce((sum, v) => sum + v, 0);

  const displayName = (userId: string) => tripMembers.find(m => m.userId === userId)?.displayName ?? userId;

  const handleLogDeposit = async () => {
    const parsed = parseFloat(amountDollars);
    if (!depositorUserId || !Number.isFinite(parsed) || parsed <= 0) {
      setError('Choose a member and enter a valid amount.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await apiClient.post('/api/v1/finance/kitty-deposits', {
        tripId,
        depositorUserId,
        amount: Cents.fromDollars(parsed),
        depositedAt: new Date().toISOString(),
      });
      setAmountDollars('');
      await loadDeposits();
    } catch (err) {
      console.warn('Failed to log kitty deposit', err);
      setError('Unable to save this deposit right now.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>Shared trip kitty</Text>
        <Text style={styles.total}>{Cents.format(Cents.of(totalCents))}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contributions</Text>
          {tripMembers.map(member => (
            <View key={member.userId} style={styles.row}>
              <Text style={styles.rowLabel}>{member.displayName}</Text>
              <Text style={styles.rowValue}>
                {Cents.format(Cents.of(totalsByUser.get(member.userId) ?? 0))}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Log a deposit</Text>
          <Text style={styles.label}>Member</Text>
          <View style={styles.memberRow}>
            {tripMembers.map(member => (
              <TouchableOpacity
                key={member.userId}
                style={[styles.memberChip, depositorUserId === member.userId && styles.memberChipActive]}
                onPress={() => setDepositorUserId(member.userId)}
              >
                <Text
                  style={[styles.memberChipText, depositorUserId === member.userId && styles.memberChipTextActive]}
                >
                  {member.displayName}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.label}>Amount</Text>
          <TextInput
            style={styles.input}
            value={amountDollars}
            onChangeText={setAmountDollars}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity style={styles.submitButton} onPress={handleLogDeposit} disabled={saving}>
            <Text style={styles.submitButtonText}>{saving ? 'Saving…' : '+ Log a deposit'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.recentHeader}>Recent deposits</Text>
        {deposits
          .slice()
          .reverse()
          .map(deposit => (
            <Text key={deposit.id} style={styles.recentLine}>
              {displayName(deposit.depositorUserId)} · {Cents.format(Cents.of(deposit.amount))}
            </Text>
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  header: { fontSize: 18, fontWeight: '600', color: '#555' },
  total: { fontSize: 32, fontWeight: '700', marginBottom: 20 },
  card: { backgroundColor: '#f5f8ff', borderRadius: 16, padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  rowLabel: { fontSize: 14 },
  rowValue: { fontSize: 14, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '600', color: '#666', marginTop: 8, marginBottom: 6 },
  memberRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  memberChip: { backgroundColor: '#fff', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: '#ddd' },
  memberChipActive: { backgroundColor: '#2f6fed', borderColor: '#2f6fed' },
  memberChipText: { fontSize: 12, color: '#444', fontWeight: '600' },
  memberChipTextActive: { color: '#fff' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, backgroundColor: '#fff' },
  error: { color: '#b00020', fontSize: 12, marginTop: 8 },
  submitButton: { backgroundColor: '#2f6fed', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 12 },
  submitButtonText: { color: '#fff', fontWeight: '700' },
  recentHeader: { fontSize: 13, fontWeight: '700', color: '#555', marginBottom: 8 },
  recentLine: { fontSize: 13, color: '#444', marginBottom: 6 },
});
