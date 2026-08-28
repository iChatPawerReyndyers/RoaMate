import React, { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiClient } from '@/services/api/client';
import type { DestinationPriority } from './ItineraryScreen';
import NeuCard from '@/components/neumorphic/NeuCard';
import NeumorphicView from '@/components/neumorphic/NeumorphicView';
import NeuButton from '@/components/neumorphic/NeuButton';
import { neuColors, neuRadii } from '@/theme/neumorphic';

interface LocationNote {
  id: string;
  authorUserId: string;
  body: string;
}

/** ITIN-03: badge copy + colors per priority - REQUIRED is the implicit default for stops pinned before this field existed. */
const PRIORITY_BADGES: Record<DestinationPriority, { label: string; bg: string; text: string }> = {
  REQUIRED: { label: 'Required', bg: '#fdecea', text: '#b00020' },
  OPTIONAL: { label: 'Optional', bg: '#fff6e0', text: '#8a5a00' },
  TENTATIVE: { label: 'Tentative', bg: '#f1f1f1', text: '#666' },
};

interface DestinationActivitySummary {
  totalDistanceMeters: number;
  totalElevationGainMeters: number;
  totalSteps: number;
  sessionCount: number;
}

interface Props {
  destinationId: string;
  name: string;
  lat?: number;
  lng?: number;
  attachmentUrls?: string;
  priority?: DestinationPriority;
  onAddNote: () => void;
  onStartActivity: () => void;
  onEdit: () => void;
  onRemove: () => void;
}

/**
 * ITIN-02 / section 7.2 mockup: the pinned-stop card. Collapsed by default
 * (name, coordinates, priority only) - tap the chevron to reveal notes,
 * activity metrics, and attachments. The day it's assigned to is shown
 * once as the section header above all of a day's cards (see
 * ItineraryScreen's DaySection), so it isn't repeated per-card here.
 */
export default function PinnedLocationCard({
  destinationId,
  name,
  lat,
  lng,
  attachmentUrls,
  priority = 'REQUIRED',
  onAddNote,
  onStartActivity,
  onEdit,
  onRemove,
}: Props) {
  const [expanded, setExpanded] = useState(false);
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
    <NeuCard size="md" style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.nameFlex}>
          <Text style={styles.name}>{name}</Text>
          {lat !== undefined && lng !== undefined ? (
            <Text style={styles.coordinates}>{lat.toFixed(4)}° N, {lng.toFixed(4)}° E</Text>
          ) : null}
        </View>
        <View style={styles.iconActions}>
          <TouchableOpacity onPress={onEdit} hitSlop={8}>
            <NeumorphicView variant="raised" size="sm" radius={9} style={styles.iconButton}>
              <Text style={styles.iconButtonText}>✎</Text>
            </NeumorphicView>
          </TouchableOpacity>
          <TouchableOpacity onPress={onRemove} hitSlop={8}>
            <NeumorphicView variant="raised" size="sm" radius={9} style={styles.iconButton}>
              <Text style={[styles.iconButtonText, styles.iconButtonDanger]}>🗑</Text>
            </NeumorphicView>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.expandRow} onPress={() => setExpanded(prev => !prev)}>
        <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_BADGES[priority].bg }]}>
          <Text style={[styles.priorityBadgeText, { color: PRIORITY_BADGES[priority].text }]}>
            {PRIORITY_BADGES[priority].label}
          </Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
      </TouchableOpacity>

      {expanded ? (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes and tips</Text>
            {notes.map(note => (
              <View key={note.id} style={styles.note}>
                <Text style={styles.noteBody}>{note.body}</Text>
                <Text style={styles.noteAuthor}>{note.authorUserId}</Text>
              </View>
            ))}
            <NeuButton label="+ Add note" variant="secondary" onPress={onAddNote} style={styles.smallButton} />
          </View>

          {hasMetrics ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Activity metrics</Text>
              <View style={styles.metricsRow}>
                <NeumorphicView variant="inset" radius={neuRadii.md} style={styles.metric}>
                  <Text style={styles.metricValue}>{(summary!.totalDistanceMeters / 1000).toFixed(1)} km</Text>
                  <Text style={styles.metricLabel}>Distance</Text>
                </NeumorphicView>
                <NeumorphicView variant="inset" radius={neuRadii.md} style={styles.metric}>
                  <Text style={styles.metricValue}>{Math.round(summary!.totalElevationGainMeters)} m</Text>
                  <Text style={styles.metricLabel}>Altitude gain</Text>
                </NeumorphicView>
                <NeumorphicView variant="inset" radius={neuRadii.md} style={styles.metric}>
                  <Text style={styles.metricValue}>{summary!.totalSteps.toLocaleString()}</Text>
                  <Text style={styles.metricLabel}>Steps</Text>
                </NeumorphicView>
              </View>
              <NeuButton label="▶ Start activity here" variant="primary" onPress={onStartActivity} style={styles.startButton} />
            </View>
          ) : (
            <View style={styles.section}>
              <NeuButton label="▶ Start activity here" variant="primary" onPress={onStartActivity} />
            </View>
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
        </>
      ) : null}
    </NeuCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  nameFlex: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: neuColors.textPrimary },
  coordinates: { fontSize: 12, color: neuColors.textMuted, marginTop: 2 },
  iconActions: { flexDirection: 'row', gap: 10 },
  iconButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  iconButtonText: { fontSize: 14, color: neuColors.textPrimary },
  iconButtonDanger: { color: neuColors.danger },
  expandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  chevron: { fontSize: 14, color: neuColors.textMuted },
  priorityBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  priorityBadgeText: { fontSize: 11, fontWeight: '700' },
  section: { borderTopWidth: 1, borderTopColor: neuColors.shadowDark, paddingTop: 12, marginTop: 12 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: neuColors.textMuted, marginBottom: 8 },
  note: { marginBottom: 6 },
  noteBody: { fontSize: 13, color: neuColors.textPrimary },
  noteAuthor: { fontSize: 11, color: neuColors.textMuted, marginTop: 1 },
  smallButton: { alignSelf: 'flex-start', marginTop: 4 },
  metricsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  metric: { flex: 1, padding: 10, alignItems: 'center' },
  metricValue: { fontSize: 15, fontWeight: '700', color: neuColors.textPrimary },
  metricLabel: { fontSize: 11, color: neuColors.textMuted, marginTop: 2 },
  startButton: { marginTop: 0 },
  attachmentsButtonText: { fontSize: 13, fontWeight: '600', color: neuColors.accent, textAlign: 'center' },
});
