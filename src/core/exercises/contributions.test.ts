import { describe, expect, it } from 'vitest';

import {
  AUTHORING_TOLERANCE,
  CONTRIBUTION_TOLERANCE,
  accumulateGroupWeights,
  buildContribution,
  dominantGroup,
  groupWeightsFromShares,
  isNormalizedVector,
  normalizeShares,
  scaleGroupWeights,
  sumGroupWeights,
  sumShares,
  toDistribution,
  validateGroupWeights,
  validateShares,
  type MuscleShares,
} from './contributions';
import { MUSCLES, type MuscleGroupId, type MuscleId } from './muscles';
import { SEED_EXERCISES } from './seed';

describe('validateShares', () => {
  it('accepts a vector that already sums to one', () => {
    expect(validateShares({ pec_major_sternal: 0.6, triceps_long_head: 0.4 })).toEqual([]);
  });

  it('rejects an empty vector', () => {
    expect(validateShares({})).toHaveLength(1);
  });

  it('rejects a vector whose raw sum is outside the authoring tolerance', () => {
    const problems = validateShares({ pec_major_sternal: 0.06, triceps_long_head: 0.04 });
    expect(problems.join(' ')).toContain('outside 1.0');
  });

  it('accepts drift inside the authoring tolerance', () => {
    expect(validateShares({ pec_major_sternal: 0.6, triceps_long_head: 0.4 - AUTHORING_TOLERANCE / 2 }))
      .toEqual([]);
  });

  it('rejects a zero or negative share rather than silently dropping it', () => {
    const problems = validateShares({ pec_major_sternal: 1, triceps_long_head: 0 });
    expect(problems.join(' ')).toContain('omit the muscle');
  });

  it('rejects an unknown muscle id', () => {
    const problems = validateShares({ not_a_muscle: 1 } as unknown as MuscleShares);
    expect(problems.join(' ')).toContain('unknown muscle id');
  });
});

describe('normalizeShares', () => {
  it('rescales to exactly one', () => {
    const out = normalizeShares({ pec_major_sternal: 2, triceps_long_head: 1, anconeus: 1 });
    expect(Math.abs(sumShares(out) - 1)).toBeLessThanOrEqual(CONTRIBUTION_TOLERANCE);
  });

  it('drops noise below the floor and still sums to one', () => {
    const out = normalizeShares({
      pec_major_sternal: 100,
      triceps_long_head: 50,
      anconeus: 0.01,
    });
    expect(out.anconeus).toBeUndefined();
    expect(Math.abs(sumShares(out) - 1)).toBeLessThanOrEqual(CONTRIBUTION_TOLERANCE);
  });

  it('throws when there is nothing positive to scale', () => {
    expect(() => normalizeShares({})).toThrow();
  });
});

describe('groupWeightsFromShares', () => {
  it('collapses the three pec heads into one chest weight', () => {
    const weights = groupWeightsFromShares({
      pec_major_sternal: 0.4,
      pec_major_clavicular: 0.2,
      pec_major_costal: 0.1,
      triceps_long_head: 0.3,
    });
    expect(weights.chest).toBeCloseTo(0.7, 6);
    expect(weights.triceps).toBeCloseTo(0.3, 6);
    expect(isNormalizedVector(weights)).toBe(true);
  });

  it('names the heaviest group', () => {
    const weights = groupWeightsFromShares({ gluteus_maximus: 0.7, vastus_lateralis: 0.3 });
    expect(dominantGroup(weights)).toBe<MuscleGroupId>('glutes');
  });
});

