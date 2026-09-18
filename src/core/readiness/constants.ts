/**
 * Stronger 2.0 — muscle readiness engine: constants.
 *
 * Every number in this file is transcribed from the calibrated model in
 * `docs/research/muscle-readiness-recovery-model-for-stronger-2-0-p.md`
 * (sections 1, 3, 8). Nothing here is invented; where a value is a defensible
 * prior rather than a measured quantity the doc comment says so.
 *
 * PURE TypeScript. No react / react-native / expo imports. Runs under plain node.
 *
 * Unit conventions used throughout the readiness module:
 *   - weights  : KG (canonical storage unit, never converted here)
 *   - time     : unix milliseconds for instants, HOURS for durations/time constants
 *   - fatigue  : "Fatigue Units" (FU), an internal dimensionless scale where
 *                1.0 FU = one reference set (8 reps @ 75% e1RM, RIR 1, contribution 1.0)
 *   - readiness: 0..100 percent
 */

/**
 * Model version. Bump whenever any constant in this file changes.
 *
 * Fatigue Units have no physical meaning, so retuning a multiplier silently
 * rewrites every historical readiness number. Each deposit records the version
 * it was scored with so old sessions can be replayed against the constants that
 * produced them. (Research doc, "Risks".)
 */
export const READINESS_MODEL_VERSION = 1;

/** Milliseconds in one hour. */
export const MS_PER_HOUR = 3_600_000;

/** Milliseconds in one day. */
export const MS_PER_DAY = 86_400_000;

/**
 * Clamp `x` into [lo, hi]; NaN maps to `lo`.
 *
 * Exported because every sub-module of the readiness engine bounds a modifier,
 * and duplicating the helper would let the bounds drift apart.
 */
export function clamp(x: number, lo: number, hi: number): number {
  if (Number.isNaN(x)) return lo;
  return Math.min(hi, Math.max(lo, x));
}

// ---------------------------------------------------------------------------
// 1. MUSCLE TAXONOMY
// ---------------------------------------------------------------------------

/**
 * Stable muscle-group identifiers. These are slugs, never indices: user history
 * must survive catalog updates (AGENTS.md, "Exercise IDs are stable slugs").
 */
export type MuscleId =
  | 'chest' | 'front_delts' | 'side_delts' | 'rear_delts'
  | 'lats' | 'upper_back' | 'lower_back' | 'traps'
  | 'biceps' | 'triceps' | 'forearms'
  | 'abs' | 'obliques'
  | 'glutes' | 'quads' | 'hamstrings' | 'adductors' | 'abductors'
  | 'calves' | 'tibialis' | 'neck';

export type MuscleRegion = 'push' | 'pull' | 'legs' | 'core' | 'arms';

/** Per-muscle recovery constants and weekly volume landmarks. */
export interface MuscleConstants {
  id: MuscleId;
  label: string;
  region: MuscleRegion;
  /**
   * Structural (exercise-induced muscle damage) decay time constant, HOURS.
   * Fatigue falls to 37% (1/e) of its peak at t = tau.
   *
   * Basis: fibre-type composition (Johnson 1973, 36 human muscles; Staron 2000)
   * combined with the fusiform/long-fascicle vs pennate damage-susceptibility
   * gradient. Ordering: calves/abs 20h < forearms/obliques/neck 22h <
   * side+rear delts 24h < traps/front delts 26h < upper back/triceps 28h <
   * chest/biceps 30h < lats/adductors 32h < quads/glutes 34h < hamstrings 38h <
   * lower back 40h. These are defensible priors, not measured values: no study
   * measures a per-muscle-group recovery time constant directly, which is why
   * `cold-start.ts` ships online personalisation from day one.
   */
  tauStructuralH: number;
  /**
   * Metabolic / peripheral-neuromuscular decay time constant, HOURS (8-13h).
   * Fast compartment: metabolite clearance and peripheral fatigue, which resolve
   * within a day even when structural damage has not.
   */
  tauMetabolicH: number;
  /** Percent type-I fibres. Johnson 1973 / Staron 2000 (vastus lateralis ~32-40% in men). */
  slowTwitchPct: number;
  /**
   * Relative susceptibility to eccentric damage; 1.00 = chest reference.
   * Elbow flexors and hamstrings highest (fusiform, long fascicles), pennate and
   * slow-twitch groups (calves, delts) lowest.
   */
  eccentricSensitivity: number;
  /** Fraction of this muscle's structural deposit that spills into SYSTEMIC fatigue (muscle-mass proxy). */
  systemicShare: number;
  /** Maintenance volume, weekly hard sets (RP: ~6 for most muscles). */
  mv: number;
  /** Minimum effective volume, weekly hard sets (RP landmarks). */
  mev: number;
  /** Low edge of the adaptive volume range, weekly hard sets. */
  mavLow: number;
  /** High edge of the adaptive volume range, weekly hard sets. */
  mavHigh: number;
  /** Maximum recoverable volume, weekly hard sets. */
  mrv: number;
  /** Target sessions per week (Schoenfeld/Grgic/Krieger 2019: at least 2x for majors). */
  targetFrequency: number;
  /** Hard floor: never recommend re-loading this muscle sooner than this, HOURS. */
  minRetrainH: number;
}

