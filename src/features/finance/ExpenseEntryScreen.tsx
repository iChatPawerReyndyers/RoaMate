import React, { useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View, StyleSheet, Switch } from 'react-native';
import { Cents } from '@/money/Cents';
import { resolveFillRemainingBalance, PaymentLine } from './FillRemainingBalance';

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
      return { status: 'balanced' as const, message: `Total paid ${Cents.format(paidCents)} / bill ${Cents.format(totalCents)} — balanced`, resolved };
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
        <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Dinner at the harbor" />

        <Text style={styles.label}>Total amount</Text>
        <TextInput
          style={styles.input}
          value={totalDollars}
          onChangeText={setTotalDollars}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />

        <Text style={styles.sectionHeader}>Who paid? (Abono)</Text>
        {payerRows.map(row => (
          <View key={row.key} style={styles.payerRow}>
            <TouchableOpacity style={styles.payerCheckboxLabel} onPress={() => toggleIncluded(row.key)}>
              <Switch value={row.included} onValueChange={() => toggleIncluded(row.key)} />
              <Text style={styles.payerLabel}>{row.label}</Text>
            </TouchableOpacity>
            {row.included && (
              <View style={styles.payerAmountGroup}>
                <TextInput
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
          <TouchableOpacity style={styles.selectAllRow} onPress={toggleSelectAll}>
            <Switch value={allSelected} onValueChange={toggleSelectAll} />
            <Text style={styles.selectAllLabel}>Select all</Text>
          </TouchableOpacity>
        </View>
        {participantIds.size > 0 && (
          <Text style={styles.perPersonHint}>
            {participantIds.size} member{participantIds.size === 1 ? '' : 's'} — {Cents.format(perPersonCents)} each
          </Text>
        )}
        {tripMembers.map(m => (
          <View key={m.userId} style={styles.participantRow}>
            <Text>{m.displayName}</Text>
            <Switch value={participantIds.has(m.userId)} onValueChange={() => toggleParticipant(m.userId)} />
          </View>
        ))}

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Save Expense</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginTop: 4 },
  sectionHeader: { fontSize: 15, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  payerRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f2f2f2' },
  payerCheckboxLabel: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  payerLabel: { fontSize: 14 },
  payerAmountGroup: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, marginLeft: 52, marginBottom: 4 },
  amountInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 6, width: 120, textAlign: 'right' },
  fillRestButton: { color: '#3b4ba0', fontSize: 12, fontWeight: '600' },
  balanceBanner: { flexDirection: 'row', alignItems: 'center', marginTop: 10, padding: 10, borderRadius: 8 },
  balanceBannerOk: { backgroundColor: '#e6f4ea' },
  balanceBannerError: { backgroundColor: '#fdecea' },
  balanceBannerNeutral: { backgroundColor: '#f5f5f5' },
  balanceTextOk: { color: '#1e7e34', fontSize: 12, fontWeight: '600' },
  balanceTextError: { color: '#b00020', fontSize: 12, fontWeight: '600' },
  balanceTextNeutral: { color: '#777', fontSize: 12 },
  splitHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  splitHeaderText: { fontSize: 15, fontWeight: '700' },
  selectAllRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectAllLabel: { fontSize: 13, fontWeight: '600' },
  perPersonHint: { fontSize: 12, color: '#666', marginBottom: 8 },
  participantRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  submitButton: { backgroundColor: '#2f6fed', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 24, marginBottom: 40 },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});