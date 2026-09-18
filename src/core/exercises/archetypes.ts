/**
 * Movement archetypes: the fatigue-parameter defaults every exercise inherits.
 *
 * The readiness engine needs four numbers per exercise — axial load, loaded-
 * stretch index, stimulus-to-fatigue ratio and default eccentric duration. Hand
 * authoring four fields across ~1,200 catalog rows is not maintainable and not
 * auditable. Instead every exercise names an ARCHETYPE and inherits its
 * defaults; a row may override an individual field where it genuinely differs.
 * A wrong number is then one edit in one place, not a grep across 1,200 rows.
 *
 * Sources:
 *  - Field semantics and the 26 anchor profiles: docs/research/
 *    muscle-readiness-recovery-model-for-stronger-2-0-p.md, section 2
 *    "EXERCISE FATIGUE PROFILES", plus the SFR finding citing Israetel / RP.
 *  - The archetype concept and the ~40-row target: docs/research/
 *    exercise-data-and-demonstration-media-sources-for-.md, PART 3 STEP 9,
 *    where the same table also drives the programmatic SVG demo renderer.
 *
 * PROVENANCE IS EXPLICIT. 26 archetypes carry numbers transcribed verbatim from
 * a research profile (`source: 'research_profile'`). The remaining 22 are
 * interpolated between the two nearest research rows and say which
 * (`source: 'interpolated'`, with `anchor` and `rationale`). Nothing here is a
 * placeholder, and nothing claims research backing it does not have.
 *
 * Pure TypeScript. No platform imports.
 */

import type { MovementPattern } from './patterns';

/** Plane the load principally travels in. Feeds the demo-SVG rig. */
export type MovementPlane = 'sagittal' | 'frontal' | 'transverse' | 'mixed';

/** Where the numbers in an archetype row came from. */
export interface ArchetypeProvenance {
  /**
   * `research_profile` — the four numbers are transcribed verbatim from a named
   * profile in the readiness research.
   * `interpolated` — the numbers sit between two named research profiles; the
   * rationale states which and why.
   */
  readonly source: 'research_profile' | 'interpolated';
  /** The research profile id(s) this row is anchored to. */
  readonly anchor: string;
  /** Why the interpolated values differ from the anchor. */
  readonly rationale?: string;
}

export interface MovementArchetypeDef {
  readonly id: ArchetypeId;
  readonly label: string;
  readonly pattern: MovementPattern;
  readonly plane: MovementPlane;
  /**
   * Spinal / whole-body axial load, 0..1. Deadlift 1.00, machine curl 0.02.
   * Multiplies the SYSTEMIC fatigue deposit only — it is what makes "a deadlift
   * day costs you Wednesday" fall out of the model instead of being hard-coded.
   * Unitless. Source: readiness research, ExerciseProfile.axialLoad.
   */
  readonly axialLoad: number;
  /**
   * Loaded-stretch index: tension at long muscle length, the biggest single
   * driver of exercise-induced muscle damage. 1.00 is a typical barbell
   * compound; 1.45 is a deep-stretch movement (RDL, incline curl).
   * Unitless. Source: readiness research, ExerciseProfile.loadedStretchIndex.
   */
  readonly loadedStretchIndex: number;
  /**
   * Stimulus-to-fatigue ratio (Israetel). >1 efficient, <1 costly. Scales the
   * systemic cost inversely. Deadlift 0.65, face pull 1.40.
   * Unitless. Source: readiness research, ExerciseProfile.sfr.
   */
  readonly sfr: number;
  /**
   * Default eccentric duration per rep, in SECONDS, when the user logs no
   * tempo. 0 for movements with no meaningful eccentric (carries, isometric
   * holds, cyclic conditioning, olympic drops).
   * Source: readiness research, ExerciseProfile.defaultEccentricSec.
   */
  readonly defaultEccentricSec: number;
  /** `true` when the archetype is trained one limb at a time by default. */
  readonly unilateralByDefault: boolean;
  readonly provenance: ArchetypeProvenance;
}

const RESEARCH = (anchor: string): ArchetypeProvenance => ({
  source: 'research_profile',
  anchor,
});

const DERIVED = (anchor: string, rationale: string): ArchetypeProvenance => ({
  source: 'interpolated',
  anchor,
  rationale,
});

/**
 * The 48 movement archetypes. Every catalog exercise names exactly one.
 *
 * The research brief asks for "roughly 40"; 48 is what it takes to cover the
 * Tier-2 catalog without an archetype that lies about a whole family (a seated
 * overhead press really does carry half the axial load of a standing one, and
 * folding them together would mis-price every push day).
 */
