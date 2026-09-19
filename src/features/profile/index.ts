/**
 * Profile feature: the derived-stats snapshot and the achievement catalogue.
 *
 * Both are pure over `CompletedWorkout[]` — no React, no store access — so the
 * Profile tab can compute them inside a single `useMemo` and so they can be
 * unit-tested without mounting anything.
 */

export {
  computeProfileStats,
  startOfDay,
  startOfWeek,
  EMPTY_STATS,
  type BestLift,
  type ProfileStats,
  type SessionMark,
  type StatsInput,
  type WeekBucket,
} from './stats';

export {
  BADGES,
  BADGE_CATEGORIES,
  CATEGORY_LABEL,
  RARITY_LABEL,
  RARITY_ORDER,
  evaluateBadges,
  progressLabel,
  type BadgeCategory,
  type BadgeDef,
  type BadgeUnit,
  type EvaluatedBadge,
  type Rarity,
} from './badges';
