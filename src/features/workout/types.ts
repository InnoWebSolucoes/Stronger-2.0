/** How a set counts toward volume, fatigue and personal records. */
export type SetType =
  /** Ramp-up. Never counts toward PRs, contributes little fatigue. */
  | 'warmup'
  /** A straight working set. */
  | 'normal'
  /** Weight stripped and continued without rest. */
  | 'drop'
  /** Taken to momentary muscular failure. */
  | 'failure';

export const SET_TYPE_LABEL: Record<SetType, string> = {
  warmup: 'Warm-up',
  normal: 'Working',
  drop: 'Drop set',
  failure: 'To failure',
};

/** Single-character marker shown in the set-number cell. */
export const SET_TYPE_MARK: Record<SetType, string> = {
  warmup: 'W',
  normal: '',
  drop: 'D',
  failure: 'F',
};

export type LoggedSet = {
  id: string;
  type: SetType;
  /** Kilograms. Null until the user enters it. */
  weightKg: number | null;
  reps: number | null;
  /** Rate of perceived exertion, 6–10. Optional by design — most people skip it. */
  rpe: number | null;
  /** Ticked off. Only completed sets count toward live volume. */
  done: boolean;
  /** What this set's slot held last time, for the Previous column. */
  previous?: { weightKg: number; reps: number } | null;
};

export type WorkoutExercise = {
  /** Instance id — unique within this workout, not the catalog id. */
  id: string;
  exerciseId: string;
  name: string;
  /** Muscle groups this trains, for the summary map. */
  muscles: string[];
  /** Seconds. Drives the rest timer when a set is ticked. */
  restSeconds: number;
  sets: LoggedSet[];
  note?: string;
};

export type ActiveWorkout = {
  id: string;
  name: string;
  /** Epoch ms. Duration is always derived from this, never stored as elapsed. */
  startedAt: number;
  exercises: WorkoutExercise[];
};

/** A finished session, kept in local history. */
export type CompletedWorkout = ActiveWorkout & {
  finishedAt: number;
  durationSec: number;
  volumeKg: number;
  totalReps: number;
  totalSets: number;
};
