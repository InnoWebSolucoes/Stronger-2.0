import { create } from 'zustand';
import { loadRaw, removeRaw, saveRaw } from '@/features/workout/storage';
import type { ExerciseSeed } from '@/features/workout/store';

export { TEMPLATES, type RoutineTemplate } from './templates';

const KEY = 'routines';

export type RoutineExercise = {
  exerciseId: string;
  name: string;
  muscles: string[];
  restSeconds: number;
  /** Planned working sets. The user can still add more mid-session. */
  targetSets: number;
};

export type Routine = {
  id: string;
  name: string;
  /** Optional note — "week 3, deload" and the like. */
  note?: string;
  exercises: RoutineExercise[];
  createdAt: number;
  updatedAt: number;
};

let counter = 0;
function uid(): string {
  counter += 1;
  return `r_${Date.now().toString(36)}_${counter.toString(36)}`;
}



type State = {
  routines: Routine[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  create: (name: string, exercises: ExerciseSeed[], note?: string) => Routine;
  update: (id: string, patch: Partial<Omit<Routine, 'id' | 'createdAt'>>) => void;
  remove: (id: string) => void;
  duplicate: (id: string) => Routine | null;
  get: (id: string) => Routine | undefined;
};

export const useRoutines = create<State>((set, get) => {
  const persist = () => {
    void saveRaw(KEY, JSON.stringify(get().routines));
  };

  return {
    routines: [],
    hydrated: false,

    hydrate: async () => {
      const raw = await loadRaw(KEY);
      let routines: Routine[] = [];
      try {
        if (raw) routines = JSON.parse(raw) as Routine[];
      } catch {
        routines = [];
      }
      set({ routines, hydrated: true });
    },

    create: (name, exercises, note) => {
      const now = Date.now();
      const routine: Routine = {
        id: uid(),
        name: name.trim() || 'Untitled routine',
        ...(note ? { note } : {}),
        exercises: exercises.map((e) => ({
          exerciseId: e.id,
          name: e.name,
          muscles: e.muscles,
          restSeconds: e.defaultRestSeconds ?? 120,
          targetSets: 3,
        })),
        createdAt: now,
        updatedAt: now,
      };
      set({ routines: [routine, ...get().routines] });
      persist();
      return routine;
    },

    update: (id, patch) => {
      set({
        routines: get().routines.map((r) =>
          r.id === id ? { ...r, ...patch, updatedAt: Date.now() } : r,
        ),
      });
      persist();
    },

    remove: (id) => {
      const next = get().routines.filter((r) => r.id !== id);
      set({ routines: next });
      if (next.length === 0) void removeRaw(KEY);
      else persist();
    },

    duplicate: (id) => {
      const source = get().routines.find((r) => r.id === id);
      if (!source) return null;
      const now = Date.now();
      const copy: Routine = {
        ...source,
        id: uid(),
        name: `${source.name} copy`,
        createdAt: now,
        updatedAt: now,
      };
      set({ routines: [copy, ...get().routines] });
      persist();
      return copy;
    },

    get: (id) => get().routines.find((r) => r.id === id),
  };
});
