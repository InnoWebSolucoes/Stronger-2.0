/**
 * Stronger 2.0 — design tokens.
 *
 * Pure TypeScript. No imports from `react`, `react-native` or `expo-*`; these
 * are plain data objects that the UI layer turns into `StyleSheet` entries.
 *
 * Structure
 *   1. `Hex` / `Color` aliases and the shared shape types.
 *   2. The `Theme` interface — the contract both themes must satisfy.
 *   3. `darkTheme` and `lightTheme`, each annotated `: Theme` so the two can
 *      never drift apart structurally. (The annotation is deliberate: an
 *      `as const` on one theme and `typeof dark` on the other makes the light
 *      theme inherit the dark theme's *literal* types, which type-checks only
 *      by accident and breaks the moment a value differs. Do not reintroduce
 *      that pattern.)
 *   4. Theme-independent scales: spacing, layout, radius, border width, z-index.
 *
 * Source: docs/research/stronger-2-0-visual-design-system-verified-dark-li.md
 * ("tokens.css (complete, verbatim)" and "Measured contrast table").
 *
 * Every ratio quoted in a comment below is a WCAG 2.1 contrast ratio computed
 * from the hex values in this file, and `contrast.test.ts` re-derives all of
 * them from scratch. If you darken a text colour, that test fails.
 *
 * Nine values differ from the research draft because the draft's own measured
 * table showed them below AA; each one is marked `FIXED:` with the old value.
 */

// ---------------------------------------------------------------------------
// 1. Value types
// ---------------------------------------------------------------------------

/** An opaque sRGB colour as `#RRGGBB`. Every contrast-tested token is one. */
export type Hex = `#${string}`;

/** Any CSS colour string, including `rgba(...)` overlays that have no ratio. */
export type Color = string;

/** One shadow layer, in density-independent pixels. */
export interface ShadowLayer {
  /** Horizontal offset, px. Positive is right. */
  readonly x: number;
  /** Vertical offset, px. Positive is down. */
  readonly y: number;
  /** Gaussian blur radius, px. */
  readonly blur: number;
  /** Spread radius, px. Used for the 1px ring on `record.glow`. */
  readonly spread: number;
  /** Layer colour, including its alpha. */
  readonly color: Color;
}

/**
 * An elevation step, given both as structured layers (for React Native, which
 * cannot parse a CSS shadow string) and as the equivalent CSS declaration.
 */
export interface Elevation {
  readonly layers: readonly ShadowLayer[];
  /** Equivalent `box-shadow` value; `'none'` when `layers` is empty. */
  readonly css: string;
}

/**
 * The 1px inset top highlight that creates "raised" on a near-black canvas.
 * A drop shadow is a darkening operation and has almost nothing left to darken
 * at #0B0F19, so cards get a simulated top light source instead. On light
 * themes this is inert (`width: 0`).
 */
export interface EdgeHighlight {
  readonly color: Color;
  /** Stroke width in px; 0 means the theme does not use an edge highlight. */
  readonly width: number;
  readonly css: string;
}

/** A filled semantic role: a solid fill, its label ink, and its quiet variants. */
export interface SemanticRole {
  /** Solid fill. Reaches >= 3:1 against bg.app, surface.s1 and surface.s2. */
  readonly fill: Hex;
  /** Label colour on top of `fill`. Reaches >= 4.5:1 against it. */
  readonly onFill: Hex;
  /** The role as text or an icon directly on a surface. >= 4.5:1 on all four. */
  readonly text: Hex;
  /** ~12-16% tinted background for rows, pills and chips. */
  readonly weak: Color;
  /** Hairline for the tinted variant, and the boundary for `fill` on sheets. */
  readonly border: Color;
}

/** The primary action role, which additionally owns press-state fills. */
export interface ActionRole extends SemanticRole {
  readonly hover: Hex;
  readonly press: Hex;
}

/**
 * Personal-record styling. Deliberately not a new hue: a record *is* the brand
 * moment, and this is the only place amber appears as a solid fill, so a filled
 * amber pill means exactly one thing in the entire product.
 */
export interface RecordRole {
  readonly fill: Hex;
  readonly onFill: Hex;
  /** Mandatory 1px boundary. On light, `fill` alone is only 2.04:1 on white. */
  readonly border: Hex;
  readonly glow: Elevation;
}

