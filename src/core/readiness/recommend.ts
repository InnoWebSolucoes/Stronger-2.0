/**
 * Stronger 2.0 — muscle readiness engine: the train-today / train-tomorrow recommender.
 *
 * Each candidate muscle is scored as the product of four terms (research doc
 * section 10):
 *
 *   score = readiness^1.6 * volumeDeficit * staleness * habit
 *
 *  - readiness^1.6 — super-linear, because training a 55% muscle is much worse
 *    than training an 85% one.
 *  - volumeDeficit — this week's hard sets against the mesocycle-ramped RP
 *    landmarks, hard-blocked above MRV.
 *  - staleness — a Gaussian peaking at 1.9x the muscle's structural time
 *    constant, capped by its target weekly frequency.
 *  - habit — the user's own weekday pattern, weighted 0.55 + 0.75*affinity.
 *    Schoenfeld/Grgic/Krieger 2019 (PMID 30558493) found volume-equated
 *    frequencies of 1-6x/week give similar hypertrophy, so there is no
 *    "optimal" frequency worth overriding the user's split for.
 *
 * A muscle below 42% readiness is NEVER recommended, whatever its score, and
 * neither is one inside its hard minimum re-training interval or already past
 * MRV for the week. "Tomorrow" is produced by simulating today's recommended
 * session forward 24 hours, so it is a real plan rather than a copy of today.
 *
 * PURE TypeScript, and no clock or locale: the caller supplies `now` and the
 * time-zone offset.
 */

import {
  DEFAULT_BLOCK_LENGTH_WEEKS,
  MESO_RAMP_FRACTION,
  MS_PER_DAY,
  MS_PER_HOUR,
  MUSCLES,
  READINESS_BANDS,
  READINESS_MODEL_VERSION,
  RECOMMENDER,
  SIMULATED_SESSION_DEPOSIT,
  clamp,
  type MuscleId,
} from './constants';
import { capacityScore, type CapacityScore } from './capacity';
import {
  allMuscleReadiness,
  recoveryTauScale,
  type LifestyleInputs,
  type MuscleReadiness,
  type ReadinessState,
} from './recovery';

// ---------------------------------------------------------------------------
// Weekly volume landmarks
// ---------------------------------------------------------------------------

/** Hard sets performed per muscle so far this training week. */
export interface WeeklyVolume {
  sets: Partial<Record<MuscleId, number>>;
}

export type VolumeZone = 'below_mv' | 'maintenance' | 'productive' | 'peak' | 'over_mrv';

/**
 * Which RP volume zone a muscle's weekly hard-set count falls in.
 * below_mv < MV <= maintenance < MEV <= productive < MAV-high <= peak <= MRV < over_mrv.
 */
export function volumeZone(muscle: MuscleId, sets: number): VolumeZone {
  const constants = MUSCLES[muscle];
  if (sets < constants.mv) return 'below_mv';
  if (sets < constants.mev) return 'maintenance';
  if (sets < constants.mavHigh) return 'productive';
  if (sets <= constants.mrv) return 'peak';
  return 'over_mrv';
}

/**
 * This week's hard-set target for a muscle, ramping MEV -> MRV across the
 * accumulation weeks of a mesocycle and dropping to MV on the deload week.
 *
 * @param week        1-based week within the block
 * @param blockLength weeks in the block, including the deload (default 5)
 */
export function weeklyTarget(muscle: MuscleId, week: number, blockLength = DEFAULT_BLOCK_LENGTH_WEEKS): number {
  const constants = MUSCLES[muscle];
  if (week >= blockLength) return Math.round(constants.mv);
  const progress = (Math.max(1, week) - 1) / Math.max(1, blockLength - 2);
  return Math.round(constants.mev + progress * (constants.mrv - constants.mev) * MESO_RAMP_FRACTION);
}

// ---------------------------------------------------------------------------
// The user's split
// ---------------------------------------------------------------------------

/** A named session template from the user's split. */
export interface SessionTemplate {
  /** Stable template slug. */
  id: string;
  name: string;
  muscles: MuscleId[];
}

