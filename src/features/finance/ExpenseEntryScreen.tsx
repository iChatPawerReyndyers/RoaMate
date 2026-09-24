import React, { useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Cents } from '@/money/Cents';
import { computeFillRestAmount, resolveEvenSplitRemaining, SplitLine } from './FillRemainingBalance';
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
    participantShares: { userId: string; amountCents: number }[];
  }) => void;
}

/** One row in the "Who paid?" list - Kitty plus one per trip member, matching the 7.1 mockup's persistent checkbox layout rather than an "add a line" pattern. */
interface PayerRow {
  key: string; // 'KITTY' or userId
  source: 'KITTY' | 'MEMBER_ABONO';
  payerUserId?: string;
  label: string;
  included: boolean;
  amountDollars: string; // '' = share of whatever's left, split evenly among every other blank row
}

/** One row in the "Split between" list - one per trip member, same shape/behavior as PayerRow's amount field (see FIN-04 doc comment below). */
interface SplitRow {
  userId: string;
  label: string;
  included: boolean;
  amountDollars: string; // '' = share of whatever's left, split evenly among every other blank row
}

/**
 * FIN-01/04: keeps an amount field numeric-only, digits and a single
 * decimal point, capped at 3 decimal places (one more than
 * Cents.fromDollars actually keeps - it rounds to the nearest cent - but
 * the field accepts the extra precision per direct request rather than
 * silently truncating what the person typed). Shared by both the "Who
 * paid" and "Split between" amount inputs.
 */
function sanitizeAmountInput(raw: string): string {
  let cleaned = raw.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot !== -1) {
    cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
    const [whole = '', fraction = ''] = cleaned.split('.');
    cleaned = fraction.length > 3 ? `${whole}.${fraction.slice(0, 3)}` : cleaned;
  }
  return cleaned;
}

/** Cents -> the plain "300.00" string an amount field holds (no thousands separators, unlike Cents.formatPlain). */
function formatDollarsField(cents: Cents): string {
  return Cents.toDollars(cents).toFixed(2);
}