export const ARCHETYPES = {
  // ── horizontal push ────────────────────────────────────────────────────────
  horizontal_press: {
    id: 'horizontal_press',
    label: 'Horizontal Press',
    pattern: 'horizontal_push',
    plane: 'sagittal',
    axialLoad: 0.25,
    loadedStretchIndex: 1.2,
    sfr: 1.05,
    defaultEccentricSec: 2,
    unilateralByDefault: false,
    provenance: RESEARCH('barbell_bench_press'),
  },
  incline_press: {
    id: 'incline_press',
    label: 'Incline Press',
    pattern: 'horizontal_push',
    plane: 'sagittal',
    axialLoad: 0.2,
    loadedStretchIndex: 1.3,
    sfr: 1.15,
    defaultEccentricSec: 2.5,
    unilateralByDefault: false,
    provenance: RESEARCH('incline_db_press'),
  },
  machine_chest_press: {
    id: 'machine_chest_press',
    label: 'Machine Chest Press',
    pattern: 'horizontal_push',
    plane: 'sagittal',
    axialLoad: 0.08,
    loadedStretchIndex: 1.2,
    sfr: 1.25,
    defaultEccentricSec: 2,
    unilateralByDefault: false,
    provenance: DERIVED(
      'barbell_bench_press + leg_press',
      'Same stretch as a flat press but the seat carries the trunk, so axial load drops to the supported-machine level (lat_pulldown 0.08) and SFR rises to the machine level (leg_press 1.25).',
    ),
  },
  push_up: {
    id: 'push_up',
    label: 'Push Up',
    pattern: 'horizontal_push',
    plane: 'sagittal',
    axialLoad: 0.1,
    loadedStretchIndex: 1.2,
    sfr: 1.15,
    defaultEccentricSec: 2,
    unilateralByDefault: false,
    provenance: DERIVED(
      'barbell_bench_press + dips',
      'Closed-chain, so axial load sits between the bench (0.25) and the dip (0.15); stretch matches the flat press, SFR is better than the bench because the load is capped by bodyweight.',
    ),
  },
  dip: {
    id: 'dip',
    label: 'Dip',
    pattern: 'horizontal_push',
    plane: 'sagittal',
    axialLoad: 0.15,
    loadedStretchIndex: 1.35,
    sfr: 1.0,
    defaultEccentricSec: 2,
    unilateralByDefault: false,
    provenance: RESEARCH('dips'),
  },
  chest_fly: {
    id: 'chest_fly',
    label: 'Chest Fly',
    pattern: 'isolation_adduction',
    plane: 'transverse',
    axialLoad: 0.05,
    loadedStretchIndex: 1.4,
    sfr: 1.2,
    defaultEccentricSec: 2.5,
    unilateralByDefault: false,
    provenance: RESEARCH('cable_fly'),
  },

  // ── vertical push ──────────────────────────────────────────────────────────
  vertical_press: {
    id: 'vertical_press',
    label: 'Standing Overhead Press',
    pattern: 'vertical_push',
    plane: 'sagittal',
    axialLoad: 0.55,
    loadedStretchIndex: 1.05,
    sfr: 0.95,
    defaultEccentricSec: 2,
    unilateralByDefault: false,
    provenance: RESEARCH('overhead_press'),
  },
  seated_vertical_press: {
    id: 'seated_vertical_press',
    label: 'Seated Overhead Press',
    pattern: 'vertical_push',
    plane: 'sagittal',
    axialLoad: 0.35,
    loadedStretchIndex: 1.05,
    sfr: 1.05,
    defaultEccentricSec: 2,
    unilateralByDefault: false,
    provenance: DERIVED(
      'overhead_press',
      'A back rest removes the standing trunk-bracing demand: axial load drops from 0.55 toward the supported end, SFR improves by the same margin the machine rows gain over the barbell row.',
    ),
  },
  handstand_press: {
    id: 'handstand_press',
    label: 'Handstand Push Up',
    pattern: 'vertical_push',
    plane: 'sagittal',
    axialLoad: 0.45,
    loadedStretchIndex: 1.25,
    sfr: 0.9,
    defaultEccentricSec: 2,
    unilateralByDefault: false,
    provenance: DERIVED(
      'overhead_press + dips',
      'Inverted closed-chain press: deeper stretch than a barbell press (toward the dip at 1.35), still a heavy bracing demand, and a poor SFR because the load cannot be dialled below bodyweight.',
    ),
  },

  // ── shoulder isolation ─────────────────────────────────────────────────────
  lateral_raise: {
    id: 'lateral_raise',
    label: 'Lateral Raise',
    pattern: 'isolation_abduction',
    plane: 'frontal',
    axialLoad: 0.05,
    loadedStretchIndex: 0.9,
    sfr: 1.35,
    defaultEccentricSec: 2,
    unilateralByDefault: false,
    provenance: RESEARCH('lateral_raise'),
  },
  front_raise: {
    id: 'front_raise',
    label: 'Front Raise',
    pattern: 'isolation_flexion',
    plane: 'sagittal',
    axialLoad: 0.05,
    loadedStretchIndex: 0.9,
    sfr: 1.3,
    defaultEccentricSec: 2,
    unilateralByDefault: false,
    provenance: DERIVED(
      'lateral_raise',
      'Same single-joint shoulder raise in the sagittal plane; SFR is marginally worse because the front delt already absorbs every pressing set.',
    ),
  },
  rear_delt_fly: {
    id: 'rear_delt_fly',
    label: 'Rear Delt Fly / Face Pull',
    pattern: 'isolation_abduction',
    plane: 'transverse',
    axialLoad: 0.04,
    loadedStretchIndex: 0.95,
    sfr: 1.4,
    defaultEccentricSec: 2,
    unilateralByDefault: false,
    provenance: RESEARCH('face_pull'),
  },
  upright_row: {
    id: 'upright_row',
    label: 'Upright Row',
    pattern: 'vertical_pull',
    plane: 'frontal',
    axialLoad: 0.2,
    loadedStretchIndex: 0.9,
    sfr: 1.15,
    defaultEccentricSec: 2,
    unilateralByDefault: false,
    provenance: DERIVED(
      'lateral_raise + ez_bar_curl',
      'A standing loaded abduction: stretch matches the lateral raise, axial load matches a standing barbell curl scaled up for the heavier load.',
    ),
  },
  shrug: {
    id: 'shrug',
    label: 'Shrug',
    pattern: 'isolation_abduction',
    plane: 'frontal',
    axialLoad: 0.45,
    loadedStretchIndex: 0.95,
    sfr: 1.2,
    defaultEccentricSec: 2,
    unilateralByDefault: false,
    provenance: DERIVED(
      'conventional_deadlift + lateral_raise',
      'The trap loading is a single-joint action but the spine holds a deadlift-sized load statically, so axial load stays high while the stretch index stays short-range.',
    ),
  },

  // ── vertical pull ──────────────────────────────────────────────────────────
  vertical_pull: {
    id: 'vertical_pull',
    label: 'Pull Up',
    pattern: 'vertical_pull',
    plane: 'frontal',
    axialLoad: 0.15,
    loadedStretchIndex: 1.35,
    sfr: 1.1,
    defaultEccentricSec: 2.5,
    unilateralByDefault: false,
    provenance: RESEARCH('pull_up'),
  },
  lat_pulldown: {
    id: 'lat_pulldown',
    label: 'Lat Pulldown',
    pattern: 'vertical_pull',
    plane: 'frontal',
    axialLoad: 0.08,
    loadedStretchIndex: 1.25,
    sfr: 1.25,
    defaultEccentricSec: 2.5,
    unilateralByDefault: false,
    provenance: RESEARCH('lat_pulldown'),
  },
  straight_arm_pulldown: {
    id: 'straight_arm_pulldown',
    label: 'Straight Arm Pulldown',
    pattern: 'isolation_extension',
    plane: 'sagittal',
    axialLoad: 0.05,
    loadedStretchIndex: 1.3,
    sfr: 1.3,
    defaultEccentricSec: 2.5,
    unilateralByDefault: false,
    provenance: DERIVED(
      'cable_fly + lat_pulldown',
      'Single-joint lat movement on a cable: axial and SFR match the cable fly, the overhead start gives it a pulldown-grade stretch.',
    ),
  },

  // ── horizontal pull ────────────────────────────────────────────────────────
  bent_over_row: {
    id: 'bent_over_row',
    label: 'Bent Over Row',
    pattern: 'horizontal_pull',
    plane: 'sagittal',
    axialLoad: 0.7,
    loadedStretchIndex: 1.15,
    sfr: 0.9,
    defaultEccentricSec: 2,
    unilateralByDefault: false,
    provenance: RESEARCH('barbell_row'),
  },
  chest_supported_row: {
    id: 'chest_supported_row',
    label: 'Chest Supported Row',
    pattern: 'horizontal_pull',
    plane: 'sagittal',
    axialLoad: 0.1,
    loadedStretchIndex: 1.2,
    sfr: 1.3,
    defaultEccentricSec: 2.5,
    unilateralByDefault: false,
    provenance: RESEARCH('chest_supported_row'),
  },
  seated_cable_row: {
    id: 'seated_cable_row',
    label: 'Seated Cable Row',
    pattern: 'horizontal_pull',
    plane: 'transverse',
    axialLoad: 0.2,
    loadedStretchIndex: 1.2,
    sfr: 1.25,
    defaultEccentricSec: 2.5,
    unilateralByDefault: false,
    provenance: DERIVED(
      'chest_supported_row + barbell_row',
      'The torso is unsupported but vertical, so axial load lands between the chest-supported row (0.10) and the bent-over row (0.70), much nearer the former.',
    ),
  },
  single_arm_row: {
    id: 'single_arm_row',
    label: 'Single Arm Row',
    pattern: 'horizontal_pull',
    plane: 'sagittal',
    axialLoad: 0.25,
    loadedStretchIndex: 1.25,
    sfr: 1.2,
    defaultEccentricSec: 2.5,
    unilateralByDefault: true,
    provenance: DERIVED(
      'chest_supported_row + barbell_row',
      'One hand braces on a bench, removing most of the bent-over row spinal demand; the free scapula reaches a longer stretch than either anchor.',
    ),
  },
  inverted_row: {
    id: 'inverted_row',
    label: 'Inverted Row',
    pattern: 'horizontal_pull',
    plane: 'sagittal',
    axialLoad: 0.1,
    loadedStretchIndex: 1.15,
    sfr: 1.3,
    defaultEccentricSec: 2.5,
    unilateralByDefault: false,
    provenance: DERIVED(
      'chest_supported_row',
      'Bodyweight horizontal pull with the body rigid on the floor or a strap; same low spinal demand and high SFR as a chest-supported row, slightly shorter stretch.',
    ),
  },

  // ── squat ──────────────────────────────────────────────────────────────────
  squat: {
    id: 'squat',
    label: 'Back Squat',
    pattern: 'squat',
    plane: 'sagittal',
    axialLoad: 0.95,
    loadedStretchIndex: 1.25,
    sfr: 0.9,
    defaultEccentricSec: 2,
    unilateralByDefault: false,
    provenance: RESEARCH('back_squat'),
  },
  front_loaded_squat: {
    id: 'front_loaded_squat',
    label: 'Front Loaded Squat',
    pattern: 'squat',
    plane: 'sagittal',
    axialLoad: 0.8,
    loadedStretchIndex: 1.25,
    sfr: 0.95,
    defaultEccentricSec: 2,
    unilateralByDefault: false,
    provenance: RESEARCH('front_squat'),
  },
  machine_squat: {
    id: 'machine_squat',
    label: 'Machine Squat',
    pattern: 'squat',
    plane: 'sagittal',
    axialLoad: 0.4,
    loadedStretchIndex: 1.3,
    sfr: 1.15,
    defaultEccentricSec: 2.5,
    unilateralByDefault: false,
    provenance: DERIVED(
      'front_squat + leg_press',
      'Hack squat, pendulum and belt squat: the rails carry the bar path, so axial load sits between the front squat (0.80) and the leg press (0.25), and the fixed path allows a deeper loaded stretch than either.',
    ),
  },
  leg_press: {
    id: 'leg_press',
    label: 'Leg Press',
    pattern: 'squat',
    plane: 'sagittal',
    axialLoad: 0.25,
    loadedStretchIndex: 1.15,
    sfr: 1.25,
    defaultEccentricSec: 2,
    unilateralByDefault: false,
    provenance: RESEARCH('leg_press'),
  },
  split_squat: {
    id: 'split_squat',
    label: 'Split Squat / Lunge',
    pattern: 'lunge',
    plane: 'sagittal',
    axialLoad: 0.35,
    loadedStretchIndex: 1.4,
    sfr: 1.1,
    defaultEccentricSec: 2.5,
    unilateralByDefault: true,
    provenance: RESEARCH('bulgarian_split_squat'),
  },
  step_up: {
    id: 'step_up',
    label: 'Step Up',
    pattern: 'lunge',
    plane: 'sagittal',
    axialLoad: 0.3,
    loadedStretchIndex: 1.2,
    sfr: 1.15,
    defaultEccentricSec: 2,
    unilateralByDefault: true,
    provenance: DERIVED(
      'bulgarian_split_squat',
      'Same unilateral knee-dominant pattern but concentric-biased with a shallower bottom position, so the stretch index drops well below the Bulgarian split squat and the SFR improves.',
    ),
  },
  leg_extension: {
    id: 'leg_extension',
    label: 'Leg Extension',
    pattern: 'isolation_extension',
    plane: 'sagittal',
    axialLoad: 0.02,
    loadedStretchIndex: 0.95,
    sfr: 1.3,
    defaultEccentricSec: 2,
    unilateralByDefault: false,
    provenance: RESEARCH('leg_extension'),
  },
  sissy_squat: {
    id: 'sissy_squat',
    label: 'Sissy Squat',
    pattern: 'isolation_extension',
    plane: 'sagittal',
    axialLoad: 0.1,
    loadedStretchIndex: 1.45,
    sfr: 1.0,
    defaultEccentricSec: 3,
    unilateralByDefault: false,
    provenance: DERIVED(
      'leg_extension + romanian_deadlift',
      'Knee extension taken to a fully lengthened rectus femoris; the joint action is the leg extension, the damage profile is the RDL, which is why it needs the RDL eccentric default.',
    ),
  },

  // ── hinge ──────────────────────────────────────────────────────────────────
  deadlift: {
    id: 'deadlift',
    label: 'Deadlift',
    pattern: 'hinge',
    plane: 'sagittal',
    axialLoad: 1.0,
    loadedStretchIndex: 1.1,
    sfr: 0.65,
    defaultEccentricSec: 1.5,
    unilateralByDefault: false,
    provenance: RESEARCH('conventional_deadlift'),
  },
  romanian_deadlift: {
    id: 'romanian_deadlift',
    label: 'Romanian Deadlift',
    pattern: 'hinge',
    plane: 'sagittal',
    axialLoad: 0.75,
    loadedStretchIndex: 1.45,
    sfr: 0.95,
    defaultEccentricSec: 3,
    unilateralByDefault: false,
    provenance: RESEARCH('romanian_deadlift'),
  },
  good_morning: {
    id: 'good_morning',
    label: 'Good Morning',
    pattern: 'hinge',
    plane: 'sagittal',
    axialLoad: 0.85,
    loadedStretchIndex: 1.4,
    sfr: 0.85,
    defaultEccentricSec: 3,
    unilateralByDefault: false,
    provenance: DERIVED(
      'romanian_deadlift + back_squat',
      'The bar sits on the back as in a squat while the hips hinge as in an RDL, so the spine sees more moment arm than either: axial load above the RDL, SFR below it.',
    ),
  },
  back_extension: {
    id: 'back_extension',
    label: 'Back Extension',
    pattern: 'isolation_extension',
    plane: 'sagittal',
    axialLoad: 0.3,
    loadedStretchIndex: 1.2,
    sfr: 1.2,
    defaultEccentricSec: 2.5,
    unilateralByDefault: false,
    provenance: DERIVED(
      'romanian_deadlift + hip_thrust',
      'The pad supports the hips so the spine is not compressed end to end; the hinge stretch survives but the axial load falls to hip-thrust territory and the SFR rises with it.',
    ),
  },
  hip_thrust: {
    id: 'hip_thrust',
    label: 'Hip Thrust',
    pattern: 'hinge',
    plane: 'sagittal',
    axialLoad: 0.25,
    loadedStretchIndex: 0.85,
    sfr: 1.2,
    defaultEccentricSec: 2,
    unilateralByDefault: false,
    provenance: RESEARCH('hip_thrust'),
  },
  hip_hinge_pull_through: {
    id: 'hip_hinge_pull_through',
    label: 'Cable Pull Through',
    pattern: 'hinge',
    plane: 'sagittal',
    axialLoad: 0.15,
    loadedStretchIndex: 1.3,
    sfr: 1.3,
    defaultEccentricSec: 2.5,
    unilateralByDefault: false,
    provenance: DERIVED(
      'romanian_deadlift + hip_thrust',
      'A hinge whose resistance vector is horizontal, so the spine carries almost none of it: RDL-grade stretch at cable-machine axial load and SFR.',
    ),
  },

  // ── posterior chain isolation ──────────────────────────────────────────────
  leg_curl: {
    id: 'leg_curl',
    label: 'Leg Curl',
    pattern: 'isolation_flexion',
    plane: 'sagittal',
    axialLoad: 0.02,
    loadedStretchIndex: 1.0,
    sfr: 1.3,
    defaultEccentricSec: 2,
    unilateralByDefault: false,
    provenance: RESEARCH('lying_leg_curl'),
  },
  nordic_curl: {
    id: 'nordic_curl',
    label: 'Nordic Curl',
    pattern: 'isolation_flexion',
    plane: 'sagittal',
    axialLoad: 0.1,
    loadedStretchIndex: 1.45,
    sfr: 0.85,
    defaultEccentricSec: 3,
    unilateralByDefault: false,
    provenance: DERIVED(
      'lying_leg_curl + romanian_deadlift',
      'The joint action is the leg curl but it is an eccentric-only movement at long muscle length; the stretch index and eccentric default take the RDL ceiling and the SFR drops below it because the fatigue cost is almost entirely damage.',
    ),
  },
  hip_abduction: {
    id: 'hip_abduction',
    label: 'Hip Abduction',
    pattern: 'isolation_abduction',
    plane: 'frontal',
    axialLoad: 0.05,
    loadedStretchIndex: 0.95,
    sfr: 1.3,
    defaultEccentricSec: 2,
    unilateralByDefault: false,
    provenance: DERIVED(
      'lateral_raise',
      'The hip mirror of the lateral raise: a seated single-joint abduction with a short loaded range and no spinal cost.',
    ),
  },
  hip_adduction: {
    id: 'hip_adduction',
    label: 'Hip Adduction',
    pattern: 'isolation_adduction',
    plane: 'frontal',
    axialLoad: 0.05,
    loadedStretchIndex: 1.25,
    sfr: 1.25,
    defaultEccentricSec: 2,
    unilateralByDefault: false,
    provenance: DERIVED(
      'lateral_raise + cable_fly',
      'Single-joint adduction: the machine start position puts the adductors at a genuinely long length, so the stretch index moves toward the cable fly rather than the raise.',
    ),
  },
  calf_raise: {
    id: 'calf_raise',
    label: 'Calf Raise',
    pattern: 'isolation_extension',
    plane: 'sagittal',
    axialLoad: 0.2,
    loadedStretchIndex: 1.35,
    sfr: 1.25,
    defaultEccentricSec: 2.5,
    unilateralByDefault: false,
    provenance: RESEARCH('standing_calf_raise'),
  },

  // ── elbow ──────────────────────────────────────────────────────────────────
  elbow_flexion_curl: {
    id: 'elbow_flexion_curl',
    label: 'Curl',
    pattern: 'isolation_flexion',
    plane: 'sagittal',
    axialLoad: 0.1,
    loadedStretchIndex: 1.1,
    sfr: 1.2,
    defaultEccentricSec: 2,
    unilateralByDefault: false,
    provenance: RESEARCH('ez_bar_curl'),
  },
  stretched_curl: {
    id: 'stretched_curl',
    label: 'Stretched Curl',
    pattern: 'isolation_flexion',
    plane: 'sagittal',
    axialLoad: 0.03,
    loadedStretchIndex: 1.45,
    sfr: 1.1,
    defaultEccentricSec: 3,
    unilateralByDefault: false,
    provenance: RESEARCH('incline_db_curl'),
  },
  triceps_pushdown: {
    id: 'triceps_pushdown',
    label: 'Triceps Pushdown',
    pattern: 'isolation_extension',
    plane: 'sagittal',
    axialLoad: 0.03,
    loadedStretchIndex: 0.85,
    sfr: 1.35,
    defaultEccentricSec: 2,
    unilateralByDefault: false,
    provenance: RESEARCH('tricep_pushdown'),
  },
  overhead_triceps_extension: {
    id: 'overhead_triceps_extension',
    label: 'Overhead Triceps Extension',
    pattern: 'isolation_extension',
    plane: 'sagittal',
    axialLoad: 0.05,
    loadedStretchIndex: 1.45,
    sfr: 1.15,
    defaultEccentricSec: 2.5,
    unilateralByDefault: false,
    provenance: RESEARCH('overhead_tricep_ext'),
  },
  wrist_flexion: {
    id: 'wrist_flexion',
    label: 'Wrist Curl',
    pattern: 'isolation_flexion',
    plane: 'sagittal',
    axialLoad: 0.02,
    loadedStretchIndex: 1.1,
    sfr: 1.3,
    defaultEccentricSec: 2,
    unilateralByDefault: false,
    provenance: DERIVED(
      'tricep_pushdown + ez_bar_curl',
      'The smallest single-joint action in the catalog: no spinal cost at all, a modest loaded range, and a good SFR because the forearms recover in 24h.',
    ),
  },

  // ── core ───────────────────────────────────────────────────────────────────
  hanging_leg_raise: {
    id: 'hanging_leg_raise',
    label: 'Hanging Leg Raise',
    pattern: 'isolation_flexion',
    plane: 'sagittal',
    axialLoad: 0.05,
    loadedStretchIndex: 1.2,
    sfr: 1.25,
    defaultEccentricSec: 2.5,
    unilateralByDefault: false,
    provenance: RESEARCH('hanging_leg_raise'),
  },
  trunk_flexion: {
    id: 'trunk_flexion',
    label: 'Crunch',
    pattern: 'isolation_flexion',
    plane: 'sagittal',
    axialLoad: 0.03,
    loadedStretchIndex: 0.9,
    sfr: 1.3,
    defaultEccentricSec: 2,
    unilateralByDefault: false,
    provenance: DERIVED(
      'hanging_leg_raise + tricep_pushdown',
      'Spinal flexion with the hips fixed: the shortest loaded range of any ab movement, hence a stretch index at the pushdown end and no axial cost.',
    ),
  },
  anti_extension_hold: {
    id: 'anti_extension_hold',
    label: 'Plank / Ab Wheel',
    pattern: 'anti_extension',
    plane: 'sagittal',
    axialLoad: 0.15,
    loadedStretchIndex: 1.1,
    sfr: 1.2,
    defaultEccentricSec: 0,
    unilateralByDefault: false,
    provenance: DERIVED(
      'hanging_leg_raise',
      'Isometric or slow-rollout anti-extension: no rep-wise eccentric to time, so the eccentric default is zero and the fatigue is driven by time under tension instead.',
    ),
  },
  anti_rotation_press: {
    id: 'anti_rotation_press',
    label: 'Pallof Press',
    pattern: 'anti_rotation',
    plane: 'transverse',
    axialLoad: 0.08,
    loadedStretchIndex: 0.95,
    sfr: 1.3,
    defaultEccentricSec: 2,
    unilateralByDefault: true,
    provenance: DERIVED(
      'face_pull + hanging_leg_raise',
      'A cable held against rotation: same low axial and high SFR profile as the face pull, with no meaningful loaded stretch.',
    ),
  },
  trunk_rotation: {
    id: 'trunk_rotation',
    label: 'Woodchop / Twist',
    pattern: 'rotation',
    plane: 'transverse',
    axialLoad: 0.15,
    loadedStretchIndex: 1.1,
    sfr: 1.2,
    defaultEccentricSec: 2,
    unilateralByDefault: true,
    provenance: DERIVED(
      'face_pull + hanging_leg_raise',
      'Loaded trunk rotation moves the spine under load, so it carries more axial cost than a Pallof press but stays far below any standing barbell lift.',
    ),
  },

  // ── full body, carry, conditioning ─────────────────────────────────────────
  loaded_carry: {
    id: 'loaded_carry',
    label: 'Loaded Carry',
    pattern: 'carry',
    plane: 'sagittal',
    axialLoad: 0.65,
    loadedStretchIndex: 0.8,
    sfr: 0.9,
    defaultEccentricSec: 0,
    unilateralByDefault: false,
    provenance: DERIVED(
      'conventional_deadlift + barbell_row',
      'Deadlift-sized load held statically while walking: high axial cost, effectively no loaded stretch and therefore no eccentric term; SFR sits near the barbell row.',
    ),
  },
  olympic_pull: {
    id: 'olympic_pull',
    label: 'Olympic Lift',
    pattern: 'olympic',
    plane: 'sagittal',
    axialLoad: 0.9,
    loadedStretchIndex: 1.0,
    sfr: 0.7,
    defaultEccentricSec: 1,
    unilateralByDefault: false,
    provenance: DERIVED(
      'conventional_deadlift + back_squat',
      'Triple extension against a deadlift-sized axial load, usually dropped rather than lowered: the eccentric default is shorter than the deadlift and the SFR nearly as poor.',
    ),
  },
  ballistic_swing: {
    id: 'ballistic_swing',
    label: 'Kettlebell Swing',
    pattern: 'hinge',
    plane: 'sagittal',
    axialLoad: 0.55,
    loadedStretchIndex: 1.15,
    sfr: 1.05,
    defaultEccentricSec: 1,
    unilateralByDefault: false,
    provenance: DERIVED(
      'romanian_deadlift + conventional_deadlift',
      'A ballistic hinge at a fraction of deadlift load: axial cost between the two anchors, a short reversal rather than a controlled lowering, and a better SFR than either because the absolute load is small.',
    ),
  },
  plyometric_jump: {
    id: 'plyometric_jump',
    label: 'Jump',
    pattern: 'plyometric',
    plane: 'sagittal',
    axialLoad: 0.35,
    loadedStretchIndex: 1.1,
    sfr: 1.0,
    defaultEccentricSec: 1,
    unilateralByDefault: false,
    provenance: DERIVED(
      'back_squat + bulgarian_split_squat',
      'Unloaded triple extension with a landing: the ground-reaction spike gives it real axial cost despite carrying no bar, and the landing eccentric is brief.',
    ),
  },
  isometric_hang: {
    id: 'isometric_hang',
    label: 'Dead Hang',
    pattern: 'isometric_hold',
    plane: 'frontal',
    axialLoad: 0.1,
    loadedStretchIndex: 1.3,
    sfr: 1.25,
    defaultEccentricSec: 0,
    unilateralByDefault: false,
    provenance: DERIVED(
      'pull_up',
      'The bottom of a pull up, held: the same long-length lat and grip position with no concentric or eccentric phase at all.',
    ),
  },
  neck_isolation: {
    id: 'neck_isolation',
    label: 'Neck Curl / Extension',
    pattern: 'isolation_flexion',
    plane: 'sagittal',
    axialLoad: 0.05,
    loadedStretchIndex: 1.0,
    sfr: 1.25,
    defaultEccentricSec: 2,
    unilateralByDefault: false,
    provenance: DERIVED(
      'tricep_pushdown + lateral_raise',
      'A small single-joint movement on a muscle group with a 36h recovery window and no systemic footprint.',
    ),
  },
  cyclic_conditioning: {
    id: 'cyclic_conditioning',
    label: 'Cyclic Conditioning',
    pattern: 'gait',
    plane: 'sagittal',
    axialLoad: 0.2,
    loadedStretchIndex: 0.8,
    sfr: 1.1,
    defaultEccentricSec: 0,
    unilateralByDefault: false,
    provenance: DERIVED(
      'leg_press + lateral_raise',
      'Rowing, running, air bike: sub-maximal cyclic work with no loaded stretch and no per-rep eccentric. Fatigue here is metabolic, which the readiness engine handles through its metabolic compartment rather than these damage terms.',
    ),
  },
} as const satisfies Record<string, Omit<MovementArchetypeDef, 'id'> & { id: string }>;