export interface SplitProfile {
  /**
   * Historical probability that the user trains each muscle on each weekday,
   * as a 7-element array indexed 0 = Sunday .. 6 = Saturday.
   */
  weekdayAffinity: Partial<Record<MuscleId, number[]>>;
  sessionsPerWeek: number;
  templates: SessionTemplate[];
}

// ---------------------------------------------------------------------------
// Pure calendar helpers (no Date, no locale)
// ---------------------------------------------------------------------------

/**
 * Weekday for an instant, 0 = Sunday .. 6 = Saturday, in the caller's time zone.
 * Computed from the epoch so it is deterministic under test and independent of
 * the host machine's locale. 1970-01-01 was a Thursday.
 *
 * @param timeZoneOffsetMinutes minutes to ADD to UTC to get local time (e.g. -300 for UTC-5)
 */
export function weekdayOf(timestampMs: number, timeZoneOffsetMinutes = 0): number {
  const localDays = Math.floor((timestampMs + timeZoneOffsetMinutes * 60_000) / MS_PER_DAY);
  return ((localDays + 4) % 7 + 7) % 7;
}

/**
 * Calendar date of an instant as `YYYY-MM-DD` in the caller's time zone.
 * Uses the civil-from-days algorithm rather than `Date`, so it is pure and
 * deterministic.
 */
export function isoDateOf(timestampMs: number, timeZoneOffsetMinutes = 0): string {
  const days = Math.floor((timestampMs + timeZoneOffsetMinutes * 60_000) / MS_PER_DAY);
  const z = days + 719_468;
  const era = Math.floor(z / 146_097);
  const doe = z - era * 146_097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36_524) - Math.floor(doe / 146_096)) / 365);
  const yearOfEra = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp + (mp < 10 ? 3 : -9);
  const year = yearOfEra + (month <= 2 ? 1 : 0);
  const pad = (n: number, width: number): string => String(n).padStart(width, '0');
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const gaussian = (x: number, mu: number, sigma: number): number =>
  Math.exp(-0.5 * Math.pow((x - mu) / Math.max(1e-6, sigma), 2));

/**
 * How much this muscle wants to be trained right now, as a unitless score.
 * Higher is better; 0 means "do not train this".
 *
 * @param readiness    the muscle's current chip
 * @param setsThisWeek hard sets already performed this training week
 * @param target       this week's hard-set target from {@link weeklyTarget}
 * @param weekday      0 = Sunday .. 6 = Saturday, from {@link weekdayOf}
 * @param now          unix ms supplied by the caller
 */
export function scoreMuscleForToday(
  readiness: MuscleReadiness,
  setsThisWeek: number,
  target: number,
  weekday: number,
  split: SplitProfile,
  now: number,
): number {
  const constants = MUSCLES[readiness.muscle];

  const readinessTerm = Math.pow(readiness.pct / 100, RECOMMENDER.readinessExponent);

  const zone = volumeZone(readiness.muscle, setsThisWeek);
  const deficitSets = target - setsThisWeek;
  const volumeTerm = zone === 'over_mrv'
    ? RECOMMENDER.volumeOverMrv
    : deficitSets <= 0
      ? RECOMMENDER.volumeAtTarget
      : clamp(
          RECOMMENDER.volumeBase +
            RECOMMENDER.volumeGain * (deficitSets / Math.max(RECOMMENDER.volumeDeficitFloor, target)),
          RECOMMENDER.volumeBase,
          1.0,
        );

  // Peak desire at the muscle's OWN optimal re-train interval, derived from its
  // structural time constant and capped by its target weekly frequency.
  const idealH = Math.min(
    constants.tauStructuralH * RECOMMENDER.stalenessPeakTauMultiple,
    (7 * 24) / Math.max(1, constants.targetFrequency),
  );
  const sinceH = readiness.lastTrainedAt === null
    ? idealH * RECOMMENDER.stalenessNeverTrainedMultiple
    : (now - readiness.lastTrainedAt) / MS_PER_HOUR;
  const stalenessTerm = RECOMMENDER.stalenessBase +
    RECOMMENDER.stalenessGain * gaussian(sinceH, idealH, idealH * RECOMMENDER.stalenessSigmaFraction);

  const affinity = split.weekdayAffinity[readiness.muscle]?.[weekday] ?? RECOMMENDER.defaultWeekdayAffinity;
  const habitTerm = RECOMMENDER.habitBase + RECOMMENDER.habitGain * clamp(affinity, 0, 1);

  return readinessTerm * volumeTerm * stalenessTerm * habitTerm;
}

