/**
 * Per-muscle-group classification: rolling per-exercise performances up into a
 * defensible statement about one muscle.
 *
 * THE PROBLEM. "Your triceps are Advanced" cannot be read off any single lift. Triceps
 * cap a close-grip bench far more than a wide-grip one, a pushdown almost entirely, and
 * a squat not at all. Averaging the levels of every exercise that "hits triceps" is
 * wrong twice over: it counts a 3% contribution the same as an 88% one, and it invents a
 * number for muscles the user has never loaded.
 *
 * THE MODEL. A latent per-muscle strength model, exactly as specified in the research
 * brief (Part 5, section 9):
 *
 *     z_e  =  sum_m W[e][m] * theta_m  +  eps_e,     eps_e ~ N(0, tau_e^2)
 *     theta_m = global + delta_m,                    delta_m ~ N(0, sigma_b^2)
 *     global ~ N(mu0, sigma0^2)
 *
 * W is the contribution matrix in `standards-data.ts` — how much each exercise's LOAD
 * CEILING is determined by each muscle, rows summing to 1.0. Because the rows sum to 1,
 * the `global` column loads fully on every observation, which is what lets an unmeasured
 * muscle fall back to the lifter's overall level rather than to a fabricated
 * "Intermediate". Solved in closed form by Cholesky, so it runs in microseconds on a
 * phone with no iteration and no randomness.
 *
 * WHAT THIS BUYS. Three things a weighted average cannot do: overlapping contributions
 * are disentangled (bench and pushdown jointly identify triceps separately from chest),
 * uncertainty is propagated (every muscle carries a posterior SD, so the UI can refuse
 * to label one), and evidence is pooled (four mediocre triceps exercises are worth more
 * than one).
 *
 * RECENCY. A stale observation is down-weighted, never re-valued. Its z is exactly the
 * number the lifter hit; what decays is how much that number constrains the estimate
 * today, via {@link effectiveTau}. A muscle whose only evidence is a year old therefore
 * drifts back toward the lifter's overall level with a wide band and usually reports
 * insufficient data — it is never demoted. This is evidence weighting, not decay; the
 * overall rank in `rank.ts` is explicitly exempt (see `RANK_DECAY_POLICY`).
 *
 * NEVER GUESS. A muscle with no exercise that meaningfully limits it reports
 * `insufficient_data` and carries no label at all. The posterior still exists — it is
 * the global term — but it is not a measurement and the UI must not dress it up as one.
 *
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md (Part 5, section 9)
 * @see https://symmetricstrength.com/about
 * @see https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7579505/
 */

import { stalenessSd, type LiftClassification } from './classify';
import { percentileWithConfidence, type PercentileEstimate } from './percentile';
import { rankFromScore, scoreFromZ, type RankPosition } from './rank';
import {
  EXPERIENCE_PRIOR,
  LABEL_SD_THRESHOLD,
  MUSCLES,
  MUSCLE_CONTRIBUTIONS,
  STANDARDS,
  UNKNOWN_EXPERIENCE_PRIOR,
  type ContributionRow,
  type Experience,
  type MethodologyNote,
  type MuscleGroup,
} from './standards-data';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * sigma_b — how far one muscle may plausibly deviate from the lifter's own overall
 * level, in z units. 0.55 z is roughly two-thirds of a named band: big enough that
 * genuinely lagging calves show up, small enough that one flukey set cannot make a
 * muscle Elite while everything around it is Novice.
 */
export const SIGMA_BETWEEN_MUSCLES = 0.55;

/**
 * Minimum share of an exercise's load ceiling a muscle must own for that exercise to
 * count as DIRECT evidence for it. Below this the exercise still informs the solve, but
 * it cannot on its own license a label: 2% of a bench press is not a triceps test.
 */
export const MIN_DIRECT_CONTRIBUTION = 0.15;

/**
 * Minimum total contribution mass, summed over the lifter's logged exercises, before a
 * muscle may be labelled. 0.3 is "about a third of one exercise is genuinely about this
 * muscle" — the chest gets 0.46 from a single bench press and clears it; the calves get
 * 0.04 from a leg press and do not.
 */
export const MIN_EVIDENCE_MASS = 0.3;

/** How many contributing exercises {@link MuscleScore.topSources} names. */
export const MAX_NAMED_SOURCES = 3;

