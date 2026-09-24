import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Cents } from '@/money/Cents';
import type { DestinationPriority } from './ItineraryScreen';
import NeuTextInput from '@/components/neumorphic/NeuTextInput';
import NeuButton from '@/components/neumorphic/NeuButton';
import NeumorphicView from '@/components/neumorphic/NeumorphicView';
import DateAndStayFields from './DateAndStayFields';
import { parseStayHours } from './stayDuration';
import { neuColors, neuRadii, neuSpacing } from '@/theme/neumorphic';

export interface DestinationFormValues {
  name: string;
  address: string;
  operatingHours: string;
  targetBudgetDollars: string;
  attachmentUrls: string[];
  priority: DestinationPriority;
  /** ITIN-06: 'YYYY-MM-DD', or null/absent for Unscheduled. */
  assignedDay: string | null;
  /** ITIN-06: hours as typed in the field ("1.5"); '' = not set. */
  plannedDurationHours: string;
}

const PRIORITY_OPTIONS: { key: DestinationPriority; label: string }[] = [
  { key: 'REQUIRED', label: 'Required' },
  { key: 'OPTIONAL', label: 'Optional' },
  { key: 'TENTATIVE', label: 'Tentative' },
];

interface Props {
  initialValues?: Partial<DestinationFormValues>;
  onSubmit: (values: {
    name: string;
    address?: string;
    operatingHours?: string;
    targetBudgetCents?: number;
    attachmentUrls?: string;
    priority: DestinationPriority;
    /** ITIN-06: null = Unscheduled. Always sent (even when null) because the server overwrites the day on every save. */
    assignedDay: string | null;
    /** ITIN-06: whole minutes, null = no planned stay. Always sent, same reason as assignedDay. */
    plannedDurationMinutes: number | null;
  }) => void;
}

/**
 * ITIN-02: captures the fields the backend Destination entity already
 * supports (address, operating hours, target budget, attachments) but that
 * previously had no form to fill them in from. Attachments are stored as
 * plain URLs/paths for now - attaching a file straight from the device
 * picker needs a document-picker library that isn't in the project yet
 * (see the handoff notes on this feature).
 *
 * Visual language: brought in line with the neumorphic system used
 * elsewhere in Itinerary/Expenses - NeuTextInput for inset fields, a
 * raised-pill priority selector matching NeuSegmentedControl's look, and
 * NeuButton for actions.
 */