/** Strength-standard tiers, ordered weakest to strongest. */
export const TIERS = ['Beginner', 'Novice', 'Intermediate', 'Advanced', 'Elite'] as const;
export type Tier = (typeof TIERS)[number];

/** Exactly four categorical series. A fifth does not exist — see `viz.categorical`. */
export type CategoricalPalette = readonly [Hex, Hex, Hex, Hex];

/** Seven-step muscle-load ramp, index 0 = lightest load, 6 = heaviest. */
export type HeatRamp = readonly [Hex, Hex, Hex, Hex, Hex, Hex, Hex];

/** Six-step training-consistency ramp, index 0 = no activity. */
export type ActivityRamp = readonly [Hex, Hex, Hex, Hex, Hex, Hex];

/** Data-visualisation colours. Charts read only from here, never from `fg`. */
export interface VizTokens {
  /**
   * Max four series. Verified min CIELAB deltaE 29.2 protan / 20.6 deutan /
   * 22.5 tritan. A naive 7-colour dark Okabe-Ito set measures 9.0 deutan and
   * 6.0 tritan, i.e. two of the seven are the same colour to many users — any
   * chart needing more than four categories must use a sequential ramp with
   * direct labels instead of a legend.
   */
  readonly categorical: CategoricalPalette;
  /** Graphic-only positive delta. Separated from `down` by luminance (deutan deltaE 30.9). */
  readonly up: Hex;
  /** Graphic-only negative delta. */
  readonly down: Hex;
  /** No meaningful change. */
  readonly flat: Hex;
  /** Untrained muscle silhouette. Not part of `heat` — it is the "no data" fill. */
  readonly heatBase: Hex;
  /**
   * Muscle-load ramp, magma-derived and perceptually uniform. Strictly
   * luminance-monotonic, so intensity still reads with zero colour perception.
   * Bucket on 7-day tonnage per muscle normalised to the user's own trailing
   * 90-day max — global normalisation makes every beginner's body map black.
   */
  readonly heat: HeatRamp;
  /** Training-consistency heatmap, single-hue amber, bucketed by volume quintile. */
  readonly activity: ActivityRamp;
  readonly grid: Hex;
  readonly axis: Hex;
  /** Unfilled portion of rings and progress bars. */
  readonly track: Hex;
  /** Kernel-density / confidence band fill. */
  readonly band: Color;
  /** Dashed projection line. */
  readonly projection: Color;
  /** Sparkline area gradient, top stop. */
  readonly areaTop: Color;
  /** Sparkline area gradient, bottom stop (fully transparent). */
  readonly areaBottom: Color;
}

// ---------------------------------------------------------------------------
// 2. The contract
// ---------------------------------------------------------------------------

/**
 * The complete theme contract. `darkTheme` and `lightTheme` are both annotated
 * with this type, which is what stops the two from drifting: adding a token to
 * one theme without the other is a compile error, and no consumer can depend on
 * a literal hex value.
 */
export interface Theme {
  readonly name: 'dark' | 'light';
  readonly isDark: boolean;

  readonly bg: {
    /** Behind sheets and under the status bar. */
    readonly canvas: Hex;
    /** The screen background. */
    readonly app: Hex;
    /** Wells and chart plot areas. */
    readonly sunken: Hex;
    /** Modal scrim. */
    readonly scrim: Color;
  };

  /** Elevation ramp. Each step is ~1.1x the previous step's relative luminance. */
  readonly surface: {
    /** Cards, list rows. */
    readonly s1: Hex;
    /** Inputs, nested cards, set rows. */
    readonly s2: Hex;
    /** Sheets, popovers, active segment. */
    readonly s3: Hex;
    /** Menus, tooltips, toasts. */
    readonly s4: Hex;
  };

  readonly edgeHighlight: EdgeHighlight;

  readonly fg: {
    /** Headlines, values, anything the eye lands on first. */
    readonly primary: Hex;
    /** Supporting copy, units, secondary metrics. */
    readonly secondary: Hex;
    /** Eyebrows, timestamps, axis labels, empty-state line art. */
    readonly tertiary: Hex;
    /**
     * Disabled control labels. Intentionally below 4.5:1 and exempt from
     * WCAG 1.4.3, which excludes inactive components. Never use for live text.
     */
    readonly disabled: Hex;
    /** Text on an inverted surface (e.g. a light toast in the dark theme). */
    readonly inverse: Hex;
  };

