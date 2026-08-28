import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SettlementSection from './SettlementSection';

interface Props {
  tripId: string;
}

/**
 * FIN-05: thin screen wrapper around SettlementSection (see that file for
 * the actual balances/transfers/export logic) - kept as its own component
 * in case anything needs to navigate to the settlement view standalone,
 * outside the Expenses tab's collapsible section.
 */
export default function FinanceSummaryScreen({ tripId }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>Trip Settlement</Text>
        <SettlementSection tripId={tripId} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  header: { fontSize: 22, fontWeight: '700', marginBottom: 18 },
});
