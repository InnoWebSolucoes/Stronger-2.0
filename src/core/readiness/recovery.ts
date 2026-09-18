/**
 * Stronger 2.0 — muscle readiness engine: recovery / decay.
 *
 * Fatigue deposited by `fatigue.ts` decays exponentially on TWO compartments per
 * muscle, each with its own muscle-specific time constant (research doc
 * section 6):
 *
 *   structural(t) = S0 * exp(-t / tauStructural)     tau 20h (calves, abs) .. 40h (lower back)
 *   metabolic(t)  = M0 * exp(-t / tauMetabolic)      tau  8h .. 13h
 *   readiness     = 1 - (0.62*tanh(S/4.8) + 0.38*tanh(M/4.8))
 *
 * The tanh saturation is what keeps a brutal session at ~15-20% readiness rather
 * than driving it negative. A single decay cannot make a drop set feel different
 * from a heavy triple the next morning; the two compartments can.
 *
 * PURE TypeScript, and no clock: every function takes the instant or the elapsed
 * time as an argument.
 */

import {
  clamp,
  FU_SCALE,
  HOURS_TO_READY_HORIZON_H,
  MS_PER_HOUR,
  MUSCLES,
  READINESS_BANDS,
  SORENESS_MAX,
  SORENESS_PENALTY_PER_POINT,
  SYS_SCALE,
  TAU_SCALE,
  TAU_SYSTEMIC_FAST_H,
  TAU_SYSTEMIC_SLOW_H,
  W_METABOLIC,
  W_STRUCTURAL,
  W_SYS_FAST,
  W_SYS_SLOW,
  ALL_MUSCLES,
  type MuscleId,
} from './constants';
import type { FatigueDeposit, SystemicDeposit } from './fatigue';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/**
 * The persisted readiness state: a ledger of undecayed fatigue deposits plus the
 * systemic deposits. A ledger rather than a single running total, because
 * deposits made by a to-failure set decay on a stretched time constant and must
 * keep it.
 */
export interface ReadinessState {
  deposits: FatigueDeposit[];
  systemic: SystemicDeposit[];
}

/** An empty state: no history, everything fully recovered. */
export function emptyReadinessState(): ReadinessState {
  return { deposits: [], systemic: [] };
}

/**
 * Append new deposits to the state, returning a new state. Does not mutate.
 * Deposits may arrive out of order (offline sync); nothing here assumes sorting.
 */
export function appendDeposits(
  state: ReadinessState,
  deposits: readonly FatigueDeposit[],
  systemic: readonly SystemicDeposit[] = [],
): ReadinessState {
  return {
    deposits: [...state.deposits, ...deposits],
    systemic: [...state.systemic, ...systemic],
  };
}

/**
 * Drop deposits that have decayed to irrelevance, so the ledger stays small on
 * device. Default horizon is 14 days: at the longest tau (40h) that is 8.4 time
 * constants, i.e. under 0.03% of the original fatigue remaining.
 *
 * @param now unix ms supplied by the caller
 */
export function pruneState(state: ReadinessState, now: number, horizonDays = 14): ReadinessState {
  const cutoff = now - horizonDays * 24 * MS_PER_HOUR;
  return {
    deposits: state.deposits.filter((d) => d.at >= cutoff),
    systemic: state.systemic.filter((s) => s.at >= cutoff),
  };
}

// ---------------------------------------------------------------------------
// Lifestyle -> recovery RATE
// ---------------------------------------------------------------------------

/** Subjective and wearable inputs. Every field is optional: the no-wearable path is primary. */
export interface LifestyleInputs {
  /** Hours slept per night, MOST RECENT FIRST. Only the first 3 nights count toward debt. */
  sleepHours?: number[];
  /** Nightly sleep need in hours; defaults to 8. */
  sleepNeed?: number;
  /** Subjective stress, 1..5, where 3 is normal. */
  stress?: number;
  /** Resting heart rate today, bpm. */
  restingHr?: number;
  /** The user's OWN resting heart-rate baseline, bpm. */
  restingHrBaseline?: number;
  /** Today's raw rMSSD, ms (unused by the score; kept for display). */
  rmssdToday?: number;
  /** 7-day rolling mean rMSSD, ms (Plews/Kiviniemi standard). */
  rmssd7dEwma?: number;
  /** 60-day mean of ln(rMSSD). */
  lnRmssdBaselineMean?: number;
  /** 60-day SD of ln(rMSSD). */
  lnRmssdBaselineSd?: number;
  /** Self-reported soreness per muscle, 0..3. */
  soreness?: Partial<Record<MuscleId, number>>;
  /** Energy balance, -1 (deep deficit) .. +1 (surplus). */
  energyBalance?: number;
}