  readonly border: {
    /** Card hairlines. Decorative; not a control boundary. */
    readonly subtle: Hex;
    /** Dividers between rows and metric groups. Decorative. */
    readonly default: Hex;
    /** Separators inside graphics (muscle polygons, chart frames). Decorative. */
    readonly strong: Hex;
    /**
     * The boundary of an unfilled control (secondary button, checkbox, input).
     * This one carries WCAG 1.4.11 and must stay >= 3:1 on every surface.
     */
    readonly interactive: Hex;
    /** Focus ring. >= 3:1 on every surface. */
    readonly focus: Hex;
  };

  /** Amber. The brand. Reserved for Finish, PR acknowledgement and the active tab. */
  readonly brand: SemanticRole;
  /** Blue. The only action fill in the product. */
  readonly action: ActionRole;
  /** Green. Ready, complete, positive delta. */
  readonly positive: SemanticRole;
  /** Red. Regression, destructive. */
  readonly negative: SemanticRole;
  /** Amber. Warm-up sets, rest-timer final seconds, non-blocking warnings. */
  readonly warning: SemanticRole;

  readonly record: RecordRole;

  /** Muscle readiness buckets: >= 90%, 50-89%, < 50%, and untrained. */
  readonly readiness: {
    readonly full: Hex;
    readonly partial: Hex;
    readonly low: Hex;
    readonly rest: Hex;
  };

  /**
   * Rank tier ramp. Monotonic in contrast against `surface.s1`, so the ordering
   * reads with no colour perception at all — which matters, because the ramp
   * measures only deltaE 5.4 under tritanopia. Rank is therefore NEVER encoded
   * by colour alone: every badge carries the tier name and 1-5 filled pips.
   */
  readonly tier: Readonly<Record<Tier, Hex>>;

  readonly viz: VizTokens;

  /**
   * Shadows. On dark they are reserved for genuinely floating layers (sheets,
   * menus, the rest-timer pill); cards use `surface` + `edgeHighlight` instead.
   */
  readonly elevation: {
    readonly none: Elevation;
    readonly e1: Elevation;
    readonly e2: Elevation;
    readonly e3: Elevation;
    readonly e4: Elevation;
  };
}

// ---------------------------------------------------------------------------
// 3. Helpers for building elevation values
// ---------------------------------------------------------------------------

const layerToCss = (l: ShadowLayer): string =>
  `${l.x}px ${l.y}px ${l.blur}px${l.spread === 0 ? '' : ` ${l.spread}px`} ${l.color}`;

/**
 * Builds an {@link Elevation} from its layers, deriving the CSS string so the
 * structured and string forms can never disagree.
 *
 * @param layers Shadow layers, painted in order (first layer is on top).
 * @returns The elevation token.
 */
const elevation = (...layers: readonly ShadowLayer[]): Elevation => ({
  layers,
  css: layers.length === 0 ? 'none' : layers.map(layerToCss).join(', '),
});

const NO_ELEVATION: Elevation = elevation();

// ---------------------------------------------------------------------------
// 4. Dark theme (the default)
// ---------------------------------------------------------------------------

/**
 * Dark theme. A blue-tinted near-black base (#0B0F19, hue ~222) rather than
 * pure black: #FFF on #000 measures 21:1, which causes halation on OLED and
 * reads cheap. #F2F5FA on #0B0F19 is 17.52:1 — above AAA, without the bloom.
 * The blue tint also makes the amber accent read warmer by simultaneous
 * contrast, which is free brand equity.
 *
 * Source: research doc, "tokens.css" `:root` block and the dark contrast table.
 */
