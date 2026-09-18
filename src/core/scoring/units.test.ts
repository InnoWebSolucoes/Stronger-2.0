import { describe, expect, it } from 'vitest';

import {
  DISPLAY_STEP,
  EQUIPMENT_INCREMENT_KG,
  EQUIPMENT_INCREMENT_LB,
  KG_TO_LB,
  LB_TO_KG,
  convert,
  equipmentIncrement,
  formatVolume,
  formatWeight,
  fromInput,
  fromKg,
  kgToLb,
  lbToKg,
  roundTo,
  roundToEquipmentIncrement,
  toDisplay,
} from './units';

describe('conversion factor', () => {
  it('uses the exact international avoirdupois pound', () => {
    expect(LB_TO_KG).toBe(0.45359237);
    expect(KG_TO_LB).toBeCloseTo(2.2046226218487757, 12);
  });

  it('converts the research brief worked example: 225 lb -> 102.05828325 kg', () => {
    expect(lbToKg(225)).toBe(225 * 0.45359237);
    expect(lbToKg(225)).toBeCloseTo(102.05828325, 8);
  });

  it('converts a 20 kg bar to 44.09 lb', () => {
    expect(kgToLb(20)).toBeCloseTo(44.0924524, 6);
  });

  it('is an identity when from === to', () => {
    expect(convert(137.5, 'kg', 'kg')).toBe(137.5);
    expect(convert(137.5, 'lb', 'lb')).toBe(137.5);
  });
});

describe('no drift under repeated round-tripping', () => {
  it('does not accumulate error across a thousand kg -> lb -> kg round trips', () => {
    // Exactness is impossible in IEEE 754: lbToKg(kgToLb(60)) is one ULP low.
    // What must hold is that the error is bounded and reaches a fixed point,
    // so repeated conversion can never walk a stored weight away from itself.
    for (const original of [100, 102.05828325, 2.5, 60, 227.5, 0.25]) {
      const once = lbToKg(kgToLb(original));

      let value = original;
      for (let i = 0; i < 1000; i += 1) {
        value = lbToKg(kgToLb(value));
      }

      // A thousand round trips land exactly where one did — the fixed point.
      expect(value).toBe(once);
      // And that fixed point is within one ULP of the original.
      const ulp = Math.abs(original) * Number.EPSILON;
      expect(Math.abs(value - original)).toBeLessThanOrEqual(ulp);
    }
  });

  it('returns the original value after a thousand lb -> kg -> lb round trips', () => {
    for (const original of [45, 225, 315, 2.5]) {
      let value = original;
      for (let i = 0; i < 1000; i += 1) {
        value = kgToLb(lbToKg(value));
      }
      expect(value).toBe(original);
    }
  });

  it('renders the literal the user typed, unchanged, forever', () => {
    // 225 lb entered -> stored 102.05828325 kg -> displayed as "225 lb" always.
    const w = fromInput(225, 'lb');
    expect(w.kg).toBe(102.05828325);
    for (let i = 0; i < 1000; i += 1) {
      expect(toDisplay(w, 'lb')).toBe(225);
    }
  });

  it('never re-derives the canonical kg from a rounded display value', () => {
    const w = fromInput(102.5, 'kg');
    const shown = toDisplay(w, 'lb'); // 226.0 lb, rounded for display
    expect(shown).toBe(226);
    // The stored value is untouched by having been displayed in pounds.
    expect(toDisplay(w, 'kg')).toBe(102.5);
    expect(w.kg).toBe(102.5);
  });
});

