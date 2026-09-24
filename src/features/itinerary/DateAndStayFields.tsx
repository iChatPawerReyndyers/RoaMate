import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import NeumorphicView from '@/components/neumorphic/NeumorphicView';
import NeuDatePickerModal from '@/components/neumorphic/NeuDatePickerModal';
import { neuColors, neuRadii } from '@/theme/neumorphic';
import { formatDayShort } from './dayPicking';
import { describeStayInput } from './stayDuration';

interface Props {
  /** Chosen day as 'YYYY-MM-DD', or null for "Unscheduled". */
  day: string | null;
  onChangeDay: (day: string | null) => void;
  /** What's typed in the hours box ("1.5"). Kept as text so half-typed input like "1." isn't fought with; parse it with parseStayHours. */
  stayHours: string;
  onChangeStayHours: (hours: string) => void;
}

/**
 * ITIN-06: the "Date" + "Time to spend" pair, side by side, used by both the
 * map's draft-pin card (new pin + quick edit) and DestinationFormScreen so
 * the two stay identical. Date opens NeuDatePickerModal (past days blocked);
 * Time to spend is an optional hours box with a live "= 2 hrs 30 mins"
 * readout underneath.
 */
export default function DateAndStayFields({ day, onChangeDay, stayHours, onChangeStayHours }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const readout = describeStayInput(stayHours);

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.dateColumn}>
          <Text style={styles.label}>Date</Text>
          <TouchableOpacity
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={day ? `Date, ${formatDayShort(day)}. Tap to change` : 'Date, unscheduled. Tap to choose'}
          >
            <NeumorphicView variant="inset" radius={neuRadii.md} style={styles.field}>
              <Text style={styles.icon}>📅</Text>
              <Text style={[styles.dateText, !day && styles.placeholderText]} numberOfLines={1}>
                {day ? formatDayShort(day) : 'Unscheduled'}
              </Text>
            </NeumorphicView>
          </TouchableOpacity>
        </View>

        <View style={styles.stayColumn}>
          <Text style={styles.label}>Time to spend</Text>
          <NeumorphicView variant="inset" radius={neuRadii.md} style={styles.field}>
            <Text style={styles.icon}>🕒</Text>
            <TextInput
              style={styles.stayInput}
              value={stayHours}
              onChangeText={onChangeStayHours}
              placeholder="Optional"
              placeholderTextColor={neuColors.textMuted}
              keyboardType="decimal-pad"
              maxLength={6}
              accessibilityLabel="Time to spend, in hours"
            />
            <Text style={styles.suffix}>hrs</Text>
          </NeumorphicView>
        </View>
      </View>

      {/* Fixed-height line so the card doesn't jump as the readout appears/disappears. */}
      <Text style={[styles.readout, readout.isError && styles.readoutError]}>{readout.text}</Text>

      <NeuDatePickerModal
        visible={pickerOpen}
        value={day}
        onConfirm={picked => {
          onChangeDay(picked);
          setPickerOpen(false);
        }}
        onCancel={() => setPickerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dateColumn: { flex: 1.25, minWidth: 0 },
  stayColumn: { flex: 1, minWidth: 0 },
  label: { fontSize: 11, fontWeight: '600', color: neuColors.textMuted, marginBottom: 5 },
  field: { height: 40, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 6 },
  icon: { fontSize: 14 },
  dateText: { flex: 1, fontSize: 14, color: neuColors.textPrimary },
  placeholderText: { color: neuColors.textMuted },
  stayInput: { flex: 1, minWidth: 0, fontSize: 14, color: neuColors.textPrimary, padding: 0 },
  suffix: { fontSize: 12, color: neuColors.textMuted },
  readout: { fontSize: 12, minHeight: 18, marginTop: 6, textAlign: 'right', color: neuColors.accent },
  readoutError: { color: neuColors.danger },
});