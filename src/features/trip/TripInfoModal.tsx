import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CurrentTrip } from '@/app/TripContext';

interface Props {
  visible: boolean;
  trip: CurrentTrip;
  onClose: () => void;
}

/** TRIP-01: opened by tapping the trip name in the header - name, description (if set), and the member list. */
export default function TripInfoModal({ visible, trip, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Trip info</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.name}>{trip.name ?? 'Your trip'}</Text>
          {trip.description ? (
            <Text style={styles.description}>{trip.description}</Text>
          ) : (
            <Text style={styles.noDescription}>No description yet.</Text>
          )}

          <Text style={styles.sectionTitle}>
            Members ({trip.members.length})
          </Text>
          {trip.members.map(member => (
            <View key={member.id} style={styles.memberRow}>
              <Text style={styles.memberName}>{member.displayName}</Text>
              <Text style={styles.memberRole}>{member.role}</Text>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  closeText: { fontSize: 14, color: '#2f6fed', fontWeight: '600' },
  headerTitle: { fontSize: 15, fontWeight: '700' },
  headerSpacer: { width: 44 },
  content: { padding: 20 },
  name: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  description: { fontSize: 14, color: '#333', lineHeight: 20, marginBottom: 24 },
  noDescription: { fontSize: 14, color: '#999', fontStyle: 'italic', marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#555', marginBottom: 10 },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  memberName: { fontSize: 14, color: '#222' },
  memberRole: { fontSize: 12, color: '#888', textTransform: 'capitalize' },
});
