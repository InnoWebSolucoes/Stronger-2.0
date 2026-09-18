import { describe, expect, it } from 'vitest';
import {
  ALL_MUSCLES,
  MUSCLES,
  SET_TYPE,
  W_METABOLIC,
  W_STRUCTURAL,
  W_SYS_FAST,
  W_SYS_SLOW,
  clamp,
  isMuscleId,
  muscleConstants,
  type MuscleId,
} from './constants';

describe('muscle taxonomy', () => {
  it('covers 21 muscle groups and every record key matches its id', () => {
    expect(ALL_MUSCLES).toHaveLength(21);
    for (const muscle of ALL_MUSCLES) {
      expect(MUSCLES[muscle].id).toBe(muscle);
      expect(MUSCLES[muscle].label.length).toBeGreaterThan(0);
    }
  });

  it('recognises known ids and rejects unknown ones', () => {
    expect(isMuscleId('quads')).toBe(true);
    expect(isMuscleId('soleus')).toBe(false);
    expect(isMuscleId('')).toBe(false);
    expect(isMuscleId('toString')).toBe(false);
  });

  it('muscleConstants is total over MuscleId', () => {
    for (const muscle of ALL_MUSCLES) {
      expect(muscleConstants(muscle)).toBe(MUSCLES[muscle]);
    }
  });
});

describe('recovery time constants', () => {
  // Research doc: "calves/abs 20h < forearms/obliques/neck 22h < side+rear delts 24h
  // < traps/front delts 26h < upper back/triceps 28h < chest/biceps 30h
  // < lats/adductors 32h < quads/glutes 34h < hamstrings 38h < lower back 40h"
  const expectedStructural: Record<MuscleId, number> = {
    calves: 20, abs: 20, tibialis: 20,
    forearms: 22, obliques: 22, neck: 22,
    side_delts: 24, rear_delts: 24,
    traps: 26, front_delts: 26, abductors: 26,
    upper_back: 28, triceps: 28,
    chest: 30, biceps: 30,
    lats: 32, adductors: 32,
    quads: 34, glutes: 34,
    hamstrings: 38,
    lower_back: 40,
  };

  it('transcribes the fibre-type derived tau ordering exactly', () => {
    for (const muscle of ALL_MUSCLES) {
      expect(MUSCLES[muscle].tauStructuralH).toBe(expectedStructural[muscle]);
    }
  });

  it('puts calves, forearms and abs on a faster timescale than quads, glutes and back', () => {
    const fast: MuscleId[] = ['calves', 'forearms', 'abs'];
    const slow: MuscleId[] = ['quads', 'glutes', 'lats', 'lower_back'];
    for (const f of fast) {
      for (const s of slow) {
        expect(MUSCLES[f].tauStructuralH).toBeLessThan(MUSCLES[s].tauStructuralH);
        expect(MUSCLES[f].tauMetabolicH).toBeLessThan(MUSCLES[s].tauMetabolicH);
      }
    }
  });

  it('keeps the metabolic compartment between 8h and 13h and always faster than structural', () => {
    for (const muscle of ALL_MUSCLES) {
      const m = MUSCLES[muscle];
      expect(m.tauMetabolicH).toBeGreaterThanOrEqual(8);
      expect(m.tauMetabolicH).toBeLessThanOrEqual(13);
      expect(m.tauMetabolicH).toBeLessThan(m.tauStructuralH);
    }
  });

  it('gives slow-twitch muscles a lower eccentric sensitivity than the damage-prone ones', () => {
    // Johnson 1973: soleus ~80% type I; elbow flexors are fusiform with long fascicles.
    expect(MUSCLES.calves.slowTwitchPct).toBe(80);
    expect(MUSCLES.triceps.slowTwitchPct).toBe(33);
    expect(MUSCLES.calves.eccentricSensitivity).toBeLessThan(MUSCLES.biceps.eccentricSensitivity);
    expect(MUSCLES.hamstrings.eccentricSensitivity).toBeGreaterThan(MUSCLES.chest.eccentricSensitivity);
    expect(MUSCLES.chest.eccentricSensitivity).toBe(1.0);
  });

  it('scales the minimum re-training interval with the time constant', () => {
    expect(MUSCLES.calves.minRetrainH).toBeLessThan(MUSCLES.quads.minRetrainH);
    expect(MUSCLES.lower_back.minRetrainH).toBe(48);
    for (const muscle of ALL_MUSCLES) {
      expect(MUSCLES[muscle].minRetrainH).toBeGreaterThan(0);
    }
  });
});

