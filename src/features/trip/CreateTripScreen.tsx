import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { apiClient } from '@/services/api/client';

interface TripCreatedPayload {
  id: string;
  inviteCode: string;
  name?: string;
}

interface Props {
  onCreated: (trip: TripCreatedPayload) => void;
}

/** TRIP-01: create a trip; server returns a 6-character invite code + implicit QR payload. */
export default function CreateTripScreen({ onCreated }: Props) {
  const [name, setName] = useState('');

  const handleCreate = async () => {
    const trip = await apiClient.post<TripCreatedPayload>('/api/v1/trips', { name });
    onCreated(trip);
  };

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
  label: { fontSize: 13, fontWeight: '600', color: '#555' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginTop: 4, marginBottom: 20 },
  button: { backgroundColor: '#2f6fed', borderRadius: 10, padding: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
});
