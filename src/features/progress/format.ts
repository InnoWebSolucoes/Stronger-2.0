/**
 * Display formatting for the Progress tab.
 *
 * Storage is kilograms, always (AGENTS.md). Conversion happens here, at the
 * render edge, once — never round-tripped back into a stored value.
 */

import { formatVolume, kgToLb, lbToKg, type Unit } from '@core/scoring';

const DAY_MS = 86_400_000;

/** `"102.5 kg"` / `"226 lb"`, trailing zeros trimmed. */
export function weight(kg: number | null | undefined, unit: Unit): string {
  if (kg === null || kg === undefined || !Number.isFinite(kg)) return '—';
  const value = unit === 'kg' ? kg : kgToLb(kg);
  const step = unit === 'kg' ? 0.5 : 1;
  const rounded = Math.round(value / step) * step;
  return `${trim(rounded)} ${unit}`;
}

/** Bare number, no unit — for a stat tile whose unit sits beside it. */
export function weightValue(kg: number | null | undefined, unit: Unit): string | null {
  if (kg === null || kg === undefined || !Number.isFinite(kg)) return null;
  const value = unit === 'kg' ? kg : kgToLb(kg);
  return trim(Math.round(value * 10) / 10);
}

/** A signed delta, with its sign always shown. `null` for "no baseline". */
export function delta(kg: number | null | undefined, unit: Unit): string | null {
  if (kg === null || kg === undefined || !Number.isFinite(kg)) return null;
  const value = unit === 'kg' ? kg : kgToLb(kg);
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return `0 ${unit}`;
  return `${rounded > 0 ? '+' : '−'}${trim(Math.abs(rounded))} ${unit}`;
}

/** Session tonnage: `"18,420 kg"`. */
export function volume(kg: number, unit: Unit): string {
  return formatVolume(kg, unit);
}

/** Compact tonnage for a tile: `"184.2t"` / `"406k lb"`. */
export function compactVolume(kg: number, unit: Unit): string {
  const value = unit === 'kg' ? kg : kgToLb(kg);
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  return `${Math.round(value)}`;
}

/** `"12h 40m"`, `"48m"`. */
export function duration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** `"Today"`, `"Yesterday"`, `"4d ago"`, `"12 Mar"`. */
export function sinceLabel(at: number, now: number): string {
  const days = Math.floor((startOfDay(now) - startOfDay(at)) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 28) return `${Math.floor(days / 7)}w ago`;
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** `"12 Mar 2026"`. */
export function dateLabel(at: number): string {
  return new Date(at).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** `"1,284"` with grouping, for counts in a column. */
export function count(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/** `"18%"`. */
export function percent(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

/** Turn a user-typed weight into kilograms for storage. */
export function parseWeightToKg(input: string, unit: Unit): number | null {
  const value = Number.parseFloat(input.replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return null;
  return unit === 'kg' ? value : lbToKg(value);
}

function startOfDay(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function trim(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}
