/**
 * The exercise catalog's public surface.
 *
 * Everything the rest of the app touches comes through here: the taxonomy
 * enums, the name generator, the contribution maths, the seeded rows, and the
 * three lookups a UI actually needs — by id, by search text, by muscle group.
 *
 * The indexes below are built once at module load from `SEED_EXERCISES`. That
 * is deliberate: the catalog is a frozen constant, the app opens on a screen
 * that searches it, and rebuilding a 278-row index per keystroke is the kind of
 * thing that only shows up on a four-year-old Android in a basement gym.
 *
 * Pure TypeScript. No platform imports.
 */

export * from './archetypes';
export * from './contributions';
export * from './equipment';
export * from './muscles';
export * from './naming';
export * from './patterns';
export * from './seed';
export * from './types';

import type { MuscleGroupId, MuscleId } from './muscles';
import { MUSCLES } from './muscles';
import { searchNormalize } from './naming';
import { SEED_EXERCISES, type SeedExercise } from './seed';
import type { ExerciseId } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────────────────────────────────────

const BY_ID: ReadonlyMap<ExerciseId, SeedExercise> = new Map(
  SEED_EXERCISES.map((e) => [e.id, e] as const),
);

/** Pre-normalised search text, built once so search does no string work per row. */
interface SearchRow {
  readonly exercise: SeedExercise;
  readonly name: string;
  readonly aliases: readonly string[];
  /** Name tokens, for the token-overlap fallback. */
  readonly tokens: readonly string[];
}

const SEARCH_ROWS: readonly SearchRow[] = SEED_EXERCISES.map((exercise) => {
  const name = searchNormalize(exercise.name);
  return {
    exercise,
    name,
    aliases: exercise.aliases.map(searchNormalize).filter((a) => a !== ''),
    tokens: name.split(' ').filter((t) => t !== ''),
  };
});

const BY_GROUP: ReadonlyMap<MuscleGroupId, readonly SeedExercise[]> = (() => {
  const map = new Map<MuscleGroupId, SeedExercise[]>();
  for (const exercise of SEED_EXERCISES) {
    for (const [group, weight] of Object.entries(exercise.groupWeights)) {
      if (weight === undefined || weight <= 0) continue;
      const key = group as MuscleGroupId;
      const bucket = map.get(key);
      if (bucket === undefined) map.set(key, [exercise]);
      else bucket.push(exercise);
    }
  }
  for (const [group, bucket] of map) {
    bucket.sort((a, b) => (b.groupWeights[group] ?? 0) - (a.groupWeights[group] ?? 0));
  }
  return map;
})();

// ─────────────────────────────────────────────────────────────────────────────
// Lookups
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves a catalog id.
 *
 * @param id - a frozen exercise slug, as stored in workout history
 * @returns the exercise, or `undefined` for an unknown or user-created id
 */
export function findExercise(id: ExerciseId): SeedExercise | undefined {
  return BY_ID.get(id);
}

/** `true` when `id` names a catalog row. */
export function isCatalogExercise(id: string): boolean {
  return BY_ID.has(id);
}

/** One search hit with the score that ranked it. */
export interface SearchHit {
  readonly exercise: SeedExercise;
  /** 0..100. Higher is a better match. */
  readonly score: number;
}

/** Options for {@link searchExercises}. */
export interface SearchOptions {
  /** Maximum hits returned. Defaults to 50. */
  readonly limit?: number;
  /** Hits below this score are dropped. Defaults to 1. */
  readonly minScore?: number;
}

const SCORE_NAME_EXACT = 100;
const SCORE_ALIAS_EXACT = 92;
const SCORE_NAME_PREFIX = 84;
const SCORE_ALIAS_PREFIX = 72;
const SCORE_NAME_WORD_PREFIX = 64;
const SCORE_NAME_SUBSTRING = 52;
const SCORE_ALIAS_SUBSTRING = 40;
/** Every matched query token adds this much to the token-overlap fallback. */
const SCORE_PER_TOKEN = 24;

function wordPrefixMatch(tokens: readonly string[], query: string): boolean {
  for (const token of tokens) {
    if (token.startsWith(query)) return true;
  }
  return false;
}

function scoreRow(row: SearchRow, query: string, queryTokens: readonly string[]): number {
  if (row.name === query) return SCORE_NAME_EXACT;
  for (const alias of row.aliases) {
    if (alias === query) return SCORE_ALIAS_EXACT;
  }
  if (row.name.startsWith(query)) return SCORE_NAME_PREFIX;
  for (const alias of row.aliases) {
    if (alias.startsWith(query)) return SCORE_ALIAS_PREFIX;
  }
  if (wordPrefixMatch(row.tokens, query)) return SCORE_NAME_WORD_PREFIX;
  if (row.name.includes(query)) return SCORE_NAME_SUBSTRING;
  for (const alias of row.aliases) {
    if (alias.includes(query)) return SCORE_ALIAS_SUBSTRING;
  }

  // Fallback: how many of the query's words appear anywhere in the row. This is
  // what makes "db incline press" find "Incline Bench Press (Dumbbell)" — the
  // generated aliases carry the equipment-first permutation, and the words
  // match even though no single string contains the whole query.
  if (queryTokens.length < 2) return 0;
  let matched = 0;
  for (const token of queryTokens) {
    if (row.name.includes(token)) {
      matched += 1;
      continue;
    }
    let inAlias = false;
    for (const alias of row.aliases) {
      if (alias.includes(token)) {
        inAlias = true;
        break;
      }
    }
    if (inAlias) matched += 1;
  }
  if (matched < queryTokens.length) return 0;
  return Math.min(SCORE_NAME_SUBSTRING - 1, matched * SCORE_PER_TOKEN);
}

