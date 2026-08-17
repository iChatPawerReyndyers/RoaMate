import React, { useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiClient } from '@/services/api/client';
import InviteQRCode from './InviteQRCode';
import type { AuthStackParamList } from '@/app/navigation/AuthStack';

interface TripCreatedPayload {
  id: string;
  inviteCode: string;
  name?: string;
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
        <Text style={styles.title}>Trip created</Text>
        <Text style={styles.label}>Share this with your group to join.</Text>
        <InviteQRCode tripId={createdTrip.id} inviteCode={createdTrip.inviteCode} />
        <Text style={styles.code}>{createdTrip.inviteCode}</Text>
        <TouchableOpacity style={styles.button} onPress={() => onCreated(createdTrip)}>
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.label}>Trip name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Baguio Weekend" />

      <Text style={styles.label}>Currency</Text>
      <View style={styles.currencyRow}>
        {CURRENCIES.map(code => (
          <TouchableOpacity
            key={code}
            style={[styles.currencyChip, currency === code && styles.currencyChipActive]}
            onPress={() => setCurrency(code)}
          >
            <Text style={[styles.currencyChipText, currency === code && styles.currencyChipTextActive]}>{code}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.currencyHint}>All expenses and the shared kitty will run in this currency.</Text>

      <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create Trip</Text>}
      </TouchableOpacity>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or join a trip</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.joinRow}>
        <TouchableOpacity style={styles.joinButton} onPress={() => navigation.navigate('ScanQR')}>
          <Text style={styles.joinButtonText}>Scan QR</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.joinButton} onPress={() => navigation.navigate('JoinTrip', undefined)}>
          <Text style={styles.joinButtonText}>Enter Code</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#555' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginTop: 4, marginBottom: 20 },
  currencyRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  currencyChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: '#ddd' },
  currencyChipActive: { backgroundColor: '#2f6fed', borderColor: '#2f6fed' },
  currencyChipText: { fontSize: 13, fontWeight: '600', color: '#555' },
  currencyChipTextActive: { color: '#fff' },
  currencyHint: { fontSize: 11, color: '#888', marginTop: 8, marginBottom: 20 },
  code: { fontSize: 20, fontWeight: '700', letterSpacing: 2, textAlign: 'center', marginBottom: 20 },
  button: { backgroundColor: '#2f6fed', borderRadius: 10, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 16 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#ddd' },
  dividerText: { marginHorizontal: 10, fontSize: 12, color: '#888' },
  joinRow: { flexDirection: 'row', gap: 10 },
  joinButton: { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, alignItems: 'center' },
  joinButtonText: { fontWeight: '600', color: '#2f6fed' },
});