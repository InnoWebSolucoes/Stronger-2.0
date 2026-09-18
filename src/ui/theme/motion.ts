/**
 * Stronger 2.0 — motion.
 *
 * Pure TypeScript. Durations in milliseconds, easing as cubic-Bezier control
 * points; no `Animated`, no `react-native-reanimated`, no imports at all.
 *
 * The premise of this file is that motion is a budget, not a decoration. A
 * training app is opened mid-set, one-handed, with a rest clock running; motion
 * that does not confirm an action or communicate a quantity makes the product
 * feel slower every session. {@link sanctionedMotion} is the complete list of
 * interactions that earn animation, and {@link bannedMotion} is the list of
 * things that look like polish and are not. Anything not in the first list is
 * instant.
 *
 * Durations and the three eased curves come from Material 3's motion tokens
 * (https://m3.material.io/styles/motion/easing-and-duration/tokens-specs),
 * mapped onto this product's five steps. The one deliberate deviation is the
 * rest timer, which is linear — see {@link REST_TIMER_EASING}.
 *
 * Source: docs/research/stronger-2-0-visual-design-system-verified-dark-li.md
 * section 6 "Motion".
 */

// ---------------------------------------------------------------------------
// 1. Duration
// ---------------------------------------------------------------------------

/**
 * Durations in milliseconds.
 *
 * Mapped from Material 3: short1-4 = 50/100/150/200, medium1-4 =
 * 250/300/350/400, long1-2 = 450/500. `celebrate` is outside that range on
 * purpose; it fires at most three times a session and never loops.
 */
export const duration = {
  /** No animation. Use for anything on the Log tab's first paint. */
  instant: 0,
  /** Press and active states, checkbox fill, chip toggle. */
  micro: 120,
  /** Tooltip, crossfade, rest-timer chip appearing. */
  short: 180,
  /** Bottom sheet, accordion expand, exercise block insert. */
  standard: 240,
  /** Screen push, finish-summary tile reveal. */
  emphasized: 320,
  /** Ring fill on the first paint of the Progress tab. */
  long: 420,
  /** The PR burst. Fires once. */
  celebrate: 700,
} as const;

export type DurationKey = keyof typeof duration;

/**
 * Delay between successive items in a staggered reveal, ms.
 *
 * Used only by the finish summary. At six tiles this totals 300ms of stagger on
 * top of a 320ms reveal, which is the ceiling before the last tile feels late.
 */
export const STAGGER_MS = 60;

/**
 * Count-up duration for the finish summary's volume total, ms.
 *
 * The ease is applied to the *value*, not the element. This is the only
 * count-up in the product.
 */
export const COUNT_UP_MS = 900;

// ---------------------------------------------------------------------------
// 2. Easing
// ---------------------------------------------------------------------------

/** The four control points of a cubic Bezier easing curve: x1, y1, x2, y2. */
export type BezierPoints = readonly [x1: number, y1: number, x2: number, y2: number];

/** An easing curve as data, with the CSS form derived from the same points. */
export interface EasingCurve {
  readonly name: string;
  readonly points: BezierPoints;
  /** CSS `transition-timing-function` value. */
  readonly css: string;
  /** When to reach for this curve. */
  readonly use: string;
}

const curve = (name: string, points: BezierPoints, use: string): EasingCurve => ({
  name,
  points,
  css: points[0] === 0 && points[1] === 0 && points[2] === 1 && points[3] === 1
    ? 'linear'
    : `cubic-bezier(${points.join(',')})`,
  use,
});

/**
 * Easing curves. Three eased, one linear, one overshoot — five total, because
 * a sixth curve is indistinguishable in use and only creates argument.
 */
export const easing = {
  /** Material 3 `emphasized`. Movement that both starts and ends on screen. */
  standard: curve('standard', [0.2, 0, 0, 1], 'Default. Anything that moves within the viewport.'),
  /** Material 3 `emphasized-decelerate`. Things entering. */
  decelerate: curve('decelerate', [0.05, 0.7, 0.1, 1], 'Elements entering: sheets up, tiles revealing.'),
  /** Material 3 `emphasized-accelerate`. Things leaving. */
  accelerate: curve('accelerate', [0.3, 0, 0.8, 0.15], 'Elements leaving: sheets down, toasts dismissing.'),
  /** Constant rate. Mandatory for anything representing elapsed or remaining time. */
  linear: curve('linear', [0, 0, 1, 1], 'Timers and determinate progress only.'),
  /** A small overshoot. One use: the set-completion row settle. */
  spring: curve('spring', [0.34, 1.42, 0.64, 1], 'Set completion, and the PR pill scale-in.'),
} as const;

