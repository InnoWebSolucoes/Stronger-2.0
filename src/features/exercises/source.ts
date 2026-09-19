import {
  SEED_EXERCISES,
  exercisesByMuscle,
  findExercise,
  searchExercises as coreSearch,
  type SeedExercise,
} from '@core/exercises';
import { MUSCLE_GROUPS as CORE_GROUPS, MUSCLE_GROUP_IDS } from '@core/exercises/muscles';
import { EQUIPMENT } from '@core/exercises/equipment';
import type { ExerciseSeed } from '@/features/workout/store';

/**
 * UI-facing view of the exercise catalog.
 *
 * The core catalog is rich — 278 rows with contribution vectors, archetypes,
 * tracking types, limb modes and standards references. The logging UI needs
 * almost none of that, so this flattens it to the shape the screens consume
 * and nothing more. Screens import from here, never from @core/exercises
 * directly, so the engine's shape can change without touching the UI.
 */

export type UiExercise = ExerciseSeed & {
  equipment: string;
  /** Display names of the muscle groups this trains, heaviest share first. */
  muscles: string[];
  instructions: readonly string[];
};

const GROUP_LABEL: Record<string, string> = Object.fromEntries(
  MUSCLE_GROUP_IDS.map((id) => [id, CORE_GROUPS[id].label]),
);

/**
 * Rest defaults by mechanic. Compounds need genuinely longer than isolation
 * work, and shipping one blanket value is the sort of detail that makes an app
 * feel like it was never used in a gym.
 */
function restFor(ex: SeedExercise): number {
  if (ex.mechanic === 'isolation') return 90;
  // The heaviest axial compounds — squat, deadlift and their close variants.
  const pattern = ex.pattern;
  if (pattern === 'squat' || pattern === 'hinge') return 210;
  return 150;
}

/** Groups contributing at least 12% of the effort, heaviest first. */
function musclesOf(ex: SeedExercise): string[] {
  const entries = Object.entries(ex.groupWeights) as [string, number][];
  return entries
    .filter(([, w]) => w >= 0.12)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => GROUP_LABEL[id] ?? id)
    .slice(0, 4);
}

function toUi(ex: SeedExercise): UiExercise {
  const equipmentId = ex.components.equipmentId as keyof typeof EQUIPMENT;
  return {
    id: ex.id,
    name: ex.name,
    equipment: EQUIPMENT[equipmentId]?.label ?? 'Other',
    muscles: musclesOf(ex),
    defaultRestSeconds: restFor(ex),
    instructions: ex.instructions,
  };
}

export const ALL_EXERCISES: UiExercise[] = SEED_EXERCISES.map(toUi).sort((a, b) =>
  a.name.localeCompare(b.name),
);

const BY_ID = new Map(ALL_EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): UiExercise | undefined {
  return BY_ID.get(id);
}

/** Display labels, in the catalog's own chip order rather than alphabetical. */
export const MUSCLE_GROUPS: string[] = MUSCLE_GROUP_IDS.map((id) => CORE_GROUPS[id])
  .slice()
  .sort((a, b) => a.chipOrder - b.chipOrder)
  .map((g) => g.label);

const GROUP_ID_BY_LABEL = new Map(
  MUSCLE_GROUP_IDS.map((id) => [CORE_GROUPS[id].label, id]),
);

/**
 * Ranked search over names and aliases, optionally narrowed to one muscle group.
 *
 * The core search deliberately matches names and aliases only, so a query like
 * "abs" finds nothing there. The Train tab has a single search box, so this
 * unions the text hits with a muscle-group lookup — otherwise typing a body
 * part into the only search field on screen returns nothing, which reads as a
 * broken app rather than a scoping decision.
 */
export function searchExercises(query: string, muscle?: string | null): UiExercise[] {
  const groupId = muscle ? GROUP_ID_BY_LABEL.get(muscle) : undefined;
  const pool = groupId
    ? exercisesByMuscle(groupId).map((e) => e.id)
    : null;
  const inPool = (id: string) => pool === null || pool.includes(id);

  const q = query.trim();
  if (!q) {
    return ALL_EXERCISES.filter((e) => inPool(e.id));
  }

  const hits = coreSearch(q, { limit: 300 });
  const out: UiExercise[] = [];
  const seen = new Set<string>();

  for (const hit of hits) {
    if (!inPool(hit.exercise.id)) continue;
    const ui = BY_ID.get(hit.exercise.id);
    if (ui && !seen.has(ui.id)) {
      seen.add(ui.id);
      out.push(ui);
    }
  }

  // Fall back to a muscle-group match so body-part queries resolve.
  if (out.length === 0 && !groupId) {
    const matchedGroup = MUSCLE_GROUP_IDS.find((id) => {
      const g = CORE_GROUPS[id];
      const needle = q.toLowerCase();
      return g.label.toLowerCase().includes(needle) || id.replace(/_/g, ' ').includes(needle);
    });
    if (matchedGroup) {
      for (const ex of exercisesByMuscle(matchedGroup)) {
        const ui = BY_ID.get(ex.id);
        if (ui && !seen.has(ui.id)) {
          seen.add(ui.id);
          out.push(ui);
        }
      }
    }
  }

  return out;
}

export { findExercise };

/**
 * Resolve a plain-English exercise name to a catalog id.
 *
 * Fixtures, routine templates and the demo generator refer to exercises by
 * name rather than by slug. Slugs are derived from movement + equipment
 * (`bench-press--barbell`) and change whenever the catalog is regenerated, so
 * hard-coding them means every template silently empties on the next catalog
 * update. Resolving through search survives that.
 *
 * Returns null rather than guessing when nothing matches well, so a bad
 * reference surfaces as a missing exercise in a test instead of the wrong
 * exercise in someone's workout.
 */
export function resolveExercise(name: string): UiExercise | null {
  const exact = BY_ID.get(name);
  if (exact) return exact;

  const hits = searchExercises(name);
  return hits[0] ?? null;
}

/** Resolve many, dropping anything that does not match. */
export function resolveAll(names: readonly string[]): UiExercise[] {
  const out: UiExercise[] = [];
  const seen = new Set<string>();
  for (const n of names) {
    const found = resolveExercise(n);
    if (found && !seen.has(found.id)) {
      seen.add(found.id);
      out.push(found);
    }
  }
  return out;
}
