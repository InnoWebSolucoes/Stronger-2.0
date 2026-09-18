/**
 * Stronger 2.0 — muscle readiness engine: the 0-100 daily capacity score.
 *
 * Base score (research doc section 8), computed from the TRAINING LOG ALONE:
 *
 *   base = 100 * (0.50*systemic + 0.35*volumeWeightedMuscular + 0.15*uncoupledAcwrRamp)
 *
 * With no recent training all three terms are 1.0, so 100/100 while sleep and
 * resting HR read "Not connected" is the correct answer, not a placeholder. That
 * no-wearable path is the PRIMARY path. Wearables enter only as bounded
 * multiplicative modifiers, and the returned score always carries an explicit
 * confidence level (0.45 from the log alone) rather than pretending to a
 * precision it does not have.
 *
 * PURE TypeScript, no clock: the caller passes `now`.
 */

import {
  ACWR,
  ATL_TAU_DAYS,
  CAPACITY_COPY_BANDS,
  CAPACITY_MODIFIERS,
  CAPACITY_WEIGHTS,
  CONFIDENCE_BANDS,
  CONFIDENCE_WEIGHTS,
  CTL_TAU_DAYS,
  FU_TO_SESSION_LOAD,
  LN_RMSSD_MIN_SD,
  MUSCLES,
  READINESS_BANDS,
  TAU_SCALE,
  ALL_MUSCLES,
  clamp,
  type Confidence,
  type MuscleId,
} from './constants';
import {
  allMuscleReadiness,
  systemicFatigue,
  type LifestyleInputs,
  type MuscleReadiness,
  type ReadinessState,
} from './recovery';

// ---------------------------------------------------------------------------
// Training load
// ---------------------------------------------------------------------------

/**
 * Session load in arbitrary units.
 *
 * sRPE (Foster CR-10) x duration in minutes is the validated field standard
 * (PMC5673663). When the user gives no sRPE we synthesise it from the set-level
 * model — 1 Fatigue Unit is about 11 AU-minutes at a 60-minute session — so both
 * sources live on one scale.
 *
 * @param totalFatigueUnits sum of structural + metabolic FU across the session
 * @param durationMin       session duration in minutes
 * @param sRpe              optional session RPE on the Foster CR-10 scale
 */
export function sessionLoad(totalFatigueUnits: number, durationMin: number, sRpe?: number): number {
  if (sRpe !== undefined) return sRpe * durationMin;
  return totalFatigueUnits * FU_TO_SESSION_LOAD * clamp(durationMin / 60, 0.5, 2);
}

/**
 * TrainingPeaks-style exponentially weighted moving average:
 * today = yesterday + (load - yesterday) / tauDays.
 *
 * @param series   daily loads, oldest first
 * @param tauDays  time constant in days (42 for CTL, 7 for ATL)
 * @param seed     starting value, default 0
 */
export function ewma(series: readonly number[], tauDays: number, seed = 0): number {
  let value = seed;
  const tau = Math.max(1, tauDays);
  for (const x of series) value = value + (x - value) / tau;
  return value;
}

export interface LoadModel {
  /** Chronic training load: 42-day EWMA of daily load. */
  ctl: number;
  /** Acute training load: 7-day EWMA of daily load. */
  atl: number;
  /** Training stress balance, CTL - ATL (Banister / Coggan). */
  tsb: number;
  /** Uncoupled acute:chronic ratio — last 7 days vs the PRIOR 21, non-overlapping. */
  acwrUncoupled: number;
}

/**
 * CTL (42-day EWMA), ATL (7-day EWMA), TSB = CTL - ATL, and the UNCOUPLED ACWR.
 *
 * The ratio is uncoupled because Lolli 2019 showed the conventional coupled form
 * (the acute week inside the chronic window) produces spurious correlation via
 * mathematical coupling, and Impellizzeri 2020 (IJSPP 15(6):907-13) showed it
 * magnifies the acute-load effect without adding predictive value. It is used
 * only as a soft modifier at 15% of the score and is NEVER labelled injury risk.
 *
 * @param dailyLoads one entry per day, OLDEST FIRST
 */
