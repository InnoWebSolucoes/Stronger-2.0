/**
 * The Exercise record and its supporting types.
 *
 * Sources:
 *  - Identity, variants, tracking types, set types, standards proxying:
 *    docs/research/exercise-taxonomy-muscle-equipment-pattern-models-.md,
 *    PARTS D, F, G and H.
 *  - Media licensing model: docs/research/
 *    exercise-data-and-demonstration-media-sources-for-.md, PART 1 and the
 *    "NEVER" list in PART 4.
 *
 * Two structural guarantees are worth calling out because they are the point of
 * this file:
 *
 *  1. IDENTITY. `id` is a frozen slug (AGENTS.md: "Exercise IDs are stable
 *     slugs, never array indices or generated UUIDs, so user history survives
 *     exercise-database updates"). The slug is ALSO derivable from the record's
 *     components, and the test suite asserts `id === deriveSlug(components)`
 *     for every catalog row. So a component edit that would silently rename an
 *     exercise fails CI and must be done as an explicit merge instead.
 *
 *  2. LICENSING. `ExerciseMedia.licence` is typed `ShippableLicence`, a union in
 *     which `redistributable` is the literal `true` and a human `review` stamp
 *     is required. An asset of unknown provenance is a `BlockedLicence`, which
 *     is not assignable to that field: shipping it is a type error, not a
 *     runtime check someone forgot to write.
 *
 * Pure TypeScript. No platform imports.
 */

import type { ArchetypeId, FatigueParams } from './archetypes';
import type { EquipmentId, CableAttachment } from './equipment';
import type { GroupWeights, MuscleGroupId, MuscleId } from './muscles';
import type { ForceType, LimbMode, Mechanic, MovementPattern } from './patterns';

// ─────────────────────────────────────────────────────────────────────────────
// Identity
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stable exercise identity. A lowercase kebab slug derived from the record's
 * components, frozen at creation and NEVER recomputed for an existing row.
 * This is the only value user history stores.
 */
export type ExerciseId = string;

/** A movement family id, e.g. `bench_press`. Shared by every equipment variant. */
export type MovementId = string;

/** Id of a demo animation asset. One asset is shared across a movement family. */
export type DemoAssetId = string;

/**
 * Variant keys. Sorted and joined they form the `variantSignature` half of the
 * uniqueness tuple (movement, equipment, loadMode, variantSignature).
 * Source: research PART F/G and the taxonomy.ts sketch in PART H.
 */
export type VariantKey =
  // grip
  | 'close_grip'
  | 'wide_grip'
  | 'neutral_grip'
  | 'reverse_grip'
  | 'supinated'
  | 'pronated'
  | 'mixed_grip'
  | 'false_grip'
  | 'behind_the_neck'
  // position / angle
  | 'incline'
  | 'decline'
  | 'flat'
  | 'seated'
  | 'standing'
  | 'lying'
  | 'prone'
  | 'kneeling'
  | 'bent_over'
  | 'chest_supported'
  | 'overhead'
  // stance
  | 'sumo'
  | 'conventional'
  | 'narrow_stance'
  | 'wide_stance'
  | 'staggered'
  | 'b_stance'
  | 'split'
  | 'deficit'
  | 'elevated_heels'
  // limb
  | 'single_arm'
  | 'single_leg'
  | 'alternating'
  // rom
  | 'paused'
  | 'pin'
  | 'board'
  | 'floor'
  | 'partial'
  | 'lengthened_partial'
  | 'one_and_a_half';

/**
 * How bodyweight participates in the load. Part of the uniqueness tuple because
 * Pull Up, Weighted Pull Up and Assisted Pull Up are three different input
 * schemas and therefore three catalog rows.
 * Source: research PART E, E1 test 4.
 */
export type LoadMode = 'none' | 'weighted' | 'assisted' | 'banded';

// ─────────────────────────────────────────────────────────────────────────────
// Tracking and set types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The 10 tracking types: Hevy's 8, plus `reps_only` and `distance_only`.
 * Determines which columns the set-log row renders and how volume is computed.
 * Source: research PART D, D4.
 */
export type TrackingType =
  | 'weight_reps'
  | 'bodyweight_reps'
  | 'weighted_bodyweight'
  | 'assisted_bodyweight'
  | 'reps_only'
  | 'duration'
  | 'duration_weight'
  | 'distance_duration'
  | 'weight_distance'
  | 'distance_only';

/** All 10 tracking types. */
export const TRACKING_TYPES: readonly TrackingType[] = [
  'weight_reps',
  'bodyweight_reps',
  'weighted_bodyweight',
  'assisted_bodyweight',
  'reps_only',
  'duration',
  'duration_weight',
  'distance_duration',
  'weight_distance',
  'distance_only',
] as const;

