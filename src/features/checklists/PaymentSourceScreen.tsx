import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Member {
  userId: string;
  displayName: string;
}

export type PaymentSourceChoice = { type: 'KITTY' } | { type: 'MEMBER'; userId: string };

interface Props {
  itemLabel: string;
  tripMembers: Member[];
  onContinue: (choice: PaymentSourceChoice) => void;
}

/**
 * CHK-04: explicit "who paid for this?" step between converting a checklist
 * item to an expense and the expense form itself - previously the flow
 * skipped straight to AddExpense with no payment source chosen at all.
 */
export default function PaymentSourceScreen({ itemLabel, tripMembers, onContinue }: Props) {
  const [selected, setSelected] = React.useState<PaymentSourceChoice>({ type: 'KITTY' });

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Convert to expense</Text>
      <Text style={styles.subtitle}>"{itemLabel}" — who paid for this?</Text>

      <View style={styles.options}>
        <TouchableOpacity
          style={[styles.option, selected.type === 'KITTY' && styles.optionSelected]}
          onPress={() => setSelected({ type: 'KITTY' })}
        >
          <Text style={[styles.optionText, selected.type === 'KITTY' && styles.optionTextSelected]}>
            Trip kitty
          </Text>
        </TouchableOpacity>
        {tripMembers.map(member => {
          const isSelected = selected.type === 'MEMBER' && selected.userId === member.userId;
          return (
            <TouchableOpacity
              key={member.userId}
              style={[styles.option, isSelected && styles.optionSelected]}
              onPress={() => setSelected({ type: 'MEMBER', userId: member.userId })}
            >
              <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                {member.displayName} paid
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity style={styles.continueButton} onPress={() => onContinue(selected)}>
        <Text style={styles.continueButtonText}>Continue to expense details</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  options: { gap: 8, marginBottom: 24 },
  option: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14 },
  optionSelected: { borderColor: '#2f6fed', borderWidth: 2, backgroundColor: '#eef2ff' },
  optionText: { fontSize: 14 },
  optionTextSelected: { fontWeight: '700', color: '#2f6fed' },
  continueButton: { backgroundColor: '#2f6fed', borderRadius: 10, padding: 14, alignItems: 'center' },
  continueButtonText: { color: '#fff', fontWeight: '700' },
});
