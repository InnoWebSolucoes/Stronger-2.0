/**
 * Stronger 2.0 — muscle readiness engine.
 *
 * Per-muscle recovery chips, the 0-100 daily capacity score, and the
 * train-today / train-tomorrow recommender. Pure TypeScript: no react,
 * react-native or expo imports, and no clock — every entry point takes the
 * current instant (unix ms) as an argument so the caller owns time and tests can
 * control it.
 *
 * Typical wiring:
 *
 *   const ctx = { ...coldStartAccrualContext(calibration), e1rmByExerciseKg,
 *                 lastPerformedAt, tauScale: recoveryTauScale(lifestyle) };
 *   const { deposits, systemic } = accrueSets(sessionSets, ctx);
 *   const state = appendDeposits(previousState, deposits, systemic);
 *   const chips = allMuscleReadiness(state, now, lifestyle);
 *   const capacity = coldStartCapacity(calibration) ?? capacityScore(state, now, dailyLoads, lifestyle);
 *   const { today, tomorrow } = recommend({ state, now, weekSets, split, dailyLoads });
 *
 * All weights are KG, the canonical storage unit; nothing here converts units.
 * Model provenance and citations live in
 * `docs/research/muscle-readiness-recovery-model-for-stronger-2-0-p.md`.
 */

export {
  ACWR,
  ALL_MUSCLES,
  ATL_TAU_DAYS,
  CALIBRATION,
  CAPACITY_MODIFIERS,
  CAPACITY_WEIGHTS,
  COLD_START_PRIORS,
  COLD_START_SESSIONS,
  CONFIDENCE_BANDS,
  CONFIDENCE_WEIGHTS,
  CTL_TAU_DAYS,
  DROP_METABOLIC_ATTENUATION,
  DROP_STRUCTURAL_ATTENUATION,
  FU_SCALE,
  MS_PER_DAY,
  MS_PER_HOUR,
  MUSCLES,
  RBE,
  READINESS_BANDS,
  READINESS_MODEL_VERSION,
  RECOMMENDER,
  SET_TYPE,
  SYS_SCALE,
  TAU_SCALE,
  TAU_SYSTEMIC_FAST_H,
  TAU_SYSTEMIC_SLOW_H,
  W_METABOLIC,
  W_STRUCTURAL,
  W_SYS_FAST,
  W_SYS_SLOW,
  clamp,
  isMuscleId,
  muscleConstants,
  type Confidence,
  type ExperienceLevel,
  type MuscleConstants,
  type MuscleId,
  type MuscleRegion,
  type SetType,
  type SetTypeConstants,
} from './constants';

export {
  REFERENCE_EXERCISE_PROFILES,
  accrueSet,
  accrueSets,
  brzyckiKg,
  effortTerm,
  epleyKg,
  estimateE1rmKg,
  referenceProfile,
  rirFromRpe,
  tensionTerm,
  type AccrualContext,
  type DropSegment,
  type ExerciseFatigueProfile,
  type FatigueDeposit,
  type LoggedSet,
  type SetFatigueResult,
  type SetWithProfile,
  type SystemicDeposit,
} from './fatigue';

export {
  allMuscleReadiness,
  appendDeposits,
  decayDeposit,
  decayFatigue,
  decayMuscleFatigue,
  emptyReadinessState,
  fatigueDeficit,
  muscleFatigueAt,
  pruneState,
  readinessForMuscle,
  readinessFraction,
  readinessStatus,
  recoveryTauScale,
  snapshotFatigue,
  systemicFatigue,
  type LifestyleInputs,
  type MuscleFatigue,
  type MuscleFatigueSnapshot,
  type MuscleReadiness,
  type ReadinessState,
  type ReadinessStatus,
} from './recovery';

export {
  allMusclesReadyBanner,
  capacityCopy,
  capacityScore,
  deeplyFatiguedMuscles,
  ewma,
  loadModel,
  muscularComponent,
  rampTerm,
  recoveringMuscles,
  sessionLoad,
  type CapacityDriver,
  type CapacityScore,
  type LoadModel,
} from './capacity';

export {
  isoDateOf,
  recommend,
  recommendForInstant,
  scoreMuscleForToday,
  volumeZone,
  weekdayOf,
  weeklyTarget,
  type BlockReason,
  type BlockedMuscle,
  type IntensityGuidance,
  type Recommendation,
  type RecommendInput,
  type ScoredMuscle,
  type SessionTemplate,
  type SplitProfile,
  type VolumeZone,
  type WeeklyVolume,
} from './recommend';

export {
  coldStart,
  coldStartAccrualContext,
  coldStartCapacity,
  coldStartReadiness,
  isColdStart,
  recordSession,
  updateCalibration,
  updateFamiliarity,
  withUpdatedFamiliarity,
  type ColdStartReadiness,
  type UserCalibration,
} from './cold-start';
