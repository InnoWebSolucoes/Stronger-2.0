import { create } from 'zustand';
import { loadRaw, removeRaw, saveRaw } from '@/features/workout/storage';

const KEY = 'bodyweight';

export type WeighIn = {
  id: string;
  /** Epoch ms. */
  date: number;
  kg: number;
  /** Local file uri of a progress photo, if one was taken. Never uploaded. */
  photoUri?: string;
  note?: string;
};

let counter = 0;
function uid(): string {
  counter += 1;
  return `bw_${Date.now().toString(36)}_${counter.toString(36)}`;
}

type State = {
  entries: WeighIn[];
  goalKg: number | null;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  add: (kg: number, date?: number, photoUri?: string) => void;
  remove: (id: string) => void;
  setGoal: (kg: number | null) => void;
  replaceAll: (entries: WeighIn[]) => void;
  clear: () => void;
};

export const useBodyweight = create<State>((set, get) => {
  const persist = () => {
    const { entries, goalKg } = get();
    void saveRaw(KEY, JSON.stringify({ entries, goalKg }));
  };

  return {
    entries: [],
    goalKg: null,
    hydrated: false,

    hydrate: async () => {
      const raw = await loadRaw(KEY);
      let entries: WeighIn[] = [];
      let goalKg: number | null = null;
      try {
        if (raw) {
          const parsed = JSON.parse(raw) as { entries?: WeighIn[]; goalKg?: number | null };
          entries = parsed.entries ?? [];
          goalKg = parsed.goalKg ?? null;
        }
      } catch {
        entries = [];
      }
      set({ entries, goalKg, hydrated: true });
    },

    add: (kg, date = Date.now(), photoUri) => {
      const entry: WeighIn = { id: uid(), date, kg, ...(photoUri ? { photoUri } : {}) };
      // Newest first. One weigh-in per day wins — logging twice replaces.
      const sameDay = (a: number, b: number) =>
        new Date(a).toDateString() === new Date(b).toDateString();
      const without = get().entries.filter((e) => !sameDay(e.date, date));
      set({ entries: [entry, ...without].sort((a, b) => b.date - a.date) });
      persist();
    },

    remove: (id) => {
      set({ entries: get().entries.filter((e) => e.id !== id) });
      persist();
    },

    setGoal: (kg) => {
      set({ goalKg: kg });
      persist();
    },

    replaceAll: (entries) => {
      set({ entries: [...entries].sort((a, b) => b.date - a.date) });
      persist();
    },

    clear: () => {
      set({ entries: [], goalKg: null });
      void removeRaw(KEY);
    },
  };
});
