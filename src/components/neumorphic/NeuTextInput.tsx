import React from 'react';
import { StyleProp, StyleSheet, TextInput, TextInputProps, ViewStyle } from 'react-native';
import NeumorphicView from './NeumorphicView';
import { neuColors, neuRadii } from '@/theme/neumorphic';

interface Props extends Omit<TextInputProps, 'style'> {
  /** Sizes/positions the outer box (e.g. `{ width: 130 }`) - passed to the wrapper, not the inner TextInput, so it never clobbers the input's own padding/color styles. */
  style?: StyleProp<ViewStyle>;
}

/** Matches the gallery's "Text Inputs" section - an inset (pressed-in) field. */
export default function NeuTextInput({ style, ...props }: Props) {
  return (
    <NeumorphicView variant="inset" radius={neuRadii.md} style={[styles.wrapper, style]}>
      <TextInput placeholderTextColor={neuColors.textMuted} style={styles.input} {...props} />
    </NeumorphicView>
  );
}

const styles = StyleSheet.create({
  wrapper: { height: 38, justifyContent: 'center' },
  input: { paddingHorizontal: 12, fontSize: 13, color: neuColors.textPrimary },
});
