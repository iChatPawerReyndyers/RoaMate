import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiClient } from '@/services/api/client';
import type { AuthStackParamList } from '@/app/navigation/AuthStack';

interface TripJoinedPayload {
  id: string;
  inviteCode: string;
  name?: string;
}

type Props = NativeStackScreenProps<AuthStackParamList, 'JoinTrip'> & {
  onJoined: (trip: TripJoinedPayload) => void;
};

/**
 * TRIP-01: join via 6-character invite code, either typed in directly or
 * prefilled from ScanQRScreen's route param. A scanned code still lands
 * here rather than auto-submitting, so the person can double check (or
 * correct, if the QR was for the wrong trip) before actually joining.
 */
export default function JoinTripScreen({ route, onJoined }: Props) {
  const [code, setCode] = useState(route.params?.inviteCode ?? '');
  const [displayName, setDisplayName] = useState('');

  const handleJoin = async () => {
    const joined = await apiClient.post<TripJoinedPayload>('/api/v1/trips/join', {
      inviteCode: code.toUpperCase(),
      displayName,
    });
    onJoined(joined);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.label}>Invite code</Text>
      <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="AB3XQ9" autoCapitalize="characters" maxLength={6} />
      <Text style={styles.label}>Your name</Text>
      <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="Alex" />
      <TouchableOpacity style={styles.button} onPress={handleJoin}>
        <Text style={styles.buttonText}>Join Trip</Text>
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