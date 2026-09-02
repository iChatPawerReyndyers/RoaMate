import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiClient } from '@/services/api/client';
import InviteQRCode from './InviteQRCode';
import type { AuthStackParamList } from '@/app/navigation/AuthStack';
import NeuTextInput from '@/components/neumorphic/NeuTextInput';
import NeuButton from '@/components/neumorphic/NeuButton';
import NeumorphicView from '@/components/neumorphic/NeumorphicView';
import { neuColors, neuRadii, neuSpacing } from '@/theme/neumorphic';

interface TripCreatedPayload {
  id: string;
  inviteCode: string;
  inviteSecret: string;
  name?: string;
  description?: string;
  defaultCurrency: string;
}

type Props = NativeStackScreenProps<AuthStackParamList, 'CreateTrip'> & {
  onCreated: (trip: TripCreatedPayload) => void;
};

// FIN-02: "Trip admin sets 1 base currency at trip creation... All entries,
// Kitty pools, and calculations run strictly in this currency." Chosen from
// the spec's own example currencies (USD, EUR, PHP) plus two other common
// ones - not an exhaustive ISO 4217 list, but easy to extend later.
const CURRENCIES = ['USD', 'EUR', 'PHP', 'GBP', 'JPY'];

/** TRIP-01: create a trip; server returns a 6-character invite code + a scannable QR payload. */
export default function CreateTripScreen({ navigation, onCreated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [createdTrip, setCreatedTrip] = useState<TripCreatedPayload | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Give your trip a name first.');
      return;
    }
    setSubmitting(true);
    try {
      const trip = await apiClient.post<TripCreatedPayload>('/api/v1/trips', {
        name: name.trim(),
        description: description.trim() || undefined,
        defaultCurrency: currency,
      });
      setCreatedTrip(trip);
    } catch (err) {
      // Previously uncaught here - matches the same unhandled-promise-rejection
      // pattern that crashed MapScreen before it got a catch block.
      console.warn('Failed to create trip', err);
      Alert.alert("Couldn't create trip", 'Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (createdTrip) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.qrCenter}>
          <Text style={styles.title}>Trip created</Text>
          <Text style={styles.label}>Share this with your group to join.</Text>
          <InviteQRCode tripId={createdTrip.id} inviteCode={createdTrip.inviteCode} inviteSecret={createdTrip.inviteSecret} />
          <Text style={styles.code}>{createdTrip.inviteCode}</Text>
          <NeuButton label="Continue" variant="primary" onPress={() => onCreated(createdTrip)} style={styles.continueButton} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.fieldLabel}>Trip name</Text>
        <NeuTextInput value={name} onChangeText={setName} placeholder="Baguio Weekend" />

        <Text style={styles.fieldLabel}>Description (optional)</Text>
        <NeumorphicView variant="inset" radius={neuRadii.md} style={styles.descriptionWrap}>
          <TextInput
            style={styles.descriptionInput}
            value={description}
            onChangeText={setDescription}
            placeholder="What's this trip about?"
            placeholderTextColor={neuColors.textMuted}
            multiline
          />
        </NeumorphicView>

        <Text style={styles.fieldLabel}>Currency</Text>
        <View style={styles.currencyRow}>
          {CURRENCIES.map(code => {
            const selected = currency === code;
            return (
              <TouchableOpacity key={code} onPress={() => setCurrency(code)}>
                <NeumorphicView
                  variant={selected ? 'raised' : 'inset'}
                  size="sm"
                  radius={14}
                  backgroundColor={selected ? neuColors.accent : neuColors.surfaceInset}
                  style={styles.currencyChip}
                >
                  <Text style={[styles.currencyChipText, selected && styles.currencyChipTextActive]}>{code}</Text>
                </NeumorphicView>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.currencyHint}>All expenses and the shared kitty will run in this currency.</Text>

        <NeuButton label="Create Trip" variant="primary" onPress={handleCreate} loading={submitting} style={styles.createButton} />

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or join a trip</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.joinRow}>
          <NeuButton label="Scan QR" variant="secondary" onPress={() => navigation.navigate('ScanQR')} style={styles.joinFlex} />
          <NeuButton label="Enter Code" variant="secondary" onPress={() => navigation.navigate('JoinTrip', undefined)} style={styles.joinFlex} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: neuColors.background },
  scroll: { padding: neuSpacing.lg, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 4, color: neuColors.textPrimary },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: neuColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 14,
    marginBottom: 6,
  },
  label: { fontSize: 13, color: neuColors.textMuted, textAlign: 'center' },
  descriptionWrap: { minHeight: 70 },
  descriptionInput: { flex: 1, padding: 12, fontSize: 13, color: neuColors.textPrimary, textAlignVertical: 'top' },
  currencyRow: { flexDirection: 'row', gap: neuSpacing.sm, flexWrap: 'wrap' },
  currencyChip: { paddingVertical: 8, paddingHorizontal: 14 },
  currencyChipText: { fontSize: 13, fontWeight: '700', color: neuColors.textMuted },
  currencyChipTextActive: { color: neuColors.white },
  currencyHint: { fontSize: 11, color: neuColors.textMuted, marginTop: 8 },
  createButton: { marginTop: 22 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: neuColors.shadowDark },
  dividerText: { marginHorizontal: 10, fontSize: 12, color: neuColors.textMuted },
  joinRow: { flexDirection: 'row', gap: neuSpacing.sm },
  joinFlex: { flex: 1 },
  qrCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: neuSpacing.lg },
  code: { fontSize: 22, fontWeight: '700', letterSpacing: 3, textAlign: 'center', marginTop: 4, color: neuColors.textPrimary },
  continueButton: { width: '100%', marginTop: 24 },
});