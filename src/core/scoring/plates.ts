/**
 * Plate math: what to actually hang on the bar.
 *
 * Given a target weight, a bar and a plate inventory, return the per-side
 * loading and — when the target is not exactly loadable — the achievable weight
 * nearest to it.
 *
 * THE INVENTORY RULE, learned the hard way: declare plates and bars in their
 * NATIVE unit and derive kilograms with the exact factor 0.45359237. Storing a
 * 45 lb plate as a pre-rounded 20.4117 kg makes a 225 lb bench read back as
 * 224.99994 lb, and every PR comparison against a stored 225 lb then flips on
 * floating-point dust.
 *
 * The solver is greedy (largest plate first). Greedy subset-sum is not optimal
 * in general, but it is provably optimal for the inventories shipped here — the
 * test suite brute-forces every reachable combination from 20 to 300 kg in
 * 0.25 kg steps and proves greedy equals exhaustive. Keep that test in CI: it
 * is the guard for the day someone adds an exotic plate set.
 *
 * Source: research brief §8 "PLATE MATH".
 */

import { round3 } from './stats';
import type { EquipmentKind } from './types';
import { LB_TO_KG, type RoundingBias } from './units';

export type { EquipmentKind } from './types';

/** `[plate weight, pairs available]`. A "pair" is one plate for each side. */
export type PlatePair = readonly [weightKg: number, pairs: number];

/**
 * Stock metric plate inventory, per side counted in pairs.
 *
 * Source: research brief §8 `DEFAULT_KG_PLATES` — the set the brute-force
 * optimality proof was run against.
 */
export const DEFAULT_KG_PLATES: readonly PlatePair[] = [
  [25, 4],
  [20, 4],
  [15, 2],
  [10, 2],
  [5, 2],
  [2.5, 2],
  [1.25, 2],
  [1, 1],
  [0.5, 1],
  [0.25, 1],
];

/**
 * A typical commercial metric gym: no micro-plates below 1.25 kg. Smallest
 * change on the bar is therefore 2.5 kg.
 */
export const COMMERCIAL_KG_PLATES: readonly PlatePair[] = [
  [25, 4],
  [20, 4],
  [15, 2],
  [10, 2],
  [5, 2],
  [2.5, 2],
  [1.25, 2],
];

/**
 * Stock imperial plate inventory in POUNDS. Never converted and stored; see the
 * inventory rule at the top of this file.
 */
export const DEFAULT_LB_PLATES: readonly PlatePair[] = [
  [45, 4],
  [35, 2],
  [25, 2],
  [10, 4],
  [5, 2],
  [2.5, 2],
];

/** The same imperial inventory, derived to kg with the exact factor. */
export const DEFAULT_LB_PLATES_KG: readonly PlatePair[] = DEFAULT_LB_PLATES.map(
  ([lb, pairs]) => [lb * LB_TO_KG, pairs] as const,
);

/** A 45 lb bar in exact kilograms (20.4116566…). */
export const LB_BAR_KG = 45 * LB_TO_KG;

/**
 * Bar weights in kilograms.
 *
 * Smith machine values are PLACEHOLDER DEFAULTS ONLY: counterbalanced
 * commercial machines have an effective bar weight of roughly 7–11 kg and
 * uncounterbalanced ones 20 kg or more, with no standard. Ask the user once per
 * gym — silently assuming 20 kg inflates every Smith lift by up to 13 kg.
 *
 * Source: research brief §"Smith machine bar weight is not knowable".
 */
export const BAR_WEIGHTS_KG = {
  olympic_mens: 20,
  olympic_womens: 15,
  standard: 10,
  ez_curl: 7.5,
  trap_bar: 25,
  safety_squat: 25,
  swiss_bar: 17.5,
  technique_bar: 7.5,
  smith_counterbalanced: 7,
  smith_uncounterbalanced: 20,
} as const;

/**
 * Discrete dumbbells on a typical commercial rack, kg.
 * Source: research brief §8 `DEFAULT_DUMBBELL_RACK_KG`.
 */
export const DEFAULT_DUMBBELL_RACK_KG: readonly number[] = [
  1, 2, 3, 4, 5, 6, 7.5, 8, 9, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40,
  42.5, 45, 47.5, 50, 55, 60, 65, 70, 75, 80,
];

/** One piece of equipment, as configured for a specific gym. */
export interface EquipmentProfile {
  kind: EquipmentKind;
  /** Bar weight, kg. 20 men's / 15 women's / 7.5 EZ / 25 trap; Smith varies. */
  barKg?: number;
  /** Plate inventory as `[kg, pairs]`. Defaults to {@link DEFAULT_KG_PLATES}. */
  platePairsKg?: readonly PlatePair[];
  /** Selectorised stack step, kg. */
  stackIncrementKg?: number;
  /** Micro-plates that sit on top of a stack, kg. */
  addOnPlatesKg?: readonly number[];
  /** Discrete dumbbells available, kg. */
  dumbbellRackKg?: readonly number[];
  /** Fallback increment for bodyweight/band work, kg. */
  smallestIncrementKg?: number;
}