export function loadModel(dailyLoads: readonly number[]): LoadModel {
  const ctl = ewma(dailyLoads, CTL_TAU_DAYS);
  const atl = ewma(dailyLoads, ATL_TAU_DAYS);
  const acuteWindow = dailyLoads.slice(-ACWR.acuteDays);
  const chronicWindow = dailyLoads.slice(-(ACWR.acuteDays + ACWR.chronicDays), -ACWR.acuteDays);
  const acute = acuteWindow.length
    ? acuteWindow.reduce((a, b) => a + b, 0) / acuteWindow.length
    : 0;
  const chronic = chronicWindow.length
    ? chronicWindow.reduce((a, b) => a + b, 0) / chronicWindow.length
    : acute;
  return { ctl, atl, tsb: ctl - atl, acwrUncoupled: chronic > 0 ? acute / chronic : 1 };
}

/**
 * Soft ramp credit from the uncoupled ACWR: full credit inside Gabbett 2016's
 * 0.8-1.3 band, a gentle taper of 0.32 per unit above it with a 0.70 floor, and
 * a mild reduction below 0.8 that never falls under 0.85. Presented to users as
 * "you ramped up fast this week", never as injury risk.
 */
export function rampTerm(acwr: number): number {
  if (acwr >= ACWR.sweetSpotLow && acwr <= ACWR.sweetSpotHigh) return 1.0;
  if (acwr < ACWR.sweetSpotLow) {
    return clamp(ACWR.underBase + ACWR.underGain * acwr, ACWR.underFloor, 1.0);
  }
  return clamp(1.0 - ACWR.taperPerUnitAbove * (acwr - ACWR.sweetSpotHigh), ACWR.floor, 1.0);
}

// ---------------------------------------------------------------------------
// Capacity score
// ---------------------------------------------------------------------------

/** One line of the "what moved your score" list. `connected: false` renders as "Not connected". */
export interface CapacityDriver {
  label: string;
  /** Points this input added or removed from the base score. 0 when not connected. */
  delta: number;
  connected: boolean;
}

export interface CapacityScore {
  /** 0-100. The big number. */
  score: number;
  /** Explicit confidence label — always shown next to the score. */
  confidence: Confidence;
  /** Raw 0..1 confidence: 0.45 from the training log alone, up to 0.95 fully instrumented. */
  confidenceValue: number;
  headline: string;
  subline: string;
  drivers: CapacityDriver[];
  /** The three base components, each 0..1, before any modifier. */
  components: { systemic: number; muscular: number; ramp: number };
  /** The multiplicative modifiers actually applied; 1.0 means "no data" or "no effect". */
  modifiers: { hrv: number; rhr: number; sleep: number; subjective: number };
  /** True when at least one wearable or subjective input contributed. */
  hasWearableInput: boolean;
  /** The base score from the training log alone, before modifiers. Useful for "log only" copy. */
  baseScore: number;
}

function confidenceLabel(value: number): Confidence {
  if (value >= CONFIDENCE_BANDS.high) return 'high';
  if (value >= CONFIDENCE_BANDS.good) return 'good';
  if (value >= CONFIDENCE_BANDS.moderate) return 'moderate';
  return 'low';
}

/**
 * Volume-weighted mean of the per-muscle readiness chips, 0..1.
 *
 * Weighted by each muscle's MAV ceiling so quads, back and chest dominate the
 * score and tibialis does not.
 */
export function muscularComponent(readiness: readonly MuscleReadiness[]): number {
  const weightSum = ALL_MUSCLES.reduce((total, muscle) => total + MUSCLES[muscle].mavHigh, 0);
  if (weightSum === 0) return 1;
  const weighted = readiness.reduce(
    (total, r) => total + (r.pct / 100) * MUSCLES[r.muscle].mavHigh,
    0,
  );
  return weighted / weightSum;
}

/** Headline and subline for a score. Copy is deliberately about what was logged, not prediction. */
export function capacityCopy(
  score: number,
  readiness: readonly MuscleReadiness[],
  load: LoadModel,
): { headline: string; subline: string } {
  const notReady = readiness.filter((r) => r.pct < READINESS_BANDS.primed && MUSCLES[r.muscle].mev > 0);
  const firstNotReady = notReady[0];

  if (score >= CAPACITY_COPY_BANDS.goodToGo) {
    if (notReady.length === 0) return { headline: 'Good to go', subline: 'Strong recovery today' };
    const names = notReady.slice(0, 2).map((r) => MUSCLES[r.muscle].label.toLowerCase()).join(' and ');
    return { headline: 'Good to go', subline: `Everything ready except ${names}` };
  }
  if (score >= CAPACITY_COPY_BANDS.readyToTrain) {
    return {
      headline: 'Ready to train',
      subline: firstNotReady
        ? `Go easy on ${MUSCLES[firstNotReady.muscle].label.toLowerCase()}`
        : 'Solid capacity',
    };
  }
  if (score >= CAPACITY_COPY_BANDS.trainLight) {
    return {
      headline: 'Train light',
      subline: load.acwrUncoupled > 1.4
        ? 'You ramped up fast this week'
        : 'Carrying fatigue from recent sessions',
    };
  }
  if (score >= CAPACITY_COPY_BANDS.recoveryDay) {
    return { headline: 'Recovery day', subline: 'Technique work, cardio or mobility' };
  }
  return { headline: 'Rest', subline: 'Deep fatigue — a full day off pays back more than a session' };
}

