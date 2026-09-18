/**
 * Volume equivalents — the Finish-screen payoff: "18,420 kg. That is 3.4 African
 * elephants, or 38 concert grand pianos."
 *
 * - `catalog`  — 139 verified real-world masses, 1 kg to 5.9 Mt, in KILOGRAMS.
 * - `select`   — scoring and greedy pick, counts landing in the 1.5–40x window.
 * - `variety`  — deterministic cooldown and rotation. No RNG, ever.
 * - `framings` — bar travel, mechanical work, time under tension, bodyweight multiples.
 * - `copy`     — phrasing and the tone lint.
 *
 * Source: docs/research/stronger-2-0-volume-equivalents-system-finish-scre.md.
 * Pure TypeScript: no react / react-native / expo imports.
 */

export {
  MASS_EQUIVALENTS,
  MILESTONE_EQUIVALENTS,
  MILESTONE_THRESHOLD_KG,
  PICKABLE_EQUIVALENTS,
  countOf,
  getEquivalent,
  isMilestone,
  type Confidence,
  type EquivCategory,
  type MassEquivalent,
} from './catalog';

export {
  IDEAL_COUNT,
  MAX_COUNT,
  MIN_COUNT,
  WHOLE_HI,
  WHOLE_LO,
  countScore,
  displayCount,
  nextMilestone,
  pickEquivalents,
  roundness,
  spectacleWeight,
  type Comparison,
  type MilestoneProgress,
  type PickOptions,
} from './select';

export {
  COOLDOWN_SPAN,
  HISTORY_DEPTH,
  PHI_INV,
  appendShown,
  cooldownPenalty,
  hash32,
  recentIds,
  rotation,
  sessionIndexFromEpochMs,
  type ShownRecord,
} from './variety';

export {
  DEFAULT_ROM_M,
  DEFAULT_TEMPO_SEC,
  ECCENTRIC_FACTOR,
  FOOD_KCAL,
  G,
  GROSS_EFFICIENCY,
  HEIGHTS_M,
  MIN_BAR_DISTANCE_M,
  REFERENCE_HEIGHT_CM,
  ROM_BY_PATTERN,
  STEP_COUNTS,
  STEP_RISE_M,
  barDistanceM,
  bodyweightMultiples,
  climbsOf,
  estimatedKcal,
  heightClimbedM,
  mechanicalWorkJ,
  pickFoodComparison,
  pickHeightComparison,
  romForPattern,
  tensionRatio,
  timeUnderTensionSec,
  type FoodEquivalent,
  type FramingSet,
  type HeightComparison,
  type HeightLandmark,
  type StepClimb,
} from './framings';

export {
  HERO_TEMPLATES,
  assertCleanCopy,
  barTravelLine,
  bodyweightLine,
  climbLine,
  comparisonSentence,
  formatCount,
  formatDuration,
  formatKg,
  formatNumber,
  funAside,
  heroLine,
  isHedged,
  lintCopy,
  milestoneLine,
  phrase,
  templateFor,
  tensionLine,
  workLine,
} from './copy';
