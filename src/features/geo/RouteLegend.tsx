import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import NeumorphicView from '@/components/neumorphic/NeumorphicView';
import { neuColors, neuRadii } from '@/theme/neumorphic';
import { legLabel, routeLegColor } from './routeColors';

/**
 * GEO-05: the route-colors control, in two pieces because they live in
 * different spots (see MapScreen), mirroring MapTypePicker's split:
 * RouteLegendButton is the small square in the top row (search | pin | map
 * type | route colors), and RouteLegendPanel is the "Route colors" sheet
 * that drops down under that row. MapScreen owns the open/closed state and
 * the highlighted leg.
 */

const BUTTON_SIZE = 42;
// ~4.5 rows tall (one row is ~35px including its padding) - the last row
// is deliberately cut off so the panel reads as scrollable at a glance.
const PANEL_MAX_LIST_HEIGHT = 158;

/** A simple routed path with a dot at each end, distinct from MapTypeButton's stacked-diamonds layers icon. */
function RouteIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M5 19 C5 13, 9 15, 12 11 C15 7, 15 9, 19 5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M5 19 m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0" fill={color} />
      <Path d="M19 5 m-2 0 a2 2 0 1 0 4 0 a2 2 0 1 0 -4 0" fill={color} />
    </Svg>
  );
}

interface ButtonProps {
  open: boolean;
  onPress: () => void;
  /** No legs to show yet (routes still loading, or a single stop) - the button dims and does nothing rather than disappearing, so the row doesn't reflow when routing finishes. */
  disabled: boolean;
}

export function RouteLegendButton({ open, onPress, disabled }: ButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Route colors"
      accessibilityState={{ expanded: open, disabled }}
    >
      <NeumorphicView
        variant="raised"
        radius={neuRadii.lg}
        backgroundColor={open ? neuColors.accent : neuColors.background}
        style={[styles.button, disabled && styles.buttonDisabled]}
      >
        <RouteIcon color={open ? neuColors.white : neuColors.textPrimary} />
      </NeumorphicView>
    </TouchableOpacity>
  );
}

export interface LegendSegment {
  fromId: string;
  toId: string;
}

interface PanelProps {
  segments: LegendSegment[];
  nameOf: (id: string) => string | undefined;
  /** Which leg is highlighted (dims the rest on the map); null = none highlighted. */
  activeIndex: number | null;
  /** Tapping the already-active row clears the highlight (toggle). */
  onSelect: (index: number | null) => void;
  onClose: () => void;
}

/** The "Route colors" dropdown - one row per leg, its swatch matching that leg's line color on the map. Scrolls past ~4.5 rows. */
export function RouteLegendPanel({ segments, nameOf, activeIndex, onSelect, onClose }: PanelProps) {
  return (
    <NeumorphicView variant="raised" radius={neuRadii.lg} style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>Route colors</Text>
        <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.list} bounces={false}>
        {segments.map((segment, index) => {
          const selected = activeIndex === index;
          const color = routeLegColor(index);
          return (
            <TouchableOpacity
              key={`${segment.fromId}-${segment.toId}`}
              style={[styles.row, selected && { backgroundColor: `${color}22` }]}
              onPress={() => onSelect(selected ? null : index)}
              accessibilityRole="button"
              accessibilityLabel={legLabel(index, segment, nameOf)}
              accessibilityState={{ selected }}
            >
              <View style={[styles.swatch, { backgroundColor: color }]} />
              <Text style={styles.label} numberOfLines={1}>
                {legLabel(index, segment, nameOf)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </NeumorphicView>
  );
}

const styles = StyleSheet.create({
  button: { width: BUTTON_SIZE, height: BUTTON_SIZE, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.4 },
  panel: { width: 220, padding: 8 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingVertical: 2, marginBottom: 4 },
  panelTitle: { fontSize: 11, fontWeight: '700', color: neuColors.textPrimary },
  closeIcon: { fontSize: 12, color: neuColors.textMuted },
  list: { maxHeight: PANEL_MAX_LIST_HEIGHT },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, paddingHorizontal: 6, borderRadius: 8 },
  swatch: { width: 12, height: 12, borderRadius: 4, flexShrink: 0 },
  label: { flex: 1, fontSize: 11.5, color: neuColors.textPrimary },
});