/** A loading solution for one target. */
export interface PlateSolution {
  /** What the bar will actually weigh, kg. */
  totalKg: number;
  /** Plates on ONE side, heaviest first, kg. */
  perSide: number[];
  /** `target − total`, kg. Positive = short of target, negative = over. */
  residualKg: number;
  /** True when the target was hit exactly. */
  exact: boolean;
}

const EPS = 1e-9;

function inventoryOf(profile: EquipmentProfile): PlatePair[] {
  const inventory = profile.platePairsKg ?? DEFAULT_KG_PLATES;
  return inventory
    .filter(([kg, pairs]) => Number.isFinite(kg) && kg > 0 && pairs > 0)
    .map(([kg, pairs]) => [kg, Math.floor(pairs)] as PlatePair)
    .sort((a, b) => b[0] - a[0]);
}

/**
 * Heaviest loadable weight at or below `targetKg`, and the plates to get there.
 *
 * Greedy, largest plate first, over a FINITE inventory. Units: kg in, kg out.
 * A target below the bar returns the bare bar with a negative residual.
 *
 * Source: research brief §8 `solvePlates`.
 */
export function solvePlates(targetKg: number, profile: EquipmentProfile): PlateSolution {
  const bar = profile.barKg ?? 0;
  if (!Number.isFinite(targetKg)) {
    return { totalKg: bar, perSide: [], residualKg: Number.NaN, exact: false };
  }

  let perSideRemaining = (targetKg - bar) / 2;
  if (perSideRemaining < -EPS) {
    return {
      totalKg: bar,
      perSide: [],
      residualKg: round3(targetKg - bar),
      exact: Math.abs(targetKg - bar) < EPS,
    };
  }

  const perSide: number[] = [];
  for (const [plateKg, pairs] of inventoryOf(profile)) {
    let used = 0;
    while (used < pairs && perSideRemaining >= plateKg - EPS) {
      perSide.push(plateKg);
      perSideRemaining -= plateKg;
      used += 1;
    }
  }

  let loaded = 0;
  for (const plate of perSide) loaded += plate;
  const totalKg = bar + 2 * loaded;
  return {
    totalKg,
    perSide,
    residualKg: round3(targetKg - totalKg),
    exact: Math.abs(targetKg - totalKg) < 1e-6,
  };
}

/** Heaviest weight this profile can possibly load, kg. */
export function maxLoadableKg(profile: EquipmentProfile): number {
  const bar = profile.barKg ?? 0;
  let perSide = 0;
  for (const [plateKg, pairs] of inventoryOf(profile)) perSide += plateKg * pairs;
  return bar + 2 * perSide;
}

/**
 * Lightest loadable weight strictly above `targetKg`, or null if the inventory
 * cannot reach past it.
 *
 * Walks up from the greedy solution in {@link smallestIncrementKg} steps and
 * re-solves; because greedy is exhaustive-equivalent for the shipped
 * inventories, the first solution that clears the target is the smallest one.
 *
 * Units: kg in, kg out.
 */
export function nextLoadableAbove(
  targetKg: number,
  profile: EquipmentProfile,
): PlateSolution | null {
  const step = smallestIncrementKg(profile);
  if (!Number.isFinite(step) || step <= 0) return null;
  const ceiling = maxLoadableKg(profile);
  if (targetKg >= ceiling - EPS) return null;

  const down = solvePlates(targetKg, profile);
  let probe = down.totalKg;
  for (let i = 0; i < 512; i += 1) {
    probe += step;
    if (probe > ceiling + step) break;
    const solution = solvePlates(Math.min(probe, ceiling), profile);
    if (solution.totalKg > targetKg + 1e-6) return solution;
  }
  return null;
}

/**
 * The achievable loading NEAREST the target — the answer the plate screen shows
 * when the requested weight cannot be hit exactly.
 *
 * Compares the greedy solution at or below the target with the first loadable
 * weight above it and returns whichever is closer; ties go DOWN, because
 * overshooting a prescription costs a failed rep and undershooting costs
 * nothing. Units: kg in, kg out.
 *
 * Source: research brief §8 and §"Round computed prescriptions DOWN".
 */
export function nearestPlateSolution(
  targetKg: number,
  profile: EquipmentProfile,
): PlateSolution {
  const down = solvePlates(targetKg, profile);
  if (down.exact) return down;
  const up = nextLoadableAbove(targetKg, profile);
  if (up === null) return down;
  const downDistance = Math.abs(targetKg - down.totalKg);
  const upDistance = Math.abs(up.totalKg - targetKg);
  return upDistance < downDistance - 1e-9 ? up : down;
}