describe('display rounding', () => {
  it('rounds 100 kg to 220.5 lb (research brief worked example)', () => {
    expect(toDisplay(fromInput(100, 'kg'), 'lb')).toBe(220.5);
  });

  it('uses 0.25 kg and 0.5 lb display steps', () => {
    expect(DISPLAY_STEP.kg).toBe(0.25);
    expect(DISPLAY_STEP.lb).toBe(0.5);
  });

  it('survives binary-float dust', () => {
    expect(roundTo(2.675, 0.01)).toBe(2.68);
    expect(roundTo(1.005, 0.01)).toBe(1.01);
    expect(roundTo(220.46226218487757, 0.5)).toBe(220.5);
  });

  it('rounds half away from zero and keeps zero unsigned', () => {
    expect(roundTo(0.125, 0.25)).toBe(0.25);
    expect(roundTo(-0.125, 0.25)).toBe(-0.25);
    expect(roundTo(-0.1, 0.25)).toBe(0);
    expect(Object.is(roundTo(-0.1, 0.25), -0)).toBe(false);
  });

  it('returns NaN for nonsense input rather than a plausible lie', () => {
    expect(roundTo(Number.NaN, 0.25)).toBeNaN();
    expect(roundTo(10, 0)).toBeNaN();
    expect(roundTo(10, -1)).toBeNaN();
  });

  it('handles a computed weight with no user literal', () => {
    const w = fromKg(102.05828325);
    expect(toDisplay(w, 'kg')).toBe(102.05828325);
    expect(toDisplay(w, 'lb')).toBe(225);
  });
});

describe('formatting', () => {
  it('formats a weight in the unit asked for', () => {
    expect(formatWeight(fromInput(225, 'lb'), 'lb')).toBe('225 lb');
    expect(formatWeight(fromInput(100, 'kg'), 'lb')).toBe('220.5 lb');
    expect(formatWeight(fromInput(102.5, 'kg'), 'kg')).toBe('102.5 kg');
  });

  it('rounds an aggregate exactly once, at the edge', () => {
    // Four sets of 999.9 kg: rounding per set would give 4,000; rounding the
    // total gives 3,999 - and the total is the honest number.
    const total = 999.9 * 4;
    expect(formatVolume(total, 'kg')).toBe('4,000 kg');
    expect(formatVolume(3999.4, 'kg')).toBe('3,999 kg');
  });

  it('shows an em dash rather than 0 for a missing aggregate', () => {
    expect(formatVolume(Number.NaN, 'kg')).toBe('— kg');
  });
});

describe('per-equipment rounding increments', () => {
  it('declares imperial increments natively, not converted from kg', () => {
    // 2.5 kg converts to 5.51 lb, which no gym has. The lb table says 5 lb.
    expect(EQUIPMENT_INCREMENT_KG.BARBELL).toBe(2.5);
    expect(EQUIPMENT_INCREMENT_LB.BARBELL).toBe(5);
    expect(EQUIPMENT_INCREMENT_KG.MACHINE_STACK).toBe(5);
    expect(EQUIPMENT_INCREMENT_LB.MACHINE_STACK).toBe(10);
    expect(equipmentIncrement('DUMBBELL', 'kg')).toBe(2.5);
    expect(equipmentIncrement('DUMBBELL', 'lb')).toBe(5);
  });

  it('rounds a prescription DOWN by default', () => {
    // Overshooting costs a failed rep; undershooting costs nothing.
    expect(roundToEquipmentIncrement(115.5, 'BARBELL')).toBe(115);
    expect(roundToEquipmentIncrement(116.2, 'BARBELL')).toBe(115);
    expect(roundToEquipmentIncrement(117.5, 'BARBELL')).toBe(117.5);
  });

  it('can round up or to nearest when asked', () => {
    expect(roundToEquipmentIncrement(115.5, 'BARBELL', 'kg', 'up')).toBe(117.5);
    expect(roundToEquipmentIncrement(115.5, 'BARBELL', 'kg', 'nearest')).toBe(115);
    expect(roundToEquipmentIncrement(116.5, 'BARBELL', 'kg', 'nearest')).toBe(117.5);
    expect(roundToEquipmentIncrement(117.5, 'BARBELL', 'kg', 'up')).toBe(117.5);
  });

  it('snaps in pounds for an imperial gym and returns exact kilograms', () => {
    // 100 kg = 220.46 lb -> floors to 220 lb -> exactly 220 lb in kg.
    const kg = roundToEquipmentIncrement(100, 'BARBELL', 'lb');
    expect(kgToLb(kg)).toBeCloseTo(220, 9);
    expect(kg).toBe(220 * LB_TO_KG);
  });

  it('gives bodyweight a fine increment', () => {
    expect(roundToEquipmentIncrement(80.3, 'BODYWEIGHT', 'kg', 'nearest')).toBe(80.5);
  });

  it('returns NaN for a non-finite weight', () => {
    expect(roundToEquipmentIncrement(Number.NaN, 'BARBELL')).toBeNaN();
  });
});
