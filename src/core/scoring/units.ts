/**
 * Units: kilogram/pound conversion, display rounding, and per-equipment
 * rounding increments.
 *
 * THE RULE (AGENTS.md, "Weights are stored in kg as the canonical unit"):
 * every weight in `src/core` is kilograms. Conversion happens once, at the
 * render edge. A stored value is NEVER round-trip converted.
 *
 * The drift-free design: a `Weight` carries both the exact canonical kg AND
 * the literal value+unit the user typed. `toDisplay()` returns the literal
 * whenever the display unit matches the entry unit, so "225 lb" reads back as
 * exactly 225 lb forever — no matter how many times it is rendered.
 *
 * Source: research brief §0 "UNITS" and §"An imperial plate inventory stored as
 * rounded kg silently corrupts every PR comparison".
 */

import type { EquipmentKind } from './types';

/**
 * International avoirdupois pound, exact by definition.
 * Source: NIST Handbook 44 / 1959 international yard-and-pound agreement.
 */
export const LB_TO_KG = 0.45359237;

/** Reciprocal of {@link LB_TO_KG} = 2.2046226218487757… */
export const KG_TO_LB = 1 / LB_TO_KG;

/** The two units the app can display. Storage is always kg. */
export type Unit = 'kg' | 'lb';

/** Pounds → kilograms, exact factor, no rounding. */
export function lbToKg(lb: number): number {
  return lb * LB_TO_KG;
}

/**
 * Kilograms → pounds, exact factor, no rounding.
 *
 * Implemented as `kg / LB_TO_KG` rather than `kg * KG_TO_LB`, because
 * multiplying by a pre-computed reciprocal introduces a second rounding.
 *
 * The guarantee this buys is NOT exactness — `lbToKg(kgToLb(60)) !== 60` in
 * IEEE 754, it is one ULP low. The guarantee is that the error does not
 * ACCUMULATE: the value reaches its fixed point after a single round trip and
 * stays there forever. A thousand round trips land in exactly the same place
 * as one, so a user toggling kg/lb repeatedly can never walk a stored weight
 * away from its true value. See units.test.ts.
 */
export function kgToLb(kg: number): number {
  return kg / LB_TO_KG;
}

/** Convert between units without any rounding. */
export function convert(value: number, from: Unit, to: Unit): number {
  if (from === to) return value;
  return from === 'lb' ? lbToKg(value) : kgToLb(value);
}

/**
 * A canonical weight.
 *
 * `kg` is the single source of truth for all math. `enteredValue`/`enteredUnit`
 * preserve exactly what the user typed so display in their own unit is a
 * lookup, not a conversion. Never re-derive `kg` from a rounded display string.
 */
export interface Weight {
  /** Canonical kilograms, full precision. */
  kg: number;
  /** Exactly what the user typed. */
  enteredValue: number;
  /** The unit they typed it in. */
  enteredUnit: Unit;
}

/** Build a {@link Weight} from what the user typed. */
export function fromInput(value: number, unit: Unit): Weight {
  return {
    kg: unit === 'kg' ? value : lbToKg(value),
    enteredValue: value,
    enteredUnit: unit,
  };
}

/** Build a {@link Weight} from a computed kilogram value (no user literal). */
export function fromKg(kg: number): Weight {
  return { kg, enteredValue: kg, enteredUnit: 'kg' };
}

/**
 * Finest increment worth showing in each unit. Never finer than a gym can
 * actually produce: 0.25 kg micro-plates and 0.5 lb are the smallest real
 * loadable steps in circulation.
 */
export const DISPLAY_STEP: Record<Unit, number> = { kg: 0.25, lb: 0.5 };

/**
 * Half-away-from-zero rounding to an arbitrary step, free of binary-float dust.
 *
 * `Math.round(2.675 * 100) / 100` gives 2.67 because 2.675 is stored as
 * 2.67499999999999982…; the relative nudge below absorbs that without ever
 * shifting a value that is genuinely below the midpoint.
 *
 * Returns NaN for a non-finite input or a non-positive step.
 */
export function roundTo(value: number, step: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) {
    return Number.NaN;
  }
  const inv = 1 / step;
  const scaled = Math.abs(value) * inv;
  const nudge = Math.max(scaled, 1) * 1e-12;
  const out = Math.round(scaled + nudge) / inv;
  if (out === 0) return 0;
  return value < 0 ? -out : out;
}

/**
 * The number to render for a weight in a given unit.
 *
 * Returns the user's own literal untouched when the display unit matches the
 * entry unit — this is what makes repeated round-tripping drift-free by
 * construction. Otherwise converts with the exact factor and rounds once to
 * `step` (default {@link DISPLAY_STEP}).
 *
 * Worked example (research brief): 100 kg entered → 220.5 lb displayed.
 */
export function toDisplay(weight: Weight, unit: Unit, step = DISPLAY_STEP[unit]): number {
  if (unit === weight.enteredUnit) return weight.enteredValue;
  const raw = unit === 'kg' ? weight.kg : kgToLb(weight.kg);
  return roundTo(raw, step);
}

