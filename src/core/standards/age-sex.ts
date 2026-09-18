/**
 * Age and sex adjustment for the strength standards.
 *
 * SEX is never a multiplier. Men and women get their own reference distributions,
 * because the ratio between them varies by lift, by bodyweight and by level; a single
 * coefficient would be wrong everywhere. Users pick which population to be compared
 * against ("men", "women" or "both") rather than having it inferred from a gender field.
 *
 * AGE is a multiplier, applied to the REFERENCE, not to the lifter's load — the
 * reference median for a 55-year-old is the open-class median divided by the age
 * coefficient, which is the same convention masters powerlifting uses. Youth
 * coefficients are Foster's, masters coefficients are the revised McCulloch set, both
 * published by USA Powerlifting. Symmetric Strength fits the same two tables as
 * quadratics; this module ships both the exact tables and that quadratic fit.
 *
 * Corroboration for the direction and shape: van den Hoek et al., JSAMS 2024;27(10):
 * 734-742 (n=809,986 competition entries) find relative strength peaking at 18-35 y and
 * declining thereafter in all three powerlifts.
 *
 * @see https://www.usapowerlifting.com/wp-content/uploads/2021/01/USAPL-Age-Coefficients.pdf
 * @see https://symmetricstrength.com/about
 * @see https://www.jsams.org/article/S1440-2440(24)00246-9/fulltext
 */

import type { MethodologyNote } from './standards-data';

/** Whether the lifter is scored against their age group or the open class. */
export type AgeMode = 'age_graded' | 'open';

/** Which reference population the lifter chose to be compared against. */
export type CompareAgainst = 'male' | 'female' | 'both';

/** Below this age the app tracks but does not classify: no published coefficients exist. */
export const MIN_CLASSIFIABLE_AGE = 14;

/** Age at which the youth curve reaches 1.0 and the open class begins. */
export const YOUTH_BASELINE_AGE = 23;

/** Age at which the masters curve leaves 1.0. */
export const MASTERS_BASELINE_AGE = 40;

/**
 * Age beyond which the masters coefficient is frozen. The McCulloch coefficients are
 * calibrated on competitive masters and become generous past 75 (2.05x at 80); without
 * this cap an 82-year-old would be told they are World Class.
 */
export const MASTERS_CAP_AGE = 80;

/**
 * Foster youth coefficients (USA Powerlifting). Multiply the reference by 1/C: a
 * 16-year-old is compared against a reference 13% lower than the adult one.
 * @see https://www.usapowerlifting.com/wp-content/uploads/2021/01/USAPL-Age-Coefficients.pdf
 */
export const FOSTER_COEFFICIENTS: Readonly<Record<number, number>> = {
  14: 1.23,
  15: 1.18,
  16: 1.13,
  17: 1.08,
  18: 1.06,
  19: 1.04,
  20: 1.03,
  21: 1.02,
  22: 1.01,
  23: 1.0,
};

/**
 * Revised McCulloch masters coefficients (USA Powerlifting / WRPF).
 * Ages 61-64 and 65 are absent from the published extract used here and are filled by
 * linear interpolation in {@link ageCoefficientFromTable}; the engine uses the quadratic
 * fit in {@link ageFactor} anyway, which agrees with the table to about 0.7%.
 * @see https://www.usapowerlifting.com/wp-content/uploads/2021/01/USAPL-Age-Coefficients.pdf
 */
export const MCCULLOCH_COEFFICIENTS: Readonly<Record<number, number>> = {
  40: 1.0,
  41: 1.01,
  42: 1.02,
  43: 1.031,
  44: 1.043,
  45: 1.055,
  46: 1.068,
  47: 1.082,
  48: 1.097,
  49: 1.113,
  50: 1.13,
  51: 1.147,
  52: 1.165,
  53: 1.184,
  54: 1.204,
  55: 1.225,
  56: 1.246,
  57: 1.268,
  58: 1.291,
  59: 1.315,
  60: 1.34,
  66: 1.511,
  67: 1.543,
  68: 1.576,
  69: 1.61,
  70: 1.645,
  71: 1.681,
  72: 1.718,
  73: 1.756,
  74: 1.795,
  75: 1.835,
  76: 1.876,
  77: 1.918,
  78: 1.961,
  79: 2.005,
  80: 2.05,
  81: 2.096,
  82: 2.143,
  83: 2.19,
};

/**
 * Is this lifter old enough to be placed on the standards scale at all?
 * @param age years
 * @returns false below 14, where no published coefficients exist and the UI must show
 *          "Youth mode — tracking only"
 * @see https://www.usapowerlifting.com/wp-content/uploads/2021/01/USAPL-Age-Coefficients.pdf
 */
export function isClassifiableAge(age: number): boolean {
  return Number.isFinite(age) && age >= MIN_CLASSIFIABLE_AGE;
}

