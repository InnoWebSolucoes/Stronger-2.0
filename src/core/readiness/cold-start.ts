/**
 * Stronger 2.0 — muscle readiness engine: cold start and online personalisation.
 *
 * Day-0 contract: a user with no history reads READY everywhere, at LOW
 * confidence, with copy that says the app has nothing to go on yet. The model
 * never invents a precise-looking number it cannot support — a fake 73% on day
 * one destroys trust faster than an honest 100 with "log your first workout".
 *
 * The per-muscle time constants in `constants.ts` are population priors inferred
 * from fibre-type composition and damage-susceptibility research, not measured
 * values, so personalisation ships from day one: `updateCalibration` nudges each
 * muscle's tau from the user's own feedback, shrunk toward the prior with k=6
 * pseudo-observations so a single noisy report cannot swing it.
 *
 * PURE TypeScript, no clock: elapsed time arrives as an argument.
 */

import {
  ALL_MUSCLES,
  CALIBRATION,
  COLD_START_CONFIDENCE,
  COLD_START_PRIORS,
  COLD_START_SESSIONS,
  RBE,
  clamp,
  type Confidence,
  type ExperienceLevel,
  type MuscleId,
} from './constants';
import type { CapacityScore } from './capacity';
import type { AccrualContext } from './fatigue';
import type { MuscleReadiness } from './recovery';

/** What the engine has learned about one user. Persisted and synced. */
export interface UserCalibration {
  /** Per-muscle multiplier on both recovery time constants; 1.0 is the population prior. */
  tauMultiplier: Partial<Record<MuscleId, number>>;
  /** How many feedback observations back each muscle's multiplier. */
  observations: Partial<Record<MuscleId, number>>;
  /** 0..1 per muscle: how adapted the user is, driving the repeated-bout effect. */
  familiarity: Partial<Record<MuscleId, number>>;
  /** Sessions logged so far. Below {@link COLD_START_SESSIONS} the numbers stay honest-vague. */
  sessionsLogged: number;
  /** The experience level the user declared at onboarding, kept for copy and diagnostics. */
  experience: ExperienceLevel;
}

/**
 * Day-0 calibration from the user's declared experience level.
 *
 * Untrained lifters take dramatically more damage from the same relative work
 * and stay sore longer (Damas 2015, PMID 25739559: early-training MPS is
 * dominated by damage repair), so a beginner starts with low familiarity and a
 * lengthened tau — 1.30x for "never trained", 0.94x for advanced. The repeated
 * bout effect saturates in already-trained lifters (PMC2783719), which is why
 * the advanced prior sits just below 1.0 rather than far below it.
 */
export function coldStart(experience: ExperienceLevel): UserCalibration {
  const prior = COLD_START_PRIORS[experience];
  const calibration: UserCalibration = {
    tauMultiplier: {},
    observations: {},
    familiarity: {},
    sessionsLogged: 0,
    experience,
  };
  for (const muscle of ALL_MUSCLES) {
    calibration.tauMultiplier[muscle] = prior.tauMultiplier;
    calibration.observations[muscle] = 0;
    calibration.familiarity[muscle] = prior.familiarity;
  }
  return calibration;
}

/** True while there is not yet enough history for the readiness numbers to mean anything. */
export function isColdStart(calibration: UserCalibration): boolean {
  return calibration.sessionsLogged < COLD_START_SESSIONS;
}

/**
 * The accrual context implied by a calibration: familiarity and per-muscle tau
 * multipliers, ready to merge with the caller's e1RM and movement history.
 */
export function coldStartAccrualContext(calibration: UserCalibration): AccrualContext {
  return {
    familiarity: { ...calibration.familiarity },
    tauMultiplier: { ...calibration.tauMultiplier },
  };
}

/** Readiness chips for a user with no training history, plus the honesty copy. */
export interface ColdStartReadiness {
  readiness: MuscleReadiness[];
  confidence: Confidence;
  confidenceValue: number;
  /** One line the UI must show alongside the chips. */
  note: string;
}

/**
 * Readiness for a user with no history: every muscle reads 100% and `ready`,
 * with `lastTrainedAt` null and zero fatigue in both compartments, at LOW
 * confidence.
 *
 * This is the truthful answer — nothing has been logged, so nothing is fatigued
 * — but it is explicitly labelled as such rather than presented as a
 * measurement.
 */
export function coldStartReadiness(): ColdStartReadiness {
  return {
    readiness: ALL_MUSCLES.map((muscle) => ({
      muscle,
      pct: 100,
      structural: 0,
      metabolic: 0,
      status: 'ready' as const,
      hoursToReady: 0,
      lastTrainedAt: null,
    })),
    confidence: 'low',
    confidenceValue: COLD_START_CONFIDENCE,
    note: 'No training logged yet — these start full and become real once you log a session.',
  };
}

