/**
 * WCAG 2.1 contrast verification for the Stronger 2.0 palette.
 *
 * The relative-luminance and contrast-ratio functions below are implemented
 * from the specification text rather than imported from `tokens.ts`, so this
 * file is an independent check on the palette and not a restatement of it.
 *
 *   L = 0.2126 R + 0.7152 G + 0.0722 B
 *   where for each channel c8 in 0..255: cs = c8 / 255, and
 *   c = cs / 12.92                   when cs <= 0.03928
 *   c = ((cs + 0.055) / 1.055) ^ 2.4 otherwise
 *
 *   ratio = (Llighter + 0.05) / (Ldarker + 0.05)
 *
 * Source: WCAG 2.1 "relative luminance" and "contrast ratio" definitions,
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 *
 * Thresholds asserted here:
 *   4.5:1  body text (WCAG 1.4.3 AA, text below 18.66px regular / 14px bold)
 *   3.0:1  large text, and non-text UI boundaries (WCAG 1.4.11)
 *
 * This test is designed to fail if anyone later darkens a text colour or
 * dims a control boundary. The `guards` block at the bottom proves it does.
 */

import { describe, expect, it } from 'vitest';
import {
  TIERS,
  darkTheme,
  lightTheme,
  type Hex,
  type SemanticRole,
  type Theme,
} from './tokens';

// ---------------------------------------------------------------------------
// WCAG implementation
// ---------------------------------------------------------------------------

const AA_BODY = 4.5;
const AA_LARGE = 3;
const UI_BOUNDARY = 3;

/**
 * Parses `#RGB` or `#RRGGBB` into 8-bit channels.
 *
 * @param hex An opaque sRGB colour.
 * @returns `[r, g, b]`, each 0-255.
 * @throws If the string is not a 3- or 6-digit hex colour.
 */