/**
 * Per-muscle constants. tau is calibrated so a MAXIMAL session yields
 * readiness(t) ~= 100 - 62*e^(-t/tau): quads (tau 34h) ~75% at 48h, ~88% at 72h;
 * calves (tau 20h) ~87% at 48h, consistent with an ~80% type-I soleus.
 *
 * Volume landmarks are the RP weekly-hard-set table (chest 8/12-20/22+,
 * back width 8/12-20/25+, quads 6-8/10-18/20+, hamstrings 4/8-14/16+, etc.),
 * with MEV nudged to 8 for chest/lats/quads to match RP's muscle-specific guides.
 *
 * Note the deliberate spread the UI depends on: calves, forearms and abs sit at
 * 20-22h structural / 8-9h metabolic, while quads, glutes and back sit at
 * 32-40h / 11-13h. That is the whole reason a calf chip can read 87% while the
 * quad chip beside it reads 29%.
 */
export const MUSCLES: Record<MuscleId, MuscleConstants> = {
  chest:       { id: 'chest',       label: 'Chest',             region: 'push', tauStructuralH: 30, tauMetabolicH: 11, slowTwitchPct: 42, eccentricSensitivity: 1.00, systemicShare: 0.85, mv: 4, mev: 8, mavLow: 12, mavHigh: 20, mrv: 22, targetFrequency: 2, minRetrainH: 36 },
  front_delts: { id: 'front_delts', label: 'Front delts',       region: 'push', tauStructuralH: 26, tauMetabolicH: 10, slowTwitchPct: 45, eccentricSensitivity: 0.85, systemicShare: 0.40, mv: 0, mev: 0, mavLow: 0,  mavHigh: 6,  mrv: 12, targetFrequency: 2, minRetrainH: 24 },
  side_delts:  { id: 'side_delts',  label: 'Side delts',        region: 'push', tauStructuralH: 24, tauMetabolicH: 9,  slowTwitchPct: 45, eccentricSensitivity: 0.80, systemicShare: 0.35, mv: 4, mev: 6, mavLow: 12, mavHigh: 20, mrv: 26, targetFrequency: 3, minRetrainH: 20 },
  rear_delts:  { id: 'rear_delts',  label: 'Rear delts',        region: 'pull', tauStructuralH: 24, tauMetabolicH: 9,  slowTwitchPct: 50, eccentricSensitivity: 0.80, systemicShare: 0.30, mv: 0, mev: 6, mavLow: 10, mavHigh: 18, mrv: 24, targetFrequency: 3, minRetrainH: 20 },
  lats:        { id: 'lats',        label: 'Lats',              region: 'pull', tauStructuralH: 32, tauMetabolicH: 11, slowTwitchPct: 50, eccentricSensitivity: 1.00, systemicShare: 0.85, mv: 6, mev: 8, mavLow: 12, mavHigh: 20, mrv: 25, targetFrequency: 2, minRetrainH: 36 },
  upper_back:  { id: 'upper_back',  label: 'Upper back',        region: 'pull', tauStructuralH: 28, tauMetabolicH: 10, slowTwitchPct: 54, eccentricSensitivity: 0.90, systemicShare: 0.60, mv: 4, mev: 6, mavLow: 10, mavHigh: 16, mrv: 20, targetFrequency: 2, minRetrainH: 30 },
  traps:       { id: 'traps',       label: 'Traps',             region: 'pull', tauStructuralH: 26, tauMetabolicH: 10, slowTwitchPct: 54, eccentricSensitivity: 0.85, systemicShare: 0.45, mv: 0, mev: 4, mavLow: 8,  mavHigh: 16, mrv: 20, targetFrequency: 3, minRetrainH: 24 },
  lower_back:  { id: 'lower_back',  label: 'Lower back',        region: 'pull', tauStructuralH: 40, tauMetabolicH: 13, slowTwitchPct: 58, eccentricSensitivity: 1.15, systemicShare: 1.00, mv: 2, mev: 4, mavLow: 6,  mavHigh: 10, mrv: 12, targetFrequency: 2, minRetrainH: 48 },
  biceps:      { id: 'biceps',      label: 'Biceps',            region: 'arms', tauStructuralH: 30, tauMetabolicH: 10, slowTwitchPct: 45, eccentricSensitivity: 1.30, systemicShare: 0.25, mv: 4, mev: 6, mavLow: 10, mavHigh: 16, mrv: 20, targetFrequency: 2, minRetrainH: 30 },
  triceps:     { id: 'triceps',     label: 'Triceps',           region: 'arms', tauStructuralH: 28, tauMetabolicH: 10, slowTwitchPct: 33, eccentricSensitivity: 1.05, systemicShare: 0.30, mv: 4, mev: 4, mavLow: 8,  mavHigh: 14, mrv: 18, targetFrequency: 2, minRetrainH: 28 },
  forearms:    { id: 'forearms',    label: 'Forearms',          region: 'arms', tauStructuralH: 22, tauMetabolicH: 9,  slowTwitchPct: 55, eccentricSensitivity: 1.10, systemicShare: 0.15, mv: 2, mev: 4, mavLow: 6,  mavHigh: 12, mrv: 16, targetFrequency: 3, minRetrainH: 20 },
  abs:         { id: 'abs',         label: 'Abs',               region: 'core', tauStructuralH: 20, tauMetabolicH: 8,  slowTwitchPct: 55, eccentricSensitivity: 0.85, systemicShare: 0.20, mv: 0, mev: 0, mavLow: 6,  mavHigh: 16, mrv: 25, targetFrequency: 3, minRetrainH: 18 },
  obliques:    { id: 'obliques',    label: 'Obliques',          region: 'core', tauStructuralH: 22, tauMetabolicH: 8,  slowTwitchPct: 55, eccentricSensitivity: 0.90, systemicShare: 0.20, mv: 0, mev: 0, mavLow: 4,  mavHigh: 12, mrv: 20, targetFrequency: 3, minRetrainH: 18 },
  glutes:      { id: 'glutes',      label: 'Glutes',            region: 'legs', tauStructuralH: 34, tauMetabolicH: 12, slowTwitchPct: 52, eccentricSensitivity: 1.10, systemicShare: 0.95, mv: 0, mev: 4, mavLow: 8,  mavHigh: 16, mrv: 20, targetFrequency: 2, minRetrainH: 40 },
  quads:       { id: 'quads',       label: 'Quads',             region: 'legs', tauStructuralH: 34, tauMetabolicH: 12, slowTwitchPct: 42, eccentricSensitivity: 1.15, systemicShare: 1.00, mv: 6, mev: 8, mavLow: 12, mavHigh: 18, mrv: 20, targetFrequency: 2, minRetrainH: 40 },
  hamstrings:  { id: 'hamstrings',  label: 'Hamstrings',        region: 'legs', tauStructuralH: 38, tauMetabolicH: 12, slowTwitchPct: 48, eccentricSensitivity: 1.35, systemicShare: 0.85, mv: 3, mev: 4, mavLow: 8,  mavHigh: 14, mrv: 16, targetFrequency: 2, minRetrainH: 44 },
  adductors:   { id: 'adductors',   label: 'Adductors',         region: 'legs', tauStructuralH: 32, tauMetabolicH: 11, slowTwitchPct: 50, eccentricSensitivity: 1.15, systemicShare: 0.45, mv: 0, mev: 0, mavLow: 4,  mavHigh: 12, mrv: 16, targetFrequency: 2, minRetrainH: 36 },
  abductors:   { id: 'abductors',   label: 'Abductors',         region: 'legs', tauStructuralH: 26, tauMetabolicH: 10, slowTwitchPct: 55, eccentricSensitivity: 0.90, systemicShare: 0.25, mv: 0, mev: 0, mavLow: 4,  mavHigh: 12, mrv: 16, targetFrequency: 3, minRetrainH: 24 },
  calves:      { id: 'calves',      label: 'Calves',            region: 'legs', tauStructuralH: 20, tauMetabolicH: 8,  slowTwitchPct: 80, eccentricSensitivity: 0.75, systemicShare: 0.25, mv: 6, mev: 8, mavLow: 12, mavHigh: 16, mrv: 20, targetFrequency: 3, minRetrainH: 20 },
  tibialis:    { id: 'tibialis',    label: 'Tibialis anterior', region: 'legs', tauStructuralH: 20, tauMetabolicH: 8,  slowTwitchPct: 73, eccentricSensitivity: 0.85, systemicShare: 0.10, mv: 0, mev: 0, mavLow: 4,  mavHigh: 10, mrv: 14, targetFrequency: 3, minRetrainH: 18 },
  neck:        { id: 'neck',        label: 'Neck',              region: 'core', tauStructuralH: 22, tauMetabolicH: 8,  slowTwitchPct: 60, eccentricSensitivity: 0.85, systemicShare: 0.10, mv: 0, mev: 0, mavLow: 4,  mavHigh: 10, mrv: 14, targetFrequency: 3, minRetrainH: 20 },
};

