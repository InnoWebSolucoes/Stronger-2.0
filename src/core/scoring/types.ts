/**
 * Shared domain types for `src/core/scoring`.
 *
 * Pure TypeScript — no `react`, `react-native` or `expo-*` imports anywhere in
 * this module (see `AGENTS.md`, "src/core is pure TypeScript").
 *
 * Unit contract: every weight in this module is KILOGRAMS. Conversion to the
 * user's display unit happens once, at the render edge, via `units.ts`.
 */

/**
 * How a set was performed. Drives the reps-in-reserve prior when the lifter
 * leaves RPE blank, and decides whether the set counts toward volume and PRs.
 *
 * Source: research brief §"RPE defaults when the user leaves it blank".
 */
export type SetType =
  | 'warmup'
  | 'normal'
  | 'dropset'
  | 'failure'
  | 'myorep'
  | 'cluster'
  | 'amrap';

/**
 * One logged set, exactly as it lands in SQLite.
 *
 * `weightKg` is the EXTERNAL load as logged: for a bodyweight exercise it is
 * the ADDED weight (belt/dip-belt plates), and for an assisted exercise it is
 * the ASSISTANCE (magnitude; sign is ignored — assistance always subtracts).
 * The true load moved per rep is computed by `repLoadKg()` in `volume.ts`.
 *
 * Unilateral convention: `reps` and `weightKg` are BOTH per side. The doubling
 * happens once, in `repsCredited()`, and never to the load.
 */
export interface LoggedSet {
  /** Stable set id (ULID). Never an array index. */
  id: string;
  /** Stable exercise slug. Never an array index, never a regenerated UUID. */
  exerciseId: string;
  setType: SetType;
  /** Repetitions completed. Per side for unilateral exercises. */
  reps: number;
  /** External load in kg as logged. Per side for unilateral exercises. */
  weightKg: number;
  /** Self-reported RPE, 6..10 in 0.5 steps. Null/undefined = not reported. */
  rpe?: number | null;
  /** Reps in reserve, if the UI collects RIR directly instead of RPE. */
  rirObserved?: number | null;
  completed: boolean;
  /** Fewer reps than an earlier set at the same load ⇒ probably near failure. */
  fatigueDetected?: boolean;
  /** Duration-based work (plank, dead hang), seconds. */
  timeSec?: number | null;
  /** Distance-based work (carry, row, sled), metres. */
  distanceM?: number | null;
}

/**
 * Equipment families the app knows how to round a prescription onto.
 *
 * Smith machines are deliberately split from barbells because their effective
 * bar weight is unknowable (7-11 kg counterbalanced, 20 kg+ uncounterbalanced)
 * and must be a per-gym setting — see research brief, "Smith machine bar weight
 * is not knowable".
 */
export type EquipmentKind =
  | 'BARBELL'
  | 'SMITH'
  | 'EZ_BAR'
  | 'TRAP_BAR'
  | 'DUMBBELL'
  | 'MACHINE_STACK'
  | 'CABLE'
  | 'PLATE_LOADED'
  | 'BODYWEIGHT'
  | 'BAND';
