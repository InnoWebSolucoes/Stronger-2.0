/**
 * Type-scale invariants, and the numeral rule that keeps numeric columns from
 * jittering.
 */

import { describe, expect, it } from 'vitest';
import {
  TABULAR_FEATURE,
  TYPE_ROLES,
  featureSettingsCss,
  featuresFor,
  fontAxes,
  fontFeatures,
  fonts,
  isTabular,
  numeralPolicy,
  stackFor,
  typeScale,
  weight,
  type TypeRole,
} from './typography';

describe('font stacks', () => {
  it('names a primary family and a full fallback list for each role', () => {
    for (const role of ['ui', 'display', 'mono'] as const) {
      const stack = fonts[role];
      expect(stack.stack.length).toBeGreaterThan(2);
      expect(stack.primary).toBe(stack.stack[0]);
      expect(stack.css).toContain(stack.primary);
    }
  });

  it('quotes only the family names that need quoting', () => {
    // Multi-word families are quoted; single-word and keyword families are not.
    expect(fonts.ui.css.startsWith("'Inter Variable', Inter, -apple-system")).toBe(true);
    expect(fonts.ui.css).toContain("'SF Pro Text'");
    expect(fonts.ui.css).not.toContain("'-apple-system'");
    expect(fonts.ui.css).not.toContain("'sans-serif'");
    expect(fonts.mono.css.startsWith('ui-monospace')).toBe(true);
  });

  it('falls back to system faces that all ship tabular figures', () => {
    // The numeral rule has to survive a webfont load failure, which is the
    // whole reason these three specific fallbacks are listed.
    for (const family of ['SF Pro Text', 'Segoe UI Variable Text', 'Roboto']) {
      expect(fonts.ui.stack).toContain(family);
    }
  });

  it('ends every stack in a generic family', () => {
    expect(fonts.ui.stack.at(-1)).toBe('sans-serif');
    expect(fonts.display.stack.at(-1)).toBe('sans-serif');
    expect(fonts.mono.stack.at(-1)).toBe('monospace');
  });
});

describe('OpenType features', () => {
  it('enables the Inter character variants that kill the 1 / l / I collision', () => {
    const tags = fontFeatures.map(([tag]) => tag);
    expect(tags).toContain('cv05'); // lowercase l with a tail
    expect(tags).toContain('cv08'); // uppercase I with serifs
  });

  it('leaves slashed zero off', () => {
    expect(fontFeatures.map(([tag]) => tag)).not.toContain('zero');
  });

  it('serialises to a CSS font-feature-settings value', () => {
    expect(featureSettingsCss(fontFeatures)).toBe("'cv05' 1, 'cv08' 1, 'ss03' 1, 'calt' 1");
    expect(featureSettingsCss([])).toBe('');
  });

  it('appends tnum for tabular roles only', () => {
    expect(featuresFor('numM')).toContainEqual(TABULAR_FEATURE);
    expect(featuresFor('bodyM')).not.toContainEqual(TABULAR_FEATURE);
    expect(featuresFor('bodyM')).toEqual(fontFeatures);
  });

  it('holds Archivo at the width axis the display scale was drawn for', () => {
    expect(fontAxes.displayWidth).toBe(112);
    expect(fontAxes.displayWidth).toBeGreaterThanOrEqual(62);
    expect(fontAxes.displayWidth).toBeLessThanOrEqual(125);
  });
});