/** Every muscle id, in declaration order. Stable: the UI body map relies on it. */
export const ALL_MUSCLES: readonly MuscleId[] = Object.keys(MUSCLES) as MuscleId[];

/** Type guard for muscle ids arriving from SQLite, sync or the exercise catalog. */
export function isMuscleId(value: string): value is MuscleId {
  return Object.prototype.hasOwnProperty.call(MUSCLES, value);
}

/**
 * Look up a muscle's constants. Total over `MuscleId`, so it never returns
 * undefined and callers need no non-null assertion.
 */
export function muscleConstants(muscle: MuscleId): MuscleConstants {
  return MUSCLES[muscle];
}

// ---------------------------------------------------------------------------
// 2. TWO-COMPARTMENT READINESS MODEL PARAMETERS
// ---------------------------------------------------------------------------

/**
 * Structural compartment weight in
 * readiness = 1 - (0.62*tanh(structural/4.8) + 0.38*tanh(metabolic/4.8)).
 * Structural damage dominates because force recovery, not metabolite clearance,
 * is what a lifter feels 24-48h later (PLOS One 2022 indirect-marker meta,
 * PMC9282447).
 */
export const W_STRUCTURAL = 0.62;

/** Metabolic compartment weight; see {@link W_STRUCTURAL}. */
export const W_METABOLIC = 0.38;

