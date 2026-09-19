import { describe, expect, it } from 'vitest';

import { ARCHETYPES, type ArchetypeId } from './archetypes';
import { EQUIPMENT, type EquipmentId } from './equipment';
import { MUSCLES, type MuscleId } from './muscles';
import {
  MOVEMENTS,
  canonicalName,
  deriveSlug,
  lintCanonicalName,
  normalizedKey,
  variantSignature,
  type KnownMovementId,
} from './naming';
import { MOVEMENT_PATTERNS, weightIsPerLimb } from './patterns';
import { SEED_EXERCISES, SEED_EXERCISE_COUNT } from './seed';
import { TRACKING_TYPES } from './types';

/** The floor the product plan commits to for the first shipped catalog. */
const MINIMUM_CATALOG_SIZE = 240;

describe('catalog size', () => {
  it(`ships at least ${MINIMUM_CATALOG_SIZE} exercises`, () => {
    expect(SEED_EXERCISE_COUNT).toBeGreaterThanOrEqual(MINIMUM_CATALOG_SIZE);
    expect(SEED_EXERCISES).toHaveLength(SEED_EXERCISE_COUNT);
  });

  it('covers every major training area', () => {
    const groupsCovered = new Set<string>();
    for (const exercise of SEED_EXERCISES) {
      for (const group of Object.keys(exercise.groupWeights)) groupsCovered.add(group);
    }
    for (const required of [
      'chest', 'lats', 'upper_back', 'traps', 'lower_back', 'front_delts', 'side_delts',
      'rear_delts', 'biceps', 'triceps', 'forearms', 'abs', 'obliques', 'quads',
      'hamstrings', 'glutes', 'adductors', 'abductors', 'calves', 'neck',
    ]) {
      expect(groupsCovered.has(required), `no exercise trains ${required}`).toBe(true);
    }
  });
});

