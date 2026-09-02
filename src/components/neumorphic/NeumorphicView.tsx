import React from 'react';
import { PixelRatio, StyleProp, View, ViewStyle } from 'react-native';
import { neuColors, neuRadii, neuShadow } from '@/theme/neumorphic';

type Variant = 'raised' | 'inset' | 'flat';
type ShadowSize = keyof typeof neuShadow;

interface Props {
  children?: React.ReactNode;
  variant?: Variant;
  size?: ShadowSize;
  radius?: number;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Rebuilt on RN's native `boxShadow` style property (New Architecture
 * only - this project has newArchEnabled=true in
 * android/gradle.properties, and is on RN 0.86.2, well within the 0.76+
 * range this landed in). It implements the real CSS box-shadow spec at
 * the platform level, on both iOS and Android identically, and accepts
 * the same comma-separated multi-shadow string CSS does - so a single
 * View can finally cast both a dark shadow (bottom-right) and a light
 * shadow (top-left) at once, which is the actual definition of the
 * neumorphic look.
 *
 * This replaces an earlier version of this component that predated
 * boxShadow being usable here and worked around its absence by stacking
 * three separate Views (one per shadow direction, plus a content layer)
 * and using iOS's shadowColor/shadowOffset/shadowOpacity/shadowRadius on
 * two of them - a real technique, but one with a hard platform
 * limitation baked in: Android's `elevation` API can only ever cast a
 * shadow downward, no matter what offset you give it, so there was no
 * way to make that old approach produce a genuine light/highlight edge
 * on Android at all (it was approximated with a border tint instead,
 * which read as noticeably weaker than the real thing). boxShadow has no
 * such limitation - both shadow directions render for real on both
 * platforms - so raised cards, buttons, and FABs should now look
 * consistent across iOS and Android rather than iOS-only.
 *
 * variant="inset" (text inputs, unchecked checkboxes, disabled buttons,
 * toggle tracks) still can't use a real shadow - CSS itself needs a
 * separate `inset` keyword per shadow layer that this RN property doesn't
 * yet support. Still approximated with a bevelled hairline border
 * (darker top/left, lighter bottom/right) over the inset fill color, same
 * as before - this part of the technique was never the problem, so it's
 * unchanged other than switching to a true 1-physical-pixel hairline via
 * PixelRatio for a crisper groove line.
 *
 * variant="flat" is the plain, unselected/inactive surface - no shadow,
 * just the surface color.
 *
 * Deliberately no overflow:'hidden' anywhere in this file. RN already
 * renders a View's own background rounded via borderRadius alone, with no
 * clipping needed for that - and combining overflow:'hidden' with
 * boxShadow on the same element is a long-documented RN quirk
 * (facebook/react-native#449): the two compete over the same clip/paint
 * boundary, which shows up as a chopped, unrounded corner instead of a
 * smooth curve. If a child ever needs clipping to the rounded shape (e.g.
 * a background image filling a card), that belongs on a separate inner
 * wrapper View, never on this same element.
 */

const INSET_HAIRLINE = 1.5 / PixelRatio.get();

export default function NeumorphicView({
  children,
  variant = 'raised',
  size = 'md',
  radius = neuRadii.lg,
  backgroundColor = neuColors.background,
  style,
}: Props) {
  if (variant === 'inset') {
    return (
      <View
        style={[
          {
            borderRadius: radius,
            backgroundColor: neuColors.surfaceInset,
            borderWidth: INSET_HAIRLINE,
            borderTopColor: 'rgba(169,180,204,0.65)',
            borderLeftColor: 'rgba(169,180,204,0.65)',
            borderBottomColor: 'rgba(255,255,255,0.75)',
            borderRightColor: 'rgba(255,255,255,0.75)',
          },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  if (variant === 'flat') {
    return <View style={[{ borderRadius: radius, backgroundColor }, style]}>{children}</View>;
  }

  const distance = neuShadow[size];
  const offset = distance / 2;

  return (
    <View
      style={[
        {
          borderRadius: radius,
          backgroundColor,
          boxShadow: `${offset}px ${offset}px ${distance}px ${neuColors.shadowDark}, ${-offset}px ${-offset}px ${distance}px ${neuColors.shadowLight}`,
        } as ViewStyle,
        style,
      ]}
    >
      {children}
    </View>
  );
}