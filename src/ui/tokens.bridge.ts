/**
 * TEMPORARY token bridge.
 *
 * Values are transcribed from docs/research/design/tokens.ts, where every
 * foreground/surface pair carries a measured WCAG contrast ratio. This file
 * exists only so the UI could be built while src/ui/theme was still being
 * written. Once that lands, re-export from it here and delete these literals —
 * the import sites should not have to change.
 *
 * RN note: the research file expresses elevation as CSS box-shadow strings,
 * which React Native cannot consume. The shadow scale below is the RN
 * equivalent (iOS shadow* + Android elevation).
 */

export const c = {
  bg: {
    canvas: '#070A11',
    app: '#0B0F19',
    sunken: '#0E1320',
    scrim: 'rgba(4,7,13,0.72)',
  },
  surface: {
    1: '#121725',
    2: '#1A2032',
    3: '#222A3D',
    4: '#2B3348',
  },
  fg: {
    primary: '#F2F5FA', // 17.52:1 on bg.app
    secondary: '#A7B1C4', // 8.87:1
    tertiary: '#8A94A8', // 6.28:1
    disabled: '#5C6679', // non-text only
    onAccent: '#120C02', // on amber fill = 9.53:1
    onAction: '#FFFFFF', // on blue.500 = 4.72:1
  },
  border: {
    subtle: '#1C2333',
    default: '#252E41',
    strong: '#36405A',
    interactive: '#626E85',
    focus: '#6FB0FF',
  },
  brand: {
    base: '#F5A524',
    text: '#FFC15E',
    weak: 'rgba(245,165,36,0.14)',
    borderWeak: 'rgba(245,165,36,0.32)',
  },
  action: {
    fill: '#2A6FE0',
    press: '#205CC4',
    text: '#6FB0FF',
    weak: 'rgba(42,111,224,0.16)',
  },
  positive: { text: '#4ADE8B', fill: '#22C55E', weak: 'rgba(34,197,94,0.15)' },
  negative: { text: '#FF8A93', fill: '#D6293E', weak: 'rgba(214,41,62,0.16)' },
  record: { fill: '#FFC15E', fg: '#171004', border: '#F5A524' },
  readiness: { full: '#4ADE8B', partial: '#F7B23B', low: '#E5484D', rest: '#626E85' },
  viz: {
    up: '#5FE39B',
    down: '#E5484D',
    flat: '#7A8599',
    grid: '#1E2637',
    axis: '#2A3346',
    track: '#222A3D',
    /** 6-step ramp for the workout activity heatmap, empty → most intense. */
    activity: ['#151B29', '#43300F', '#6E4C0F', '#A5731A', '#D89A24', '#FFC15E'],
  },
} as const;

/** 4pt base scale. Anything not on it is a mistake, not a decision. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/**
 * This app is wall-to-wall numbers. Anything that sits in a column and updates
 * live — set tables, stat tiles, timers, volume counters — must use tabular
 * figures or the digits jitter as values change.
 */
export const font = {
  /** Proportional: prose, labels, names. */
  sans: undefined as string | undefined,
  /** Tabular: any number that shares a column or animates. */
  mono: 'monospace' as const,
} as const;

export const type = {
  display: { fontSize: 34, fontWeight: '700', letterSpacing: -0.6, lineHeight: 40 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, lineHeight: 28 },
  heading: { fontSize: 17, fontWeight: '600', letterSpacing: -0.1, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 21 },
  bodyStrong: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  /** Section headers: uppercase, tracked out, tertiary. */
  overline: { fontSize: 11, fontWeight: '700', letterSpacing: 1.1, lineHeight: 14 },
  /** Big numbers — always tabular. */
  metric: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, lineHeight: 32 },
} as const;

/** RN equivalents of the research's box-shadow scale. */
export const shadow = {
  1: {
    shadowColor: '#000',
    shadowOpacity: 0.36,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  2: {
    shadowColor: '#000',
    shadowOpacity: 0.44,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  3: {
    shadowColor: '#000',
    shadowOpacity: 0.52,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
} as const;

/**
 * Motion earns its place on exactly four interactions: set completion, PR
 * celebration, the rest timer, and the finish-summary reveal. Everywhere else
 * it is noise.
 */
export const motion = {
  instant: 120,
  fast: 180,
  base: 240,
  slow: 360,
  celebrate: 640,
} as const;