/**
 * The 0-100 daily capacity score, WITH or WITHOUT wearables.
 *
 * Without any wearable or subjective input this is purely
 * 0.50*systemic + 0.35*muscular + 0.15*ramp from the training log, reported at
 * confidence 0.45 ("low"). With inputs connected, each applies a BOUNDED
 * multiplicative modifier and raises confidence:
 *
 *  - HRV      x(1 + 0.055*z) clamped [0.80, 1.08], +0.30 confidence. z is the
 *             Ln rMSSD 7-day rolling mean against the user's own 60-day baseline
 *             (Plews/Kiviniemi); raw daily rMSSD is too noisy to drive a score.
 *  - RHR      x(1 - 0.035*bpm above own baseline) clamped [0.82, 1.05], +0.12.
 *  - Sleep    x(1 - 0.030*3-night debt hours) clamped [0.80, 1.03], +0.10.
 *             Deliberately weak here and strong on `recoveryTauScale`, because
 *             Craven 2022 found acute sleep loss costs -0.30% on strength but
 *             -7.56% on overall performance.
 *  - Stress   x(1 - 0.035*points above neutral) clamped [0.88, 1.04], +0.08.
 *             A cheap check-in, and no consumer recovery algorithm has published
 *             RCT evidence of beating it.
 *
 * @param now        unix ms supplied by the caller
 * @param dailyLoads daily session loads, OLDEST FIRST, for CTL/ATL and the ramp term
 */
