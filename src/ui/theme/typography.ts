/**
 * Stronger 2.0 — typography.
 *
 * Pure TypeScript. No `react-native` import, not even for types; a `TextStyle`
 * is built from these plain objects at the render layer.
 *
 * Two families, no more. Inter Variable v4 carries the UI. Archivo Variable,
 * held at width axis 112, carries exactly three things — hero metric numerals,
 * the rank name and the finish-summary headline — which is what keeps the
 * pairing from reading like a template.
 *
 * The load-bearing decision in this file is the numeral policy. This app is
 * wall-to-wall numbers, and proportional figures in a Reps column make the
 * digits jitter every time 8 becomes 11. See {@link numeralPolicy}.
 *
 * Source: docs/research/stronger-2-0-visual-design-system-verified-dark-li.md
 * section 4 "Type scale (exact)" and the finding "Tabular figures are
 * non-negotiable and survive font-fallback".
 */

// ---------------------------------------------------------------------------
// 1. Families
// ---------------------------------------------------------------------------

/** Which of the three loaded families a role is set in. */
export type FontFamilyRole = 'ui' | 'display' | 'mono';

/**
 * A font stack. `stack` is the ordered fallback list for platforms that accept
 * one (web, and React Native for Web); `primary` is the single family name to
 * pass to React Native's `fontFamily`, which accepts no fallbacks at all.
 */
export interface FontStack {
  /** The single family React Native will use once the font is registered. */
  readonly primary: string;
  /** Full ordered fallback list, best first. */
  readonly stack: readonly string[];
  /** The stack as a CSS `font-family` value. */
  readonly css: string;
}

const stackOf = (families: readonly string[]): FontStack => {
  const primary = families[0];
  if (primary === undefined) {
    throw new Error('A font stack needs at least one family.');
  }
  return {
    primary,
    stack: families,
    css: families.map((f) => (/[^A-Za-z0-9-]/.test(f) ? `'${f}'` : f)).join(', '),
  };
};

/**
 * The three font stacks.
 *
 * Every system fallback listed here — SF Pro, Segoe UI Variable, Roboto —
 * ships a tabular figure set, so the numeral rule below survives a webfont load
 * failure rather than silently degrading into jittering columns.
 *
 * Source: research doc section 4 "Typefaces"; Inter at https://rsms.me/inter/
 * (SIL OFL), Archivo at https://fonts.google.com/specimen/Archivo (SIL OFL).
 */
export const fonts: Readonly<Record<FontFamilyRole, FontStack>> = {
  ui: stackOf([
    'Inter Variable',
    'Inter',
    '-apple-system',
    'SF Pro Text',
    'Segoe UI Variable Text',
    'Segoe UI',
    'Roboto',
    'Helvetica Neue',
    'Arial',
    'sans-serif',
  ]),
  display: stackOf([
    'Archivo Variable',
    'Archivo',
    'Inter Variable',
    '-apple-system',
    'SF Pro Display',
    'Segoe UI Variable Display',
    'Roboto',
    'sans-serif',
  ]),
  mono: stackOf([
    'ui-monospace',
    'SF Mono',
    'JetBrains Mono',
    'Cascadia Mono',
    'Roboto Mono',
    'Menlo',
    'Consolas',
    'monospace',
  ]),
};

/**
 * OpenType features for the UI family, as `[tag, value]` pairs.
 *
 * `cv05` gives lowercase *l* a tail and `cv08` gives uppercase *I* serifs,
 * which kills the 1 / l / I collision that appears everywhere in strings like
 * "1 x 12 lb" at 13px. Slashed zero (`zero`) is deliberately absent: it reads
 * as an engineering tool, not an athletic one.
 *
 * Source: research doc, "Inter v4 has specific character variants...".
 */
export const fontFeatures: readonly (readonly [tag: string, value: number])[] = [
  ['cv05', 1],
  ['cv08', 1],
  ['ss03', 1],
  ['calt', 1],
];

/** Tabular-figure feature tag, appended to {@link fontFeatures} where required. */
export const TABULAR_FEATURE: readonly [tag: string, value: number] = ['tnum', 1];

/**
 * Serialises OpenType feature pairs into a CSS `font-feature-settings` value.
 *
 * @param features Feature tag/value pairs.
 * @returns e.g. `"'cv05' 1, 'cv08' 1"`.
 */
