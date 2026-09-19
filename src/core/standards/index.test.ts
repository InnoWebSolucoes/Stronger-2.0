import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { AGE_SEX_METHODOLOGY } from './age-sex';
import { CLASSIFY_METHODOLOGY } from './classify';
import * as standards from './index';
import { STANDARDS_METHODOLOGY, methodologyFor } from './index';
import { INTERPOLATE_METHODOLOGY } from './interpolate';
import { MUSCLE_ROLLUP_METHODOLOGY } from './muscle-rollup';
import { PERCENTILE_METHODOLOGY } from './percentile';
import { RANK_METHODOLOGY } from './rank';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('the standards barrel', () => {
  it('exports the whole engine from one entry point', () => {
    for (const name of [
      'STANDARDS',
      'STANDARDS_META',
      'MUSCLE_CONTRIBUTIONS',
      'RANK_LADDER',
      'getStandard',
      'requireStandard',
      'anchorsAtBodyweight',
      'ageFactor',
      'percentileWithConfidence',
      'classifyLift',
      'levelPosition',
      'scoreFromZ',
      'rankFromScore',
      'overallStanding',
      'smoothDisplayScore',
      'rollupMuscles',
      'solveMuscleScores',
      'muscleState',
      'bestProbeFor',
      'STANDARDS_METHODOLOGY',
      'methodologyFor',
    ]) {
      expect(name in standards, `barrel is missing ${name}`).toBe(true);
    }
  });

  it('loses nothing to a name collision between modules', () => {
    const sources = [
      INTERPOLATE_METHODOLOGY,
      AGE_SEX_METHODOLOGY,
      PERCENTILE_METHODOLOGY,
      CLASSIFY_METHODOLOGY,
      RANK_METHODOLOGY,
      MUSCLE_ROLLUP_METHODOLOGY,
    ];
    let counted = 0;
    const keys = new Set<string>();
    for (const map of sources) {
      for (const key of Object.keys(map)) {
        counted += 1;
        keys.add(key);
      }
    }
    expect(keys.size, 'two modules publish a methodology under the same key').toBe(counted);
    expect(Object.keys(STANDARDS_METHODOLOGY).length).toBe(counted);
  });

  it('answers the disclosure lookup Apple Guideline 1.4.1 requires', () => {
    const note = methodologyFor('rollupMuscles');
    expect(note?.summary.length ?? 0).toBeGreaterThan(30);
    expect(note?.url ?? '').toMatch(/^https?:\/\//);
    expect(methodologyFor('nothing_computes_this')).toBeUndefined();
  });

  it('publishes a summary, a source and a URL for every disclosed calculation', () => {
    for (const [key, note] of Object.entries(STANDARDS_METHODOLOGY)) {
      expect(note.summary.length, key).toBeGreaterThan(20);
      expect(note.source.length, key).toBeGreaterThan(5);
      expect(note.url, key).toMatch(/^https?:\/\//);
    }
  });
});

describe('src/core purity', () => {
  it('imports nothing from react, react-native or expo anywhere in the module', () => {
    const files = readdirSync(HERE).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      const source = readFileSync(join(HERE, file), 'utf8');
      const imports = source.match(/from\s+'([^']+)'/g) ?? [];
      for (const imported of imports) {
        expect(imported, `${file} must not import a platform module`).not.toMatch(
          /'(react|react-native|react-dom|expo(-[a-z-]+)?|@react-navigation\/.*)'/,
        );
      }
    }
  });

  it('runs under plain node with no global clock or randomness in the module', () => {
    const files = readdirSync(HERE).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    for (const file of files) {
      const source = readFileSync(join(HERE, file), 'utf8');
      expect(source, `${file} must take time as a parameter`).not.toMatch(/Date\.now\(\)|new Date\(\)/);
      expect(source, `${file} must not use randomness`).not.toMatch(/Math\.random\(\)/);
    }
  });
});