/**
 * The 7 set types. Hevy ships 4 (normal, warm-up, drop, failure); we add
 * myo_rep, rest_pause and partial.
 *
 * Volume and analytics rules, from research PART D, D6:
 *  - `warm_up` is EXCLUDED from volume, PR detection, e1RM and readiness fatigue
 *  - `drop`, `rest_pause` and `myo_rep` count toward volume but are flagged so
 *    e1RM is computed from the first sub-set only
 *  - `failure` pins RIR = 0
 *  - `partial` carries a `romPct` (default 60) and is volume-discounted by it
 */
export type SetType = 'normal' | 'warm_up' | 'drop' | 'failure' | 'myo_rep' | 'rest_pause' | 'partial';

/** All 7 set types. */
export const SET_TYPES: readonly SetType[] = [
  'normal',
  'warm_up',
  'drop',
  'failure',
  'myo_rep',
  'rest_pause',
  'partial',
] as const;

/** Default range-of-motion percentage for a `partial` set. Source: PART D, D6. */
export const DEFAULT_PARTIAL_ROM_PCT = 60;

// ─────────────────────────────────────────────────────────────────────────────
// Media licensing — the gate
// ─────────────────────────────────────────────────────────────────────────────

/** ISO-8601 date string, e.g. `2026-09-18`. */
export type IsoDate = string;

/**
 * Proof that a human looked at this asset's provenance and signed off.
 * Required on every shippable licence; there is no way to construct one without
 * it, which is the whole point.
 */
export interface LicenceReview {
  /** ISO date the review happened. */
  readonly reviewedAt: IsoDate;
  /** Who signed off. A person or a team, never "system". */
  readonly reviewedBy: string;
  /**
   * The artefact that proves we hold the right: a purchase order number, a
   * licence key, an upstream commit hash, or an internal asset ticket.
   */
  readonly provenanceRef: string;
}

/** Public-domain art. No attribution obligation, no share-alike. */
export interface PublicDomainLicence {
  readonly kind: 'public_domain';
  readonly spdx: 'CC0-1.0' | 'Unlicense';
  readonly holder: string;
  readonly redistributable: true;
  readonly shareAlike: false;
  readonly aiDerivationAllowed: boolean;
  readonly review: LicenceReview;
}

/**
 * Creative Commons attribution art. `attributionText` is non-optional because
 * attribution is a licence CONDITION: dist/CREDITS.md is generated from these
 * records and rendered directly in the Credits screen, so it cannot drift.
 */
export interface AttributionLicence {
  readonly kind: 'attribution';
  readonly spdx: 'CC-BY-4.0' | 'CC-BY-SA-4.0' | 'CC-BY-SA-3.0';
  readonly holder: string;
  /** Exact string the Credits screen must display. */
  readonly attributionText: string;
  readonly attributionUrl: string;
  readonly redistributable: true;
  /** `true` for the SA variants: our derivative art inherits the same terms. */
  readonly shareAlike: boolean;
  readonly aiDerivationAllowed: boolean;
  readonly review: LicenceReview;
}

/**
 * Art bought under a commercial licence (RepDB Standard, Gym Visual N-CRFL).
 * Both of those forbid feeding the asset to a generative model, so
 * `aiDerivationAllowed` is pinned false.
 */
export interface PurchasedLicence {
  readonly kind: 'purchased';
  readonly spdx: 'Proprietary-Commercial';
  readonly holder: string;
  /** Some vendors (RepDB free tier) require a visible attribution line. */
  readonly attributionText: string | null;
  readonly attributionUrl: string | null;
  readonly redistributable: true;
  readonly shareAlike: false;
  readonly aiDerivationAllowed: false;
  readonly review: LicenceReview;
}

/** Art we authored ourselves. The only category we own outright. */
export interface InHouseLicence {
  readonly kind: 'in_house';
  readonly spdx: 'Proprietary-InHouse';
  readonly holder: 'Stronger';
  readonly redistributable: true;
  readonly shareAlike: false;
  readonly aiDerivationAllowed: boolean;
  readonly review: LicenceReview;
}

/**
 * A licence that must never reach a build. Structurally distinct from the
 * shippable union: `redistributable` is the literal `false`, so a
 * `BlockedLicence` is not assignable to `ExerciseMedia.licence`.
 *
 * The three reasons map to the research's findings exactly:
 *  - `unknown`            no provenance established at all
 *  - `rights_retained`    the upstream states rights stay with third parties
 *                         (ExerciseGymGifsDB's 1,323 scraped GIFs)
 *  - `no_offline_storage` licensed but contractually not cacheable
 *                         (MuscleWiki's API terms)
 */