/**
 * Global multiplier applied to EVERY recovery time constant, from sleep debt,
 * stress and energy deficit. Returns 1.0 (no slowdown) up to 1.55.
 *
 * Craven 2022 (PMID 35708888) found acute sleep loss costs only -0.30% on peak
 * strength but -7.56% on overall physical performance, so lifestyle belongs on
 * the recovery RATE, not on the strength score: +5.5% per hour of 3-night sleep
 * debt, +5% per point of stress above neutral, +12%*|deficit| when under-eating.
 *
 * Pass the result into `AccrualContext.tauScale` when accruing sets, so each
 * deposit carries the recovery rate that applied when it was made.
 */
export function recoveryTauScale(lifestyle: LifestyleInputs = {}): number {
  const need = lifestyle.sleepNeed ?? TAU_SCALE.defaultSleepNeedH;
  const nights = lifestyle.sleepHours ?? [];
  const debt = nights
    .slice(0, TAU_SCALE.sleepWindowNights)
    .reduce((total, hours) => total + Math.max(0, need - hours), 0);
  const stressPenalty = TAU_SCALE.perStressPoint *
    Math.max(0, (lifestyle.stress ?? TAU_SCALE.neutralStress) - TAU_SCALE.neutralStress);
  const energy = lifestyle.energyBalance;
  const dietPenalty = energy !== undefined && energy < 0 ? TAU_SCALE.perEnergyDeficit * Math.abs(energy) : 0;
  return clamp(1 + TAU_SCALE.perSleepDebtHour * debt + stressPenalty + dietPenalty, TAU_SCALE.min, TAU_SCALE.max);
}

// ---------------------------------------------------------------------------
// Decay
// ---------------------------------------------------------------------------

/**
 * Decay one deposit forward by `elapsedHours`, returning an equivalent deposit
 * stamped `elapsedHours` later. Exactly equivalent to evaluating the original
 * deposit at the later instant, so decaying in steps and decaying in one jump
 * give the same answer. Negative elapsed time is treated as zero: fatigue is
 * never un-decayed.
 */
export function decayDeposit(deposit: FatigueDeposit, elapsedHours: number): FatigueDeposit {
  const dt = Math.max(0, elapsedHours);
  return {
    ...deposit,
    at: deposit.at + dt * MS_PER_HOUR,
    structural: deposit.structural * Math.exp(-dt / deposit.tauStructuralH),
    metabolic: deposit.metabolic * Math.exp(-dt / deposit.tauMetabolicH),
  };
}

/**
 * Decay the whole state forward by `elapsedHours` — the pure
 * (state, elapsedHours) -> state recovery function.
 *
 * Each muscle decays on its OWN constants: after 24 hours a calf deposit
 * (tau 20h) retains e^-1.2 = 30% of its structural fatigue while a lower-back
 * deposit (tau 40h) retains e^-0.6 = 55%. Systemic deposits decay on the 16h
 * fast / 60h slow compartments.
 */
export function decayFatigue(state: ReadinessState, elapsedHours: number): ReadinessState {
  const dt = Math.max(0, elapsedHours);
  return {
    deposits: state.deposits.map((d) => decayDeposit(d, dt)),
    systemic: state.systemic.map((s) => ({
      at: s.at + dt * MS_PER_HOUR,
      fast: s.fast * Math.exp(-dt / TAU_SYSTEMIC_FAST_H),
      slow: s.slow * Math.exp(-dt / TAU_SYSTEMIC_SLOW_H),
    })),
  };
}

/** A muscle's fatigue at one instant, in Fatigue Units. */
export interface MuscleFatigue {
  structural: number;
  metabolic: number;
  /** Unix ms of the most recent deposit at or before the evaluated instant, or null. */
  lastTrainedAt: number | null;
}

/**
 * A muscle's compact fatigue snapshot: the two compartments plus the effective
 * time constants they decay on. Useful for persisting one row per muscle instead
 * of the full ledger.
 */
export interface MuscleFatigueSnapshot extends MuscleFatigue {
  tauStructuralH: number;
  tauMetabolicH: number;
}

