/**
 * Canonical muscle taxonomy for Stronger 2.0.
 *
 * Source: docs/research/exercise-taxonomy-muscle-equipment-pattern-models-.md,
 * PART A (A1 regions, A2 the 21 muscle groups, A3 the 74 muscle entries).
 *
 * Three levels: Region > MuscleGroup > Muscle > body-map SVG region.
 *
 * The 21 groups are the ONLY muscle vocabulary the app stores. Every upstream
 * dataset (RepDB's 30 slugs, wger's 15, free-exercise-db's 17) is mapped INTO
 * this enum at ingest time and its raw names are never persisted — see
 * `REPDB_MUSCLE_MAP`, `WGER_MUSCLE_MAP`, `FREE_EXERCISE_DB_MUSCLE_MAP`.
 *
 * Pure TypeScript. No platform imports.
 */

// ─────────────────────────────────────────────────────────────────────────────
// A1. REGIONS (9)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Coarse body regions used by the body-map filter chips on Progress > Exercises.
 * Source: research PART A, A1.
 */
export type Region =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'arms'
  | 'core'
  | 'legs'
  | 'neck'
  | 'full_body'
  | 'cardio';

/** All 9 regions in display order. Source: research PART A, A1. */
export const REGIONS: readonly Region[] = [
  'chest',
  'back',
  'shoulders',
  'arms',
  'core',
  'legs',
  'neck',
  'full_body',
  'cardio',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// A2. MUSCLE GROUPS (21) — the canonical storage enum
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The 21 canonical muscle groups. Readiness, volume attribution, split analysis
 * and world standings are all stored at this resolution.
 *
 * Strictly finer than Hevy's 15 filters: we split the deltoid into three heads
 * and carry obliques, hip flexors, adductors and abductors as first-class groups.
 * Source: research PART A, A2.
 */
export type MuscleGroupId =
  | 'chest'
  | 'upper_back'
  | 'lats'
  | 'traps'
  | 'lower_back'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'hip_flexors'
  | 'adductors'
  | 'abductors'
  | 'calves'
  | 'neck';

/**
 * Which face of the front/back body map shades a muscle or group.
 * `both` means the group owns paths on both SVGs (e.g. side delts, calves).
 */
export type BodyMapView = 'front' | 'back' | 'both';

/**
 * The 12-chip compact readiness row. The research (PART A, A2 "UI RULE") fixes
 * this list: 21 chips will not fit one row, so readiness is STORED at 21 groups
 * and DISPLAYED at 12, expandable to all 21.
 */
export type CompactGroupId =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'abs'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'forearms'
  | 'traps';

/** The 12 compact chips in display order. Source: research PART A, A2 UI RULE. */
export const COMPACT_GROUPS: readonly CompactGroupId[] = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'abs',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'forearms',
  'traps',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// A3. MUSCLES (74) with body-map SVG regions
// ─────────────────────────────────────────────────────────────────────────────

/** One anatomical muscle entry. Source: research PART A, A3. */
export interface MuscleDef {
  /** Parent group. Every muscle belongs to exactly one of the 21 groups. */
  readonly group: MuscleGroupId;
  /** Anatomical (Latin) name, shown in the exercise detail sheet. */
  readonly latin: string;
  /** Plain-English name, shown in chips and tooltips. */
  readonly common: string;
  /** Which body-map face the muscle appears on. */
  readonly view: BodyMapView;
  /**
   * `true` when the muscle sits under other tissue on a surface render. Deep
   * muscles are LISTED in the exercise detail but never shaded on the map.
   */
  readonly deep: boolean;
  /** SVG path ids that front.svg / back.svg must expose for this muscle. */
  readonly mapRegions: readonly string[];
}

/**
 * All 74 muscle entries, transcribed verbatim from research PART A, A3.
 * 48 are shadeable (`deep: false`), 26 are deep / listed-only.
 *
 * NOTE on the research's own path counts: A3 closes with "front.svg needs 41
 * distinct paths, back.svg 39". Counting the transcribed table gives 49 distinct
 * shadeable `f_*` ids and 40 distinct shadeable `b_*` ids. The table is the
 * authoritative artefact (it is the thing the SVGs must match), so the counts
 * below are DERIVED from it by `frontMapRegions()` / `backMapRegions()` rather
 * than hard-coded from the prose.
 */
export const MUSCLES = {
  // ── chest (5) ──────────────────────────────────────────────────────────────
  pec_major_clavicular: {
    group: 'chest',
    latin: 'Pectoralis major (pars clavicularis)',
    common: 'Upper chest',
    view: 'front',
    deep: false,
    mapRegions: ['f_chest_upper_l', 'f_chest_upper_r'],
  },
  pec_major_sternal: {
    group: 'chest',
    latin: 'Pectoralis major (pars sternocostalis)',
    common: 'Mid chest',
    view: 'front',
    deep: false,
    mapRegions: ['f_chest_mid_l', 'f_chest_mid_r'],
  },
  pec_major_costal: {
    group: 'chest',
    latin: 'Pectoralis major (pars abdominalis)',
    common: 'Lower chest',
    view: 'front',
    deep: false,
    mapRegions: ['f_chest_low_l', 'f_chest_low_r'],
  },
  pec_minor: {
    group: 'chest',
    latin: 'Pectoralis minor',
    common: 'Pec minor',
    view: 'front',
    deep: true,
    mapRegions: [],
  },
  serratus_anterior: {
    group: 'chest',
    latin: 'Serratus anterior',
    common: 'Serratus',
    view: 'front',
    deep: false,
    mapRegions: ['f_serratus_l', 'f_serratus_r'],
  },

  // ── upper_back (10) ────────────────────────────────────────────────────────
  rhomboid_major: {
    group: 'upper_back',
    latin: 'Rhomboideus major',
    common: 'Rhomboids',
    view: 'back',
    deep: true,
    mapRegions: ['b_upperback_mid'],
  },
  rhomboid_minor: {
    group: 'upper_back',
    latin: 'Rhomboideus minor',
    common: 'Rhomboids',
    view: 'back',
    deep: true,
    mapRegions: ['b_upperback_mid'],
  },
  trapezius_middle: {
    group: 'upper_back',
    latin: 'Trapezius (pars transversa)',
    common: 'Mid traps',
    view: 'back',
    deep: false,
    mapRegions: ['b_traps_mid'],
  },
  trapezius_lower: {
    group: 'upper_back',
    latin: 'Trapezius (pars ascendens)',
    common: 'Lower traps',
    view: 'back',
    deep: false,
    mapRegions: ['b_traps_lower'],
  },
  teres_major: {
    group: 'upper_back',
    latin: 'Teres major',
    common: 'Teres major',
    view: 'back',
    deep: false,
    mapRegions: ['b_teres_l', 'b_teres_r'],
  },
  teres_minor: {
    group: 'upper_back',
    latin: 'Teres minor',
    common: 'Teres minor (cuff)',
    view: 'back',
    deep: false,
    mapRegions: ['b_cuff_l', 'b_cuff_r'],
  },
  infraspinatus: {
    group: 'upper_back',
    latin: 'Infraspinatus',
    common: 'Infraspinatus (cuff)',
    view: 'back',
    deep: false,
    mapRegions: ['b_cuff_l', 'b_cuff_r'],
  },
  supraspinatus: {
    group: 'upper_back',
    latin: 'Supraspinatus',
    common: 'Supraspinatus (cuff)',
    view: 'back',
    deep: true,
    mapRegions: ['b_cuff_upper'],
  },
  subscapularis: {
    group: 'upper_back',
    latin: 'Subscapularis',
    common: 'Subscapularis (cuff)',
    view: 'back',
    deep: true,
    mapRegions: [],
  },
  levator_scapulae: {
    group: 'upper_back',
    latin: 'Levator scapulae',
    common: 'Levator scapulae',
    view: 'back',
    deep: true,
    mapRegions: ['b_neck_side'],
  },

  // ── lats (2) ───────────────────────────────────────────────────────────────
  latissimus_dorsi_upper: {
    group: 'lats',
    latin: 'Latissimus dorsi (upper fibres)',
    common: 'Upper lats',
    view: 'back',
    deep: false,
    mapRegions: ['b_lat_upper_l', 'b_lat_upper_r'],
  },
  latissimus_dorsi_lower: {
    group: 'lats',
    latin: 'Latissimus dorsi (lower fibres)',
    common: 'Lower lats',
    view: 'back',
    deep: false,
    mapRegions: ['b_lat_lower_l', 'b_lat_lower_r'],
  },

  // ── traps (1) ──────────────────────────────────────────────────────────────
  trapezius_upper: {
    group: 'traps',
    latin: 'Trapezius (pars descendens)',
    common: 'Upper traps',
    view: 'both',
    deep: false,
    mapRegions: ['b_traps_upper', 'f_traps_front'],
  },

  // ── lower_back (5) ─────────────────────────────────────────────────────────
  erector_spinae_iliocostalis: {
    group: 'lower_back',
    latin: 'Iliocostalis',
    common: 'Erectors (lateral)',
    view: 'back',
    deep: false,
    mapRegions: ['b_erector_l', 'b_erector_r'],
  },
  erector_spinae_longissimus: {
    group: 'lower_back',
    latin: 'Longissimus',
    common: 'Erectors (mid)',
    view: 'back',
    deep: false,
    mapRegions: ['b_erector_l', 'b_erector_r'],
  },
  erector_spinae_spinalis: {
    group: 'lower_back',
    latin: 'Spinalis',
    common: 'Erectors (medial)',
    view: 'back',
    deep: true,
    mapRegions: ['b_erector_column'],
  },
  quadratus_lumborum: {
    group: 'lower_back',
    latin: 'Quadratus lumborum',
    common: 'QL',
    view: 'back',
    deep: true,
    mapRegions: ['b_lowback_deep'],
  },
  multifidus: {
    group: 'lower_back',
    latin: 'Multifidus',
    common: 'Multifidus',
    view: 'back',
    deep: true,
    mapRegions: [],
  },

  // ── deltoids (3) ───────────────────────────────────────────────────────────
  deltoid_anterior: {
    group: 'front_delts',
    latin: 'Deltoideus (pars clavicularis)',
    common: 'Front delt',
    view: 'front',
    deep: false,
    mapRegions: ['f_delt_front_l', 'f_delt_front_r'],
  },
  deltoid_lateral: {
    group: 'side_delts',
    latin: 'Deltoideus (pars acromialis)',
    common: 'Side delt',
    view: 'both',
    deep: false,
    mapRegions: ['f_delt_side_l', 'f_delt_side_r', 'b_delt_side_l', 'b_delt_side_r'],
  },
  deltoid_posterior: {
    group: 'rear_delts',
    latin: 'Deltoideus (pars spinalis)',
    common: 'Rear delt',
    view: 'back',
    deep: false,
    mapRegions: ['b_delt_rear_l', 'b_delt_rear_r'],
  },

  // ── biceps (4) ─────────────────────────────────────────────────────────────
  biceps_long_head: {
    group: 'biceps',
    latin: 'Biceps brachii (caput longum)',
    common: 'Biceps long head',
    view: 'front',
    deep: false,
    mapRegions: ['f_bicep_outer_l', 'f_bicep_outer_r'],
  },
  biceps_short_head: {
    group: 'biceps',
    latin: 'Biceps brachii (caput breve)',
    common: 'Biceps short head',
    view: 'front',
    deep: false,
    mapRegions: ['f_bicep_inner_l', 'f_bicep_inner_r'],
  },
  brachialis: {
    group: 'biceps',
    latin: 'Brachialis',
    common: 'Brachialis',
    view: 'front',
    deep: false,
    mapRegions: ['f_brachialis_l', 'f_brachialis_r'],
  },
  coracobrachialis: {
    group: 'biceps',
    latin: 'Coracobrachialis',
    common: 'Coracobrachialis',
    view: 'front',
    deep: true,
    mapRegions: [],
  },

  // ── triceps (4) ────────────────────────────────────────────────────────────
  triceps_long_head: {
    group: 'triceps',
    latin: 'Triceps brachii (caput longum)',
    common: 'Triceps long head',
    view: 'back',
    deep: false,
    mapRegions: ['b_tri_inner_l', 'b_tri_inner_r'],
  },
  triceps_lateral_head: {
    group: 'triceps',
    latin: 'Triceps brachii (caput laterale)',
    common: 'Triceps lateral head',
    view: 'back',
    deep: false,
    mapRegions: ['b_tri_outer_l', 'b_tri_outer_r'],
  },
  triceps_medial_head: {
    group: 'triceps',
    latin: 'Triceps brachii (caput mediale)',
    common: 'Triceps medial head',
    view: 'back',
    deep: true,
    mapRegions: ['b_tri_lower_l', 'b_tri_lower_r'],
  },
  anconeus: {
    group: 'triceps',
    latin: 'Anconeus',
    common: 'Anconeus',
    view: 'back',
    deep: true,
    mapRegions: [],
  },

  // ── forearms (5) ───────────────────────────────────────────────────────────
  brachioradialis: {
    group: 'forearms',
    latin: 'Brachioradialis',
    common: 'Brachioradialis',
    view: 'front',
    deep: false,
    mapRegions: ['f_forearm_outer_l', 'f_forearm_outer_r'],
  },
  wrist_flexors: {
    group: 'forearms',
    latin: 'Flexor carpi radialis / ulnaris, palmaris longus, flexor digitorum',
    common: 'Wrist flexors',
    view: 'front',
    deep: false,
    mapRegions: ['f_forearm_front_l', 'f_forearm_front_r'],
  },
  wrist_extensors: {
    group: 'forearms',
    latin: 'Extensor carpi radialis longus / brevis, extensor carpi ulnaris, extensor digitorum',
    common: 'Wrist extensors',
    view: 'back',
    deep: false,
    mapRegions: ['b_forearm_back_l', 'b_forearm_back_r'],
  },
  pronator_teres: {
    group: 'forearms',
    latin: 'Pronator teres',
    common: 'Pronator',
    view: 'front',
    deep: true,
    mapRegions: [],
  },
  supinator: {
    group: 'forearms',
    latin: 'Supinator',
    common: 'Supinator',
    view: 'front',
    deep: true,
    mapRegions: [],
  },

  // ── abs (3) ────────────────────────────────────────────────────────────────
  rectus_abdominis_upper: {
    group: 'abs',
    latin: 'Rectus abdominis (superior)',
    common: 'Upper abs',
    view: 'front',
    deep: false,
    mapRegions: ['f_abs_upper'],
  },
  rectus_abdominis_lower: {
    group: 'abs',
    latin: 'Rectus abdominis (inferior)',
    common: 'Lower abs',
    view: 'front',
    deep: false,
    mapRegions: ['f_abs_lower'],
  },
  transversus_abdominis: {
    group: 'abs',
    latin: 'Transversus abdominis',
    common: 'TVA',
    view: 'front',
    deep: true,
    mapRegions: [],
  },

  // ── obliques (2) ───────────────────────────────────────────────────────────
  external_oblique: {
    group: 'obliques',
    latin: 'Obliquus externus abdominis',
    common: 'External obliques',
    view: 'front',
    deep: false,
    mapRegions: ['f_oblique_l', 'f_oblique_r'],
  },
  internal_oblique: {
    group: 'obliques',
    latin: 'Obliquus internus abdominis',
    common: 'Internal obliques',
    view: 'front',
    deep: true,
    mapRegions: ['f_oblique_l', 'f_oblique_r'],
  },

  // ── quads (5) ──────────────────────────────────────────────────────────────
  rectus_femoris: {
    group: 'quads',
    latin: 'Rectus femoris',
    common: 'Rectus femoris',
    view: 'front',
    deep: false,
    mapRegions: ['f_quad_mid_l', 'f_quad_mid_r'],
  },
  vastus_lateralis: {
    group: 'quads',
    latin: 'Vastus lateralis',
    common: 'Outer quad',
    view: 'front',
    deep: false,
    mapRegions: ['f_quad_outer_l', 'f_quad_outer_r'],
  },
  vastus_medialis: {
    group: 'quads',
    latin: 'Vastus medialis',
    common: 'VMO / teardrop',
    view: 'front',
    deep: false,
    mapRegions: ['f_quad_inner_l', 'f_quad_inner_r'],
  },
  vastus_intermedius: {
    group: 'quads',
    latin: 'Vastus intermedius',
    common: 'Vastus intermedius',
    view: 'front',
    deep: true,
    mapRegions: [],
  },
  sartorius: {
    group: 'quads',
    latin: 'Sartorius',
    common: 'Sartorius',
    view: 'front',
    deep: false,
    mapRegions: ['f_sartorius_l', 'f_sartorius_r'],
  },

  // ── hamstrings (4) ─────────────────────────────────────────────────────────
  biceps_femoris_long: {
    group: 'hamstrings',
    latin: 'Biceps femoris (caput longum)',
    common: 'Ham lateral',
    view: 'back',
    deep: false,
    mapRegions: ['b_ham_outer_l', 'b_ham_outer_r'],
  },
  biceps_femoris_short: {
    group: 'hamstrings',
    latin: 'Biceps femoris (caput breve)',
    common: 'Ham short head',
    view: 'back',
    deep: true,
    mapRegions: ['b_ham_outer_l', 'b_ham_outer_r'],
  },
  semitendinosus: {
    group: 'hamstrings',
    latin: 'Semitendinosus',
    common: 'Ham medial',
    view: 'back',
    deep: false,
    mapRegions: ['b_ham_inner_l', 'b_ham_inner_r'],
  },
  semimembranosus: {
    group: 'hamstrings',
    latin: 'Semimembranosus',
    common: 'Ham medial deep',
    view: 'back',
    deep: true,
    mapRegions: ['b_ham_inner_l', 'b_ham_inner_r'],
  },

  // ── glutes (1) ─────────────────────────────────────────────────────────────
  gluteus_maximus: {
    group: 'glutes',
    latin: 'Gluteus maximus',
    common: 'Glute max',
    view: 'back',
    deep: false,
    mapRegions: ['b_glute_l', 'b_glute_r'],
  },

  // ── abductors (4) ──────────────────────────────────────────────────────────
  gluteus_medius: {
    group: 'abductors',
    latin: 'Gluteus medius',
    common: 'Glute med',
    view: 'back',
    deep: false,
    mapRegions: ['b_hip_side_l', 'b_hip_side_r'],
  },
  gluteus_minimus: {
    group: 'abductors',
    latin: 'Gluteus minimus',
    common: 'Glute min',
    view: 'back',
    deep: true,
    mapRegions: [],
  },
  tensor_fasciae_latae: {
    group: 'abductors',
    latin: 'Tensor fasciae latae',
    common: 'TFL',
    view: 'front',
    deep: false,
    mapRegions: ['f_tfl_l', 'f_tfl_r'],
  },
  piriformis: {
    group: 'abductors',
    latin: 'Piriformis',
    common: 'Piriformis',
    view: 'back',
    deep: true,
    mapRegions: [],
  },

  // ── adductors (5) ──────────────────────────────────────────────────────────
  adductor_magnus: {
    group: 'adductors',
    latin: 'Adductor magnus',
    common: 'Adductor magnus',
    view: 'both',
    deep: false,
    mapRegions: ['f_adductor_upper_l', 'f_adductor_upper_r', 'b_adductor_l', 'b_adductor_r'],
  },
  adductor_longus: {
    group: 'adductors',
    latin: 'Adductor longus',
    common: 'Adductor longus',
    view: 'front',
    deep: false,
    mapRegions: ['f_adductor_l', 'f_adductor_r'],
  },
  adductor_brevis: {
    group: 'adductors',
    latin: 'Adductor brevis',
    common: 'Adductor brevis',
    view: 'front',
    deep: true,
    mapRegions: [],
  },
  gracilis: {
    group: 'adductors',
    latin: 'Gracilis',
    common: 'Gracilis',
    view: 'front',
    deep: false,
    mapRegions: ['f_gracilis_l', 'f_gracilis_r'],
  },
  pectineus: {
    group: 'adductors',
    latin: 'Pectineus',
    common: 'Pectineus',
    view: 'front',
    deep: true,
    mapRegions: [],
  },

  // ── calves (5) ─────────────────────────────────────────────────────────────
  gastrocnemius_medial: {
    group: 'calves',
    latin: 'Gastrocnemius (caput mediale)',
    common: 'Inner calf',
    view: 'back',
    deep: false,
    mapRegions: ['b_calf_inner_l', 'b_calf_inner_r'],
  },
  gastrocnemius_lateral: {
    group: 'calves',
    latin: 'Gastrocnemius (caput laterale)',
    common: 'Outer calf',
    view: 'back',
    deep: false,
    mapRegions: ['b_calf_outer_l', 'b_calf_outer_r'],
  },
  soleus: {
    group: 'calves',
    latin: 'Soleus',
    common: 'Soleus',
    view: 'back',
    deep: false,
    mapRegions: ['b_soleus_l', 'b_soleus_r'],
  },
  tibialis_anterior: {
    group: 'calves',
    latin: 'Tibialis anterior',
    common: 'Shin / tib',
    view: 'front',
    deep: false,
    mapRegions: ['f_shin_l', 'f_shin_r'],
  },
  fibularis_longus: {
    group: 'calves',
    latin: 'Fibularis (peroneus) longus',
    common: 'Peroneals',
    view: 'front',
    deep: false,
    mapRegions: ['f_shin_outer_l', 'f_shin_outer_r'],
  },

  // ── hip_flexors (2) ────────────────────────────────────────────────────────
  psoas_major: {
    group: 'hip_flexors',
    latin: 'Psoas major',
    common: 'Psoas',
    view: 'front',
    deep: true,
    mapRegions: [],
  },
  iliacus: {
    group: 'hip_flexors',
    latin: 'Iliacus',
    common: 'Iliacus',
    view: 'front',
    deep: true,
    mapRegions: ['f_hipflexor_l', 'f_hipflexor_r'],
  },

  // ── neck (4) ───────────────────────────────────────────────────────────────
  sternocleidomastoid: {
    group: 'neck',
    latin: 'Sternocleidomastoideus',
    common: 'SCM',
    view: 'front',
    deep: false,
    mapRegions: ['f_neck_front_l', 'f_neck_front_r'],
  },
  scalenes: {
    group: 'neck',
    latin: 'Scalenus anterior / medius / posterior',
    common: 'Scalenes',
    view: 'front',
    deep: true,
    mapRegions: [],
  },
  splenius_capitis: {
    group: 'neck',
    latin: 'Splenius capitis',
    common: 'Neck extensors',
    view: 'back',
    deep: false,
    mapRegions: ['b_neck_back'],
  },
  splenius_cervicis: {
    group: 'neck',
    latin: 'Splenius cervicis',
    common: 'Neck extensors',
    view: 'back',
    deep: true,
    mapRegions: ['b_neck_back'],
  },
} as const satisfies Record<string, MuscleDef>;

/** Stable identifier for one of the 74 anatomical muscles. */
export type MuscleId = keyof typeof MUSCLES;

/** All 74 muscle ids. */
export const MUSCLE_IDS = Object.keys(MUSCLES) as MuscleId[];

// ─────────────────────────────────────────────────────────────────────────────
// Group definitions
// ─────────────────────────────────────────────────────────────────────────────

/** One of the 21 canonical muscle groups. Source: research PART A, A2. */
export interface MuscleGroupDef {
  readonly id: MuscleGroupId;
  readonly region: Region;
  /** Full display name, e.g. "Lower Back". */
  readonly label: string;
  /** Abbreviated label for the readiness chip row, e.g. "Low. Back". */
  readonly short: string;
  /** 1..21 ordering for the expanded readiness chip row. */
  readonly chipOrder: number;
  /**
   * Hours to ~95% readiness after a hard (MEV-to-MAV) session.
   * Derived from muscle size / eccentric damage literature: small distal
   * muscles 24-48h, large hip/thigh musculature 48-72h, hamstrings and lower
   * back slowest because of high eccentric strain. Source: research PART A, A2.
   */
  readonly recoveryHours: number;
  /** Typical share of weekly working sets in a balanced split, in percent. */
  readonly volumeSharePct: number;
  /** Which chip this group folds into on the 12-chip compact row. */
  readonly compact: CompactGroupId;
  /** Which body-map face(s) this group shades. */
  readonly view: BodyMapView;
  /**
   * The representative shadeable muscle for this group. Used when a record only
   * carries group weights and the UI needs a concrete muscle to name.
   */
  readonly primeMover: MuscleId;
  /** Member muscles, in the order the research lists them. */
  readonly muscles: readonly MuscleId[];
}

/**
 * The 21 canonical muscle groups, transcribed from research PART A, A2.
 *
 * `compact` folds 21 groups into the 12-chip display row. The research fixes
 * two of those folds explicitly (upper_back + lats + lower_back -> Back;
 * front/side/rear delts -> Shoulders) and leaves the remaining five groups
 * (obliques, hip_flexors, adductors, abductors, neck) to us; those are marked
 * inline. `compact` is a DISPLAY rollup only: readiness is always stored at the
 * 21-group level and aggregated with `rollupToCompact`, never averaged flat.
 */
export const MUSCLE_GROUPS: Record<MuscleGroupId, MuscleGroupDef> = {
  chest: {
    id: 'chest',
    region: 'chest',
    label: 'Chest',
    short: 'Chest',
    chipOrder: 1,
    recoveryHours: 48,
    volumeSharePct: 11,
    compact: 'chest',
    view: 'front',
    primeMover: 'pec_major_sternal',
    muscles: [
      'pec_major_clavicular',
      'pec_major_sternal',
      'pec_major_costal',
      'pec_minor',
      'serratus_anterior',
    ],
  },
  upper_back: {
    id: 'upper_back',
    region: 'back',
    label: 'Upper Back',
    short: 'Up. Back',
    chipOrder: 2,
    recoveryHours: 48,
    volumeSharePct: 9,
    compact: 'back',
    view: 'back',
    primeMover: 'trapezius_middle',
    muscles: [
      'rhomboid_major',
      'rhomboid_minor',
      'trapezius_middle',
      'trapezius_lower',
      'teres_major',
      'teres_minor',
      'infraspinatus',
      'supraspinatus',
      'subscapularis',
      'levator_scapulae',
    ],
  },
  lats: {
    id: 'lats',
    region: 'back',
    label: 'Lats',
    short: 'Lats',
    chipOrder: 3,
    recoveryHours: 48,
    volumeSharePct: 9,
    compact: 'back',
    view: 'back',
    primeMover: 'latissimus_dorsi_upper',
    muscles: ['latissimus_dorsi_upper', 'latissimus_dorsi_lower'],
  },
  traps: {
    id: 'traps',
    region: 'back',
    label: 'Traps',
    short: 'Traps',
    chipOrder: 4,
    recoveryHours: 36,
    volumeSharePct: 3,
    compact: 'traps',
    view: 'both',
    primeMover: 'trapezius_upper',
    muscles: ['trapezius_upper'],
  },
  lower_back: {
    id: 'lower_back',
    region: 'back',
    label: 'Lower Back',
    short: 'Low. Back',
    chipOrder: 5,
    recoveryHours: 72,
    volumeSharePct: 4,
    compact: 'back',
    view: 'back',
    primeMover: 'erector_spinae_longissimus',
    muscles: [
      'erector_spinae_iliocostalis',
      'erector_spinae_longissimus',
      'erector_spinae_spinalis',
      'quadratus_lumborum',
      'multifidus',
    ],
  },
  front_delts: {
    id: 'front_delts',
    region: 'shoulders',
    label: 'Front Delts',
    short: 'F. Delts',
    chipOrder: 6,
    recoveryHours: 48,
    volumeSharePct: 5,
    compact: 'shoulders',
    view: 'front',
    primeMover: 'deltoid_anterior',
    muscles: ['deltoid_anterior'],
  },
  side_delts: {
    id: 'side_delts',
    region: 'shoulders',
    label: 'Side Delts',
    short: 'S. Delts',
    chipOrder: 7,
    recoveryHours: 36,
    volumeSharePct: 6,
    compact: 'shoulders',
    view: 'both',
    primeMover: 'deltoid_lateral',
    muscles: ['deltoid_lateral'],
  },
  rear_delts: {
    id: 'rear_delts',
    region: 'shoulders',
    label: 'Rear Delts',
    short: 'R. Delts',
    chipOrder: 8,
    recoveryHours: 36,
    volumeSharePct: 4,
    compact: 'shoulders',
    view: 'back',
    primeMover: 'deltoid_posterior',
    muscles: ['deltoid_posterior'],
  },
  biceps: {
    id: 'biceps',
    region: 'arms',
    label: 'Biceps',
    short: 'Biceps',
    chipOrder: 9,
    recoveryHours: 48,
    volumeSharePct: 6,
    compact: 'biceps',
    view: 'front',
    primeMover: 'biceps_long_head',
    muscles: ['biceps_long_head', 'biceps_short_head', 'brachialis', 'coracobrachialis'],
  },
  triceps: {
    id: 'triceps',
    region: 'arms',
    label: 'Triceps',
    short: 'Triceps',
    chipOrder: 10,
    recoveryHours: 48,
    volumeSharePct: 7,
    compact: 'triceps',
    view: 'back',
    primeMover: 'triceps_long_head',
    muscles: ['triceps_long_head', 'triceps_lateral_head', 'triceps_medial_head', 'anconeus'],
  },
  forearms: {
    id: 'forearms',
    region: 'arms',
    label: 'Forearms',
    short: 'Forearms',
    chipOrder: 11,
    recoveryHours: 24,
    volumeSharePct: 3,
    compact: 'forearms',
    view: 'both',
    primeMover: 'brachioradialis',
    muscles: ['brachioradialis', 'wrist_flexors', 'wrist_extensors', 'pronator_teres', 'supinator'],
  },
  abs: {
    id: 'abs',
    region: 'core',
    label: 'Abs',
    short: 'Abs',
    chipOrder: 12,
    recoveryHours: 36,
    volumeSharePct: 5,
    compact: 'abs',
    view: 'front',
    primeMover: 'rectus_abdominis_upper',
    muscles: ['rectus_abdominis_upper', 'rectus_abdominis_lower', 'transversus_abdominis'],
  },
  obliques: {
    id: 'obliques',
    region: 'core',
    label: 'Obliques',
    short: 'Obliques',
    chipOrder: 13,
    recoveryHours: 36,
    volumeSharePct: 3,
    // Not fixed by the research: obliques share the Abs chip on the compact row.
    compact: 'abs',
    view: 'front',
    primeMover: 'external_oblique',
    muscles: ['external_oblique', 'internal_oblique'],
  },
  quads: {
    id: 'quads',
    region: 'legs',
    label: 'Quads',
    short: 'Quads',
    chipOrder: 14,
    recoveryHours: 72,
    volumeSharePct: 9,
    compact: 'quads',
    view: 'front',
    primeMover: 'vastus_lateralis',
    muscles: [
      'rectus_femoris',
      'vastus_lateralis',
      'vastus_medialis',
      'vastus_intermedius',
      'sartorius',
    ],
  },
  hamstrings: {
    id: 'hamstrings',
    region: 'legs',
    label: 'Hamstrings',
    short: 'Hams',
    chipOrder: 15,
    recoveryHours: 72,
    volumeSharePct: 7,
    compact: 'hamstrings',
    view: 'back',
    primeMover: 'biceps_femoris_long',
    muscles: [
      'biceps_femoris_long',
      'biceps_femoris_short',
      'semitendinosus',
      'semimembranosus',
    ],
  },
  glutes: {
    id: 'glutes',
    region: 'legs',
    label: 'Glutes',
    short: 'Glutes',
    chipOrder: 16,
    recoveryHours: 48,
    volumeSharePct: 6,
    compact: 'glutes',
    view: 'back',
    primeMover: 'gluteus_maximus',
    muscles: ['gluteus_maximus'],
  },
  hip_flexors: {
    id: 'hip_flexors',
    region: 'legs',
    label: 'Hip Flexors',
    short: 'Hip Flex',
    chipOrder: 17,
    recoveryHours: 36,
    volumeSharePct: 1,
    // Not fixed by the research: hip flexors share the Quads chip (same region,
    // and every hip-flexion exercise already loads rectus femoris).
    compact: 'quads',
    view: 'front',
    primeMover: 'iliacus',
    muscles: ['psoas_major', 'iliacus'],
  },
  adductors: {
    id: 'adductors',
    region: 'legs',
    label: 'Adductors',
    short: 'Adductors',
    chipOrder: 18,
    recoveryHours: 48,
    volumeSharePct: 2,
    // Not fixed by the research: adductors share the Quads chip.
    compact: 'quads',
    view: 'both',
    primeMover: 'adductor_magnus',
    muscles: ['adductor_magnus', 'adductor_longus', 'adductor_brevis', 'gracilis', 'pectineus'],
  },
  abductors: {
    id: 'abductors',
    region: 'legs',
    label: 'Abductors',
    short: 'Abductors',
    chipOrder: 19,
    recoveryHours: 36,
    volumeSharePct: 2,
    // Not fixed by the research: abductors share the Glutes chip.
    compact: 'glutes',
    view: 'both',
    primeMover: 'gluteus_medius',
    muscles: ['gluteus_medius', 'gluteus_minimus', 'tensor_fasciae_latae', 'piriformis'],
  },
  calves: {
    id: 'calves',
    region: 'legs',
    label: 'Calves',
    short: 'Calves',
    chipOrder: 20,
    recoveryHours: 36,
    volumeSharePct: 3,
    compact: 'calves',
    view: 'both',
    primeMover: 'gastrocnemius_medial',
    muscles: [
      'gastrocnemius_medial',
      'gastrocnemius_lateral',
      'soleus',
      'tibialis_anterior',
      'fibularis_longus',
    ],
  },
  neck: {
    id: 'neck',
    region: 'neck',
    label: 'Neck',
    short: 'Neck',
    chipOrder: 21,
    recoveryHours: 36,
    volumeSharePct: 1,
    // Not fixed by the research: neck shares the Traps chip (adjacent, and the
    // trapezius is itself a cervical extensor).
    compact: 'traps',
    view: 'both',
    primeMover: 'sternocleidomastoid',
    muscles: ['sternocleidomastoid', 'scalenes', 'splenius_capitis', 'splenius_cervicis'],
  },
};

/** All 21 group ids in `chipOrder`. */
export const MUSCLE_GROUP_IDS: readonly MuscleGroupId[] = (
  Object.keys(MUSCLE_GROUPS) as MuscleGroupId[]
).sort((a, b) => MUSCLE_GROUPS[a].chipOrder - MUSCLE_GROUPS[b].chipOrder);

/**
 * A contribution vector: how one exercise's stimulus splits across muscle
 * groups. Sums to 1.0. Volume attribution and readiness fatigue are both a dot
 * product against this vector. Source: research PART A, A4.
 */
export type GroupWeights = Partial<Record<MuscleGroupId, number>>;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the definition of one of the 74 muscles. */
export function getMuscle(id: MuscleId): MuscleDef {
  return MUSCLES[id];
}

/** Returns the definition of one of the 21 muscle groups. */
export function getMuscleGroup(id: MuscleGroupId): MuscleGroupDef {
  return MUSCLE_GROUPS[id];
}

/** Returns the group a muscle belongs to. */
export function groupOfMuscle(id: MuscleId): MuscleGroupId {
  return MUSCLES[id].group;
}

/**
 * The distinct SVG path ids a body map must shade for a group, derived from its
 * member muscles. Deep muscles contribute nothing because they are never shaded.
 *
 * @param view - restrict to one face; omit for every path on both faces.
 */
export function mapRegionsForGroup(id: MuscleGroupId, view?: 'front' | 'back'): string[] {
  const prefix = view === 'front' ? 'f_' : view === 'back' ? 'b_' : null;
  const out = new Set<string>();
  for (const muscleId of MUSCLE_GROUPS[id].muscles) {
    const muscle = MUSCLES[muscleId];
    if (muscle.deep) continue;
    for (const region of muscle.mapRegions) {
      if (prefix === null || region.startsWith(prefix)) out.add(region);
    }
  }
  return [...out].sort();
}

/**
 * Every distinct shadeable path id front.svg must expose, across all 21 groups.
 * Derived from the A3 table, not from prose.
 */
export function frontMapRegions(): string[] {
  return allShadeableRegions('f_');
}

/** Every distinct shadeable path id back.svg must expose, across all 21 groups. */
export function backMapRegions(): string[] {
  return allShadeableRegions('b_');
}

function allShadeableRegions(prefix: string): string[] {
  const out = new Set<string>();
  for (const id of MUSCLE_IDS) {
    const muscle = MUSCLES[id];
    if (muscle.deep) continue;
    for (const region of muscle.mapRegions) {
      if (region.startsWith(prefix)) out.add(region);
    }
  }
  return [...out].sort();
}

/**
 * Derives which body-map face(s) a group renders on from its member muscles.
 * A group is `both` when it owns at least one front path and one back path.
 * `MUSCLE_GROUPS[id].view` is the stored value and must equal this; the test
 * suite asserts that so the table cannot drift from the muscle data.
 */
export function deriveGroupView(id: MuscleGroupId): BodyMapView {
  let front = false;
  let back = false;
  for (const muscleId of MUSCLE_GROUPS[id].muscles) {
    const muscle = MUSCLES[muscleId];
    if (muscle.view === 'front' || muscle.view === 'both') front = true;
    if (muscle.view === 'back' || muscle.view === 'both') back = true;
  }
  if (front && back) return 'both';
  return front ? 'front' : 'back';
}

/**
 * Folds a per-group signal (readiness 0..1, fatigue, weekly sets) onto the
 * 12-chip compact row using a VOLUME-WEIGHTED mean, never a flat average, as
 * the research requires: a flat average would let hip flexors (1% of weekly
 * volume) drag the Quads chip as hard as the quads themselves.
 *
 * Groups absent from `byGroup` are skipped, so a partially populated map is
 * safe. Compact chips with no contributing group are omitted from the result.
 *
 * Source: research PART A, A2 UI RULE.
 */
export function rollupToCompact(
  byGroup: Partial<Record<MuscleGroupId, number>>,
): Partial<Record<CompactGroupId, number>> {
  const weighted: Partial<Record<CompactGroupId, number>> = {};
  const weights: Partial<Record<CompactGroupId, number>> = {};

  for (const groupId of MUSCLE_GROUP_IDS) {
    const value = byGroup[groupId];
    if (value === undefined) continue;
    const group = MUSCLE_GROUPS[groupId];
    const w = group.volumeSharePct;
    weighted[group.compact] = (weighted[group.compact] ?? 0) + value * w;
    weights[group.compact] = (weights[group.compact] ?? 0) + w;
  }

  const out: Partial<Record<CompactGroupId, number>> = {};
  for (const chip of COMPACT_GROUPS) {
    const total = weights[chip];
    const sum = weighted[chip];
    if (total === undefined || sum === undefined || total === 0) continue;
    out[chip] = sum / total;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Upstream vocabulary mapping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result of mapping a foreign dataset's muscle name into our 21-group enum.
 *
 * `ambiguous` means the upstream slug is coarser than our enum and the mapping
 * had to pick a representative group. The research is explicit that these must
 * be flagged (`muscle_unmapped` qaFlag) rather than silently defaulted, or the
 * readiness and training-split features report confidently wrong numbers.
 * Source: exercise-data-and-demonstration-media-sources research, Risks.
 */
export interface MuscleMapping {
  readonly group: MuscleGroupId;
  readonly ambiguous: boolean;
}

const exact = (group: MuscleGroupId): MuscleMapping => ({ group, ambiguous: false });
const coarse = (group: MuscleGroupId): MuscleMapping => ({ group, ambiguous: true });

/**
 * RepDB schema v3's 30 muscle slugs mapped into our 21 groups.
 * Source: exercise-data-and-demonstration-media-sources research, PART 1.
 */
export const REPDB_MUSCLE_MAP = {
  abductors: exact('abductors'),
  adductors: exact('adductors'),
  anterior_deltoid: exact('front_delts'),
  biceps_brachii: exact('biceps'),
  brachialis: exact('biceps'),
  brachioradialis: exact('forearms'),
  erector_spinae: exact('lower_back'),
  forearms: exact('forearms'),
  forearm_extensors: exact('forearms'),
  forearm_flexors: exact('forearms'),
  gastrocnemius: exact('calves'),
  gluteus_maximus: exact('glutes'),
  gluteus_medius: exact('abductors'),
  hamstrings: exact('hamstrings'),
  hip_flexors: exact('hip_flexors'),
  lateral_deltoid: exact('side_delts'),
  latissimus_dorsi: exact('lats'),
  quadratus_lumborum: exact('lower_back'),
  obliques: exact('obliques'),
  pectoralis_major: exact('chest'),
  posterior_deltoid: exact('rear_delts'),
  quadriceps: exact('quads'),
  rectus_abdominis: exact('abs'),
  rhomboids: exact('upper_back'),
  serratus_anterior: exact('chest'),
  supraspinatus: exact('upper_back'),
  soleus: exact('calves'),
  transverse_abdominis: exact('abs'),
  // RepDB has ONE trapezius slug covering upper, middle and lower fibres; we
  // split those across `traps` and `upper_back`, so this can only be a guess.
  trapezius: coarse('traps'),
  triceps_brachii: exact('triceps'),
} as const satisfies Record<string, MuscleMapping>;

/** RepDB's 30 muscle slugs. */
export type RepDbMuscleSlug = keyof typeof REPDB_MUSCLE_MAP;

/**
 * wger's 15 muscles mapped into our 21 groups.
 * Source: https://wger.de/api/v2/muscle/ as reported in both research briefs.
 */
export const WGER_MUSCLE_MAP = {
  biceps_brachii: exact('biceps'),
  anterior_deltoid: exact('front_delts'),
  serratus_anterior: exact('chest'),
  pectoralis_major: exact('chest'),
  triceps_brachii: exact('triceps'),
  rectus_abdominis: exact('abs'),
  gastrocnemius: exact('calves'),
  gluteus_maximus: exact('glutes'),
  // wger has no upper/mid/lower trapezius split.
  trapezius: coarse('traps'),
  quadriceps_femoris: exact('quads'),
  biceps_femoris: exact('hamstrings'),
  latissimus_dorsi: exact('lats'),
  brachialis: exact('biceps'),
  obliquus_externus_abdominis: exact('obliques'),
  soleus: exact('calves'),
} as const satisfies Record<string, MuscleMapping>;

/** wger's 15 muscle slugs. */
export type WgerMuscleSlug = keyof typeof WGER_MUSCLE_MAP;

/**
 * free-exercise-db's 17 `primaryMuscles` values mapped into our 21 groups.
 * Text fields only: the research is explicit that its 1,746 JPGs are
 * Bodybuilding.com studio photographs and must never be fetched.
 * Source: research PART E, E3 and the media-sources brief.
 */
export const FREE_EXERCISE_DB_MUSCLE_MAP = {
  // Undifferentiated "shoulders" — cannot tell front from side from rear.
  shoulders: coarse('front_delts'),
  quadriceps: exact('quads'),
  abdominals: exact('abs'),
  chest: exact('chest'),
  triceps: exact('triceps'),
  biceps: exact('biceps'),
  hamstrings: exact('hamstrings'),
  'middle back': exact('upper_back'),
  lats: exact('lats'),
  forearms: exact('forearms'),
  'lower back': exact('lower_back'),
  glutes: exact('glutes'),
  calves: exact('calves'),
  traps: exact('traps'),
  neck: exact('neck'),
  adductors: exact('adductors'),
  abductors: exact('abductors'),
} as const satisfies Record<string, MuscleMapping>;

/** free-exercise-db's 17 primary-muscle values. */
export type FreeExerciseDbMuscleSlug = keyof typeof FREE_EXERCISE_DB_MUSCLE_MAP;

/** Maps a RepDB muscle slug into our enum. Returns `null` for unknown slugs. */
export function mapRepDbMuscle(slug: string): MuscleMapping | null {
  return Object.prototype.hasOwnProperty.call(REPDB_MUSCLE_MAP, slug)
    ? REPDB_MUSCLE_MAP[slug as RepDbMuscleSlug]
    : null;
}

/** Maps a wger muscle slug into our enum. Returns `null` for unknown slugs. */
export function mapWgerMuscle(slug: string): MuscleMapping | null {
  return Object.prototype.hasOwnProperty.call(WGER_MUSCLE_MAP, slug)
    ? WGER_MUSCLE_MAP[slug as WgerMuscleSlug]
    : null;
}

/**
 * Maps a free-exercise-db `primaryMuscles` value into our enum.
 * Returns `null` for unknown values.
 */
export function mapFreeExerciseDbMuscle(slug: string): MuscleMapping | null {
  return Object.prototype.hasOwnProperty.call(FREE_EXERCISE_DB_MUSCLE_MAP, slug)
    ? FREE_EXERCISE_DB_MUSCLE_MAP[slug as FreeExerciseDbMuscleSlug]
    : null;
}
