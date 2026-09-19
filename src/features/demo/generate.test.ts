import { describe, expect, it } from 'vitest';
import { generateDemoData } from './generate';
import { resolveExercise } from '@/features/exercises/source';

const NOW = Date.UTC(2026, 8, 19, 12, 0, 0);
const DAY = 86_400_000;

describe('demo data generator', () => {
  const data = generateDemoData(NOW, 34, 78.9);

  it('is deterministic — the demo account looks identical on every device', () => {
    const again = generateDemoData(NOW, 34, 78.9);
    expect(again.workouts.length).toBe(data.workouts.length);
    expect(again.workouts[0]?.volumeKg).toBe(data.workouts[0]?.volumeKg);
    expect(again.bodyweight[0]?.kg).toBe(data.bodyweight[0]?.kg);
  });

  it('produces a realistic number of sessions for 34 weeks at ~4x/week', () => {
    // 34 weeks minus one week off, minus ~8% missed, so comfortably 100–136.
    expect(data.workouts.length).toBeGreaterThan(100);
    expect(data.workouts.length).toBeLessThanOrEqual(136);
  });

  it('orders history newest first and keeps everything in the past', () => {
    for (let i = 1; i < data.workouts.length; i += 1) {
      const prev = data.workouts[i - 1];
      const curr = data.workouts[i];
      expect(prev && curr && prev.finishedAt >= curr.finishedAt).toBe(true);
    }
    expect(data.workouts[0]?.finishedAt).toBeLessThanOrEqual(NOW);
  });

  it('has session volumes in a believable range', () => {
    for (const w of data.workouts) {
      expect(w.volumeKg).toBeGreaterThan(1_000);
      expect(w.volumeKg).toBeLessThan(60_000);
      expect(w.totalReps).toBeGreaterThan(20);
      expect(w.durationSec).toBeGreaterThan(30 * 60);
      expect(w.durationSec).toBeLessThan(90 * 60);
    }
  });

  it('excludes warm-up sets from volume, as the app does', () => {
    for (const w of data.workouts.slice(0, 20)) {
      let working = 0;
      for (const ex of w.exercises) {
        for (const s of ex.sets) {
          if (s.type === 'warmup') continue;
          working += (s.weightKg ?? 0) * (s.reps ?? 0);
        }
      }
      expect(Math.round(working)).toBe(Math.round(w.volumeKg));
    }
  });

  it('shows progressive overload on the main lifts', () => {
    const topSquat = (w: (typeof data.workouts)[number]): number => {
      const squatId = resolveExercise('Back Squat (Barbell)')?.id;
      const ex = w.exercises.find((e) => e.exerciseId === squatId);
      if (!ex) return 0;
      return Math.max(...ex.sets.filter((s) => s.type !== 'warmup').map((s) => s.weightKg ?? 0));
    };

    const withSquat = data.workouts.filter((w) => topSquat(w) > 0);
    const newest = topSquat(withSquat[0] ?? data.workouts[0]!);
    const oldest = topSquat(withSquat[withSquat.length - 1] ?? data.workouts[0]!);
    // 34 weeks at ~0.8 kg/week is a big jump; allow slack for deloads and noise.
    expect(newest).toBeGreaterThan(oldest + 10);
  });

  it('contains a deliberate gap so the charts are exercised on missing data', () => {
    let biggestGapDays = 0;
    for (let i = 1; i < data.workouts.length; i += 1) {
      const newer = data.workouts[i - 1];
      const older = data.workouts[i];
      if (!newer || !older) continue;
      const gap = (newer.finishedAt - older.finishedAt) / DAY;
      if (gap > biggestGapDays) biggestGapDays = gap;
    }
    expect(biggestGapDays).toBeGreaterThan(7);
  });

  it('ends the bodyweight series at the profile weight, having lost weight overall', () => {
    const newest = data.bodyweight[0];
    const oldest = data.bodyweight[data.bodyweight.length - 1];
    expect(newest && Math.abs(newest.kg - 78.9)).toBeLessThan(1.5);
    expect(oldest && newest && oldest.kg - newest.kg).toBeGreaterThan(5);
  });

  it('does not produce an implausibly smooth cut', () => {
    // Real weigh-ins bounce. A monotonically decreasing series is the tell of
    // fabricated data, so assert at least a few upticks exist.
    let upticks = 0;
    for (let i = 1; i < data.bodyweight.length; i += 1) {
      const newer = data.bodyweight[i - 1];
      const older = data.bodyweight[i];
      if (newer && older && newer.kg > older.kg) upticks += 1;
    }
    expect(upticks).toBeGreaterThan(3);
  });
});
