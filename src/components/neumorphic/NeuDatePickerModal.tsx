import React, { useEffect, useMemo, useState } from 'react';
import { Modal as RNModal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import NeumorphicView from './NeumorphicView';
import NeuButton from './NeuButton';
import { neuColors, neuRadii } from '@/theme/neumorphic';
import {
  WEEKDAY_HEADERS,
  buildMonthCells,
  canGoToPreviousMonth,
  formatMonthTitle,
  isPastDay,
  isoFromParts,
  parseISODate,
  shiftMonth,
  todayISO,
} from '@/features/itinerary/dayPicking';

interface Props {
  visible: boolean;
  /** Currently chosen day as 'YYYY-MM-DD', or null for "Unscheduled". */
  value: string | null;
  /** Called with the confirmed day (or null when cleared) when "Done" is tapped. */
  onConfirm: (day: string | null) => void;
  /** Backdrop tap / Android back: closes without changing anything. */
  onCancel: () => void;
}

/**
 * ITIN-06: month-grid date picker in the neumorphic style. JS-only on
 * purpose (no native date-picker module, so no pod install / native
 * rebuild).
 *
 * Past days are shown grayed out and can't be tapped. The one exception is
 * a stop that ALREADY has a past date: it's still shown as selected, and
 * "Done" keeps it, so editing a stop's name or priority never fails just
 * because its trip day has gone by. Only choosing a *different* past day is
 * blocked.
 */
export default function NeuDatePickerModal({ visible, value, onConfirm, onCancel }: Props) {
  const today = todayISO();
  const [pending, setPending] = useState<string | null>(value);
  const [view, setView] = useState(() => initialView(value, today));

  // Re-seed every time the sheet opens, so a cancelled pick from last time doesn't linger.
  useEffect(() => {
    if (visible) {
      setPending(value);
      setView(initialView(value, today));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const cells = useMemo(() => buildMonthCells(view.year, view.month), [view.year, view.month]);
  const canGoBack = canGoToPreviousMonth(view.year, view.month, today);

  const goBack = () => {
    if (canGoBack) {
      setView(prev => shiftMonth(prev.year, prev.month, -1));
    }
  };
  const goForward = () => setView(prev => shiftMonth(prev.year, prev.month, 1));

  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        {/* Inner Pressable swallows taps so touching the card itself doesn't hit the backdrop's onCancel. */}
        <Pressable style={styles.cardWrapper} onPress={() => {}}>
          <NeumorphicView variant="raised" size="lg" radius={neuRadii.xl} style={styles.card}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={goBack}
                disabled={!canGoBack}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Previous month"
                accessibilityState={{ disabled: !canGoBack }}
              >
                <NeumorphicView variant="raised" size="sm" radius={10} style={[styles.navButton, !canGoBack && styles.navButtonDisabled]}>
                  <Text style={styles.navText}>‹</Text>
                </NeumorphicView>
              </TouchableOpacity>
              <Text style={styles.monthTitle}>{formatMonthTitle(view.year, view.month)}</Text>
              <TouchableOpacity onPress={goForward} hitSlop={8} accessibilityRole="button" accessibilityLabel="Next month">
                <NeumorphicView variant="raised" size="sm" radius={10} style={styles.navButton}>
                  <Text style={styles.navText}>›</Text>
                </NeumorphicView>
              </TouchableOpacity>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAY_HEADERS.map(label => (
                <Text key={label} style={styles.weekday}>
                  {label}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((day, index) => {
                if (day === null) {
                  return <View key={`blank-${index}`} style={styles.cell} />;
                }
                const iso = isoFromParts(view.year, view.month, day);
                const past = isPastDay(iso, today);
                const selected = iso === pending;
                const isToday = iso === today;
                return (
                  <View key={iso} style={styles.cell}>
                    <TouchableOpacity
                      disabled={past}
                      onPress={() => setPending(iso)}
                      accessibilityRole="button"
                      accessibilityLabel={`${formatMonthTitle(view.year, view.month).split(' ')[0]} ${day}, ${view.year}${past ? ', past date, unavailable' : ''}`}
                      accessibilityState={{ disabled: past, selected }}
                      style={[styles.dayCircle, selected && styles.dayCircleSelected, isToday && !selected && styles.dayCircleToday]}
                    >
                      <Text style={[styles.dayText, past && styles.dayTextPast, selected && styles.dayTextSelected]}>{day}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendDotSelected]} />
                <Text style={styles.legendText}>Selected</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendDotToday]} />
                <Text style={styles.legendText}>Today</Text>
              </View>
              <View style={styles.legendItem}>
                <Text style={[styles.legendText, styles.legendPastSample]}>19</Text>
                <Text style={styles.legendText}>{"Past (can't pick)"}</Text>
              </View>
            </View>

            <View style={styles.buttonRow}>
              <NeuButton label="Clear date" variant="cancel" onPress={() => setPending(null)} style={styles.button} />
              <NeuButton label="Done" onPress={() => onConfirm(pending)} style={styles.button} />
            </View>
          </NeumorphicView>
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

/** Opens on the chosen day's month (even if it's in the past), else on today's month. */
function initialView(value: string | null, today: string): { year: number; month: number } {
  const parts = parseISODate(value) ?? parseISODate(today);
  if (!parts) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }
  return { year: parts.year, month: parts.month };
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  cardWrapper: { width: '100%', maxWidth: 340 },
  card: { padding: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  navButtonDisabled: { opacity: 0.35 },
  navText: { fontSize: 20, color: neuColors.textPrimary, lineHeight: 22 },
  monthTitle: { fontSize: 14, fontWeight: '700', color: neuColors.textPrimary },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, color: neuColors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dayCircleSelected: { backgroundColor: neuColors.accent },
  dayCircleToday: { borderWidth: 1.5, borderColor: neuColors.accent },
  dayText: { fontSize: 13, color: neuColors.textPrimary },
  dayTextPast: { color: '#C3CAD8' },
  dayTextSelected: { color: neuColors.white, fontWeight: '600' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: 12, marginBottom: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendDotSelected: { backgroundColor: neuColors.accent },
  legendDotToday: { borderWidth: 1.5, borderColor: neuColors.accent },
  legendText: { fontSize: 11, color: neuColors.textMuted },
  legendPastSample: { color: '#C3CAD8' },
  buttonRow: { flexDirection: 'row', gap: 10 },
  button: { flex: 1 },
});