describe('buildContribution', () => {
  it('throws on an invalid vector so a bad seed breaks the build', () => {
    expect(() => buildContribution({ pec_major_sternal: 0.2 }, 'bad-row')).toThrow(/bad-row/u);
  });

  it('marks the dominant group as primary and the assistors as secondary', () => {
    const built = buildContribution({
      pec_major_sternal: 0.34,
      pec_major_clavicular: 0.1,
      pec_major_costal: 0.08,
      deltoid_anterior: 0.18,
      triceps_lateral_head: 0.16,
      triceps_long_head: 0.14,
    });
    expect(built.primaryMuscles).toContain<MuscleId>('pec_major_sternal');
    expect(built.primaryMuscles).toContain<MuscleId>('pec_major_clavicular');
    expect(built.secondaryMuscles).toContain<MuscleId>('triceps_long_head');
  });

  it('never returns an empty primary list', () => {
    const built = buildContribution({
      vastus_lateralis: 0.3,
      vastus_medialis: 0.25,
      vastus_intermedius: 0.25,
      rectus_femoris: 0.2,
    });
    expect(built.primaryMuscles.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The invariant four features depend on
// ─────────────────────────────────────────────────────────────────────────────

describe('every seeded contribution vector', () => {
  it('sums to exactly 1.0 within tolerance', () => {
    const offenders: string[] = [];
    for (const exercise of SEED_EXERCISES) {
      const total = sumGroupWeights(exercise.groupWeights);
      if (Math.abs(total - 1) > CONTRIBUTION_TOLERANCE) {
        offenders.push(`${exercise.id} = ${total}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('passes the group-vector validator', () => {
    const offenders: string[] = [];
    for (const exercise of SEED_EXERCISES) {
      const problems = validateGroupWeights(exercise.groupWeights);
      if (problems.length > 0) offenders.push(`${exercise.id}: ${problems.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('only names groups that exist, with weights in (0, 1]', () => {
    const offenders: string[] = [];
    const known = new Set<string>(Object.values(MUSCLES).map((m) => m.group));
    for (const exercise of SEED_EXERCISES) {
      for (const [group, weight] of Object.entries(exercise.groupWeights)) {
        if (!known.has(group)) offenders.push(`${exercise.id}: unknown group ${group}`);
        if (weight === undefined || weight <= 0 || weight > 1) {
          offenders.push(`${exercise.id}: ${group} = ${String(weight)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('agrees with the primary and secondary muscle lists', () => {
    const offenders: string[] = [];
    for (const exercise of SEED_EXERCISES) {
      if (exercise.primaryMuscles.length === 0) offenders.push(`${exercise.id}: no primary muscle`);
      const listed = new Set<string>([...exercise.primaryMuscles, ...exercise.secondaryMuscles]);
      for (const muscle of listed) {
        const def = MUSCLES[muscle as MuscleId];
        if (def === undefined) {
          offenders.push(`${exercise.id}: unknown muscle ${muscle}`);
          continue;
        }
        if (exercise.groupWeights[def.group] === undefined) {
          offenders.push(`${exercise.id}: ${muscle} has no weight in ${def.group}`);
        }
      }
      const overlap = exercise.primaryMuscles.filter((m) =>
        exercise.secondaryMuscles.includes(m),
      );
      if (overlap.length > 0) offenders.push(`${exercise.id}: ${overlap.join(',')} listed twice`);
    }
    expect(offenders).toEqual([]);
  });
});

describe('combination helpers', () => {
  it('scales a vector without renormalising it', () => {
    const scaled = scaleGroupWeights({ chest: 0.6, triceps: 0.4 }, 1000);
    expect(sumGroupWeights(scaled)).toBeCloseTo(1000, 6);
  });

  it('accumulates weighted vectors into per-group totals', () => {
    const totals = accumulateGroupWeights([
      { weights: { chest: 0.6, triceps: 0.4 }, factor: 100 },
      { weights: { chest: 1 }, factor: 50 },
    ]);
    expect(totals.chest).toBeCloseTo(110, 6);
    expect(totals.triceps).toBeCloseTo(40, 6);
  });

  it('ignores non-positive factors', () => {
    const totals = accumulateGroupWeights([
      { weights: { chest: 1 }, factor: 0 },
      { weights: { quads: 1 }, factor: -5 },
      { weights: { chest: 1 }, factor: 10 },
    ]);
    expect(totals.quads).toBeUndefined();
    expect(totals.chest).toBeCloseTo(10, 6);
  });

  it('turns totals back into a distribution that sums to one', () => {
    const dist = toDistribution({ chest: 110, triceps: 40, quads: 50 });
    expect(isNormalizedVector(dist)).toBe(true);
  });

  it('returns an empty distribution for no work, not an even split', () => {
    expect(toDistribution({})).toEqual({});
    expect(toDistribution({ chest: 0 })).toEqual({});
  });
});
