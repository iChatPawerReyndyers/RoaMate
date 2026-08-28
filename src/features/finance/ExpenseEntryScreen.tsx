import React, { useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Cents } from '@/money/Cents';
import { resolveFillRemainingBalance, PaymentLine } from './FillRemainingBalance';
import NeuTextInput from '@/components/neumorphic/NeuTextInput';
import NeuToggle from '@/components/neumorphic/NeuToggle';
import NeuButton from '@/components/neumorphic/NeuButton';
import { neuColors } from '@/theme/neumorphic';

interface Member {
  userId: string;
  displayName: string;
}

interface Props {
  tripMembers: Member[];
  initialDescription?: string;
  initialPaymentSource?: { source: 'KITTY' } | { source: 'MEMBER_ABONO'; payerUserId: string };
  onSubmit: (payload: {
    description: string;
    totalAmountCents: number;
    payments: { source: 'KITTY' | 'MEMBER_ABONO'; payerUserId?: string; amountCents: number }[];
    participantUserIds: string[];
  }) => void;
}

/** One row in the "Who paid?" list - Kitty plus one per trip member, matching the 7.1 mockup's persistent checkbox layout rather than an "add a line" pattern. */
interface PayerRow {
  key: string; // 'KITTY' or userId
  source: 'KITTY' | 'MEMBER_ABONO';
  payerUserId?: string;
  label: string;
  included: boolean;
  amountDollars: string; // '' = this row auto-fills the remaining balance
}

/**
 * FIN-01..04: multi-payer Abono entry screen, matching the 7.1 mockup -
 * description + total up top, a persistent "who paid" checklist (Kitty +
 * every trip member, each independently toggleable with its own amount and
 * a live balanced/unbalanced indicator), and a "split between" checklist
 * with a Select All row showing the live per-person cost.
 *
 * Previously "who paid" was an add-only list of chips with no way to
 * remove a line and no live feedback - amounts that didn't add up only
 * surfaced as a console.warn on submit, invisible to the person using the
 * app. Both are fixed here: every row can be freely checked/unchecked, and
 * the balance banner recomputes on every keystroke.
 */