/**
 * FIN-01..04: multi-payer Abono entry screen, matching the 7.1 mockup -
 * description + total up top, a persistent "who paid" checklist (Kitty +
 * every trip member), and a "split between" checklist - both sections now
 * share the identical pattern: each row can be freely checked/unchecked,
 * carries its own optional amount (left blank to auto-split whatever's
 * left evenly with any other blank rows in that same section - see
 * resolveEvenSplitRemaining), and a live balance banner blocks submission
 * with a specific error until that section's amounts add up to the total.
 *
 * "Split between" previously had no per-person amount at all - cost was
 * always split dead-even across everyone selected, with no way to record
 * that e.g. one person's dinner cost more than everyone else's. "Who
 * paid" previously used the stricter resolveFillRemainingBalance, which
 * only allowed a single blank/auto-fill line at a time; both sections now
 * use resolveEvenSplitRemaining instead, which allows any number of blank
 * rows and splits the remainder evenly between them.
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

  const [splitRows, setSplitRows] = useState<SplitRow[]>(() =>
    tripMembers.map(m => ({ userId: m.userId, label: m.displayName, included: true, amountDollars: '' })),
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

  /** "Fill rest" on a payer row: puts whatever the OTHER included payers haven't covered into this row's field. */
  const fillRemaining = (key: string) => {
    const rest = computeFillRestAmount(totalCents, includedPayerLines, key);
    setPayerRows(prev => prev.map(row => (row.key === key ? { ...row, amountDollars: formatDollarsField(rest) } : row)));
  };

  const toggleSplitIncluded = (userId: string) => {
    setSplitRows(prev => prev.map(row => (row.userId === userId ? { ...row, included: !row.included } : row)));
  };

  const updateSplitAmount = (userId: string, dollars: string) => {
    setSplitRows(prev => prev.map(row => (row.userId === userId ? { ...row, amountDollars: dollars } : row)));
  };

  /** "Fill rest" on a split row: same behavior as fillRemaining above, for the "Split between" list. */
  const fillSplitRemaining = (userId: string) => {
    const rest = computeFillRestAmount(totalCents, includedSplitLines, userId);
    setSplitRows(prev => prev.map(row => (row.userId === userId ? { ...row, amountDollars: formatDollarsField(rest) } : row)));
  };

  const allSelected = splitRows.length > 0 && splitRows.every(r => r.included);
  const toggleSelectAll = () => {
    setSplitRows(prev => prev.map(row => ({ ...row, included: !allSelected })));
  };

  const includedPayerLines = useMemo<SplitLine[]>(
    () =>
      payerRows
        .filter(r => r.included)
        .map(r => ({
          key: r.key,
          amountCents: r.amountDollars === '' ? null : Cents.fromDollars(parseFloat(r.amountDollars) || 0),
        })),
    [payerRows],
  );

  /** Live "Who paid" balance - recomputed on every keystroke, matching the mockup's inline validation rather than only checking on submit. */
  const payerBalance = useMemo(() => {
    if (includedPayerLines.length === 0) {
      return { status: 'empty' as const, message: 'Select who paid' };
    }
    return resolveEvenSplitRemaining(totalCents, includedPayerLines);
  }, [includedPayerLines, totalCents]);

  const payments = useMemo(() => {
    if (payerBalance.status !== 'balanced' || !payerBalance.resolvedById) return null;
    const resolvedById = payerBalance.resolvedById;
    return payerRows
      .filter(r => r.included)
      .map(r => ({ source: r.source, payerUserId: r.payerUserId, amountCents: resolvedById.get(r.key) as Cents }));
  }, [payerBalance, payerRows]);

  const includedSplitLines = useMemo<SplitLine[]>(
    () =>
      splitRows
        .filter(r => r.included)
        .map(r => ({
          key: r.userId,
          amountCents: r.amountDollars === '' ? null : Cents.fromDollars(parseFloat(r.amountDollars) || 0),
        })),
    [splitRows],
  );

  /** Live "Split between" balance - same shape/behavior as payerBalance above. */
  const splitBalance = useMemo(() => {
    if (includedSplitLines.length === 0) {
      return { status: 'empty' as const, message: 'Select who this expense is split between' };
    }
    return resolveEvenSplitRemaining(totalCents, includedSplitLines);
  }, [includedSplitLines, totalCents]);

  const participantShares = useMemo(() => {
    if (splitBalance.status !== 'balanced' || !splitBalance.resolvedById) return null;
    const resolvedById = splitBalance.resolvedById;
    return splitRows
      .filter(r => r.included)
      .map(r => ({ userId: r.userId, amountCents: resolvedById.get(r.userId) as Cents }));
  }, [splitBalance, splitRows]);

  const handleSubmit = () => {
    if (!description.trim()) return;
    if (!payments) return; // banner already explains why - nothing further to surface here
    if (!participantShares) return; // same for the split-between banner

    onSubmit({
      description,
      totalAmountCents: totalCents,
      payments,
      participantShares,
    });
  };

  const renderBalanceBanner = (balance: { status: 'empty' | 'balanced' | 'error'; message: string }) => (
    <View
      style={[
        styles.balanceBanner,
        balance.status === 'balanced' ? styles.balanceBannerOk : balance.status === 'error' ? styles.balanceBannerError : styles.balanceBannerNeutral,
      ]}
    >
      <Text style={balance.status === 'balanced' ? styles.balanceTextOk : balance.status === 'error' ? styles.balanceTextError : styles.balanceTextNeutral}>
        {balance.message}
      </Text>
    </View>
  );

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
              <TouchableOpacity style={styles.payerLabelTouchable} onPress={() => toggleIncluded(row.key)}>
                <Text style={styles.payerLabel} numberOfLines={1}>{row.label}</Text>
              </TouchableOpacity>
            </View>
            {row.included && (
              <View style={styles.payerAmountGroup}>
                <NeuTextInput
                  style={styles.amountInput}
                  placeholder="0.000"
                  keyboardType="decimal-pad"
                  value={row.amountDollars}
                  onChangeText={v => updateAmount(row.key, sanitizeAmountInput(v))}
                />
                <TouchableOpacity onPress={() => fillRemaining(row.key)}>
                  <Text style={styles.fillRestButton}>Fill rest</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        {renderBalanceBanner(payerBalance)}

        <View style={styles.splitHeaderRow}>
          <Text style={styles.splitHeaderText}>Split between</Text>
          <View style={styles.selectAllRow}>
            <NeuToggle value={allSelected} onValueChange={toggleSelectAll} />
            <TouchableOpacity onPress={toggleSelectAll}>
              <Text style={styles.selectAllLabel}>Select all</Text>
            </TouchableOpacity>
          </View>
        </View>
        {splitRows.map(row => (
          <View key={row.userId} style={styles.payerRow}>
            <View style={styles.payerCheckboxLabel}>
              <NeuToggle value={row.included} onValueChange={() => toggleSplitIncluded(row.userId)} />
              <TouchableOpacity style={styles.payerLabelTouchable} onPress={() => toggleSplitIncluded(row.userId)}>
                <Text style={styles.payerLabel} numberOfLines={1}>{row.label}</Text>
              </TouchableOpacity>
            </View>
            {row.included && (
              <View style={styles.payerAmountGroup}>
                <NeuTextInput
                  style={styles.amountInput}
                  placeholder="0.000"
                  keyboardType="decimal-pad"
                  value={row.amountDollars}
                  onChangeText={v => updateSplitAmount(row.userId, sanitizeAmountInput(v))}
                />
                <TouchableOpacity onPress={() => fillSplitRemaining(row.userId)}>
                  <Text style={styles.fillRestButton}>Fill rest</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        {renderBalanceBanner(splitBalance)}

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
  payerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    gap: 10,
  },
  payerCheckboxLabel: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1, minWidth: 0 },
  payerLabelTouchable: { flexShrink: 1, minWidth: 0 },
  payerLabel: { fontSize: 14, color: neuColors.textPrimary },
  payerAmountGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  amountInput: { width: 84 },
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
  submitButton: { marginTop: 24, marginBottom: 40 },
});