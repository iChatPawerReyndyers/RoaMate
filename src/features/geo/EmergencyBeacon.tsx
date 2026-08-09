import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { apiClient } from '@/services/api/client';

interface Props {
  tripId: string;
  userId: string;
}

/** GEO-05: one-tap broadcast of the sender's current location to every trip member. */
export default function EmergencyBeacon({ tripId, userId }: Props) {
  const [sending, setSending] = useState(false);

  const raiseBeacon = () => {
    Alert.alert('Raise emergency beacon?', 'This immediately shares your location with everyone on the trip.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Raise Beacon', style: 'destructive', onPress: sendBeacon },
    ]);
  };

  const sendBeacon = () => {
    setSending(true);
    Geolocation.getCurrentPosition(
      async pos => {
        try {
          await apiClient.post('/api/v1/geo/beacons', {
            tripId,
            raisedByUserId: userId,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            raisedAt: new Date().toISOString(),
          });
        } finally {
          setSending(false);
        }
      },
      () => setSending(false),
      { enableHighAccuracy: true, timeout: 5000 },
    );
  };

  return (
    <TouchableOpacity style={styles.button} onPress={raiseBeacon} disabled={sending}>
      <Text style={styles.text}>{sending ? 'Sending…' : 'Emergency Beacon'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { backgroundColor: '#d0342c', borderRadius: 10, padding: 14, alignItems: 'center' },
  text: { color: '#fff', fontWeight: '700' },
});