/** `"102.5 kg"` / `"225 lb"`. Trailing zeros trimmed. */
export function formatWeight(weight: Weight, unit: Unit, step = DISPLAY_STEP[unit]): string {
  const value = toDisplay(weight, unit, step);
  return `${trimNumber(value)} ${unit}`;
}

/**
 * Format an aggregate (session volume, weekly tonnage) for display.
 *
 * Rounds EXACTLY ONCE, here at the edge — never per set — so a 4,000 kg session
 * cannot become 3,999 kg through accumulated rounding.
 */
export function formatVolume(kg: number, unit: Unit): string {
  if (!Number.isFinite(kg)) return `— ${unit}`;
  const value = unit === 'kg' ? kg : kgToLb(kg);
  return `${Math.round(value).toLocaleString('en-US')} ${unit}`;
}

/**
 * Smallest weight change each equipment family can express, in KILOGRAMS.
 *
 * Derived from the default inventories shipped in `plates.ts`: a barbell moves
 * in 2 × the smallest plate pair a normal gym stocks (2 × 1.25 kg = 2.5 kg);
 * metric selectorised stacks step in 5 kg; bodyweight (which is really the
 * lifter's own mass, or a dip-belt) steps in 0.5 kg.
 *
 * This is the TYPING/stepper increment. For an actual prescription, use
 * `roundToEquipment()` in `plates.ts`, which consults the real inventory —
 * including micro-plates when a gym has them.
 */
export const EQUIPMENT_INCREMENT_KG: Record<EquipmentKind, number> = {
  BARBELL: 2.5,
  SMITH: 2.5,
  EZ_BAR: 2.5,
  TRAP_BAR: 2.5,
  PLATE_LOADED: 2.5,
  DUMBBELL: 2.5,
  MACHINE_STACK: 5,
  CABLE: 2.5,
  BODYWEIGHT: 0.5,
  BAND: 0.5,
};

/**
 * Smallest weight change each equipment family can express, in POUNDS.
 *
 * Declared natively in pounds rather than converted from the kg table: an
 * imperial gym's smallest pair is 2.5 lb (⇒ 5 lb on the bar) and its stacks
 * step in 10 lb. Converting 2.5 kg would produce 5.5 lb, which no gym has.
 */
export const EQUIPMENT_INCREMENT_LB: Record<EquipmentKind, number> = {
  BARBELL: 5,
  SMITH: 5,
  EZ_BAR: 5,
  TRAP_BAR: 5,
  PLATE_LOADED: 5,
  DUMBBELL: 5,
  MACHINE_STACK: 10,
  CABLE: 5,
  BODYWEIGHT: 1,
  BAND: 1,
};

/** The stepper increment for an equipment family, expressed in `unit`. */
export function equipmentIncrement(kind: EquipmentKind, unit: Unit): number {
  return unit === 'kg' ? EQUIPMENT_INCREMENT_KG[kind] : EQUIPMENT_INCREMENT_LB[kind];
}

/** Which way to break a tie when snapping a weight onto an increment. */
export type RoundingBias = 'down' | 'nearest' | 'up';

/**
 * Snap a kilogram value onto an equipment family's increment.
 *
 * Defaults to rounding DOWN: overshooting a prescription costs a failed rep,
 * undershooting costs nothing (research brief, "Round computed prescriptions
 * DOWN to the nearest loadable weight by default").
 *
 * When `unit` is `'lb'` the snap happens in pounds and the result is converted
 * back with the exact factor, so an imperial gym gets imperial steps.
 */
export function roundToEquipmentIncrement(
  kg: number,
  kind: EquipmentKind,
  unit: Unit = 'kg',
  bias: RoundingBias = 'down',
): number {
  if (!Number.isFinite(kg)) return Number.NaN;
  const increment = equipmentIncrement(kind, unit);
  const value = unit === 'kg' ? kg : kgToLb(kg);
  const snapped = snap(value, increment, bias);
  return unit === 'kg' ? snapped : lbToKg(snapped);
}

function snap(value: number, increment: number, bias: RoundingBias): number {
  if (increment <= 0) return value;
  // Divide to find the step count and MULTIPLY to rebuild the value: every
  // increment the app ships (0.5, 1, 2.5, 5, 10) is exactly representable in
  // binary, so `n * increment` is exact, while `n / (1 / increment)` is not
  // (1/5 is inexact, and 44 / 0.2 lands on 219.99999999999997).
  const steps = value / increment;
  // Absorb float dust so a value that is mathematically an exact multiple does
  // not floor one step too low.
  const dust = Math.max(Math.abs(steps), 1) * 1e-12;
  let n: number;
  if (bias === 'down') n = Math.floor(steps + dust);
  else if (bias === 'up') n = Math.ceil(steps - dust);
  else n = Math.round(steps + dust);
  return n * increment;
}

/** `12.50` → `"12.5"`, `100` → `"100"`. Display helper, never used in math. */
function trimNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return String(Math.round(value * 1000) / 1000);
}