export const featureSettingsCss = (
  features: readonly (readonly [string, number])[],
): string => features.map(([tag, value]) => `'${tag}' ${value}`).join(', ');

/**
 * Variable-font axis values.
 *
 * Archivo is held at `wdth` 112 — slightly expanded — which is what gives hero
 * numerals a scoreboard presence Inter alone cannot produce. Its range is
 * 62-125; do not vary it per component.
 */
export const fontAxes = {
  /** Archivo width axis for display numerals. Range 62-125. */
  displayWidth: 112,
  /** Inter width axis. 100 = normal; the app never varies it. */
  uiWidth: 100,
} as const;

// ---------------------------------------------------------------------------
// 2. Weights
// ---------------------------------------------------------------------------

/**
 * Named weights. These are variable-font `wght` axis values, not the nine
 * static CSS steps, which is why `regular` is 450 rather than 400: Inter at 400
 * is slightly thin against a near-black background, where strokes optically
 * bloom and then thin out.
 */
export const weight = {
  regular: 450,
  medium: 520,
  semibold: 600,
  bold: 680,
  black: 800,
  /** Archivo weight for hero metrics. */
  display: 700,
} as const;

export type WeightKey = keyof typeof weight;

// ---------------------------------------------------------------------------
// 3. Numeral policy
// ---------------------------------------------------------------------------

/**
 * `tabular` forces a uniform digit advance width, so a column does not reflow
 * as 8 becomes 11. `proportional` lets digits keep their natural widths, which
 * reads better inside a sentence.
 */
export type NumeralStyle = 'tabular' | 'proportional';

/** One entry in the numeral policy: a concrete surface and why it is that way. */
export interface NumeralRule {
  /** The concrete UI surface this rule governs. */
  readonly context: string;
  /** Why this surface takes this numeral style. */
  readonly reason: string;
}

/**
 * Where tabular figures are MANDATORY and where proportional is correct.
 *
 * The rule must be applied consistently: mixing tabular and proportional
 * figures inside one view is worse than using neither. The test file asserts
 * that every role in {@link typeScale} whose name starts with `num`, and every
 * display role, is tabular — but the list below is the design contract that a
 * reviewer checks a screen against, because a role can be used in the wrong
 * place even when its own setting is right.
 *
 * Source: research doc section 4, "The numeral rule".
 */
export const numeralPolicy: {
  readonly tabular: readonly NumeralRule[];
  readonly proportional: readonly NumeralRule[];
} = {
  tabular: [
    {
      context: 'Set-row cells: set number, Previous, Reps, KG, RPE',
      reason:
        'Six rows sit in a fixed grid; proportional digits shift the column edges every time a rep count changes from 8 to 11.',
    },
    {
      context: 'Stat tile values and their deltas',
      reason:
        'Tiles are laid out in a 2-up grid and read as a row; unequal digit widths make two equal-length numbers look different lengths.',
    },
    {
      context: 'Live counters: workout duration, running volume, exercise count',
      reason:
        'The value changes while the user is looking at it. Proportional digits make the whole line twitch once a second.',
    },
    {
      context: 'Rest timer numerals, including the final-five-seconds state',
      reason:
        'A countdown is the worst case for jitter — every digit changes, once per second, at large size.',
    },
    {
      context: 'Chart axis labels, tooltip values and scrub chips',
      reason:
        'Axis labels are right-aligned against a fixed plot edge; proportional digits break that alignment.',
    },
    {
      context: 'Numeric inputs (weight, reps, bodyweight, RPE)',
      reason:
        'The caret must not move horizontally as the user types a digit that happens to be narrower.',
    },
    {
      context: 'e1RM cards, percentile numbers, rank points and world standings',
      reason: 'These numbers are compared against each other down a column.',
    },
    {
      context: 'Workout history card metric strip (12 exercises / 4,820 kg / 148 reps)',
      reason: 'Three metrics separated by dividers, stacked identically across many cards.',
    },
  ],
  proportional: [
    {
      context: 'Prose sentences ("You trained 4 times this week")',
      reason:
        'Tabular digits leave gappy sidebearings inside running text; proportional figures set evenly with the letters around them.',
    },
    {
      context: 'Microcopy and empty-state body copy',
      reason: 'Same as prose — nothing here is compared to a number on the line above.',
    },
    {
      context: 'Community post text authored by users',
      reason: 'It is prose, and it must render the same as any other body copy.',
    },
  ],
};