export type EasingKey = keyof typeof easing;

/**
 * The rest timer's easing, isolated so it cannot be "improved".
 *
 * An eased countdown ring drains at a varying rate while real time passes at a
 * constant one, so the ring and the numeral disagree about how long is left.
 * In a training app that is a correctness bug, not a taste question.
 */
export const REST_TIMER_EASING: EasingCurve = easing.linear;

// ---------------------------------------------------------------------------
// 3. What earns motion
// ---------------------------------------------------------------------------

/** A single sanctioned animation, specified tightly enough to review against. */
export interface MotionSpec {
  /** Stable id, referenced by the component that implements it. */
  readonly id: string;
  /** The user action or system event that starts it. */
  readonly trigger: string;
  /** Total wall-clock duration, ms. */
  readonly durationMs: number;
  readonly easing: EasingCurve;
  /** What actually moves, precisely enough to build from. */
  readonly spec: string;
  /** Why this one is worth the milliseconds. */
  readonly justification: string;
  /** How often a user sees it in a typical session. */
  readonly frequency: string;
}

/**
 * THE COMPLETE LIST of interactions that earn motion. Five entries.
 *
 * If an interaction is not here, it is instant. Adding a sixth is a design
 * decision, not an implementation detail: it needs an entry in this array with
 * a justification, which is the point of storing the list as data.
 *
 * Source: research doc section 6, "Motion that earns its place".
 */
export const sanctionedMotion: readonly MotionSpec[] = [
  {
    id: 'set-complete',
    trigger: 'The user taps the check on a set row.',
    durationMs: duration.short,
    easing: easing.decelerate,
    spec:
      'Checkmark path draws over 180ms (decelerate); row background fades to positive.weak over 120ms; row scales 0.97 -> 1.0 on the spring curve. Runs concurrently, total 180ms.',
    justification:
      'Confirms the tap without stealing the thumb, and the row colour change is what the user scans for when counting completed sets.',
    frequency: '~48 times in a 12-exercise, 4-set session — which is exactly why it is 180ms and not 400.',
  },
  {
    id: 'rest-timer',
    trigger: 'A rest timer is running.',
    durationMs: duration.short,
    easing: REST_TIMER_EASING,
    spec:
      'Ring drains LINEAR for the full rest period. In the final five seconds the numeral steps up one weight and the ring colour crossfades to warning.fill over 180ms, once per second.',
    justification:
      'The ring is a quantity, not a flourish. Linear is mandatory: any other curve makes the ring disagree with the clock.',
    frequency: 'Once between every set.',
  },
  {
    id: 'personal-record',
    trigger: 'A completed set is detected as a personal record.',
    durationMs: duration.celebrate,
    easing: easing.standard,
    spec:
      "The set row's amber border sweeps once over 700ms; the PB pill scales in on the spring curve; one haptic. No confetti, no loop, no sound.",
    justification:
      'A PR is the emotional peak of the product and the one moment that deserves to be felt. It stays a single sweep because a celebration that repeats stops being one.',
    frequency: '0-3 times per session.',
  },
  {
    id: 'finish-summary',
    trigger: 'The finish-summary screen appears after a workout is saved.',
    durationMs: duration.emphasized,
    easing: easing.decelerate,
    spec:
      'Tiles reveal bottom-up with a 60ms stagger, 320ms each, translateY 12 -> 0 plus opacity. The volume total counts up over 900ms with the ease applied to the value.',
    justification:
      'The only screen in the product the user arrives at having finished something, and the only sanctioned count-up. It is a reveal of results, not a transition.',
    frequency: 'Once per session.',
  },
  {
    id: 'sheet-present',
    trigger: 'A bottom sheet or modal is presented or dismissed.',
    durationMs: duration.standard,
    easing: easing.decelerate,
    spec:
      'Up over 240ms (decelerate), down over 200ms (accelerate); the scrim fades across the same window.',
    justification:
      'Motion here carries spatial meaning — it shows where the sheet came from and where it went, which a cut does not.',
    frequency: 'Several times per session.',
  },
];