export interface BlockedLicence {
  readonly kind: 'blocked';
  readonly reason: 'unknown' | 'rights_retained' | 'no_offline_storage';
  readonly spdx: 'UNKNOWN';
  readonly holder: string | null;
  readonly redistributable: false;
  /** Why this was blocked, for the licence audit report. */
  readonly note: string;
}

/** Any licence a reviewed, redistributable asset may carry. */
export type ShippableLicence =
  | PublicDomainLicence
  | AttributionLicence
  | PurchasedLicence
  | InHouseLicence;

/** Any licence, shippable or not. Used by the ingest pipeline, never by a record. */
export type AnyLicence = ShippableLicence | BlockedLicence;

/** How a demo asset is encoded. Source: media research PART 1, MediaKind. */
export type MediaKind =
  | 'still'
  | 'pose_pair'
  | 'frame_sequence'
  | 'animated_webp'
  | 'lottie'
  | 'rive'
  | 'generated_svg'
  | 'video';

/**
 * A demonstration asset that is cleared to ship.
 *
 * `licence: ShippableLicence` is the type-level gate. There is no `UNKNOWN`
 * option and no optional review stamp, so an asset with unknown provenance
 * cannot be placed in this shape at all.
 */
export interface ExerciseMedia {
  readonly id: string;
  readonly kind: MediaKind;
  /** Path inside OUR asset bundle or CDN. Never a third-party hotlink. */
  readonly src: string;
  /** Ordered frames for `pose_pair` and `frame_sequence`. */
  readonly frames?: readonly string[];
  readonly width: number;
  readonly height: number;
  readonly frameCount?: number;
  readonly frameDurationMs?: number;
  readonly bytes: number;
  readonly hasAlpha: boolean;
  /** Which muscle groups the artwork tints, if it is muscle-highlighted. */
  readonly highlights?: readonly MuscleGroupId[];
  readonly model: 'male' | 'female' | 'neutral' | 'schematic';
  readonly view: 'front' | 'side' | 'three_quarter' | 'rear';
  readonly licence: ShippableLicence;
}

/**
 * A candidate asset inside the ingest pipeline, before review. This is the only
 * shape that may carry a `BlockedLicence`. `build/04-licence-audit` promotes a
 * `PendingMedia` to `ExerciseMedia` or drops it; nothing else may.
 */
export interface PendingMedia extends Omit<ExerciseMedia, 'licence'> {
  readonly licence: AnyLicence;
}

/**
 * Sources whose bytes must never enter a build, as a deny-list asserted in CI.
 *
 * Reasons, from the media-sources research:
 *  - static.exercisedb.dev and hasaneyldrm/exercises-dataset serve byte-identical
 *    files (SHA-256 verified) attributed "(c) Gym visual"
 *  - free-exercise-db's JPGs are Bodybuilding.com studio photographs of
 *    identifiable models with no release; the Unlicense badge is void as to them
 *  - ExerciseGymGifsDB self-describes its 1,323 GIFs as collected from the
 *    internet with rights retained by original authors
 *  - MuscleWiki's API terms forbid offline/CDN storage of any media
 */
export const FORBIDDEN_MEDIA_SOURCES: readonly string[] = [
  'static.exercisedb.dev',
  'oss.exercisedb.dev',
  'raw.githubusercontent.com/hasaneyldrm/exercises-dataset',
  'raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises',
  'github.com/JahelCuadrado/ExerciseGymGifsDB',
  'api.musclewiki.com',
  'musclewiki.com',
  'wrkout.xyz',
] as const;

/**
 * `true` when a URL points at a source whose media we may not ship.
 * Matches on substring because these appear as raw URLs, CDN rewrites and
 * git-raw paths alike.
 *
 * @param url - the candidate asset URL
 */
export function isForbiddenMediaSource(url: string): boolean {
  const lower = url.toLowerCase();
  return FORBIDDEN_MEDIA_SOURCES.some((s) => lower.includes(s.toLowerCase()));
}

/**
 * Narrows a licence to the shippable union.
 * The only supported way to get from ingest output to a catalog record.
 */
export function isShippableLicence(licence: AnyLicence): licence is ShippableLicence {
  return licence.kind !== 'blocked';
}

/**
 * Promotes a reviewed pending asset to a shippable one, or returns `null` when
 * its licence blocks it or its source is on the deny-list.
 *
 * This is deliberately total and non-throwing: the licence audit step wants to
 * report every rejection, not stop at the first.
 */