/** Linearly interpolate a sparse integer-keyed coefficient table. */
function lookupTable(table: Readonly<Record<number, number>>, age: number): number | undefined {
  const exact = table[Math.round(age * 1000) / 1000];
  if (exact !== undefined && Number.isInteger(age)) return exact;

  const keys = Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b);
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (first === undefined || last === undefined) return undefined;
  if (age <= first) return table[first];
  if (age >= last) return table[last];

  for (let i = 0; i < keys.length - 1; i++) {
    const lo = keys[i];
    const hi = keys[i + 1];
    if (lo === undefined || hi === undefined) continue;
    if (age >= lo && age <= hi) {
      const yLo = table[lo];
      const yHi = table[hi];
      if (yLo === undefined || yHi === undefined) return undefined;
      if (hi === lo) return yLo;
      return yLo + ((yHi - yLo) * (age - lo)) / (hi - lo);
    }
  }
  return undefined;
}

/**
 * Age coefficient straight from the published tables (Foster below 23, McCulloch from
 * 40), linearly interpolated between listed ages. Between 23 and 40 the coefficient is
 * 1.0 by definition. Provided for auditing and for tests; {@link ageFactor} is what the
 * engine uses.
 *
 * @param age years
 * @returns the published coefficient (>= 1.0)
 * @see https://www.usapowerlifting.com/wp-content/uploads/2021/01/USAPL-Age-Coefficients.pdf
 */
export function ageCoefficientFromTable(age: number): number {
  if (!Number.isFinite(age)) return 1.0;
  if (age >= MASTERS_BASELINE_AGE) return lookupTable(MCCULLOCH_COEFFICIENTS, age) ?? 1.0;
  if (age < YOUTH_BASELINE_AGE) return lookupTable(FOSTER_COEFFICIENTS, Math.max(age, MIN_CLASSIFIABLE_AGE)) ?? 1.0;
  return 1.0;
}

/**
 * Age coefficient used by the engine: the quadratic fits to the Foster and McCulloch
 * tables, which are smooth (no jumps on a birthday) and capped at age 80.
 *
 *   masters: C(a) = 1 + 0.0085833·(a−40) + 0.00044167·(a−40)²   for a ≥ 40
 *   youth:   C(a) = 1 − 0.002444·d + 0.003111·d²,  d = 23 − a   for 14 ≤ a < 23
 *
 * Fit accuracy against the published tables: age 66 → 1.5217 vs 1.511; age 80 → 2.050
 * exactly; age 16 → 1.1353 vs 1.13.
 *
 * @param age years; below 14 is treated as 14 and must be gated by {@link isClassifiableAge}
 * @returns the multiplier the reference standard is divided by when age-grading
 * @see https://symmetricstrength.com/about (same two tables, fitted as quadratics)
 * @see https://www.usapowerlifting.com/wp-content/uploads/2021/01/USAPL-Age-Coefficients.pdf
 */
export function ageFactor(age: number): number {
  if (!Number.isFinite(age)) return 1.0;
  if (age >= MASTERS_BASELINE_AGE) {
    const d = Math.min(age, MASTERS_CAP_AGE) - MASTERS_BASELINE_AGE;
    return 1 + 0.0085833 * d + 0.00044167 * d * d;
  }
  if (age < YOUTH_BASELINE_AGE) {
    const d = YOUTH_BASELINE_AGE - Math.max(age, MIN_CLASSIFIABLE_AGE);
    return 1 - 0.002444 * d + 0.003111 * d * d;
  }
  return 1.0;
}

/**
 * The mode to default a user to: age-graded under 23 or over 40, open class in between
 * (where the coefficient is 1.0 and the two modes are identical anyway).
 * @param age years
 * @returns the default {@link AgeMode}
 * @see https://www.usapowerlifting.com/wp-content/uploads/2021/01/USAPL-Age-Coefficients.pdf
 */
export function defaultAgeMode(age: number): AgeMode {
  return age < YOUTH_BASELINE_AGE || age > MASTERS_BASELINE_AGE ? 'age_graded' : 'open';
}

/**
 * Apply age grading to a set of reference thresholds by dividing them by the age
 * coefficient, so a 55-year-old is measured against 55-year-olds rather than against
 * 30-year-olds. In `open` mode the thresholds are returned untouched.
 *
 * @param anchors reference thresholds in kg, in level order
 * @param age years
 * @param mode age-graded or open class
 * @returns thresholds in kg after grading
 * @see https://www.usapowerlifting.com/wp-content/uploads/2021/01/USAPL-Age-Coefficients.pdf
 */
export function applyAgeGrading(anchors: readonly number[], age: number, mode: AgeMode): number[] {
  if (mode === 'open') return [...anchors];
  const c = ageFactor(age);
  return anchors.map((a) => a / c);
}

