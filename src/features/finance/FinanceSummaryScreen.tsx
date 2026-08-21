import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDatabase } from '@nozbe/watermelondb/react';
import { Cents } from '@/money/Cents';
import { apiClient } from '@/services/api/client';
import { shareExport, ExportFormat } from '@/services/export/ExportShareService';
import { cacheExpensesFromServer, getCachedLocalExpenses, ExpenseDto } from '@/db/repositories/expensesRepository';
import { computeLocalSettlement } from './SettlementEngine';
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
  const [offline, setOffline] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [exportResult, setExportResult] = useState<{ ok: boolean; message: string } | null>(null);
  const navigation = useNavigation();
  const database = useDatabase();
  const { currentTrip } = useTrip();
  const currency = currentTrip?.defaultCurrency ?? 'USD';

  /**
   * FIN-05: tries the live, fully-accurate settlement (server-computed
   * suggested transfers included) first. On any network failure, falls
   * back to SettlementEngine.computeLocalSettlement() over whatever was
   * last cached by cacheExpensesFromServer - an instant, offline-capable
   * balance view with no suggested transfers (that min-cash-flow step only
   * runs server-side). If there's nothing cached yet either (e.g. this
   * device has never loaded this trip's expenses online), surfaces the
   * same error as before rather than a misleading empty balance list.
   */
  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    setExportResult(null);
    setOffline(false);

    try {
      const [result, expenses] = await Promise.all([
        apiClient.get<SettlementSummary>(`/api/v1/finance/trips/${tripId}/settlement`),
        apiClient.get<ExpenseDto[]>(`/api/v1/finance/trips/${tripId}/expenses`),
      ]);
      setSummary(result);
      // Keep the offline cache warm for next time - doesn't block the UI.
      cacheExpensesFromServer(database, tripId, expenses).catch(err =>
        console.warn('Failed to refresh offline expense cache', err),
      );
    } catch (err) {
      console.warn('Failed to load settlement summary from server, trying offline cache', err);
      try {
        const cachedExpenses = await getCachedLocalExpenses(database, tripId);
        if (cachedExpenses.length === 0) {
          throw new Error('No cached expenses available offline');
        }
        setSummary({ tripId, balances: computeLocalSettlement(cachedExpenses), suggestedTransfers: [] });
        setOffline(true);
      } catch (fallbackErr) {
        console.warn('No offline settlement data available either', fallbackErr);
        setError('Unable to load settlement summary at this time.');
      }
    } finally {
      setLoading(false);
    }
  }, [tripId, database]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const handleExport = async (format: ExportFormat) => {
    setExportingFormat(format);
    setExportResult(null);
    try {
      const buffer = await apiClient.download(`/api/v1/finance/trips/${tripId}/export/${format}`);
      await shareExport(currentTrip?.name ?? 'trip', format, buffer);
      setExportResult({
        ok: true,
        message: `Saved to trip-settlement.${format} · Share sheet opened`,
      });
    } catch (err) {
      console.warn('Failed to export settlement', err);
      setExportResult({
        ok: false,
        message: `Couldn't export ${format.toUpperCase()}. Check your connection and try again.`,
      });
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>Trip Settlement</Text>
        {loading ? <Text style={styles.message}>Loading settlement...</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && offline && summary ? (
          <Text style={styles.message}>Showing cached balances — you're offline, so this may be out of date.</Text>
        ) : null}
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
              {offline ? (
                <Text style={styles.note}>Suggested transfers aren't available offline — reconnect to see them.</Text>
              ) : summary.suggestedTransfers.length === 0 ? (
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
              <TouchableOpacity
                style={styles.exportButton}
                onPress={() => handleExport('pdf')}
                disabled={exportingFormat !== null}
              >
                {exportingFormat === 'pdf' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.exportButtonText}>Share PDF</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.exportButton}
                onPress={() => handleExport('csv')}
                disabled={exportingFormat !== null}
              >
                {exportingFormat === 'csv' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.exportButtonText}>Share CSV</Text>
                )}
              </TouchableOpacity>
            </View>
            {exportResult ? (
              <View style={[styles.exportBanner, exportResult.ok ? styles.exportBannerSuccess : styles.exportBannerError]}>
                <Text style={exportResult.ok ? styles.exportBannerTextSuccess : styles.exportBannerTextError}>
                  {exportResult.message}
                </Text>
              </View>
            ) : null}
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
  exportBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, padding: 10, borderRadius: 10 },
  exportBannerSuccess: { backgroundColor: '#e6f4ea' },
  exportBannerError: { backgroundColor: '#fdecea' },
  exportBannerTextSuccess: { color: '#1e7e34', fontSize: 12 },
  exportBannerTextError: { color: '#b00020', fontSize: 12 },
});