/**
 * Decay a compact per-muscle snapshot forward by `elapsedHours`.
 * `lastTrainedAt` is carried through unchanged: the snapshot moves forward in
 * time, but the training event did not.
 */
export function decayMuscleFatigue(
  snapshot: MuscleFatigueSnapshot,
  elapsedHours: number,
): MuscleFatigueSnapshot {
  const dt = Math.max(0, elapsedHours);
  return {
    ...snapshot,
    structural: snapshot.structural * Math.exp(-dt / snapshot.tauStructuralH),
    metabolic: snapshot.metabolic * Math.exp(-dt / snapshot.tauMetabolicH),
  };
}

/**
 * Total fatigue on one muscle at an instant, summing every deposit that has
 * already happened. Deposits stamped in the future are ignored, so a simulated
 * session can sit in the same ledger without contaminating "now".
 *
 * @param now unix ms
 */
export function muscleFatigueAt(state: ReadinessState, muscle: MuscleId, now: number): MuscleFatigue {
  let structural = 0;
  let metabolic = 0;
  let lastTrainedAt: number | null = null;

  for (const deposit of state.deposits) {
    if (deposit.muscle !== muscle || deposit.at > now) continue;
    const dt = Math.max(0, now - deposit.at) / MS_PER_HOUR;
    structural += deposit.structural * Math.exp(-dt / deposit.tauStructuralH);
    metabolic += deposit.metabolic * Math.exp(-dt / deposit.tauMetabolicH);
    if (lastTrainedAt === null || deposit.at > lastTrainedAt) lastTrainedAt = deposit.at;
  }

  return { structural, metabolic, lastTrainedAt };
}

/**
 * Collapse the ledger into one snapshot per muscle at `now`, with fatigue-weighted
 * effective time constants. The weighting is an approximation — deposits with
 * different tau are merged — so the ledger remains the source of truth; this is
 * for cheap persistence and for UI that only needs the current picture.
 */