export const darkTheme: Theme = {
  name: 'dark',
  isDark: true,

  bg: {
    canvas: '#070A11',
    app: '#0B0F19',
    sunken: '#0E1320',
    scrim: 'rgba(4,7,13,0.72)',
  },

  surface: {
    s1: '#121725',
    s2: '#1A2032',
    s3: '#222A3D',
    s4: '#2B3348',
  },

  edgeHighlight: {
    color: 'rgba(255,255,255,0.045)',
    width: 1,
    css: 'inset 0 1px 0 0 rgba(255,255,255,0.045)',
  },

  fg: {
    primary: '#F2F5FA', // 17.52 on bg.app, 11.51 on surface.s4
    // FIXED: research had #A7B1C4 (5.83 on surface.s4). That passes AA, but it
    // left only a 1.22x step to the corrected tertiary below, collapsing the
    // three-level hierarchy. Lightened to restore the ladder: 17.52/10.11/7.27.
    secondary: '#B4BDCC', // 10.11 on bg.app, 6.64 on surface.s4
    // FIXED: research had #8A94A8, which measures 4.12 on surface.s4 — below AA
    // for body text, and the research flagged it as a known risk. Menus and
    // toasts live on surface.s4, so the value is corrected rather than the rule.
    tertiary: '#96A0B2', // 7.27 on bg.app, 4.77 on surface.s4
    disabled: '#5C6679', // exempt: inactive controls only
    inverse: '#0B0F19',
  },

  border: {
    subtle: '#1C2333',
    default: '#252E41',
    strong: '#36405A',
    // FIXED: research had #626E85 (3.48 on surface.s1 but 2.45 on surface.s4,
    // below the 3:1 that WCAG 1.4.11 requires of a control boundary).
    interactive: '#78839A', // 3.30 on surface.s4, 4.66 on bg.app
    focus: '#6FB0FF', // 7.94 on surface.s1
  },

  brand: {
    fill: '#F5A524', // 8.76 vs surface.s1
    onFill: '#120C02', // 9.53 on fill
    text: '#FFC15E', // 11.89 on bg.app, 7.81 on surface.s4
    weak: 'rgba(245,165,36,0.14)',
    border: 'rgba(245,165,36,0.32)',
  },

  action: {
    // #2F80F5, the obvious vivid blue, measures 3.80:1 with a white label and
    // fails AA. Walking the ramp: #2B74E0 = 4.49 (misses by 0.01), this = 4.72.
    fill: '#2A6FE0',
    onFill: '#FFFFFF', // 4.72 on fill
    // FIXED: research had #3479EC, a *lighter* hover, which measures 4.12:1
    // with a white label. `fill` is already the brightest AA-compliant blue on
    // this ramp, so there is no headroom above it: the interaction states go
    // darker, which is also what the light theme does.
    hover: '#2565CE', // 5.48 on white
    press: '#205CC4', // 6.20 on white
    text: '#6FB0FF', // 8.51 on bg.app
    weak: 'rgba(42,111,224,0.16)',
    border: 'rgba(42,111,224,0.38)',
  },

  positive: {
    fill: '#22C55E',
    // Green fills take ink, not white: #1FA95A with a white label measures 3.05.
    onFill: '#04140A', // 8.31 on fill
    text: '#4ADE8B', // 11.05 on bg.app — always paired with a triangle glyph
    weak: 'rgba(34,197,94,0.15)',
    border: 'rgba(34,197,94,0.34)',
  },

  negative: {
    fill: '#D6293E',
    onFill: '#FFFFFF', // 4.95 on fill
    text: '#FF8A93', // 8.49 on bg.app — always paired with a triangle glyph
    weak: 'rgba(214,41,62,0.16)',
    border: 'rgba(214,41,62,0.36)',
  },

  warning: {
    fill: '#F5A524',
    onFill: '#120C02', // 9.53 on fill
    text: '#FFC15E', // 11.89 on bg.app
    weak: 'rgba(245,165,36,0.14)',
    border: 'rgba(245,165,36,0.32)',
  },

  record: {
    fill: '#FFC15E',
    onFill: '#171004', // 11.72 on fill
    border: '#F5A524',
    glow: elevation(
      { x: 0, y: 0, blur: 0, spread: 1, color: 'rgba(245,165,36,0.45)' },
      { x: 0, y: 4, blur: 16, spread: 0, color: 'rgba(245,165,36,0.18)' },
    ),
  },

  readiness: {
    full: '#4ADE8B',
    partial: '#F7B23B',
    low: '#E5484D',
    rest: '#626E85',
  },

  tier: {
    Beginner: '#7C8AA0', // 5.11 vs surface.s1
    Novice: '#4E9BE0', // 6.03
    Intermediate: '#2FB98C', // 7.18
    Advanced: '#F7B23B', // 9.69
    Elite: '#FFE3A3', // 14.27
  },

  viz: {
    categorical: ['#4C9DF0', '#FFC15E', '#D46FB0', '#CBD5E6'],
    up: '#5FE39B',
    down: '#E5484D',
    flat: '#7A8599',
    heatBase: '#232B3D',
    heat: ['#2C1F4A', '#5A2465', '#8E2F63', '#C24A53', '#EE7F4E', '#FCB562', '#FFE6A8'],
    activity: ['#151B29', '#43300F', '#6E4C0F', '#A5731A', '#D89A24', '#FFC15E'],
    grid: '#1E2637',
    axis: '#2A3346',
    track: '#222A3D',
    band: 'rgba(76,157,240,0.12)',
    projection: 'rgba(180,189,204,0.5)',
    areaTop: 'rgba(245,165,36,0.22)',
    areaBottom: 'rgba(245,165,36,0)',
  },

  elevation: {
    none: NO_ELEVATION,
    e1: elevation({ x: 0, y: 1, blur: 2, spread: 0, color: 'rgba(0,0,0,0.36)' }),
    e2: elevation(
      { x: 0, y: 4, blur: 12, spread: 0, color: 'rgba(0,0,0,0.44)' },
      { x: 0, y: 1, blur: 2, spread: 0, color: 'rgba(0,0,0,0.32)' },
    ),
    e3: elevation(
      { x: 0, y: 12, blur: 32, spread: 0, color: 'rgba(0,0,0,0.52)' },
      { x: 0, y: 2, blur: 6, spread: 0, color: 'rgba(0,0,0,0.36)' },
    ),
    e4: elevation(
      { x: 0, y: 24, blur: 64, spread: 0, color: 'rgba(0,0,0,0.60)' },
      { x: 0, y: 4, blur: 12, spread: 0, color: 'rgba(0,0,0,0.40)' },
    ),
  },
};

