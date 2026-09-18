/**
 * Stronger 2.0 design system — public surface.
 *
 * Everything the UI layer needs, and nothing else. Components import from
 * `@ui/theme`; no file outside this directory may contain a hex literal, a
 * font size, a duration or a raw pixel value that belongs to a scale here.
 *
 * All of it is pure TypeScript: plain data objects with no `react`,
 * `react-native` or `expo-*` dependency, so the same tokens can drive a future
 * web dashboard untouched.
 */

export {
  TIERS,
  borderWidth,
  darkTheme,
  layout,
  lightTheme,
  opacity,
  radius,
  space,
  themes,
  zIndex,
} from './tokens';

export type {
  ActionRole,
  ActivityRamp,
  CategoricalPalette,
  Color,
  EdgeHighlight,
  Elevation,
  HeatRamp,
  Hex,
  RecordRole,
  SemanticRole,
  ShadowLayer,
  SpaceKey,
  Theme,
  Tier,
  VizTokens,
} from './tokens';

export {
  TABULAR_FEATURE,
  TYPE_ROLES,
  featureSettingsCss,
  featuresFor,
  fontAxes,
  fontFeatures,
  fonts,
  isTabular,
  numeralPolicy,
  stackFor,
  typeScale,
  weight,
} from './typography';

export type {
  FontFamilyRole,
  FontStack,
  NumeralRule,
  NumeralStyle,
  TypeRole,
  TypeStyle,
  WeightKey,
} from './typography';

export {
  COUNT_UP_MS,
  REST_TIMER_EASING,
  STAGGER_MS,
  bannedMotion,
  duration,
  easing,
  resolveDuration,
  sanctionedMotion,
  shouldAnimate,
} from './motion';

export type {
  BannedMotion,
  BezierPoints,
  DurationKey,
  EasingCurve,
  EasingKey,
  MotionSpec,
} from './motion';