/**
 * tanh saturation scale, in Fatigue Units. The saturation is what keeps a brutal
 * session at ~15-20% readiness rather than going negative.
 */
export const FU_SCALE = 4.8;

/** Systemic saturation scale: whole-body load is additive across many muscles, so it saturates later. */
export const SYS_SCALE = 5.0;

/** Systemic fast-compartment time constant, HOURS (Banister-style two-component fit). */
export const TAU_SYSTEMIC_FAST_H = 16;

/** Systemic slow-compartment time constant, HOURS. */
export const TAU_SYSTEMIC_SLOW_H = 60;

/** Weight of the fast systemic compartment. */
export const W_SYS_FAST = 0.45;

/** Weight of the slow systemic compartment. */
export const W_SYS_SLOW = 0.55;

/**
 * Readiness chip status bands, in percent.
 * `readyFloor` is the target used by "hours to ready"; `deepFatigue` is the hard
 * block used by the recommender.
 */
export const READINESS_BANDS = {
  ready: 90,
  primed: 78,
  moderate: 62,
  fatigued: 42,
  /** At or above this, a muscle counts as recovered for "hours to ready" and the all-clear banner. */
  readyFloor: 85,
  /** Below this a muscle is DEEPLY fatigued and is never recommended for training. */
  deepFatigue: 42,
} as const;

/** Maximum horizon searched by "hours to ready", HOURS (7 days). */
export const HOURS_TO_READY_HORIZON_H = 168;

/**
 * Self-reported soreness: 0.04 readiness per point on a 0-3 scale, i.e. at most
 * -12 points. Soreness rises within 24h, peaks 24-72h and resolves in 5-7 days,
 * while force loss at 24-48h is the better damage marker (PLOS One 2022,
 * PMC9282447) — so soreness informs readiness but never sets it.
 */
export const SORENESS_PENALTY_PER_POINT = 0.04;

/** Soreness self-report scale maximum (0-3). */
export const SORENESS_MAX = 3;

// ---------------------------------------------------------------------------
// 3. SET TYPES
// ---------------------------------------------------------------------------

export type SetType = 'warmup' | 'normal' | 'failure' | 'drop' | 'myorep' | 'cluster' | 'backoff' | 'amrap';

export interface SetTypeConstants {
  /** Multiplier on the structural (damage) deposit. */
  structural: number;
  /** Multiplier on the metabolic deposit. */
  metabolic: number;
  /** Multiplier on the structural time constant: models curve ELONGATION, not just magnitude. */
  tauStretch: number;
  /** Assumed reps-in-reserve when the user logged none. */
  defaultRir: number;
  /** Credit toward weekly hard-set volume landmarks. Warm-ups earn zero. */
  volumeCredit: number;
}

