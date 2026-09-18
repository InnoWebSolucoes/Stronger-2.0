/**
 * Strength standards: world classification, per-muscle rollup and the rank ladder.
 *
 * Everything in here is a deterministic function of one number — the z-score of a lift
 * against the published per-exercise, per-sex, per-bodyweight distribution. The five
 * named levels every credible provider publishes (Beginner P5, Novice P20, Intermediate
 * P50, Advanced P80, Elite P95) are not buckets; they are five quantiles. Fitting a
 * monotone curve through those five (load, z) anchors turns them back into the
 * continuous distribution they came from, and percentile, points, rank and muscle
 * classification all fall out of it.
 *
 * The layers, in dependency order:
 *
 *   standards-data  Published anchor tables, the muscle contribution matrix, the rank
 *                   ladder and the cold-start priors. Data only.
 *   interpolate     PCHIP interpolation across the bodyweight grid.
 *   age-sex         Foster / McCulloch age grading and reference-population choice.
 *   percentile      z to percentile, with a confidence band.
 *   classify        One lift to a level, percentile, points and next-level load.
 *   rank            Overall score, named rank ladder, points to next rank.
 *   muscle-rollup   Per-exercise performances to per-muscle-group classification.
 *
 * DISCLOSURE. Apple Guideline 1.4.1 rejects health calculations whose method is not
 * published, so every exported function carries a citable source in its doc comment and
 * a plain-English summary in one of the `*_METHODOLOGY` maps re-exported here. The UI
 * must be able to render a "how this is calculated" sheet for any number it shows —
 * {@link STANDARDS_METHODOLOGY} is the single lookup for that.
 *
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md
 * @see https://strengthlevel.com/about
 */

import { AGE_SEX_METHODOLOGY } from './age-sex';
import { CLASSIFY_METHODOLOGY } from './classify';
import { INTERPOLATE_METHODOLOGY } from './interpolate';
import { MUSCLE_ROLLUP_METHODOLOGY } from './muscle-rollup';
import { PERCENTILE_METHODOLOGY } from './percentile';
import { RANK_METHODOLOGY } from './rank';
import type { MethodologyNote } from './standards-data';

export * from './standards-data';
export * from './interpolate';
export * from './age-sex';
export * from './percentile';
export * from './classify';
export * from './rank';
export * from './muscle-rollup';

/**
 * Every disclosable calculation in the standards engine, keyed by function name.
 *
 * This is what backs the in-app "how this is calculated" sheet required by Apple
 * Guideline 1.4.1: one lookup, a plain-English summary, a named source and a URL for
 * every number this module can put on screen.
 *
 * @see https://developer.apple.com/app-store/review/guidelines/#physical-harm
 */
export const STANDARDS_METHODOLOGY: Readonly<Record<string, MethodologyNote>> = {
  ...INTERPOLATE_METHODOLOGY,
  ...AGE_SEX_METHODOLOGY,
  ...PERCENTILE_METHODOLOGY,
  ...CLASSIFY_METHODOLOGY,
  ...RANK_METHODOLOGY,
  ...MUSCLE_ROLLUP_METHODOLOGY,
};

/**
 * Look up the disclosure for one calculation.
 *
 * @param key the exported function's name, e.g. `'classifyLift'`
 * @returns the methodology note, or undefined when nothing is published for that key
 * @see https://developer.apple.com/app-store/review/guidelines/#physical-harm
 */
export function methodologyFor(key: string): MethodologyNote | undefined {
  return STANDARDS_METHODOLOGY[key];
}
