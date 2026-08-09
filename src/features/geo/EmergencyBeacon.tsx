import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { apiClient } from '@/services/api/client';
import { useSync } from '@/sync/SyncContext';

type BeaconStatus = 'ARRIVED_SAFELY' | 'NEED_ASSISTANCE' | 'LOST';

const STATUS_OPTIONS: { key: BeaconStatus; label: string }[] = [
  { key: 'ARRIVED_SAFELY', label: 'Arrived safely' },
  { key: 'NEED_ASSISTANCE', label: 'Need assistance' },
  { key: 'LOST', label: 'Lost / need help finding way' },
];

interface Props {
  tripId: string;
  userId: string;
}

/** GEO-05: one-tap broadcast of the sender's current location + status to every trip member. */
export default function EmergencyBeacon({ tripId, userId }: Props) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<BeaconStatus>('NEED_ASSISTANCE');
  const [sending, setSending] = useState(false);
  const syncManager = useSync();

  const sendBeacon = (status: BeaconStatus) => {
    setPickerVisible(false);
    setSending(true);
    Geolocation.getCurrentPosition(
      async pos => {
        const payload = {
          tripId,
          raisedByUserId: userId,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          status,
          raisedAt: new Date().toISOString(),
        };

        try {
          await apiClient.post('/api/v1/geo/beacons', payload);
        } catch (err) {
          // A beacon failing silently is the worst outcome this app has -
          // queue it so it goes out the moment connectivity returns,
          // rather than just dropping it like the previous implementation did.
          console.warn('Beacon direct send failed, queued for sync', err);
          await syncManager.enqueueEvent({
            tripId,
            eventType: 'BEACON_ALERT_RAISED',
            clientTimestamp: Date.now(),
            payloadJson: JSON.stringify(payload),
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
    <>
      <TouchableOpacity style={styles.button} onPress={() => setPickerVisible(true)} disabled={sending}>
        <Text style={styles.text}>{sending ? 'Sending…' : 'Emergency Beacon'}</Text>
      </TouchableOpacity>

      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Raise emergency beacon?</Text>
            <Text style={styles.sheetSubtitle}>Choose what to broadcast to the group.</Text>

            {STATUS_OPTIONS.map(option => (
              <TouchableOpacity
                key={option.key}
                style={[styles.option, selectedStatus === option.key && styles.optionSelected]}
                onPress={() => setSelectedStatus(option.key)}
              >
                <Text style={[styles.optionText, selectedStatus === option.key && styles.optionTextSelected]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}

            <Text style={styles.hint}>
              Sends your current location either way. Queued for delivery if you're offline right now.
            </Text>

            <TouchableOpacity style={styles.sendButton} onPress={() => sendBeacon(selectedStatus)}>
              <Text style={styles.sendButtonText}>Send beacon</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setPickerVisible(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { backgroundColor: '#d0342c', borderRadius: 10, padding: 14, alignItems: 'center' },
  text: { color: '#fff', fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  sheetTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  sheetSubtitle: { fontSize: 13, color: '#666', marginBottom: 16 },
  option: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, marginBottom: 8 },
  optionSelected: { borderColor: '#d0342c', borderWidth: 2, backgroundColor: '#fdeceb' },
  optionText: { fontSize: 14 },
  optionTextSelected: { fontWeight: '700', color: '#d0342c' },
  hint: { fontSize: 11, color: '#888', marginTop: 4, marginBottom: 16 },
  sendButton: { backgroundColor: '#d0342c', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 8 },
  sendButtonText: { color: '#fff', fontWeight: '700' },
  cancelButton: { padding: 10, alignItems: 'center' },
  cancelButtonText: { color: '#666', fontWeight: '600' },
});