/** Display names for the 17 muscle groups, used in the generated explanation strings. */
export const MUSCLE_DISPLAY_NAMES: Readonly<Record<MuscleGroup, string>> = {
  chest: 'Chest',
  frontDelt: 'Front delts',
  sideDelt: 'Side delts',
  rearDelt: 'Rear delts',
  triceps: 'Triceps',
  biceps: 'Biceps',
  forearms: 'Forearms',
  lats: 'Lats',
  upperBack: 'Upper back',
  traps: 'Traps',
  lowerBack: 'Lower back',
  abs: 'Abs',
  glutes: 'Glutes',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  adductors: 'Adductors',
  calves: 'Calves',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One classified lift, as evidence about the muscles that limit it. */
export interface MuscleObservation {
  /** Exercise slug — must be a key of `MUSCLE_CONTRIBUTIONS` or it is ignored. */
  readonly exerciseId: string;
  /** The lift's z-score against the reference population. */
  readonly z: number;
  /** Measurement noise of that z as a probe of strength, in z units. */
  readonly tau: number;
  /** Days since the lift. Down-weights the observation; never changes its z. */
  readonly ageDays?: number;
}

/** Why a muscle's verdict is what it is. */
export type MuscleState = 'ranked' | 'calibrating' | 'insufficient_data';

/** One exercise's share of the evidence behind a muscle score. */
export interface MuscleSource {
  readonly exerciseId: string;
  readonly name: string;
  /** This exercise's contribution weight for the muscle, 0-1. */
  readonly contribution: number;
  /** Its share of the total evidence for this muscle, 0-1, after recency weighting. */
  readonly share: number;
}

/** A muscle group's verdict. */
export interface MuscleScore {
  readonly muscle: MuscleGroup;
  readonly displayName: string;
  /** Posterior mean strength of this muscle, in z units. */
  readonly z: number;
  /** Posterior SD, in z units. */
  readonly sdZ: number;
  /** Rank points for this muscle. */
  readonly score: number;
  /** Rank position, or null when there is not enough data to name one. */
  readonly rank: RankPosition | null;
  /** Full label, e.g. "Advanced I", or null when unlabelled. */
  readonly label: string | null;
  /** Percentile with its confidence band. */
  readonly percentile: PercentileEstimate;
  readonly state: MuscleState;
  /** Rank labels one posterior SD either side — the honest range. */
  readonly rangeLabels: readonly [string, string];
  /** Summed contribution weight of every logged exercise that loads this muscle. */
  readonly evidenceMass: number;
  /** Exercises owning at least {@link MIN_DIRECT_CONTRIBUTION} of their load ceiling here. */
  readonly directExercises: readonly string[];
  /** Biggest evidence sources, strongest first. */
  readonly topSources: readonly MuscleSource[];
  /** Days since the freshest lift that loads this muscle, or null if never. */
  readonly freshestAgeDays: number | null;
  /** The exercise that would add the most evidence, when data is insufficient. */
  readonly suggestedExerciseId: string | null;
  /** Plain-English sentence the UI can surface verbatim. */
  readonly explanation: string;
}

/** Options for {@link solveMuscleScores}. */
export interface MuscleSolveOptions {
  /** Muscles to solve for. Defaults to all 17. */
  readonly muscles?: readonly MuscleGroup[];
  /** sigma_b, between-muscle SD. Defaults to {@link SIGMA_BETWEEN_MUSCLES}. */
  readonly sigmaB?: number;
  /** sigma0, prior width on the lifter's overall level. */
  readonly sigma0?: number;
  /** mu0, prior mean for the overall level. */
  readonly mu0?: number;
}

/** Raw posterior from the ridge solve. */
export interface MuscleSolveResult {
  /** Posterior mean of the lifter's overall level, in z units. */
  readonly global: number;
  readonly globalSd: number;
  /** Posterior mean per muscle, in z units. */
  readonly theta: Readonly<Record<MuscleGroup, number>>;
  /** Posterior SD per muscle, in z units. */
  readonly thetaSd: Readonly<Record<MuscleGroup, number>>;
}

/** Input to {@link rollupMuscles}. */
export interface MuscleRollupInput {
  readonly observations: readonly MuscleObservation[];
  /** Self-declared training history, used as the cold-start prior on the global term. */
  readonly experience?: Experience;
  /** Muscles to report on. Defaults to all 17. */
  readonly muscles?: readonly MuscleGroup[];
}

/** The whole body map. */
export interface MuscleRollup {
  readonly muscles: readonly MuscleScore[];
  /** Posterior mean overall level from the muscle model, in z units. */
  readonly global: number;
  readonly globalSd: number;
  /** Muscles that cleared the evidence bar and carry a label. */
  readonly ranked: readonly MuscleGroup[];
  /** Muscles with evidence but too wide a band to name. */
  readonly calibrating: readonly MuscleGroup[];
  /** Muscles with no usable evidence. Never guessed at. */
  readonly insufficient: readonly MuscleGroup[];
  /** Strongest ranked muscle, or null. */
  readonly strongest: MuscleGroup | null;
  /**
   * Weakest ranked muscle, or null. Framed as an opportunity, never as a failing
   * grade — see the research brief's UX warning about telling someone their quads are
   * "Beginner".
   */
  readonly biggestOpportunity: MuscleGroup | null;
  /** Plain-English summary the UI can surface verbatim. */
  readonly explanation: string;
}

// ---------------------------------------------------------------------------
// Bounds-checked linear algebra (noUncheckedIndexedAccess: no `!`, no `any`)
// ---------------------------------------------------------------------------

function vGet(v: readonly number[], i: number): number {
  const x = v[i];
  if (x === undefined) throw new RangeError(`vector index ${i} out of range (length ${v.length})`);
  return x;
}

function vSet(v: number[], i: number, x: number): void {
  if (i < 0 || i >= v.length) throw new RangeError(`vector index ${i} out of range (length ${v.length})`);
  v[i] = x;
}

function mGet(m: readonly (readonly number[])[], i: number, j: number): number {
  const row = m[i];
  if (row === undefined) throw new RangeError(`matrix row ${i} out of range (rows ${m.length})`);
  const x = row[j];
  if (x === undefined) throw new RangeError(`matrix col ${j} out of range (cols ${row.length})`);
  return x;
}

function mSet(m: number[][], i: number, j: number, x: number): void {
  const row = m[i];
  if (row === undefined) throw new RangeError(`matrix row ${i} out of range (rows ${m.length})`);
  if (j < 0 || j >= row.length) throw new RangeError(`matrix col ${j} out of range (cols ${row.length})`);
  row[j] = x;
}

function mAdd(m: number[][], i: number, j: number, x: number): void {
  mSet(m, i, j, mGet(m, i, j) + x);
}

function zeros(n: number): number[] {
  return new Array<number>(n).fill(0);
}

function zeroMatrix(n: number): number[][] {
  return Array.from({ length: n }, () => zeros(n));
}

/** Cholesky factor L of a symmetric positive-definite A, so that A = L*L^T. */
function cholesky(a: readonly (readonly number[])[]): number[][] {
  const n = a.length;
  const l = zeroMatrix(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = mGet(a, i, j);
      for (let k = 0; k < j; k++) s -= mGet(l, i, k) * mGet(l, j, k);
      mSet(l, i, j, i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / mGet(l, j, j));
    }
  }
  return l;
}

