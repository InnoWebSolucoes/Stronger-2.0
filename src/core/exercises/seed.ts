// ─────────────────────────────────────────────────────────────────────────────
// The Tier-0 seed catalog
// ─────────────────────────────────────────────────────────────────────────────
//
// Every exercise a person can log on day one. Nothing here is scraped: names
// are GENERATED from components by `canonicalName()`, muscle vectors are
// hand-authored and normalised by `contributions.ts`, and the instruction lines
// are written from scratch in this repository. That last point is not fussiness
// — the research brief on exercise databases found that every "open" catalog's
// prose is verbatim Bodybuilding.com copy under a licence that never covered
// it, so any line lifted from one would be a copyright problem wearing an
// Unlicense badge. Three or four plain sentences per lift, written here, are
// cheaper than that argument.
//
// AUTHORING RULES
//
//  1. A row is identified by (movement, equipment, loadMode, variants). The id
//     is the derived slug and is FROZEN: user history stores nothing else.
//  2. Muscle shares are authored per muscle and must already sum to ~1.0. The
//     21-group vector the app renders is rolled up from them, never typed.
//  3. `limbMode` describes the LIMB ACTION, and `weightIsPerLimb` falls out of
//     it. A single-arm row logged at 40 kg is 40 kg, not 80; a Bulgarian split
//     squat at 60 kg is 60 kg on the working leg, logged once per side.
//  4. `bwFactor` is only set from the measured table in `types.ts`. It is a
//     force-plate number, not a guess, so an unmeasured movement gets `null`
//     rather than an invention.
//  5. Weights are kilograms. Always.
//
// Pure TypeScript: no react, no react-native, no expo-*, no ambient clock.

import type { ArchetypeId } from './archetypes';
import { getArchetype } from './archetypes';
import { buildContribution, type MuscleShares } from './contributions';
import type { CableAttachment, EquipmentId } from './equipment';
import {
  canonicalName,
  deriveSlug,
  generateAliases,
  normalizedKey,
  variantSignature,
  type KnownMovementId,
} from './naming';
import type { ForceType, LimbMode, Mechanic, MovementPattern } from './patterns';
import { weightIsPerLimb } from './patterns';
import { BODYWEIGHT_LOAD_FACTORS } from './types';
import type {
  Exercise,
  ExerciseComponents,
  LoadMode,
  QaFlag,
  StandardsRef,
  TrackingType,
  VariantKey,
} from './types';

/** Bumped whenever this file changes in a way a client must re-sync. */
export const CATALOG_VERSION = 1;

/**
 * A seeded exercise: the shipped {@link Exercise} record plus the coaching
 * lines. `Exercise` itself has no `instructions` field because instructions are
 * catalog content rather than logging identity — a user-created exercise has
 * none, and the row must still be valid.
 */
