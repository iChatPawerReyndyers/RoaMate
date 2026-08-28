/**
 * Design tokens for the neumorphic ("soft UI") visual language, extracted
 * directly from the provided component-gallery and layout mockups.
 *
 * Rollout note: this is the shared foundation (tokens + component
 * library). It's applied to the Expenses tab first (see
 * ExpensesHubScreen.tsx and friends) as the reference implementation -
 * other screens still use their original inline styles until we decide to
 * roll this further.
 */

export const neuColors = {
  background: '#F1F4F8',
  surfaceInset: '#E9EDF3',
  textPrimary: '#454F68',
  textMuted: '#98A2B8',
  accent: '#F5A623',
  danger: '#E06B6B',
  shadowDark: '#C3CBD9',
  shadowLight: '#FFFFFF',
  white: '#FFFFFF',
};

export const neuRadii = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 20,
  xxl: 24,
};

export const neuSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
};

/**
 * Raised-shadow offsets/blur, keyed by size - matches the mockup's two
 * shadow scales: the modal-card/button scale (tighter, ~2-5px offset) and
 * the larger floating-card/FAB scale (~4-6px offset). Consumed by
 * NeumorphicView (see components/neumorphic/NeumorphicView.tsx), which
 * turns these into the actual platform shadow styles.
 */
export const neuShadow = {
  sm: { offset: 2, radius: 4 },
  md: { offset: 4, radius: 8 },
  lg: { offset: 5, radius: 9 },
  fab: { offset: 5, radius: 10 },
};