/**
 * Set-type multipliers.
 *
 * - `warmup` 0.15/0.10 with ZERO volume credit. The single most important
 *   asymmetry in the model: four warm-up sets must never read as "trained"
 *   (research verification: a warm-up-only session leaves chest at 99%).
 * - `failure` gets BOTH a magnitude bump (1.18 structural) AND a tau stretch of
 *   1.30. Vieira's meta shows failure elongates the recovery time course by
 *   24-48h; Refalo 2023 (PMC9908800) measured velocity loss at 4 min of -25%
 *   (failure) / -13% (1-RIR) / -8% (3-RIR). Magnitude alone cannot reproduce an
 *   elongation, which is why the time constant is stretched too.
 * - `drop` is a METABOLIC cost, not a structural one: Havers 2026 meta
 *   (PMC13043944, 12 studies, 274 participants) found RPE SMD 1.62 and blood
 *   lactate SMD 0.67 versus traditional sets with equal hypertrophy. Hence
 *   metabolic 1.85 but structural only 1.15, with per-drop structural
 *   attenuation of 0.45^n applied in `fatigue.ts`.
 * - `cluster` has intra-set rest that clears metabolites: high tension, LOW
 *   metabolic cost.
 */
export const SET_TYPE: Record<SetType, SetTypeConstants> = {
  warmup:  { structural: 0.15, metabolic: 0.10, tauStretch: 1.00, defaultRir: 6, volumeCredit: 0.00 },
  normal:  { structural: 1.00, metabolic: 1.00, tauStretch: 1.00, defaultRir: 2, volumeCredit: 1.00 },
  backoff: { structural: 0.85, metabolic: 1.05, tauStretch: 1.00, defaultRir: 2, volumeCredit: 1.00 },
  amrap:   { structural: 1.15, metabolic: 1.30, tauStretch: 1.25, defaultRir: 0, volumeCredit: 1.00 },
  failure: { structural: 1.18, metabolic: 1.35, tauStretch: 1.30, defaultRir: 0, volumeCredit: 1.00 },
  drop:    { structural: 1.15, metabolic: 1.85, tauStretch: 1.22, defaultRir: 0, volumeCredit: 1.50 },
  myorep:  { structural: 1.20, metabolic: 1.70, tauStretch: 1.20, defaultRir: 0, volumeCredit: 1.50 },
  cluster: { structural: 1.05, metabolic: 0.75, tauStretch: 1.05, defaultRir: 1, volumeCredit: 1.25 },
};

/** Per-drop structural attenuation base: mechanical tension collapses as the weight drops (0.45^n). */
export const DROP_STRUCTURAL_ATTENUATION = 0.45;

/** Per-drop metabolic attenuation base: metabolite accumulation does NOT collapse (0.85^n). */
export const DROP_METABOLIC_ATTENUATION = 0.85;

// ---------------------------------------------------------------------------
// 4. FATIGUE ACCRUAL PARAMETERS
// ---------------------------------------------------------------------------

/** The 1.0-Fatigue-Unit reference set: 8 reps at 75% e1RM, RIR 1, contribution 1.0. */
export const REFERENCE_SET = { relIntensity: 0.75, reps: 8, rir: 1 } as const;

/** Loaded-stretch index of the reference movement (a typical barbell compound). */
export const REFERENCE_STRETCH_INDEX = 1.20;

/**
 * Mechanical-tension curve: 0.42 + 0.78*relIntensity, clamped to [0.42, 1.24]
 * over relative intensities [0.15, 1.05]. Rises with load and saturates, because
 * motor-unit recruitment is near complete by ~80-85% of 1RM and the last reps
 * before failure are maximal anyway.
 */
export const TENSION = { base: 0.42, gain: 0.78, relMin: 0.15, relMax: 1.05 } as const;

/**
 * Effort curve exp(-0.25 * RIR): RIR 0 = 1.00, 1 = 0.78, 2 = 0.61, 3 = 0.47,
 * 4 = 0.37, 5 = 0.29, 6 = 0.22. Matches the strongly non-linear fatigue-vs-RIR
 * pattern in Refalo 2023 (failure -25% velocity at 4 min, 1-RIR -13%, 3-RIR -8%).
 */
export const EFFORT_DECAY_PER_RIR = 0.25;

/** Structural deposit exponents: tension^1.8 * reps^0.55 * effort. */
export const STRUCTURAL_EXPONENTS = { tension: 1.8, reps: 0.55 } as const;

