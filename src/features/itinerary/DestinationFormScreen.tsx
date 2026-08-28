import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Cents } from '@/money/Cents';
import type { DestinationPriority } from './ItineraryScreen';

export interface DestinationFormValues {
  name: string;
  address: string;
  operatingHours: string;
  targetBudgetDollars: string;
  attachmentUrls: string[];
  priority: DestinationPriority;
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
  }) => void;
}

/**
 * ITIN-02: captures the fields the backend Destination entity already
 * supports (address, operating hours, target budget, attachments) but that
 * previously had no form to fill them in from. Attachments are stored as
 * plain URLs/paths for now - attaching a file straight from the device
 * picker needs a document-picker library that isn't in the project yet
 * (see the handoff notes on this feature).
 */
export default function DestinationFormScreen({ initialValues, onSubmit }: Props) {
  const [name, setName] = useState(initialValues?.name ?? '');
  const [address, setAddress] = useState(initialValues?.address ?? '');
  const [operatingHours, setOperatingHours] = useState(initialValues?.operatingHours ?? '');
  const [targetBudgetDollars, setTargetBudgetDollars] = useState(initialValues?.targetBudgetDollars ?? '');
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>(initialValues?.attachmentUrls ?? []);
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [priority, setPriority] = useState<DestinationPriority>(initialValues?.priority ?? 'REQUIRED');

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
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Mount Pulag Trailhead" />

        <Text style={styles.label}>Address</Text>
        <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Street, city" />

        <Text style={styles.label}>Operating hours</Text>
        <TextInput
          style={styles.input}
          value={operatingHours}
          onChangeText={setOperatingHours}
          placeholder="e.g. 8:00 AM - 5:00 PM"
        />

        <Text style={styles.label}>Priority</Text>
        <View style={styles.priorityRow}>
          {PRIORITY_OPTIONS.map(option => {
            const selected = priority === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.priorityOption, selected && styles.priorityOptionSelected]}
                onPress={() => setPriority(option.key)}
              >
                <Text style={[styles.priorityOptionText, selected && styles.priorityOptionTextSelected]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Target budget</Text>
        <TextInput
          style={styles.input}
          value={targetBudgetDollars}
          onChangeText={setTargetBudgetDollars}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />

        <Text style={styles.label}>Attachments</Text>
        <Text style={styles.hint}>Paste a link to a ticket or PDF (device file picker not wired up yet).</Text>
        <View style={styles.attachmentRow}>
          <TextInput
            style={[styles.input, styles.attachmentInput]}
            value={newAttachmentUrl}
            onChangeText={setNewAttachmentUrl}
            placeholder="https://..."
          />
          <TouchableOpacity style={styles.addAttachmentButton} onPress={addAttachment}>
            <Text style={styles.addAttachmentButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
        {attachmentUrls.map((url, i) => (
          <View key={`${url}-${i}`} style={styles.attachmentChip}>
            <Text style={styles.attachmentChipText} numberOfLines={1}>{url}</Text>
            <TouchableOpacity onPress={() => removeAttachment(i)}>
              <Text style={styles.removeAttachment}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Save Destination</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginTop: 14 },
  hint: { fontSize: 11, color: '#888', marginTop: 2, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginTop: 4 },
  priorityRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  priorityOption: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  priorityOptionSelected: { backgroundColor: '#2f6fed', borderColor: '#2f6fed' },
  priorityOptionText: { fontSize: 12, fontWeight: '600', color: '#555' },
  priorityOptionTextSelected: { color: '#fff' },
  attachmentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  attachmentInput: { flex: 1, marginTop: 0 },
  addAttachmentButton: { backgroundColor: '#eef2ff', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11 },
  addAttachmentButtonText: { color: '#3b4ba0', fontWeight: '700', fontSize: 13 },
  attachmentChip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f7f8fb', borderRadius: 8, padding: 10, marginTop: 8 },
  attachmentChipText: { fontSize: 12, color: '#333', flex: 1, marginRight: 8 },
  removeAttachment: { fontSize: 12, color: '#b00020', fontWeight: '600' },
  submitButton: { backgroundColor: '#2f6fed', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 28, marginBottom: 40 },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