// ---------------------------------------------------------------------------
// Recommendation
// ---------------------------------------------------------------------------

export type IntensityGuidance = 'full' | 'moderate' | 'light' | 'rest';

/** Why a muscle was excluded from the recommendation. */
export type BlockReason = 'deeply_fatigued' | 'min_retrain_interval' | 'over_mrv';

export interface ScoredMuscle {
  muscle: MuscleId;
  label: string;
  /** 0-100 readiness chip value. */
  readiness: number;
  setsThisWeek: number;
  target: number;
  zone: VolumeZone;
  score: number;
  /** Hard sets suggested for this muscle today, capped per session. */
  suggestedSets: number;
}

export interface BlockedMuscle {
  muscle: MuscleId;
  label: string;
  readiness: number;
  reason: BlockReason;
  /** Hours until the muscle is back above the ready floor. */
  hoursToReady: number;
}

export interface Recommendation {
  /** YYYY-MM-DD in the caller's time zone. */
  date: string;
  /** The chosen template's id, or null on a rest day. */
  sessionId: string | null;
  sessionName: string;
  /** Muscles to train, best first. Never contains a deeply fatigued muscle. */
  muscles: ScoredMuscle[];
  /** Muscles deliberately left out, with the reason. */
  avoid: BlockedMuscle[];
  /** One short human-readable sentence for the card. */
  reason: string;
  /** Supporting lines for the expanded view. */
  rationale: string[];
  intensityGuidance: IntensityGuidance;
}

export interface RecommendInput {
  state: ReadinessState;
  /** Unix ms supplied by the caller. This module never reads a clock. */
  now: number;
  weekSets: WeeklyVolume;
  split: SplitProfile;
  /** Daily session loads, oldest first, for the capacity score's ramp term. */
  dailyLoads?: readonly number[];
  /** 1-based week within the mesocycle. */
  mesoWeek?: number;
  blockLengthWeeks?: number;
  lifestyle?: LifestyleInputs;
  /** Minutes to add to UTC for the user's local time; default 0 (UTC). */
  timeZoneOffsetMinutes?: number;
}

function intensityFor(score: number): IntensityGuidance {
  if (score >= RECOMMENDER.intensity.full) return 'full';
  if (score >= RECOMMENDER.intensity.moderate) return 'moderate';
  if (score >= RECOMMENDER.intensity.light) return 'light';
  return 'rest';
}

function suggestedSetsFor(target: number, setsThisWeek: number, muscle: MuscleId): number {
  const deficit = Math.max(0, target - setsThisWeek);
  const perSession = deficit / Math.max(1, MUSCLES[muscle].targetFrequency);
  return clamp(Math.round(perSession), deficit > 0 ? 2 : 0, RECOMMENDER.maxSetsPerSession);
}

/**
 * Build one day's recommendation from an already-projected state.
 * Exported for tests and for surfaces that want a single day rather than a pair.
 */
