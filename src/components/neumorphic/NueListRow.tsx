import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import NeumorphicView from './NeumorphicView';
import { neuColors } from '@/theme/neumorphic';

interface Props {
  icon: string;
  title: string;
  subtitle?: string;
  iconVariant?: 'raised' | 'inset';
  onPress?: () => void;
}

/** A single row for use inside a NeuCard list container - matches the reference's "List" pattern (icon square, title/subtitle, chevron). Wrap a set of these in a NeuCard with divider lines between them for the full list look. */
export default function NeuListRow({ icon, title, subtitle, iconVariant = 'raised', onPress }: Props) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
      <NeumorphicView
        variant={iconVariant}
        size="sm"
        radius={9}
        backgroundColor={iconVariant === 'raised' ? neuColors.accent : undefined}
        style={styles.iconBox}
      >
        <Text style={[styles.iconText, iconVariant === 'raised' && styles.iconTextRaised]}>{icon}</Text>
      </NeumorphicView>
      <View style={styles.textGroup}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {onPress ? <Text style={styles.chevron}>›</Text> : null}
    </TouchableOpacity>
  );
}

/** Thin divider to place between NeuListRow items inside a shared card. */
export function NeuListDivider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 6 },
  iconBox: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 13, color: neuColors.textPrimary },
  iconTextRaised: { color: neuColors.white },
  textGroup: { flex: 1 },
  title: { fontSize: 11, fontWeight: '600', color: neuColors.textPrimary },
  subtitle: { fontSize: 10, color: neuColors.textMuted, marginTop: 1 },
  chevron: { fontSize: 16, color: neuColors.shadowDark },
  divider: { height: 1, backgroundColor: neuColors.shadowDark, marginHorizontal: 6, opacity: 0.5 },
});