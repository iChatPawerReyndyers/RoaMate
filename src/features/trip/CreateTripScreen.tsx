import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { apiClient } from '@/services/api/client';
import InviteQRCode from './InviteQRCode';

interface TripCreatedPayload {
  id: string;
  inviteCode: string;
  name?: string;
}

interface Props {
  onCreated: (trip: TripCreatedPayload) => void;
}

/** TRIP-01: create a trip; server returns a 6-character invite code + a scannable QR payload. */
export default function CreateTripScreen({ onCreated }: Props) {
  const [name, setName] = useState('');
  const [createdTrip, setCreatedTrip] = useState<TripCreatedPayload | null>(null);

  const handleCreate = async () => {
    const trip = await apiClient.post<TripCreatedPayload>('/api/v1/trips', { name });
    setCreatedTrip(trip);
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
      <TouchableOpacity style={styles.button} onPress={handleCreate}>
        <Text style={styles.buttonText}>Create Trip</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#555' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginTop: 4, marginBottom: 20 },
  code: { fontSize: 20, fontWeight: '700', letterSpacing: 2, textAlign: 'center', marginBottom: 20 },
  button: { backgroundColor: '#2f6fed', borderRadius: 10, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
});