/** Stable identifier for a movement archetype. */
export type ArchetypeId = keyof typeof ARCHETYPES;

/** All archetype ids, in declaration order. */
export const ARCHETYPE_IDS = Object.keys(ARCHETYPES) as ArchetypeId[];

/**
 * The four fatigue parameters an exercise inherits from its archetype. An
 * exercise record may override any subset of these.
 */
export interface FatigueParams {
  readonly axialLoad: number;
  readonly loadedStretchIndex: number;
  readonly sfr: number;
  readonly defaultEccentricSec: number;
}

/** Returns an archetype definition. */
export function getArchetype(id: ArchetypeId): MovementArchetypeDef {
  return ARCHETYPES[id];
}

/**
 * Resolves the fatigue parameters for an exercise: the archetype's defaults
 * with any per-exercise overrides applied on top.
 *
 * @param id - the archetype the exercise names
 * @param overrides - fields the exercise row overrides, if any
 * @returns axial load (0..1), loaded-stretch index, SFR, eccentric seconds
 */
export function resolveFatigueParams(
  id: ArchetypeId,
  overrides?: Partial<FatigueParams>,
): FatigueParams {
  const base = ARCHETYPES[id];
  return {
    axialLoad: overrides?.axialLoad ?? base.axialLoad,
    loadedStretchIndex: overrides?.loadedStretchIndex ?? base.loadedStretchIndex,
    sfr: overrides?.sfr ?? base.sfr,
    defaultEccentricSec: overrides?.defaultEccentricSec ?? base.defaultEccentricSec,
  };
}

/** Every archetype whose numbers come verbatim from a readiness research profile. */
export function researchBackedArchetypes(): MovementArchetypeDef[] {
  return ARCHETYPE_IDS.map((id) => ARCHETYPES[id]).filter(
    (a) => a.provenance.source === 'research_profile',
  );
}
