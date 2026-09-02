import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Cents } from '@/money/Cents';
import { apiClient } from '@/services/api/client';
import NeuCard from '@/components/neumorphic/NeuCard';
import NeuTextInput from '@/components/neumorphic/NeuTextInput';
import NeuButton from '@/components/neumorphic/NeuButton';
import NeumorphicView from '@/components/neumorphic/NeumorphicView';
import { neuColors, neuRadii, neuSpacing } from '@/theme/neumorphic';

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
  currency: string;
}

/**
 * FIN-06: per-member deposit breakdown, e.g. "Alice: $2,000, Bob: $2,000,
 * Charlie: $0". Posts to the existing /kitty-deposits endpoints - those
 * already existed on the backend, this screen was the missing piece.
 */
export default function KittyDepositScreen({ tripId, tripMembers, currency }: Props) {
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
        <Text style={styles.total}>{Cents.format(Cents.of(totalCents), currency)}</Text>

        <NeuCard size="md" style={styles.card}>
          <Text style={styles.cardTitle}>Contributions</Text>
          {tripMembers.map((member, index) => (
            <View key={member.userId} style={[styles.row, index > 0 && styles.rowDivider]}>
              <Text style={styles.rowLabel}>{member.displayName}</Text>
              <Text style={styles.rowValue}>
                {Cents.format(Cents.of(totalsByUser.get(member.userId) ?? 0), currency)}
              </Text>
            </View>
          ))}
        </NeuCard>

        <NeuCard size="md" style={styles.card}>
          <Text style={styles.cardTitle}>Log a deposit</Text>
          <Text style={styles.label}>Member</Text>
          <View style={styles.memberRow}>
            {tripMembers.map(member => {
              const selected = depositorUserId === member.userId;
              return (
                <TouchableOpacity key={member.userId} onPress={() => setDepositorUserId(member.userId)}>
                  <NeumorphicView
                    variant={selected ? 'raised' : 'inset'}
                    size="sm"
                    radius={neuRadii.md}
                    backgroundColor={selected ? neuColors.accent : neuColors.surfaceInset}
                    style={styles.memberChip}
                  >
                    <Text style={[styles.memberChipText, selected && styles.memberChipTextActive]}>
                      {member.displayName}
                    </Text>
                  </NeumorphicView>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.label}>Amount</Text>
          <NeuTextInput
            value={amountDollars}
            onChangeText={setAmountDollars}
            keyboardType="decimal-pad"
            placeholder="0.00"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <NeuButton
            label={saving ? 'Saving…' : '+ Log a deposit'}
            variant="primary"
            onPress={handleLogDeposit}
            loading={saving}
            style={styles.submitButton}
          />
        </NeuCard>

        <Text style={styles.recentHeader}>Recent deposits</Text>
        {deposits
          .slice()
          .reverse()
          .map(deposit => (
            <Text key={deposit.id} style={styles.recentLine}>
              {displayName(deposit.depositorUserId)} · {Cents.format(Cents.of(deposit.amount), currency)}
            </Text>
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: neuColors.background },
  content: { padding: neuSpacing.lg },
  header: {
    fontSize: 11,
    fontWeight: '700',
    color: neuColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  total: { fontSize: 32, fontWeight: '700', marginTop: 4, marginBottom: 20, color: neuColors.textPrimary },
  card: { padding: 16, marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10, color: neuColors.textPrimary },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  rowDivider: { borderTopWidth: 1, borderTopColor: neuColors.shadowDark },
  rowLabel: { fontSize: 14, color: neuColors.textPrimary },
  rowValue: { fontSize: 14, fontWeight: '600', color: neuColors.textPrimary },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: neuColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 10,
    marginBottom: 8,
  },
  memberRow: { flexDirection: 'row', flexWrap: 'wrap', gap: neuSpacing.sm },
  memberChip: { paddingVertical: 7, paddingHorizontal: 14 },
  memberChipText: { fontSize: 12, fontWeight: '700', color: neuColors.textMuted },
  memberChipTextActive: { color: neuColors.white },
  error: { color: neuColors.danger, fontSize: 12, marginTop: 8 },
  submitButton: { marginTop: 14 },
  recentHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: neuColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  recentLine: { fontSize: 13, color: neuColors.textPrimary, marginBottom: 6 },
});