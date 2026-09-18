import { create } from 'zustand';
import { loadRaw, removeRaw, saveRaw } from './storage';
import type {
  ActiveWorkout,
  CompletedWorkout,
  LoggedSet,
  SetType,
  WorkoutExercise,
} from './types';

const ACTIVE_KEY = 'active-workout';
const HISTORY_KEY = 'workout-history';

let counter = 0;
/** Local-only instance id. Durable ULIDs come from src/db when sync lands. */
function uid(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export type ExerciseSeed = {
  id: string;
  name: string;
  muscles: string[];
  defaultRestSeconds?: number;
};

type State = {
  active: ActiveWorkout | null;
  history: CompletedWorkout[];
  hydrated: boolean;
  /** Set id whose rest timer is running, plus when it ends. */
  restEndsAt: number | null;

  hydrate: () => Promise<void>;
  start: (name: string, exercises?: ExerciseSeed[]) => void;
  discard: () => void;
  finish: () => CompletedWorkout | null;

  rename: (name: string) => void;
  addExercise: (seed: ExerciseSeed) => void;
  removeExercise: (exerciseInstanceId: string) => void;

  addSet: (exerciseInstanceId: string) => void;
  updateSet: (exerciseInstanceId: string, setId: string, patch: Partial<LoggedSet>) => void;
  cycleSetType: (exerciseInstanceId: string, setId: string) => void;
  toggleSetDone: (exerciseInstanceId: string, setId: string) => void;
  removeSet: (exerciseInstanceId: string, setId: string) => void;

  startRest: (seconds: number) => void;
  clearRest: () => void;
};

function emptySet(previous?: { weightKg: number; reps: number } | null): LoggedSet {
  return {
    id: uid('set'),
    type: 'normal',
    weightKg: null,
    reps: null,
    rpe: null,
    done: false,
    previous: previous ?? null,
  };
}

/** Warm-up sets are excluded: they are ramp-up, not work. */
export function setCountsTowardVolume(s: LoggedSet): boolean {
  return s.done && s.type !== 'warmup' && s.weightKg != null && s.reps != null;
}

export function workoutVolumeKg(w: ActiveWorkout): number {
  let total = 0;
  for (const ex of w.exercises) {
    for (const s of ex.sets) {
      if (setCountsTowardVolume(s)) total += (s.weightKg ?? 0) * (s.reps ?? 0);
    }
  }
  return total;
}

export function workoutReps(w: ActiveWorkout): number {
  let total = 0;
  for (const ex of w.exercises) {
    for (const s of ex.sets) {
      if (setCountsTowardVolume(s)) total += s.reps ?? 0;
    }
  }
  return total;
}

export function workoutCompletedSets(w: ActiveWorkout): number {
  let n = 0;
  for (const ex of w.exercises) for (const s of ex.sets) if (s.done) n += 1;
  return n;
}

const SET_TYPE_CYCLE: SetType[] = ['normal', 'warmup', 'drop', 'failure'];

export const useWorkout = create<State>((set, get) => {
  /** Persist after every mutation. The in-progress workout is the one thing
   *  that must survive a force-kill, so this is not debounced. */
  const persist = () => {
    const { active, history } = get();
    if (active) void saveRaw(ACTIVE_KEY, JSON.stringify(active));
    else void removeRaw(ACTIVE_KEY);
    void saveRaw(HISTORY_KEY, JSON.stringify(history));
  };

  const mutateActive = (fn: (w: ActiveWorkout) => ActiveWorkout) => {
    const current = get().active;
    if (!current) return;
    set({ active: fn(current) });
    persist();
  };

  const mapExercise = (
    w: ActiveWorkout,
    exerciseInstanceId: string,
    fn: (ex: WorkoutExercise) => WorkoutExercise,
  ): ActiveWorkout => ({
    ...w,
    exercises: w.exercises.map((ex) => (ex.id === exerciseInstanceId ? fn(ex) : ex)),
  });

  return {
    active: null,
    history: [],
    hydrated: false,
    restEndsAt: null,

    hydrate: async () => {
      const [rawActive, rawHistory] = await Promise.all([
        loadRaw(ACTIVE_KEY),
        loadRaw(HISTORY_KEY),
      ]);
      let active: ActiveWorkout | null = null;
      let history: CompletedWorkout[] = [];
      try {
        if (rawActive) active = JSON.parse(rawActive) as ActiveWorkout;
      } catch {
        active = null;
      }
      try {
        if (rawHistory) history = JSON.parse(rawHistory) as CompletedWorkout[];
      } catch {
        history = [];
      }
      set({ active, history, hydrated: true });
    },

    start: (name, exercises = []) => {
      const workout: ActiveWorkout = {
        id: uid('w'),
        name,
        startedAt: Date.now(),
        exercises: exercises.map((seed) => ({
          id: uid('we'),
          exerciseId: seed.id,
          name: seed.name,
          muscles: seed.muscles,
          restSeconds: seed.defaultRestSeconds ?? 120,
          sets: [emptySet()],
        })),
      };
      set({ active: workout, restEndsAt: null });
      persist();
    },

    discard: () => {
      set({ active: null, restEndsAt: null });
      void removeRaw(ACTIVE_KEY);
    },

    finish: () => {
      const w = get().active;
      if (!w) return null;
      const finishedAt = Date.now();
      const completed: CompletedWorkout = {
        ...w,
        // Drop empty sets so an abandoned row does not pollute history.
        exercises: w.exercises
          .map((ex) => ({ ...ex, sets: ex.sets.filter((s) => s.done) }))
          .filter((ex) => ex.sets.length > 0),
        finishedAt,
        durationSec: Math.max(0, Math.round((finishedAt - w.startedAt) / 1000)),
        volumeKg: workoutVolumeKg(w),
        totalReps: workoutReps(w),
        totalSets: workoutCompletedSets(w),
      };
      set({ active: null, restEndsAt: null, history: [completed, ...get().history] });
      persist();
      return completed;
    },

    rename: (name) => mutateActive((w) => ({ ...w, name })),

    addExercise: (seed) =>
      mutateActive((w) => ({
        ...w,
        exercises: [
          ...w.exercises,
          {
            id: uid('we'),
            exerciseId: seed.id,
            name: seed.name,
            muscles: seed.muscles,
            restSeconds: seed.defaultRestSeconds ?? 120,
            sets: [emptySet()],
          },
        ],
      })),

    removeExercise: (exerciseInstanceId) =>
      mutateActive((w) => ({
        ...w,
        exercises: w.exercises.filter((ex) => ex.id !== exerciseInstanceId),
      })),

    addSet: (exerciseInstanceId) =>
      mutateActive((w) =>
        mapExercise(w, exerciseInstanceId, (ex) => {
          const last = ex.sets[ex.sets.length - 1];
          // Carry the previous set's load forward: the common case is the same
          // weight again, and re-typing it every set is the top complaint about
          // logging apps.
          const seeded = emptySet(last?.previous ?? null);
          if (last && last.weightKg != null) seeded.weightKg = last.weightKg;
          if (last && last.reps != null) seeded.reps = last.reps;
          if (last) seeded.type = last.type === 'warmup' ? 'normal' : last.type;
          return { ...ex, sets: [...ex.sets, seeded] };
        }),
      ),

    updateSet: (exerciseInstanceId, setId, patch) =>
      mutateActive((w) =>
        mapExercise(w, exerciseInstanceId, (ex) => ({
          ...ex,
          sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
        })),
      ),

    cycleSetType: (exerciseInstanceId, setId) =>
      mutateActive((w) =>
        mapExercise(w, exerciseInstanceId, (ex) => ({
          ...ex,
          sets: ex.sets.map((s) => {
            if (s.id !== setId) return s;
            const i = SET_TYPE_CYCLE.indexOf(s.type);
            const next = SET_TYPE_CYCLE[(i + 1) % SET_TYPE_CYCLE.length] ?? 'normal';
            return { ...s, type: next };
          }),
        })),
      ),

    toggleSetDone: (exerciseInstanceId, setId) => {
      let restSeconds: number | null = null;
      mutateActive((w) =>
        mapExercise(w, exerciseInstanceId, (ex) => ({
          ...ex,
          sets: ex.sets.map((s) => {
            if (s.id !== setId) return s;
            const done = !s.done;
            // Ticking a set starts the rest timer; un-ticking must not.
            if (done && s.type !== 'drop') restSeconds = ex.restSeconds;
            return { ...s, done };
          }),
        })),
      );
      if (restSeconds != null) get().startRest(restSeconds);
    },

    removeSet: (exerciseInstanceId, setId) =>
      mutateActive((w) =>
        mapExercise(w, exerciseInstanceId, (ex) => ({
          ...ex,
          sets: ex.sets.filter((s) => s.id !== setId),
        })),
      ),

    startRest: (seconds) => set({ restEndsAt: Date.now() + seconds * 1000 }),
    clearRest: () => set({ restEndsAt: null }),
  };
});