// ---------------------------------------------------------------------------
// 5. Light theme
// ---------------------------------------------------------------------------

/**
 * Light theme. Not an inversion: the accent hues are re-picked at the darkness
 * each one needs to clear 4.5:1 on white, and the sequential ramps invert so
 * that dark still means "high value".
 *
 * Source: research doc, `:root[data-theme="light"]` block and the light table.
 */
export const lightTheme: Theme = {
  name: 'light',
  isDark: false,

  bg: {
    canvas: '#EDF0F6',
    app: '#F4F6FA',
    sunken: '#EAEEF5',
    scrim: 'rgba(11,15,25,0.44)',
  },

  surface: {
    s1: '#FFFFFF',
    s2: '#EDF0F6',
    s3: '#E3E8F1',
    s4: '#FFFFFF', // menus and tooltips lift back to white on light
  },

  edgeHighlight: { color: 'transparent', width: 0, css: 'none' },

  fg: {
    primary: '#0B0F19', // 19.15 on surface.s1, 15.57 on surface.s3
    // FIXED: research had #465163 (6.52 on surface.s3). Passing, but darkened
    // to hold a clear step above the corrected tertiary: 19.15/8.80/5.87.
    secondary: '#414B5C', // 8.80 on surface.s1, 7.16 on surface.s3
    // FIXED: research had #667184, which measures 4.32 on surface.s2 and 4.01
    // on surface.s3 — below AA on two of the four surfaces.
    tertiary: '#5B6578', // 5.87 on surface.s1, 4.77 on surface.s3
    disabled: '#98A1B2', // exempt: inactive controls only
    inverse: '#F2F5FA',
  },

  border: {
    subtle: '#E6EAF2',
    default: '#D6DCE8',
    strong: '#B9C2D2',
    // FIXED: research had #7B8699, which measures 2.99 on surface.s3 — one
    // hundredth below the 3:1 WCAG 1.4.11 needs for a control boundary.
    interactive: '#737E92', // 3.33 on surface.s3, 4.09 on surface.s1
    focus: '#1257C9', // 6.50 on surface.s1
  },

  brand: {
    // FIXED: research used amber-700 #B26A00 as the light brand fill, which
    // measures 4.24:1 with a white label — below AA. Amber cannot be both
    // bright and label-safe on white, so the brand *fill* steps down to
    // amber-800 while `record.fill` keeps the bright amber plus a border.
    fill: '#8A5000',
    onFill: '#FFFFFF', // 6.51 on fill
    text: '#8A5000', // 6.51 on surface.s1, 5.29 on surface.s3
    weak: 'rgba(245,165,36,0.16)',
    border: 'rgba(178,106,0,0.34)',
  },

  action: {
    fill: '#1257C9',
    onFill: '#FFFFFF', // 6.50 on fill
    hover: '#0F4EB4',
    press: '#0C4099',
    text: '#1257C9', // 6.50 on surface.s1
    weak: 'rgba(18,87,201,0.10)',
    border: 'rgba(18,87,201,0.32)',
  },

  positive: {
    // FIXED: research had #0F7A43, which measures 4.40 on surface.s3.
    fill: '#0E7140',
    onFill: '#FFFFFF', // 6.08 on fill
    text: '#0E7140', // 6.08 on surface.s1, 4.94 on surface.s3
    weak: 'rgba(14,113,64,0.12)',
    border: 'rgba(14,113,64,0.30)',
  },

  negative: {
    fill: '#BE2438',
    onFill: '#FFFFFF', // 6.00 on fill
    text: '#BE2438', // 6.00 on surface.s1, 4.88 on surface.s3
    weak: 'rgba(190,36,56,0.10)',
    border: 'rgba(190,36,56,0.30)',
  },

  warning: {
    // FIXED: same failure as brand — amber-700 + white is 4.24.
    fill: '#8A5000',
    onFill: '#FFFFFF', // 6.51 on fill
    text: '#8A5000', // 6.51 on surface.s1
    weak: 'rgba(178,106,0,0.12)',
    border: 'rgba(178,106,0,0.32)',
  },

  record: {
    // The bright amber survives into the light theme because a record must look
    // the same in both, but on white it is only a 2.04:1 shape — hence the
    // mandatory border, which measures 4.24:1 and carries the boundary.
    fill: '#F5A524',
    onFill: '#1A1206', // 9.08 on fill
    border: '#B26A00',
    glow: elevation(
      { x: 0, y: 0, blur: 0, spread: 1, color: 'rgba(178,106,0,0.40)' },
      { x: 0, y: 4, blur: 16, spread: 0, color: 'rgba(245,165,36,0.28)' },
    ),
  },

  readiness: {
    full: '#0E7140',
    partial: '#B26A00',
    low: '#BE2438',
    rest: '#7B8699',
  },

  tier: {
    Beginner: '#7A8496', // 3.77 vs surface.s1
    Novice: '#2E71B8', // 5.04
    Intermediate: '#0E7150', // 6.01
    Advanced: '#8A5000', // 6.51
    Elite: '#6B4A05', // 8.06
  },

  viz: {
    categorical: ['#1E6FA8', '#B5730B', '#A44B86', '#5B6779'],
    up: '#0F7A43',
    down: '#BE2438',
    flat: '#7B8699',
    heatBase: '#DCE2EC',
    heat: ['#FBE3C8', '#F8BE86', '#F0864F', '#D2504F', '#9E2F63', '#5F2465', '#2C1F4A'],
    activity: ['#ECEFF4', '#FBE8C6', '#F6CE87', '#EDAE44', '#D18A15', '#9A6100'],
    grid: '#E9EDF4',
    axis: '#D6DCE8',
    track: '#E3E8F1',
    band: 'rgba(18,87,201,0.10)',
    projection: 'rgba(65,75,92,0.45)',
    areaTop: 'rgba(178,106,0,0.20)',
    areaBottom: 'rgba(178,106,0,0)',
  },

  elevation: {
    none: NO_ELEVATION,
    e1: elevation({ x: 0, y: 1, blur: 2, spread: 0, color: 'rgba(11,15,25,0.06)' }),
    e2: elevation(
      { x: 0, y: 4, blur: 12, spread: 0, color: 'rgba(11,15,25,0.08)' },
      { x: 0, y: 1, blur: 2, spread: 0, color: 'rgba(11,15,25,0.05)' },
    ),
    e3: elevation(
      { x: 0, y: 12, blur: 32, spread: 0, color: 'rgba(11,15,25,0.12)' },
      { x: 0, y: 2, blur: 6, spread: 0, color: 'rgba(11,15,25,0.06)' },
    ),
    e4: elevation(
      { x: 0, y: 24, blur: 64, spread: 0, color: 'rgba(11,15,25,0.16)' },
      { x: 0, y: 4, blur: 12, spread: 0, color: 'rgba(11,15,25,0.08)' },
    ),
  },
};

