import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
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
 * Neither iOS nor Android natively support a single view casting two
 * differently-colored shadows (one light, one dark) at once - RN's
 * shadowColor/shadowOffset/shadowOpacity/shadowRadius are singular per
 * view. The standard trick (used here) is to stack THREE identically
 * shaped/colored views on top of each other: the bottom one casts the
 * dark shadow (offset down-right), the middle one casts the light shadow
 * (offset up-left), and the top one holds the actual content with no
 * shadow of its own - since all three are the same opaque flat color and
 * exactly overlap, they visually read as one flat surface with both
 * shadows visible around its edges.
 *
 * iOS renders shadowColor/shadowOffset/shadowOpacity/shadowRadius
 * natively and should match the mockups closely. Android's shadow
 * rendering (shadowColor + elevation together) is real but visually
 * cruder than iOS for soft, blurred, colored shadows - this is a platform
 * limitation, not a bug in this component. Worth a visual check on a real
 * Android device/emulator; a small elevation bump or radius tweak per
 * platform may be worth it once you've seen it rendered there.
 *
 * variant="inset" (used for text inputs, unchecked checkboxes, disabled
 * buttons, track backgrounds) can't use real shadows at all - CSS's
 * `inset` keyword has no RN equivalent. Approximated instead with a
 * bevelled border: darker on the top/left edge, lighter on the
 * bottom/right, which reads as a pressed-in groove without needing any
 * shadow API. This is cheap, reliable, and identical on both platforms.
 *
 * variant="flat" is the plain "Dark" segmented-control-tab / unselected
 * state from the mockup - no shadow, just the surface color.
 */
const MARGIN_KEYS = [
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'marginStart',
  'marginEnd',
] as const;

/**
 * Splits a caller's style into what belongs on the outer wrapper (margin -
 * spacing relative to this card's own siblings) vs. what belongs on the
 * content layer (padding, width, everything else - anything that affects
 * this card's own internal box). This split is what fixes a real bug: an
 * earlier version applied the whole style to the outer wrapper only,
 * while the two shadow layers (StyleSheet.absoluteFill) and the content
 * layer sized themselves independently - in practice, that let the
 * opaque content layer's edges land right on top of (or past) the shadow
 * layers' edges, which is why raised cards were rendering as visually
 * flat (the shadows were there, just hidden under the content), and why
 * text near a card's edge could get clipped by the content layer's
 * overflow: hidden a few pixels early. Keeping padding on the content
 * layer specifically - the one layer that's normal-flow and therefore
 * the one thing that determines the wrapper's auto-computed size - and
 * letting the two absolutely-positioned shadow layers fill that same
 * wrapper via StyleSheet.absoluteFill guarantees all three layers land on
 * pixel-identical bounds.
 */
function splitWrapperAndContentStyle(style: StyleProp<ViewStyle>): { wrapperStyle: ViewStyle; contentStyle: ViewStyle } {
  const flat = (StyleSheet.flatten(style) ?? {}) as ViewStyle;
  const wrapperStyle: ViewStyle = {};
  const contentStyle: ViewStyle = {};
  for (const [key, value] of Object.entries(flat)) {
    if ((MARGIN_KEYS as readonly string[]).includes(key)) {
      (wrapperStyle as Record<string, unknown>)[key] = value;
    } else {
      (contentStyle as Record<string, unknown>)[key] = value;
    }
  }
  return { wrapperStyle, contentStyle };
}

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
            borderWidth: 1.5,
            borderTopColor: neuColors.shadowDark,
            borderLeftColor: neuColors.shadowDark,
            borderBottomColor: neuColors.shadowLight,
            borderRightColor: neuColors.shadowLight,
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

  const { offset, radius: blur } = neuShadow[size];
  const shared = { borderRadius: radius, backgroundColor };
  const { wrapperStyle, contentStyle } = splitWrapperAndContentStyle(style);

  return (
    <View style={wrapperStyle}>
      {/* Dark shadow layer, offset down-right - fills whatever box the content layer below ends up computing (see contentStyle note above) */}
      <View
        style={[
          StyleSheet.absoluteFill,
          shared,
          Platform.select({
            ios: {
              shadowColor: neuColors.shadowDark,
              shadowOffset: { width: offset, height: offset },
              shadowOpacity: 0.7,
              shadowRadius: blur,
            },
            android: {
              shadowColor: neuColors.shadowDark,
              elevation: offset + 2,
            },
          }),
        ]}
      />
      {/* Light shadow layer, offset up-left */}
      <View
        style={[
          StyleSheet.absoluteFill,
          shared,
          Platform.select({
            ios: {
              shadowColor: neuColors.shadowLight,
              shadowOffset: { width: -offset, height: -offset },
              shadowOpacity: 0.9,
              shadowRadius: blur,
            },
            android: {
              // Android can't cast a shadow "upward" via elevation the way
              // iOS can via shadowOffset - elevation always shadows
              // downward regardless of offset. A thin light-colored top/
              // left border on the content layer below stands in for the
              // highlight edge on Android instead (see the content view).
              elevation: 0,
            },
          }),
        ]}
      />
      {/*
        Content layer - the only normal-flow child, so it's what determines
        the wrapper's auto-computed size; the two shadow layers above match
        it exactly via absoluteFill. Opaque, no shadow of its own.

        Deliberately NOT setting overflow:'hidden' here. It was previously
        always applied (to clip content to the rounded corner), but for
        plain text content that's pure downside: any child whose measured
        size is even a couple of pixels larger than this box's computed
        size - which text easily can be, depending on font metrics/line
        height/font weight - gets silently cropped instead of just
        slightly poking past a rounded corner (which is visually
        unnoticeable at these radii anyway). If a future consumer actually
        needs corner-clipping (e.g. a background image filling the card),
        it should opt in explicitly rather than every text-based card
        paying this risk by default.
      */}
      <View
        style={[
          shared,
          Platform.OS === 'android' && {
            borderTopWidth: 1,
            borderLeftWidth: 1,
            borderTopColor: 'rgba(255,255,255,0.6)',
            borderLeftColor: 'rgba(255,255,255,0.6)',
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}