/** Metabolic deposit exponents: tension^0.6 * reps^0.95 * effort^1.2. */
export const METABOLIC_EXPONENTS = { tension: 0.6, reps: 0.95, effort: 1.2 } as const;

/**
 * Eccentric tempo term: 1 + 0.11*(eccentricSeconds - 2), clamped to [0.80, 1.75].
 * Damage scales with eccentric time under tension; 2s is the reference tempo.
 */
export const ECCENTRIC_TEMPO = { perSecond: 0.11, referenceSec: 2, min: 0.80, max: 1.75 } as const;

/**
 * Fibre-type modifiers from the Johnson 1973 distributions.
 * Structural: 1 + 0.006*(50 - slowTwitchPct) — triceps (33%) => 1.10, soleus (80%) => 0.82.
 * Metabolic:  1 - 0.004*(slowTwitchPct - 50) — triceps => 1.07, soleus => 0.88.
 * Type-II fibres take more structural damage per unit tension; type-I fibres are
 * markedly more fatigue-resistant metabolically.
 */
export const FIBER_MODIFIER = { structuralPerPct: 0.006, metabolicPerPct: 0.004, pivotPct: 50 } as const;

/**
 * Systemic deposit coefficient: calibrates a heavy back-squat set to ~1.0
 * systemic unit and a cable fly to ~0.05 (Israetel's stimulus-to-fatigue ratio).
 * Applied as SYSTEMIC_COEFFICIENT * (0.35 + 0.95*axialLoad) * spill / max(0.5, sfr).
 */
export const SYSTEMIC_COEFFICIENT = 0.22;

/** Axial-load term of the systemic deposit: 0.35 + 0.95*axialLoad. */
export const SYSTEMIC_AXIAL = { base: 0.35, gain: 0.95, minSfr: 0.5 } as const;

/** The slow systemic compartment receives 55% of the fast deposit. */
export const SYSTEMIC_SLOW_SHARE = 0.55;

/**
 * Repeated-bout effect (Nosaka & Clarkson, PMID 12641640): a single eccentric
 * bout protects for up to ~24 weeks, largest at the first re-exposure, and the
 * effect saturates in already resistance-trained men (PMC2783719).
 *
 * Modelled as two NON-multiplied terms: muscle familiarity 1 + 0.60*(1-fam) and
 * movement novelty 1 + 0.35*novelty*fam. Scaling novelty BY familiarity prevents
 * double-counting — for an unadapted muscle the familiarity term already covers
 * the damage, and it stops a beginner's first cable fly from reading as a 2.5x
 * fatigue event.
 */
export const RBE = {
  familiarityGain: 0.60,
  noveltyGain: 0.35,
  /** Familiarity assumed when the caller supplies none. */
  defaultFamiliarity: 0.15,
  /** No novelty penalty within this many days of the last exposure to the movement. */
  noveltyGraceDays: 14,
  /** Movement counts as fully novel again after this many days without it. */
  noveltyFullDays: 84,
} as const;

/** The last ~5 reps before failure are the stimulating ones (RP heuristic). */
export const STIMULATING_REP_WINDOW = 5;

// ---------------------------------------------------------------------------
// 5. LIFESTYLE -> RECOVERY RATE
// ---------------------------------------------------------------------------

/**
 * Sleep debt and stress slow the physiology rather than docking peak strength.
 * Craven 2022 (PMID 35708888, 227 outcomes from 69 publications): acute sleep
 * loss costs only -0.30% on STRENGTH (95% CI -0.59..0.01) but -7.56% on overall
 * physical performance — i.e. work capacity and repeated efforts, which is a
 * slower-recovery effect. So sleep debt adds +5.5% per hour to EVERY recovery
 * time constant here, and only -3.0%/hour to the capacity score.
 */
export const TAU_SCALE = {
  perSleepDebtHour: 0.055,
  perStressPoint: 0.05,
  /** Applied as 0.12 * |energyBalance| while in an energy deficit. */
  perEnergyDeficit: 0.12,
  /** Nights of sleep counted toward debt (most recent first). */
  sleepWindowNights: 3,
  defaultSleepNeedH: 8,
  /** Neutral point of the 1..5 subjective stress scale. */
  neutralStress: 3,
  min: 1.0,
  max: 1.55,
} as const;

// ---------------------------------------------------------------------------
// 6. DAILY CAPACITY SCORE
// ---------------------------------------------------------------------------

