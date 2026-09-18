import { create } from 'zustand';
import { loadRaw, removeRaw, saveRaw } from '@/features/workout/storage';

const KEY = 'account';

export type Sex = 'male' | 'female';
export type Units = 'kg' | 'lb';

export type Profile = {
  id: string;
  name: string;
  handle: string;
  bio?: string;
  /** Rendered as initials in a tile — no uploaded avatars until storage is wired. */
  initials: string;
  isPro: boolean;
  sex: Sex;
  birthYear: number;
  bodyweightKg: number;
  units: Units;
  joinedAt: number;
  followers: number;
  following: number;
};

type State = {
  profile: Profile | null;
  hydrated: boolean;
  /** True while the demo dataset is being generated. */
  seeding: boolean;

  hydrate: () => Promise<void>;
  signIn: (profile: Profile) => void;
  signOut: () => void;
  update: (patch: Partial<Profile>) => void;
  setSeeding: (seeding: boolean) => void;
};

export const DEMO_PROFILE: Profile = {
  id: 'demo',
  name: 'Kasim Iqbal',
  handle: 'kasimbolas',
  bio: 'Chasing a 200 kg deadlift. Push / pull / legs, four days a week.',
  initials: 'KI',
  isPro: true,
  sex: 'male',
  birthYear: 1998,
  bodyweightKg: 78.9,
  units: 'kg',
  joinedAt: Date.UTC(2024, 9, 12),
  followers: 128,
  following: 94,
};

export const useAccount = create<State>((set, get) => {
  const persist = () => {
    const { profile } = get();
    if (profile) void saveRaw(KEY, JSON.stringify(profile));
    else void removeRaw(KEY);
  };

  return {
    profile: null,
    hydrated: false,
    seeding: false,

    hydrate: async () => {
      const raw = await loadRaw(KEY);
      let profile: Profile | null = null;
      try {
        if (raw) profile = JSON.parse(raw) as Profile;
      } catch {
        profile = null;
      }
      set({ profile, hydrated: true });
    },

    signIn: (profile) => {
      set({ profile });
      persist();
    },

    signOut: () => {
      set({ profile: null });
      void removeRaw(KEY);
    },

    update: (patch) => {
      const current = get().profile;
      if (!current) return;
      set({ profile: { ...current, ...patch } });
      persist();
    },

    setSeeding: (seeding) => set({ seeding }),
  };
});

/** Age from birth year. Used by the strength standards' age adjustment. */
export function ageOf(profile: Profile, now = Date.now()): number {
  return new Date(now).getUTCFullYear() - profile.birthYear;
}
