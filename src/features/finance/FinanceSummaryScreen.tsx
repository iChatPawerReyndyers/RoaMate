import { useCallback, useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Cents } from '@/money/Cents';
import { apiClient } from '@/services/api/client';
import { useTrip } from '@/app/TripContext';

interface NetBalance {
  userId: string;
  totalPaidCents: number;
  totalFairShareCents: number;
  netDeltaCents: number;
}

interface SuggestedTransfer {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
}

interface SettlementSummary {
  tripId: string;
  balances: NetBalance[];
  suggestedTransfers: SuggestedTransfer[];
}

interface Props {
  tripId: string;
}

export default function FinanceSummaryScreen({ tripId }: Props) {
  const [summary, setSummary] = useState<SettlementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string>('');
  const navigation = useNavigation();
  const { currentTrip } = useTrip();
  const currency = currentTrip?.defaultCurrency ?? 'USD';

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    setExportStatus('');

    try {
      const result = await apiClient.get<SettlementSummary>(`/api/v1/finance/trips/${tripId}/settlement`);
      setSummary(result);
    } catch (err) {
      console.warn('Failed to load settlement summary', err);
      setError('Unable to load settlement summary at this time.');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const handleExport = async (format: 'csv' | 'pdf') => {
    setExportStatus(`Downloading ${format.toUpperCase()}...`);
    try {
      const buffer = await apiClient.download(`/api/v1/finance/trips/${tripId}/export/${format}`);
      setExportStatus(
        `Export ${format.toUpperCase()} ready, ${Math.round(buffer.byteLength / 1024)} KB received. ` +
          'Use your OS file tools to save this report when a file writer is available.',
      );
    } catch (err) {
      console.warn('Failed to export settlement', err);
      setExportStatus(`Export failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>Trip Settlement</Text>
        {loading ? <Text style={styles.message}>Loading settlement...</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {summary ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Balances</Text>
              {summary.balances.map(balance => (
                <View key={balance.userId} style={styles.balanceRow}>
                  <Text style={styles.balanceUser}>{balance.userId}</Text>
                  <Text style={styles.balanceValue}>{Cents.format(Cents.of(balance.netDeltaCents), currency)}</Text>
                </View>
              ))}
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Suggested Transfers</Text>
              {summary.suggestedTransfers.length === 0 ? (
                <Text style={styles.note}>Everyone is already settled up.</Text>
              ) : (
                summary.suggestedTransfers.map(transfer => (
                  <Text key={`${transfer.fromUserId}-${transfer.toUserId}`} style={styles.transferText}>
                    {transfer.fromUserId} → {transfer.toUserId}: {Cents.format(Cents.of(transfer.amountCents), currency)}
                  </Text>
                ))
              )}
            </View>
            <TouchableOpacity style={styles.kittyButton} onPress={() => navigation.navigate('KittyDeposit' as never)}>
              <Text style={styles.kittyButtonTitle}>Trip kitty</Text>
              <Text style={styles.kittyButtonSubtitle}>View contributions & log a deposit</Text>
            </TouchableOpacity>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.exportButton} onPress={() => handleExport('csv')}>
                <Text style={styles.exportButtonText}>Export CSV</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.exportButton} onPress={() => handleExport('pdf')}>
                <Text style={styles.exportButtonText}>Export PDF</Text>
              </TouchableOpacity>
            </View>
            {exportStatus ? <Text style={styles.message}>{exportStatus}</Text> : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  header: { fontSize: 22, fontWeight: '700', marginBottom: 18 },
  message: { color: '#555', marginVertical: 8 },
  error: { color: '#b00020', marginVertical: 8 },
  card: { backgroundColor: '#f5f8ff', borderRadius: 16, padding: 16, marginBottom: 16 },
  kittyButton: { backgroundColor: '#eef2ff', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#d7e3ff' },
  kittyButtonTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  kittyButtonSubtitle: { fontSize: 12, color: '#555' },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  balanceUser: { fontSize: 14, color: '#333' },
  balanceValue: { fontSize: 14, fontWeight: '700' },
  transferText: { fontSize: 14, color: '#333', marginBottom: 8 },
  note: { color: '#555', fontSize: 14 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  exportButton: { flex: 1, backgroundColor: '#2f6fed', borderRadius: 12, padding: 14, alignItems: 'center' },
  exportButtonText: { color: '#fff', fontWeight: '700' },
});