/**
 * Base capacity = 100 * (0.50*systemic + 0.35*muscular + 0.15*ramp), computed
 * purely from the training log. With no recent training all three terms are 1.0,
 * so 100/100 while sleep and resting HR read "Not connected" is the correct
 * answer, not a placeholder.
 */
export const CAPACITY_WEIGHTS = { systemic: 0.50, muscular: 0.35, ramp: 0.15 } as const;

/**
 * Wearable and subjective inputs are BOUNDED MULTIPLICATIVE modifiers, never
 * additive terms, so a missing sensor cannot silently move the score.
 *  - HRV: 1 + 0.055*z on the Ln rMSSD z-score, clamp [0.80, 1.08]. A 2-SD bad
 *    day costs ~11 points, never more than 20 (Plews/Kiviniemi; Javaloyes 2018,
 *    PMID 29809080 — the only decent RCT evidence for HRV-guided prescription).
 *  - RHR: -3.5% per bpm above the user's OWN baseline, clamp [0.82, 1.05].
 *  - Sleep: -3.0% per hour of 3-night debt, clamp [0.80, 1.03] (Craven 2022).
 *  - Subjective: -3.5% per point of stress above neutral, clamp [0.88, 1.04].
 */
export const CAPACITY_MODIFIERS = {
  hrv: { perZ: 0.055, min: 0.80, max: 1.08 },
  rhr: { perBpm: 0.035, min: 0.82, max: 1.05 },
  sleep: { perDebtHour: 0.030, min: 0.80, max: 1.03 },
  subjective: { perStressPoint: 0.035, min: 0.88, max: 1.04 },
} as const;

/** Minimum SD used when z-scoring Ln rMSSD, so a flat baseline cannot explode the modifier. */
export const LN_RMSSD_MIN_SD = 0.05;

export type Confidence = 'low' | 'moderate' | 'good' | 'high';

/**
 * Confidence ladder. The score starts at 0.45 from the training log alone and
 * climbs as inputs connect. It is reported explicitly because NO consumer
 * recovery algorithm (Whoop, Oura, Garmin) has published RCT evidence that its
 * score beats simply asking the user how they feel — which is exactly why a
 * cheap subjective check-in is worth +0.08 and should be offered before pushing
 * hardware.
 */
export const CONFIDENCE_WEIGHTS = {
  logOnly: 0.45,
  hrv: 0.30,
  rhr: 0.12,
  sleep: 0.10,
  subjective: 0.08,
} as const;

/** Confidence label thresholds on the 0..1 confidence value. */
export const CONFIDENCE_BANDS = { high: 0.85, good: 0.68, moderate: 0.55 } as const;

/** Confidence reported before enough sessions exist to say anything. */
export const COLD_START_CONFIDENCE = 0.25;

/** Sessions that must be logged before the readiness numbers go live. */
export const COLD_START_SESSIONS = 2;

/** Capacity-score copy thresholds (headline/subline bands). */
export const CAPACITY_COPY_BANDS = { goodToGo: 88, readyToTrain: 62, trainLight: 55, recoveryDay: 38 } as const;

// ---------------------------------------------------------------------------
// 7. LOAD MODEL / ACWR
// ---------------------------------------------------------------------------

/**
 * TrainingPeaks Performance Manager: CTL = 42-day EWMA of daily load,
 * ATL = 7-day EWMA, TSB = CTL - ATL (Banister impulse-response; Coggan).
 * These day-scale constants are the SYSTEMIC layer only — per-muscle EIMD needs
 * the hour-scale constants above, which is why the model is two-layer.
 */
export const CTL_TAU_DAYS = 42;

/** Acute training load EWMA time constant, DAYS. */
export const ATL_TAU_DAYS = 7;

/**
 * ACWR is computed UNCOUPLED (last 7 days vs the PRIOR 21 days, non-overlapping)
 * because Lolli 2019 showed the conventional coupled ratio is mathematically
 * coupled and produces spurious correlation, and Impellizzeri 2020 (IJSPP
 * 15(6):907-13) showed the ratio magnifies the acute-load effect without adding
 * predictive value. Gabbett 2016's 0.8-1.3 "sweet spot" is used only as a soft
 * ramp modifier weighted at 15% of the score, and is NEVER presented as injury
 * risk.
 */
export const ACWR = {
  acuteDays: 7,
  chronicDays: 21,
  sweetSpotLow: 0.8,
  sweetSpotHigh: 1.3,
  /** Credit lost per unit of ACWR above the sweet spot. */
  taperPerUnitAbove: 0.32,
  floor: 0.70,
  /** Undertrained side: gentle taper, base 0.88 + 0.15*acwr, never below 0.85. */
  underBase: 0.88,
  underGain: 0.15,
  underFloor: 0.85,
} as const;