describe('type scale', () => {
  it('exposes every role by name', () => {
    expect(TYPE_ROLES).toHaveLength(Object.keys(typeScale).length);
    expect(TYPE_ROLES).toContain('numM');
    expect(TYPE_ROLES).toContain('labelS');
  });

  it.each(TYPE_ROLES)('%s is internally consistent', (role: TypeRole) => {
    const style = typeScale[role];
    expect(style.size).toBeGreaterThan(0);
    // Line height at or above the size, and never more than 1.8x: looser than
    // that in a dense data UI turns a two-line exercise name into a paragraph.
    expect(style.lineHeight).toBeGreaterThanOrEqual(style.size);
    expect(style.lineHeight / style.size).toBeLessThanOrEqual(1.8);
    expect(style.weight).toBeGreaterThanOrEqual(400);
    expect(style.weight).toBeLessThanOrEqual(900);
  });

  it.each(TYPE_ROLES)('%s derives letterSpacing in dp from its em value', (role: TypeRole) => {
    const style = typeScale[role];
    const expected = Math.round(style.letterSpacingEm * style.size * 100) / 100;
    expect(style.letterSpacing).toBe(expected);
  });

  it('transcribes the research tracking values exactly', () => {
    expect(typeScale.displayXl.letterSpacingEm).toBe(-0.03);
    expect(typeScale.displayXl.letterSpacing).toBe(-1.68); // -0.030em at 56px
    expect(typeScale.titleL.letterSpacingEm).toBe(-0.012);
    expect(typeScale.titleL.letterSpacing).toBe(-0.26); // -0.012em at 22px
    expect(typeScale.labelS.letterSpacingEm).toBe(0.06);
    expect(typeScale.labelS.letterSpacing).toBe(0.66); // +0.060em at 11px
    expect(typeScale.bodyM.letterSpacing).toBe(0);
  });

  it('tightens tracking as size grows and loosens it as size shrinks', () => {
    // Optical sizing done by hand: big type needs negative tracking, 11px caps
    // need positive tracking or they set as a block.
    expect(typeScale.displayXl.letterSpacingEm).toBeLessThan(typeScale.displayS.letterSpacingEm);
    expect(typeScale.displayS.letterSpacingEm).toBeLessThan(typeScale.titleS.letterSpacingEm);
    expect(typeScale.titleS.letterSpacingEm).toBeLessThanOrEqual(0);
    expect(typeScale.labelS.letterSpacingEm).toBeGreaterThan(0);
  });

  it('is monotonic in size within each family group', () => {
    expect(typeScale.displayXl.size).toBeGreaterThan(typeScale.displayL.size);
    expect(typeScale.displayL.size).toBeGreaterThan(typeScale.displayM.size);
    expect(typeScale.displayM.size).toBeGreaterThan(typeScale.displayS.size);
    expect(typeScale.titleL.size).toBeGreaterThan(typeScale.titleM.size);
    expect(typeScale.titleM.size).toBeGreaterThan(typeScale.titleS.size);
    expect(typeScale.bodyL.size).toBeGreaterThan(typeScale.bodyM.size);
    expect(typeScale.bodyM.size).toBeGreaterThan(typeScale.bodyS.size);
    expect(typeScale.numL.size).toBeGreaterThan(typeScale.numM.size);
    expect(typeScale.numM.size).toBeGreaterThan(typeScale.numS.size);
  });

  it('never drops body copy below 13px', () => {
    for (const role of ['bodyL', 'bodyM', 'bodyS'] as const) {
      expect(typeScale[role].size).toBeGreaterThanOrEqual(13);
    }
  });

  it('uses Archivo for display, Inter for everything else, mono only for monoS', () => {
    for (const role of ['displayXl', 'displayL', 'displayM', 'displayS'] as const) {
      expect(typeScale[role].family).toBe('display');
      expect(stackFor(role)).toBe(fonts.display);
    }
    expect(typeScale.monoS.family).toBe('mono');
    const uiRoles = TYPE_ROLES.filter(
      (r) => !r.startsWith('display') && r !== 'monoS',
    );
    for (const role of uiRoles) expect(typeScale[role].family).toBe('ui');
  });

  it('reserves uppercase for the 11px eyebrow and nothing else', () => {
    const uppercase = TYPE_ROLES.filter((r) => typeScale[r].transform === 'uppercase');
    expect(uppercase).toEqual(['labelS']);
    expect(typeScale.labelS.size).toBe(11);
    // Guards against the "centred all-caps 32px heading" tell.
    for (const role of ['titleL', 'titleM', 'titleS'] as const) {
      expect(typeScale[role].transform).toBe('none');
    }
  });

  it('uses only weights declared in the weight scale', () => {
    const allowed = new Set<number>(Object.values(weight));
    for (const role of TYPE_ROLES) expect(allowed.has(typeScale[role].weight)).toBe(true);
  });
});

describe('the numeral rule', () => {
  it('makes every display and num role tabular', () => {
    for (const role of TYPE_ROLES) {
      if (role.startsWith('display') || role.startsWith('num')) {
        expect(isTabular(role), `${role} must be tabular`).toBe(true);
      }
    }
  });

  it('keeps prose roles proportional', () => {
    for (const role of ['bodyL', 'bodyM', 'bodyS', 'titleL', 'titleM', 'titleS'] as const) {
      expect(isTabular(role), `${role} must be proportional`).toBe(false);
    }
  });

  it('documents every surface where tabular figures are mandatory, with a reason', () => {
    expect(numeralPolicy.tabular.length).toBeGreaterThanOrEqual(8);
    for (const rule of numeralPolicy.tabular) {
      expect(rule.context.length).toBeGreaterThan(10);
      expect(rule.reason.length).toBeGreaterThan(30);
    }
  });

  it('names the four surfaces the research calls out by name', () => {
    const text = numeralPolicy.tabular.map((r) => r.context.toLowerCase()).join(' | ');
    expect(text).toContain('set-row');
    expect(text).toContain('stat tile');
    expect(text).toContain('rest timer');
    expect(text).toContain('numeric inputs');
  });

  it('documents where proportional figures are correct', () => {
    expect(numeralPolicy.proportional.length).toBeGreaterThanOrEqual(3);
    const text = numeralPolicy.proportional.map((r) => r.context.toLowerCase()).join(' | ');
    expect(text).toContain('prose');
  });

  it('does not list the same context on both sides', () => {
    const tabular = new Set(numeralPolicy.tabular.map((r) => r.context));
    for (const rule of numeralPolicy.proportional) {
      expect(tabular.has(rule.context)).toBe(false);
    }
  });
});