/** Both themes, keyed by name, for a theme provider to select from. */
export const themes: Readonly<Record<Theme['name'], Theme>> = {
  dark: darkTheme,
  light: lightTheme,
};

// ---------------------------------------------------------------------------
// 6. Theme-independent scales
// ---------------------------------------------------------------------------

/**
 * Spacing scale in density-independent pixels, on a 4px base with 2px and 6px
 * half-steps for dense numeric rows. Keys are ordinal (`s0` .. `s14`), so the
 * scale can grow at the top without renaming anything.
 *
 * Source: research doc, section 5 "SPACING (4px base)".
 */
export const space = {
  s0: 0,
  s1: 2,
  s2: 4,
  s3: 6,
  s4: 8,
  s5: 10,
  s6: 12,
  s7: 16,
  s8: 20,
  s9: 24,
  s10: 32,
  s11: 40,
  s12: 48,
  s13: 64,
  s14: 80,
} as const;

export type SpaceKey = keyof typeof space;

/**
 * Named layout constants in dp. These are the dense, left-aligned defaults that
 * keep the product from reading like a template: a 16px gutter and 10px between
 * cards, not a centred hero with 64px of padding.
 *
 * Source: research doc, section 5 and the component specs in section 8.
 */
export const layout = {
  /** Screen side padding. */
  gutter: 16,
  /** Side padding on wide/tablet layouts. */
  gutterWide: 24,
  /** Card inner padding. */
  cardPad: 14,
  /** Card inner padding on the summary cards. */
  cardPadLg: 16,
  /** Standard list row height. */
  rowH: 44,
  /** Set-row height (taller: it holds numeric inputs). */
  rowHSet: 48,
  /** Tab bar height, before the bottom safe-area inset. */
  tabbarH: 56,
  /** App bar height. */
  appbarH: 52,
  /** Vertical gap between stacked cards. */
  stackGap: 10,
  /** Vertical gap between titled sections. */
  sectionGap: 28,
  /** Minimum touch target, per Apple HIG and Material. */
  hitTarget: 44,
} as const;