// ---------------------------------------------------------------------------
// 4. The type scale
// ---------------------------------------------------------------------------

/**
 * One role in the type scale. All lengths are in density-independent pixels,
 * which is what React Native's `fontSize`, `lineHeight` and `letterSpacing`
 * take. `letterSpacingEm` is kept alongside because the scale was authored in
 * em and CSS consumers want it back in em.
 */
export interface TypeStyle {
  /** Font size, dp. */
  readonly size: number;
  /** Line height, dp (absolute, not a multiplier). */
  readonly lineHeight: number;
  /** Tracking as a fraction of the font size, as authored. */
  readonly letterSpacingEm: number;
  /** Tracking in dp, derived from `letterSpacingEm * size`, rounded to 0.01. */
  readonly letterSpacing: number;
  /** Variable-font weight axis value. */
  readonly weight: number;
  readonly family: FontFamilyRole;
  readonly numerals: NumeralStyle;
  /** `'uppercase'` only on the 11px eyebrow. Nothing else is ever all-caps. */
  readonly transform: 'none' | 'uppercase';
}

/** The authored form of a role, before `letterSpacing` is derived. */
interface TypeStyleSpec {
  readonly size: number;
  readonly lineHeight: number;
  readonly letterSpacingEm: number;
  readonly weight: number;
  readonly family: FontFamilyRole;
  readonly numerals: NumeralStyle;
  readonly transform?: 'none' | 'uppercase';
}

/**
 * Derives the dp tracking for a role so the em and dp forms can never disagree.
 *
 * @param spec The authored role.
 * @returns The role with `letterSpacing` computed in dp, rounded to 0.01 dp.
 */
const toTypeStyle = (spec: TypeStyleSpec): TypeStyle => ({
  size: spec.size,
  lineHeight: spec.lineHeight,
  letterSpacingEm: spec.letterSpacingEm,
  letterSpacing: Math.round(spec.letterSpacingEm * spec.size * 100) / 100,
  weight: spec.weight,
  family: spec.family,
  numerals: spec.numerals,
  transform: spec.transform ?? 'none',
});

/**
 * Every role in the product. Nothing outside this object sets a font size.
 *
 * Roles, in four groups:
 * - `display*` — Archivo, tabular, for hero metrics only. Four sizes because a
 *   volume total and a bodyweight need very different room.
 * - `title*` / `body*` / `label*` — Inter, proportional, for language.
 * - `num*` — Inter, tabular, for numbers that sit in the interface rather than
 *   in a sentence: set rows, stat values, the Previous column.
 * - `monoS` — for IDs, hashes and debug surfaces. Not for user-facing numbers;
 *   monospace is a worse solution to jitter than `tnum` on a proportional face.
 *
 * Source: research doc section 4, transcribed exactly.
 */