export function capacityScore(
  state: ReadinessState,
  now: number,
  dailyLoads: readonly number[] = [],
  lifestyle: LifestyleInputs = {},
): CapacityScore {
  const systemic = 1 - systemicFatigue(state, now);
  const readiness = allMuscleReadiness(state, now, lifestyle);
  const muscular = muscularComponent(readiness);
  const load = loadModel(dailyLoads);
  const ramp = rampTerm(load.acwrUncoupled);

  const baseScore = 100 * (
    CAPACITY_WEIGHTS.systemic * systemic +
    CAPACITY_WEIGHTS.muscular * muscular +
    CAPACITY_WEIGHTS.ramp * ramp
  );

  const drivers: CapacityDriver[] = [];
  let confidenceValue: number = CONFIDENCE_WEIGHTS.logOnly;
  let hasWearableInput = false;

  // HRV — Ln rMSSD z-score of the 7-day rolling mean vs a 60-day baseline.
  let hrv = 1;
  if (
    lifestyle.rmssd7dEwma !== undefined && lifestyle.rmssd7dEwma > 0 &&
    lifestyle.lnRmssdBaselineMean !== undefined &&
    lifestyle.lnRmssdBaselineSd !== undefined
  ) {
    const z = (Math.log(lifestyle.rmssd7dEwma) - lifestyle.lnRmssdBaselineMean) /
      Math.max(LN_RMSSD_MIN_SD, lifestyle.lnRmssdBaselineSd);
    hrv = clamp(1 + CAPACITY_MODIFIERS.hrv.perZ * z, CAPACITY_MODIFIERS.hrv.min, CAPACITY_MODIFIERS.hrv.max);
    confidenceValue += CONFIDENCE_WEIGHTS.hrv;
    hasWearableInput = true;
    drivers.push({ label: 'HRV', delta: Math.round(baseScore * (hrv - 1)), connected: true });
  } else {
    drivers.push({ label: 'HRV', delta: 0, connected: false });
  }

  // Resting heart rate — against the user's OWN baseline, never a population norm.
  let rhr = 1;
  if (lifestyle.restingHr !== undefined && lifestyle.restingHrBaseline !== undefined) {
    rhr = clamp(
      1 - CAPACITY_MODIFIERS.rhr.perBpm * (lifestyle.restingHr - lifestyle.restingHrBaseline),
      CAPACITY_MODIFIERS.rhr.min,
      CAPACITY_MODIFIERS.rhr.max,
    );
    confidenceValue += CONFIDENCE_WEIGHTS.rhr;
    hasWearableInput = true;
    drivers.push({ label: 'Resting HR', delta: Math.round(baseScore * (rhr - 1)), connected: true });
  } else {
    drivers.push({ label: 'Resting HR', delta: 0, connected: false });
  }

  // Sleep — 3-night debt.
  let sleep = 1;
  if (lifestyle.sleepHours !== undefined && lifestyle.sleepHours.length > 0) {
    const need = lifestyle.sleepNeed ?? TAU_SCALE.defaultSleepNeedH;
    const debt = lifestyle.sleepHours
      .slice(0, TAU_SCALE.sleepWindowNights)
      .reduce((total, hours) => total + Math.max(0, need - hours), 0);
    sleep = clamp(
      1 - CAPACITY_MODIFIERS.sleep.perDebtHour * debt,
      CAPACITY_MODIFIERS.sleep.min,
      CAPACITY_MODIFIERS.sleep.max,
    );
    confidenceValue += CONFIDENCE_WEIGHTS.sleep;
    hasWearableInput = true;
    drivers.push({ label: 'Sleep', delta: Math.round(baseScore * (sleep - 1)), connected: true });
  } else {
    drivers.push({ label: 'Sleep', delta: 0, connected: false });
  }

  // Subjective check-in.
  let subjective = 1;
  if (lifestyle.stress !== undefined) {
    subjective = clamp(
      1 - CAPACITY_MODIFIERS.subjective.perStressPoint * (lifestyle.stress - TAU_SCALE.neutralStress),
      CAPACITY_MODIFIERS.subjective.min,
      CAPACITY_MODIFIERS.subjective.max,
    );
    confidenceValue += CONFIDENCE_WEIGHTS.subjective;
    hasWearableInput = true;
    drivers.push({ label: 'Check-in', delta: Math.round(baseScore * (subjective - 1)), connected: true });
  } else {
    drivers.push({ label: 'Check-in', delta: 0, connected: false });
  }

  const score = clamp(Math.round(baseScore * hrv * rhr * sleep * subjective), 0, 100);
  confidenceValue = clamp(confidenceValue, 0, 1);
  const { headline, subline } = capacityCopy(score, readiness, load);

  return {
    score,
    confidence: confidenceLabel(confidenceValue),
    confidenceValue,
    headline,
    subline,
    drivers,
    components: { systemic, muscular, ramp },
    modifiers: { hrv, rhr, sleep, subjective },
    hasWearableInput,
    baseScore,
  };
}

/**
 * The "All muscles ready" banner on the Progress tab.
 *
 * Only muscles the user actually trains are considered: a muscle with no
 * minimum-effective-volume landmark and no training history (tibialis, neck)
 * must not keep the banner red forever.
 */
export function allMusclesReadyBanner(readiness: readonly MuscleReadiness[]): { ready: boolean; text: string } {
  const tracked = readiness.filter((r) => MUSCLES[r.muscle].mev > 0 || r.lastTrainedAt !== null);
  if (tracked.length === 0) return { ready: true, text: 'All muscles ready' };
  const recovering = tracked.filter((r) => r.pct < READINESS_BANDS.readyFloor);
  if (recovering.length === 0) return { ready: true, text: 'All muscles ready' };
  return {
    ready: false,
    text: `${recovering.length} muscle group${recovering.length > 1 ? 's' : ''} still recovering`,
  };
}

/** The muscles currently below the ready floor, worst first. Drives the chip list ordering. */
export function recoveringMuscles(readiness: readonly MuscleReadiness[]): MuscleReadiness[] {
  return readiness
    .filter((r) => r.pct < READINESS_BANDS.readyFloor)
    .slice()
    .sort((a, b) => a.pct - b.pct);
}

/** Convenience: the muscle ids currently deeply fatigued (below 42%). */
export function deeplyFatiguedMuscles(readiness: readonly MuscleReadiness[]): MuscleId[] {
  return readiness.filter((r) => r.pct < READINESS_BANDS.deepFatigue).map((r) => r.muscle);
}
