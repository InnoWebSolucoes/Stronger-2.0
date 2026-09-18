import { create } from 'zustand';
import type { ExerciseSeed } from '@/features/workout/store';

/**
 * Handoff for the exercise picker.
 *
 * The picker is one screen serving two callers — the live workout and the
 * routine editor. Rather than duplicating it, the caller sets a mode before
 * navigating and collects the result here. `consume` clears as it reads, so a
 * pick can never be applied twice if the editor re-renders.
 */

export type PickMode = 'workout' | 'routine';

type State = {
  mode: PickMode;
  picked: ExerciseSeed | null;
  setMode: (mode: PickMode) => void;
  put: (seed: ExerciseSeed) => void;
  consume: () => ExerciseSeed | null;
};

export const usePick = create<State>((set, get) => ({
  mode: 'workout',
  picked: null,
  setMode: (mode) => set({ mode, picked: null }),
  put: (seed) => set({ picked: seed }),
  consume: () => {
    const { picked } = get();
    if (picked) set({ picked: null });
    return picked;
  },
}));