export function snapshotFatigue(state: ReadinessState, now: number): Record<MuscleId, MuscleFatigueSnapshot> {
  const out = {} as Record<MuscleId, MuscleFatigueSnapshot>;
  for (const muscle of ALL_MUSCLES) {
    const constants = MUSCLES[muscle];
    let structural = 0;
    let metabolic = 0;
    let tauStructuralWeighted = 0;
    let tauMetabolicWeighted = 0;
    let lastTrainedAt: number | null = null;

    for (const deposit of state.deposits) {
      if (deposit.muscle !== muscle || deposit.at > now) continue;
      const dt = Math.max(0, now - deposit.at) / MS_PER_HOUR;
      const s = deposit.structural * Math.exp(-dt / deposit.tauStructuralH);
      const m = deposit.metabolic * Math.exp(-dt / deposit.tauMetabolicH);
      structural += s;
      metabolic += m;
      tauStructuralWeighted += s * deposit.tauStructuralH;
      tauMetabolicWeighted += m * deposit.tauMetabolicH;
      if (lastTrainedAt === null || deposit.at > lastTrainedAt) lastTrainedAt = deposit.at;
    }

    out[muscle] = {
      structural,
      metabolic,
      lastTrainedAt,
      tauStructuralH: structural > 0 ? tauStructuralWeighted / structural : constants.tauStructuralH,
      tauMetabolicH: metabolic > 0 ? tauMetabolicWeighted / metabolic : constants.tauMetabolicH,
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

/**
 * Saturating map from raw Fatigue Units to a 0..1 readiness deficit.
 * tanh gives a soft ceiling, so an exceptional session lands near 15-20%
 * readiness instead of going negative.
 */
export function fatigueDeficit(fatigueUnits: number, scale = FU_SCALE): number {
  return Math.tanh(Math.max(0, fatigueUnits) / scale);
}

/**
 * Readiness as a 0..1 fraction from the two compartments:
 * 1 - (0.62*tanh(S/4.8) + 0.38*tanh(M/4.8)).
 */
export function readinessFraction(structural: number, metabolic: number): number {
  return 1 - (W_STRUCTURAL * fatigueDeficit(structural) + W_METABOLIC * fatigueDeficit(metabolic));
}

export type ReadinessStatus = 'ready' | 'primed' | 'moderate' | 'fatigued' | 'not_ready';

/** Status band for a readiness percentage: >=90 ready, >=78 primed, >=62 moderate, >=42 fatigued. */
export function readinessStatus(pct: number): ReadinessStatus {
  if (pct >= READINESS_BANDS.ready) return 'ready';
  if (pct >= READINESS_BANDS.primed) return 'primed';
  if (pct >= READINESS_BANDS.moderate) return 'moderate';
  if (pct >= READINESS_BANDS.fatigued) return 'fatigued';
  return 'not_ready';
}

/** One muscle's readiness chip. */
export interface MuscleReadiness {
  muscle: MuscleId;
  /** 0..100, the number on the chip. */
  pct: number;
  /** Remaining structural fatigue, Fatigue Units. */
  structural: number;
  /** Remaining metabolic fatigue, Fatigue Units. */
  metabolic: number;
  status: ReadinessStatus;
  /** Hours until this muscle is back at or above 85%, or 0 if it already is. Capped at 168. */
  hoursToReady: number;
  /** Unix ms of the last set that touched this muscle, or null if never trained. */
  lastTrainedAt: number | null;
}

/**
 * Readiness for one muscle at an instant.
 *
 * Self-reported soreness docks at most 12 points (4 per point on a 0-3 scale)
 * and never sets the value: soreness peaks 24-72h while force loss at 24-48h is
 * the better damage marker, so a model that blocked training on soreness would
 * contradict the literature, and one that ignored it would feel broken.
 *
 * `hoursToReady` searches forward on the undocked physiological curve up to 7
 * days, then applies the muscle's hard minimum re-training interval.
 *
 * @param now unix ms supplied by the caller
 */
export function readinessForMuscle(
  state: ReadinessState,
  muscle: MuscleId,
  now: number,
  lifestyle: LifestyleInputs = {},
): MuscleReadiness {
  const fatigue = muscleFatigueAt(state, muscle, now);
  let raw = readinessFraction(fatigue.structural, fatigue.metabolic);

  const soreness = lifestyle.soreness?.[muscle];
  if (soreness !== undefined) raw -= clamp(soreness, 0, SORENESS_MAX) * SORENESS_PENALTY_PER_POINT;

  const pct = clamp(Math.round(raw * 100), 0, 100);

  let hoursToReady = 0;
  if (pct < READINESS_BANDS.readyFloor) {
    let hours = 0;
    while (hours < HOURS_TO_READY_HORIZON_H) {
      hours += 1;
      const future = muscleFatigueAt(state, muscle, now + hours * MS_PER_HOUR);
      if (readinessFraction(future.structural, future.metabolic) >= READINESS_BANDS.readyFloor / 100) break;
    }
    hoursToReady = hours;
  }

  // Hard floor on re-training frequency, independent of how good the chip looks:
  // half the muscle's minimum re-training interval must elapse before it is
  // presented as fresh.
  const constants = MUSCLES[muscle];
  if (fatigue.lastTrainedAt !== null) {
    const sinceH = (now - fatigue.lastTrainedAt) / MS_PER_HOUR;
    const floorH = constants.minRetrainH * 0.5;
    if (sinceH < floorH && pct > 70) hoursToReady = Math.max(hoursToReady, floorH - sinceH);
  }

  return {
    muscle,
    pct,
    structural: fatigue.structural,
    metabolic: fatigue.metabolic,
    status: readinessStatus(pct),
    hoursToReady,
    lastTrainedAt: fatigue.lastTrainedAt,
  };
}

/** Readiness chips for every muscle, in the stable `ALL_MUSCLES` order. */
export function allMuscleReadiness(
  state: ReadinessState,
  now: number,
  lifestyle: LifestyleInputs = {},
): MuscleReadiness[] {
  return ALL_MUSCLES.map((muscle) => readinessForMuscle(state, muscle, now, lifestyle));
}

/**
 * Whole-body systemic fatigue at an instant, 0..1, from the two-compartment
 * systemic layer (16h fast / 60h slow, weighted 0.45/0.55) passed through the
 * same tanh saturation at a slightly higher scale (5.0), because whole-body load
 * is additive across many muscles.
 */
export function systemicFatigue(state: ReadinessState, now: number): number {
  let fast = 0;
  let slow = 0;
  for (const deposit of state.systemic) {
    if (deposit.at > now) continue;
    const dt = (now - deposit.at) / MS_PER_HOUR;
    fast += deposit.fast * Math.exp(-dt / TAU_SYSTEMIC_FAST_H);
    slow += deposit.slow * Math.exp(-dt / TAU_SYSTEMIC_SLOW_H);
  }
  return fatigueDeficit(W_SYS_FAST * fast + W_SYS_SLOW * slow, SYS_SCALE);
}
