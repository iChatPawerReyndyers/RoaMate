import React from 'react';
import { Modal as RNModal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import NeumorphicView from './NeumorphicView';
import NeuButton from './NeuButton';
import { neuColors, neuRadii } from '@/theme/neumorphic';

interface ConfirmProps {
  visible: boolean;
  icon: string;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Matches the reference's "Modal · confirm/cancel" pattern - icon badge, title, description, Cancel/action buttons. Left-aligned, per the reference. */
export function NeuConfirmModal({
  visible,
  icon,
  title,
  description,
  confirmLabel,
  destructive = true,
  onConfirm,
  onCancel,
}: ConfirmProps) {
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <NeumorphicView variant="raised" size="lg" radius={neuRadii.xl} style={styles.card}>
          <NeumorphicView
            variant="raised"
            size="sm"
            radius={14}
            backgroundColor={destructive ? neuColors.danger : neuColors.accent}
            style={styles.iconBadge}
          >
            <Text style={styles.iconText}>{icon}</Text>
          </NeumorphicView>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          <View style={styles.buttonRow}>
            <NeuButton label="Cancel" variant="cancel" onPress={onCancel} style={styles.button} />
            <TouchableOpacity onPress={onConfirm} style={styles.button}>
              <NeumorphicView
                variant="raised"
                size="sm"
                radius={neuRadii.md}
                backgroundColor={destructive ? neuColors.danger : neuColors.accent}
                style={styles.confirmButton}
              >
                <Text style={styles.confirmButtonText}>{confirmLabel}</Text>
              </NeumorphicView>
            </TouchableOpacity>
          </View>
        </NeumorphicView>
      </View>
    </RNModal>
  );
}

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Matches the reference's "Empty state modal" pattern - inset icon circle, centered title/description, optional CTA. Not wrapped in its own Modal - render it inline wherever a list/screen has nothing to show. */
export function NeuEmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <NeumorphicView variant="raised" size="lg" radius={neuRadii.xl} style={styles.emptyCard}>
      <NeumorphicView variant="inset" radius={neuRadii.xl} style={styles.emptyIconCircle}>
        <Text style={styles.emptyIconText}>{icon}</Text>
      </NeumorphicView>
      <Text style={[styles.title, styles.centeredText]}>{title}</Text>
      <Text style={[styles.description, styles.centeredText, styles.emptyDescription]}>{description}</Text>
      {actionLabel && onAction ? <NeuButton label={actionLabel} onPress={onAction} style={styles.emptyButton} /> : null}
    </NeumorphicView>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { padding: 18, width: '100%', maxWidth: 340 },
  iconBadge: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  iconText: { fontSize: 20, color: neuColors.white },
  title: { fontSize: 14, fontWeight: '700', color: neuColors.textPrimary, marginBottom: 6 },
  description: { fontSize: 12, color: neuColors.textMuted, lineHeight: 18, marginBottom: 16 },
  centeredText: { textAlign: 'center' },
  buttonRow: { flexDirection: 'row', gap: 10 },
  button: { flex: 1 },
  confirmButton: { height: 38, alignItems: 'center', justifyContent: 'center' },
  confirmButtonText: { color: neuColors.white, fontSize: 13, fontWeight: '600' },
  emptyCard: { padding: 24, alignItems: 'center' },
  emptyIconCircle: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyIconText: { fontSize: 26, color: neuColors.textMuted },
  emptyDescription: { marginBottom: 16 },
  emptyButton: { alignSelf: 'stretch' },
});