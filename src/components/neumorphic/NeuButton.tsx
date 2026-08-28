import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import NeumorphicView from './NeumorphicView';
import { neuColors, neuRadii } from '@/theme/neumorphic';

type Variant = 'primary' | 'secondary' | 'disabled' | 'cancel';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  /** Shows a spinner (in the button's own text color) instead of the label, and disables presses - for an in-flight async action this button triggers. */
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Matches the gallery's Buttons row (Primary/Secondary/Disabled) and the
 * modal card's Cancel/Save pair. Also implements the reference's
 * "Pressed" state - while actively held down, a primary/secondary button
 * inverts to the inset surface with accent-colored text (matching the
 * mockup exactly), rather than just fading opacity like a plain
 * TouchableOpacity would. cancel/disabled are already inset at rest, so
 * they don't have a further "more pressed" state to show.
 */
export default function NeuButton({ label, onPress, variant = 'primary', disabled, loading, style }: Props) {
  const [pressed, setPressed] = useState(false);
  const isDisabled = disabled || loading || variant === 'disabled';
  const alreadyInset = variant === 'cancel' || variant === 'disabled';
  const showPressedState = pressed && !isDisabled && !alreadyInset;

  const shadowVariant = alreadyInset || showPressedState ? 'inset' : 'raised';
  const backgroundColor =
    variant === 'primary' ? neuColors.accent : variant === 'secondary' ? neuColors.background : neuColors.surfaceInset;
  const textColor = showPressedState
    ? neuColors.accent
    : variant === 'primary'
      ? neuColors.white
      : variant === 'cancel'
        ? neuColors.danger
        : variant === 'disabled'
          ? neuColors.textMuted
          : neuColors.textPrimary;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={style}
    >
      <NeumorphicView variant={shadowVariant} size="sm" radius={neuRadii.md} backgroundColor={backgroundColor} style={styles.button}>
        {loading ? (
          <ActivityIndicator color={textColor} size="small" />
        ) : (
          <Text style={[styles.label, { color: textColor }]}>{label}</Text>
        )}
      </NeumorphicView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 9 },
  label: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
