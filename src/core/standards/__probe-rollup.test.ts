import { it } from 'vitest';
import { rollupMuscles, solveMuscleScores } from './muscle-rollup';
import { overallStanding, rankFromScore, aggregatePatternZ } from './rank';

it('probe', () => {
  const cold = rollupMuscles({ observations: [{ exerciseId: 'bench_press', z: 2.6, tau: 0.28, ageDays: 0 }], experience: 'never' });
  console.log('COLD', cold.muscles.filter(m => m.state !== 'insufficient_data').map(m => [m.muscle, m.state, m.z.toFixed(2), m.sdZ.toFixed(2), m.label]));
  console.log('COLD summary', cold.explanation);
  const chest = cold.muscles.find(m => m.muscle === 'chest');
  console.log('CHEST', chest?.state, chest?.z, chest?.sdZ, chest?.evidenceMass, chest?.explanation);
  const calves = cold.muscles.find(m => m.muscle === 'calves');
  console.log('CALVES', calves?.state, calves?.sdZ.toFixed(3), calves?.suggestedExerciseId, calves?.explanation);

  const tri = rollupMuscles({ observations: [
    { exerciseId: 'bench_press', z: 1.0, tau: 0.28 },
    { exerciseId: 'dip', z: 1.4, tau: 0.32 },
    { exerciseId: 'tricep_pushdown', z: 1.6, tau: 0.42 },
    { exerciseId: 'overhead_tricep_ext', z: 1.5, tau: 0.42 },
    { exerciseId: 'back_squat', z: 0.8, tau: 0.28 },
    { exerciseId: 'deadlift', z: 0.9, tau: 0.28 },
    { exerciseId: 'barbell_row', z: 0.7, tau: 0.28 },
    { exerciseId: 'pull_up', z: 0.6, tau: 0.32 },
    { exerciseId: 'overhead_press', z: 0.8, tau: 0.28 },
  ], experience: '2_5y' });
  for (const m of tri.muscles) console.log('TRI', m.muscle, m.state, m.z.toFixed(2), m.sdZ.toFixed(3), m.label, m.evidenceMass.toFixed(2), m.directExercises.length);
  console.log('TRI summary', tri.explanation, tri.strongest, tri.biggestOpportunity);
  const t = tri.muscles.find(m => m.muscle === 'triceps');
  console.log('TRICEPS explanation:', t?.explanation);

  const fresh = solveMuscleScores([{ exerciseId: 'tricep_pushdown', z: 2.0, tau: 0.42, ageDays: 0 }], { mu0: -0.5, sigma0: 1.1 });
  const stale = solveMuscleScores([{ exerciseId: 'tricep_pushdown', z: 2.0, tau: 0.42, ageDays: 400 }], { mu0: -0.5, sigma0: 1.1 });
  console.log('FRESH/STALE', fresh.theta.triceps.toFixed(3), fresh.thetaSd.triceps.toFixed(3), stale.theta.triceps.toFixed(3), stale.thetaSd.triceps.toFixed(3));

  console.log('RANK27', JSON.stringify(rankFromScore(27)));
  console.log('AGG1', JSON.stringify(aggregatePatternZ({ horizontal_press: 1.5 })));
  console.log('AGG6', JSON.stringify(aggregatePatternZ({ squat: 1, hinge: 1, horizontal_press: 1, vertical_press: 1, horizontal_pull: 1, vertical_pull: 1 })));
  const one = overallStanding({ patterns: [{ pattern: 'horizontal_press', z: 3.0, tau: 0.28 }], experience: 'never' });
  console.log('ONESET', one.state, one.z.toFixed(3), one.score.toFixed(2), one.rank.label, one.displayLabel, one.rangeLabels, one.sdZ.toFixed(3));
  const oneNoExp = overallStanding({ patterns: [{ pattern: 'horizontal_press', z: 3.5, tau: 0.28 }] });
  console.log('ONESET-NOEXP', oneNoExp.state, oneNoExp.score.toFixed(2), oneNoExp.rank.label);
  const full = overallStanding({ patterns: [
    { pattern: 'squat', z: 2.0, tau: 0.2 }, { pattern: 'hinge', z: 2.1, tau: 0.2 },
    { pattern: 'horizontal_press', z: 2.0, tau: 0.2 }, { pattern: 'vertical_press', z: 1.9, tau: 0.2 },
    { pattern: 'horizontal_pull', z: 2.0, tau: 0.2 }, { pattern: 'vertical_pull', z: 2.0, tau: 0.2 },
  ], experience: '5y_plus' });
  console.log('FULL', full.state, full.z.toFixed(3), full.score.toFixed(2), full.rank.label, full.sdZ.toFixed(3), full.percentile.label);
});
