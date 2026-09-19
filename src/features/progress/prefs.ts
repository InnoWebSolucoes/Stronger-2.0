import { create } from 'zustand';
import { loadRaw, saveRaw } from '@/features/workout/storage';

const KEY = 'progress-prefs';

/**
 * Preferences the Progress tab owns.
 *
 * Height lives here rather than on the account profile because the account
 * store is not this screen's to extend — but the BMI floor in
 * `@core/bodyweight/safety` cannot be enforced without it, and a weight-loss
 * goal that skips the BMI floor is exactly what AGENTS.md §8 forbids. So the
 * goal sheet asks for height once and keeps it here.
 */
type State = {
  heightCm: number | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setHeightCm: (cm: number | null) => void;
};

export const useProgressPrefs = create<State>((set, get) => ({
  heightCm: null,
  hydrated: false,

  hydrate: async () => {
    const raw = await loadRaw(KEY);
    let heightCm: number | null = null;
    try {
      if (raw !== null) {
        const parsed = JSON.parse(raw) as { heightCm?: number | null };
        heightCm = typeof parsed.heightCm === 'number' ? parsed.heightCm : null;
      }
    } catch {
      heightCm = null;
    }
    set({ heightCm, hydrated: true });
  },

  setHeightCm: (cm) => {
    set({ heightCm: cm });
    void saveRaw(KEY, JSON.stringify({ heightCm: get().heightCm }));
  },
}));
