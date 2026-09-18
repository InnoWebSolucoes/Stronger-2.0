/**
 * Structural and scale invariants for the token set.
 *
 * Colour accessibility lives in `contrast.test.ts`; this file guards the things
 * that break silently — a token added to one theme and not the other, a scale
 * that stops being monotonic, a hex typo.
 */

import { describe, expect, it } from 'vitest';
import {
  TIERS,
  borderWidth,
  darkTheme,
  layout,
  lightTheme,
  opacity,
  radius,
  space,
  themes,
  zIndex,
  type Theme,
} from './tokens';

/** Walks an object and yields every `path -> value` leaf. */
function leaves(value: unknown, path = ''): [string, unknown][] {
  if (value === null || typeof value !== 'object') return [[path, value]];
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  }
  return Object.entries(value).flatMap(([k, v]) => leaves(v, path === '' ? k : `${path}.${k}`));
}

const HEX = /^#[0-9A-F]{6}$/;
const RGBA = /^rgba\(\d{1,3},\d{1,3},\d{1,3},(0|1|0?\.\d+)\)$/;

describe('theme structure', () => {
  it('exposes both themes by name', () => {
    expect(themes.dark).toBe(darkTheme);
    expect(themes.light).toBe(lightTheme);
    expect(darkTheme.isDark).toBe(true);
    expect(lightTheme.isDark).toBe(false);
  });

  it('the two themes have identical shapes, so neither can drift', () => {
    // This is the whole reason `Theme` is an explicit interface rather than
    // `typeof darkTheme`: the compiler catches a missing token, and this
    // catches a token that was added to one theme's object literal only.
    const darkPaths = leaves(darkTheme).map(([p]) => p).sort();
    const lightPaths = leaves(lightTheme).map(([p]) => p).sort();
    expect(lightPaths).toEqual(darkPaths);
  });

  it('the two themes actually differ — a copy-paste would be worse than a gap', () => {
    const darkValues = new Map(leaves(darkTheme));
    let differing = 0;
    for (const [path, value] of leaves(lightTheme)) {
      if (darkValues.get(path) !== value) differing += 1;
    }
    expect(differing).toBeGreaterThan(40);
  });
});

describe.each([
  ['dark', darkTheme],
  ['light', lightTheme],
] as readonly (readonly [string, Theme])[])('%s theme values', (_name: string, theme: Theme) => {
  it('every colour token is a 6-digit uppercase hex or a well-formed rgba()', () => {
    const colourPaths = leaves(theme).filter(
      ([path, value]) =>
        typeof value === 'string' &&
        !path.endsWith('.css') &&
        !path.endsWith('name') &&
        !path.includes('.glow.') &&
        !path.startsWith('elevation.'),
    );
    expect(colourPaths.length).toBeGreaterThan(50);
    for (const [path, value] of colourPaths) {
      const s = String(value);
      expect(HEX.test(s) || RGBA.test(s) || s === 'transparent', `${path} = ${s}`).toBe(true);
    }
  });

  it('defines exactly four categorical series and no more', () => {
    expect(theme.viz.categorical).toHaveLength(4);
    expect(new Set(theme.viz.categorical).size).toBe(4);
  });

  it('defines a 7-step heat ramp and a 6-step activity ramp, all distinct', () => {
    expect(theme.viz.heat).toHaveLength(7);
    expect(new Set(theme.viz.heat).size).toBe(7);
    expect(theme.viz.activity).toHaveLength(6);
    expect(new Set(theme.viz.activity).size).toBe(6);
  });

  it('covers all five rank tiers with distinct colours', () => {
    const colours = TIERS.map((t) => theme.tier[t]);
    expect(colours).toHaveLength(5);
    expect(new Set(colours).size).toBe(5);
  });

  it('derives every elevation css string from its own layers', () => {
    const steps = [
      theme.elevation.none,
      theme.elevation.e1,
      theme.elevation.e2,
      theme.elevation.e3,
      theme.elevation.e4,
      theme.record.glow,
    ];
    for (const step of steps) {
      if (step.layers.length === 0) {
        expect(step.css).toBe('none');
      } else {
        expect(step.css.split(', ')).toHaveLength(step.layers.length);
        expect(step.css).toContain('px');
      }
    }
  });

  it('raises elevation monotonically by blur', () => {
    const blur = (e: { layers: readonly { blur: number }[] }): number =>
      e.layers.reduce((max, l) => Math.max(max, l.blur), 0);
    expect(blur(theme.elevation.none)).toBe(0);
    expect(blur(theme.elevation.e1)).toBeLessThan(blur(theme.elevation.e2));
    expect(blur(theme.elevation.e2)).toBeLessThan(blur(theme.elevation.e3));
    expect(blur(theme.elevation.e3)).toBeLessThan(blur(theme.elevation.e4));
  });

  it('uses an edge highlight on dark and none on light', () => {
    if (theme.isDark) {
      expect(theme.edgeHighlight.width).toBe(1);
      expect(theme.edgeHighlight.css).toContain('inset');
    } else {
      expect(theme.edgeHighlight.width).toBe(0);
      expect(theme.edgeHighlight.css).toBe('none');
    }
  });

  it('keeps amber as a solid fill reserved for brand, warning and record', () => {
    // The rule the research calls out: if any other component ships a solid
    // amber background, "filled amber = personal record" stops meaning anything.
    const amberFills = new Set([theme.brand.fill, theme.warning.fill, theme.record.fill]);
    expect(amberFills.has(theme.action.fill)).toBe(false);
    expect(amberFills.has(theme.positive.fill)).toBe(false);
    expect(amberFills.has(theme.negative.fill)).toBe(false);
  });
});