/** 1 Fatigue Unit is about 11 sRPE arbitrary-units x minutes at a 60-minute session. */
export const FU_TO_SESSION_LOAD = 11;

// ---------------------------------------------------------------------------
// 8. RECOMMENDER
// ---------------------------------------------------------------------------

/**
 * Recommender term parameters.
 *  - readiness is raised to 1.6: training a 55% muscle is much worse than an 85% one.
 *  - staleness peaks at 1.9*tauStructural, capped by the muscle's target frequency
 *    (Schoenfeld/Grgic/Krieger 2019, PMID 30558493: volume-equated frequencies of
 *    1-6x/week give similar hypertrophy, so enforce at least 2x for majors, cap
 *    per-session per-muscle volume, and otherwise defer to the user's own habit).
 *  - habit is weighted 0.55 + 0.75*affinity, i.e. the user's split outranks a
 *    theoretically optimal one.
 */
export const RECOMMENDER = {
  readinessExponent: 1.6,
  volumeOverMrv: 0.08,
  volumeAtTarget: 0.30,
  volumeBase: 0.35,
  volumeGain: 0.65,
  volumeDeficitFloor: 2,
  stalenessBase: 0.35,
  stalenessGain: 0.85,
  stalenessPeakTauMultiple: 1.9,
  stalenessSigmaFraction: 0.75,
  /** Never-trained muscles are treated as 1.4x their ideal interval stale. */
  stalenessNeverTrainedMultiple: 1.4,
  habitBase: 0.55,
  habitGain: 0.75,
  defaultWeekdayAffinity: 0.4,
  /** Per-session cap on hard sets for one muscle: above ~15 session sets, splitting wins. */
  maxSetsPerSession: 12,
  /** Capacity thresholds for the session intensity guidance. */
  intensity: { full: 80, moderate: 62, light: 45 },
  /** Muscles listed on the recommendation card. */
  maxMusclesListed: 8,
} as const;

/**
 * Fatigue deposited by the SIMULATED session used to project "tomorrow":
 * a median hard block on one muscle, ~3.2 FU structural / 2.6 FU metabolic,
 * roughly three working sets at the reference intensity.
 */
export const SIMULATED_SESSION_DEPOSIT = {
  structural: 3.2,
  metabolic: 2.6,
  systemicFast: 1.4,
  systemicSlow: 0.8,
} as const;

/** Mesocycle: weeks of accumulation before the deload week. */
export const DEFAULT_BLOCK_LENGTH_WEEKS = 5;

/** Fraction of the MEV -> MRV range the weekly target ramps across during accumulation. */
export const MESO_RAMP_FRACTION = 0.85;

// ---------------------------------------------------------------------------
// 9. COLD START
// ---------------------------------------------------------------------------

export type ExperienceLevel = 'never' | 'beginner' | 'intermediate' | 'advanced';

/**
 * Day-0 priors. Untrained lifters take dramatically more damage from the same
 * relative work and stay sore longer (Damas 2015, PMID 25739559: early-training
 * MPS is dominated by damage repair), so tau is lengthened and familiarity is
 * low — both pulled toward truth by `updateCalibration` as real data arrives.
 */
export const COLD_START_PRIORS: Record<ExperienceLevel, { familiarity: number; tauMultiplier: number }> = {
  never:        { familiarity: 0.05, tauMultiplier: 1.30 },
  beginner:     { familiarity: 0.20, tauMultiplier: 1.18 },
  intermediate: { familiarity: 0.55, tauMultiplier: 1.02 },
  advanced:     { familiarity: 0.85, tauMultiplier: 0.94 },
};

/**
 * Online personalisation: shrink the per-muscle tau multiplier toward the
 * population prior with k=6 pseudo-observations, step exp(0.10*residual),
 * clamped to [0.6, 1.6]. residual > 0 means the user was MORE fatigued than
 * predicted, so tau lengthens.
 */
export const CALIBRATION = {
  priorTauMultiplier: 1.0,
  shrinkagePseudoObservations: 6,
  stepPerResidual: 0.10,
  minTauMultiplier: 0.6,
  maxTauMultiplier: 1.6,
  /** Familiarity closes ~12% of the remaining gap per exposure. */
  familiarityGainPerExposure: 0.12,
  /** Familiarity decay time constant, DAYS (the RBE is detectable up to ~24 weeks). */
  familiarityDecayDays: 120,
} as const;
