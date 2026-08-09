import React, { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiClient } from '@/services/api/client';

interface LocationNote {
  id: string;
  authorUserId: string;
  body: string;
}

interface DestinationActivitySummary {
  totalDistanceMeters: number;
  totalElevationGainMeters: number;
  totalSteps: number;
  sessionCount: number;
}

interface Props {
  destinationId: string;
  name: string;
  dayLabel?: string;
  lat?: number;
  lng?: number;
  attachmentUrls?: string;
  onAddNote: () => void;
  onStartActivity: () => void;
}

/**
 * ITIN-02 / section 7.2 mockup: the full pinned-stop card - coordinates,
 * per-author notes (first few, with a link through to the full notes
 * screen), rolled-up activity metrics (ACT-04), a "Start activity here"
 * entry point, and an attachments list.
 */
export default function PinnedLocationCard({
  destinationId,
  name,
  dayLabel,
  lat,
  lng,
  attachmentUrls,
  onAddNote,
  onStartActivity,
}: Props) {
  const [notes, setNotes] = useState<LocationNote[]>([]);
  const [summary, setSummary] = useState<DestinationActivitySummary | null>(null);

  const loadNotes = useCallback(async () => {
    try {
      const result = await apiClient.get<LocationNote[]>(`/api/v1/itinerary/destinations/${destinationId}/notes`);
      setNotes(result.slice(0, 2));
    } catch (err) {
      console.warn('Failed to load notes for pinned card', err);
    }
  }, [destinationId]);

  const loadSummary = useCallback(async () => {
    try {
      const result = await apiClient.get<DestinationActivitySummary>(`/api/v1/activity/destinations/${destinationId}/summary`);
      setSummary(result);
    } catch (err) {
      console.warn('Failed to load activity summary for pinned card', err);
    }
  }, [destinationId]);

  useEffect(() => {
    loadNotes();
    loadSummary();
  }, [loadNotes, loadSummary]);

  const attachments = attachmentUrls ? attachmentUrls.split(',').map(s => s.trim()).filter(Boolean) : [];
  const hasMetrics = summary && summary.sessionCount > 0;

  return (
    <View style={styles.card}>
      {dayLabel ? <Text style={styles.dayLabel}>{dayLabel}</Text> : null}
      <Text style={styles.name}>{name}</Text>
      {lat !== undefined && lng !== undefined ? (
        <Text style={styles.coordinates}>{lat.toFixed(4)}° N, {lng.toFixed(4)}° E</Text>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notes and tips</Text>
        {notes.map(note => (
          <View key={note.id} style={styles.note}>
            <Text style={styles.noteBody}>{note.body}</Text>
            <Text style={styles.noteAuthor}>{note.authorUserId}</Text>
          </View>
        ))}
        <TouchableOpacity style={styles.smallButton} onPress={onAddNote}>
          <Text style={styles.smallButtonText}>+ Add note</Text>
        </TouchableOpacity>
      </View>

      {hasMetrics ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity metrics</Text>
          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{(summary!.totalDistanceMeters / 1000).toFixed(1)} km</Text>
              <Text style={styles.metricLabel}>Distance</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{Math.round(summary!.totalElevationGainMeters)} m</Text>
              <Text style={styles.metricLabel}>Altitude gain</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{summary!.totalSteps.toLocaleString()}</Text>
              <Text style={styles.metricLabel}>Steps</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.startButton} onPress={onStartActivity}>
            <Text style={styles.startButtonText}>▶ Start activity here</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={[styles.section, styles.startButton]} onPress={onStartActivity}>
          <Text style={styles.startButtonText}>▶ Start activity here</Text>
        </TouchableOpacity>
      )}

      {attachments.length > 0 ? (
        <TouchableOpacity
          style={styles.section}
          onPress={() => Linking.openURL(attachments[0]!).catch(err => console.warn('Failed to open attachment', err))}
        >
          <Text style={styles.attachmentsButtonText}>
            📎 View attachments ({attachments.length})
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#f5f8ff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e2e9ff', flex: 1 },
  dayLabel: { fontSize: 12, color: '#2f6fed', fontWeight: '700', marginBottom: 2 },
  name: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  coordinates: { fontSize: 12, color: '#888', marginBottom: 12 },
  section: { borderTopWidth: 1, borderTopColor: '#e2e9ff', paddingTop: 10, marginTop: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#555', marginBottom: 8 },
  note: { marginBottom: 6 },
  noteBody: { fontSize: 13, color: '#222' },
  noteAuthor: { fontSize: 11, color: '#888', marginTop: 1 },
  smallButton: { alignSelf: 'flex-start', backgroundColor: '#eef2ff', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, marginTop: 4 },
  smallButtonText: { fontSize: 12, color: '#3b4ba0', fontWeight: '600' },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 10, alignItems: 'center' },
  metricValue: { fontSize: 15, fontWeight: '700' },
  metricLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  startButton: { backgroundColor: '#2f6fed', borderRadius: 10, padding: 10, alignItems: 'center', marginTop: 10 },
  startButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  attachmentsButtonText: { fontSize: 13, fontWeight: '600', color: '#3b4ba0', textAlign: 'center' },
});