/** Solve A*x = b given the Cholesky factor L of A. */
function cholSolve(l: readonly (readonly number[])[], b: readonly number[]): number[] {
  const n = l.length;
  const y = zeros(n);
  const x = zeros(n);
  for (let i = 0; i < n; i++) {
    let s = vGet(b, i);
    for (let k = 0; k < i; k++) s -= mGet(l, i, k) * vGet(y, k);
    vSet(y, i, s / mGet(l, i, i));
  }
  for (let i = n - 1; i >= 0; i--) {
    let s = vGet(y, i);
    for (let k = i + 1; k < n; k++) s -= mGet(l, k, i) * vGet(x, k);
    vSet(x, i, s / mGet(l, i, i));
  }
  return x;
}

/** A inverse — the posterior covariance — from the Cholesky factor of A. */
function cholInverse(l: readonly (readonly number[])[]): number[][] {
  const n = l.length;
  const inv = zeroMatrix(n);
  for (let c = 0; c < n; c++) {
    const e = zeros(n);
    vSet(e, c, 1);
    const col = cholSolve(l, e);
    for (let r = 0; r < n; r++) mSet(inv, r, c, vGet(col, r));
  }
  return inv;
}

// ---------------------------------------------------------------------------
// Evidence helpers
// ---------------------------------------------------------------------------