describe('volume landmarks', () => {
  it('is monotonic: MV <= MEV <= MAV low <= MAV high <= MRV', () => {
    for (const muscle of ALL_MUSCLES) {
      const m = MUSCLES[muscle];
      expect(m.mv).toBeLessThanOrEqual(m.mev);
      expect(m.mev).toBeLessThanOrEqual(m.mavLow);
      expect(m.mavLow).toBeLessThanOrEqual(m.mavHigh);
      expect(m.mavHigh).toBeLessThanOrEqual(m.mrv);
    }
  });

  it('matches the RP weekly hard-set table', () => {
    // Chest 8/12-20/22+, back width 8/12-20/25+, hamstrings 4/8-14/16+, front delts 0/0-6/12
    expect([MUSCLES.chest.mev, MUSCLES.chest.mavLow, MUSCLES.chest.mavHigh, MUSCLES.chest.mrv]).toEqual([8, 12, 20, 22]);
    expect([MUSCLES.lats.mev, MUSCLES.lats.mavLow, MUSCLES.lats.mavHigh, MUSCLES.lats.mrv]).toEqual([8, 12, 20, 25]);
    expect([MUSCLES.hamstrings.mev, MUSCLES.hamstrings.mavLow, MUSCLES.hamstrings.mavHigh, MUSCLES.hamstrings.mrv]).toEqual([4, 8, 14, 16]);
    expect([MUSCLES.front_delts.mev, MUSCLES.front_delts.mavHigh, MUSCLES.front_delts.mrv]).toEqual([0, 6, 12]);
    expect([MUSCLES.quads.mev, MUSCLES.quads.mrv]).toEqual([8, 20]);
  });

  it('asks for at least two sessions a week on every muscle', () => {
    for (const muscle of ALL_MUSCLES) {
      expect(MUSCLES[muscle].targetFrequency).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('set type multipliers', () => {
  it('makes a warm-up cost a fraction of a working set and earn no volume credit', () => {
    expect(SET_TYPE.warmup.structural).toBeLessThan(SET_TYPE.normal.structural * 0.2);
    expect(SET_TYPE.warmup.metabolic).toBeLessThan(SET_TYPE.normal.metabolic * 0.2);
    expect(SET_TYPE.warmup.volumeCredit).toBe(0);
  });

  it('gives failure sets BOTH a magnitude bump and a time-constant stretch', () => {
    // Vieira meta: failure elongates the recovery curve 24-48h; magnitude alone cannot do that.
    expect(SET_TYPE.failure.structural).toBeGreaterThan(SET_TYPE.normal.structural);
    expect(SET_TYPE.failure.tauStretch).toBe(1.3);
    expect(SET_TYPE.normal.tauStretch).toBe(1.0);
  });

  it('makes drop sets a metabolic cost rather than a structural one (Havers 2026)', () => {
    const metabolicSurcharge = SET_TYPE.drop.metabolic / SET_TYPE.normal.metabolic;
    const structuralSurcharge = SET_TYPE.drop.structural / SET_TYPE.normal.structural;
    expect(metabolicSurcharge).toBeGreaterThan(structuralSurcharge * 1.5);
    expect(SET_TYPE.drop.metabolic).toBeGreaterThan(SET_TYPE.failure.metabolic);
    expect(SET_TYPE.drop.structural).toBeLessThan(SET_TYPE.failure.structural);
  });

  it('gives clusters high tension but low metabolic cost', () => {
    expect(SET_TYPE.cluster.structural).toBeGreaterThan(SET_TYPE.normal.structural);
    expect(SET_TYPE.cluster.metabolic).toBeLessThan(SET_TYPE.normal.metabolic);
  });

  it('assumes a sane RIR for every set type', () => {
    for (const type of Object.values(SET_TYPE)) {
      expect(type.defaultRir).toBeGreaterThanOrEqual(0);
      expect(type.defaultRir).toBeLessThanOrEqual(10);
    }
  });
});

describe('model weights', () => {
  it('splits readiness 62/38 between the compartments and sums to one', () => {
    expect(W_STRUCTURAL).toBe(0.62);
    expect(W_METABOLIC).toBe(0.38);
    expect(W_STRUCTURAL + W_METABOLIC).toBeCloseTo(1, 10);
  });

  it('splits the systemic layer 45/55 and sums to one', () => {
    expect(W_SYS_FAST + W_SYS_SLOW).toBeCloseTo(1, 10);
  });
});

describe('clamp', () => {
  it('bounds values and maps NaN to the low bound', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
    expect(clamp(0, 0, 0)).toBe(0);
    expect(clamp(Number.NaN, 0.5, 10)).toBe(0.5);
    expect(clamp(Number.POSITIVE_INFINITY, 0, 10)).toBe(10);
    expect(clamp(Number.NEGATIVE_INFINITY, 0, 10)).toBe(0);
  });
});