/**
 * Corner radii in dp. Radius scales with the element rather than being a single
 * blobby 24px everywhere: 6 chips, 8 buttons and inputs, 12 cards, 16 sheets.
 * Nesting rule: inner radius = outer radius - padding.
 *
 * Source: research doc, section 6 "RADIUS" and section 10.
 */
export const radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  xxxl: 28,
  /** Fully rounded. Large enough that any realistic height pills out. */
  pill: 9999,
} as const;

/**
 * Border widths in dp.
 *
 * `hairline` is the sub-pixel divider; at the render layer prefer React
 * Native's `StyleSheet.hairlineWidth`, which resolves to the device's true
 * one-physical-pixel value. `focus` is the ring thickness used with
 * `border.focus`.
 */
export const borderWidth = {
  none: 0,
  hairline: 0.5,
  thin: 1,
  thick: 2,
  focus: 2,
  /** Ring and gauge stroke at diameter >= 120. */
  ring: 10,
  /** Ring stroke at diameter 44-96. */
  ringSm: 8,
} as const;

/**
 * Stacking order. Named rather than numeric at the call site so a new layer
 * cannot be wedged in with a magic 9999.
 */
export const zIndex = {
  base: 0,
  sticky: 10,
  tabbar: 20,
  restTimer: 30,
  sheet: 40,
  menu: 50,
  toast: 60,
  modal: 70,
} as const;

/**
 * Opacity values. Deliberately few: disabled states change *colour*, they do
 * not fade the whole control, because fading a button wrecks its label contrast
 * unpredictably.
 */
export const opacity = {
  /** Pressed state on an unfilled control. */
  press: 0.72,
  /** Non-interactive decorative overlays. */
  ghost: 0.5,
  full: 1,
} as const;