/**
 * The contribution row for an exercise: how much of its load ceiling each muscle owns.
 *
 * @param exerciseId exercise slug
 * @returns the row, or undefined when the exercise is not in the contribution matrix
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md (Part 2)
 */
export function contributionsFor(exerciseId: string): ContributionRow | undefined {
  return MUSCLE_CONTRIBUTIONS[exerciseId];
}

/**
 * Effective measurement noise of an observation once its age is taken into account:
 * sqrt(tau^2 + stale(ageDays)^2), using the same staleness curve as the classification
 * and confidence code so "stale" means one thing across the whole module.
 *
 * This is the ONLY place recency enters the rollup. It down-weights an old lift's
 * influence on the estimate; it never alters the z the lifter actually earned, and it
 * never subtracts points. A muscle whose evidence has aged out drifts back toward the
 * lifter's overall level with a wide band, which the UI reports as "needs a fresh lift",
 * not as a demotion.
 *
 * @param tau measurement noise of the lift, in z units
 * @param ageDays days since the lift was performed
 * @returns the noise to use in the solve, in z units
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md (Part 5, section 13)
 */
export function effectiveTau(tau: number, ageDays = 0): number {
  const base = Math.max(tau, 0.05);
  const stale = stalenessSd(ageDays);
  return Math.sqrt(base * base + stale * stale);
}

/**
 * Turn a classified lift into a muscle observation, so callers do not have to rebuild
 * the triple by hand and cannot accidentally pair one lift's z with another's tau.
 *
 * @param classification the result of `classifyLift`
 * @param ageDays days since the lift, if known
 * @returns the observation to feed {@link rollupMuscles}
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md (Part 5, section 9)
 */
export function muscleObservationFromLift(classification: LiftClassification, ageDays = 0): MuscleObservation {
  return { exerciseId: classification.exerciseId, z: classification.z, tau: classification.tau, ageDays };
}

/**
 * The exercise in the catalog that most directly loads a muscle — what to suggest when
 * a muscle has no evidence.
 *
 * @param muscle the muscle group
 * @returns the exercise slug with the highest contribution weight, or null
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md (Part 2)
 */
export function bestProbeFor(muscle: MuscleGroup): string | null {
  let bestId: string | null = null;
  let bestW = 0;
  for (const [id, row] of Object.entries(MUSCLE_CONTRIBUTIONS)) {
    const w = row[muscle] ?? 0;
    if (w > bestW) {
      bestW = w;
      bestId = id;
    }
  }
  return bestId;
}

function exerciseName(exerciseId: string): string {
  return STANDARDS[exerciseId]?.name ?? exerciseId;
}

// ---------------------------------------------------------------------------
// The solve
// ---------------------------------------------------------------------------

/**
 * Solve the latent per-muscle strength model in closed form.
 *
 * Parameters are [global, delta_1 ... delta_M]. Each observation contributes a row with
 * a 1 in the global column (legitimate because every contribution row sums to 1.0) and
 * its contribution weights in the muscle columns, weighted by precision 1/tau_eff^2. The
 * priors add 1/sigma0^2 to the global diagonal and 1/sigma_b^2 to every muscle diagonal,
 * which is what makes the system solvable with far fewer observations than muscles — an
 * under-determined problem that ordinary least squares cannot touch.
 *
 * Returns posterior means AND SDs. The SD is the product: it is what lets a muscle
 * refuse to be labelled.
 *
 * @param observations classified lifts as evidence
 * @param options muscle list and prior widths
 * @returns posterior mean and SD for the global term and every muscle
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md (Part 5, section 9)
 */