export default function DestinationFormScreen({ initialValues, onSubmit }: Props) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [address, setAddress] = useState(initialValues?.address ?? '');
  const [operatingHours, setOperatingHours] = useState(initialValues?.operatingHours ?? '');
  const [targetBudgetDollars, setTargetBudgetDollars] = useState(initialValues?.targetBudgetDollars ?? '');
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>(initialValues?.attachmentUrls ?? []);
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [priority, setPriority] = useState<DestinationPriority>(initialValues?.priority ?? 'REQUIRED');
  const [assignedDay, setAssignedDay] = useState<string | null>(initialValues?.assignedDay ?? null);
  const [plannedDurationHours, setPlannedDurationHours] = useState(initialValues?.plannedDurationHours ?? '');

  const addAttachment = () => {
    const trimmed = newAttachmentUrl.trim();
    if (!trimmed) return;
    setAttachmentUrls(prev => [...prev, trimmed]);
    setNewAttachmentUrl('');
  };

  const removeAttachment = (index: number) => {
    setAttachmentUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    const stay = parseStayHours(plannedDurationHours);
    if (stay.status === 'error') return; // DateAndStayFields already shows the reason under the field

    const parsedDollars = parseFloat(targetBudgetDollars);
    const targetBudgetCents = Number.isFinite(parsedDollars) && targetBudgetDollars !== ''
      ? Cents.fromDollars(parsedDollars)
      : undefined;

    onSubmit({
      name: name.trim(),
      address: address.trim() || undefined,
      operatingHours: operatingHours.trim() || undefined,
      targetBudgetCents,
      attachmentUrls: attachmentUrls.length > 0 ? attachmentUrls.join(',') : undefined,
      priority,
      assignedDay,
      plannedDurationMinutes: stay.status === 'ok' ? stay.minutes : null,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.label}>Name</Text>
        <NeuTextInput value={name} onChangeText={setName} placeholder="Mount Pulag Trailhead" style={styles.input} />

        <Text style={styles.label}>Address</Text>
        <NeuTextInput value={address} onChangeText={setAddress} placeholder="Street, city" style={styles.input} />

        <Text style={styles.label}>Operating hours</Text>
        <NeuTextInput
          value={operatingHours}
          onChangeText={setOperatingHours}
          placeholder="e.g. 8:00 AM - 5:00 PM"
          style={styles.input}
        />

        <Text style={styles.label}>Priority</Text>
        <View style={styles.priorityRow}>
          {PRIORITY_OPTIONS.map(option => {
            const selected = priority === option.key;
            return (
              <TouchableOpacity key={option.key} onPress={() => setPriority(option.key)} style={styles.priorityFlex}>
                <NeumorphicView
                  variant={selected ? 'raised' : 'inset'}
                  size="sm"
                  radius={neuRadii.md}
                  backgroundColor={selected ? neuColors.accent : neuColors.surfaceInset}
                  style={styles.priorityOption}
                >
                  <Text style={[styles.priorityOptionText, selected && styles.priorityOptionTextSelected]}>
                    {option.label}
                  </Text>
                </NeumorphicView>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Schedule</Text>
        <DateAndStayFields
          day={assignedDay}
          onChangeDay={setAssignedDay}
          stayHours={plannedDurationHours}
          onChangeStayHours={setPlannedDurationHours}
        />

        <Text style={styles.label}>Target budget</Text>
        <NeuTextInput
          value={targetBudgetDollars}
          onChangeText={setTargetBudgetDollars}
          keyboardType="decimal-pad"
          placeholder="0.00"
          style={styles.input}
        />

        <Text style={styles.label}>Attachments</Text>
        <Text style={styles.hint}>Paste a link to a ticket or PDF (device file picker not wired up yet).</Text>
        <View style={styles.attachmentRow}>
          <NeuTextInput
            value={newAttachmentUrl}
            onChangeText={setNewAttachmentUrl}
            placeholder="https://..."
            style={styles.attachmentInput}
          />
          <NeuButton label="Add" variant="secondary" onPress={addAttachment} style={styles.addAttachmentButton} />
        </View>
        {attachmentUrls.map((url, i) => (
          <NeumorphicView key={`${url}-${i}`} variant="inset" radius={neuRadii.md} style={styles.attachmentChip}>
            <Text style={styles.attachmentChipText} numberOfLines={1}>{url}</Text>
            <TouchableOpacity onPress={() => removeAttachment(i)} hitSlop={8}>
              <Text style={styles.removeAttachment}>Remove</Text>
            </TouchableOpacity>
          </NeumorphicView>
        ))}

        <NeuButton label="Save Destination" variant="primary" onPress={handleSubmit} style={styles.submitButton} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: neuColors.background },
  scroll: { padding: neuSpacing.lg, paddingBottom: 40 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: neuColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 14,
    marginBottom: 6,
  },
  hint: { fontSize: 11, color: neuColors.textMuted, marginTop: -2, marginBottom: 8 },
  input: { marginBottom: 0 },
  priorityRow: { flexDirection: 'row', gap: neuSpacing.sm, marginTop: 2 },
  priorityFlex: { flex: 1 },
  priorityOption: { paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  priorityOptionText: { fontSize: 11, fontWeight: '700', color: neuColors.textMuted },
  priorityOptionTextSelected: { color: neuColors.white },
  attachmentRow: { flexDirection: 'row', alignItems: 'center', gap: neuSpacing.sm },
  attachmentInput: { flex: 1 },
  addAttachmentButton: { alignSelf: 'stretch', justifyContent: 'center' },
  attachmentChip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: neuSpacing.md,
    marginTop: neuSpacing.sm,
  },
  attachmentChipText: { fontSize: 12, color: neuColors.textPrimary, flex: 1, marginRight: 8 },
  removeAttachment: { fontSize: 12, color: neuColors.danger, fontWeight: '700' },
  submitButton: { marginTop: 28, marginBottom: 4 },
});