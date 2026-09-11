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

/**
 * shadowDark was originally #C3CBD9 against a #F1F4F8 background - both
 * very light, low-contrast colors, so on real devices (especially Android,
 * where the "light" shadow layer below has no real equivalent - see
 * NeumorphicView's comment on that) the raised/inset effect read as
 * "basically flat, no visible shadow" rather than soft neumorphism.
 * Darkened enough to actually be visible while staying in the same cool
 * blue-gray family as the rest of the palette, rather than going all the
 * way to a generic mid-gray.
 */
export const neuColors = {
  background: '#F1F4F8',
  surfaceInset: '#E9EDF3',
  textPrimary: '#454F68',
  textMuted: '#98A2B8',
  /**
   * Was #F5A623 (orange) - changed to blue per direct request. Deliberately
   * a brighter, more saturated blue than `info` below (#2E5FA3) so the two
   * stay visually distinct: accent means "tap this / this is active,"
   * info means "just a note." Since this is the single token every primary
   * button, active tab, FAB, avatar badge, and selected pill in the app
   * reads from, changing it here changes it everywhere at once - no
   * per-screen edits needed. Destination pin colors (navy Required, gray
   * Optional, purple Tentative) are intentionally separate, hardcoded
   * hexes in MapScreen.tsx, not this token - they were kept as-is.
   */
  accent: '#3D7FE0',
  danger: '#E06B6B',
  /**
   * Informational highlight - "Shared" badges, banners, and other
   * low-urgency callouts. Previously three separate hardcoded amber pairs
   * (#fff6e0 / #8a5a00) scattered across ChecklistScreen, PinnedLocationCard,
   * and AccountAuthScreen instead of one shared token - consolidated here
   * so this can be changed once, in one place, and stays consistent
   * everywhere it's used.
   */
  info: '#2E5FA3',
  infoLight: '#E7EEF9',
  shadowDark: '#A9B4CC',
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
 * Raised-shadow "distance" per size - directly the value RN's native
 * `boxShadow` CSS string wants for both blur radius and (halved) offset,
 * matching the box-shadow: Npx Npx Npx color formula used throughout the
 * reference mockups. See NeumorphicView.tsx for how this turns into an
 * actual boxShadow string, and why boxShadow replaced the old
 * elevation/shadowOffset-based approach entirely.
 */
export const neuShadow = {
  sm: 5,
  md: 7,
  lg: 9,
  fab: 10,
};