export function solveMuscleScores(
  observations: readonly MuscleObservation[],
  options: MuscleSolveOptions = {},
): MuscleSolveResult {
  const muscles = options.muscles ?? MUSCLES;
  const sigmaB = options.sigmaB ?? SIGMA_BETWEEN_MUSCLES;
  const sigma0 = options.sigma0 ?? UNKNOWN_EXPERIENCE_PRIOR.sigma;
  const mu0 = options.mu0 ?? UNKNOWN_EXPERIENCE_PRIOR.mu;

  const p = muscles.length + 1;
  const index = new Map<MuscleGroup, number>();
  muscles.forEach((muscle, i) => index.set(muscle, i + 1));

  const a = zeroMatrix(p);
  const b = zeros(p);

  // Priors.
  mAdd(a, 0, 0, 1 / (sigma0 * sigma0));
  vSet(b, 0, vGet(b, 0) + mu0 / (sigma0 * sigma0));
  for (let i = 1; i < p; i++) mAdd(a, i, i, 1 / (sigmaB * sigmaB));

  // Observations.
  for (const ob of observations) {
    const row = MUSCLE_CONTRIBUTIONS[ob.exerciseId];
    if (row === undefined) continue;
    if (!Number.isFinite(ob.z)) continue;
    const tau = effectiveTau(ob.tau, ob.ageDays ?? 0);
    const precision = 1 / (tau * tau);

    const x = zeros(p);
    vSet(x, 0, 1);
    for (const muscle of muscles) {
      const w = row[muscle];
      if (w === undefined) continue;
      const j = index.get(muscle);
      if (j === undefined) continue;
      vSet(x, j, vGet(x, j) + w);
    }

    for (let i = 0; i < p; i++) {
      const xi = vGet(x, i);
      if (xi === 0) continue;
      vSet(b, i, vGet(b, i) + precision * xi * ob.z);
      for (let j = 0; j < p; j++) {
        const xj = vGet(x, j);
        if (xj === 0) continue;
        mAdd(a, i, j, precision * xi * xj);
      }
    }
  }

  const l = cholesky(a);
  const mean = cholSolve(l, b);
  const cov = cholInverse(l);

  const theta = {} as Record<MuscleGroup, number>;
  const thetaSd = {} as Record<MuscleGroup, number>;
  const globalMean = vGet(mean, 0);
  muscles.forEach((muscle, k) => {
    const j = k + 1;
    theta[muscle] = globalMean + vGet(mean, j);
    thetaSd[muscle] = Math.sqrt(Math.max(mGet(cov, 0, 0) + mGet(cov, j, j) + 2 * mGet(cov, 0, j), 1e-9));
  });

  return {
    global: globalMean,
    globalSd: Math.sqrt(Math.max(mGet(cov, 0, 0), 1e-9)),
    theta,
    thetaSd,
  };
}

// ---------------------------------------------------------------------------
// Verdicts
// ---------------------------------------------------------------------------

/** Evidence tally for one muscle, as counted by {@link rollupMuscles}. */
export interface MuscleEvidence {
  /** Summed contribution weight over every logged exercise that loads this muscle. */
  readonly mass: number;
  /** Exercises owning at least {@link MIN_DIRECT_CONTRIBUTION} of their load ceiling here. */
  readonly directExercises: readonly string[];
  /** Biggest evidence sources, strongest first. */
  readonly topSources: readonly MuscleSource[];
  /** Days since the freshest lift that loads this muscle, or null if never. */
  readonly freshestAgeDays: number | null;
}

/**
 * Decide what may be said about a muscle given its posterior and its evidence.
 *
 * Three outcomes, in order of strictness. No direct exercise or too little contribution
 * mass → `insufficient_data`, no label at all, because the posterior in that case is
 * just the lifter's overall level wearing a muscle's name. Enough evidence but a
 * posterior SD wider than one sub-tier ({@link LABEL_SD_THRESHOLD}) → `calibrating`,
 * shown as a range. Otherwise → `ranked`.
 *
 * @param z posterior mean for the muscle, in z units
 * @param sdZ posterior SD, in z units
 * @param evidence the muscle's evidence tally
 * @returns the state the UI must render
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md (Part 5, section 9)
 */
export function muscleState(z: number, sdZ: number, evidence: MuscleEvidence): MuscleState {
  if (!Number.isFinite(z) || !Number.isFinite(sdZ)) return 'insufficient_data';
  if (evidence.directExercises.length === 0 || evidence.mass < MIN_EVIDENCE_MASS) return 'insufficient_data';
  return sdZ <= LABEL_SD_THRESHOLD ? 'ranked' : 'calibrating';
}

