/**
 * `@core/scoring` — the lifting math every screen in Stronger 2.0 reads from.
 *
 * Pure TypeScript: no `react`, no `react-native`, no `expo-*`, no clock, no
 * storage, no randomness. Anything platform-shaped (the current time, the
 * lifter's bodyweight, their gym's plate inventory) arrives as a parameter.
 *
 * Unit contract: every weight is KILOGRAMS. `units.ts` converts, once, at the
 * display edge, and never round-trips a stored value.
 *
 *   units.ts         kg/lb conversion, drift-free display, equipment increments
 *   e1rm.ts          seven classical equations, the weight-dependent equation,
 *                    the RTS RPE/RIR curve, and the recommended blend
 *   volume.ts        volume load for every tracking type, honestly
 *   session-best.ts  the trustworthy e1RM from a session of many sets
 *   pr.ts            personal record detection with anti-spam rules
 *   plates.ts        plate solver and equipment rounding
 *   stats.ts         median, MAD, weighted quantile
 *   types.ts         shared set/equipment types
 */

export type { SetType, LoggedSet, EquipmentKind } from './types';

export { median, medianAbsoluteDeviation, weightedQuantile, sum, round3 } from './stats';

export {
  LB_TO_KG,
  KG_TO_LB,
  lbToKg,
  kgToLb,
  convert,
  fromInput,
  fromKg,
  DISPLAY_STEP,
  roundTo,
  toDisplay,
  formatWeight,
  formatVolume,
  EQUIPMENT_INCREMENT_KG,
  EQUIPMENT_INCREMENT_LB,
  equipmentIncrement,
  roundToEquipmentIncrement,
} from './units';
export type { Unit, Weight, RoundingBias } from './units';

export {
  epley,
  epleyUnguarded,
  brzycki,
  lander,
  lombardi,
  mayhew,
  oconner,
  wathan,
  weightDependent,
  e1rmWithK,
  wdK,
  blendedE1rm,
  rtsBlendWeight,
  rtsPercent,
  rtsPercentForRepsToFailure,
  rtsE1rm,
  buildRpeChart,
  rpeToRir,
  rirToRpe,
  resolveRir,
  estimateSetE1rm,
  percentOf1rm,
  personalisedRirPrior,
  repConfidencePenalty,
  calibrateK,
  E1RM_FORMULAS,
  E1RM_FORMULA_META,
  RTS_PCT_BY_REPS_TO_FAILURE,
  RTS_MAX_REPS_TO_FAILURE,
  DEFAULT_RIR_PRIOR,
  RIR_SOURCE_CONFIDENCE,
  E1RM_MAX_REPS,
  E1RM_MAX_RIR,
  WD_ALPHA,
  WD_A,
  WD_B,
  WD_K_MIN,
  BRZYCKI_POLE_REPS,
  LANDER_POLE_REPS,
  RPE_MIN,
  RPE_MAX,
  RIR_MIN,
  BLEND_FLOOR_KG,
  BLEND_MAX_RTS_WEIGHT,
  CALIBRATION_MIN_SETS,
  CALIBRATION_RECOMMENDED_SETS,
} from './e1rm';
export type {
  E1rmFormulaId,
  E1rmFormulaFn,
  E1rmFormulaMeta,
  E1rmSample,
  EstimateSetOptions,
  ResolvedRir,
  RirSource,
  KCalibration,
} from './e1rm';

export {
  repLoadKg,
  externalRepLoadKg,
  repsCredited,
  setVolumeKg,
  setExternalVolumeKg,
  computeVolume,
  mergeVolume,
  emptyVolumeBreakdown,
  carryVolumeKg,
  relativeVolume,
  intensityWeightedVolumeKg,
  bodyweightFactorFor,
  BODYWEIGHT_FACTORS,
  HARD_SET_RIR_CUTOFF,
  CARRY_METRES_PER_REP_EQUIVALENT,
} from './volume';
export type { LoadModel, ExerciseLoadSpec, VolumeContext, VolumeBreakdown } from './volume';

export {
  sessionBest,
  sessionBestE1rm,
  sessionBestsByExercise,
  SESSION_BEST_QUANTILE,
  MIN_SAMPLE_CONFIDENCE,
  TRUSTED_SAMPLE_CONFIDENCE,
} from './session-best';
export type { SessionBest } from './session-best';

export {
  detectPrs,
  prKey,
  bestExistingByKey,
  snapWeightKey,
  isRepMaxLadderRep,
  buildExercisePrCandidates,
  buildSessionPrCandidates,
  PR_RULES,
  PR_VALUE_UNIT,
  REP_MAX_LADDER,
} from './pr';
export type {
  PrType,
  PrRecord,
  PrCandidate,
  PrAward,
  PrRuleOverrides,
  PrSetInput,
  ExercisePrInput,
  SessionPrInput,
} from './pr';

export {
  solvePlates,
  nearestPlateSolution,
  nextLoadableAbove,
  maxLoadableKg,
  smallestIncrementKg,
  roundToEquipment,
  formatPerSide,
  DEFAULT_KG_PLATES,
  COMMERCIAL_KG_PLATES,
  DEFAULT_LB_PLATES,
  DEFAULT_LB_PLATES_KG,
  LB_BAR_KG,
  BAR_WEIGHTS_KG,
  DEFAULT_DUMBBELL_RACK_KG,
} from './plates';
export type { EquipmentProfile, PlateSolution, PlatePair } from './plates';