export const typeScale = {
  /** Finish-summary headline number. The largest thing in the product. */
  displayXl: toTypeStyle({
    size: 56, lineHeight: 56, letterSpacingEm: -0.03, weight: weight.display,
    family: 'display', numerals: 'tabular',
  }),
  /** Hero metric on the Progress tab. */
  displayL: toTypeStyle({
    size: 44, lineHeight: 44, letterSpacingEm: -0.028, weight: weight.display,
    family: 'display', numerals: 'tabular',
  }),
  /** Ring centre value; large stat tile value. */
  displayM: toTypeStyle({
    size: 34, lineHeight: 36, letterSpacingEm: -0.022, weight: weight.display,
    family: 'display', numerals: 'tabular',
  }),
  /** Sub-rank numeral; secondary hero. */
  displayS: toTypeStyle({
    size: 28, lineHeight: 32, letterSpacingEm: -0.018, weight: weight.display,
    family: 'display', numerals: 'tabular',
  }),

  /** Screen title. Left-aligned — never centred, never letter-spaced caps. */
  titleL: toTypeStyle({
    size: 22, lineHeight: 28, letterSpacingEm: -0.012, weight: weight.bold,
    family: 'ui', numerals: 'proportional',
  }),
  /** Section heading; empty-state headline; rank tier name. */
  titleM: toTypeStyle({
    size: 19, lineHeight: 24, letterSpacingEm: -0.008, weight: weight.semibold,
    family: 'ui', numerals: 'proportional',
  }),
  /** Card title; exercise name in a list row. */
  titleS: toTypeStyle({
    size: 17, lineHeight: 22, letterSpacingEm: -0.004, weight: weight.semibold,
    family: 'ui', numerals: 'proportional',
  }),

  /** Long-form copy; sheet body. */
  bodyL: toTypeStyle({
    size: 16, lineHeight: 24, letterSpacingEm: 0, weight: weight.regular,
    family: 'ui', numerals: 'proportional',
  }),
  /** Default body. */
  bodyM: toTypeStyle({
    size: 15, lineHeight: 22, letterSpacingEm: 0, weight: weight.regular,
    family: 'ui', numerals: 'proportional',
  }),
  /** Supporting line; timestamps; delta rows. */
  bodyS: toTypeStyle({
    size: 13, lineHeight: 18, letterSpacingEm: 0.004, weight: weight.regular,
    family: 'ui', numerals: 'proportional',
  }),

  /** Button label; segmented-control label. */
  labelL: toTypeStyle({
    size: 15, lineHeight: 20, letterSpacingEm: 0, weight: weight.medium,
    family: 'ui', numerals: 'proportional',
  }),
  /** Chip label; column header; chart title. */
  labelM: toTypeStyle({
    size: 13, lineHeight: 16, letterSpacingEm: 0.01, weight: weight.medium,
    family: 'ui', numerals: 'proportional',
  }),
  /**
   * The eyebrow above a stat value. The only uppercase role in the product —
   * uppercase is reserved for 11px, so a 32px all-caps heading is always wrong.
   */
  labelS: toTypeStyle({
    size: 11, lineHeight: 14, letterSpacingEm: 0.06, weight: weight.bold,
    family: 'ui', numerals: 'proportional', transform: 'uppercase',
  }),

  /** Stat tile value; live counter; rest-timer numeral. */
  numL: toTypeStyle({
    size: 20, lineHeight: 24, letterSpacingEm: -0.006, weight: weight.semibold,
    family: 'ui', numerals: 'tabular',
  }),
  /** Set-row reps and kg, and the numeric inputs that edit them. */
  numM: toTypeStyle({
    size: 17, lineHeight: 20, letterSpacingEm: -0.004, weight: weight.semibold,
    family: 'ui', numerals: 'tabular',
  }),
  /** Previous column; chart axis labels; small metric strip. */
  numS: toTypeStyle({
    size: 13, lineHeight: 16, letterSpacingEm: 0, weight: weight.medium,
    family: 'ui', numerals: 'tabular',
  }),

  /** IDs, sync hashes, debug. Never a user-facing training number. */
  monoS: toTypeStyle({
    size: 12, lineHeight: 16, letterSpacingEm: 0, weight: weight.regular,
    family: 'mono', numerals: 'tabular',
  }),
} as const;

/** Every role name in {@link typeScale}. */
export type TypeRole = keyof typeof typeScale;

/** Role names as a value, for iteration in tests and in a spec screen. */
export const TYPE_ROLES = Object.keys(typeScale) as readonly TypeRole[];

/**
 * Whether a role must render with tabular figures.
 *
 * @param role A role from {@link typeScale}.
 * @returns `true` when the role's numerals are tabular.
 */
export const isTabular = (role: TypeRole): boolean => typeScale[role].numerals === 'tabular';

/**
 * The OpenType feature list to apply for a role, including `tnum` when the role
 * is tabular.
 *
 * @param role A role from {@link typeScale}.
 * @returns Feature tag/value pairs, ready for {@link featureSettingsCss}.
 */
export const featuresFor = (
  role: TypeRole,
): readonly (readonly [string, number])[] =>
  isTabular(role) ? [...fontFeatures, TABULAR_FEATURE] : fontFeatures;

/**
 * The font stack a role is set in.
 *
 * @param role A role from {@link typeScale}.
 * @returns The stack from {@link fonts}.
 */
export const stackFor = (role: TypeRole): FontStack => fonts[typeScale[role].family];