export function recommendForInstant(
  state: ReadinessState,
  at: number,
  input: Omit<RecommendInput, 'state' | 'now'>,
): Recommendation {
  const lifestyle = input.lifestyle ?? {};
  const capacity = capacityScore(state, at, input.dailyLoads ?? [], lifestyle);
  const weekday = weekdayOf(at, input.timeZoneOffsetMinutes ?? 0);
  const readiness = allMuscleReadiness(state, at, lifestyle);
  const mesoWeek = input.mesoWeek ?? 1;
  const blockLength = input.blockLengthWeeks ?? DEFAULT_BLOCK_LENGTH_WEEKS;

  const eligible: ScoredMuscle[] = [];
  const avoid: BlockedMuscle[] = [];

  for (const chip of readiness) {
    const constants = MUSCLES[chip.muscle];
    const setsThisWeek = input.weekSets.sets[chip.muscle] ?? 0;
    const target = weeklyTarget(chip.muscle, mesoWeek, blockLength);
    const zone = volumeZone(chip.muscle, setsThisWeek);

    // Hard blocks, in priority order. None of these can be outvoted by a score.
    let blocked: BlockReason | null = null;
    if (chip.pct < READINESS_BANDS.deepFatigue) {
      blocked = 'deeply_fatigued';
    } else if (
      chip.lastTrainedAt !== null &&
      (at - chip.lastTrainedAt) / MS_PER_HOUR < constants.minRetrainH * 0.5
    ) {
      blocked = 'min_retrain_interval';
    } else if (zone === 'over_mrv') {
      blocked = 'over_mrv';
    }

    if (blocked !== null) {
      avoid.push({
        muscle: chip.muscle,
        label: constants.label,
        readiness: chip.pct,
        reason: blocked,
        hoursToReady: chip.hoursToReady,
      });
      continue;
    }

    eligible.push({
      muscle: chip.muscle,
      label: constants.label,
      readiness: chip.pct,
      setsThisWeek,
      target,
      zone,
      score: scoreMuscleForToday(chip, setsThisWeek, target, weekday, input.split, at),
      suggestedSets: suggestedSetsFor(target, setsThisWeek, chip.muscle),
    });
  }

  eligible.sort((a, b) => b.score - a.score);
  const scoreByMuscle = new Map(eligible.map((m) => [m.muscle, m.score]));

  // Pick the template whose ELIGIBLE muscles score best. A template where fewer
  // than half the muscles are trainable today is disqualified outright, so a
  // deeply fatigued muscle can never be recommended by the back door.
  let best: SessionTemplate | null = null;
  let bestScore = -1;
  for (const template of input.split.templates) {
    if (template.muscles.length === 0) continue;
    const usable = template.muscles.filter((m) => scoreByMuscle.has(m));
    if (usable.length * 2 < template.muscles.length) continue;
    const templateScore = usable.reduce((total, m) => total + (scoreByMuscle.get(m) ?? 0), 0) / template.muscles.length;
    if (templateScore > bestScore) {
      bestScore = templateScore;
      best = template;
    }
  }

  const capacityGuidance = intensityFor(capacity.score);
  const intensityGuidance: IntensityGuidance = eligible.length === 0 ? 'rest' : capacityGuidance;
  const top = eligible[0];

  const sessionMuscles = intensityGuidance === 'rest'
    ? []
    : best !== null
      ? eligible.filter((m) => best !== null && best.muscles.includes(m.muscle))
      : eligible.slice(0, 3);

  const listed = (sessionMuscles.length > 0 ? sessionMuscles : eligible)
    .slice(0, RECOMMENDER.maxMusclesListed);

  const rationale: string[] = [];
  let reason: string;

  // The reason must cite a muscle from the session actually being recommended,
  // not the globally best-scoring one, or the card contradicts itself.
  const headlineMuscle = listed[0] ?? top;

  if (intensityGuidance === 'rest') {
    reason = eligible.length === 0
      ? 'Everything you train is still recovering — take the day off.'
      : `Capacity ${capacity.score}/100 — a rest day now protects the whole week.`;
    rationale.push(reason);
  } else if (headlineMuscle !== undefined) {
    const deficit = Math.max(0, headlineMuscle.target - headlineMuscle.setsThisWeek);
    reason = `${headlineMuscle.label} is ${headlineMuscle.readiness}% recovered and ${formatSets(deficit)} under target this week.`;
    rationale.push(reason);
  } else {
    reason = 'Nothing is clearly due today — train what you feel like.';
    rationale.push(reason);
  }

  const deepFatigue = avoid.filter((a) => a.reason === 'deeply_fatigued').slice(0, 2);
  if (deepFatigue.length > 0) {
    rationale.push(
      `Avoid ${deepFatigue.map((a) => a.label.toLowerCase()).join(' and ')} — still under ${READINESS_BANDS.deepFatigue}% recovered.`,
    );
  }
  const overMrv = avoid.filter((a) => a.reason === 'over_mrv');
  if (overMrv.length > 0) {
    rationale.push(
      `${overMrv.map((a) => a.label).join(', ')} already past MRV this week — no more direct sets.`,
    );
  }
  if (intensityGuidance === 'light' || intensityGuidance === 'moderate') {
    rationale.push(`Capacity ${capacity.score}/100 (${capacity.confidence} confidence) — keep a rep or two in reserve.`);
  }

  const sessionName = intensityGuidance === 'rest'
    ? 'Rest day'
    : best?.name ?? (top !== undefined ? `${top.label} focus` : 'Free session');

  return {
    date: isoDateOf(at, input.timeZoneOffsetMinutes ?? 0),
    sessionId: intensityGuidance === 'rest' ? null : best?.id ?? null,
    sessionName,
    muscles: intensityGuidance === 'rest' ? [] : listed,
    avoid,
    reason,
    rationale,
    intensityGuidance,
  };
}

