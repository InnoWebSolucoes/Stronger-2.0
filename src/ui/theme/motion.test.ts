/**
 * Motion invariants. The important ones are the rest timer's linear easing
 * (anything else misrepresents remaining time) and the size of the sanctioned
 * list (motion is a budget, not a default).
 */

import { describe, expect, it } from 'vitest';
import {
  COUNT_UP_MS,
  REST_TIMER_EASING,
  STAGGER_MS,
  bannedMotion,
  duration,
  easing,
  resolveDuration,
  sanctionedMotion,
  shouldAnimate,
} from './motion';

describe('durations', () => {
  it('starts at zero and increases through the scale', () => {
    const ordered = [
      duration.instant,
      duration.micro,
      duration.short,
      duration.standard,
      duration.emphasized,
      duration.long,
      duration.celebrate,
    ];
    expect(ordered[0]).toBe(0);
    for (let i = 1; i < ordered.length; i += 1) {
      const a = ordered[i - 1];
      const b = ordered[i];
      if (a === undefined || b === undefined) continue;
      expect(b).toBeGreaterThan(a);
    }
  });

  it('matches the values mapped from Material 3 motion tokens', () => {
    expect(duration.micro).toBe(120);
    expect(duration.short).toBe(180);
    expect(duration.standard).toBe(240);
    expect(duration.emphasized).toBe(320);
    expect(duration.long).toBe(420);
    expect(duration.celebrate).toBe(700);
  });

  it('keeps every routine interaction under 450ms', () => {
    // Only the once-per-session celebration is allowed past this.
    const routine = [duration.micro, duration.short, duration.standard, duration.emphasized, duration.long];
    for (const ms of routine) expect(ms).toBeLessThan(450);
  });

  it('keeps the finish-summary stagger from making the last tile feel late', () => {
    const tiles = 6;
    expect(STAGGER_MS * (tiles - 1) + duration.emphasized).toBeLessThanOrEqual(650);
  });

  it('counts up the volume total for under a second', () => {
    expect(COUNT_UP_MS).toBeLessThanOrEqual(1000);
  });
});

describe('easing curves', () => {
  it('derives each css string from its own control points', () => {
    expect(easing.standard.css).toBe('cubic-bezier(0.2,0,0,1)');
    expect(easing.decelerate.css).toBe('cubic-bezier(0.05,0.7,0.1,1)');
    expect(easing.accelerate.css).toBe('cubic-bezier(0.3,0,0.8,0.15)');
    expect(easing.spring.css).toBe('cubic-bezier(0.34,1.42,0.64,1)');
    expect(easing.linear.css).toBe('linear');
  });

  it('matches the Material 3 emphasized curve family', () => {
    expect(easing.standard.points).toEqual([0.2, 0, 0, 1]);
    expect(easing.decelerate.points).toEqual([0.05, 0.7, 0.1, 1]);
    expect(easing.accelerate.points).toEqual([0.3, 0, 0.8, 0.15]);
  });

  it('keeps every x control point inside 0..1, as a cubic-bezier timing function requires', () => {
    for (const curve of Object.values(easing)) {
      const [x1, , x2] = curve.points;
      expect(x1).toBeGreaterThanOrEqual(0);
      expect(x1).toBeLessThanOrEqual(1);
      expect(x2).toBeGreaterThanOrEqual(0);
      expect(x2).toBeLessThanOrEqual(1);
    }
  });

  it('overshoots only on the spring curve', () => {
    const overshooting = Object.values(easing).filter((c) => c.points[1] > 1 || c.points[3] > 1);
    expect(overshooting.map((c) => c.name)).toEqual(['spring']);
  });

  it('holds the rest timer to linear, because an eased countdown lies about time left', () => {
    expect(REST_TIMER_EASING).toBe(easing.linear);
    expect(REST_TIMER_EASING.points).toEqual([0, 0, 1, 1]);
    const timer = sanctionedMotion.find((m) => m.id === 'rest-timer');
    expect(timer?.easing.css).toBe('linear');
  });
});

describe('sanctioned motion', () => {
  it('is exactly the five moments that earn animation', () => {
    expect(sanctionedMotion.map((m) => m.id)).toEqual([
      'set-complete',
      'rest-timer',
      'personal-record',
      'finish-summary',
      'sheet-present',
    ]);
  });

  it('gives every entry a trigger, a spec, a justification and a frequency', () => {
    for (const m of sanctionedMotion) {
      expect(m.trigger.length).toBeGreaterThan(10);
      expect(m.spec.length).toBeGreaterThan(40);
      expect(m.justification.length).toBeGreaterThan(40);
      expect(m.frequency.length).toBeGreaterThan(5);
    }
  });

  it('draws every duration from the scale', () => {
    const allowed = new Set<number>(Object.values(duration));
    for (const m of sanctionedMotion) expect(allowed.has(m.durationMs)).toBe(true);
  });

  it('keeps the highest-frequency interaction the shortest', () => {
    // Set completion fires ~48 times in a session; the PR fires 0-3 times.
    const setComplete = sanctionedMotion.find((m) => m.id === 'set-complete');
    const pr = sanctionedMotion.find((m) => m.id === 'personal-record');
    expect(setComplete?.durationMs).toBe(duration.short);
    expect(pr?.durationMs).toBe(duration.celebrate);
    expect(setComplete?.durationMs).toBeLessThan(pr?.durationMs ?? 0);
  });

  it('has unique ids', () => {
    expect(new Set(sanctionedMotion.map((m) => m.id)).size).toBe(sanctionedMotion.length);
  });
});

describe('banned motion', () => {
  it('names the tells that make a product read as generated', () => {
    const text = bannedMotion.map((b) => b.pattern.toLowerCase()).join(' | ');
    expect(text).toContain('count-up');
    expect(text).toContain('parallax');
    expect(text).toContain('shimmer');
    expect(text).toContain('shine sweep');
    expect(text).toContain('hover-lift');
  });

  it('gives every ban a reason and a replacement, so it is a rule and not a taste', () => {
    for (const b of bannedMotion) {
      expect(b.reason.length).toBeGreaterThan(30);
      expect(b.insteadDo.length).toBeGreaterThan(5);
    }
  });

  it('does not ban anything the sanctioned list requires', () => {
    const sanctionedIds = new Set(sanctionedMotion.map((m) => m.id));
    expect(sanctionedIds.has('finish-summary')).toBe(true);
    // The count-up ban explicitly carves out the finish summary.
    const countUpBan = bannedMotion.find((b) => b.pattern.toLowerCase().includes('count-up'));
    expect(countUpBan?.insteadDo.toLowerCase()).toContain('finish summary');
  });
});

describe('reduced motion', () => {
  it('collapses durations to zero rather than shortening them', () => {
    expect(resolveDuration(duration.emphasized, true)).toBe(0);
    expect(resolveDuration(duration.emphasized, false)).toBe(duration.emphasized);
    expect(resolveDuration(0, true)).toBe(0);
    expect(resolveDuration(duration.celebrate, true)).toBe(0);
  });

  it('stops every animation except the rest timer, which is a live readout', () => {
    for (const m of sanctionedMotion) {
      expect(shouldAnimate(m.id, true)).toBe(m.id === 'rest-timer');
      expect(shouldAnimate(m.id, false)).toBe(true);
    }
  });

  it('treats an unknown id as ordinary decoration', () => {
    expect(shouldAnimate('some-new-flourish', true)).toBe(false);
    expect(shouldAnimate('some-new-flourish', false)).toBe(true);
  });
});