/**
 * The day-0 capacity card, or `null` once enough sessions exist for the real
 * {@link capacityScore} to take over.
 *
 * Returns 100 at LOW confidence (0.25) with every driver disconnected, because
 * with no training logged the base score's three components are all 1.0 — the
 * same reason a fully rested experienced user legitimately sees 100/100 while
 * sleep and resting HR read "Not connected".
 */
export function coldStartCapacity(calibration: UserCalibration): CapacityScore | null {
  if (!isColdStart(calibration)) return null;
  return {
    score: 100,
    confidence: 'low',
    confidenceValue: COLD_START_CONFIDENCE,
    headline: 'Ready when you are',
    subline: calibration.sessionsLogged === 0
      ? 'Log your first workout to start tracking recovery'
      : 'One more session and readiness goes live',
    drivers: [
      { label: 'HRV', delta: 0, connected: false },
      { label: 'Resting HR', delta: 0, connected: false },
      { label: 'Sleep', delta: 0, connected: false },
      { label: 'Check-in', delta: 0, connected: false },
    ],
    components: { systemic: 1, muscular: 1, ramp: 1 },
    modifiers: { hrv: 1, rhr: 1, sleep: 1, subjective: 1 },
    hasWearableInput: false,
    baseScore: 100,
  };
}

/** Record that a session was logged. Returns a new calibration; does not mutate. */
export function recordSession(calibration: UserCalibration): UserCalibration {
  return { ...calibration, sessionsLogged: calibration.sessionsLogged + 1 };
}

/**
 * Update one muscle's tau multiplier from a feedback residual.
 *
 * Two feedback channels feed the residual: the soreness check-in at a known lag,
 * and performance-on-repeat (reps achieved at the same load versus the model's
 * prediction). A residual above 0 means the user was MORE fatigued than
 * predicted, so tau lengthens.
 *
 * The step is exp(0.10 * residual) with residual clamped to [-1, 1], then shrunk
 * toward the population prior with k = 6 pseudo-observations and clamped to
 * [0.6, 1.6]. Shrinkage is what stops one bad night from rewriting a muscle's
 * recovery curve.
 *
 * @param residual -1 (recovered faster than predicted) .. +1 (much more fatigued)
 */
export function updateCalibration(
  calibration: UserCalibration,
  muscle: MuscleId,
  residual: number,
): UserCalibration {
  const observations = (calibration.observations[muscle] ?? 0) + 1;
  const step = Math.exp(CALIBRATION.stepPerResidual * clamp(residual, -1, 1));
  const raw = (calibration.tauMultiplier[muscle] ?? CALIBRATION.priorTauMultiplier) * step;
  const k = CALIBRATION.shrinkagePseudoObservations;
  const shrunk = (observations * raw + k * CALIBRATION.priorTauMultiplier) / (observations + k);
  return {
    ...calibration,
    tauMultiplier: {
      ...calibration.tauMultiplier,
      [muscle]: clamp(shrunk, CALIBRATION.minTauMultiplier, CALIBRATION.maxTauMultiplier),
    },
    observations: { ...calibration.observations, [muscle]: observations },
  };
}

/**
 * New familiarity for a muscle after one more exposure, 0..1.
 *
 * Familiarity decays with layoff (the repeated-bout effect detrains; Nosaka &
 * Clarkson put protection at up to ~24 weeks, modelled here as a 120-day decay
 * constant) and then closes ~12% of the remaining gap to 1.0 per exposure.
 *
 * @param daysSinceLast days since this muscle was last trained; 0 for back-to-back sessions
 */
export function updateFamiliarity(
  calibration: UserCalibration,
  muscle: MuscleId,
  daysSinceLast: number,
): number {
  const decay = Math.exp(-Math.max(0, daysSinceLast) / CALIBRATION.familiarityDecayDays);
  const current = (calibration.familiarity[muscle] ?? RBE.defaultFamiliarity) * decay;
  return clamp(current + (1 - current) * CALIBRATION.familiarityGainPerExposure, 0, 1);
}

/** Apply {@link updateFamiliarity} and return a new calibration; does not mutate. */
export function withUpdatedFamiliarity(
  calibration: UserCalibration,
  muscle: MuscleId,
  daysSinceLast: number,
): UserCalibration {
  return {
    ...calibration,
    familiarity: {
      ...calibration.familiarity,
      [muscle]: updateFamiliarity(calibration, muscle, daysSinceLast),
    },
  };
}