describe('scales', () => {
  it('spacing is strictly increasing from zero', () => {
    const values = Object.values(space);
    expect(values[0]).toBe(0);
    for (let i = 1; i < values.length; i += 1) {
      const a = values[i - 1];
      const b = values[i];
      if (a === undefined || b === undefined) continue;
      expect(b).toBeGreaterThan(a);
    }
  });

  it('spacing stays on a 2px grid', () => {
    for (const v of Object.values(space)) expect(v % 2).toBe(0);
  });

  it('radius is strictly increasing and ends in a pill', () => {
    const values = Object.values(radius);
    for (let i = 1; i < values.length; i += 1) {
      const a = values[i - 1];
      const b = values[i];
      if (a === undefined || b === undefined) continue;
      expect(b).toBeGreaterThan(a);
    }
    expect(radius.pill).toBeGreaterThan(1000);
  });

  it('card radius stays smaller than sheet radius, so nesting stays alignable', () => {
    expect(radius.sm).toBeLessThan(radius.md);
    expect(radius.md).toBeLessThan(radius.lg);
    expect(radius.lg).toBeLessThan(radius.xl);
  });

  it('every touch target reaches the 44dp minimum', () => {
    expect(layout.hitTarget).toBe(44);
    expect(layout.rowH).toBeGreaterThanOrEqual(layout.hitTarget);
    expect(layout.rowHSet).toBeGreaterThanOrEqual(layout.hitTarget);
    expect(layout.tabbarH).toBeGreaterThanOrEqual(layout.hitTarget);
  });

  it('gutters are dense, not template-sized', () => {
    expect(layout.gutter).toBe(16);
    expect(layout.stackGap).toBeLessThan(layout.gutter);
    expect(layout.cardPad).toBeLessThan(layout.gutter);
  });

  it('border widths start at zero and rise', () => {
    expect(borderWidth.none).toBe(0);
    expect(borderWidth.hairline).toBeLessThan(borderWidth.thin);
    expect(borderWidth.thin).toBeLessThan(borderWidth.thick);
    expect(borderWidth.ringSm).toBeLessThan(borderWidth.ring);
  });

  it('z-index layers are ordered and leave room between steps', () => {
    const values = Object.values(zIndex);
    for (let i = 1; i < values.length; i += 1) {
      const a = values[i - 1];
      const b = values[i];
      if (a === undefined || b === undefined) continue;
      expect(b - a).toBeGreaterThanOrEqual(10);
    }
    expect(zIndex.modal).toBeGreaterThan(zIndex.toast);
    expect(zIndex.restTimer).toBeGreaterThan(zIndex.tabbar);
  });

  it('opacity values stay in range and never fully hide a control', () => {
    for (const v of Object.values(opacity)) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});
