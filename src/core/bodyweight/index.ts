/**
 * Bodyweight analytics engine - the maths behind the Bodyweight tab.
 *
 * Pure TypeScript (AGENTS.md §2): no react, react-native or expo-* imports, no
 * clock, no storage, no randomness. Anything platform-shaped is a parameter.
 *
 * - `types`      shared entry/point types, time primitives.
 * - `smoothing`  continuous-time Hacker's Diet EWMA, tau = 10 days, Huber gate.
 * - `trend`      kg/week from the smoothed series, with confidence; lag correction.
 * - `projection` goal projection as a capped date band, or a refusal.
 * - `stats`      overall change, averages, all-time range, tracking consistency.
 * - `safety`     goal guardrails and the rapid-loss detector. Not optional.
 * - `photos`     progress-photo data model and privacy predicates.
 *
 * Weights are kilograms, the canonical stored unit; conversion happens at
 * display time only.
 */

export * from './types';
export * from './smoothing';
export * from './trend';
export * from './projection';
export * from './stats';
export * from './safety';
export * from './photos';
