import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useDatabase } from '@nozbe/watermelondb/react';
import { Cents } from '@/money/Cents';
import { apiClient } from '@/services/api/client';
import { shareExport, ExportFormat } from '@/services/export/ExportShareService';
import { cacheExpensesFromServer, getCachedLocalExpenses, ExpenseDto } from '@/db/repositories/expensesRepository';
import { computeLocalSettlement } from './SettlementEngine';
import { useTrip } from '@/app/TripContext';
import NeuCard from '@/components/neumorphic/NeuCard';
import NeuButton from '@/components/neumorphic/NeuButton';
import NeuListRow from '@/components/neumorphic/NueListRow';
import { neuColors } from '@/theme/neumorphic';

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

/**
 * FIN-05: the balances/transfers/export content of the settlement view,
 * extracted out of FinanceSummaryScreen so it can render both as its own
 * screen (FinanceSummaryScreen, kept for any future standalone nav) and
 * inline inside ExpensesHubScreen's collapsible "Trip settlement" section -
 * no SafeAreaView/ScrollView here, the parent owns that.
 */
export default function SettlementSection({ tripId }: Props) {
  const [summary, setSummary] = useState<SettlementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const [exportResult, setExportResult] = useState<{ ok: boolean; message: string } | null>(null);
  const navigation = useNavigation();
  const database = useDatabase();
  const { currentTrip } = useTrip();

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
    <View>
      {loading ? <Text style={styles.message}>Loading settlement...</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && offline && summary ? (
        <Text style={styles.message}>Showing cached balances — you're offline, so this may be out of date.</Text>
      ) : null}
      {summary ? (
        <>
          <NeuCard style={styles.card}>
            <Text style={styles.cardTitle}>Balances</Text>
            {summary.balances.map(balance => (
              <View key={balance.userId} style={styles.balanceRow}>
                <Text style={styles.balanceUser}>{balance.userId}</Text>
                <Text style={styles.balanceValue}>{Cents.formatPlain(Cents.of(balance.netDeltaCents))}</Text>
              </View>
            ))}
          </NeuCard>
          <NeuCard style={styles.card}>
            <Text style={styles.cardTitle}>Suggested Transfers</Text>
            {offline ? (
              <Text style={styles.note}>Suggested transfers aren't available offline — reconnect to see them.</Text>
            ) : summary.suggestedTransfers.length === 0 ? (
              <Text style={styles.note}>Everyone is already settled up.</Text>
            ) : (
              summary.suggestedTransfers.map(transfer => (
                <Text key={`${transfer.fromUserId}-${transfer.toUserId}`} style={styles.transferText}>
                  {transfer.fromUserId} → {transfer.toUserId}: {Cents.formatPlain(Cents.of(transfer.amountCents))}
                </Text>
              ))
            )}
          </NeuCard>
          <NeuCard style={styles.kittyCard}>
            <NeuListRow
              icon="🐷"
              title="Trip kitty"
              subtitle="View contributions & log a deposit"
              onPress={() => navigation.navigate('KittyDeposit' as never)}
            />
          </NeuCard>
          <View style={styles.actions}>
            <NeuButton
              label="Share PDF"
              variant="secondary"
              onPress={() => handleExport('pdf')}
              loading={exportingFormat === 'pdf'}
              disabled={exportingFormat !== null}
              style={styles.exportButton}
            />
            <NeuButton
              label="Share CSV"
              variant="secondary"
              onPress={() => handleExport('csv')}
              loading={exportingFormat === 'csv'}
              disabled={exportingFormat !== null}
              style={styles.exportButton}
            />
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
    </View>
  );
}

const styles = StyleSheet.create({
  message: { color: neuColors.textMuted, marginVertical: 8 },
  error: { color: neuColors.danger, marginVertical: 8 },
  card: { padding: 16, marginBottom: 16 },
  kittyCard: { padding: 6, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10, color: neuColors.textPrimary },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  balanceUser: { fontSize: 14, color: neuColors.textPrimary },
  balanceValue: { fontSize: 14, fontWeight: '700', color: neuColors.textPrimary },
  transferText: { fontSize: 14, color: neuColors.textPrimary, marginBottom: 8 },
  note: { color: neuColors.textMuted, fontSize: 14 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  exportButton: { flex: 1 },
  exportBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, padding: 10, borderRadius: 10 },
  exportBannerSuccess: { backgroundColor: '#DDF0E1' },
  exportBannerError: { backgroundColor: '#FBE3E1' },
  exportBannerTextSuccess: { color: '#2E7D4F', fontSize: 12 },
  exportBannerTextError: { color: neuColors.danger, fontSize: 12 },
});
