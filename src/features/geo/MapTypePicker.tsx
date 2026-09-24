import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Ellipse, Path, Rect } from 'react-native-svg';
import NeumorphicView from '@/components/neumorphic/NeumorphicView';
import { neuColors, neuRadii } from '@/theme/neumorphic';
import { MAP_TYPES, MapType } from '@/config/mapTiles';

/**
 * The Map tab's map-type control, in two pieces because they live in
 * different spots (see MapScreen): MapTypeButton is the small square in the
 * top row beside the search field and pin button, and MapTypePanel is the
 * "Map type" sheet that drops down under that row. MapScreen owns the
 * open/closed state and the chosen type.
 */

const BUTTON_SIZE = 42;

/** Layers icon: three stacked diamonds, drawn rather than an emoji so it matches the rest of the button row's crispness. */
function LayersIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3 L21 8 L12 13 L3 8 Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M3 12.5 L12 17.5 L21 12.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 17 L12 22 L21 17" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function MapTypeButton({ open, onPress }: { open: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Map type"
      accessibilityState={{ expanded: open }}
    >
      <NeumorphicView
        variant="raised"
        radius={neuRadii.lg}
        backgroundColor={open ? neuColors.accent : neuColors.background}
        style={styles.button}
      >
        <LayersIcon color={open ? neuColors.white : neuColors.textPrimary} />
      </NeumorphicView>
    </TouchableOpacity>
  );
}

/** Small painted swatch of each style, so the tiles read at a glance like Google's. */
function Thumbnail({ type }: { type: MapType }) {
  switch (type) {
    case 'default':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 60 60">
          <Rect width={60} height={60} fill="#F2EFE9" />
          <Path d="M40 0 Q52 20 44 60 L60 60 L60 0 Z" fill="#AAD3F0" />
          <Rect x={6} y={36} width={20} height={16} rx={4} fill="#CDE8C5" />
          <Path d="M0 26 L60 32" stroke="#F7D87B" strokeWidth={4} />
          <Path d="M22 0 L28 60" stroke="#FFFFFF" strokeWidth={3} />
        </Svg>
      );
    case 'satellite':
      return (
        <Svg width="100%" height="100%" viewBox="0 0 60 60">
          <Rect width={60} height={60} fill="#2F4630" />
          <Path d="M0 44 Q20 34 36 46 T60 42 L60 60 L0 60 Z" fill="#3F5B3A" />
          <Path d="M40 0 Q52 20 44 60 L60 60 L60 0 Z" fill="#1D4257" />
          <Path d="M6 12 Q20 6 28 16 T18 30 Q8 32 4 24 Z" fill="#4A5F3F" />
        </Svg>
      );
    case 'terrain':
    default:
      return (
        <Svg width="100%" height="100%" viewBox="0 0 60 60">
          <Rect width={60} height={60} fill="#E8E2CC" />
          <Path d="M40 0 Q52 20 44 60 L60 60 L60 0 Z" fill="#B7D6E8" />
          <Path d="M0 44 Q14 36 26 44 T38 54 L10 60 L0 60 Z" fill="#C9DDB0" />
          <Ellipse cx={20} cy={18} rx={16} ry={10} fill="none" stroke="#B79E6B" strokeWidth={1} />
          <Ellipse cx={20} cy={18} rx={10} ry={6} fill="none" stroke="#B79E6B" strokeWidth={1} />
          <Ellipse cx={20} cy={18} rx={4} ry={2.5} fill="none" stroke="#B79E6B" strokeWidth={1} />
        </Svg>
      );
  }
}

export function MapTypePanel({ value, onSelect }: { value: MapType; onSelect: (type: MapType) => void }) {
  return (
    <NeumorphicView variant="raised" radius={neuRadii.xl} style={styles.panel}>
      <Text style={styles.panelTitle}>Map type</Text>
      <View style={styles.tileRow}>
        {MAP_TYPES.map(option => {
          const selected = option.id === value;
          return (
            <TouchableOpacity
              key={option.id}
              style={styles.tileTouchable}
              onPress={() => onSelect(option.id)}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityState={{ selected }}
            >
              <View style={[styles.tile, selected && styles.tileSelected]}>
                <Thumbnail type={option.id} />
              </View>
              <Text style={[styles.tileLabel, selected && styles.tileLabelSelected]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </NeumorphicView>
  );
}

const styles = StyleSheet.create({
  button: { width: BUTTON_SIZE, height: BUTTON_SIZE, alignItems: 'center', justifyContent: 'center' },
  panel: { width: 246, padding: 12 },
  panelTitle: { fontSize: 12, fontWeight: '700', color: neuColors.textPrimary, marginBottom: 8 },
  tileRow: { flexDirection: 'row', gap: 8 },
  tileTouchable: { flex: 1, alignItems: 'center', gap: 5 },
  tile: { width: '100%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  tileSelected: { borderColor: neuColors.accent },
  tileLabel: { fontSize: 11, color: neuColors.textPrimary },
  tileLabelSelected: { fontWeight: '700', color: neuColors.accent },
});