export function toShippableMedia(candidate: PendingMedia): ExerciseMedia | null {
  if (!isShippableLicence(candidate.licence)) return null;
  if (isForbiddenMediaSource(candidate.src)) return null;
  const { licence, ...rest } = candidate;
  return { ...rest, licence };
}

// ─────────────────────────────────────────────────────────────────────────────
// Strength standards
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How an exercise gets a world-standings comparison.
 *
 * Only ~287 exercises have published population standards (StrengthLevel:
 * 195,513,376 lifts, 27,893,268 users). The other ~900 in a 1,190-row catalog
 * are mapped onto a parent lift by ratio.
 * Source: research PART H.
 */
export interface StandardsRef {
  /** The catalog id of the lift whose standards table this exercise borrows. */
  readonly parentId: ExerciseId;
  /**
   * Multiplier converting this variation's e1RM into the parent's, e.g.
   * Incline Bench Press -> 0.80 of flat bench, Close Grip Bench -> 0.88,
   * Front Squat -> 0.85 of back squat, RDL -> 0.75 of deadlift.
   * A value of 1.0 means this exercise IS the parent.
   */
  readonly ratio: number;
  /** `false` when the lift is too variable to move a user's rank. */
  readonly countsTowardRank: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// The Exercise record
// ─────────────────────────────────────────────────────────────────────────────

/** Lifecycle state. Rows are never deleted; they are merged or deprecated. */
export type ExerciseStatus = 'active' | 'deprecated' | 'merged';

/** Who created the row. */
export type ExerciseOrigin = 'catalog' | 'user';

/** Data-quality flags. A flagged row is visible but never silently trusted. */
export type QaFlag =
  | 'no_media'
  | 'no_instructions'
  | 'muscle_unmapped'
  | 'licence_unreviewed'
  | 'possible_duplicate'
  | 'ai_generated_media';

/**
 * The components an exercise's name, slug and uniqueness tuple are computed
 * from. Nothing here is free text; every field is an id or an enum.
 */
export interface ExerciseComponents {
  readonly movementId: MovementId;
  readonly equipmentId: EquipmentId;
  readonly loadMode: LoadMode;
  /** Unsorted at authoring time; `variantSignature()` sorts them. */
  readonly variants: readonly VariantKey[];
  /**
   * Cable attachment, ONLY where it renames the lift in common use (Rope
   * Pushdown vs Bar Pushdown). Otherwise it is a per-set note, not identity.
   */
  readonly attachment?: CableAttachment;
}

/**
 * One catalog exercise.
 *
 * The identity tuple (movementId, equipmentId, loadMode, variantSignature) has
 * a partial unique index on it where `status = 'active'`, so two rows for
 * "Barbell Bench Press" and "Bench Press (Barbell)" cannot both exist: they
 * compute the same tuple and the second insert fails at the database level.
 * `name` is generated from the components, never typed, so it is never the
 * thing being compared. Source: research PART G, G2.
 */
export interface Exercise {
  /** Frozen slug. The only value user history stores. */
  readonly id: ExerciseId;
  /** Derived from the components; must equal `id` for catalog rows. */
  readonly slug: string;
  /** Generated display name. Never hand-typed. Max 42 characters. */
  readonly name: string;
  /**
   * Overflow for names the 42-character cap would truncate: the generator drops
   * the ROM modifier into here rather than producing an unreadable row.
   */
  readonly subtitle: string | null;
  /** Deterministic search key: normalised, sorted tokens. Unique. */
  readonly normalizedKey: string;

  readonly components: ExerciseComponents;
  /** Sorted variant keys joined with `|`. Half of the uniqueness tuple. */
  readonly variantSignature: string;

  readonly pattern: MovementPattern;
  readonly force: ForceType;
  readonly mechanic: Mechanic;
  readonly limbMode: LimbMode;
  /**
   * `true` when the weight the user enters applies to ONE limb. Derived from
   * `limbMode`; a Single Arm Row at 40 kg is 40 kg per rep, not 80.
   */
  readonly weightIsPerLimb: boolean;
  readonly tracking: TrackingType;
  /**
   * Fraction of bodyweight actually moved, for bodyweight volume math.
   * `null` for exercises where bodyweight is not part of the load.
   * Measured values only — see `BODYWEIGHT_LOAD_FACTORS`.
   */
  readonly bwFactor: number | null;

  /** Fatigue-parameter family. See `archetypes.ts`. */
  readonly archetype: ArchetypeId;
  /** Per-exercise overrides of the archetype's fatigue parameters. */
  readonly fatigueOverrides?: Partial<FatigueParams>;

