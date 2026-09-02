import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import NeuRadio from '@/components/neumorphic/NueRadio';
import NeuCard from '@/components/neumorphic/NeuCard';
import NeuButton from '@/components/neumorphic/NeuButton';
import { neuColors, neuSpacing } from '@/theme/neumorphic';

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
        <TouchableOpacity onPress={() => setSelected({ type: 'KITTY' })} activeOpacity={0.85}>
          <NeuCard size="md" style={styles.option}>
            <NeuRadio selected={selected.type === 'KITTY'} onSelect={() => setSelected({ type: 'KITTY' })} label="Trip kitty" />
          </NeuCard>
        </TouchableOpacity>
        {tripMembers.map(member => {
          const isSelected = selected.type === 'MEMBER' && selected.userId === member.userId;
          return (
            <TouchableOpacity
              key={member.userId}
              onPress={() => setSelected({ type: 'MEMBER', userId: member.userId })}
              activeOpacity={0.85}
            >
              <NeuCard size="md" style={styles.option}>
                <NeuRadio
                  selected={isSelected}
                  onSelect={() => setSelected({ type: 'MEMBER', userId: member.userId })}
                  label={`${member.displayName} paid`}
                />
              </NeuCard>
            </TouchableOpacity>
          );
        })}
      </View>

      <NeuButton label="Continue to expense details" variant="primary" onPress={() => onContinue(selected)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: neuColors.background, padding: neuSpacing.lg },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 4, color: neuColors.textPrimary },
  subtitle: { fontSize: 14, color: neuColors.textMuted, marginBottom: 20 },
  options: { gap: neuSpacing.sm, marginBottom: 24 },
  option: { padding: 14 },
});