/**
 * Blend male and female reference thresholds for the "compare me against both" option.
 *
 * APPROXIMATION, disclosed deliberately: the true quantile of a mixture of two
 * distributions is not the weighted mean of their quantiles. Where both thresholds are
 * positive this blends geometrically (a weighted mean in log space), which is the better
 * approximation for right-skewed load distributions; where either is non-positive — the
 * assisted end of pull-ups and dips — it falls back to an arithmetic blend. The single-sex
 * references remain the default and the accurate path; "both" exists so that nonbinary
 * and transgender users are not forced into a binary field.
 *
 * @param maleAnchors male thresholds in kg, in level order
 * @param femaleAnchors female thresholds in kg, in the same order
 * @param maleShare share of the comparison population that is male, 0-1
 * @returns blended thresholds in kg
 * @throws RangeError when the two arrays differ in length
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md (Part 4, sex)
 */
export function blendReferenceAnchors(
  maleAnchors: readonly number[],
  femaleAnchors: readonly number[],
  maleShare: number,
): number[] {
  if (maleAnchors.length !== femaleAnchors.length) {
    throw new RangeError('blendReferenceAnchors: anchor arrays must be the same length');
  }
  const w = Math.max(0, Math.min(1, maleShare));
  return maleAnchors.map((m, i) => {
    const f = femaleAnchors[i];
    if (f === undefined) throw new RangeError('blendReferenceAnchors: missing female anchor');
    if (m > 0 && f > 0) return Math.exp(w * Math.log(m) + (1 - w) * Math.log(f));
    return w * m + (1 - w) * f;
  });
}

/**
 * Share of the comparison population that is male, for each selector option.
 * @param compareAgainst the user's chosen reference population
 * @param appMaleShare male share of the app's own population, used only for "both"
 * @returns the weight given to the male reference distribution, 0-1
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md (Part 4, sex)
 */
export function referenceMaleShare(compareAgainst: CompareAgainst, appMaleShare = 0.75): number {
  if (compareAgainst === 'male') return 1;
  if (compareAgainst === 'female') return 0;
  return Math.max(0, Math.min(1, appMaleShare));
}

/** Copy the UI must be able to surface when it shows an age- or sex-adjusted number. */
export const SEX_POLICY_EXPLANATION =
  'Men and women are compared against separate published reference tables rather than adjusted by a single multiplier, because the difference between them varies by lift, bodyweight and level. You choose which population to be compared against.';

/** Copy the UI must be able to surface when age grading is on. */
export const AGE_POLICY_EXPLANATION =
  'Age grading compares you against lifters your own age by scaling the reference standard with the Foster (under 23) and McCulloch (40+) coefficients published by USA Powerlifting. It is capped at age 80. Open class compares you against everyone, unadjusted.';

/** Plain-English methodology the UI can surface for anything in this module. */
export const AGE_SEX_METHODOLOGY: Readonly<Record<string, MethodologyNote>> = {
  isClassifiableAge: {
    summary: 'Under 14 the app tracks your lifts but does not rank them: no published age coefficients exist.',
    source: 'USA Powerlifting age coefficients (Foster / McCulloch)',
    url: 'https://www.usapowerlifting.com/wp-content/uploads/2021/01/USAPL-Age-Coefficients.pdf',
  },
  ageCoefficientFromTable: {
    summary: 'Looks up the published age coefficient for your age, straight from the federation tables.',
    source: 'USA Powerlifting age coefficients (Foster youth, revised McCulloch masters)',
    url: 'https://www.usapowerlifting.com/wp-content/uploads/2021/01/USAPL-Age-Coefficients.pdf',
  },
  ageFactor: {
    summary:
      'Smooth fit to the published Foster and McCulloch age coefficients, capped at 80 so the oldest lifters are not flattered into a rank they did not earn.',
    source: 'USA Powerlifting age coefficients; quadratic fit as used by Symmetric Strength',
    url: 'https://symmetricstrength.com/about',
  },
  defaultAgeMode: {
    summary: 'Turns age grading on by default under 23 and over 40, where the coefficients actually differ from 1.',
    source: 'USA Powerlifting age coefficients (baseline window 23-40)',
    url: 'https://www.usapowerlifting.com/wp-content/uploads/2021/01/USAPL-Age-Coefficients.pdf',
  },
  applyAgeGrading: {
    summary: AGE_POLICY_EXPLANATION,
    source: 'USA Powerlifting age coefficients (Foster / revised McCulloch)',
    url: 'https://www.usapowerlifting.com/wp-content/uploads/2021/01/USAPL-Age-Coefficients.pdf',
  },
  blendReferenceAnchors: {
    summary:
      'Blends the men\'s and women\'s reference standards when you choose to be compared against both populations. This is an approximation of the combined distribution and is labelled as such.',
    source: 'Stronger 2.0 reference-population selector, research brief Part 4',
    url: 'https://strengthlevel.com/about',
  },
  referenceMaleShare: {
    summary: 'Decides how much weight the men\'s and women\'s reference tables get for your chosen comparison population.',
    source: 'Stronger 2.0 reference-population selector, research brief Part 4',
    url: 'https://strengthlevel.com/about',
  },
};
