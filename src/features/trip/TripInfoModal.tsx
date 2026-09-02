import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CurrentTrip } from '@/app/TripContext';
import NeuCard from '@/components/neumorphic/NeuCard';
import { neuColors, neuSpacing } from '@/theme/neumorphic';

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
          <NeuCard size="md" style={styles.card}>
            <Text style={styles.name}>{trip.name ?? 'Your trip'}</Text>
            {trip.description ? (
              <Text style={styles.description}>{trip.description}</Text>
            ) : (
              <Text style={styles.noDescription}>No description yet.</Text>
            )}

            <Text style={styles.sectionTitle}>
              Members ({trip.members.length})
            </Text>
            {trip.members.map((member, index) => (
              <View
                key={member.id}
                style={[styles.memberRow, index > 0 && styles.memberRowDivider]}
              >
                <Text style={styles.memberName}>{member.displayName}</Text>
                <View style={styles.roleBadge}>
                  <Text style={styles.memberRole}>{member.role}</Text>
                </View>
              </View>
            ))}
          </NeuCard>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: neuColors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: neuSpacing.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: neuColors.shadowDark,
  },
  closeText: { fontSize: 14, color: neuColors.accent, fontWeight: '700' },
  headerTitle: { fontSize: 15, fontWeight: '700', color: neuColors.textPrimary },
  headerSpacer: { width: 44 },
  content: { padding: neuSpacing.lg },
  card: { padding: 18 },
  name: { fontSize: 22, fontWeight: '700', marginBottom: 8, color: neuColors.textPrimary },
  description: { fontSize: 14, color: neuColors.textPrimary, lineHeight: 20, marginBottom: 24 },
  noDescription: { fontSize: 14, color: neuColors.textMuted, fontStyle: 'italic', marginBottom: 24 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: neuColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  memberRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11 },
  memberRowDivider: { borderTopWidth: 1, borderTopColor: neuColors.shadowDark },
  memberName: { fontSize: 14, color: neuColors.textPrimary },
  roleBadge: {
    backgroundColor: neuColors.surfaceInset,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1.5,
    borderTopColor: neuColors.shadowDark,
    borderLeftColor: neuColors.shadowDark,
    borderBottomColor: neuColors.shadowLight,
    borderRightColor: neuColors.shadowLight,
  },
  memberRole: { fontSize: 11, color: neuColors.textMuted, textTransform: 'capitalize' },
});