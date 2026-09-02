import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { apiClient } from '@/services/api/client';
import { useSync } from '@/sync/SyncContext';
import NeumorphicView from '@/components/neumorphic/NeumorphicView';
import { neuColors, neuRadii, neuSpacing } from '@/theme/neumorphic';

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

/**
 * GEO-05: one-tap broadcast of the sender's current location + status to
 * every trip member. Deliberately kept in the app's danger-red rather than
 * the orange accent used everywhere else - this is a safety-critical
 * action and should never be visually confusable with a routine one.
 */
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
      <TouchableOpacity onPress={() => setPickerVisible(true)} disabled={sending} activeOpacity={0.85}>
        <NeumorphicView variant="raised" radius={neuRadii.lg} backgroundColor={neuColors.danger} style={styles.button}>
          <Text style={styles.text}>{sending ? 'Sending…' : '🚨 Emergency Beacon'}</Text>
        </NeumorphicView>
      </TouchableOpacity>

      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Raise emergency beacon?</Text>
            <Text style={styles.sheetSubtitle}>Choose what to broadcast to the group.</Text>

            {STATUS_OPTIONS.map(option => {
              const selected = selectedStatus === option.key;
              return (
                <TouchableOpacity key={option.key} onPress={() => setSelectedStatus(option.key)} activeOpacity={0.85}>
                  <NeumorphicView
                    variant="raised"
                    radius={neuRadii.md}
                    style={[styles.option, selected && styles.optionSelected]}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
                  </NeumorphicView>
                </TouchableOpacity>
              );
            })}

            <Text style={styles.hint}>
              Sends your current location either way. Queued for delivery if you're offline right now.
            </Text>

            <TouchableOpacity onPress={() => sendBeacon(selectedStatus)} activeOpacity={0.85}>
              <NeumorphicView variant="raised" radius={neuRadii.md} backgroundColor={neuColors.danger} style={styles.sendButton}>
                <Text style={styles.sendButtonText}>Send beacon</Text>
              </NeumorphicView>
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
  button: { padding: 14, alignItems: 'center' },
  text: { color: neuColors.white, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(20,22,28,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: neuColors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: neuSpacing.lg,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: neuColors.textPrimary },
  sheetSubtitle: { fontSize: 13, color: neuColors.textMuted, marginBottom: 16 },
  option: { padding: 14, marginBottom: 8 },
  optionSelected: { borderWidth: 2, borderColor: neuColors.danger },
  optionText: { fontSize: 14, color: neuColors.textMuted },
  optionTextSelected: { fontWeight: '700', color: neuColors.danger },
  hint: { fontSize: 11, color: neuColors.textMuted, marginTop: 4, marginBottom: 16 },
  sendButton: { padding: 14, alignItems: 'center', marginBottom: 8 },
  sendButtonText: { color: neuColors.white, fontWeight: '700' },
  cancelButton: { padding: 10, alignItems: 'center' },
  cancelButtonText: { color: neuColors.textMuted, fontWeight: '600' },
});