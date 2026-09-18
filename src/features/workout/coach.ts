import { archetypeFor } from '@/ui/anatomy/poses';
import type { WorkoutExercise } from './types';

/**
 * Coach tips shown under an exercise while logging.
 *
 * Two parts: a form cue keyed to the movement archetype, and a progression
 * line derived from what the user actually did last time. Generic
 * encouragement is deliberately absent — a tip that could apply to any
 * exercise teaches nothing and trains people to ignore the panel.
 */

const FORM_CUES: Record<string, readonly string[]> = {
  benchPress: [
    'Shoulder blades pinned back and down, not shrugged toward your ears.',
    'Bar touches the lower chest, wrists stacked over elbows.',
  ],
  inclinePress: [
    'Keep the bench under 30° — steeper turns this into a shoulder press.',
    'Drive the bar back over the collarbone, not straight up from the chest.',
  ],
  squat: [
    'Break at hips and knees together; brace before you descend, not after.',
    'Knees track over the middle toes. Depth comes from hips, not a forward lean.',
  ],
  hinge: [
    'Push hips back with a flat spine — this is a hinge, not a squat.',
    'Bar stays in contact with your legs the whole way up.',
  ],
  row: [
    'Pull to the lower ribs and lead with the elbow, not the hand.',
    'Torso stays still. If it rocks to move the weight, the weight is too heavy.',
  ],
  pulldown: [
    'Start by pulling the shoulder blades down, then bend the elbows.',
    'Chest up to the bar. Leaning back past 20° turns it into a row.',
  ],
  overheadPress: [
    'Squeeze glutes and brace to stop the lower back arching.',
    'Move your head back out of the way, then push it through once the bar clears.',
  ],
  curl: [
    'Elbows pinned at your sides — swinging them forward hands the work to the front delt.',
    'Control the lowering. That half of the rep builds most of the size.',
  ],
  tricepsExtension: [
    'Only the forearm moves. Upper arm stays locked in place.',
    'Full lockout at the bottom, deep stretch at the top.',
  ],
  raise: [
    'Lead with the elbows, thumbs slightly down, and stop at shoulder height.',
    'Light weight and strict form beats heavy and swung — this is a small muscle.',
  ],
  legExtension: ['Pause a beat at the top.', 'Lower slowly rather than letting the stack drop.'],
  legCurl: ['Keep hips pressed into the pad.', 'Do not let them lift as you curl.'],
  hipThrust: [
    'Chin tucked, ribs down, and finish with a hard glute squeeze at the top.',
    'Shins vertical at lockout — adjust your feet if they are not.',
  ],
  calfRaise: [
    'Full stretch at the bottom, full contraction at the top.',
    'Slow it down. Bouncing uses the tendon instead of the muscle.',
  ],
  crunch: [
    'Curl the spine rather than hinging at the hip.',
    'Exhale hard at the top to get the abs fully shortened.',
  ],
  fly: [
    'Keep a soft, fixed elbow bend the whole way — it is an arc, not a press.',
    'Stop when you feel the stretch, not when your hands touch behind you.',
  ],
  dip: [
    'Lean forward for chest, stay upright for triceps.',
    'Go to upper arms parallel with the floor; deeper punishes the shoulder.',
  ],
  lunge: [
    'Front shin roughly vertical, torso tall.',
    'Push through the whole front foot, not the toes.',
  ],
  shrug: [
    'Straight up and down. Rolling the shoulders adds nothing but wear.',
    'Hold the top for a full second.',
  ],
  hold: ['Ribs down, glutes tight, breathe normally.', 'Stop when form breaks, not when it burns.'],
};

export type CoachTip = {
  cues: readonly string[];
  progression: string | null;
};

/**
 * @param exercise the exercise as logged in the current session
 * @param lastTime the same exercise from the most recent previous session, if any
 */
export function coachTip(
  exercise: WorkoutExercise,
  lastTime?: WorkoutExercise | null,
): CoachTip {
  const arch = archetypeFor(exercise.exerciseId);
  const cues = FORM_CUES[arch.id] ?? FORM_CUES.hold ?? [];

  return { cues, progression: progressionLine(lastTime ?? null) };
}

function progressionLine(lastTime: WorkoutExercise | null): string | null {
  if (!lastTime) return null;

  const working = lastTime.sets.filter(
    (s) => s.type !== 'warmup' && s.weightKg != null && s.reps != null,
  );
  if (working.length === 0) return null;

  let topWeight = 0;
  let repsAtTop = 0;
  for (const s of working) {
    const w = s.weightKg ?? 0;
    const r = s.reps ?? 0;
    if (w > topWeight || (w === topWeight && r > repsAtTop)) {
      topWeight = w;
      repsAtTop = r;
    }
  }
  if (topWeight <= 0) return null;

  // Double progression: add reps at a load until the top of the range, then add
  // weight and reset to the bottom. It is the simplest scheme that works, and
  // it does not need an e1RM estimate to be useful.
  if (repsAtTop >= 12) {
    return `Last time: ${topWeight} kg × ${repsAtTop}. You have earned the next jump — go up and aim for 8.`;
  }
  if (repsAtTop >= 8) {
    return `Last time: ${topWeight} kg × ${repsAtTop}. Stay at this weight and chase one more rep.`;
  }
  return `Last time: ${topWeight} kg × ${repsAtTop}. Build reps here before adding load.`;
}