/** A pattern that must stay still, and the reason. */
export interface BannedMotion {
  readonly pattern: string;
  readonly reason: string;
  readonly insteadDo: string;
}

/**
 * Motion that is noise. These are the tells that make an app read as generated:
 * movement applied uniformly rather than where it means something.
 *
 * Source: research doc section 6, "Motion that is noise — banned", and section
 * 10 "Looks AI-generated -> the professional alternative".
 */
export const bannedMotion: readonly BannedMotion[] = [
  {
    pattern: 'List-item entrance animations on scroll.',
    reason:
      'A workout history list is scrolled hundreds of times. Animating entry adds latency to every one of them and makes long lists feel like they are buffering.',
    insteadDo: 'Render rows immediately.',
  },
  {
    pattern: 'Parallax headers.',
    reason: 'Costs a scroll listener and a compositing layer to communicate nothing.',
    insteadDo: 'A static header that collapses to a title on scroll, with no easing on the collapse.',
  },
  {
    pattern: 'Skeleton shimmer looping more than twice.',
    reason: 'After two loops the shimmer is telling the user the app is stuck, which is worse than silence.',
    insteadDo: 'Fall back to a static surface.s2 block, and to a determinate bar if the wait has a known length.',
  },
  {
    pattern: 'Animated number count-ups.',
    reason:
      'A counting number is unreadable while it counts, and these are numbers people came to read. It also makes every screen feel like a dashboard demo.',
    insteadDo: 'Render the final value. The finish summary is the single exception, and only for the volume total.',
  },
  {
    pattern: 'Scale or zoom on page transition.',
    reason: 'Doubles the perceived cost of navigation and fights the platform push animation.',
    insteadDo: 'The platform push.',
  },
  {
    pattern: 'Hover-lift on touch targets.',
    reason: 'There is no hover on a phone; the effect only ever fires on the wrong platform.',
    insteadDo: 'A 120ms press state that changes fill, not elevation.',
  },
  {
    pattern: 'Spinning loaders running longer than 400ms.',
    reason: 'An indeterminate spinner past 400ms communicates only that nobody measured the operation.',
    insteadDo: 'A determinate bar, or optimistic UI — a logged set is written to SQLite locally and never needs a spinner at all.',
  },
  {
    pattern: 'Anything animating on the Log tab first paint.',
    reason: 'This is the screen opened mid-set with a bar loaded. It must feel instant.',
    insteadDo: 'Paint it.',
  },
  {
    pattern: 'Gradient progress bars with a shine sweep.',
    reason: 'Decorative animation drawn on top of a number the user is trying to read.',
    insteadDo: 'A flat fill with a tabular number beside it.',
  },
  {
    pattern: 'Looping celebration animations (confetti, pulsing PR badges).',
    reason: 'A celebration that repeats is an ad. It also keeps the GPU awake in a screen the user lingers on.',
    insteadDo: 'The single 700ms PR sweep in sanctionedMotion.',
  },
];

// ---------------------------------------------------------------------------
// 4. Reduced motion
// ---------------------------------------------------------------------------

/**
 * Resolves a duration against the OS "reduce motion" setting.
 *
 * The caller reads the setting from the platform (`AccessibilityInfo` on React
 * Native) and passes it in; this module takes no platform dependency.
 *
 * Reduced motion collapses transitions to zero rather than shortening them: a
 * 40ms animation is a flicker, which is worse for a motion-sensitive user than
 * a clean cut.
 *
 * @param ms The duration from {@link duration}, in milliseconds.
 * @param prefersReducedMotion Whether the OS setting is on.
 * @returns `0` when the setting is on, otherwise `ms` unchanged.
 */
export const resolveDuration = (ms: number, prefersReducedMotion: boolean): number =>
  prefersReducedMotion ? 0 : ms;

/**
 * Whether a sanctioned animation should still run under reduced motion.
 *
 * The rest timer is the exception: it is not decoration but a live readout of
 * remaining time, so it keeps updating. Its *ring* may be replaced by a stepped
 * numeral, but the value must not freeze.
 *
 * @param id A {@link MotionSpec} id.
 * @param prefersReducedMotion Whether the OS setting is on.
 * @returns `true` if the animation should still play.
 */
export const shouldAnimate = (id: string, prefersReducedMotion: boolean): boolean =>
  !prefersReducedMotion || id === 'rest-timer';