function formatSets(sets: number): string {
  const rounded = Math.round(sets * 10) / 10;
  return `${rounded} set${rounded === 1 ? '' : 's'}`;
}

/**
 * What to train today and what to train tomorrow.
 *
 * Tomorrow is not a copy of today: today's recommended session is simulated as a
 * median hard block on each of its muscles, the whole state is aged 24 hours,
 * and the recommender runs again. That is what makes "legs today, push tomorrow"
 * fall out of the model instead of being hard-coded.
 *
 * @returns today's and tomorrow's recommendation, plus the capacity score behind them
 */
export function recommend(input: RecommendInput): {
  today: Recommendation;
  tomorrow: Recommendation;
  capacity: CapacityScore;
} {
  const { state, now, ...rest } = input;
  const lifestyle = input.lifestyle ?? {};
  const capacity = capacityScore(state, now, input.dailyLoads ?? [], lifestyle);

  const today = recommendForInstant(state, now, rest);

  // Project tomorrow by depositing a median session on today's muscles.
  const tauScale = recoveryTauScale(lifestyle);
  const projected: ReadinessState = {
    deposits: [...state.deposits],
    systemic: [...state.systemic],
  };

  const plannedMuscles = today.sessionId !== null
    ? input.split.templates.find((t) => t.id === today.sessionId)?.muscles ?? today.muscles.map((m) => m.muscle)
    : today.muscles.map((m) => m.muscle);

  for (const muscle of plannedMuscles) {
    const constants = MUSCLES[muscle];
    projected.deposits.push({
      muscle,
      at: now,
      structural: SIMULATED_SESSION_DEPOSIT.structural,
      metabolic: SIMULATED_SESSION_DEPOSIT.metabolic,
      tauStructuralH: constants.tauStructuralH * tauScale,
      tauMetabolicH: constants.tauMetabolicH * tauScale,
      modelVersion: READINESS_MODEL_VERSION,
    });
    projected.systemic.push({
      at: now,
      fast: SIMULATED_SESSION_DEPOSIT.systemicFast * constants.systemicShare,
      slow: SIMULATED_SESSION_DEPOSIT.systemicSlow * constants.systemicShare,
    });
  }

  // Tomorrow's weekly volume includes the sets today's plan would add.
  const projectedSets: Partial<Record<MuscleId, number>> = { ...input.weekSets.sets };
  for (const planned of today.muscles) {
    projectedSets[planned.muscle] = (projectedSets[planned.muscle] ?? 0) + planned.suggestedSets;
  }

  const tomorrow = recommendForInstant(projected, now + 24 * MS_PER_HOUR, {
    ...rest,
    weekSets: { sets: projectedSets },
  });

  return { today, tomorrow, capacity };
}