function buildExplanation(
  muscle: MuscleGroup,
  state: MuscleState,
  rank: RankPosition,
  range: readonly [string, string],
  evidence: MuscleEvidence,
  suggested: string | null,
): string {
  const name = MUSCLE_DISPLAY_NAMES[muscle];
  if (state === 'insufficient_data') {
    const probe = suggested === null ? null : exerciseName(suggested);
    return probe === null
      ? `${name} — not enough data yet. Nothing you have logged is limited by this muscle, so there is nothing honest to report.`
      : `${name} — not enough data yet. Nothing you have logged is limited enough by this muscle to judge it. Log a set of ${probe} to unlock it.`;
  }
  const lead = evidence.topSources[0];
  const count = evidence.directExercises.length;
  const from =
    lead === undefined
      ? 'your logged lifts'
      : `${count} exercise${count === 1 ? '' : 's'} that load it, mainly ${lead.name}`;
  if (state === 'calibrating') {
    return `${name} — somewhere between ${range[0]} and ${range[1]}. Estimated from ${from}, weighted by how much each one is actually limited by this muscle. Log more and this narrows to a single rank.`;
  }
  const age = evidence.freshestAgeDays;
  const stale =
    age !== null && age > 56 ? ` Your freshest lift for it is ${Math.round(age)} days old, so it is worth re-testing.` : '';
  return `${name} — ${rank.label}, ${rank.score} pts. Estimated from ${from}, weighted by how much each one is actually limited by this muscle.${stale}`;
}

/**
 * Roll every logged performance up into a per-muscle-group classification.
 *
 * Contribution-weighted, uncertainty-propagating, and honest about ignorance: muscles
 * with sparse or no data report `insufficient_data` and carry no label. Recent lifts
 * outweigh stale ones through {@link effectiveTau}, which widens an old lift's error bar
 * rather than discounting the number it earned.
 *
 * @param input the observations, the cold-start experience prior and the muscles wanted
 * @returns every muscle's verdict plus the body-map summary and UI copy
 * @see docs/research/stronger-2-0-strength-standards-per-muscle-world-c.md (Part 5, section 9)
 * @see https://symmetricstrength.com/about
 */
export function rollupMuscles(input: MuscleRollupInput): MuscleRollup {
  const muscles = input.muscles ?? MUSCLES;
  const prior = input.experience === undefined ? UNKNOWN_EXPERIENCE_PRIOR : EXPERIENCE_PRIOR[input.experience];

  const usable = input.observations.filter(
    (ob) => MUSCLE_CONTRIBUTIONS[ob.exerciseId] !== undefined && Number.isFinite(ob.z),
  );

  const solved = solveMuscleScores(usable, { muscles, mu0: prior.mu, sigma0: prior.sigma });

  const scores: MuscleScore[] = muscles.map((muscle) => {
    let mass = 0;
    let weightTotal = 0;
    let freshest: number | null = null;
    const direct: string[] = [];
    const sources: { exerciseId: string; contribution: number; weight: number }[] = [];

    for (const ob of usable) {
      const row = MUSCLE_CONTRIBUTIONS[ob.exerciseId];
      if (row === undefined) continue;
      const w = row[muscle];
      if (w === undefined || w <= 0) continue;
      const tau = effectiveTau(ob.tau, ob.ageDays ?? 0);
      const weight = (w * w) / (tau * tau);
      mass += w;
      weightTotal += weight;
      sources.push({ exerciseId: ob.exerciseId, contribution: w, weight });
      if (w >= MIN_DIRECT_CONTRIBUTION && !direct.includes(ob.exerciseId)) direct.push(ob.exerciseId);
      const age = ob.ageDays ?? 0;
      if (freshest === null || age < freshest) freshest = age;
    }

    const topSources: MuscleSource[] = sources
      .sort((x, y) => y.weight - x.weight)
      .slice(0, MAX_NAMED_SOURCES)
      .map((s) => ({
        exerciseId: s.exerciseId,
        name: exerciseName(s.exerciseId),
        contribution: s.contribution,
        share: weightTotal > 0 ? s.weight / weightTotal : 0,
      }));

    const evidence: MuscleEvidence = { mass, directExercises: direct, topSources, freshestAgeDays: freshest };

    const z = solved.theta[muscle];
    const sdZ = solved.thetaSd[muscle];
    const state = muscleState(z, sdZ, evidence);
    const score = scoreFromZ(z);
    const rank = rankFromScore(score);
    const range: readonly [string, string] = [
      rankFromScore(scoreFromZ(z - sdZ)).label,
      rankFromScore(scoreFromZ(z + sdZ)).label,
    ];
    const suggested = state === 'insufficient_data' ? bestProbeFor(muscle) : null;

    return {
      muscle,
      displayName: MUSCLE_DISPLAY_NAMES[muscle],
      z,
      sdZ,
      score,
      rank: state === 'ranked' ? rank : null,
      label: state === 'ranked' ? rank.label : null,
      percentile: percentileWithConfidence(z, sdZ),
      state,
      rangeLabels: range,
      evidenceMass: mass,
      directExercises: direct,
      topSources,
      freshestAgeDays: freshest,
      suggestedExerciseId: suggested,
      explanation: buildExplanation(muscle, state, rank, range, evidence, suggested),
    };
  });

  const ranked = scores.filter((s) => s.state === 'ranked');
  const calibrating = scores.filter((s) => s.state === 'calibrating').map((s) => s.muscle);
  const insufficient = scores.filter((s) => s.state === 'insufficient_data').map((s) => s.muscle);

  let strongest: MuscleScore | undefined;
  let weakest: MuscleScore | undefined;
  for (const s of ranked) {
    if (strongest === undefined || s.z > strongest.z) strongest = s;
    if (weakest === undefined || s.z < weakest.z) weakest = s;
  }
  const opportunity = weakest === undefined || strongest === undefined || weakest.muscle === strongest.muscle ? null : weakest;

  const explanation =
    ranked.length === 0
      ? `No muscle group has enough data to classify yet. Muscle ranks come from the lifts you log, weighted by how much each lift is actually limited by that muscle — ${insufficient.length} of ${muscles.length} groups are still waiting on a first qualifying set.`
      : `${ranked.length} of ${muscles.length} muscle groups classified.${
          strongest === undefined ? '' : ` Strongest: ${strongest.displayName} (${strongest.label ?? ''}).`
        }${opportunity === null ? '' : ` Biggest opportunity: ${opportunity.displayName} (${opportunity.label ?? ''}).`}${
          insufficient.length === 0
            ? ''
            : ` ${insufficient.length} still need a qualifying lift before they can be judged.`
        }`;

  return {
    muscles: scores,
    global: solved.global,
    globalSd: solved.globalSd,
    ranked: ranked.map((s) => s.muscle),
    calibrating,
    insufficient,
    strongest: strongest?.muscle ?? null,
    biggestOpportunity: opportunity?.muscle ?? null,
    explanation,
  };
}

