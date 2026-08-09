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
  onSubmit: (payload: {
    description: string;
    totalAmountCents: number;
    payments: { source: 'KITTY' | 'MEMBER_ABONO'; payerUserId?: string; amountCents: number }[];
    participantUserIds: string[];
  }) => void;
}

/**
 * FIN-01..04: multi-payer Abono entry screen. Mirrors the 7.1 mockup -
 * description + total up top, a dynamic list of "who paid" lines (any of
 * which can be left blank to auto-fill the remainder), and a checklist of
 * participants sharing the cost.
 */
export default function ExpenseEntryScreen({ tripMembers, initialDescription, onSubmit }: Props) {
  const [description, setDescription] = useState(initialDescription ?? '');
  const [totalDollars, setTotalDollars] = useState('');
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([
    { source: 'KITTY', amountCents: null },
  ]);
  const [participantIds, setParticipantIds] = useState<Set<string>>(
    new Set(tripMembers.map(m => m.userId)),
  );

  const totalCents = useMemo(() => {
    const parsed = parseFloat(totalDollars || '0');
    return Number.isFinite(parsed) ? Cents.fromDollars(parsed) : Cents.of(0);
  }, [totalDollars]);

  const addAbonoLine = (userId: string) => {
    setPaymentLines(prev => [...prev, { source: 'MEMBER_ABONO', payerUserId: userId, amountCents: null }]);
  };

  const updateLineAmount = (index: number, dollars: string) => {
    setPaymentLines(prev =>
      prev.map((line, i) =>
        i === index
          ? { ...line, amountCents: dollars === '' ? null : Cents.fromDollars(parseFloat(dollars) || 0) }
          : line,
      ),
    );
  };

  const toggleParticipant = (userId: string) => {
    setParticipantIds(prev => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  const handleSubmit = () => {
    try {
      const resolved = resolveFillRemainingBalance(totalCents, paymentLines);
      onSubmit({
        description,
        totalAmountCents: totalCents,
        payments: resolved,
        participantUserIds: Array.from(participantIds),
      });
    } catch (err: any) {
      // In production, surface via a toast/snackbar component.
      console.warn(err.message);
    }
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
        {paymentLines.map((line, i) => (
          <View key={i} style={styles.paymentRow}>
            <Text style={styles.payerLabel}>
              {line.source === 'KITTY' ? 'Kitty' : tripMembers.find(m => m.userId === line.payerUserId)?.displayName}
            </Text>
            <TextInput
              style={styles.amountInput}
              placeholder="fill remaining"
              keyboardType="decimal-pad"
              onChangeText={v => updateLineAmount(i, v)}
            />
          </View>
        ))}
        <View style={styles.addAbonoRow}>
          {tripMembers.map(m => (
            <TouchableOpacity key={m.userId} style={styles.addAbonoChip} onPress={() => addAbonoLine(m.userId)}>
              <Text style={styles.addAbonoChipText}>+ {m.displayName}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionHeader}>Split between</Text>
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
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  payerLabel: { fontSize: 14 },
  amountInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 6, width: 120, textAlign: 'right' },
  addAbonoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  addAbonoChip: { backgroundColor: '#eef2ff', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
  addAbonoChipText: { color: '#3b4ba0', fontSize: 12, fontWeight: '600' },
  participantRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  submitButton: { backgroundColor: '#2f6fed', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 24, marginBottom: 40 },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