export interface SeedExercise extends Exercise {
  /** 2-4 short lines, written in this repository. Never copied. */
  readonly instructions: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// The row builder
// ─────────────────────────────────────────────────────────────────────────────

/** The hand-authored half of an exercise. Everything else is derived. */
interface Spec {
  /** Movement family. Also the unit a demo animation belongs to. */
  readonly m: KnownMovementId;
  readonly eq: EquipmentId;
  readonly load?: LoadMode;
  readonly v?: readonly VariantKey[];
  readonly att?: CableAttachment;
  /** Defaults to the archetype's own pattern, which is right almost always. */
  readonly pattern?: MovementPattern;
  readonly force: ForceType;
  readonly mech: Mechanic;
  readonly limb?: LimbMode;
  readonly track?: TrackingType;
  readonly bw?: number;
  readonly arch: ArchetypeId;
  /** Muscle shares, expected to sum to 1.0 before normalisation. */
  readonly sh: MuscleShares;
  /** Slang, eponyms and the spellings people actually type into search. */
  readonly alias?: readonly string[];
  readonly std?: StandardsRef;
  readonly cues: readonly string[];
}

function ex(spec: Spec): SeedExercise {
  const components: ExerciseComponents = {
    movementId: spec.m,
    equipmentId: spec.eq,
    loadMode: spec.load ?? 'none',
    variants: spec.v ?? [],
    attachment: spec.att,
  };
  const slug = deriveSlug(components);
  const generated = canonicalName(components);
  const contribution = buildContribution(spec.sh, slug);
  const limbMode: LimbMode = spec.limb ?? 'bilateral';
  const qaFlags: readonly QaFlag[] = ['no_media'];

  return {
    id: slug,
    slug,
    name: generated.name,
    subtitle: generated.subtitle,
    normalizedKey: normalizedKey(generated.name),
    components,
    variantSignature: variantSignature(components.variants),
    pattern: spec.pattern ?? getArchetype(spec.arch).pattern,
    force: spec.force,
    mechanic: spec.mech,
    limbMode,
    weightIsPerLimb: weightIsPerLimb(limbMode),
    tracking: spec.track ?? 'weight_reps',
    bwFactor: spec.bw ?? null,
    archetype: spec.arch,
    primaryMuscles: contribution.primaryMuscles,
    secondaryMuscles: contribution.secondaryMuscles,
    groupWeights: contribution.groupWeights,
    aliases: generateAliases(generated.name, spec.alias ?? []),
    demoAssetId: null,
    media: [],
    standards: spec.std ?? null,
    status: 'active',
    origin: 'catalog',
    catalogVersion: CATALOG_VERSION,
    qaFlags,
    instructions: spec.cues,
  };
}

/** Shorthand for a standards reference against a parent lift. */
function std(parentId: string, ratio: number, countsTowardRank = true): StandardsRef {
  return { parentId, ratio, countsTowardRank };
}

const BW = BODYWEIGHT_LOAD_FACTORS;

// ─────────────────────────────────────────────────────────────────────────────
// Muscle share templates
// ─────────────────────────────────────────────────────────────────────────────
//
// One template per biomechanically distinct pattern, reused across the
// equipment variants of that pattern. This is deliberate: a dumbbell flat press
// and a barbell flat press do not differ enough for two different vectors, and
// two vectors that ought to be identical drifting apart is precisely the bug
// class `contributions.test.ts` cannot catch. Where a variant genuinely shifts
// the emphasis — incline, close grip, sumo — it gets its own template.
//
// Every template is authored to sum to 1.00 exactly.

// ── chest ────────────────────────────────────────────────────────────────────
const FLAT_PRESS: MuscleShares = {
  pec_major_sternal: 0.34, pec_major_clavicular: 0.1, pec_major_costal: 0.08,
  deltoid_anterior: 0.18, triceps_lateral_head: 0.11, triceps_long_head: 0.09,
  triceps_medial_head: 0.06, serratus_anterior: 0.04,
};
const INCLINE_PRESS: MuscleShares = {
  pec_major_clavicular: 0.28, pec_major_sternal: 0.2, deltoid_anterior: 0.24,
  triceps_lateral_head: 0.1, triceps_long_head: 0.08, triceps_medial_head: 0.06,
  serratus_anterior: 0.04,
};
const DECLINE_PRESS: MuscleShares = {
  pec_major_costal: 0.3, pec_major_sternal: 0.24, deltoid_anterior: 0.12,
  triceps_lateral_head: 0.12, triceps_long_head: 0.1, triceps_medial_head: 0.08,
  serratus_anterior: 0.04,
};
const CLOSE_GRIP_PRESS: MuscleShares = {
  triceps_lateral_head: 0.18, triceps_long_head: 0.15, triceps_medial_head: 0.12,
  pec_major_sternal: 0.24, pec_major_clavicular: 0.08, deltoid_anterior: 0.17,
  anconeus: 0.06,
};
const CHEST_FLY: MuscleShares = {
  pec_major_sternal: 0.42, pec_major_clavicular: 0.14, pec_major_costal: 0.12,
  deltoid_anterior: 0.16, biceps_short_head: 0.06, coracobrachialis: 0.05,
  pec_minor: 0.05,
};
const INCLINE_FLY: MuscleShares = {
  pec_major_clavicular: 0.34, pec_major_sternal: 0.24, deltoid_anterior: 0.2,
  pec_minor: 0.06, biceps_short_head: 0.06, coracobrachialis: 0.05,
  pec_major_costal: 0.05,
};
const LOW_TO_HIGH_FLY: MuscleShares = {
  pec_major_clavicular: 0.38, pec_major_sternal: 0.22, deltoid_anterior: 0.2,
  pec_minor: 0.06, coracobrachialis: 0.06, biceps_short_head: 0.08,
};
const HIGH_TO_LOW_FLY: MuscleShares = {
  pec_major_costal: 0.34, pec_major_sternal: 0.26, pec_major_clavicular: 0.08,
  deltoid_anterior: 0.12, latissimus_dorsi_upper: 0.08, pec_minor: 0.06,
  triceps_long_head: 0.06,
};
const PUSH_UP: MuscleShares = {
  pec_major_sternal: 0.3, pec_major_clavicular: 0.1, pec_major_costal: 0.06,
  deltoid_anterior: 0.16, triceps_lateral_head: 0.11, triceps_long_head: 0.08,
  triceps_medial_head: 0.06, serratus_anterior: 0.08, rectus_abdominis_upper: 0.05,
};
const CHEST_DIP: MuscleShares = {
  pec_major_costal: 0.26, pec_major_sternal: 0.22, deltoid_anterior: 0.12,
  triceps_lateral_head: 0.14, triceps_long_head: 0.11, triceps_medial_head: 0.08,
  pec_minor: 0.04, rhomboid_major: 0.03,
};
const TRICEPS_DIP: MuscleShares = {
  triceps_lateral_head: 0.26, triceps_long_head: 0.22, triceps_medial_head: 0.16,
  pec_major_costal: 0.12, pec_major_sternal: 0.08, deltoid_anterior: 0.1,
  anconeus: 0.06,
};
const BENCH_DIP: MuscleShares = {
  triceps_lateral_head: 0.28, triceps_long_head: 0.24, triceps_medial_head: 0.18,
  deltoid_anterior: 0.14, pec_major_costal: 0.08, anconeus: 0.08,
};
const LANDMINE_PRESS: MuscleShares = {
  deltoid_anterior: 0.3, pec_major_clavicular: 0.18, triceps_long_head: 0.12,
  triceps_lateral_head: 0.1, serratus_anterior: 0.1, trapezius_upper: 0.08,
  rectus_abdominis_upper: 0.07, external_oblique: 0.05,
};

// ── back ─────────────────────────────────────────────────────────────────────
const VERTICAL_PULL_WIDE: MuscleShares = {
  latissimus_dorsi_upper: 0.28, latissimus_dorsi_lower: 0.14, teres_major: 0.12,
  trapezius_lower: 0.08, rhomboid_major: 0.07, biceps_long_head: 0.08,
  biceps_short_head: 0.06, brachialis: 0.06, deltoid_posterior: 0.06,
  trapezius_middle: 0.05,
};
const VERTICAL_PULL_NEUTRAL: MuscleShares = {
  latissimus_dorsi_upper: 0.24, latissimus_dorsi_lower: 0.14, teres_major: 0.1,
  biceps_long_head: 0.13, biceps_short_head: 0.1, brachialis: 0.08,
  brachioradialis: 0.05, trapezius_lower: 0.06, rhomboid_major: 0.05,
  deltoid_posterior: 0.05,
};
const PULLDOWN_CLOSE: MuscleShares = {
  latissimus_dorsi_lower: 0.24, latissimus_dorsi_upper: 0.22, teres_major: 0.12,
  biceps_long_head: 0.1, biceps_short_head: 0.08, brachialis: 0.07,
  trapezius_lower: 0.07, rhomboid_major: 0.05, deltoid_posterior: 0.05,
};
const HORIZONTAL_ROW: MuscleShares = {
  latissimus_dorsi_upper: 0.18, latissimus_dorsi_lower: 0.1, rhomboid_major: 0.12,
  rhomboid_minor: 0.05, trapezius_middle: 0.12, trapezius_lower: 0.06,
  deltoid_posterior: 0.1, teres_major: 0.07, biceps_long_head: 0.06,
  brachialis: 0.05, erector_spinae_longissimus: 0.05, infraspinatus: 0.04,
};
const ROW_SUPPORTED: MuscleShares = {
  latissimus_dorsi_upper: 0.19, latissimus_dorsi_lower: 0.11, rhomboid_major: 0.13,
  rhomboid_minor: 0.06, trapezius_middle: 0.13, trapezius_lower: 0.07,
  deltoid_posterior: 0.11, teres_major: 0.08, biceps_long_head: 0.07,
  brachialis: 0.05,
};
const SEATED_CABLE_ROW: MuscleShares = {
  latissimus_dorsi_upper: 0.2, latissimus_dorsi_lower: 0.12, rhomboid_major: 0.12,
  trapezius_middle: 0.12, trapezius_lower: 0.06, deltoid_posterior: 0.09,
  teres_major: 0.08, biceps_long_head: 0.07, brachialis: 0.05,
  erector_spinae_longissimus: 0.05, infraspinatus: 0.04,
};
const SINGLE_ARM_ROW: MuscleShares = {
  latissimus_dorsi_upper: 0.22, latissimus_dorsi_lower: 0.12, teres_major: 0.1,
  rhomboid_major: 0.1, trapezius_middle: 0.1, deltoid_posterior: 0.09,
  biceps_long_head: 0.07, brachialis: 0.05, external_oblique: 0.07,
  erector_spinae_longissimus: 0.08,
};
const MEADOWS_ROW: MuscleShares = {
  latissimus_dorsi_upper: 0.22, latissimus_dorsi_lower: 0.12, teres_major: 0.1,
  rhomboid_major: 0.1, trapezius_middle: 0.1, deltoid_posterior: 0.1,
  biceps_long_head: 0.08, external_oblique: 0.06, erector_spinae_longissimus: 0.06,
  brachialis: 0.06,
};
const RENEGADE_ROW: MuscleShares = {
  latissimus_dorsi_upper: 0.16, rhomboid_major: 0.1, trapezius_middle: 0.1,
  deltoid_posterior: 0.1, external_oblique: 0.14, transversus_abdominis: 0.12,
  rectus_abdominis_upper: 0.1, biceps_long_head: 0.06, teres_major: 0.06,
  deltoid_anterior: 0.06,
};
const INVERTED_ROW: MuscleShares = {
  latissimus_dorsi_upper: 0.16, rhomboid_major: 0.14, trapezius_middle: 0.14,
  trapezius_lower: 0.08, deltoid_posterior: 0.12, teres_major: 0.07,
  biceps_long_head: 0.08, brachialis: 0.05, rectus_abdominis_upper: 0.06,
  gluteus_maximus: 0.05, infraspinatus: 0.05,
};
const STRAIGHT_ARM_PULLDOWN: MuscleShares = {
  latissimus_dorsi_upper: 0.3, latissimus_dorsi_lower: 0.2, teres_major: 0.14,
  trapezius_lower: 0.1, triceps_long_head: 0.1, pec_major_costal: 0.06,
  rectus_abdominis_upper: 0.05, rhomboid_major: 0.05,
};
const PULLOVER: MuscleShares = {
  latissimus_dorsi_upper: 0.26, latissimus_dorsi_lower: 0.16, pec_major_sternal: 0.14,
  teres_major: 0.12, triceps_long_head: 0.12, serratus_anterior: 0.08,
  pec_minor: 0.06, rectus_abdominis_upper: 0.06,
};
const SHRUG: MuscleShares = {
  trapezius_upper: 0.48, levator_scapulae: 0.14, trapezius_middle: 0.14,
  rhomboid_major: 0.06, wrist_flexors: 0.1, erector_spinae_longissimus: 0.05,
  splenius_cervicis: 0.03,
};
const FACE_PULL: MuscleShares = {
  deltoid_posterior: 0.26, infraspinatus: 0.14, teres_minor: 0.1,
  trapezius_middle: 0.16, trapezius_lower: 0.1, rhomboid_major: 0.1,
  biceps_long_head: 0.05, brachialis: 0.05, trapezius_upper: 0.04,
};
const DEAD_HANG: MuscleShares = {
  wrist_flexors: 0.34, brachioradialis: 0.16, latissimus_dorsi_upper: 0.14,
  trapezius_lower: 0.12, teres_major: 0.08, rhomboid_major: 0.08,
  deltoid_posterior: 0.04, brachialis: 0.04,
};

// ── hinge and posterior chain ────────────────────────────────────────────────
const DEADLIFT_CONVENTIONAL: MuscleShares = {
  erector_spinae_longissimus: 0.13, erector_spinae_iliocostalis: 0.1,
  erector_spinae_spinalis: 0.05, gluteus_maximus: 0.16, biceps_femoris_long: 0.1,
  semitendinosus: 0.07, semimembranosus: 0.06, adductor_magnus: 0.07,
  vastus_lateralis: 0.05, rectus_femoris: 0.04, trapezius_upper: 0.05,
  latissimus_dorsi_upper: 0.04, wrist_flexors: 0.05, quadratus_lumborum: 0.03,
};
const DEADLIFT_SUMO: MuscleShares = {
  gluteus_maximus: 0.17, adductor_magnus: 0.13, adductor_longus: 0.05,
  vastus_lateralis: 0.08, vastus_medialis: 0.07, rectus_femoris: 0.05,
  erector_spinae_longissimus: 0.1, erector_spinae_iliocostalis: 0.07,
  biceps_femoris_long: 0.07, semitendinosus: 0.05, trapezius_upper: 0.05,
  wrist_flexors: 0.05, latissimus_dorsi_upper: 0.06,
};
const TRAP_BAR_DEADLIFT: MuscleShares = {
  gluteus_maximus: 0.17, vastus_lateralis: 0.12, vastus_medialis: 0.09,
  erector_spinae_longissimus: 0.11, erector_spinae_iliocostalis: 0.07,
  biceps_femoris_long: 0.1, semitendinosus: 0.06, adductor_magnus: 0.07,
  trapezius_upper: 0.07, wrist_flexors: 0.06, rectus_femoris: 0.05,
  semimembranosus: 0.03,
};
const ROMANIAN_DEADLIFT: MuscleShares = {
  biceps_femoris_long: 0.2, semitendinosus: 0.14, semimembranosus: 0.12,
  gluteus_maximus: 0.18, erector_spinae_longissimus: 0.11,
  erector_spinae_iliocostalis: 0.07, adductor_magnus: 0.06, wrist_flexors: 0.05,
  latissimus_dorsi_upper: 0.04, trapezius_upper: 0.03,
};
const STIFF_LEG_DEADLIFT: MuscleShares = {
  biceps_femoris_long: 0.19, semitendinosus: 0.13, semimembranosus: 0.11,
  gluteus_maximus: 0.15, erector_spinae_longissimus: 0.14,
  erector_spinae_iliocostalis: 0.09, adductor_magnus: 0.06, wrist_flexors: 0.05,
  quadratus_lumborum: 0.04, latissimus_dorsi_upper: 0.04,
};
const RACK_PULL: MuscleShares = {
  erector_spinae_longissimus: 0.16, erector_spinae_iliocostalis: 0.1,
  trapezius_upper: 0.14, gluteus_maximus: 0.14, biceps_femoris_long: 0.08,
  wrist_flexors: 0.08, latissimus_dorsi_upper: 0.07, trapezius_middle: 0.07,
  adductor_magnus: 0.06, vastus_lateralis: 0.05, semitendinosus: 0.05,
};
const GOOD_MORNING: MuscleShares = {
  biceps_femoris_long: 0.18, semitendinosus: 0.12, semimembranosus: 0.1,
  gluteus_maximus: 0.16, erector_spinae_longissimus: 0.16,
  erector_spinae_iliocostalis: 0.1, erector_spinae_spinalis: 0.06,
  quadratus_lumborum: 0.06, adductor_magnus: 0.06,
};
const BACK_EXTENSION: MuscleShares = {
  erector_spinae_longissimus: 0.24, erector_spinae_iliocostalis: 0.18,
  erector_spinae_spinalis: 0.1, multifidus: 0.08, quadratus_lumborum: 0.08,
  gluteus_maximus: 0.16, biceps_femoris_long: 0.1, semitendinosus: 0.06,
};
const REVERSE_HYPER: MuscleShares = {
  gluteus_maximus: 0.3, biceps_femoris_long: 0.16, semitendinosus: 0.1,
  erector_spinae_longissimus: 0.16, erector_spinae_iliocostalis: 0.1,
  multifidus: 0.08, semimembranosus: 0.1,
};
const HIP_THRUST: MuscleShares = {
  gluteus_maximus: 0.46, gluteus_medius: 0.1, biceps_femoris_long: 0.12,
  semitendinosus: 0.07, semimembranosus: 0.06, vastus_lateralis: 0.06,
  rectus_femoris: 0.05, adductor_magnus: 0.05, erector_spinae_longissimus: 0.03,
};
const GLUTE_BRIDGE: MuscleShares = {
  gluteus_maximus: 0.48, gluteus_medius: 0.1, biceps_femoris_long: 0.12,
  semitendinosus: 0.08, semimembranosus: 0.07, adductor_magnus: 0.06,
  rectus_abdominis_lower: 0.05, erector_spinae_longissimus: 0.04,
};
const KETTLEBELL_SWING: MuscleShares = {
  gluteus_maximus: 0.28, biceps_femoris_long: 0.16, semitendinosus: 0.1,
  semimembranosus: 0.08, erector_spinae_longissimus: 0.12,
  erector_spinae_iliocostalis: 0.07, deltoid_anterior: 0.06, wrist_flexors: 0.05,
  rectus_abdominis_upper: 0.05, quadratus_lumborum: 0.03,
};
const PULL_THROUGH: MuscleShares = {
  gluteus_maximus: 0.36, biceps_femoris_long: 0.16, semitendinosus: 0.1,
  semimembranosus: 0.08, erector_spinae_longissimus: 0.12, adductor_magnus: 0.08,
  rectus_abdominis_upper: 0.05, wrist_flexors: 0.05,
};
const GLUTE_KICKBACK: MuscleShares = {
  gluteus_maximus: 0.52, biceps_femoris_long: 0.16, semitendinosus: 0.1,
  gluteus_medius: 0.1, erector_spinae_longissimus: 0.07, semimembranosus: 0.05,
};

// ── squat and knee ───────────────────────────────────────────────────────────
const BACK_SQUAT: MuscleShares = {
  vastus_lateralis: 0.17, vastus_medialis: 0.14, vastus_intermedius: 0.1,
  rectus_femoris: 0.09, gluteus_maximus: 0.17, gluteus_medius: 0.05,
  adductor_magnus: 0.09, erector_spinae_longissimus: 0.07,
  erector_spinae_iliocostalis: 0.04, biceps_femoris_long: 0.05, soleus: 0.03,
};
const FRONT_SQUAT: MuscleShares = {
  vastus_lateralis: 0.2, vastus_medialis: 0.17, vastus_intermedius: 0.12,
  rectus_femoris: 0.12, gluteus_maximus: 0.13, adductor_magnus: 0.07,
  erector_spinae_longissimus: 0.08, rectus_abdominis_upper: 0.06,
  trapezius_upper: 0.05,
};
const GOBLET_SQUAT: MuscleShares = {
  vastus_lateralis: 0.2, vastus_medialis: 0.16, vastus_intermedius: 0.1,
  rectus_femoris: 0.09, gluteus_maximus: 0.16, adductor_magnus: 0.07,
  rectus_abdominis_upper: 0.07, erector_spinae_longissimus: 0.07,
  deltoid_anterior: 0.04, biceps_short_head: 0.04,
};
const MACHINE_SQUAT: MuscleShares = {
  vastus_lateralis: 0.24, vastus_medialis: 0.2, vastus_intermedius: 0.13,
  rectus_femoris: 0.12, gluteus_maximus: 0.15, adductor_magnus: 0.08,
  biceps_femoris_long: 0.05, soleus: 0.03,
};
const LEG_PRESS: MuscleShares = {
  vastus_lateralis: 0.25, vastus_medialis: 0.21, vastus_intermedius: 0.14,
  rectus_femoris: 0.1, gluteus_maximus: 0.16, adductor_magnus: 0.08,
  biceps_femoris_long: 0.04, soleus: 0.02,
};
const SPLIT_SQUAT: MuscleShares = {
  vastus_lateralis: 0.18, vastus_medialis: 0.15, vastus_intermedius: 0.09,
  rectus_femoris: 0.08, gluteus_maximus: 0.22, gluteus_medius: 0.09,
  adductor_magnus: 0.07, biceps_femoris_long: 0.06, psoas_major: 0.03, soleus: 0.03,
};
const LUNGE: MuscleShares = {
  gluteus_maximus: 0.24, gluteus_medius: 0.09, vastus_lateralis: 0.17,
  vastus_medialis: 0.14, vastus_intermedius: 0.08, rectus_femoris: 0.07,
  adductor_magnus: 0.08, biceps_femoris_long: 0.06, soleus: 0.04,
  external_oblique: 0.03,
};
const STEP_UP: MuscleShares = {
  gluteus_maximus: 0.26, vastus_lateralis: 0.18, vastus_medialis: 0.15,
  vastus_intermedius: 0.08, rectus_femoris: 0.08, gluteus_medius: 0.1,
  adductor_magnus: 0.06, biceps_femoris_long: 0.05, soleus: 0.04,
};
const PISTOL_SQUAT: MuscleShares = {
  vastus_lateralis: 0.2, vastus_medialis: 0.17, gluteus_maximus: 0.2,
  vastus_intermedius: 0.1, rectus_femoris: 0.08, gluteus_medius: 0.09,
  adductor_magnus: 0.06, soleus: 0.06, tibialis_anterior: 0.04,
};
const LEG_EXTENSION: MuscleShares = {
  vastus_lateralis: 0.3, vastus_medialis: 0.27, vastus_intermedius: 0.22,
  rectus_femoris: 0.21,
};
const SISSY_SQUAT: MuscleShares = {
  rectus_femoris: 0.34, vastus_lateralis: 0.24, vastus_medialis: 0.22,
  vastus_intermedius: 0.14, psoas_major: 0.03, tibialis_anterior: 0.03,
};
const LEG_CURL: MuscleShares = {
  biceps_femoris_long: 0.28, biceps_femoris_short: 0.2, semitendinosus: 0.22,
  semimembranosus: 0.2, gastrocnemius_medial: 0.05, gracilis: 0.05,
};
const NORDIC_CURL: MuscleShares = {
  biceps_femoris_long: 0.26, biceps_femoris_short: 0.18, semitendinosus: 0.22,
  semimembranosus: 0.2, gluteus_maximus: 0.06, gastrocnemius_medial: 0.04,
  erector_spinae_longissimus: 0.04,
};
const GLUTE_HAM_RAISE: MuscleShares = {
  biceps_femoris_long: 0.24, semitendinosus: 0.2, biceps_femoris_short: 0.16,
  semimembranosus: 0.16, gluteus_maximus: 0.1, erector_spinae_longissimus: 0.08,
  gastrocnemius_medial: 0.06,
};
const HIP_ABDUCTION: MuscleShares = {
  gluteus_medius: 0.38, gluteus_minimus: 0.24, tensor_fasciae_latae: 0.2,
  gluteus_maximus: 0.14, piriformis: 0.04,
};
const HIP_ADDUCTION: MuscleShares = {
  adductor_magnus: 0.3, adductor_longus: 0.26, adductor_brevis: 0.2,
  gracilis: 0.16, pectineus: 0.08,
};
const CALF_RAISE_STANDING: MuscleShares = {
  gastrocnemius_medial: 0.36, gastrocnemius_lateral: 0.3, soleus: 0.24,
  fibularis_longus: 0.1,
};
const CALF_RAISE_SEATED: MuscleShares = {
  soleus: 0.56, gastrocnemius_medial: 0.16, gastrocnemius_lateral: 0.14,
  fibularis_longus: 0.14,
};
const JUMP_SQUAT: MuscleShares = {
  vastus_lateralis: 0.2, gluteus_maximus: 0.2, vastus_medialis: 0.14,
  gastrocnemius_medial: 0.12, soleus: 0.1, rectus_femoris: 0.1,
  biceps_femoris_long: 0.08, gastrocnemius_lateral: 0.06,
};

// ── shoulders ────────────────────────────────────────────────────────────────
const OVERHEAD_PRESS: MuscleShares = {
  deltoid_anterior: 0.3, deltoid_lateral: 0.16, triceps_long_head: 0.12,
  triceps_lateral_head: 0.1, triceps_medial_head: 0.07, trapezius_upper: 0.08,
  serratus_anterior: 0.06, supraspinatus: 0.05, pec_major_clavicular: 0.06,
};
const PUSH_PRESS: MuscleShares = {
  deltoid_anterior: 0.26, deltoid_lateral: 0.13, triceps_long_head: 0.1,
  triceps_lateral_head: 0.09, triceps_medial_head: 0.06, trapezius_upper: 0.07,
  vastus_lateralis: 0.08, gluteus_maximus: 0.08, soleus: 0.05,
  serratus_anterior: 0.04, rectus_abdominis_upper: 0.04,
};
const HANDSTAND_PRESS: MuscleShares = {
  deltoid_anterior: 0.3, deltoid_lateral: 0.14, triceps_long_head: 0.14,
  triceps_lateral_head: 0.12, triceps_medial_head: 0.08, trapezius_upper: 0.07,
  serratus_anterior: 0.07, rectus_abdominis_upper: 0.08,
};
const LATERAL_RAISE: MuscleShares = {
  deltoid_lateral: 0.52, deltoid_anterior: 0.16, supraspinatus: 0.12,
  trapezius_upper: 0.1, trapezius_middle: 0.06, deltoid_posterior: 0.04,
};
const FRONT_RAISE: MuscleShares = {
  deltoid_anterior: 0.52, deltoid_lateral: 0.14, pec_major_clavicular: 0.14,
  trapezius_upper: 0.08, serratus_anterior: 0.06, biceps_long_head: 0.06,
};
const REAR_DELT_FLY: MuscleShares = {
  deltoid_posterior: 0.4, infraspinatus: 0.12, teres_minor: 0.08,
  trapezius_middle: 0.16, rhomboid_major: 0.14, trapezius_lower: 0.06,
  teres_major: 0.04,
};
const UPRIGHT_ROW: MuscleShares = {
  deltoid_lateral: 0.3, trapezius_upper: 0.22, deltoid_anterior: 0.12,
  biceps_long_head: 0.09, brachialis: 0.07, supraspinatus: 0.08,
  trapezius_middle: 0.07, brachioradialis: 0.05,
};

// ── arms ─────────────────────────────────────────────────────────────────────
const BICEPS_CURL: MuscleShares = {
  biceps_long_head: 0.3, biceps_short_head: 0.28, brachialis: 0.2,
  brachioradialis: 0.12, supinator: 0.06, wrist_flexors: 0.04,
};
const HAMMER_CURL: MuscleShares = {
  brachioradialis: 0.3, brachialis: 0.26, biceps_long_head: 0.18,
  biceps_short_head: 0.14, wrist_flexors: 0.08, pronator_teres: 0.04,
};
const PREACHER_CURL: MuscleShares = {
  biceps_short_head: 0.34, biceps_long_head: 0.24, brachialis: 0.24,
  brachioradialis: 0.12, supinator: 0.06,
};
const STRETCHED_CURL: MuscleShares = {
  biceps_long_head: 0.4, biceps_short_head: 0.24, brachialis: 0.2,
  brachioradialis: 0.1, supinator: 0.06,
};
const CONCENTRATION_CURL: MuscleShares = {
  biceps_short_head: 0.36, biceps_long_head: 0.26, brachialis: 0.22,
  brachioradialis: 0.1, supinator: 0.06,
};
const DRAG_CURL: MuscleShares = {
  biceps_long_head: 0.36, biceps_short_head: 0.22, brachialis: 0.18,
  brachioradialis: 0.1, deltoid_posterior: 0.08, trapezius_middle: 0.06,
};
const REVERSE_CURL: MuscleShares = {
  brachioradialis: 0.32, brachialis: 0.28, wrist_extensors: 0.18,
  biceps_long_head: 0.1, biceps_short_head: 0.08, pronator_teres: 0.04,
};
const TRICEPS_PUSHDOWN: MuscleShares = {
  triceps_lateral_head: 0.34, triceps_medial_head: 0.26, triceps_long_head: 0.24,
  anconeus: 0.1, wrist_flexors: 0.06,
};
const OVERHEAD_EXTENSION: MuscleShares = {
  triceps_long_head: 0.44, triceps_lateral_head: 0.24, triceps_medial_head: 0.22,
  anconeus: 0.06, deltoid_posterior: 0.04,
};
const SKULLCRUSHER: MuscleShares = {
  triceps_long_head: 0.36, triceps_lateral_head: 0.28, triceps_medial_head: 0.24,
  anconeus: 0.08, wrist_flexors: 0.04,
};
const TRICEPS_KICKBACK: MuscleShares = {
  triceps_long_head: 0.38, triceps_lateral_head: 0.28, triceps_medial_head: 0.22,
  anconeus: 0.08, deltoid_posterior: 0.04,
};
const WRIST_CURL: MuscleShares = {
  wrist_flexors: 0.78, pronator_teres: 0.12, brachioradialis: 0.1,
};
const REVERSE_WRIST_CURL: MuscleShares = {
  wrist_extensors: 0.76, brachioradialis: 0.14, supinator: 0.1,
};
const WRIST_ROLLER: MuscleShares = {
  wrist_flexors: 0.44, wrist_extensors: 0.34, brachioradialis: 0.14,
  pronator_teres: 0.08,
};
const PLATE_PINCH: MuscleShares = {
  wrist_flexors: 0.7, brachioradialis: 0.16, pronator_teres: 0.08,
  wrist_extensors: 0.06,
};

// ── core ─────────────────────────────────────────────────────────────────────
const CRUNCH: MuscleShares = {
  rectus_abdominis_upper: 0.46, rectus_abdominis_lower: 0.22,
  external_oblique: 0.14, internal_oblique: 0.1, transversus_abdominis: 0.08,
};
const CABLE_CRUNCH: MuscleShares = {
  rectus_abdominis_upper: 0.44, rectus_abdominis_lower: 0.2,
  external_oblique: 0.14, internal_oblique: 0.1, transversus_abdominis: 0.07,
  latissimus_dorsi_upper: 0.05,
};
const SIT_UP: MuscleShares = {
  rectus_abdominis_upper: 0.34, rectus_abdominis_lower: 0.22, psoas_major: 0.14,
  iliacus: 0.1, external_oblique: 0.12, internal_oblique: 0.08,
};
const REVERSE_CRUNCH: MuscleShares = {
  rectus_abdominis_lower: 0.4, rectus_abdominis_upper: 0.18,
  transversus_abdominis: 0.14, external_oblique: 0.12, psoas_major: 0.1,
  internal_oblique: 0.06,
};
const BICYCLE_CRUNCH: MuscleShares = {
  external_oblique: 0.26, internal_oblique: 0.22, rectus_abdominis_upper: 0.18,
  rectus_abdominis_lower: 0.14, psoas_major: 0.1, transversus_abdominis: 0.1,
};
const LEG_RAISE: MuscleShares = {
  rectus_abdominis_lower: 0.36, rectus_abdominis_upper: 0.16, psoas_major: 0.14,
  iliacus: 0.1, external_oblique: 0.12, internal_oblique: 0.06,
  transversus_abdominis: 0.06,
};
const HANGING_LEG_RAISE: MuscleShares = {
  rectus_abdominis_lower: 0.32, rectus_abdominis_upper: 0.14, psoas_major: 0.13,
  iliacus: 0.09, external_oblique: 0.11, internal_oblique: 0.06,
  transversus_abdominis: 0.05, latissimus_dorsi_upper: 0.05, wrist_flexors: 0.05,
};
const TOES_TO_BAR: MuscleShares = {
  rectus_abdominis_lower: 0.28, rectus_abdominis_upper: 0.14, psoas_major: 0.12,
  iliacus: 0.08, external_oblique: 0.1, latissimus_dorsi_upper: 0.1,
  wrist_flexors: 0.06, internal_oblique: 0.06, transversus_abdominis: 0.06,
};
const PLANK: MuscleShares = {
  transversus_abdominis: 0.26, rectus_abdominis_upper: 0.2,
  rectus_abdominis_lower: 0.16, external_oblique: 0.12, internal_oblique: 0.1,
  deltoid_anterior: 0.06, serratus_anterior: 0.06, gluteus_maximus: 0.04,
};
const SIDE_PLANK: MuscleShares = {
  external_oblique: 0.28, internal_oblique: 0.24, quadratus_lumborum: 0.16,
  transversus_abdominis: 0.12, gluteus_medius: 0.12, deltoid_lateral: 0.08,
};
const AB_WHEEL: MuscleShares = {
  rectus_abdominis_upper: 0.26, rectus_abdominis_lower: 0.22,
  transversus_abdominis: 0.16, external_oblique: 0.1,
  latissimus_dorsi_upper: 0.1, internal_oblique: 0.06, triceps_long_head: 0.05,
  erector_spinae_longissimus: 0.05,
};
const TRUNK_ROTATION: MuscleShares = {
  external_oblique: 0.34, internal_oblique: 0.28, rectus_abdominis_upper: 0.14,
  transversus_abdominis: 0.1, multifidus: 0.06, quadratus_lumborum: 0.08,
};
const ANTI_ROTATION: MuscleShares = {
  external_oblique: 0.26, internal_oblique: 0.24, transversus_abdominis: 0.2,
  rectus_abdominis_upper: 0.1, quadratus_lumborum: 0.08, multifidus: 0.06,
  deltoid_anterior: 0.06,
};
const DEAD_BUG: MuscleShares = {
  transversus_abdominis: 0.3, rectus_abdominis_lower: 0.22,
  rectus_abdominis_upper: 0.16, external_oblique: 0.12, internal_oblique: 0.1,
  psoas_major: 0.1,
};
const HOLLOW_HOLD: MuscleShares = {
  rectus_abdominis_lower: 0.3, rectus_abdominis_upper: 0.24,
  transversus_abdominis: 0.2, external_oblique: 0.1, internal_oblique: 0.08,
  psoas_major: 0.08,
};
const L_SIT: MuscleShares = {
  rectus_abdominis_lower: 0.26, rectus_abdominis_upper: 0.16, psoas_major: 0.16,
  iliacus: 0.1, transversus_abdominis: 0.1, rectus_femoris: 0.08,
  triceps_lateral_head: 0.07, latissimus_dorsi_lower: 0.07,
};
const MOUNTAIN_CLIMBER: MuscleShares = {
  rectus_abdominis_lower: 0.22, rectus_abdominis_upper: 0.16, psoas_major: 0.14,
  transversus_abdominis: 0.12, external_oblique: 0.12, deltoid_anterior: 0.08,
  serratus_anterior: 0.06, iliacus: 0.06, triceps_lateral_head: 0.04,
};

// ── neck ─────────────────────────────────────────────────────────────────────
const NECK_FLEXION: MuscleShares = {
  sternocleidomastoid: 0.58, scalenes: 0.28, splenius_cervicis: 0.14,
};
const NECK_EXTENSION: MuscleShares = {
  splenius_capitis: 0.38, splenius_cervicis: 0.32, trapezius_upper: 0.2,
  levator_scapulae: 0.1,
};

// ── olympic, carries and conditioning ────────────────────────────────────────
const OLYMPIC_PULL: MuscleShares = {
  gluteus_maximus: 0.16, vastus_lateralis: 0.11, vastus_medialis: 0.08,
  biceps_femoris_long: 0.08, erector_spinae_longissimus: 0.1,
  erector_spinae_iliocostalis: 0.06, trapezius_upper: 0.13, soleus: 0.07,
  gastrocnemius_medial: 0.05, deltoid_anterior: 0.06, wrist_flexors: 0.05,
  rectus_femoris: 0.05,
};
const JERK: MuscleShares = {
  deltoid_anterior: 0.22, triceps_long_head: 0.11, triceps_lateral_head: 0.09,
  vastus_lateralis: 0.13, gluteus_maximus: 0.13, deltoid_lateral: 0.08,
  trapezius_upper: 0.08, soleus: 0.06, rectus_abdominis_upper: 0.05,
  triceps_medial_head: 0.05,
};
const OVERHEAD_SQUAT: MuscleShares = {
  vastus_lateralis: 0.16, vastus_medialis: 0.13, gluteus_maximus: 0.14,
  deltoid_anterior: 0.1, trapezius_upper: 0.09, rectus_femoris: 0.08,
  erector_spinae_longissimus: 0.08, triceps_long_head: 0.06,
  adductor_magnus: 0.06, rectus_abdominis_upper: 0.05, deltoid_lateral: 0.05,
};
const THRUSTER: MuscleShares = {
  vastus_lateralis: 0.15, vastus_medialis: 0.11, gluteus_maximus: 0.16,
  deltoid_anterior: 0.16, deltoid_lateral: 0.08, triceps_long_head: 0.08,
  triceps_lateral_head: 0.06, erector_spinae_longissimus: 0.07,
  rectus_abdominis_upper: 0.05, soleus: 0.04, adductor_magnus: 0.04,
};
const WALL_BALL: MuscleShares = {
  vastus_lateralis: 0.16, gluteus_maximus: 0.16, deltoid_anterior: 0.16,
  vastus_medialis: 0.12, triceps_long_head: 0.1, deltoid_lateral: 0.08,
  rectus_abdominis_upper: 0.08, soleus: 0.07, erector_spinae_longissimus: 0.07,
};
const BURPEE: MuscleShares = {
  pec_major_sternal: 0.12, deltoid_anterior: 0.12, triceps_lateral_head: 0.1,
  gluteus_maximus: 0.16, vastus_lateralis: 0.14, rectus_abdominis_upper: 0.1,
  biceps_femoris_long: 0.07, soleus: 0.08, gastrocnemius_medial: 0.06,
  triceps_long_head: 0.05,
};
const BOX_JUMP: MuscleShares = {
  gluteus_maximus: 0.22, vastus_lateralis: 0.2, vastus_medialis: 0.14,
  gastrocnemius_medial: 0.12, soleus: 0.1, biceps_femoris_long: 0.08,
  rectus_femoris: 0.08, gastrocnemius_lateral: 0.06,
};
const TURKISH_GET_UP: MuscleShares = {
  deltoid_anterior: 0.16, deltoid_lateral: 0.1, external_oblique: 0.14,
  transversus_abdominis: 0.1, rectus_abdominis_upper: 0.1, gluteus_maximus: 0.14,
  vastus_lateralis: 0.1, trapezius_middle: 0.06, internal_oblique: 0.06,
  serratus_anterior: 0.04,
};
const FARMERS_CARRY: MuscleShares = {
  wrist_flexors: 0.22, trapezius_upper: 0.18, erector_spinae_longissimus: 0.1,
  quadratus_lumborum: 0.08, external_oblique: 0.08, gluteus_medius: 0.08,
  gluteus_maximus: 0.07, vastus_lateralis: 0.06, soleus: 0.06,
  levator_scapulae: 0.04, brachioradialis: 0.03,
};
const SUITCASE_CARRY: MuscleShares = {
  external_oblique: 0.2, quadratus_lumborum: 0.18, wrist_flexors: 0.16,
  internal_oblique: 0.1, trapezius_upper: 0.1, gluteus_medius: 0.1,
  erector_spinae_longissimus: 0.08, soleus: 0.05, brachioradialis: 0.03,
};
const OVERHEAD_CARRY: MuscleShares = {
  deltoid_anterior: 0.18, deltoid_lateral: 0.14, trapezius_upper: 0.14,
  triceps_long_head: 0.1, transversus_abdominis: 0.1, external_oblique: 0.1,
  erector_spinae_longissimus: 0.08, quadratus_lumborum: 0.06, wrist_flexors: 0.06,
  serratus_anterior: 0.04,
};
const BEAR_HUG_CARRY: MuscleShares = {
  pec_major_sternal: 0.14, biceps_short_head: 0.12,
  erector_spinae_longissimus: 0.14, rectus_abdominis_upper: 0.12,
  gluteus_maximus: 0.12, vastus_lateralis: 0.1, trapezius_upper: 0.08,
  external_oblique: 0.08, soleus: 0.05, brachialis: 0.05,
};
const YOKE_WALK: MuscleShares = {
  trapezius_upper: 0.16, erector_spinae_longissimus: 0.16, gluteus_maximus: 0.14,
  vastus_lateralis: 0.12, transversus_abdominis: 0.1, quadratus_lumborum: 0.08,
  external_oblique: 0.08, soleus: 0.08, adductor_magnus: 0.04, multifidus: 0.04,
};
const SLED_PUSH: MuscleShares = {
  vastus_lateralis: 0.2, vastus_medialis: 0.15, gluteus_maximus: 0.18,
  soleus: 0.12, gastrocnemius_medial: 0.09, biceps_femoris_long: 0.08,
  deltoid_anterior: 0.06, adductor_magnus: 0.06, rectus_abdominis_upper: 0.06,
};
const SLED_DRAG: MuscleShares = {
  vastus_lateralis: 0.26, vastus_medialis: 0.2, rectus_femoris: 0.14,
  gluteus_maximus: 0.12, soleus: 0.1, wrist_flexors: 0.06,
  rectus_abdominis_upper: 0.06, tibialis_anterior: 0.06,
};
const TIRE_FLIP: MuscleShares = {
  gluteus_maximus: 0.18, vastus_lateralis: 0.14, erector_spinae_longissimus: 0.12,
  biceps_femoris_long: 0.1, deltoid_anterior: 0.1, trapezius_upper: 0.08,
  latissimus_dorsi_upper: 0.08, triceps_long_head: 0.06, wrist_flexors: 0.06,
  adductor_magnus: 0.08,
};
const BATTLE_ROPE: MuscleShares = {
  deltoid_anterior: 0.2, deltoid_lateral: 0.12, latissimus_dorsi_upper: 0.12,
  rectus_abdominis_upper: 0.12, wrist_flexors: 0.1, external_oblique: 0.08,
  trapezius_upper: 0.08, deltoid_posterior: 0.06, vastus_lateralis: 0.06,
  gluteus_maximus: 0.06,
};
const JUMP_ROPE: MuscleShares = {
  gastrocnemius_medial: 0.24, gastrocnemius_lateral: 0.18, soleus: 0.22,
  tibialis_anterior: 0.1, wrist_flexors: 0.08, vastus_lateralis: 0.08,
  deltoid_anterior: 0.05, fibularis_longus: 0.05,
};
const RUNNING: MuscleShares = {
  gastrocnemius_medial: 0.14, soleus: 0.16, biceps_femoris_long: 0.14,
  gluteus_maximus: 0.14, vastus_lateralis: 0.13, rectus_femoris: 0.09,
  psoas_major: 0.07, tibialis_anterior: 0.06, gluteus_medius: 0.04,
  semitendinosus: 0.03,
};
const CYCLING: MuscleShares = {
  vastus_lateralis: 0.24, vastus_medialis: 0.18, rectus_femoris: 0.14,
  gluteus_maximus: 0.16, soleus: 0.1, gastrocnemius_medial: 0.08,
  biceps_femoris_long: 0.08, tibialis_anterior: 0.02,
};
const ERG_ROW: MuscleShares = {
  latissimus_dorsi_upper: 0.14, vastus_lateralis: 0.14, gluteus_maximus: 0.12,
  erector_spinae_longissimus: 0.1, trapezius_middle: 0.09, rhomboid_major: 0.07,
  biceps_long_head: 0.06, deltoid_posterior: 0.06, vastus_medialis: 0.08,
  soleus: 0.06, rectus_abdominis_upper: 0.04, brachialis: 0.04,
};
const SKI_ERG: MuscleShares = {
  latissimus_dorsi_upper: 0.2, latissimus_dorsi_lower: 0.1,
  triceps_long_head: 0.12, rectus_abdominis_upper: 0.12, pec_major_sternal: 0.08,
  trapezius_lower: 0.08, deltoid_posterior: 0.07, external_oblique: 0.07,
  gluteus_maximus: 0.06, triceps_lateral_head: 0.06, teres_major: 0.04,
};
const ELLIPTICAL: MuscleShares = {
  vastus_lateralis: 0.18, gluteus_maximus: 0.16, biceps_femoris_long: 0.12,
  soleus: 0.12, gastrocnemius_medial: 0.1, rectus_femoris: 0.08,
  latissimus_dorsi_upper: 0.06, triceps_long_head: 0.05, deltoid_posterior: 0.05,
  vastus_medialis: 0.08,
};
const STAIR_CLIMB: MuscleShares = {
  gluteus_maximus: 0.24, vastus_lateralis: 0.2, vastus_medialis: 0.13,
  soleus: 0.12, gastrocnemius_medial: 0.09, biceps_femoris_long: 0.08,
  gluteus_medius: 0.07, rectus_femoris: 0.07,
};
const AIR_BIKE: MuscleShares = {
  vastus_lateralis: 0.18, gluteus_maximus: 0.14, rectus_femoris: 0.12,
  latissimus_dorsi_upper: 0.1, deltoid_anterior: 0.1, triceps_long_head: 0.08,
  soleus: 0.08, biceps_femoris_long: 0.08, vastus_medialis: 0.08,
  rectus_abdominis_upper: 0.04,
};

// ─────────────────────────────────────────────────────────────────────────────
// The catalog
// ─────────────────────────────────────────────────────────────────────────────

const CHEST: readonly SeedExercise[] = [
  ex({
    m: 'bench_press', eq: 'barbell', pattern: 'horizontal_push', force: 'push',
    mech: 'compound', arch: 'horizontal_press', sh: FLAT_PRESS,
    std: std('bench-press--barbell', 1),
    alias: ['flat bench', 'bench'],
    cues: [
      'Set the bar over your eyes, shoulder blades pulled back and down.',
      'Lower to the lower chest with the forearms stacked under the bar.',
      'Drive the bar back up and slightly toward your face.',
    ],
  }),
  ex({
    m: 'bench_press', eq: 'barbell', v: ['incline'], pattern: 'horizontal_push',
    force: 'push', mech: 'compound', arch: 'incline_press', sh: INCLINE_PRESS,
    std: std('bench-press--barbell', 0.8),
    alias: ['incline bench'],
    cues: [
      'Set the bench near 30 degrees; steeper turns it into a shoulder press.',
      'Touch the bar high on the chest, just under the collarbones.',
      'Keep the ribcage down so the bench angle stays honest.',
    ],
  }),
  ex({
    m: 'bench_press', eq: 'barbell', v: ['decline'], pattern: 'horizontal_push',
    force: 'push', mech: 'compound', arch: 'horizontal_press', sh: DECLINE_PRESS,
    std: std('bench-press--barbell', 1.05, false),
    alias: ['decline bench'],
    cues: [
      'Hook your legs in before unracking; use a spotter if the bar is heavy.',
      'Touch low on the chest and press straight up over the shoulders.',
    ],
  }),
  ex({
    m: 'bench_press', eq: 'barbell', v: ['close_grip'], pattern: 'horizontal_push',
    force: 'push', mech: 'compound', arch: 'horizontal_press', sh: CLOSE_GRIP_PRESS,
    std: std('bench-press--barbell', 0.88),
    alias: ['cgbp'],
    cues: [
      'Grip about shoulder width, no narrower, to spare the wrists.',
      'Tuck the elbows to roughly 45 degrees and brush the ribs on the way down.',
      'Push the bar away with the triceps instead of squeezing the chest.',
    ],
  }),
  ex({
    m: 'bench_press', eq: 'barbell', v: ['paused'], pattern: 'horizontal_push',
    force: 'push', mech: 'compound', arch: 'horizontal_press', sh: FLAT_PRESS,
    std: std('bench-press--barbell', 0.95),
    cues: [
      'Take a full second on the chest with the bar dead still.',
      'Stay tight through the pause; do not let the ribcage sink.',
      'Press without a bounce.',
    ],
  }),
  ex({
    m: 'bench_press', eq: 'barbell', v: ['floor'], pattern: 'horizontal_push',
    force: 'push', mech: 'compound', arch: 'horizontal_press', sh: CLOSE_GRIP_PRESS,
    alias: ['floor press'],
    cues: [
      'Lie flat on the floor with the bar over the chest.',
      'Let the upper arms rest for a beat when they touch down.',
      'Press from a dead stop: no leg drive, no stretch reflex.',
    ],
  }),
  ex({
    m: 'bench_press', eq: 'dumbbell', pattern: 'horizontal_push', force: 'push',
    mech: 'compound', arch: 'horizontal_press', sh: FLAT_PRESS,
    std: std('bench-press--barbell', 0.45),
    cues: [
      'Kick the dumbbells up to the start with your knees.',
      'Lower until the handles are level with the chest.',
      'Press up and slightly together without clanging them at the top.',
    ],
  }),
  ex({
    m: 'bench_press', eq: 'dumbbell', v: ['incline'], pattern: 'horizontal_push',
    force: 'push', mech: 'compound', arch: 'incline_press', sh: INCLINE_PRESS,
    std: std('bench-press--barbell', 0.38),
    cues: [
      'Bench at 30 to 45 degrees, feet planted.',
      'Lower under control until the upper chest stretches.',
      'Keep the wrists stacked over the elbows throughout.',
    ],
  }),
  ex({
    m: 'bench_press', eq: 'dumbbell', v: ['decline'], pattern: 'horizontal_push',
    force: 'push', mech: 'compound', arch: 'horizontal_press', sh: DECLINE_PRESS,
    cues: [
      'Secure your legs, then bring the dumbbells to the low chest.',
      'Press up in a slight arc and stop short of a hard lockout.',
    ],
  }),
  ex({
    m: 'bench_press', eq: 'dumbbell', v: ['neutral_grip'], pattern: 'horizontal_push',
    force: 'push', mech: 'compound', arch: 'horizontal_press', sh: FLAT_PRESS,
    alias: ['hex press', 'neutral grip db bench'],
    cues: [
      'Hold the dumbbells with the palms facing each other.',
      'Keep the elbows tucked close to the ribs as you lower.',
      'Usually kinder to the shoulder than a pronated grip.',
    ],
  }),
  ex({
    m: 'bench_press', eq: 'smith_machine', pattern: 'horizontal_push', force: 'push',
    mech: 'compound', arch: 'horizontal_press', sh: FLAT_PRESS,
    cues: [
      'Set the bench so the fixed bar path meets the lower chest.',
      'Unhook, lower to a light touch, and press back to the stops.',
    ],
  }),
  ex({
    m: 'bench_press', eq: 'smith_machine', v: ['incline'], pattern: 'horizontal_push',
    force: 'push', mech: 'compound', arch: 'incline_press', sh: INCLINE_PRESS,
    cues: [
      'Slide the incline bench so the bar lands on the upper chest.',
      'The fixed path lets you chase the stretch without balancing the bar.',
    ],
  }),
  ex({
    m: 'chest_press', eq: 'machine_selectorized', pattern: 'horizontal_push',
    force: 'push', mech: 'compound', arch: 'machine_chest_press', sh: FLAT_PRESS,
    cues: [
      'Set the seat so the handles line up with the mid chest.',
      'Press out until the elbows are almost straight, then return slowly.',
    ],
  }),
  ex({
    m: 'chest_press', eq: 'machine_plate_loaded', pattern: 'horizontal_push',
    force: 'push', mech: 'compound', arch: 'machine_chest_press', sh: FLAT_PRESS,
    alias: ['hammer strength chest press'],
    cues: [
      'Keep the shoulder blades pinned to the pad.',
      'Push through the heel of the hand and let the chest do the work.',
    ],
  }),
  ex({
    m: 'chest_press', eq: 'machine_plate_loaded', v: ['incline'],
    pattern: 'horizontal_push', force: 'push', mech: 'compound',
    arch: 'machine_chest_press', sh: INCLINE_PRESS,
    cues: [
      'Sit tall with the handles at collarbone height.',
      'Drive up and in without shrugging the shoulders.',
    ],
  }),
  ex({
    m: 'chest_press', eq: 'machine_selectorized', v: ['decline'],
    pattern: 'horizontal_push', force: 'push', mech: 'compound',
    arch: 'machine_chest_press', sh: DECLINE_PRESS,
    cues: [
      'Set the handles below the chest line.',
      'Press down and forward, squeezing the lower chest at the finish.',
    ],
  }),
  ex({
    m: 'chest_fly', eq: 'dumbbell', pattern: 'isolation_adduction', force: 'push',
    mech: 'isolation', arch: 'chest_fly', sh: CHEST_FLY,
    alias: ['dumbbell flye'],
    cues: [
      'Keep a soft, fixed bend in the elbows for the whole set.',
      'Open until you feel the chest stretch, not the shoulder joint.',
      'Hug the weights back together over the sternum.',
    ],
  }),
  ex({
    m: 'chest_fly', eq: 'dumbbell', v: ['incline'], pattern: 'isolation_adduction',
    force: 'push', mech: 'isolation', arch: 'chest_fly', sh: INCLINE_FLY,
    cues: [
      'Set a shallow incline so the tension stays on the upper chest.',
      'Lower slowly and stop when the stretch peaks.',
    ],
  }),
  ex({
    m: 'chest_fly', eq: 'cable', v: ['single_arm'], limb: 'unilateral_sequential',
    pattern: 'isolation_adduction', force: 'push', mech: 'isolation',
    arch: 'chest_fly', sh: CHEST_FLY, att: 'd_handle',
    cues: [
      'Stand side on with the pulley at chest height.',
      'Sweep the handle across the body and pause at the squeeze.',
      'Resist the stretch on the way back rather than dropping into it.',
    ],
  }),
  ex({
    m: 'pec_deck', eq: 'machine_selectorized', pattern: 'isolation_adduction',
    force: 'push', mech: 'isolation', arch: 'chest_fly', sh: CHEST_FLY,
    alias: ['machine fly', 'butterfly'],
    cues: [
      'Set the seat so the handles sit at chest height with the elbows soft.',
      'Bring the pads together and hold briefly.',
      'Let them travel back until the chest is fully lengthened.',
    ],
  }),
  ex({
    m: 'cable_crossover', eq: 'cable', pattern: 'isolation_adduction', force: 'push',
    mech: 'isolation', arch: 'chest_fly', sh: CHEST_FLY, att: 'd_handle',
    cues: [
      'Pulleys at shoulder height, one foot staggered forward.',
      'Sweep the handles together in front of the sternum.',
      'Keep the elbow angle constant so this stays a fly, not a press.',
    ],
  }),
  ex({
    m: 'cable_crossover', eq: 'cable', v: ['incline'], pattern: 'isolation_adduction',
    force: 'push', mech: 'isolation', arch: 'chest_fly', sh: LOW_TO_HIGH_FLY,
    alias: ['low to high cable fly'],
    cues: [
      'Set both pulleys at the bottom of the track.',
      'Sweep upward and finish with the hands near chin height.',
      'Biases the clavicular fibres of the chest.',
    ],
  }),
  ex({
    m: 'cable_crossover', eq: 'cable', v: ['decline'], pattern: 'isolation_adduction',
    force: 'push', mech: 'isolation', arch: 'chest_fly', sh: HIGH_TO_LOW_FLY,
    alias: ['high to low cable fly'],
    cues: [
      'Set the pulleys high and lean in slightly.',
      'Drive the hands down and together toward the hips.',
      'Squeeze the lower chest before letting the cables pull you back.',
    ],
  }),
  ex({
    m: 'push_up', eq: 'bodyweight', pattern: 'horizontal_push', force: 'push',
    mech: 'compound', track: 'bodyweight_reps', bw: BW.push_up, arch: 'push_up',
    sh: PUSH_UP,
    cues: [
      'Hands just outside the shoulders, body in one straight line.',
      'Lower until the chest is a fist above the floor.',
      'Push the floor away and let the shoulder blades spread at the top.',
    ],
  }),
  ex({
    m: 'push_up', eq: 'bodyweight', v: ['incline'], pattern: 'horizontal_push',
    force: 'push', mech: 'compound', track: 'bodyweight_reps',
    bw: BW.push_up_hands_elevated_30cm, arch: 'push_up', sh: PUSH_UP,
    cues: [
      'Put the hands on a bench or bar so the torso sits above the feet.',
      'The higher the hands, the less bodyweight you carry.',
    ],
  }),
  ex({
    m: 'push_up', eq: 'bodyweight', v: ['decline'], pattern: 'horizontal_push',
    force: 'push', mech: 'compound', track: 'bodyweight_reps',
    bw: BW.push_up_feet_elevated_30cm, arch: 'push_up', sh: PUSH_UP,
    cues: [
      'Feet on a box, hands on the floor.',
      'Keep the hips from sagging as the load shifts to the upper chest.',
    ],
  }),
  ex({
    m: 'push_up', eq: 'bodyweight', v: ['close_grip'], pattern: 'horizontal_push',
    force: 'push', mech: 'compound', track: 'bodyweight_reps', bw: BW.push_up,
    arch: 'push_up', sh: CLOSE_GRIP_PRESS,
    alias: ['diamond push up', 'triangle pushup'],
    cues: [
      'Hands under the sternum, index fingers close together.',
      'Keep the elbows brushing the ribs on the descent.',
    ],
  }),
  ex({
    m: 'push_up', eq: 'weighted_vest', load: 'weighted', pattern: 'horizontal_push',
    force: 'push', mech: 'compound', track: 'weighted_bodyweight', bw: BW.push_up,
    arch: 'push_up', sh: PUSH_UP,
    cues: [
      'Log the vest weight only; the app adds your bodyweight share.',
      'Brace hard so the extra load does not pull the hips down.',
    ],
  }),
  ex({
    m: 'push_up', eq: 'gymnastic_rings', pattern: 'horizontal_push', force: 'push',
    mech: 'compound', track: 'bodyweight_reps', bw: BW.push_up, arch: 'push_up',
    sh: PUSH_UP,
    cues: [
      'Set the rings a few inches off the floor and turn them out at the top.',
      'The wobble is the point; move slower than you would on the floor.',
    ],
  }),
  ex({
    m: 'chest_dip', eq: 'bodyweight', pattern: 'horizontal_push', force: 'push',
    mech: 'compound', track: 'bodyweight_reps', bw: BW.dip, arch: 'dip',
    sh: CHEST_DIP,
    cues: [
      'Lean the torso forward about 30 degrees and let the elbows flare a little.',
      'Descend until the upper arms pass parallel, shoulders staying down.',
      'Press back up without snapping the elbows straight.',
    ],
  }),
  ex({
    m: 'chest_dip', eq: 'dip_belt', load: 'weighted', pattern: 'horizontal_push',
    force: 'push', mech: 'compound', track: 'weighted_bodyweight', bw: BW.dip,
    arch: 'dip', sh: CHEST_DIP,
    cues: [
      'Hang the plates from a belt and step onto the bars carefully.',
      'Keep the forward lean; added weight tempts you upright.',
    ],
  }),
  ex({
    m: 'chest_dip', eq: 'assisted_machine', load: 'assisted',
    pattern: 'horizontal_push', force: 'push', mech: 'compound',
    track: 'assisted_bodyweight', bw: BW.dip, arch: 'dip', sh: CHEST_DIP,
    cues: [
      'Log the assistance weight: more assistance means an easier set.',
      'Kneel on the pad and keep the same forward lean as a free dip.',
    ],
  }),
  ex({
    m: 'landmine_press', eq: 'landmine', v: ['single_arm'],
    limb: 'unilateral_sequential', pattern: 'horizontal_push', force: 'push',
    mech: 'compound', arch: 'incline_press', sh: LANDMINE_PRESS,
    cues: [
      'Hold the bar end at the shoulder in a staggered stance.',
      'Press up and slightly across the body.',
      'A usable option for shoulders that dislike a straight overhead press.',
    ],
  }),
];

const BACK: readonly SeedExercise[] = [
  ex({
    m: 'deadlift', eq: 'barbell', force: 'pull', mech: 'compound', arch: 'deadlift',
    sh: DEADLIFT_CONVENTIONAL, std: std('deadlift--barbell', 1),
    alias: ['conventional deadlift'],
    cues: [
      'Bar over mid foot, shins almost touching, shoulders just past the bar.',
      'Squeeze the bar off the floor rather than yanking it.',
      'Stand tall by pushing the floor away and finishing with the glutes.',
    ],
  }),
  ex({
    m: 'deadlift', eq: 'barbell', v: ['sumo'], force: 'pull', mech: 'compound',
    arch: 'deadlift', sh: DEADLIFT_SUMO, std: std('deadlift--barbell', 1),
    cues: [
      'Wide stance, toes turned out, hands inside the knees.',
      'Drop the hips and open the knees out over the toes.',
      'Push the floor apart; the bar should track straight up the shins.',
    ],
  }),
  ex({
    m: 'deadlift', eq: 'barbell', v: ['deficit'], force: 'pull', mech: 'compound',
    arch: 'deadlift', sh: DEADLIFT_CONVENTIONAL, std: std('deadlift--barbell', 0.9),
    cues: [
      'Stand on a 2 to 4 cm platform so the bar starts lower.',
      'Expect a harder first few centimetres and keep the back angle honest.',
    ],
  }),
  ex({
    m: 'deadlift', eq: 'barbell', v: ['paused'], force: 'pull', mech: 'compound',
    arch: 'deadlift', sh: DEADLIFT_CONVENTIONAL, std: std('deadlift--barbell', 0.85),
    cues: [
      'Pause for a second once the bar clears the knee.',
      'Hold position rather than resting the bar on the thigh.',
    ],
  }),
  ex({
    m: 'deadlift', eq: 'barbell', v: ['wide_grip'], force: 'pull', mech: 'compound',
    arch: 'deadlift', sh: DEADLIFT_CONVENTIONAL, std: std('deadlift--barbell', 0.8),
    alias: ['snatch grip deadlift'],
    cues: [
      'Take a snatch-width grip so the hips sit lower at the start.',
      'Upper back works far harder here; keep it from rounding.',
    ],
  }),
  ex({
    m: 'deadlift', eq: 'trap_bar', force: 'pull', mech: 'compound', arch: 'deadlift',
    sh: TRAP_BAR_DEADLIFT, std: std('deadlift--barbell', 1.1, false),
    alias: ['hex bar deadlift'],
    cues: [
      'Stand in the middle of the bar with the handles beside the hips.',
      'More knee bend and a more upright torso than a straight-bar pull.',
      'Stand up, then lower the bar without letting it drift forward.',
    ],
  }),
  ex({
    m: 'romanian_deadlift', eq: 'barbell', force: 'pull', mech: 'compound',
    arch: 'romanian_deadlift', sh: ROMANIAN_DEADLIFT,
    std: std('deadlift--barbell', 0.75),
    alias: ['rdl'],
    cues: [
      'Start standing with the bar at the hips and knees softly bent.',
      'Push the hips back and slide the bar down the thighs.',
      'Stop when the hamstrings run out of stretch, then drive the hips forward.',
    ],
  }),
  ex({
    m: 'romanian_deadlift', eq: 'dumbbell', force: 'pull', mech: 'compound',
    arch: 'romanian_deadlift', sh: ROMANIAN_DEADLIFT,
    cues: [
      'Hold the dumbbells in front of the thighs, knees soft.',
      'Hinge back until the hamstrings tighten, keeping the bells close.',
    ],
  }),
  ex({
    m: 'romanian_deadlift', eq: 'dumbbell', v: ['single_leg'],
    limb: 'unilateral_sequential', force: 'pull', mech: 'compound',
    arch: 'romanian_deadlift', sh: ROMANIAN_DEADLIFT,
    cues: [
      'Stand on one leg, the other trailing behind as a counterweight.',
      'Hinge until the torso is near parallel and the hips stay square.',
      'Log one set per leg.',
    ],
  }),
  ex({
    m: 'stiff_leg_deadlift', eq: 'barbell', force: 'pull', mech: 'compound',
    arch: 'romanian_deadlift', sh: STIFF_LEG_DEADLIFT,
    std: std('deadlift--barbell', 0.7),
    alias: ['sldl'],
    cues: [
      'Knees stay nearly locked, so the range comes from the hips.',
      'Lower until the bar reaches mid shin with a flat back.',
      'Lighter than an RDL; the leverage is worse on purpose.',
    ],
  }),
  ex({
    m: 'rack_pull', eq: 'barbell', force: 'pull', mech: 'compound', arch: 'deadlift',
    sh: RACK_PULL, std: std('deadlift--barbell', 1.2, false),
    cues: [
      'Set the pins around knee height and start from a dead stop.',
      'Drive the hips through; do not turn it into a shrug.',
    ],
  }),
  ex({
    m: 'good_morning', eq: 'barbell', force: 'pull', mech: 'compound',
    arch: 'good_morning', sh: GOOD_MORNING, std: std('deadlift--barbell', 0.45, false),
    cues: [
      'Bar on the upper back as in a squat, knees slightly bent.',
      'Hinge forward until the torso approaches parallel.',
      'Start far lighter than feels necessary.',
    ],
  }),
  ex({
    m: 'good_morning', eq: 'safety_squat_bar', force: 'pull', mech: 'compound',
    arch: 'good_morning', sh: GOOD_MORNING,
    cues: [
      'The cambered handles keep the shoulders out of an awkward position.',
      'Hinge back and let the upper back resist the forward pull.',
    ],
  }),
  ex({
    m: 'back_extension', eq: 'back_extension_bench', force: 'pull', mech: 'isolation',
    track: 'bodyweight_reps', arch: 'back_extension', sh: BACK_EXTENSION,
    alias: ['hyperextension', '45 degree back extension'],
    cues: [
      'Set the pad just below the hip crease.',
      'Lower until you feel the hamstrings, then extend to a straight line.',
      'Stop at straight: arching past it is not extra range.',
    ],
  }),
  ex({
    m: 'back_extension', eq: 'ghd', force: 'pull', mech: 'isolation',
    track: 'bodyweight_reps', arch: 'back_extension', sh: BACK_EXTENSION,
    cues: [
      'Horizontal version on the glute ham developer.',
      'Squeeze the glutes to finish rather than cranking the lower back.',
    ],
  }),
  ex({
    m: 'reverse_hyperextension', eq: 'reverse_hyper', force: 'pull', mech: 'isolation',
    arch: 'back_extension', sh: REVERSE_HYPER,
    alias: ['reverse hyper'],
    cues: [
      'Lie face down with the hips off the end of the pad.',
      'Swing the legs up to horizontal using the glutes.',
      'Control the return instead of letting the pendulum throw you.',
    ],
  }),
  ex({
    m: 'bent_over_row', eq: 'barbell', force: 'pull',
    mech: 'compound', arch: 'bent_over_row', sh: HORIZONTAL_ROW,
    std: std('bent-over-row--barbell', 1),
    alias: ['barbell row', 'bor'],
    cues: [
      'Hinge to about 45 degrees with the bar hanging under the shoulders.',
      'Pull to the belly button and squeeze the shoulder blades together.',
      'Keep the torso angle fixed; do not row with the hips.',
    ],
  }),
  ex({
    m: 'bent_over_row', eq: 'barbell', v: ['reverse_grip'], force: 'pull',
    mech: 'compound', arch: 'bent_over_row', sh: HORIZONTAL_ROW,
    alias: ['yates row', 'underhand barbell row'],
    cues: [
      'Take an underhand grip about shoulder width.',
      'Pull low, toward the hips, with the elbows staying close.',
    ],
  }),
  ex({
    m: 'pendlay_row', eq: 'barbell', force: 'pull', mech: 'compound',
    arch: 'bent_over_row', sh: HORIZONTAL_ROW,
    cues: [
      'Torso parallel to the floor, bar resting on the ground between reps.',
      'Explode the bar to the lower ribs, then set it back down.',
      'Every rep starts dead, so there is no bounce to borrow.',
    ],
  }),
  ex({
    m: 'bent_over_row', eq: 'dumbbell', v: ['single_arm'],
    limb: 'unilateral_sequential', force: 'pull', mech: 'compound',
    arch: 'single_arm_row', sh: SINGLE_ARM_ROW,
    alias: ['one arm dumbbell row', 'kroc row'],
    cues: [
      'Brace a hand and knee on the bench, back flat.',
      'Pull the dumbbell to the hip, leading with the elbow.',
      'Let the shoulder blade travel at the bottom rather than locking it.',
    ],
  }),
  ex({
    m: 'bent_over_row', eq: 'dumbbell', v: ['chest_supported'], force: 'pull',
    mech: 'compound', arch: 'chest_supported_row', sh: ROW_SUPPORTED,
    cues: [
      'Lie chest down on an incline bench set around 30 degrees.',
      'Row the dumbbells up and slightly out, squeezing at the top.',
      'The pad removes the lower back from the equation.',
    ],
  }),
  ex({
    m: 'seal_row', eq: 'barbell', force: 'pull', mech: 'compound',
    arch: 'chest_supported_row', sh: ROW_SUPPORTED,
    cues: [
      'Lie face down on a raised flat bench with the bar underneath.',
      'Row to the bench and pause; nothing else can move.',
    ],
  }),
  ex({
    m: 'seal_row', eq: 'dumbbell', force: 'pull', mech: 'compound',
    arch: 'chest_supported_row', sh: ROW_SUPPORTED,
    cues: [
      'Same strict setup as the barbell version, with a longer range.',
      'Keep the chest glued to the bench all the way up.',
    ],
  }),
  ex({
    m: 't_bar_row', eq: 'landmine', force: 'pull', mech: 'compound',
    arch: 'bent_over_row', sh: HORIZONTAL_ROW,
    cues: [
      'Straddle the bar and hook a close-grip handle under it.',
      'Hinge over and row to the sternum.',
      'Let the shoulder blades come apart at the bottom.',
    ],
  }),
  ex({
    m: 't_bar_row', eq: 'machine_plate_loaded', v: ['chest_supported'], force: 'pull',
    mech: 'compound', arch: 'chest_supported_row', sh: ROW_SUPPORTED,
    cues: [
      'Chest on the pad, feet planted on the platform.',
      'Row the handles back until the elbows pass the ribs.',
    ],
  }),
  ex({
    m: 'seated_row', eq: 'cable', force: 'pull', mech: 'compound',
    arch: 'seated_cable_row', sh: SEATED_CABLE_ROW, att: 'v_bar',
    alias: ['cable row'],
    cues: [
      'Sit tall with a slight knee bend and the chest up.',
      'Pull the handle to the navel and hold the squeeze for a beat.',
      'Let the arms straighten fully without collapsing the chest.',
    ],
  }),
  ex({
    m: 'seated_row', eq: 'cable', v: ['wide_grip'], force: 'pull', mech: 'compound',
    arch: 'seated_cable_row', sh: SEATED_CABLE_ROW,
    cues: [
      'Use a wide bar and pull higher, toward the lower chest.',
      'Biases the upper back over the lats.',
    ],
  }),
  ex({
    m: 'seated_row', eq: 'cable', v: ['single_arm'], limb: 'unilateral_sequential',
    force: 'pull', mech: 'compound', arch: 'single_arm_row', sh: SINGLE_ARM_ROW,
    cues: [
      'One handle, one arm, torso square to the machine.',
      'Allow a little reach at the front and a full squeeze at the back.',
    ],
  }),
  ex({
    m: 'seated_row', eq: 'machine_selectorized', v: ['chest_supported'], force: 'pull',
    mech: 'compound', arch: 'chest_supported_row', sh: ROW_SUPPORTED,
    cues: [
      'Set the chest pad so the handles sit level with the sternum.',
      'Drive the elbows back and down; stop when the chest pad resists.',
    ],
  }),
  ex({
    m: 'meadows_row', eq: 'landmine', v: ['single_arm'], limb: 'unilateral_sequential',
    force: 'pull', mech: 'compound', arch: 'single_arm_row', sh: MEADOWS_ROW,
    cues: [
      'Stand side on to the bar end with a staggered stance.',
      'Row the sleeve up toward the hip with the elbow high.',
    ],
  }),
  ex({
    m: 'renegade_row', eq: 'dumbbell', limb: 'unilateral_alternating',
    pattern: 'anti_rotation', force: 'pull', mech: 'compound',
    arch: 'single_arm_row', sh: RENEGADE_ROW,
    cues: [
      'Start in a push-up position gripping two dumbbells.',
      'Row one bell while the hips stay perfectly level.',
      'Widen the feet if the torso twists.',
    ],
  }),
  ex({
    m: 'inverted_row', eq: 'bodyweight', force: 'pull', mech: 'compound',
    track: 'bodyweight_reps', bw: BW.inverted_row_feet_floor, arch: 'inverted_row',
    sh: INVERTED_ROW,
    alias: ['australian pull up', 'bodyweight row'],
    cues: [
      'Set a bar at hip height and hang underneath it, body straight.',
      'Pull the chest to the bar and keep the hips from sagging.',
      'Walk the feet further out to make it harder.',
    ],
  }),
  ex({
    m: 'inverted_row', eq: 'suspension_trainer', force: 'pull', mech: 'compound',
    track: 'bodyweight_reps', bw: BW.inverted_row_feet_floor, arch: 'inverted_row',
    sh: INVERTED_ROW,
    alias: ['trx row'],
    cues: [
      'Grip the handles and lean back until the arms are straight.',
      'Row until the handles reach the ribs, wrists neutral.',
    ],
  }),
  ex({
    m: 'pull_up', eq: 'bodyweight', force: 'pull', mech: 'compound',
    track: 'bodyweight_reps', bw: BW.pull_up, arch: 'vertical_pull',
    sh: VERTICAL_PULL_WIDE, std: std('pull-up--bodyweight', 1),
    cues: [
      'Overhand grip a little wider than the shoulders.',
      'Pull the elbows down to the ribs until the chin clears the bar.',
      'Lower all the way to straight arms every rep.',
    ],
  }),
  ex({
    m: 'pull_up', eq: 'bodyweight', v: ['wide_grip'], force: 'pull', mech: 'compound',
    track: 'bodyweight_reps', bw: BW.pull_up, arch: 'vertical_pull',
    sh: VERTICAL_PULL_WIDE,
    cues: [
      'Hands well outside the shoulders, thumbs over the bar if it feels better.',
      'Shorter range, more lat, less biceps.',
    ],
  }),
  ex({
    m: 'pull_up', eq: 'bodyweight', v: ['neutral_grip'], force: 'pull',
    mech: 'compound', track: 'bodyweight_reps', bw: BW.pull_up, arch: 'vertical_pull',
    sh: VERTICAL_PULL_NEUTRAL,
    alias: ['hammer grip pull up'],
    cues: [
      'Palms facing each other on parallel handles.',
      'The friendliest grip for most shoulders and elbows.',
    ],
  }),
  ex({
    m: 'pull_up', eq: 'dip_belt', load: 'weighted', force: 'pull', mech: 'compound',
    track: 'weighted_bodyweight', bw: BW.pull_up, arch: 'vertical_pull',
    sh: VERTICAL_PULL_WIDE,
    cues: [
      'Hang the plates from a belt and keep the legs still.',
      'Log the added weight only.',
    ],
  }),
  ex({
    m: 'pull_up', eq: 'assisted_machine', load: 'assisted', force: 'pull',
    mech: 'compound', track: 'assisted_bodyweight', bw: BW.pull_up,
    arch: 'vertical_pull', sh: VERTICAL_PULL_WIDE,
    cues: [
      'Kneel or stand on the pad and let it carry part of your weight.',
      'Reduce the assistance over the weeks; that is the progression.',
    ],
  }),
  ex({
    m: 'chin_up', eq: 'bodyweight', force: 'pull', mech: 'compound',
    track: 'bodyweight_reps', bw: BW.pull_up, arch: 'vertical_pull',
    sh: VERTICAL_PULL_NEUTRAL, std: std('pull-up--bodyweight', 1.05),
    cues: [
      'Underhand grip at about shoulder width.',
      'Pull until the collarbones meet the bar.',
      'More biceps than a pull up, and usually a few more reps.',
    ],
  }),
  ex({
    m: 'chin_up', eq: 'dip_belt', load: 'weighted', force: 'pull', mech: 'compound',
    track: 'weighted_bodyweight', bw: BW.pull_up, arch: 'vertical_pull',
    sh: VERTICAL_PULL_NEUTRAL,
    cues: [
      'Same underhand grip with plates on the belt.',
      'Keep the ribs down so the movement does not become a swing.',
    ],
  }),
  ex({
    m: 'lat_pulldown', eq: 'cable', force: 'pull', mech: 'compound',
    arch: 'lat_pulldown', sh: VERTICAL_PULL_WIDE,
    alias: ['pulldown', 'latpd'],
    cues: [
      'Wedge the thighs under the pads and grip just outside the shoulders.',
      'Pull the bar to the collarbones, elbows driving down.',
      'Let the shoulders rise at the top for a full stretch.',
    ],
  }),
  ex({
    m: 'lat_pulldown', eq: 'cable', v: ['wide_grip'], force: 'pull', mech: 'compound',
    arch: 'lat_pulldown', sh: VERTICAL_PULL_WIDE,
    cues: [
      'Take the wide bar near its bends.',
      'Think about pulling the elbows to the floor, not the bar to the chest.',
    ],
  }),
  ex({
    m: 'lat_pulldown', eq: 'cable', v: ['close_grip'], force: 'pull', mech: 'compound',
    arch: 'lat_pulldown', sh: PULLDOWN_CLOSE,
    cues: [
      'Use a narrow V handle and pull to the sternum.',
      'The longer range hits the lower lat fibres hard.',
    ],
  }),
  ex({
    m: 'lat_pulldown', eq: 'cable', v: ['neutral_grip'], force: 'pull',
    mech: 'compound', arch: 'lat_pulldown', sh: PULLDOWN_CLOSE,
    cues: [
      'Palms facing each other, elbows tracking close to the body.',
      'Lean back no more than about 15 degrees.',
    ],
  }),
  ex({
    m: 'lat_pulldown', eq: 'cable', v: ['reverse_grip'], force: 'pull',
    mech: 'compound', arch: 'lat_pulldown', sh: PULLDOWN_CLOSE,
    alias: ['underhand pulldown'],
    cues: [
      'Supinated grip inside shoulder width.',
      'Pull to the upper chest and keep the wrists straight.',
    ],
  }),
  ex({
    m: 'lat_pulldown', eq: 'cable', v: ['behind_the_neck'], force: 'pull',
    mech: 'compound', arch: 'lat_pulldown', sh: VERTICAL_PULL_WIDE,
    cues: [
      'Only worth doing if you have full overhead shoulder range.',
      'Pull to the base of the neck with a controlled tempo, never fast.',
    ],
  }),
  ex({
    m: 'lat_pulldown', eq: 'cable', v: ['single_arm'], limb: 'unilateral_sequential',
    force: 'pull', mech: 'compound', arch: 'lat_pulldown', sh: PULLDOWN_CLOSE,
    cues: [
      'One handle, torso upright, free hand on the seat.',
      'Reach tall at the top and drive the elbow to the hip.',
    ],
  }),
  ex({
    m: 'straight_arm_pulldown', eq: 'cable', force: 'pull', mech: 'isolation',
    arch: 'straight_arm_pulldown', sh: STRAIGHT_ARM_PULLDOWN, att: 'straight_bar',
    cues: [
      'Stand a step back from a high pulley, hinged slightly forward.',
      'Sweep the bar to the thighs with the elbows almost locked.',
      'Lats only: if the triceps take over, the elbows are bending.',
    ],
  }),
  ex({
    m: 'pullover', eq: 'dumbbell', force: 'pull', mech: 'isolation',
    arch: 'straight_arm_pulldown', sh: PULLOVER,
    cues: [
      'Lie along or across a bench holding one dumbbell over the chest.',
      'Lower it behind the head until the lats stretch.',
      'Pull it back over the chest without bending the elbows further.',
    ],
  }),
  ex({
    m: 'pullover', eq: 'cable', force: 'pull', mech: 'isolation',
    arch: 'straight_arm_pulldown', sh: PULLOVER, att: 'rope',
    cues: [
      'Kneel facing a high pulley with the rope overhead.',
      'Pull down and through in one arc, keeping the arms long.',
    ],
  }),
  ex({
    m: 'shrug', eq: 'barbell', force: 'pull', mech: 'isolation', arch: 'shrug',
    sh: SHRUG,
    cues: [
      'Hold the bar at arms length and lift the shoulders straight up.',
      'Pause at the top; rolling the shoulders adds nothing.',
    ],
  }),
  ex({
    m: 'shrug', eq: 'dumbbell', force: 'pull', mech: 'isolation', arch: 'shrug',
    sh: SHRUG,
    cues: [
      'Dumbbells at the sides let the shoulders travel a little higher.',
      'Keep the arms straight and the chin tucked.',
    ],
  }),
  ex({
    m: 'shrug', eq: 'trap_bar', force: 'pull', mech: 'isolation', arch: 'shrug',
    sh: SHRUG,
    cues: [
      'Neutral handles keep the bar off the thighs.',
      'Shrug straight up and hold for a beat.',
    ],
  }),
  ex({
    m: 'shrug', eq: 'machine_selectorized', force: 'pull', mech: 'isolation',
    arch: 'shrug', sh: SHRUG,
    cues: [
      'Grip the handles and elevate the shoulders without leaning.',
      'Useful when grip gives out before the traps do.',
    ],
  }),
  ex({
    m: 'face_pull', eq: 'cable', force: 'pull', mech: 'isolation', arch: 'rear_delt_fly',
    sh: FACE_PULL, att: 'rope',
    cues: [
      'Set the pulley at head height and grip the rope ends.',
      'Pull toward the forehead, splitting the rope apart.',
      'Finish with the knuckles pointing up and the shoulder blades tight.',
    ],
  }),
  ex({
    m: 'dead_hang', eq: 'bodyweight', force: 'static', mech: 'isolation',
    track: 'duration', bw: BW.pull_up, arch: 'isometric_hang', sh: DEAD_HANG,
    cues: [
      'Hang from a bar with straight arms and relaxed shoulders.',
      'Time the hang; stop when the grip starts to slip, not after.',
    ],
  }),
];

const SHOULDERS: readonly SeedExercise[] = [
  ex({
    m: 'overhead_press', eq: 'barbell', force: 'push', mech: 'compound',
    arch: 'vertical_press', sh: OVERHEAD_PRESS,
    std: std('overhead-press--barbell', 1),
    alias: ['ohp', 'military press', 'strict press'],
    cues: [
      'Bar on the front delts, elbows slightly in front of it.',
      'Move the head back, press up, then push the head through at the top.',
      'Squeeze the glutes so the lower back does not take the load.',
    ],
  }),
  ex({
    m: 'overhead_press', eq: 'barbell', v: ['seated'], force: 'push', mech: 'compound',
    arch: 'seated_vertical_press', sh: OVERHEAD_PRESS,
    std: std('overhead-press--barbell', 0.95),
    cues: [
      'Sit with the back against an upright bench.',
      'No leg drive is available, so the shoulders do all of it.',
    ],
  }),
  ex({
    m: 'overhead_press', eq: 'barbell', v: ['behind_the_neck'], force: 'push',
    mech: 'compound', arch: 'seated_vertical_press', sh: OVERHEAD_PRESS,
    cues: [
      'Requires genuinely full overhead range; skip it otherwise.',
      'Lower to about ear level, never to the neck.',
      'Keep the weight conservative and the tempo slow.',
    ],
  }),
  ex({
    m: 'overhead_press', eq: 'dumbbell', v: ['seated'], force: 'push', mech: 'compound',
    arch: 'seated_vertical_press', sh: OVERHEAD_PRESS,
    std: std('overhead-press--barbell', 0.42),
    cues: [
      'Start with the dumbbells at ear height, palms forward.',
      'Press up and slightly in until they almost touch.',
      'Lower until the elbows drop just below the shoulders.',
    ],
  }),
  ex({
    m: 'overhead_press', eq: 'dumbbell', v: ['standing'], force: 'push',
    mech: 'compound', arch: 'vertical_press', sh: OVERHEAD_PRESS,
    cues: [
      'Stand tall with the ribs stacked over the hips.',
      'Press without leaning back; brace the trunk first.',
    ],
  }),
  ex({
    m: 'overhead_press', eq: 'dumbbell', v: ['single_arm'],
    limb: 'unilateral_sequential', force: 'push', mech: 'compound',
    arch: 'vertical_press', sh: OVERHEAD_PRESS,
    cues: [
      'One bell overhead while the free side resists the tilt.',
      'Keep the ribs down and the hips square.',
    ],
  }),
  ex({
    m: 'overhead_press', eq: 'kettlebell', force: 'push', mech: 'compound',
    arch: 'vertical_press', sh: OVERHEAD_PRESS,
    cues: [
      'Rack the bell on the forearm, wrist straight.',
      'Press around the head and lock out with the bicep near the ear.',
    ],
  }),
  ex({
    m: 'overhead_press', eq: 'machine_selectorized', force: 'push', mech: 'compound',
    arch: 'seated_vertical_press', sh: OVERHEAD_PRESS,
    alias: ['shoulder press machine'],
    cues: [
      'Set the seat so the handles start at shoulder height.',
      'Press to a soft lockout and lower under control.',
    ],
  }),
  ex({
    m: 'overhead_press', eq: 'smith_machine', v: ['seated'], force: 'push',
    mech: 'compound', arch: 'seated_vertical_press', sh: OVERHEAD_PRESS,
    cues: [
      'Position the bench so the bar path passes close to the face.',
      'The fixed path is useful when pressing to failure alone.',
    ],
  }),
  ex({
    m: 'arnold_press', eq: 'dumbbell', force: 'push', mech: 'compound',
    arch: 'seated_vertical_press', sh: OVERHEAD_PRESS,
    cues: [
      'Start with the palms facing you at chin height.',
      'Rotate out as you press, finishing with the palms forward.',
      'Reverse the rotation on the way down.',
    ],
  }),
  ex({
    m: 'push_press', eq: 'barbell', pattern: 'olympic', force: 'push',
    mech: 'compound', arch: 'vertical_press', sh: PUSH_PRESS,
    std: std('overhead-press--barbell', 1.2, false),
    cues: [
      'Dip a few inches with a vertical torso.',
      'Drive with the legs and let the bar ride that momentum overhead.',
      'Lock out with the arms, not with another dip.',
    ],
  }),
  ex({
    m: 'push_press', eq: 'dumbbell', pattern: 'olympic', force: 'push',
    mech: 'compound', arch: 'vertical_press', sh: PUSH_PRESS,
    cues: [
      'Dumbbells racked at the shoulders, quick dip and drive.',
      'Punch both bells to lockout at the same time.',
    ],
  }),
  ex({
    m: 'handstand_push_up', eq: 'bodyweight', force: 'push', mech: 'compound',
    track: 'bodyweight_reps', bw: BW.handstand_push_up, arch: 'handstand_press',
    sh: HANDSTAND_PRESS,
    alias: ['hspu'],
    cues: [
      'Kick up to a wall with the hands slightly wider than the shoulders.',
      'Lower until the head touches a pad, then press back to lockout.',
      'Keep the ribs down so the back does not arch.',
    ],
  }),
  ex({
    m: 'lateral_raise', eq: 'dumbbell', force: 'push', mech: 'isolation',
    arch: 'lateral_raise', sh: LATERAL_RAISE,
    alias: ['side raise', 'db lateral'],
    cues: [
      'Soft elbows, thumbs level with or slightly below the knuckles.',
      'Raise to shoulder height, no higher, leading with the elbows.',
      'Lower slowly; this one is ruined by momentum.',
    ],
  }),
  ex({
    m: 'lateral_raise', eq: 'dumbbell', v: ['seated'], force: 'push',
    mech: 'isolation', arch: 'lateral_raise', sh: LATERAL_RAISE,
    cues: [
      'Sitting removes the hip swing that creeps in when you get tired.',
      'Pause for a beat at the top of each rep.',
    ],
  }),
  ex({
    m: 'lateral_raise', eq: 'dumbbell', v: ['single_arm'],
    limb: 'unilateral_sequential', force: 'push', mech: 'isolation',
    arch: 'lateral_raise', sh: LATERAL_RAISE,
    alias: ['leaning lateral raise'],
    cues: [
      'Hold an upright with the free hand and lean away from the working side.',
      'The lean keeps tension on the delt at the bottom of the range.',
    ],
  }),
  ex({
    m: 'lateral_raise', eq: 'cable', v: ['single_arm'], limb: 'unilateral_sequential',
    force: 'push', mech: 'isolation', arch: 'lateral_raise', sh: LATERAL_RAISE,
    cues: [
      'Low pulley behind the body, handle in the far hand.',
      'Sweep out to shoulder height with a fixed elbow angle.',
    ],
  }),
  ex({
    m: 'lateral_raise', eq: 'machine_selectorized', force: 'push', mech: 'isolation',
    arch: 'lateral_raise', sh: LATERAL_RAISE,
    cues: [
      'Set the pivot level with the shoulder joint.',
      'Push out against the pads rather than gripping and lifting.',
    ],
  }),
  ex({
    m: 'front_raise', eq: 'dumbbell', force: 'push', mech: 'isolation',
    arch: 'front_raise', sh: FRONT_RAISE,
    cues: [
      'Raise to eye level with a neutral or pronated grip.',
      'Stop the swing: the torso stays still.',
    ],
  }),
  ex({
    m: 'front_raise', eq: 'weight_plate', force: 'push', mech: 'isolation',
    arch: 'front_raise', sh: FRONT_RAISE,
    cues: [
      'Hold a plate at three and nine o clock.',
      'Lift to eye level and lower without letting it drop.',
    ],
  }),
  ex({
    m: 'front_raise', eq: 'cable', force: 'push', mech: 'isolation',
    arch: 'front_raise', sh: FRONT_RAISE,
    cues: [
      'Low pulley behind you keeps tension through the whole arc.',
      'Finish with the hands just above shoulder height.',
    ],
  }),
  ex({
    m: 'reverse_fly', eq: 'dumbbell', v: ['bent_over'], force: 'pull',
    mech: 'isolation', arch: 'rear_delt_fly', sh: REAR_DELT_FLY,
    alias: ['rear delt fly', 'bent over lateral raise'],
    cues: [
      'Hinge until the torso is near parallel and let the arms hang.',
      'Sweep the dumbbells out and slightly back.',
      'Lead with the elbows, not the hands.',
    ],
  }),
  ex({
    m: 'reverse_fly', eq: 'dumbbell', v: ['chest_supported'], force: 'pull',
    mech: 'isolation', arch: 'rear_delt_fly', sh: REAR_DELT_FLY,
    cues: [
      'Chest on an incline bench so nothing can swing.',
      'Raise to shoulder height and pause.',
    ],
  }),
  ex({
    m: 'reverse_fly', eq: 'machine_selectorized', force: 'pull', mech: 'isolation',
    arch: 'rear_delt_fly', sh: REAR_DELT_FLY,
    alias: ['reverse pec deck', 'rear delt machine'],
    cues: [
      'Chest on the pad, handles set at shoulder height.',
      'Open the arms wide and squeeze the rear delts before returning.',
    ],
  }),
  ex({
    m: 'reverse_fly', eq: 'cable', force: 'pull', mech: 'isolation',
    arch: 'rear_delt_fly', sh: REAR_DELT_FLY,
    alias: ['cable rear delt fly'],
    cues: [
      'Cross the cables at chest height and grip the opposite handles.',
      'Pull apart in a wide arc, finishing with the arms out to the sides.',
    ],
  }),
  ex({
    m: 'upright_row', eq: 'barbell', force: 'pull', mech: 'compound',
    arch: 'upright_row', sh: UPRIGHT_ROW,
    cues: [
      'Grip a little wider than the shoulders to keep the wrists happy.',
      'Pull to the lower chest with the elbows leading.',
      'Stop if the shoulders pinch; go wider or lighter.',
    ],
  }),
  ex({
    m: 'upright_row', eq: 'dumbbell', force: 'pull', mech: 'compound',
    arch: 'upright_row', sh: UPRIGHT_ROW,
    cues: [
      'Dumbbells let the wrists find a comfortable path.',
      'Pull to sternum height and lower slowly.',
    ],
  }),
  ex({
    m: 'upright_row', eq: 'cable', force: 'pull', mech: 'compound',
    arch: 'upright_row', sh: UPRIGHT_ROW,
    cues: [
      'Low pulley with a straight bar, standing close to the stack.',
      'Keep the bar brushing the body on the way up.',
    ],
  }),
];

const ARMS: readonly SeedExercise[] = [
  ex({
    m: 'biceps_curl', eq: 'barbell', force: 'pull', mech: 'isolation',
    arch: 'elbow_flexion_curl', sh: BICEPS_CURL,
    alias: ['barbell curl'],
    cues: [
      'Stand with the bar at the thighs, elbows pinned to the ribs.',
      'Curl until the forearms pass vertical, then lower fully.',
      'If the hips move, the weight is too heavy.',
    ],
  }),
  ex({
    m: 'biceps_curl', eq: 'ez_bar', force: 'pull', mech: 'isolation',
    arch: 'elbow_flexion_curl', sh: BICEPS_CURL,
    cues: [
      'The angled grip takes strain off the wrists.',
      'Same strict elbow position as a straight bar curl.',
    ],
  }),
  ex({
    m: 'biceps_curl', eq: 'dumbbell', force: 'pull', mech: 'isolation',
    arch: 'elbow_flexion_curl', sh: BICEPS_CURL,
    cues: [
      'Start with the palms forward and curl both arms together.',
      'Supinate hard at the top and squeeze.',
    ],
  }),
  ex({
    m: 'biceps_curl', eq: 'dumbbell', v: ['alternating'],
    limb: 'unilateral_alternating', force: 'pull', mech: 'isolation',
    arch: 'elbow_flexion_curl', sh: BICEPS_CURL,
    cues: [
      'One arm at a time while the other hangs relaxed.',
      'Keep the rhythm even so neither side gets the easier reps.',
    ],
  }),
  ex({
    m: 'biceps_curl', eq: 'dumbbell', v: ['incline'], force: 'pull', mech: 'isolation',
    arch: 'stretched_curl', sh: STRETCHED_CURL,
    alias: ['incline dumbbell curl'],
    cues: [
      'Lie back on a 45 degree bench and let the arms hang behind the body.',
      'Curl without letting the elbows drift forward.',
      'Loads the long head at a long muscle length.',
    ],
  }),
  ex({
    m: 'biceps_curl', eq: 'cable', force: 'pull', mech: 'isolation',
    arch: 'elbow_flexion_curl', sh: BICEPS_CURL, att: 'straight_bar',
    cues: [
      'Low pulley, straight bar, standing a step back from the stack.',
      'Cables keep tension at the bottom where dumbbells lose it.',
    ],
  }),
  ex({
    m: 'biceps_curl', eq: 'cable', v: ['single_arm'], limb: 'unilateral_sequential',
    force: 'pull', mech: 'isolation', arch: 'elbow_flexion_curl', sh: BICEPS_CURL,
    cues: [
      'One handle, elbow fixed at the side.',
      'Turn the palm up through the whole rep.',
    ],
  }),
  ex({
    m: 'biceps_curl', eq: 'machine_selectorized', force: 'pull', mech: 'isolation',
    arch: 'elbow_flexion_curl', sh: BICEPS_CURL,
    cues: [
      'Set the seat so the elbows sit on the pad at the pivot.',
      'Easy to take to failure safely.',
    ],
  }),
  ex({
    m: 'hammer_curl', eq: 'dumbbell', force: 'pull', mech: 'isolation',
    arch: 'elbow_flexion_curl', sh: HAMMER_CURL,
    cues: [
      'Palms face each other and stay that way the whole rep.',
      'Curl to the front of the shoulder without swinging.',
    ],
  }),
  ex({
    m: 'hammer_curl', eq: 'dumbbell', v: ['seated'], force: 'pull', mech: 'isolation',
    arch: 'elbow_flexion_curl', sh: HAMMER_CURL,
    cues: [
      'Sitting upright kills the hip drive people sneak in.',
      'Lower to fully straight arms every rep.',
    ],
  }),
  ex({
    m: 'hammer_curl', eq: 'cable', force: 'pull', mech: 'isolation',
    arch: 'elbow_flexion_curl', sh: HAMMER_CURL, att: 'rope',
    cues: [
      'Grip the rope ends with the thumbs up.',
      'Pull the ends apart slightly at the top.',
    ],
  }),
  ex({
    m: 'preacher_curl', eq: 'ez_bar', force: 'pull', mech: 'isolation',
    arch: 'stretched_curl', sh: PREACHER_CURL,
    cues: [
      'Armpits over the top of the pad, chest against it.',
      'Lower until the arms are almost straight but still under tension.',
      'Do not bounce out of the bottom; the elbow does not enjoy it.',
    ],
  }),
  ex({
    m: 'preacher_curl', eq: 'dumbbell', v: ['single_arm'],
    limb: 'unilateral_sequential', force: 'pull', mech: 'isolation',
    arch: 'stretched_curl', sh: PREACHER_CURL,
    cues: [
      'One arm on the pad, palm up.',
      'Control the lower; the stretched position is where the work is.',
    ],
  }),
  ex({
    m: 'preacher_curl', eq: 'machine_selectorized', force: 'pull', mech: 'isolation',
    arch: 'stretched_curl', sh: PREACHER_CURL,
    cues: [
      'Line the elbows up with the machine pivot.',
      'Squeeze at the top and resist all the way back.',
    ],
  }),
  ex({
    m: 'concentration_curl', eq: 'dumbbell', limb: 'unilateral_sequential',
    force: 'pull', mech: 'isolation', arch: 'elbow_flexion_curl',
    sh: CONCENTRATION_CURL,
    cues: [
      'Sit and brace the working elbow against the inner thigh.',
      'Curl to the shoulder and supinate hard at the top.',
    ],
  }),
  ex({
    m: 'spider_curl', eq: 'ez_bar', force: 'pull', mech: 'isolation',
    arch: 'elbow_flexion_curl', sh: PREACHER_CURL,
    cues: [
      'Lie chest down on an incline bench with the arms hanging straight.',
      'Curl up to the chin; the peak contraction is the point.',
    ],
  }),
  ex({
    m: 'drag_curl', eq: 'barbell', force: 'pull', mech: 'isolation',
    arch: 'elbow_flexion_curl', sh: DRAG_CURL,
    cues: [
      'Drag the bar up the body while the elbows travel backward.',
      'Short range, heavy long-head bias, no front delt involvement.',
    ],
  }),
  ex({
    m: 'reverse_curl', eq: 'ez_bar', force: 'pull', mech: 'isolation',
    arch: 'elbow_flexion_curl', sh: REVERSE_CURL,
    cues: [
      'Overhand grip, knuckles up, wrists locked straight.',
      'Curl to chest height; expect to use much less weight.',
    ],
  }),
  ex({
    m: 'reverse_curl', eq: 'cable', force: 'pull', mech: 'isolation',
    arch: 'elbow_flexion_curl', sh: REVERSE_CURL,
    cues: [
      'Low pulley with a straight bar, overhand grip.',
      'Keep the wrists from rolling under as you fatigue.',
    ],
  }),
  ex({
    m: 'triceps_pushdown', eq: 'cable', force: 'push', mech: 'isolation',
    arch: 'triceps_pushdown', sh: TRICEPS_PUSHDOWN, att: 'rope',
    alias: ['rope pushdown', 'tricep extension'],
    cues: [
      'Elbows pinned at the ribs, slight forward lean.',
      'Press down and spread the rope ends apart at the bottom.',
      'Only the forearms move.',
    ],
  }),
  ex({
    m: 'triceps_pushdown', eq: 'cable', v: ['reverse_grip'], force: 'push',
    mech: 'isolation', arch: 'triceps_pushdown', sh: TRICEPS_PUSHDOWN,
    cues: [
      'Underhand grip on a straight bar.',
      'Biases the medial head; go lighter than a rope pushdown.',
    ],
  }),
  ex({
    m: 'triceps_pushdown', eq: 'cable', v: ['single_arm'],
    limb: 'unilateral_sequential', force: 'push', mech: 'isolation',
    arch: 'triceps_pushdown', sh: TRICEPS_PUSHDOWN,
    cues: [
      'One handle, palm up or down, elbow locked to the side.',
      'Good for chasing a side that lags.',
    ],
  }),
  ex({
    m: 'triceps_pushdown', eq: 'machine_selectorized', force: 'push',
    mech: 'isolation', arch: 'triceps_pushdown', sh: TRICEPS_PUSHDOWN,
    cues: [
      'Seat set so the elbows rest on the pad.',
      'Extend fully and pause before returning.',
    ],
  }),
  ex({
    m: 'overhead_triceps_extension', eq: 'cable', force: 'push', mech: 'isolation',
    arch: 'overhead_triceps_extension', sh: OVERHEAD_EXTENSION, att: 'rope',
    cues: [
      'Face away from a low or mid pulley with the rope behind the head.',
      'Extend until the arms are straight overhead.',
      'Keep the elbows pointing forward, not flaring out.',
    ],
  }),
  ex({
    m: 'overhead_triceps_extension', eq: 'dumbbell', force: 'push', mech: 'isolation',
    arch: 'overhead_triceps_extension', sh: OVERHEAD_EXTENSION,
    cues: [
      'Hold one dumbbell with both hands behind the head.',
      'Lower until the triceps stretch, then press straight up.',
    ],
  }),
  ex({
    m: 'overhead_triceps_extension', eq: 'ez_bar', v: ['seated'], force: 'push',
    mech: 'isolation', arch: 'overhead_triceps_extension', sh: OVERHEAD_EXTENSION,
    cues: [
      'Sit with back support so the ribs cannot flare.',
      'Lower the bar behind the head under control.',
    ],
  }),
  ex({
    m: 'skullcrusher', eq: 'ez_bar', force: 'push', mech: 'isolation',
    arch: 'overhead_triceps_extension', sh: SKULLCRUSHER,
    alias: ['lying triceps extension'],
    cues: [
      'Lie flat with the bar over the shoulders, not the face.',
      'Bend at the elbows and lower to the forehead or just behind it.',
      'Keep the upper arms angled slightly back to hold tension.',
    ],
  }),
  ex({
    m: 'skullcrusher', eq: 'barbell', force: 'push', mech: 'isolation',
    arch: 'overhead_triceps_extension', sh: SKULLCRUSHER,
    cues: [
      'Straight bar is harder on the wrists but allows a firmer grip.',
      'Lower slowly and press back without flaring the elbows.',
    ],
  }),
  ex({
    m: 'skullcrusher', eq: 'dumbbell', force: 'push', mech: 'isolation',
    arch: 'overhead_triceps_extension', sh: SKULLCRUSHER,
    cues: [
      'Neutral grip lets each arm find its own path.',
      'Lower beside the ears rather than to the forehead.',
    ],
  }),
  ex({
    m: 'triceps_kickback', eq: 'dumbbell', limb: 'unilateral_sequential',
    force: 'push', mech: 'isolation', arch: 'triceps_pushdown', sh: TRICEPS_KICKBACK,
    cues: [
      'Hinge forward and set the upper arm parallel to the floor.',
      'Straighten the elbow and hold the lockout for a beat.',
    ],
  }),
  ex({
    m: 'triceps_kickback', eq: 'cable', limb: 'unilateral_sequential', force: 'push',
    mech: 'isolation', arch: 'triceps_pushdown', sh: TRICEPS_KICKBACK,
    cues: [
      'Low pulley, single handle, torso hinged over.',
      'The cable keeps load on the lockout where a dumbbell goes slack.',
    ],
  }),
  ex({
    m: 'triceps_dip', eq: 'bodyweight', force: 'push', mech: 'compound',
    track: 'bodyweight_reps', bw: BW.dip, arch: 'dip', sh: TRICEPS_DIP,
    cues: [
      'Stay upright on the bars with the elbows tracking straight back.',
      'Lower to about 90 degrees at the elbow.',
      'Press up without letting the torso pitch forward.',
    ],
  }),
  ex({
    m: 'triceps_dip', eq: 'assisted_machine', load: 'assisted', force: 'push',
    mech: 'compound', track: 'assisted_bodyweight', bw: BW.dip, arch: 'dip',
    sh: TRICEPS_DIP,
    cues: [
      'Use the pad to remove part of your bodyweight.',
      'Keep the torso vertical so the triceps stay the target.',
    ],
  }),
  ex({
    m: 'bench_dip', eq: 'bench', force: 'push', mech: 'compound',
    track: 'bodyweight_reps', bw: BW.dip, arch: 'dip', sh: BENCH_DIP,
    cues: [
      'Hands on a bench behind you, heels on the floor or another bench.',
      'Lower until the elbows reach about 90 degrees, no deeper.',
      'Hard on the shoulders: stop early if the front of the joint complains.',
    ],
  }),
  ex({
    m: 'wrist_curl', eq: 'barbell', v: ['seated'], force: 'pull', mech: 'isolation',
    arch: 'wrist_flexion', sh: WRIST_CURL,
    cues: [
      'Forearms on the thighs, palms up, wrists past the knees.',
      'Let the bar roll to the fingertips, then curl it back up.',
    ],
  }),
  ex({
    m: 'wrist_curl', eq: 'dumbbell', force: 'pull', mech: 'isolation',
    arch: 'wrist_flexion', sh: WRIST_CURL,
    cues: [
      'One arm at a time on a bench, palm up.',
      'Full range through the fingers; no bouncing.',
    ],
  }),
  ex({
    m: 'wrist_curl', eq: 'cable', force: 'pull', mech: 'isolation',
    arch: 'wrist_flexion', sh: WRIST_CURL,
    cues: [
      'Kneel at a low pulley with the forearms on the bench.',
      'Constant tension makes the burn arrive sooner.',
    ],
  }),
  ex({
    m: 'reverse_wrist_curl', eq: 'barbell', v: ['seated'],
    pattern: 'isolation_extension', force: 'pull', mech: 'isolation',
    arch: 'wrist_flexion', sh: REVERSE_WRIST_CURL,
    cues: [
      'Palms down, forearms supported, wrists just past the knees.',
      'Lift the knuckles toward the ceiling and pause.',
      'Very light weight; the extensors are small.',
    ],
  }),
  ex({
    m: 'reverse_wrist_curl', eq: 'dumbbell', pattern: 'isolation_extension',
    force: 'pull', mech: 'isolation', arch: 'wrist_flexion', sh: REVERSE_WRIST_CURL,
    cues: [
      'One arm on the bench, palm down.',
      'Useful for elbow health if you grip hard elsewhere.',
    ],
  }),
  ex({
    m: 'wrist_roller', eq: 'wrist_roller', pattern: 'isometric_hold', force: 'static',
    mech: 'isolation', track: 'duration', arch: 'wrist_flexion', sh: WRIST_ROLLER,
    cues: [
      'Hold the roller at arms length and wind the rope up.',
      'Wind it back down slowly instead of letting it drop.',
    ],
  }),
  ex({
    m: 'plate_pinch', eq: 'weight_plate', pattern: 'isometric_hold', force: 'static',
    mech: 'isolation', track: 'duration_weight', arch: 'isometric_hang',
    sh: PLATE_PINCH,
    cues: [
      'Pinch two smooth plates together between the fingers and thumb.',
      'Stand still and hold; log the total weight and the time.',
    ],
  }),
];

const LEGS: readonly SeedExercise[] = [
  ex({
    m: 'back_squat', eq: 'barbell', force: 'push', mech: 'compound', arch: 'squat',
    sh: BACK_SQUAT, std: std('back-squat--barbell', 1),
    alias: ['squat', 'barbell squat'],
    cues: [
      'Bar racked on the upper back, feet about shoulder width.',
      'Break at the hips and knees together and sit between the feet.',
      'Descend until the hip crease passes the knee, then drive up evenly.',
    ],
  }),
  ex({
    m: 'high_bar_squat', eq: 'barbell', force: 'push', mech: 'compound', arch: 'squat',
    sh: BACK_SQUAT, std: std('back-squat--barbell', 1),
    cues: [
      'Bar sits on the traps, torso stays close to upright.',
      'More knee travel and more quad than a low bar squat.',
    ],
  }),
  ex({
    m: 'low_bar_squat', eq: 'barbell', force: 'push', mech: 'compound', arch: 'squat',
    sh: BACK_SQUAT, std: std('back-squat--barbell', 1.05),
    cues: [
      'Bar rests across the rear delts, wrists straight.',
      'More forward lean, more hip drive, usually more weight.',
    ],
  }),
  ex({
    m: 'back_squat', eq: 'barbell', v: ['paused'], force: 'push', mech: 'compound',
    arch: 'squat', sh: BACK_SQUAT, std: std('back-squat--barbell', 0.9),
    cues: [
      'Hold the bottom for a full second without relaxing.',
      'Stay braced; the pause exposes any lost tightness.',
    ],
  }),
  ex({
    m: 'back_squat', eq: 'barbell', v: ['elevated_heels'], force: 'push',
    mech: 'compound', arch: 'squat', sh: FRONT_SQUAT,
    cues: [
      'Heels on small plates or squat shoes.',
      'Lets the knees travel further forward and loads the quads harder.',
    ],
  }),
  ex({
    m: 'back_squat', eq: 'barbell', v: ['wide_stance'], force: 'push', mech: 'compound',
    arch: 'squat', sh: BACK_SQUAT,
    cues: [
      'Feet well outside the shoulders, toes turned out.',
      'Push the knees out hard from the first centimetre.',
    ],
  }),
  ex({
    m: 'back_squat', eq: 'safety_squat_bar', force: 'push', mech: 'compound',
    arch: 'squat', sh: BACK_SQUAT,
    alias: ['ssb squat'],
    cues: [
      'The yoke pushes you forward, so expect to fight to stay upright.',
      'Kind to shoulders that cannot rack a straight bar.',
    ],
  }),
  ex({
    m: 'back_squat', eq: 'smith_machine', force: 'push', mech: 'compound',
    arch: 'machine_squat', sh: MACHINE_SQUAT,
    cues: [
      'Walk the feet slightly forward of the bar.',
      'The fixed path means you can push close to failure alone.',
    ],
  }),
  ex({
    m: 'box_squat', eq: 'barbell', force: 'push', mech: 'compound', arch: 'squat',
    sh: BACK_SQUAT, std: std('back-squat--barbell', 0.95),
    cues: [
      'Sit back to a box set at or just below parallel.',
      'Settle on the box without relaxing, then stand.',
    ],
  }),
  ex({
    m: 'front_squat', eq: 'barbell', force: 'push', mech: 'compound',
    arch: 'front_loaded_squat', sh: FRONT_SQUAT, std: std('back-squat--barbell', 0.85),
    cues: [
      'Bar on the front delts with the elbows high.',
      'Stay vertical; the moment the elbows drop, the bar goes with them.',
      'Squat down between the knees and drive straight back up.',
    ],
  }),
  ex({
    m: 'front_squat', eq: 'smith_machine', force: 'push', mech: 'compound',
    arch: 'machine_squat', sh: FRONT_SQUAT,
    cues: [
      'Rack the bar on the front delts against the fixed path.',
      'Useful for learning the position without balancing the bar.',
    ],
  }),
  ex({
    m: 'goblet_squat', eq: 'dumbbell', force: 'push', mech: 'compound',
    arch: 'front_loaded_squat', sh: GOBLET_SQUAT,
    cues: [
      'Hold one end of the dumbbell against the chest.',
      'Sit straight down with the elbows inside the knees.',
      'The counterweight makes it easier to stay upright.',
    ],
  }),
  ex({
    m: 'goblet_squat', eq: 'kettlebell', force: 'push', mech: 'compound',
    arch: 'front_loaded_squat', sh: GOBLET_SQUAT,
    cues: [
      'Hold the bell by the horns at chest height.',
      'Push the knees out and keep the heels down.',
    ],
  }),
  ex({
    m: 'hack_squat', eq: 'hack_squat_machine', force: 'push', mech: 'compound',
    arch: 'machine_squat', sh: MACHINE_SQUAT,
    cues: [
      'Back flat against the pad, feet mid platform.',
      'Descend deep and press without locking the knees hard.',
    ],
  }),
  ex({
    m: 'pendulum_squat', eq: 'pendulum_squat', force: 'push', mech: 'compound',
    arch: 'machine_squat', sh: MACHINE_SQUAT,
    cues: [
      'The arc keeps the load constant through the range.',
      'Sit deep; the machine holds the balance for you.',
    ],
  }),
  ex({
    m: 'belt_squat', eq: 'belt_squat', force: 'push', mech: 'compound',
    arch: 'machine_squat', sh: MACHINE_SQUAT,
    cues: [
      'Load hangs from the hips, so the spine carries nothing.',
      'The go-to squat pattern when the lower back is cooked.',
    ],
  }),
  ex({
    m: 'overhead_squat', eq: 'barbell', force: 'push', mech: 'compound',
    arch: 'front_loaded_squat', sh: OVERHEAD_SQUAT,
    cues: [
      'Bar locked out overhead in a wide grip, arms actively pushing up.',
      'Squat to depth while the bar stays over the mid foot.',
      'Mobility, not strength, is usually the limit here.',
    ],
  }),
  ex({
    m: 'sissy_squat', eq: 'bodyweight', force: 'push', mech: 'isolation',
    track: 'bodyweight_reps', arch: 'sissy_squat', sh: SISSY_SQUAT,
    cues: [
      'Hold a support, rise onto the toes and lean back as the knees travel forward.',
      'Keep the hips extended in a straight line with the torso.',
      'Very demanding on the knees; build up slowly.',
    ],
  }),
  ex({
    m: 'pistol_squat', eq: 'bodyweight', limb: 'unilateral_sequential', force: 'push',
    mech: 'compound', track: 'bodyweight_reps', bw: BW.pistol_squat, arch: 'split_squat',
    sh: PISTOL_SQUAT,
    cues: [
      'Stand on one leg with the other extended in front.',
      'Sit down slowly to the bottom and stand back up without touching down.',
      'Hold a counterweight at the chest if balance is the limit.',
    ],
  }),
  ex({
    m: 'leg_press', eq: 'leg_press_machine', force: 'push', mech: 'compound',
    arch: 'leg_press', sh: LEG_PRESS, std: std('back-squat--barbell', 2, false),
    cues: [
      'Feet mid platform, about shoulder width.',
      'Lower until the knees reach roughly 90 degrees or a touch deeper.',
      'Never lock the knees out hard at the top.',
    ],
  }),
  ex({
    m: 'leg_press', eq: 'leg_press_machine', v: ['wide_stance'], force: 'push',
    mech: 'compound', arch: 'leg_press', sh: LEG_PRESS,
    cues: [
      'Feet high and wide with the toes out.',
      'Shifts work toward the adductors and glutes.',
    ],
  }),
  ex({
    m: 'leg_press', eq: 'leg_press_machine', v: ['single_leg'],
    limb: 'unilateral_sequential', force: 'push', mech: 'compound', arch: 'leg_press',
    sh: LEG_PRESS,
    cues: [
      'One foot centred on the platform, the other off to the side.',
      'Go lighter than half of your two-leg weight to start.',
    ],
  }),
  ex({
    m: 'bulgarian_split_squat', eq: 'dumbbell', limb: 'unilateral_sequential',
    force: 'push', mech: 'compound', arch: 'split_squat', sh: SPLIT_SQUAT,
    alias: ['bss', 'rear foot elevated split squat'],
    cues: [
      'Rear foot on a bench, front foot far enough forward to stay stacked.',
      'Drop straight down until the back knee is just off the floor.',
      'Weight through the front heel; log one set per leg.',
    ],
  }),
  ex({
    m: 'bulgarian_split_squat', eq: 'barbell', limb: 'unilateral_sequential',
    force: 'push', mech: 'compound', arch: 'split_squat', sh: SPLIT_SQUAT,
    cues: [
      'Bar on the back makes balance harder but allows more load.',
      'Set the front foot position before you unrack.',
    ],
  }),
  ex({
    m: 'split_squat', eq: 'dumbbell', limb: 'unilateral_sequential', force: 'push',
    mech: 'compound', arch: 'split_squat', sh: SPLIT_SQUAT,
    alias: ['static lunge'],
    cues: [
      'Both feet on the floor in a long split stance.',
      'Drop the back knee straight down and press back up.',
    ],
  }),
  ex({
    m: 'walking_lunge', eq: 'dumbbell', limb: 'unilateral_alternating', force: 'push',
    mech: 'compound', arch: 'split_squat', sh: LUNGE,
    cues: [
      'Step forward far enough that the front shin stays near vertical.',
      'Touch the back knee lightly and step straight through to the next rep.',
    ],
  }),
  ex({
    m: 'walking_lunge', eq: 'barbell', limb: 'unilateral_alternating', force: 'push',
    mech: 'compound', arch: 'split_squat', sh: LUNGE,
    cues: [
      'Bar on the back, eyes forward, short controlled steps.',
      'Turn around rather than walking backward with a loaded bar.',
    ],
  }),
  ex({
    m: 'reverse_lunge', eq: 'dumbbell', limb: 'unilateral_alternating', force: 'push',
    mech: 'compound', arch: 'split_squat', sh: LUNGE,
    cues: [
      'Step backward and lower the trailing knee to the floor.',
      'Easier on the knees than a forward lunge.',
    ],
  }),
  ex({
    m: 'reverse_lunge', eq: 'barbell', limb: 'unilateral_alternating', force: 'push',
    mech: 'compound', arch: 'split_squat', sh: LUNGE,
    cues: [
      'Keep the torso upright as you step back.',
      'Drive through the front heel to return to standing.',
    ],
  }),
  ex({
    m: 'lateral_lunge', eq: 'dumbbell', limb: 'unilateral_alternating', force: 'push',
    mech: 'compound', arch: 'split_squat', sh: LUNGE,
    alias: ['side lunge'],
    cues: [
      'Step wide to the side and sit into that hip.',
      'The trailing leg stays straight and feels the adductor stretch.',
    ],
  }),
  ex({
    m: 'curtsy_lunge', eq: 'dumbbell', limb: 'unilateral_alternating', force: 'push',
    mech: 'compound', arch: 'split_squat', sh: LUNGE,
    cues: [
      'Step diagonally behind and across the standing leg.',
      'Hits the glute medius on the front side.',
    ],
  }),
  ex({
    m: 'step_up', eq: 'dumbbell', limb: 'unilateral_sequential', force: 'push',
    mech: 'compound', arch: 'step_up', sh: STEP_UP,
    cues: [
      'Box height around knee level to start.',
      'Drive through the top foot without pushing off the floor.',
      'Lower under control rather than dropping back down.',
    ],
  }),
  ex({
    m: 'step_up', eq: 'barbell', limb: 'unilateral_sequential', force: 'push',
    mech: 'compound', arch: 'step_up', sh: STEP_UP,
    cues: [
      'Bar on the back, box a little lower than you would use with dumbbells.',
      'Keep the knee tracking over the middle toes.',
    ],
  }),
  ex({
    m: 'leg_extension', eq: 'machine_selectorized', force: 'push', mech: 'isolation',
    arch: 'leg_extension', sh: LEG_EXTENSION,
    cues: [
      'Line the knees up with the machine pivot.',
      'Extend to straight, pause, and lower slowly.',
    ],
  }),
  ex({
    m: 'leg_extension', eq: 'machine_selectorized', v: ['single_leg'],
    limb: 'unilateral_sequential', force: 'push', mech: 'isolation',
    arch: 'leg_extension', sh: LEG_EXTENSION,
    cues: [
      'One leg at a time to even out a side-to-side difference.',
      'Hold the top position for a full second.',
    ],
  }),
  ex({
    m: 'leg_curl', eq: 'machine_selectorized', v: ['lying'], force: 'pull',
    mech: 'isolation', arch: 'leg_curl', sh: LEG_CURL,
    alias: ['hamstring curl', 'lying hamstring curl'],
    cues: [
      'Lie face down with the pad just above the heels.',
      'Curl to the glutes and keep the hips pressed into the bench.',
    ],
  }),
  ex({
    m: 'leg_curl', eq: 'machine_selectorized', v: ['seated'], force: 'pull',
    mech: 'isolation', arch: 'leg_curl', sh: LEG_CURL,
    alias: ['seated hamstring curl'],
    cues: [
      'Hip flexion here puts the hamstrings on more stretch than lying.',
      'Strap the lap pad down and curl through the full range.',
    ],
  }),
  ex({
    m: 'leg_curl', eq: 'machine_selectorized', v: ['single_leg', 'standing'],
    limb: 'unilateral_sequential', force: 'pull', mech: 'isolation', arch: 'leg_curl',
    sh: LEG_CURL,
    cues: [
      'Stand tall and curl one heel toward the glute.',
      'Do not let the hip flex to help.',
    ],
  }),
  ex({
    m: 'nordic_curl', eq: 'bodyweight', force: 'pull', mech: 'isolation',
    track: 'bodyweight_reps', bw: BW.nordic_curl, arch: 'nordic_curl',
    sh: NORDIC_CURL,
    cues: [
      'Anchor the ankles and kneel with the body in a straight line.',
      'Lower as slowly as you can, then push off the hands to return.',
      'Extremely damaging if you overdo it; start with a few reps.',
    ],
  }),
  ex({
    m: 'glute_ham_raise', eq: 'ghd', force: 'pull', mech: 'compound',
    track: 'bodyweight_reps', arch: 'nordic_curl', sh: GLUTE_HAM_RAISE,
    alias: ['ghr'],
    cues: [
      'Feet locked in, pad at the hips, body straight.',
      'Lower to horizontal, then pull yourself back with the hamstrings.',
    ],
  }),
  ex({
    m: 'hip_thrust', eq: 'barbell', force: 'push', mech: 'compound', arch: 'hip_thrust',
    sh: HIP_THRUST, std: std('back-squat--barbell', 1.1, false),
    cues: [
      'Shoulder blades on a bench, bar across the hips on a pad.',
      'Drive through the heels until the torso is parallel to the floor.',
      'Squeeze at the top and stop short of arching the lower back.',
    ],
  }),
  ex({
    m: 'hip_thrust', eq: 'machine_plate_loaded', force: 'push', mech: 'compound',
    arch: 'hip_thrust', sh: HIP_THRUST,
    cues: [
      'Set the pad across the hips and the back against the rest.',
      'Easier to load heavily than the barbell version.',
    ],
  }),
  ex({
    m: 'hip_thrust', eq: 'bodyweight', v: ['single_leg'],
    limb: 'unilateral_sequential', force: 'push', mech: 'compound',
    track: 'bodyweight_reps', arch: 'hip_thrust', sh: HIP_THRUST,
    cues: [
      'One foot planted, the other knee pulled toward the chest.',
      'Keep the hips level; do not let the free side drop.',
    ],
  }),
  ex({
    m: 'glute_bridge', eq: 'barbell', force: 'push', mech: 'compound',
    arch: 'hip_thrust', sh: GLUTE_BRIDGE,
    cues: [
      'Lie flat on the floor with the bar over the hips.',
      'Press the hips up until the thighs and torso line up.',
    ],
  }),
  ex({
    m: 'glute_bridge', eq: 'bodyweight', force: 'push', mech: 'compound',
    track: 'bodyweight_reps', arch: 'hip_thrust', sh: GLUTE_BRIDGE,
    cues: [
      'Feet close to the glutes, ribs down.',
      'Squeeze at the top for a second on every rep.',
    ],
  }),
  ex({
    m: 'glute_kickback', eq: 'cable', limb: 'unilateral_sequential', force: 'push',
    mech: 'isolation', arch: 'hip_thrust', sh: GLUTE_KICKBACK, att: 'ankle_strap',
    cues: [
      'Ankle strap on a low pulley, torso hinged slightly forward.',
      'Drive the leg back and up without arching the lower back.',
    ],
  }),
  ex({
    m: 'glute_kickback', eq: 'machine_selectorized', limb: 'unilateral_sequential',
    force: 'push', mech: 'isolation', arch: 'hip_thrust', sh: GLUTE_KICKBACK,
    cues: [
      'Brace the torso on the pad and press the foot back against the plate.',
      'Stop the rep when the lower back wants to take over.',
    ],
  }),
  ex({
    m: 'pull_through', eq: 'cable', force: 'pull', mech: 'compound',
    arch: 'hip_hinge_pull_through', sh: PULL_THROUGH, att: 'rope',
    cues: [
      'Face away from a low pulley with the rope between the legs.',
      'Hinge back, then snap the hips forward to stand tall.',
      'A good way to learn the hinge without loading the spine.',
    ],
  }),
  ex({
    m: 'hip_abduction', eq: 'machine_selectorized', force: 'push', mech: 'isolation',
    arch: 'hip_abduction', sh: HIP_ABDUCTION,
    cues: [
      'Press the knees outward against the pads.',
      'Lean forward slightly to bias the upper glutes.',
    ],
  }),
  ex({
    m: 'hip_abduction', eq: 'cable', v: ['single_leg'], limb: 'unilateral_sequential',
    force: 'push', mech: 'isolation', arch: 'hip_abduction', sh: HIP_ABDUCTION,
    att: 'ankle_strap',
    cues: [
      'Ankle strap on a low pulley, standing side on.',
      'Sweep the leg out and away without leaning.',
    ],
  }),
  ex({
    m: 'hip_adduction', eq: 'machine_selectorized', force: 'pull', mech: 'isolation',
    arch: 'hip_adduction', sh: HIP_ADDUCTION,
    cues: [
      'Open the knees to a comfortable stretch, then squeeze them together.',
      'Control the return rather than letting the pads pull you open.',
    ],
  }),
  ex({
    m: 'calf_raise', eq: 'machine_selectorized', v: ['standing'], force: 'push',
    mech: 'isolation', arch: 'calf_raise', sh: CALF_RAISE_STANDING,
    cues: [
      'Balls of the feet on the platform, knees straight.',
      'Drop the heels for a full stretch, then rise all the way up.',
      'Pause at both ends; bouncing does nothing here.',
    ],
  }),
  ex({
    m: 'calf_raise', eq: 'machine_selectorized', v: ['seated'], force: 'push',
    mech: 'isolation', arch: 'calf_raise', sh: CALF_RAISE_SEATED,
    cues: [
      'Bent knees take the gastrocnemius out and leave the soleus.',
      'Higher reps suit this one.',
    ],
  }),
  ex({
    m: 'calf_raise', eq: 'leg_press_machine', force: 'push', mech: 'isolation',
    arch: 'calf_raise', sh: CALF_RAISE_STANDING,
    cues: [
      'Balls of the feet on the bottom edge of the platform.',
      'Keep the knees soft but not moving; the ankles do the work.',
    ],
  }),
  ex({
    m: 'calf_raise', eq: 'smith_machine', v: ['standing'], force: 'push',
    mech: 'isolation', arch: 'calf_raise', sh: CALF_RAISE_STANDING,
    cues: [
      'Stand on a block under the bar so the heels can drop.',
      'Rise onto the toes and hold the top.',
    ],
  }),
  ex({
    m: 'calf_raise', eq: 'dumbbell', v: ['single_leg'], limb: 'unilateral_sequential',
    force: 'push', mech: 'isolation', arch: 'calf_raise', sh: CALF_RAISE_STANDING,
    cues: [
      'One dumbbell in the working-side hand, other hand on a support.',
      'Full stretch at the bottom, full squeeze at the top.',
    ],
  }),
  ex({
    m: 'calf_raise', eq: 'bodyweight', v: ['standing'], force: 'push',
    mech: 'isolation', track: 'bodyweight_reps', arch: 'calf_raise',
    sh: CALF_RAISE_STANDING,
    cues: [
      'Stand on a step with the heels hanging off.',
      'Slow reps to a high count; calves respond to time under tension.',
    ],
  }),
];

const CORE: readonly SeedExercise[] = [
  ex({
    m: 'crunch', eq: 'bodyweight', force: 'pull', mech: 'isolation',
    track: 'bodyweight_reps', arch: 'trunk_flexion', sh: CRUNCH,
    cues: [
      'Lie on your back with the knees bent and the hands at the temples.',
      'Curl the ribs toward the hips; the lower back stays down.',
      'Stop pulling on the neck: the abs shorten, the head just follows.',
    ],
  }),
  ex({
    m: 'crunch', eq: 'bodyweight', v: ['decline'], force: 'pull', mech: 'isolation',
    track: 'bodyweight_reps', arch: 'trunk_flexion', sh: CRUNCH,
    cues: [
      'Hook the legs over a decline bench.',
      'Curl up only until the shoulder blades clear the pad.',
    ],
  }),
  ex({
    m: 'crunch', eq: 'cable', v: ['kneeling'], force: 'pull', mech: 'isolation',
    arch: 'trunk_flexion', sh: CABLE_CRUNCH, att: 'rope',
    alias: ['cable crunch', 'rope crunch'],
    cues: [
      'Kneel facing a high pulley with the rope beside the head.',
      'Crunch the elbows toward the thighs by rounding the spine.',
      'Hips stay fixed; this is not a hinge.',
    ],
  }),
  ex({
    m: 'crunch', eq: 'machine_selectorized', force: 'pull', mech: 'isolation',
    arch: 'trunk_flexion', sh: CABLE_CRUNCH,
    cues: [
      'Set the pad against the chest and grip the handles.',
      'Flex the trunk against the resistance and return slowly.',
    ],
  }),
  ex({
    m: 'crunch', eq: 'stability_ball', force: 'pull', mech: 'isolation',
    track: 'bodyweight_reps', arch: 'trunk_flexion', sh: CRUNCH,
    cues: [
      'Lower back supported on the ball so the abs start stretched.',
      'Curl up, pause, and lower until you feel the stretch again.',
    ],
  }),
  ex({
    m: 'sit_up', eq: 'bodyweight', force: 'pull', mech: 'compound',
    track: 'bodyweight_reps', arch: 'trunk_flexion', sh: SIT_UP,
    alias: ['situp', 'sit ups', 'situps'],
    cues: [
      'Feet anchored or flat, knees bent.',
      'Sit all the way up, then lower one vertebra at a time.',
    ],
  }),
  ex({
    m: 'reverse_crunch', eq: 'bodyweight', force: 'pull', mech: 'isolation',
    track: 'bodyweight_reps', arch: 'trunk_flexion', sh: REVERSE_CRUNCH,
    cues: [
      'Lie down and bring the knees over the hips.',
      'Curl the hips off the floor toward the ribs.',
      'Small range, done slowly, beats a big swing.',
    ],
  }),
  ex({
    m: 'bicycle_crunch', eq: 'bodyweight', pattern: 'rotation', force: 'pull',
    mech: 'isolation', track: 'bodyweight_reps', arch: 'trunk_flexion',
    sh: BICYCLE_CRUNCH,
    cues: [
      'Alternate bringing each elbow toward the opposite knee.',
      'Rotate from the ribs, not by yanking the head across.',
    ],
  }),
  ex({
    m: 'hanging_leg_raise', eq: 'bodyweight', force: 'pull', mech: 'isolation',
    track: 'bodyweight_reps', arch: 'hanging_leg_raise', sh: HANGING_LEG_RAISE,
    cues: [
      'Hang with straight arms and legs together.',
      'Lift the legs to horizontal or higher with a small posterior tilt.',
      'Lower without swinging; stop the set when the swing starts.',
    ],
  }),
  ex({
    m: 'hanging_knee_raise', eq: 'bodyweight', force: 'pull', mech: 'isolation',
    track: 'bodyweight_reps', arch: 'hanging_leg_raise', sh: HANGING_LEG_RAISE,
    cues: [
      'Same hang, but the knees stay bent.',
      'Curl the pelvis up at the top rather than just lifting the thighs.',
    ],
  }),
  ex({
    m: 'toes_to_bar', eq: 'bodyweight', force: 'pull', mech: 'compound',
    track: 'bodyweight_reps', arch: 'hanging_leg_raise', sh: TOES_TO_BAR,
    cues: [
      'Hang, engage the lats, and bring the toes to touch the bar.',
      'Control the descent; kipping makes it a different exercise.',
    ],
  }),
  ex({
    m: 'l_sit', eq: 'parallettes', force: 'static', mech: 'compound',
    track: 'duration', arch: 'anti_extension_hold', sh: L_SIT,
    cues: [
      'Press down hard on the bars and lift the hips clear.',
      'Hold the legs straight out in front, toes pointed.',
      'Tuck the knees if the straight-leg version collapses.',
    ],
  }),
  ex({
    m: 'plank', eq: 'bodyweight', force: 'static', mech: 'isolation',
    track: 'duration', bw: BW.plank, arch: 'anti_extension_hold', sh: PLANK,
    cues: [
      'Forearms under the shoulders, body in one line from head to heels.',
      'Squeeze the glutes and tuck the pelvis slightly.',
      'A shaking 30 seconds beats a sagging two minutes.',
    ],
  }),
  ex({
    m: 'side_plank', eq: 'bodyweight', pattern: 'anti_lateral_flexion',
    limb: 'unilateral_sequential', force: 'static', mech: 'isolation',
    track: 'duration', arch: 'anti_extension_hold', sh: SIDE_PLANK,
    cues: [
      'Elbow under the shoulder, feet stacked or staggered.',
      'Push the hip to the ceiling and hold it there.',
    ],
  }),
  ex({
    m: 'hollow_hold', eq: 'bodyweight', force: 'static', mech: 'isolation',
    track: 'duration', arch: 'anti_extension_hold', sh: HOLLOW_HOLD,
    cues: [
      'Press the lower back into the floor before lifting anything.',
      'Raise the shoulders and legs; lower the legs if the back arches.',
    ],
  }),
  ex({
    m: 'dead_bug', eq: 'bodyweight', force: 'static', mech: 'isolation',
    track: 'reps_only', arch: 'anti_extension_hold', sh: DEAD_BUG,
    cues: [
      'On your back, arms up and knees over the hips.',
      'Extend one arm and the opposite leg while the back stays flat.',
      'Slow and quiet; the rep is the control, not the reach.',
    ],
  }),
  ex({
    m: 'ab_wheel_rollout', eq: 'ab_wheel', force: 'pull', mech: 'compound',
    track: 'bodyweight_reps', arch: 'anti_extension_hold', sh: AB_WHEEL,
    cues: [
      'Start on the knees with the wheel under the shoulders.',
      'Roll out as far as you can keep the ribs down and the back flat.',
      'Pull back with the abs, not by hinging at the hips.',
    ],
  }),
  ex({
    m: 'russian_twist', eq: 'medicine_ball', limb: 'unilateral_alternating',
    force: 'pull', mech: 'isolation', arch: 'trunk_rotation', sh: TRUNK_ROTATION,
    cues: [
      'Sit leaning back at about 45 degrees with the feet off the floor.',
      'Rotate the ribcage side to side, keeping the arms in front of the chest.',
    ],
  }),
  ex({
    m: 'woodchop', eq: 'cable', limb: 'unilateral_sequential', force: 'pull',
    mech: 'compound', arch: 'trunk_rotation', sh: TRUNK_ROTATION, att: 'rope',
    alias: ['cable woodchopper'],
    cues: [
      'High pulley, both hands on the handle, feet planted wide.',
      'Pull down and across to the opposite hip by turning the torso.',
      'Let the back foot pivot instead of grinding the knee.',
    ],
  }),
  ex({
    m: 'woodchop', eq: 'cable', v: ['kneeling'], limb: 'unilateral_sequential',
    force: 'pull', mech: 'compound', arch: 'trunk_rotation', sh: TRUNK_ROTATION,
    cues: [
      'Half kneeling takes the legs out and forces the trunk to rotate.',
      'Keep the hips square to the front.',
    ],
  }),
  ex({
    m: 'pallof_press', eq: 'cable', limb: 'unilateral_sequential', force: 'push',
    mech: 'isolation', arch: 'anti_rotation_press', sh: ANTI_ROTATION,
    att: 'd_handle',
    cues: [
      'Stand side on to the pulley with the handle at the sternum.',
      'Press straight out and resist the pull toward the stack.',
      'The rep is holding still, not moving.',
    ],
  }),
  ex({
    m: 'mountain_climber', eq: 'bodyweight', force: 'static', mech: 'compound',
    track: 'duration', arch: 'anti_extension_hold', sh: MOUNTAIN_CLIMBER,
    cues: [
      'Start in a push-up position with the hips level.',
      'Drive the knees to the chest alternately without bouncing the hips.',
    ],
  }),
];

const OLYMPIC: readonly SeedExercise[] = [
  ex({
    m: 'clean', eq: 'barbell', force: 'pull', mech: 'compound', arch: 'olympic_pull',
    sh: OLYMPIC_PULL, std: std('deadlift--barbell', 0.6, false),
    alias: ['squat clean', 'full clean'],
    cues: [
      'Pull from the floor with the same setup as a deadlift.',
      'Extend hard at the hips, then pull under and catch in a front squat.',
      'Stand up out of the catch to finish the rep.',
    ],
  }),
  ex({
    m: 'power_clean', eq: 'barbell', force: 'pull', mech: 'compound',
    arch: 'olympic_pull', sh: OLYMPIC_PULL, std: std('deadlift--barbell', 0.5, false),
    cues: [
      'Same pull, but catch with the hips above a quarter squat.',
      'Punch the elbows through fast so the bar lands on the shoulders.',
    ],
  }),
  ex({
    m: 'hang_clean', eq: 'barbell', force: 'pull', mech: 'compound',
    arch: 'olympic_pull', sh: OLYMPIC_PULL,
    cues: [
      'Start standing, hinge to just above the knee, then explode.',
      'Removes the floor phase and drills the second pull.',
    ],
  }),
  ex({
    m: 'clean_and_jerk', eq: 'barbell', force: 'pull', mech: 'compound',
    arch: 'olympic_pull', sh: OLYMPIC_PULL,
    cues: [
      'Clean the bar to the shoulders and stand fully.',
      'Dip, drive, and split or push under to lock it out overhead.',
      'Recover the feet to a line before dropping the bar.',
    ],
  }),
  ex({
    m: 'snatch', eq: 'barbell', force: 'pull', mech: 'compound', arch: 'olympic_pull',
    sh: OLYMPIC_PULL, std: std('deadlift--barbell', 0.45, false),
    cues: [
      'Wide grip, bar close to the body, one continuous pull.',
      'Turn the bar over and catch it locked out in a deep squat.',
      'The hardest barbell lift to learn: coach it before loading it.',
    ],
  }),
  ex({
    m: 'power_snatch', eq: 'barbell', force: 'pull', mech: 'compound',
    arch: 'olympic_pull', sh: OLYMPIC_PULL,
    cues: [
      'Same pull, caught above parallel with the arms locked.',
      'Punch up into the bar rather than pressing it out.',
    ],
  }),
  ex({
    m: 'hang_snatch', eq: 'barbell', force: 'pull', mech: 'compound',
    arch: 'olympic_pull', sh: OLYMPIC_PULL,
    cues: [
      'Hinge to the hang position, then extend and pull under.',
      'Great for fixing an early arm bend.',
    ],
  }),
  ex({
    m: 'push_jerk', eq: 'barbell', force: 'push', mech: 'compound',
    arch: 'olympic_pull', sh: JERK,
    cues: [
      'Dip and drive the bar up, then drop under it into a partial squat.',
      'Lock the elbows before you stand, not after.',
    ],
  }),
  ex({
    m: 'high_pull', eq: 'barbell', force: 'pull', mech: 'compound',
    arch: 'olympic_pull', sh: OLYMPIC_PULL,
    cues: [
      'Pull from the hang or the floor and finish with a hard shrug.',
      'The elbows lead high; the bar travels close to the body.',
    ],
  }),
  ex({
    m: 'high_pull', eq: 'dumbbell', v: ['single_arm'], limb: 'unilateral_sequential',
    force: 'pull', mech: 'compound', arch: 'olympic_pull', sh: OLYMPIC_PULL,
    cues: [
      'Hinge, then snap the hips and pull the bell to chest height.',
      'Keep the elbow above the hand at the top.',
    ],
  }),
  ex({
    m: 'thruster', eq: 'barbell', force: 'push', mech: 'compound',
    arch: 'olympic_pull', sh: THRUSTER,
    cues: [
      'Front rack, squat to depth, then stand and press in one motion.',
      'Use the leg drive; do not pause at the top of the squat.',
    ],
  }),
  ex({
    m: 'thruster', eq: 'dumbbell', force: 'push', mech: 'compound',
    arch: 'olympic_pull', sh: THRUSTER,
    cues: [
      'Bells at the shoulders, squat and drive straight overhead.',
      'Keep the elbows in front so the bells do not drift back.',
    ],
  }),
  ex({
    m: 'jump_squat', eq: 'bodyweight', force: 'push', mech: 'compound',
    track: 'bodyweight_reps', arch: 'plyometric_jump', sh: JUMP_SQUAT,
    cues: [
      'Quarter squat, then jump as high as you can.',
      'Land softly through the whole foot and reset between reps.',
    ],
  }),
  ex({
    m: 'box_jump', eq: 'plyo_box', force: 'push', mech: 'compound',
    track: 'reps_only', arch: 'plyometric_jump', sh: BOX_JUMP,
    cues: [
      'Pick a box you can land on with the hips above parallel.',
      'Step down rather than jumping down.',
    ],
  }),
];

const CONDITIONING: readonly SeedExercise[] = [
  ex({
    m: 'farmers_walk', eq: 'farmers_handles', force: 'carry', mech: 'compound',
    track: 'weight_distance', arch: 'loaded_carry', sh: FARMERS_CARRY,
    alias: ['farmers carry'],
    cues: [
      'Stand tall, brace, and walk with short quick steps.',
      'Shoulders back; do not let the weight round you forward.',
      'Set the handles down under control, never drop them on your feet.',
    ],
  }),
  ex({
    m: 'farmers_walk', eq: 'dumbbell', force: 'carry', mech: 'compound',
    track: 'weight_distance', arch: 'loaded_carry', sh: FARMERS_CARRY,
    cues: [
      'One dumbbell per hand, arms hanging straight.',
      'Walk a set distance and log the weight per hand.',
    ],
  }),
  ex({
    m: 'farmers_walk', eq: 'kettlebell', force: 'carry', mech: 'compound',
    track: 'weight_distance', arch: 'loaded_carry', sh: FARMERS_CARRY,
    cues: [
      'Bells hanging at the sides, wrists straight.',
      'Grip is usually the limit, not the legs.',
    ],
  }),
  ex({
    m: 'farmers_walk', eq: 'trap_bar', force: 'carry', mech: 'compound',
    track: 'weight_distance', arch: 'loaded_carry', sh: FARMERS_CARRY,
    cues: [
      'Deadlift the trap bar, then walk it.',
      'Take short steps so the bar does not start swinging.',
    ],
  }),
  ex({
    m: 'farmers_walk', eq: 'kettlebell', v: ['overhead'], force: 'carry',
    mech: 'compound', track: 'weight_distance', arch: 'loaded_carry',
    sh: OVERHEAD_CARRY,
    alias: ['waiter walk', 'overhead carry'],
    cues: [
      'Lock the bells out overhead with the biceps by the ears.',
      'Walk slowly; stop the set the moment an arm starts to drift.',
    ],
  }),
  ex({
    m: 'suitcase_carry', eq: 'kettlebell', limb: 'unilateral_sequential',
    pattern: 'anti_lateral_flexion', force: 'carry', mech: 'compound',
    track: 'weight_distance', arch: 'loaded_carry', sh: SUITCASE_CARRY,
    cues: [
      'One bell in one hand, shoulders level.',
      'Resist the lean; the free side of the trunk is doing the work.',
      'Walk out and back so both sides get the same distance.',
    ],
  }),
  ex({
    m: 'bear_hug_carry', eq: 'sandbag', force: 'carry', mech: 'compound',
    track: 'weight_distance', arch: 'loaded_carry', sh: BEAR_HUG_CARRY,
    cues: [
      'Hug the bag high on the chest and squeeze it hard.',
      'Breathe in short bursts; a full breath will loosen the grip.',
    ],
  }),
  ex({
    m: 'yoke_walk', eq: 'yoke', force: 'carry', mech: 'compound',
    track: 'weight_distance', arch: 'loaded_carry', sh: YOKE_WALK,
    cues: [
      'Set the yoke on the traps as you would a squat bar.',
      'Stand up, brace, and take fast short steps.',
      'If it starts swinging, stop rather than fighting it.',
    ],
  }),
  ex({
    m: 'sled_push', eq: 'sled', force: 'push', mech: 'compound',
    track: 'weight_distance', arch: 'loaded_carry', sh: SLED_PUSH,
    alias: ['prowler push'],
    cues: [
      'Arms straight, body leaning into the sled at about 45 degrees.',
      'Drive with short powerful steps and keep the hips low.',
    ],
  }),
  ex({
    m: 'sled_drag', eq: 'sled', force: 'pull', mech: 'compound',
    track: 'weight_distance', arch: 'loaded_carry', sh: SLED_DRAG,
    alias: ['reverse sled drag', 'backward sled pull'],
    cues: [
      'Face the sled and walk backward holding the straps.',
      'Stay low and pull with the quads; easy on the joints.',
    ],
  }),
  ex({
    m: 'battle_rope_wave', eq: 'battle_ropes', force: 'push', mech: 'compound',
    track: 'duration', arch: 'cyclic_conditioning', sh: BATTLE_ROPE,
    alias: ['battle ropes'],
    cues: [
      'Athletic stance, one rope end in each hand.',
      'Drive alternating waves from the shoulders, not the wrists.',
      'Time the interval rather than counting reps.',
    ],
  }),
  ex({
    m: 'kettlebell_swing', eq: 'kettlebell', force: 'pull', mech: 'compound',
    arch: 'ballistic_swing', sh: KETTLEBELL_SWING,
    alias: ['russian swing'],
    cues: [
      'Hike the bell back between the legs like a snap pass.',
      'Snap the hips forward so the bell floats to chest height.',
      'The arms are ropes; the hips do all of it.',
    ],
  }),
  ex({
    m: 'turkish_get_up', eq: 'kettlebell', pattern: 'carry',
    limb: 'unilateral_sequential', force: 'push', mech: 'compound',
    arch: 'loaded_carry', sh: TURKISH_GET_UP,
    alias: ['tgu'],
    cues: [
      'Start on your back with one bell locked out over the shoulder.',
      'Roll to the elbow, to the hand, bridge, sweep the leg through and stand.',
      'Reverse the same steps; the eyes stay on the bell the whole way.',
    ],
  }),
  ex({
    m: 'wall_ball', eq: 'medicine_ball', force: 'push', mech: 'compound',
    arch: 'plyometric_jump', sh: WALL_BALL,
    cues: [
      'Hold the ball at the chest, squat to depth.',
      'Stand and throw it to a target on the wall.',
      'Catch it in the next squat rather than absorbing it standing.',
    ],
  }),
  ex({
    m: 'tire_flip', eq: 'tire', pattern: 'olympic', force: 'push', mech: 'compound',
    track: 'reps_only', arch: 'olympic_pull', sh: TIRE_FLIP,
    cues: [
      'Get the chest against the tire and the hips low.',
      'Drive with the legs, then step in and push it over.',
    ],
  }),
  ex({
    m: 'burpee', eq: 'bodyweight', force: 'push', mech: 'compound',
    track: 'reps_only', arch: 'plyometric_jump', sh: BURPEE,
    cues: [
      'Drop to a push-up, jump the feet back in, then jump up.',
      'Pace it; burpees punish an aggressive first minute.',
    ],
  }),
  ex({
    m: 'jump_rope', eq: 'jump_rope', force: 'push', mech: 'compound',
    track: 'duration', arch: 'cyclic_conditioning', sh: JUMP_ROPE,
    alias: ['skipping', 'skipping rope', 'rope skipping'],
    cues: [
      'Small jumps off the balls of the feet, elbows close to the ribs.',
      'Turn the rope with the wrists.',
    ],
  }),
];

const CARDIO: readonly SeedExercise[] = [
  ex({
    m: 'run', eq: 'treadmill', force: 'push', mech: 'compound',
    track: 'distance_duration', arch: 'cyclic_conditioning', sh: RUNNING,
    alias: ['treadmill run', 'jog', 'jogging', 'treadmill'],
    cues: [
      'Set the speed and run tall with a relaxed upper body.',
      'Log distance and time; pace is derived from the two.',
    ],
  }),
  ex({
    m: 'walk', eq: 'treadmill', v: ['incline'], force: 'push', mech: 'compound',
    track: 'distance_duration', arch: 'cyclic_conditioning', sh: RUNNING,
    alias: ['incline treadmill walk', 'treadmill walk'],
    cues: [
      'Raise the incline and walk without holding the rails.',
      'Holding on removes most of the work.',
    ],
  }),
  ex({
    m: 'row', eq: 'rower', force: 'pull', mech: 'compound',
    track: 'distance_duration', arch: 'cyclic_conditioning', sh: ERG_ROW,
    alias: ['erg', 'rower', 'concept 2', 'rowing machine', 'indoor rowing'],
    cues: [
      'Drive with the legs, then swing the torso, then pull the arms.',
      'Reverse that order on the recovery.',
      'Roughly 60 percent of the work is legs.',
    ],
  }),
  ex({
    m: 'cycle', eq: 'stationary_bike', force: 'push', mech: 'compound',
    track: 'distance_duration', arch: 'cyclic_conditioning', sh: CYCLING,
    alias: ['stationary bike', 'spin bike', 'exercise bike', 'cycling'],
    cues: [
      'Set the saddle so the knee stays slightly bent at the bottom.',
      'Log distance and time.',
    ],
  }),
  ex({
    m: 'air_bike', eq: 'air_bike', force: 'push', mech: 'compound',
    track: 'distance_duration', arch: 'cyclic_conditioning', sh: AIR_BIKE,
    alias: ['assault bike', 'fan bike', 'echo bike'],
    cues: [
      'Push and pull the handles while the legs drive.',
      'Resistance rises with effort, so intervals get brutal fast.',
    ],
  }),
  ex({
    m: 'elliptical_stride', eq: 'elliptical', force: 'push', mech: 'compound',
    track: 'distance_duration', arch: 'cyclic_conditioning', sh: ELLIPTICAL,
    alias: ['cross trainer', 'elliptical trainer'],
    cues: [
      'Stand tall and push and pull the handles with the stride.',
      'Low impact, so useful when the joints need a break.',
    ],
  }),
  ex({
    m: 'stair_climb', eq: 'stair_climber', force: 'push', mech: 'compound',
    track: 'distance_duration', arch: 'cyclic_conditioning', sh: STAIR_CLIMB,
    alias: ['stairmaster', 'stepmill'],
    cues: [
      'Stand upright and let go of the rails if you can.',
      'Full steps; do not bounce on the balls of the feet.',
    ],
  }),
  ex({
    m: 'ski_erg_pull', eq: 'ski_erg', force: 'pull', mech: 'compound',
    track: 'distance_duration', arch: 'cyclic_conditioning', sh: SKI_ERG,
    cues: [
      'Reach tall, then hinge and pull the handles past the hips.',
      'The lats and trunk drive it, not the arms.',
    ],
  }),
];

const NECK: readonly SeedExercise[] = [
  ex({
    m: 'neck_curl', eq: 'neck_harness', force: 'pull', mech: 'isolation',
    arch: 'neck_isolation', sh: NECK_FLEXION,
    cues: [
      'Lie face up on a bench with the head off the end.',
      'Tuck the chin and curl the head up slowly.',
      'Very light weight and slow tempo, always.',
    ],
  }),
  ex({
    m: 'neck_extension', eq: 'neck_machine', pattern: 'isolation_extension',
    force: 'pull', mech: 'isolation', arch: 'neck_isolation', sh: NECK_EXTENSION,
    cues: [
      'Set the pad on the back of the head and sit tall.',
      'Extend through a comfortable range with no jerking.',
    ],
  }),
];

// ─────────────────────────────────────────────────────────────────────────────
// The seed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every Tier-0 catalog exercise, in the order the sections are authored.
 *
 * Consumers should NOT rely on this order: `index.ts` builds the id, name and
 * muscle indexes, and `db/` inserts by id. The order exists only so a diff of
 * this file reads like the gym it describes.
 */
export const SEED_EXERCISES: readonly SeedExercise[] = [
  ...CHEST,
  ...BACK,
  ...SHOULDERS,
  ...ARMS,
  ...LEGS,
  ...CORE,
  ...OLYMPIC,
  ...CONDITIONING,
  ...CARDIO,
  ...NECK,
];

/** Row count, exported so a migration can assert it inserted all of them. */
export const SEED_EXERCISE_COUNT = SEED_EXERCISES.length;
