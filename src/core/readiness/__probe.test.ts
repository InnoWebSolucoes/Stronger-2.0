import { describe, it } from 'vitest';
import { accrueSet, REFERENCE_EXERCISE_PROFILES, estimateE1rmKg, type LoggedSet, type ExerciseFatigueProfile } from './fatigue';
import { MS_PER_HOUR } from './constants';
import { emptyReadinessState, appendDeposits, readinessForMuscle } from './recovery';
import { loadModel, ewma } from './capacity';
import { weeklyTarget, volumeZone } from './recommend';

const T0 = Date.UTC(2026, 0, 5, 18, 0, 0);
function p(id: string): ExerciseFatigueProfile {
  const prof = REFERENCE_EXERCISE_PROFILES[id];
  if (!prof) throw new Error('missing ' + id);
  return prof;
}
const sum = (r: { deposits: { structural: number; metabolic: number }[] }, which: 'structural' | 'metabolic') =>
  r.deposits.reduce((a, d) => a + d[which], 0);

describe('probe2', () => {
  it('numbers', () => {
    const ctx = { e1rmByExerciseKg: { leg_extension: 90, barbell_bench_press: 120 } };
    const base: LoggedSet = { exerciseId: 'leg_extension', type: 'normal', weightKg: 70, reps: 12, rir: 0, at: T0 };
    const dropSet: LoggedSet = { ...base, type: 'drop', dropSegments: [{ weightKg: 50, reps: 8 }, { weightKg: 35, reps: 7 }] };
    const straightSameTonnage: LoggedSet = { ...base, reps: 21 };
    const n = accrueSet(base, p('leg_extension'), ctx);
    const d = accrueSet(dropSet, p('leg_extension'), ctx);
    const s = accrueSet(straightSameTonnage, p('leg_extension'), ctx);
    console.log('normal 70x12 s/m', sum(n, 'structural').toFixed(4), sum(n, 'metabolic').toFixed(4));
    console.log('drop   70x12 s/m', sum(d, 'structural').toFixed(4), sum(d, 'metabolic').toFixed(4));
    console.log('straight 70x21 s/m', sum(s, 'structural').toFixed(4), sum(s, 'metabolic').toFixed(4));
    console.log('drop/normal struct', (sum(d, 'structural') / sum(n, 'structural')).toFixed(3), 'metab', (sum(d, 'metabolic') / sum(n, 'metabolic')).toFixed(3));
    console.log('drop total vs straight total', (sum(d, 'structural') + sum(d, 'metabolic')).toFixed(3), (sum(s, 'structural') + sum(s, 'metabolic')).toFixed(3));

    const warm = accrueSet({ ...base, type: 'warmup', rir: 6 }, p('leg_extension'), ctx);
    const fail = accrueSet({ ...base, type: 'failure' }, p('leg_extension'), ctx);
    console.log('warmup s/m', sum(warm, 'structural').toFixed(4), sum(warm, 'metabolic').toFixed(4));
    console.log('failure s/m', sum(fail, 'structural').toFixed(4), sum(fail, 'metabolic').toFixed(4));
    console.log('warmup/failure struct ratio', (sum(warm, 'structural') / sum(fail, 'structural')).toFixed(4));

    console.log('e1rm 100x5', estimateE1rmKg(100, 5).toFixed(3));
    console.log('e1rm 100x5 rir2', estimateE1rmKg(100, 5, 2).toFixed(3));
    console.log('e1rm 100x1', estimateE1rmKg(100, 1).toFixed(3));
    console.log('e1rm 5x10', estimateE1rmKg(5, 10).toFixed(3));

    console.log('ref set FU', JSON.stringify(accrueSet({ exerciseId: 'leg_extension', type: 'normal', weightKg: 67.5, reps: 8, rir: 1, at: T0 }, { ...p('leg_extension'), loadedStretchIndex: 1.2 }, { e1rmByExerciseKg: { leg_extension: 90 }, familiarity: { quads: 1 } }).deposits[0]));

    // warm-up only chest, 3 sets
    const wsets = [40, 60, 80].map(w => accrueSet({ exerciseId: 'barbell_bench_press', type: 'warmup', weightKg: w, reps: 8, at: T0 }, p('barbell_bench_press'), ctx));
    let st = emptyReadinessState();
    for (const w of wsets) st = appendDeposits(st, w.deposits, [w.systemic]);
    console.log('warmup-only chest 2h', readinessForMuscle(st, 'chest', T0 + 2 * MS_PER_HOUR).pct);

    console.log('ewma([100],7)', ewma([100], 7).toFixed(4));
    const loads = Array.from({ length: 28 }, (_, i) => (i < 21 ? 100 : 200));
    console.log('loadModel', JSON.stringify(loadModel(loads)));
    console.log('weeklyTarget quads w1/w2/w3/w4/w5', [1, 2, 3, 4, 5].map(w => weeklyTarget('quads', w)).join(','));
    console.log('zones quads', [5, 6, 7, 8, 17, 18, 20, 21].map(n => `${n}:${volumeZone('quads', n)}`).join(' '));
  });
});