function collectHits(
  normalized: string,
  tokens: readonly string[],
  minScore: number,
): SearchHit[] {
  const hits: SearchHit[] = [];
  for (const row of SEARCH_ROWS) {
    const score = scoreRow(row, normalized, tokens);
    if (score >= minScore) hits.push({ exercise: row.exercise, score });
  }
  return hits;
}

/**
 * Strips a plural `s` from each query word so "leg raises" reaches "Leg Raise".
 *
 * Deliberately crude and used ONLY as a zero-hit retry, never on the first
 * pass, because it is wrong often enough to matter: it would turn "press" into
 * "pres" and "triceps" into "tricep". The guards below keep the common damage
 * out — a word ending in `ss` or `us` is left alone, and so is anything three
 * characters or shorter, where dropping a letter is mostly noise. Three is
 * still worth trying, because "pull ups" has to reach "Pull Up".
 *
 * @param tokens - normalised query words
 * @returns the de-pluralised words, or `null` when nothing would change
 */
function depluralize(tokens: readonly string[]): string[] | null {
  let changed = false;
  const out = tokens.map((token) => {
    if (token.length <= 2) return token;
    if (!token.endsWith('s')) return token;
    if (token.endsWith('ss') || token.endsWith('us') || token.endsWith('is')) return token;
    changed = true;
    return token.slice(0, -1);
  });
  return changed ? out : null;
}

/**
 * Ranked search over catalog names and aliases.
 *
 * Matching is layered rather than fuzzy: exact name, exact alias, name prefix,
 * alias prefix, word prefix, substring, then all-query-words-present. A fuzzy
 * edit-distance pass is deliberately NOT in this path — `stringSimilarity` in
 * `naming.ts` exists for import-time deduplication, where a wrong merge is
 * expensive and 1,200 comparisons are affordable. In a search box, edit
 * distance mostly returns confident nonsense.
 *
 * Ties break on the shorter name, so "Pull Up" outranks "Wide Grip Pull Up" for
 * the query "pull up".
 *
 * @param query - raw user text; empty or whitespace returns no hits
 * @param options - limit and minimum score
 * @returns hits sorted by score descending
 */
export function searchExercises(query: string, options: SearchOptions = {}): SearchHit[] {
  const normalized = searchNormalize(query);
  if (normalized === '') return [];
  const tokens = normalized.split(' ').filter((t) => t !== '');
  const limit = options.limit ?? 50;
  const minScore = options.minScore ?? 1;

  const hits: SearchHit[] = collectHits(normalized, tokens, minScore);

  // Zero-hit retry on the singular form. Only ever a fallback: if the query as
  // typed matched anything at all, those hits stand unmodified.
  if (hits.length === 0) {
    const singular = depluralize(tokens);
    if (singular !== null) {
      hits.push(...collectHits(singular.join(' '), singular, minScore));
    }
  }

  hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const lengthDiff = a.exercise.name.length - b.exercise.name.length;
    if (lengthDiff !== 0) return lengthDiff;
    return a.exercise.id < b.exercise.id ? -1 : a.exercise.id > b.exercise.id ? 1 : 0;
  });
  return hits.slice(0, Math.max(0, limit));
}

/**
 * Every exercise that trains a muscle group, heaviest contribution first.
 *
 * Accepts either one of the 21 group ids or one of the 74 anatomical muscle
 * ids; a muscle id is resolved to its parent group, because the contribution
 * vectors the app stores are per group.
 *
 * @param group - a `MuscleGroupId` or a `MuscleId`
 * @returns a frozen-by-convention array; callers must not mutate it
 */
export function exercisesByMuscle(group: MuscleGroupId | MuscleId): readonly SeedExercise[] {
  const key = Object.prototype.hasOwnProperty.call(MUSCLES, group)
    ? MUSCLES[group as MuscleId].group
    : (group as MuscleGroupId);
  return BY_GROUP.get(key) ?? [];
}

/**
 * The share of `group` that `exercise` trains, 0 when it does not train it.
 * Exists so a caller does not have to remember that `groupWeights` is partial.
 */
export function contributionOf(exercise: SeedExercise, group: MuscleGroupId): number {
  return exercise.groupWeights[group] ?? 0;
}