/**
 * Smallest weight change this setup can express, kg — the step for the ± button.
 *
 * For anything plate-loaded it is twice the smallest available plate (plates go
 * on in pairs). For dumbbells it is the smallest gap in the rack. For a stack
 * it is the smallest add-on plate, or the stack increment when there are none.
 *
 * Source: research brief §8 `smallestIncrementKg`.
 */
export function smallestIncrementKg(profile: EquipmentProfile): number {
  switch (profile.kind) {
    case 'BARBELL':
    case 'SMITH':
    case 'EZ_BAR':
    case 'TRAP_BAR':
    case 'PLATE_LOADED': {
      const inventory = inventoryOf(profile);
      let smallest = Number.POSITIVE_INFINITY;
      for (const [plateKg] of inventory) smallest = Math.min(smallest, plateKg);
      return Number.isFinite(smallest) ? 2 * smallest : Number.NaN;
    }
    case 'DUMBBELL': {
      const rack = sortedRack(profile);
      let smallest = Number.POSITIVE_INFINITY;
      for (let i = 1; i < rack.length; i += 1) {
        const hi = rack[i];
        const lo = rack[i - 1];
        if (hi === undefined || lo === undefined) continue;
        smallest = Math.min(smallest, hi - lo);
      }
      return Number.isFinite(smallest) ? smallest : Number.NaN;
    }
    case 'MACHINE_STACK':
    case 'CABLE': {
      const addOns = profile.addOnPlatesKg ?? [];
      if (addOns.length > 0) return Math.min(...addOns);
      return profile.stackIncrementKg ?? 5;
    }
    case 'BODYWEIGHT':
    case 'BAND':
    default:
      return profile.smallestIncrementKg ?? 0.5;
  }
}

/**
 * Round a computed prescription (e.g. "82.5% of your e1RM") onto something the
 * lifter can physically load.
 *
 * Defaults to `'down'`: overshooting costs a failed rep, undershooting costs
 * nothing. Units: kg in, kg out.
 *
 * Source: research brief §8 `roundToEquipment`.
 */
export function roundToEquipment(
  targetKg: number,
  profile: EquipmentProfile,
  bias: RoundingBias = 'down',
): number {
  switch (profile.kind) {
    case 'BARBELL':
    case 'SMITH':
    case 'EZ_BAR':
    case 'TRAP_BAR':
    case 'PLATE_LOADED': {
      if (bias === 'nearest') return nearestPlateSolution(targetKg, profile).totalKg;
      const down = solvePlates(targetKg, profile);
      if (bias === 'down' || down.exact) return down.totalKg;
      return nextLoadableAbove(targetKg, profile)?.totalKg ?? down.totalKg;
    }
    case 'DUMBBELL': {
      const rack = sortedRack(profile);
      if (rack.length === 0) return targetKg;
      const first = rack[0] ?? targetKg;
      const last = rack[rack.length - 1] ?? targetKg;
      let below = first;
      let above = last;
      for (const d of rack) {
        if (d <= targetKg + EPS) below = d;
      }
      const found = rack.find((d) => d >= targetKg - EPS);
      above = found ?? last;
      if (bias === 'down') return below;
      if (bias === 'up') return above;
      return targetKg - below <= above - targetKg ? below : above;
    }
    case 'MACHINE_STACK':
    case 'CABLE': {
      const increment = profile.stackIncrementKg ?? 5;
      return snapTo(targetKg, increment, bias);
    }
    case 'BODYWEIGHT':
    case 'BAND':
    default: {
      const increment = profile.smallestIncrementKg ?? 0.5;
      return snapTo(targetKg, increment, bias);
    }
  }
}

function sortedRack(profile: EquipmentProfile): number[] {
  const rack = profile.dumbbellRackKg ?? DEFAULT_DUMBBELL_RACK_KG;
  return [...rack].filter((d) => Number.isFinite(d)).sort((a, b) => a - b);
}

function snapTo(value: number, increment: number, bias: RoundingBias): number {
  if (!Number.isFinite(value) || increment <= 0) return value;
  // Divide to count steps, multiply to rebuild: see the note in `units.ts`.
  const steps = value / increment;
  const dust = Math.max(Math.abs(steps), 1) * 1e-12;
  const n =
    bias === 'down'
      ? Math.floor(steps + dust)
      : bias === 'up'
        ? Math.ceil(steps - dust)
        : Math.round(steps + dust);
  return n * increment;
}

/**
 * Human-readable per-side loading: `"25 + 15"`, or `"bar only"`.
 * Display helper — never used in math.
 */
export function formatPerSide(solution: PlateSolution): string {
  if (solution.perSide.length === 0) return 'bar only';
  return solution.perSide.map((p) => String(Math.round(p * 1000) / 1000)).join(' + ');
}