describe('identity', () => {
  it('has a unique id on every row', () => {
    const seen = new Map<string, number>();
    for (const exercise of SEED_EXERCISES) {
      seen.set(exercise.id, (seen.get(exercise.id) ?? 0) + 1);
    }
    const duplicates = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id);
    expect(duplicates).toEqual([]);
  });

  it('has a unique display name on every row', () => {
    const seen = new Map<string, string[]>();
    for (const exercise of SEED_EXERCISES) {
      const bucket = seen.get(exercise.name);
      if (bucket === undefined) seen.set(exercise.name, [exercise.id]);
      else bucket.push(exercise.id);
    }
    const duplicates = [...seen.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([name, ids]) => `${name}: ${ids.join(' / ')}`);
    expect(duplicates).toEqual([]);
  });

  it('has a unique normalized key on every row', () => {
    const seen = new Map<string, string[]>();
    for (const exercise of SEED_EXERCISES) {
      const bucket = seen.get(exercise.normalizedKey);
      if (bucket === undefined) seen.set(exercise.normalizedKey, [exercise.id]);
      else bucket.push(exercise.id);
    }
    const duplicates = [...seen.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([key, ids]) => `${key}: ${ids.join(' / ')}`);
    expect(duplicates).toEqual([]);
  });

  it('has a unique identity tuple, which is what the database indexes', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const exercise of SEED_EXERCISES) {
      const { movementId, equipmentId, loadMode } = exercise.components;
      const tuple = [movementId, equipmentId, loadMode, exercise.variantSignature].join('|');
      if (seen.has(tuple)) duplicates.push(tuple);
      seen.add(tuple);
    }
    expect(duplicates).toEqual([]);
  });

  it('derives id, slug, name and key from the components rather than storing them', () => {
    const offenders: string[] = [];
    for (const exercise of SEED_EXERCISES) {
      if (exercise.slug !== deriveSlug(exercise.components)) offenders.push(`${exercise.id} slug`);
      if (exercise.id !== exercise.slug) offenders.push(`${exercise.id} id != slug`);
      if (exercise.name !== canonicalName(exercise.components).name) {
        offenders.push(`${exercise.id} name`);
      }
      if (exercise.normalizedKey !== normalizedKey(exercise.name)) {
        offenders.push(`${exercise.id} normalizedKey`);
      }
      if (exercise.variantSignature !== variantSignature(exercise.components.variants)) {
        offenders.push(`${exercise.id} variantSignature`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('passes the orthography lint on every generated name', () => {
    const offenders: string[] = [];
    for (const exercise of SEED_EXERCISES) {
      const problems = lintCanonicalName(exercise.name);
      if (problems.length > 0) offenders.push(`${exercise.id}: ${problems.join('; ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('never overflows the name into a subtitle it cannot display', () => {
    const offenders = SEED_EXERCISES.filter((e) => canonicalName(e.components).overflows);
    expect(offenders.map((e) => e.name)).toEqual([]);
  });
});

describe('every referenced enum member exists', () => {
  it('movement', () => {
    const offenders = SEED_EXERCISES.filter(
      (e) => MOVEMENTS[e.components.movementId as KnownMovementId] === undefined,
    );
    expect(offenders.map((e) => `${e.id}: ${e.components.movementId}`)).toEqual([]);
  });

  it('equipment', () => {
    const offenders = SEED_EXERCISES.filter(
      (e) => EQUIPMENT[e.components.equipmentId as EquipmentId] === undefined,
    );
    expect(offenders.map((e) => `${e.id}: ${e.components.equipmentId}`)).toEqual([]);
  });

  it('archetype', () => {
    const offenders = SEED_EXERCISES.filter(
      (e) => ARCHETYPES[e.archetype as ArchetypeId] === undefined,
    );
    expect(offenders.map((e) => `${e.id}: ${e.archetype}`)).toEqual([]);
  });

  it('movement pattern', () => {
    const offenders = SEED_EXERCISES.filter((e) => MOVEMENT_PATTERNS[e.pattern] === undefined);
    expect(offenders.map((e) => `${e.id}: ${e.pattern}`)).toEqual([]);
  });

  it('tracking type', () => {
    const offenders = SEED_EXERCISES.filter((e) => !TRACKING_TYPES.includes(e.tracking));
    expect(offenders.map((e) => `${e.id}: ${e.tracking}`)).toEqual([]);
  });

  it('muscle', () => {
    const offenders: string[] = [];
    for (const exercise of SEED_EXERCISES) {
      for (const muscle of [...exercise.primaryMuscles, ...exercise.secondaryMuscles]) {
        if (MUSCLES[muscle as MuscleId] === undefined) {
          offenders.push(`${exercise.id}: ${muscle}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('logging semantics', () => {
  it('derives weightIsPerLimb from limbMode and never by hand', () => {
    const offenders = SEED_EXERCISES.filter(
      (e) => e.weightIsPerLimb !== weightIsPerLimb(e.limbMode),
    );
    expect(offenders.map((e) => e.id)).toEqual([]);
  });

  it('gives every bodyweight-tracked row a measured bodyweight factor or none at all', () => {
    const offenders: string[] = [];
    for (const exercise of SEED_EXERCISES) {
      if (exercise.bwFactor === null) continue;
      if (exercise.bwFactor <= 0 || exercise.bwFactor > 1) {
        offenders.push(`${exercise.id}: bwFactor ${exercise.bwFactor}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('never puts a bodyweight factor on a row loaded purely externally', () => {
    const external = new Set(['weight_reps', 'duration_weight', 'weight_distance']);
    const offenders = SEED_EXERCISES.filter(
      (e) => external.has(e.tracking) && e.bwFactor !== null,
    );
    expect(offenders.map((e) => e.id)).toEqual([]);
  });

  it('uses an assisted or weighted load mode exactly where the tracking says so', () => {
    const offenders: string[] = [];
    for (const exercise of SEED_EXERCISES) {
      const { loadMode } = exercise.components;
      if (exercise.tracking === 'assisted_bodyweight' && loadMode !== 'assisted') {
        offenders.push(`${exercise.id}: assisted tracking, loadMode ${loadMode}`);
      }
      if (loadMode === 'assisted' && exercise.tracking !== 'assisted_bodyweight') {
        offenders.push(`${exercise.id}: assisted loadMode, tracking ${exercise.tracking}`);
      }
      if (exercise.tracking === 'weighted_bodyweight' && loadMode !== 'weighted') {
        offenders.push(`${exercise.id}: weighted tracking, loadMode ${loadMode}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('content', () => {
  it('gives every row two to four instruction lines', () => {
    const offenders = SEED_EXERCISES.filter(
      (e) => e.instructions.length < 2 || e.instructions.length > 4,
    );
    expect(offenders.map((e) => `${e.id}: ${e.instructions.length}`)).toEqual([]);
  });

  it('writes instruction lines as sentences, not fragments or essays', () => {
    const offenders: string[] = [];
    for (const exercise of SEED_EXERCISES) {
      for (const line of exercise.instructions) {
        if (line.length < 15 || line.length > 120) offenders.push(`${exercise.id}: "${line}"`);
        if (!line.endsWith('.')) offenders.push(`${exercise.id}: unpunctuated "${line}"`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('carries the canonical name as its own first alias', () => {
    const offenders = SEED_EXERCISES.filter(
      (e) => !e.aliases.includes(e.name.toLowerCase()),
    );
    expect(offenders.map((e) => e.id)).toEqual([]);
  });

  it('points every standards reference at a row that exists', () => {
    const ids = new Set(SEED_EXERCISES.map((e) => e.id));
    const offenders: string[] = [];
    for (const exercise of SEED_EXERCISES) {
      const ref = exercise.standards;
      if (ref === null) continue;
      if (!ids.has(ref.parentId)) offenders.push(`${exercise.id} -> ${ref.parentId}`);
      if (ref.ratio <= 0 || ref.ratio > 3) offenders.push(`${exercise.id} ratio ${ref.ratio}`);
    }
    expect(offenders).toEqual([]);
  });

  it('flags every row as lacking media, because the art pipeline has not run', () => {
    const offenders = SEED_EXERCISES.filter(
      (e) => e.media.length > 0 || !e.qaFlags.includes('no_media'),
    );
    expect(offenders.map((e) => e.id)).toEqual([]);
  });

  it('marks every seeded row as an active catalog row', () => {
    const offenders = SEED_EXERCISES.filter(
      (e) => e.status !== 'active' || e.origin !== 'catalog',
    );
    expect(offenders.map((e) => e.id)).toEqual([]);
  });
});