/** Plain-English methodology the UI can surface for anything in this module. */
export const MUSCLE_ROLLUP_METHODOLOGY: Readonly<Record<string, MethodologyNote>> = {
  solveMuscleScores: {
    summary:
      'Works out how strong each muscle is from the lifts you actually log. Each exercise is split across the muscles that limit it — a pushdown is 88% triceps, a bench press only 28% — and the maths solves every muscle at once instead of averaging levels. It also reports how sure it is, which is what lets the app stay quiet about muscles you have not trained.',
    source: 'Hierarchical Bayesian ridge over the EMG-informed contribution matrix, research brief Part 5 section 9',
    url: 'https://symmetricstrength.com/about',
  },
  rollupMuscles: {
    summary:
      'Turns your logged lifts into a rank per muscle group. Muscles with too little evidence are reported as "not enough data" rather than guessed at, and recent lifts count for more than old ones.',
    source: 'Stronger 2.0 muscle rollup; contribution weights from EMG %MVC literature (research brief Part 2)',
    url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7579505/',
  },
  effectiveTau: {
    summary:
      'Lets a recent lift count for more than a stale one by widening the old lift’s error bar. It never lowers the number you hit — an old personal best still counts, the app is just less certain it is still current.',
    source: 'Stronger 2.0 staleness curve (8-week fresh window), research brief Part 5 section 13',
    url: 'https://strengthlevel.com/about',
  },
  muscleState: {
    summary:
      'Decides whether a muscle can be given a rank, shown as a range, or left unjudged. A muscle needs at least one exercise that genuinely limits it before the app will name a level.',
    source: 'Stronger 2.0 labelling rule (posterior SD under 0.35 z, about one sub-tier)',
    url: 'https://symmetricstrength.com/about',
  },
  bestProbeFor: {
    summary: 'Suggests the single exercise that would tell the app the most about an untested muscle.',
    source: 'Stronger 2.0 contribution matrix, research brief Part 2',
    url: 'https://www.jefit.com/blog/best-exercises-for-each-major-muscle-group-backed-emg-data',
  },
  contributionsFor: {
    summary:
      'Shows how an exercise splits across the muscles that cap it — these are limiting contributions, not raw activation.',
    source: 'EMG %MVC literature as prior; refit planned from app cross-exercise data',
    url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7579505/',
  },
};