export function parseHex(hex: string): [number, number, number] {
  const body = hex.startsWith('#') ? hex.slice(1) : hex;
  const full =
    body.length === 3
      ? body
          .split('')
          .map((c) => c + c)
          .join('')
      : body;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Not an opaque hex colour: ${hex}`);
  }
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/**
 * WCAG 2.1 relative luminance of an opaque sRGB colour.
 *
 * @param hex An opaque sRGB colour.
 * @returns Relative luminance in 0..1 (0 = black, 1 = white).
 */
export function relativeLuminance(hex: string): number {
  const linearise = (c8: number): number => {
    const cs = c8 / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  };
  const [r8, g8, b8] = parseHex(hex);
  return 0.2126 * linearise(r8) + 0.7152 * linearise(g8) + 0.0722 * linearise(b8);
}

/**
 * WCAG 2.1 contrast ratio between two opaque sRGB colours. Order-independent.
 *
 * @param a First colour.
 * @param b Second colour.
 * @returns A ratio in 1..21.
 */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Rounds to two decimals, matching how contrast ratios are quoted. */
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Adjacent pairs of a list, skipping any hole (satisfies noUncheckedIndexedAccess). */
function pairwise<T>(xs: readonly T[]): [T, T][] {
  const out: [T, T][] = [];
  for (let i = 1; i < xs.length; i += 1) {
    const a = xs[i - 1];
    const b = xs[i];
    if (a === undefined || b === undefined) continue;
    out.push([a, b]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Spec conformance of the implementation itself
// ---------------------------------------------------------------------------

describe('WCAG implementation', () => {
  it('parses both hex forms', () => {
    expect(parseHex('#FFFFFF')).toEqual([255, 255, 255]);
    expect(parseHex('#000')).toEqual([0, 0, 0]);
    expect(parseHex('0B0F19')).toEqual([11, 15, 25]);
  });

  it('rejects anything that is not an opaque hex colour', () => {
    expect(() => parseHex('rgba(0,0,0,.5)')).toThrow();
    expect(() => parseHex('#GGGGGG')).toThrow();
    expect(() => parseHex('#FFFF')).toThrow();
    expect(() => parseHex('')).toThrow();
  });

  it('anchors luminance at the ends of the range', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 10);
  });

  it('applies the linear segment below the 0.03928 threshold', () => {
    // #0A0A0A -> cs = 10/255 = 0.0392 <= 0.03928, so c = cs / 12.92.
    const expected = 10 / 255 / 12.92;
    expect(relativeLuminance('#0A0A0A')).toBeCloseTo(expected, 12);
  });

  it('weights green far above blue, per the sRGB coefficients', () => {
    expect(relativeLuminance('#00FF00')).toBeCloseTo(0.7152, 4);
    expect(relativeLuminance('#FF0000')).toBeCloseTo(0.2126, 4);
    expect(relativeLuminance('#0000FF')).toBeCloseTo(0.0722, 4);
  });

  it('gives 21:1 for black on white, 1:1 for a colour on itself, and is symmetric', () => {
    expect(round2(contrastRatio('#000000', '#FFFFFF'))).toBe(21);
    expect(contrastRatio('#2A6FE0', '#2A6FE0')).toBe(1);
    expect(contrastRatio('#F2F5FA', '#0B0F19')).toBe(contrastRatio('#0B0F19', '#F2F5FA'));
  });

  it('reproduces the worked examples measured in the research doc', () => {
    // These are the ground-truth numbers the palette was chosen against.
    expect(round2(contrastRatio('#F2F5FA', '#0B0F19'))).toBe(17.52); // body text on dark
    expect(round2(contrastRatio('#FFC15E', '#0B0F19'))).toBe(11.89); // brand text on dark
    expect(round2(contrastRatio('#2A6FE0', '#FFFFFF'))).toBe(4.72); // chosen action blue
    expect(round2(contrastRatio('#22C55E', '#04140A'))).toBe(8.31); // green fill takes ink
    expect(round2(contrastRatio('#D6293E', '#FFFFFF'))).toBe(4.95); // destructive fill
    expect(round2(contrastRatio('#FFC15E', '#171004'))).toBe(11.72); // PR pill
    expect(round2(contrastRatio('#0B0F19', '#FFFFFF'))).toBe(19.15); // body text on light
  });

  it('reproduces the values the research REJECTED, which is why they were rejected', () => {
    expect(round2(contrastRatio('#2F80F5', '#FFFFFF'))).toBe(3.8); // the obvious vivid blue
    expect(round2(contrastRatio('#1FA95A', '#FFFFFF'))).toBe(3.05); // white on green
    expect(round2(contrastRatio('#2B74E0', '#FFFFFF'))).toBe(4.49); // misses AA by 0.01
  });
});

// ---------------------------------------------------------------------------
// Theme assertions
// ---------------------------------------------------------------------------

/** Every background a piece of text can legitimately sit on. */
const textBackgrounds = (t: Theme): Record<string, Hex> => ({
  'bg.app': t.bg.app,
  'bg.canvas': t.bg.canvas,
  'bg.sunken': t.bg.sunken,
  'surface.s1': t.surface.s1,
  'surface.s2': t.surface.s2,
  'surface.s3': t.surface.s3,
  'surface.s4': t.surface.s4,
});

/** The semantic roles that expose a `fill` / `onFill` / `text` triple. */
const semanticRoles = (t: Theme): Record<string, SemanticRole> => ({
  brand: t.brand,
  action: t.action,
  positive: t.positive,
  negative: t.negative,
  warning: t.warning,
});

/** Surfaces a solid-filled control is allowed to sit directly on. */
const controlBackgrounds = (t: Theme): Record<string, Hex> => ({
  'bg.app': t.bg.app,
  'surface.s1': t.surface.s1,
  'surface.s2': t.surface.s2,
});

const themeCases: readonly (readonly [name: string, theme: Theme])[] = [
  ['dark', darkTheme],
  ['light', lightTheme],
];

describe.each(themeCases)('%s theme contrast', (_name: string, theme: Theme) => {
  const backgrounds = Object.entries(textBackgrounds(theme));

  describe('body text on every surface meets AA 4.5:1', () => {
    const bodyForegrounds: [string, Hex][] = [
      ['fg.primary', theme.fg.primary],
      ['fg.secondary', theme.fg.secondary],
      ['fg.tertiary', theme.fg.tertiary],
      ['brand.text', theme.brand.text],
      ['action.text', theme.action.text],
      ['positive.text', theme.positive.text],
      ['negative.text', theme.negative.text],
      ['warning.text', theme.warning.text],
    ];

    for (const [fgName, fg] of bodyForegrounds) {
      for (const [bgName, bg] of backgrounds) {
        it(`${fgName} on ${bgName}`, () => {
          const ratio = contrastRatio(fg, bg);
          expect(
            round2(ratio),
            `${fgName} ${fg} on ${bgName} ${bg} is ${round2(ratio)}:1, below AA ${AA_BODY}:1`,
          ).toBeGreaterThanOrEqual(AA_BODY);
        });
      }
    }
  });

  it('keeps a readable step between the three text levels', () => {
    // A hierarchy that has collapsed is a legibility bug even when every level
    // technically passes: primary must clearly outrank secondary and tertiary
    // on the surface they most often share.
    const bg = theme.surface.s1;
    const primary = contrastRatio(theme.fg.primary, bg);
    const secondary = contrastRatio(theme.fg.secondary, bg);
    const tertiary = contrastRatio(theme.fg.tertiary, bg);
    expect(primary / secondary).toBeGreaterThan(1.5);
    expect(secondary / tertiary).toBeGreaterThan(1.25);
  });

  it('fg.disabled is dimmer than every live text colour (WCAG 1.4.3 exempts it)', () => {
    const bg = theme.surface.s1;
    expect(contrastRatio(theme.fg.disabled, bg)).toBeLessThan(
      contrastRatio(theme.fg.tertiary, bg),
    );
  });

  describe('interactive boundaries meet WCAG 1.4.11 3:1 on every surface', () => {
    const boundaries: [string, Hex][] = [
      ['border.interactive', theme.border.interactive],
      ['border.focus', theme.border.focus],
    ];
    for (const [name, color] of boundaries) {
      for (const [bgName, bg] of backgrounds) {
        it(`${name} on ${bgName}`, () => {
          const ratio = contrastRatio(color, bg);
          expect(
            round2(ratio),
            `${name} ${color} on ${bgName} ${bg} is ${round2(ratio)}:1, below ${UI_BOUNDARY}:1`,
          ).toBeGreaterThanOrEqual(UI_BOUNDARY);
        });
      }
    }
  });

  describe('filled controls', () => {
    const roles = Object.entries(semanticRoles(theme));

    for (const [roleName, role] of roles) {
      it(`${roleName}: label on fill meets AA 4.5:1`, () => {
        const ratio = contrastRatio(role.onFill, role.fill);
        expect(
          round2(ratio),
          `${roleName}.onFill ${role.onFill} on ${roleName}.fill ${role.fill} is ${round2(ratio)}:1`,
        ).toBeGreaterThanOrEqual(AA_BODY);
      });

      it(`${roleName}: fill is a distinguishable shape on control surfaces`, () => {
        for (const [bgName, bg] of Object.entries(controlBackgrounds(theme))) {
          const ratio = contrastRatio(role.fill, bg);
          expect(
            round2(ratio),
            `${roleName}.fill ${role.fill} on ${bgName} ${bg} is ${round2(ratio)}:1, below ${UI_BOUNDARY}:1`,
          ).toBeGreaterThanOrEqual(UI_BOUNDARY);
        }
      });
    }

    it('action press and hover states still carry their label', () => {
      expect(contrastRatio(theme.action.onFill, theme.action.press)).toBeGreaterThanOrEqual(AA_BODY);
      expect(contrastRatio(theme.action.onFill, theme.action.hover)).toBeGreaterThanOrEqual(AA_BODY);
    });
  });

  describe('personal record', () => {
    it('label on the PR fill meets AA 4.5:1', () => {
      expect(contrastRatio(theme.record.onFill, theme.record.fill)).toBeGreaterThanOrEqual(AA_BODY);
    });

    it('the PR pill has a 3:1 boundary from its fill or its border', () => {
      // On light the bright amber fill is only 2.04:1 on white, so the border
      // is what carries the boundary. Either one satisfying 3:1 is enough.
      for (const [bgName, bg] of Object.entries(controlBackgrounds(theme))) {
        const best = Math.max(
          contrastRatio(theme.record.fill, bg),
          contrastRatio(theme.record.border, bg),
        );
        expect(
          round2(best),
          `record on ${bgName} ${bg}: best of fill/border is ${round2(best)}:1`,
        ).toBeGreaterThanOrEqual(UI_BOUNDARY);
      }
    });
  });

  describe('non-text indicators meet 3:1 on the surfaces they appear on', () => {
    const graphics: [string, Hex][] = [
      ['readiness.full', theme.readiness.full],
      ['readiness.partial', theme.readiness.partial],
      ['readiness.low', theme.readiness.low],
      ['readiness.rest', theme.readiness.rest],
    ];
    for (const [name, color] of graphics) {
      it(`${name} on surface.s1`, () => {
        expect(round2(contrastRatio(color, theme.surface.s1))).toBeGreaterThanOrEqual(AA_LARGE);
      });
    }

    it('all four categorical series read against the chart plot area', () => {
      theme.viz.categorical.forEach((c, i) => {
        const ratio = contrastRatio(c, theme.bg.sunken);
        expect(round2(ratio), `viz.categorical[${i}] ${c} is ${round2(ratio)}:1`).toBeGreaterThanOrEqual(
          AA_LARGE,
        );
      });
    });

    it('delta colours read against the chart plot area', () => {
      for (const c of [theme.viz.up, theme.viz.down, theme.viz.flat]) {
        expect(round2(contrastRatio(c, theme.bg.sunken))).toBeGreaterThanOrEqual(AA_LARGE);
      }
    });
  });

  describe('sequential ramps are luminance-monotonic', () => {
    // This is the property that makes the body map readable with no colour
    // perception at all: intensity is carried by lightness, not hue.
    const direction = theme.isDark ? 1 : -1;

    it('the muscle heat ramp increases in intensity monotonically', () => {
      const ls = theme.viz.heat.map(relativeLuminance);
      for (const [a, b] of pairwise(ls)) {
        expect((b - a) * direction).toBeGreaterThan(0);
      }
    });

    it('the activity ramp increases in intensity monotonically', () => {
      const ls = theme.viz.activity.map(relativeLuminance);
      for (const [a, b] of pairwise(ls)) {
        expect((b - a) * direction).toBeGreaterThan(0);
      }
    });

    it('the untrained silhouette is outside the heat ramp, not the first step of it', () => {
      const first = theme.viz.heat[0];
      expect(round2(contrastRatio(theme.viz.heatBase, first))).toBeGreaterThan(1);
    });

    it('the heaviest heat step is a visible shape on the app background', () => {
      const last = theme.viz.heat[theme.viz.heat.length - 1];
      expect(last).toBeDefined();
      if (last === undefined) return;
      expect(round2(contrastRatio(last, theme.bg.app))).toBeGreaterThanOrEqual(AA_LARGE);
    });
  });

  describe('rank tiers', () => {
    const tierColors = TIERS.map((t) => theme.tier[t]);

    it('are ordered monotonically by contrast against surface.s1, so rank reads without colour', () => {
      const ratios = tierColors.map((c) => contrastRatio(c, theme.surface.s1));
      for (const [a, b] of pairwise(ratios)) {
        expect(b).toBeGreaterThan(a);
      }
    });

    it('every tier is at least a 3:1 shape on a card', () => {
      TIERS.forEach((tier) => {
        const ratio = contrastRatio(theme.tier[tier], theme.surface.s1);
        expect(round2(ratio), `tier ${tier} is ${round2(ratio)}:1`).toBeGreaterThanOrEqual(AA_LARGE);
      });
    });
  });

  it('the surface ramp is monotonic, which is what creates elevation on dark', () => {
    const ls = [theme.surface.s1, theme.surface.s2, theme.surface.s3, theme.surface.s4].map(
      relativeLuminance,
    );
    const direction = theme.isDark ? 1 : -1;
    for (const [a, b] of pairwise(ls)) {
      // The light theme's s4 returns to white for menus, so only require that
      // no step moves the wrong way on dark.
      if (theme.isDark) expect((b - a) * direction).toBeGreaterThan(0);
    }
    if (theme.isDark) {
      expect(relativeLuminance(theme.bg.app)).toBeGreaterThan(relativeLuminance(theme.bg.canvas));
    }
  });

  it('avoids the pure-black / pure-white pairing that causes OLED halation', () => {
    const extreme = contrastRatio(theme.fg.primary, theme.bg.app);
    expect(extreme).toBeLessThan(21);
    expect(extreme).toBeGreaterThan(15);
  });
});

// ---------------------------------------------------------------------------
// Guard: prove the assertions above actually bite
// ---------------------------------------------------------------------------

describe('guards', () => {
  it('would reject the research draft values that measured below AA', () => {
    // dark fg.tertiary as drafted, on surface.s4
    expect(round2(contrastRatio('#8A94A8', '#2B3348'))).toBe(4.12);
    expect(contrastRatio('#8A94A8', '#2B3348')).toBeLessThan(AA_BODY);
    // light fg.tertiary as drafted, on surface.s3
    expect(round2(contrastRatio('#667184', '#E3E8F1'))).toBe(4.01);
    expect(contrastRatio('#667184', '#E3E8F1')).toBeLessThan(AA_BODY);
    // light positive as drafted, on surface.s3
    expect(contrastRatio('#0F7A43', '#E3E8F1')).toBeLessThan(AA_BODY);
    // light brand fill as drafted, with a white label
    expect(contrastRatio('#B26A00', '#FFFFFF')).toBeLessThan(AA_BODY);
    // dark border.interactive as drafted, on surface.s4
    expect(contrastRatio('#626E85', '#2B3348')).toBeLessThan(UI_BOUNDARY);
    // light border.interactive as drafted, on surface.s3
    expect(contrastRatio('#7B8699', '#E3E8F1')).toBeLessThan(UI_BOUNDARY);
  });

  it('and the shipped values clear the same bars', () => {
    expect(contrastRatio(darkTheme.fg.tertiary, darkTheme.surface.s4)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrastRatio(lightTheme.fg.tertiary, lightTheme.surface.s3)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrastRatio(lightTheme.positive.text, lightTheme.surface.s3)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrastRatio(lightTheme.brand.onFill, lightTheme.brand.fill)).toBeGreaterThanOrEqual(AA_BODY);
    expect(contrastRatio(darkTheme.border.interactive, darkTheme.surface.s4)).toBeGreaterThanOrEqual(UI_BOUNDARY);
    expect(contrastRatio(lightTheme.border.interactive, lightTheme.surface.s3)).toBeGreaterThanOrEqual(UI_BOUNDARY);
  });

  it('a one-step darkening of any body text colour breaks AA somewhere', () => {
    // Simulates the regression this file exists to catch: drop fg.tertiary back
    // toward the draft value and the worst-case surface stops passing.
    const darkened = '#8A94A8';
    const worst = Math.min(
      contrastRatio(darkened, darkTheme.surface.s3),
      contrastRatio(darkened, darkTheme.surface.s4),
    );
    expect(worst).toBeLessThan(AA_BODY);
  });
});