  readonly primaryMuscles: readonly MuscleId[];
  readonly secondaryMuscles: readonly MuscleId[];
  /** Contribution vector across the 21 groups. Sums to 1.0. */
  readonly groupWeights: GroupWeights;

  /** Search index. Never displayed. */
  readonly aliases: readonly string[];
  /** Demo animation, shared across a movement family. `null` until authored. */
  readonly demoAssetId: DemoAssetId | null;
  /** Cleared-to-ship media. Empty until the asset pipeline has run. */
  readonly media: readonly ExerciseMedia[];

  readonly standards: StandardsRef | null;

  readonly status: ExerciseStatus;
  /** Set when `status` is `merged`. Resolved transitively, max depth 8. */
  readonly mergedIntoId?: ExerciseId;
  readonly origin: ExerciseOrigin;
  readonly catalogVersion: number;
  readonly qaFlags: readonly QaFlag[];
}

/**
 * A merge record. Merges are never deletions: the old row stays queryable
 * forever so a user's PRs never orphan. Source: research PART G, G4.
 */
export interface ExerciseMerge {
  readonly fromId: ExerciseId;
  readonly intoId: ExerciseId;
  readonly mergedAt: IsoDate;
  readonly reason: string;
}

/**
 * Follows a chain of merges to the surviving exercise id.
 *
 * @param id - an id from user history, possibly merged away
 * @param merges - the merge table, keyed by `fromId`
 * @param maxDepth - cycle guard; the research fixes 8
 * @returns the surviving id, or the last id reached if the chain is longer than
 *   `maxDepth` or contains a cycle
 */
export function resolveMergedId(
  id: ExerciseId,
  merges: ReadonlyMap<ExerciseId, ExerciseId>,
  maxDepth = 8,
): ExerciseId {
  let current = id;
  const seen = new Set<ExerciseId>([id]);
  for (let i = 0; i < maxDepth; i += 1) {
    const next = merges.get(current);
    if (next === undefined || seen.has(next)) return current;
    seen.add(next);
    current = next;
  }
  return current;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bodyweight load coefficients
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Measured bodyweight load coefficients (`bwFactor`): the fraction of body mass
 * actually supported. These are force-plate measurements, not estimates.
 *
 * Push-up family: Ebben, Wurm, VanderZanden et al., "Kinetic Analysis of
 * Several Variations of Push-Ups", J Strength Cond Res 25(10):2891-2894, 2011
 * (23 subjects, ground-reaction force). Suprak, Dawes, Stephenson, JSCR
 * 25(2):497-503, 2011 (28 strength-trained males) confirms subjects support
 * less mass in the up position than the down position.
 *
 * Non-push-up entries are segment-mass derivations (Dempster) or derived from
 * suspension-row GRF work, as annotated in research PART D, D5.
 *
 * Unit: dimensionless fraction of body mass.
 */
export const BODYWEIGHT_LOAD_FACTORS = {
  /** Ebben 2011, measured. */
  push_up: 0.64,
  /** Ebben 2011, measured: hands elevated 30.5 cm. */
  push_up_hands_elevated_30cm: 0.55,
  /** Ebben 2011, measured: hands elevated 61 cm. */
  push_up_hands_elevated_61cm: 0.41,
  /** Ebben 2011, measured: feet elevated 30.5 cm. */
  push_up_feet_elevated_30cm: 0.7,
  /** Ebben 2011, measured: feet elevated 61 cm. */
  push_up_feet_elevated_61cm: 0.74,
  /** Ebben 2011, measured: knee (modified) push-up. */
  push_up_knee: 0.49,
  /** BW minus forearms and hands distal to the bar (~5% segment mass). */
  pull_up: 0.95,
  /** BW minus forearms and hands. */
  dip: 0.94,
  /** Derived from suspension-row GRF work; tune per strap length. */
  inverted_row_feet_floor: 0.55,
  /** Derived: feet elevated, torso horizontal. */
  inverted_row_feet_elevated: 0.7,
  /** BW minus shanks and feet (~22% segment mass, Dempster). */
  bodyweight_squat: 0.78,
  /** Per leg, minus the support leg. */
  pistol_squat: 0.85,
  /** Static, forearm support. */
  plank: 0.55,
  /** Torso and head above the knee axis. */
  nordic_curl: 0.6,
  /** BW minus forearms. */
  handstand_push_up: 0.92,
} as const;

/** Keys of the measured bodyweight load coefficient table. */
export type BodyweightLoadKey = keyof typeof BODYWEIGHT_LOAD_FACTORS;