export default function ExpenseEntryScreen({ tripMembers, initialDescription, initialPaymentSource, onSubmit }: Props) {
  const [description, setDescription] = useState(initialDescription ?? '');
  const [totalDollars, setTotalDollars] = useState('');

  const [payerRows, setPayerRows] = useState<PayerRow[]>(() => [
    { key: 'KITTY', source: 'KITTY', label: 'Shared trip kitty', included: initialPaymentSource?.source === 'KITTY', amountDollars: '' },
    ...tripMembers.map(m => ({
      key: m.userId,
      source: 'MEMBER_ABONO' as const,
      payerUserId: m.userId,
      label: m.displayName,
      included: initialPaymentSource?.source === 'MEMBER_ABONO' && initialPaymentSource.payerUserId === m.userId,
      amountDollars: '',
    })),
  ]);

  const [participantIds, setParticipantIds] = useState<Set<string>>(
    new Set(tripMembers.map(m => m.userId)),
  );

  const totalCents = useMemo(() => {
    const parsed = parseFloat(totalDollars || '0');
    return Number.isFinite(parsed) ? Cents.fromDollars(parsed) : Cents.of(0);
  }, [totalDollars]);

  const toggleIncluded = (key: string) => {
    setPayerRows(prev => prev.map(row => (row.key === key ? { ...row, included: !row.included } : row)));
  };

  const updateAmount = (key: string, dollars: string) => {
    setPayerRows(prev => prev.map(row => (row.key === key ? { ...row, amountDollars: dollars } : row)));
  };

  const fillRemaining = (key: string) => {
    setPayerRows(prev => prev.map(row => (row.key === key ? { ...row, amountDollars: '' } : row)));
  };

  const toggleParticipant = (userId: string) => {
    setParticipantIds(prev => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  const allSelected = participantIds.size === tripMembers.length && tripMembers.length > 0;
  const toggleSelectAll = () => {
    setParticipantIds(allSelected ? new Set() : new Set(tripMembers.map(m => m.userId)));
  };

  const includedLines = useMemo<PaymentLine[]>(
    () =>
      payerRows
        .filter(r => r.included)
        .map(r => ({
          source: r.source,
          payerUserId: r.payerUserId,
          amountCents: r.amountDollars === '' ? null : Cents.fromDollars(parseFloat(r.amountDollars) || 0),
        })),
    [payerRows],
  );

  /** Live "Total paid / Total bill" balance - recomputed on every keystroke, matching the mockup's inline validation rather than only checking on submit. */
  const balance = useMemo(() => {
    if (includedLines.length === 0) {
      return { status: 'empty' as const, message: 'Select who paid' };
    }
    try {
      const resolved = resolveFillRemainingBalance(totalCents, includedLines);
      const paidCents = resolved.reduce((sum, l) => Cents.add(sum, l.amountCents), Cents.of(0));
      return { status: 'balanced' as const, message: `Total paid ${Cents.formatPlain(paidCents)} / bill ${Cents.formatPlain(totalCents)} — balanced`, resolved };
    } catch (err: any) {
      return { status: 'error' as const, message: err.message as string };
    }
  }, [includedLines, totalCents]);

  const perPersonCents = participantIds.size > 0 ? Cents.of(Math.round(totalCents / participantIds.size)) : Cents.of(0);

  const handleSubmit = () => {
    if (!description.trim()) return;
    if (balance.status !== 'balanced') return; // banner already explains why - nothing further to surface here
    if (participantIds.size === 0) return;

    onSubmit({
      description,
      totalAmountCents: totalCents,
      payments: balance.resolved,
      participantUserIds: Array.from(participantIds),
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.label}>What was it for?</Text>
        <NeuTextInput value={description} onChangeText={setDescription} placeholder="Dinner at the harbor" />

        <Text style={styles.label}>Total amount</Text>
        <NeuTextInput
          value={totalDollars}
          onChangeText={setTotalDollars}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />

        <Text style={styles.sectionHeader}>Who paid? (Abono)</Text>
        {payerRows.map(row => (
          <View key={row.key} style={styles.payerRow}>
            <View style={styles.payerCheckboxLabel}>
              <NeuToggle value={row.included} onValueChange={() => toggleIncluded(row.key)} />
              <TouchableOpacity onPress={() => toggleIncluded(row.key)}>
                <Text style={styles.payerLabel}>{row.label}</Text>
              </TouchableOpacity>
            </View>
            {row.included && (
              <View style={styles.payerAmountGroup}>
                <NeuTextInput
                  style={styles.amountInput}
                  placeholder="fill remaining"
                  keyboardType="decimal-pad"
                  value={row.amountDollars}
                  onChangeText={v => updateAmount(row.key, v)}
                />
                <TouchableOpacity onPress={() => fillRemaining(row.key)}>
                  <Text style={styles.fillRestButton}>Fill rest</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        <View style={[styles.balanceBanner, balance.status === 'balanced' ? styles.balanceBannerOk : balance.status === 'error' ? styles.balanceBannerError : styles.balanceBannerNeutral]}>
          <Text style={balance.status === 'balanced' ? styles.balanceTextOk : balance.status === 'error' ? styles.balanceTextError : styles.balanceTextNeutral}>
            {balance.message}
          </Text>
        </View>

        <View style={styles.splitHeaderRow}>
          <Text style={styles.splitHeaderText}>Split between</Text>
          <View style={styles.selectAllRow}>
            <NeuToggle value={allSelected} onValueChange={toggleSelectAll} />
            <TouchableOpacity onPress={toggleSelectAll}>
              <Text style={styles.selectAllLabel}>Select all</Text>
            </TouchableOpacity>
          </View>
        </View>
        {participantIds.size > 0 && (
          <Text style={styles.perPersonHint}>
            {participantIds.size} member{participantIds.size === 1 ? '' : 's'} — {Cents.formatPlain(perPersonCents)} each
          </Text>
        )}
        {tripMembers.map(m => (
          <View key={m.userId} style={styles.participantRow}>
            <Text style={styles.participantName}>{m.displayName}</Text>
            <NeuToggle value={participantIds.has(m.userId)} onValueChange={() => toggleParticipant(m.userId)} />
          </View>
        ))}

        <NeuButton label="Save Expense" onPress={handleSubmit} style={styles.submitButton} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: neuColors.background },
  scroll: { padding: 16 },
  label: { fontSize: 13, fontWeight: '600', color: neuColors.textPrimary, marginTop: 12, marginBottom: 4 },
  sectionHeader: { fontSize: 15, fontWeight: '700', color: neuColors.textPrimary, marginTop: 20, marginBottom: 8 },
  payerRow: { paddingVertical: 8 },
  payerCheckboxLabel: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  payerLabel: { fontSize: 14, color: neuColors.textPrimary },
  payerAmountGroup: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, marginLeft: 52, marginBottom: 4 },
  amountInput: { width: 130 },
  fillRestButton: { color: neuColors.accent, fontSize: 12, fontWeight: '600' },
  balanceBanner: { flexDirection: 'row', alignItems: 'center', marginTop: 10, padding: 10, borderRadius: 8 },
  balanceBannerOk: { backgroundColor: '#DDF0E1' },
  balanceBannerError: { backgroundColor: '#FBE3E1' },
  balanceBannerNeutral: { backgroundColor: neuColors.surfaceInset },
  balanceTextOk: { color: '#2E7D4F', fontSize: 12, fontWeight: '600' },
  balanceTextError: { color: neuColors.danger, fontSize: 12, fontWeight: '600' },
  balanceTextNeutral: { color: neuColors.textMuted, fontSize: 12 },
  splitHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  splitHeaderText: { fontSize: 15, fontWeight: '700', color: neuColors.textPrimary },
  selectAllRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectAllLabel: { fontSize: 13, fontWeight: '600', color: neuColors.textPrimary },
  perPersonHint: { fontSize: 12, color: neuColors.textMuted, marginBottom: 8 },
  participantRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  participantName: { color: neuColors.textPrimary },
  submitButton: { marginTop: 24, marginBottom: 40 },
});