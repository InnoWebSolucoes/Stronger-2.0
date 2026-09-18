/**
 * schema.ts — the local SQLite schema, expressed with Drizzle.
 *
 * This file is the system of record for the app's data. The server is a replica
 * (research brief, PART 4, invariant 1), so everything the user can see or do
 * during a workout is readable and writable here with no network.
 *
 * It imports only `drizzle-orm` — no `expo-sqlite`, no react-native — so
 * drizzle-kit, tests and any future web dashboard can read it directly.
 *
 * ── Conventions (research brief, PART 0) ─────────────────────────────────────
 *
 * IDs           Every primary key is a client-generated ULID (`src/db/ids.ts`):
 *               26-character, time-ordered, sortable TEXT. Client-generated so a
 *               row can be created with no server round trip; time-ordered so
 *               btree inserts append instead of fragmenting and the 40 sets of
 *               one workout land on adjacent pages. Exercise identity is a
 *               stable slug that survives catalog updates, never an index.
 *
 * Sync envelope Every synced table carries:
 *                 updated_at    ISO-8601 UTC text, last local write
 *                 rev_hlc       hybrid logical clock, lexicographically
 *                               sortable TEXT. A bare updated_at is not enough:
 *                               a phone that cold-boots after the battery died
 *                               can come back with a wall clock minutes off and
 *                               would then silently win or lose every conflict.
 *                 origin_device which device last wrote the row
 *                 deleted_at    soft-delete tombstone. Deletes are never
 *                               physical: a hard delete cannot be replicated to
 *                               a device that has been offline for three days.
 *
 * Ordering      Ordered children carry `pos TEXT`, a fractional index, never an
 *               integer position. Two offline devices inserting "between set 2
 *               and set 3" mint different keys and both rows survive; an integer
 *               position would need a renumber write across every sibling, which
 *               is a guaranteed conflict storm. Read ordered collections as
 *               `ORDER BY pos, id` — see `compareOrdered` in ids.ts.
 *
 * Types         SQLite has no boolean and no date: booleans are INTEGER 0/1,
 *               timestamps are ISO-8601 UTC TEXT (sortable, and readable by
 *               strftime()), masses are REAL. Enums are TEXT; they are enforced
 *               by the TypeScript union on the column and by CHECK constraints
 *               in the migration SQL.
 *
 * Units         Mass is ALWAYS kilograms. There is no pounds column anywhere in
 *               this file. Conversion happens once, at render time, from
 *               profiles.unit_system. A stored value is never round-trip
 *               converted (AGENTS.md, Conventions).
 *
 * Time          Elapsed time is never stored. A workout stores absolute anchors
 *               (started_at, ended_at) plus a pause ledger (paused_ms,
 *               pause_started_at) and duration is derived. A value that is only
 *               correct while the process is alive is a value that lies after a
 *               crash.
 */

import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/* ------------------------------------------------------------------------- */
/* Shared column groups                                                       */
/* ------------------------------------------------------------------------- */

/**
 * The sync envelope carried by every table that replicates to Supabase.
 * @see the module doc for what each column is for and why updated_at alone is
 *      insufficient.
 */
const syncEnvelope = () => ({
  updatedAt: text('updated_at').notNull(),
  revHlc: text('rev_hlc').notNull().default('0'),
  originDevice: text('origin_device'),
  deletedAt: text('deleted_at'),
});

/** created_at, for tables that record when a row first appeared. */
const createdAt = () => ({ createdAt: text('created_at').notNull() });

/* ------------------------------------------------------------------------- */
/* Enumerations (TEXT columns with a compile-time union)                      */
/* ------------------------------------------------------------------------- */

export const SET_TYPES = ['warmup', 'normal', 'drop', 'failure', 'myorep', 'cluster', 'backoff', 'amrap'] as const;
export type SetType = (typeof SET_TYPES)[number];

export const WORKOUT_STATUSES = ['in_progress', 'completed', 'discarded'] as const;
export type WorkoutStatus = (typeof WORKOUT_STATUSES)[number];

export const VISIBILITIES = ['public', 'followers', 'private'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const UNIT_SYSTEMS = ['metric', 'imperial'] as const;
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];

export const SEXES = ['male', 'female', 'unspecified'] as const;
export type Sex = (typeof SEXES)[number];

export const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const PR_KINDS = [
  'e1rm',
  'max_weight',
  'max_reps',
  'reps_at_weight',
  'set_volume',
  'session_volume',
  'max_duration',
  'max_distance',
] as const;
export type PrKind = (typeof PR_KINDS)[number];

export const BODYWEIGHT_SOURCES = ['manual', 'healthkit', 'health_connect', 'scale', 'import'] as const;
export type BodyweightSource = (typeof BODYWEIGHT_SOURCES)[number];

export const PHOTO_POSES = ['front', 'side_left', 'side_right', 'back', 'custom'] as const;
export type PhotoPose = (typeof PHOTO_POSES)[number];

export const ATTACHMENT_STATES = [
  'queued_upload',
  'uploading',
  'synced',
  'queued_delete',
  'archived',
  'failed',
] as const;
export type AttachmentState = (typeof ATTACHMENT_STATES)[number];

export const STRENGTH_SCOPES = ['exercise', 'muscle_group', 'overall'] as const;
export type StrengthScope = (typeof STRENGTH_SCOPES)[number];

export const STRENGTH_LEVELS = ['untrained', 'novice', 'intermediate', 'advanced', 'elite', 'world_class'] as const;
export type StrengthLevel = (typeof STRENGTH_LEVELS)[number];

/**
 * Kinds written to the append-only black box. Adding a kind is always safe;
 * removing one is not, because old rows keep their kind forever.
 */
export const WORKOUT_EVENT_KINDS = [
  'workout_start',
  'workout_resume',
  'workout_pause',
  'workout_finish',
  'workout_discard',
  'workout_auto_close',
  'exercise_add',
  'exercise_remove',
  'exercise_reorder',
  'set_add',
  'set_complete',
  'set_uncomplete',
  'set_edit',
  'set_remove',
  'rest_start',
  'rest_skip',
  'note_edit',
  'app_background',
  'recovery_merge',
] as const;
export type WorkoutEventKind = (typeof WORKOUT_EVENT_KINDS)[number];

/* ------------------------------------------------------------------------- */
/* 1. Identity                                                                */
/* ------------------------------------------------------------------------- */

/**
 * The signed-in user's profile. One row locally in practice; the table is
 * plural because a shared device can hold more than one cached profile.
 *
 * `unit_system` lives here and nowhere else: it is a *display* preference and
 * has no effect on any stored number.
 */
export const profiles = sqliteTable(
  'profiles',
  {
    id: text('id').primaryKey(),
    handle: text('handle').notNull(),
    displayName: text('display_name'),
    bio: text('bio'),
    avatarPath: text('avatar_path'),
    isPro: integer('is_pro').notNull().default(0),
    sex: text('sex').$type<Sex>().notNull().default('unspecified'),
    birthDate: text('birth_date'),
    heightCm: real('height_cm'),
    unitSystem: text('unit_system').$type<UnitSystem>().notNull().default('metric'),
    defaultRestS: integer('default_rest_s').notNull().default(120),
    experience: text('experience').$type<ExperienceLevel>(),
    profileVisibility: text('profile_visibility').$type<Visibility>().notNull().default('public'),
    defaultWorkoutVisibility: text('default_workout_visibility').$type<Visibility>().notNull().default('followers'),
    /** Server-owned: recomputed by trigger, never merged from the client. */
    followersCount: integer('followers_count').notNull().default(0),
    followingCount: integer('following_count').notNull().default(0),
    workoutsCount: integer('workouts_count').notNull().default(0),
    ...createdAt(),
    ...syncEnvelope(),
  },
  (t) => [
    // ACCESS: @handle lookup from search and deep links.
    uniqueIndex('profiles_handle_key').on(t.handle).where(sql`deleted_at IS NULL`),
  ],
);

/* ------------------------------------------------------------------------- */
/* 2. Workouts — the hot path                                                 */
/* ------------------------------------------------------------------------- */

/**
 * One training session. The row exists from the moment the user taps Start, in
 * a committed transaction, so a force-kill one second later loses nothing.
 *
 * TIME: `started_at` and `ended_at` are absolute anchors and `paused_ms` is a
 * ledger of time already spent paused, with `pause_started_at` marking an open
 * pause. Duration is `now - started_at - paused_ms - openPause`. Nothing that
 * ticks is ever persisted.
 *
 * CLAIM: `active_device_id` / `claim_expires_at` / `claim_seq` are an *advisory*
 * lock renewed every 60s while the session is foregrounded. Offline it is
 * unverifiable, so it is prevention only; correctness comes from the set-level
 * merge in recovery.ts.
 *
 * AGGREGATES: total_* are client-computed so the finish summary works with no
 * signal, and are recomputed authoritatively server-side on completion.
 */
export const workouts = sqliteTable(
  'workouts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    routineId: text('routine_id'),
    programId: text('program_id'),
    title: text('title').notNull().default('Workout'),
    notes: text('notes'),
    status: text('status').$type<WorkoutStatus>().notNull().default('in_progress'),
    startedAt: text('started_at').notNull(),
    endedAt: text('ended_at'),
    /** Total milliseconds already spent paused. Never a countdown. */
    pausedMs: integer('paused_ms').notNull().default(0),
    /** Set while a pause is open; null otherwise. */
    pauseStartedAt: text('pause_started_at'),
    tz: text('tz').notNull().default('UTC'),
    /** Calendar day in the user's timezone, computed on the client at write time. */
    localDate: text('local_date').notNull(),
    activeDeviceId: text('active_device_id'),
    claimExpiresAt: text('claim_expires_at'),
    claimSeq: integer('claim_seq').notNull().default(0),
    totalVolumeKg: real('total_volume_kg').notNull().default(0),
    totalReps: integer('total_reps').notNull().default(0),
    totalSets: integer('total_sets').notNull().default(0),
    totalExercises: integer('total_exercises').notNull().default(0),
    prsCount: integer('prs_count').notNull().default(0),
    avgRpe: real('avg_rpe'),
    perceivedEffort: integer('perceived_effort'),
    visibility: text('visibility').$type<Visibility>().notNull().default('followers'),
    likeCount: integer('like_count').notNull().default(0),
    commentCount: integer('comment_count').notNull().default(0),
    /** Which version of the derived-stat engine produced the aggregates. */
    engineVersion: integer('engine_version').notNull().default(1),
    ...createdAt(),
    ...syncEnvelope(),
  },
  (t) => [
    // ACCESS: Log tab history, infinite scroll. The hottest query in the app.
    index('workouts_user_recent')
      .on(t.userId, t.startedAt)
      .where(sql`deleted_at IS NULL AND status = 'completed'`),
    // ACCESS: recovery-on-launch probe, and the "do I have a live session" check
    //         on every cold start. Deliberately NOT unique on the client: two
    //         devices can each create one offline and both inserts are legal
    //         locally. mergeDuplicateActiveWorkouts() reconciles them.
    index('workouts_active')
      .on(t.userId, t.startedAt)
      .where(sql`status = 'in_progress' AND deleted_at IS NULL`),
    // ACCESS: week-strip calendar dots and the 6-month profile heatmap.
    index('workouts_user_local_date').on(t.userId, t.localDate).where(sql`deleted_at IS NULL`),
    // ACCESS: "last time you did Push Day".
    index('workouts_routine_idx').on(t.routineId, t.startedAt),
  ],
);

/**
 * One exercise block inside a workout.
 *
 * `exercise_slug` and `exercise_name_snapshot` are frozen copies of what the
 * user saw. Exercise ids are permanent and deprecation is a redirect, but the
 * snapshot means a history screen still renders correctly even if the catalog
 * row is later merged or renamed. `contribution_version` records which muscle
 * model was used, so retuning the model never silently rewrites last year's
 * charts.
 */
export const workoutExercises = sqliteTable(
  'workout_exercises',
  {
    id: text('id').primaryKey(),
    workoutId: text('workout_id').notNull(),
    /** Denormalised from workouts: every history query filters by user first. */
    userId: text('user_id').notNull(),
    /** Stable catalog id. Never an array index, never regenerated. */
    exerciseId: text('exercise_id').notNull(),
    exerciseSlug: text('exercise_slug'),
    exerciseNameSnapshot: text('exercise_name_snapshot'),
    contributionVersion: integer('contribution_version').notNull().default(1),
    pos: text('pos').notNull(),
    supersetGroup: text('superset_group'),
    notes: text('notes'),
    restS: integer('rest_s'),
    volumeKg: real('volume_kg').notNull().default(0),
    bestSetId: text('best_set_id'),
    e1rmKg: real('e1rm_kg'),
    ...createdAt(),
    ...syncEnvelope(),
  },
  (t) => [
    // ACCESS: render the active or historical workout screen top to bottom.
    index('we_workout_idx').on(t.workoutId, t.pos).where(sql`deleted_at IS NULL`),
    // ACCESS: the "Previous" column — the last time this user did this exercise.
    //         Runs for every exercise added to a live workout, offline, so it
    //         must be O(log n) rather than a scan of all history.
    index('we_user_exercise_recent')
      .on(t.userId, t.exerciseId, t.createdAt)
      .where(sql`deleted_at IS NULL`),
  ],
);

/**
 * One performed set. The single most-written and most-read row in the app.
 *
 * Denormalised `workout_id`, `user_id` and `exercise_id` exist so PR detection,
 * the e1RM sparkline and the finish summary are single-index lookups instead of
 * three-table joins on a cold cache in a gym basement.
 *
 * Units: `weight_kg` and `effective_load_kg` are kilograms. `effective_load_kg`
 * is weight plus the exercise's bodyweight factor times the user's bodyweight
 * (a pull-up at 0 kg added is not a 0 kg set), computed on the client at log
 * time from the bodyweight then in effect.
 */
export const sets = sqliteTable(
  'sets',
  {
    id: text('id').primaryKey(),
    workoutExerciseId: text('workout_exercise_id').notNull(),
    workoutId: text('workout_id').notNull(),
    userId: text('user_id').notNull(),
    exerciseId: text('exercise_id').notNull(),
    pos: text('pos').notNull(),
    setType: text('set_type').$type<SetType>().notNull().default('normal'),
    /** Parent of a drop-set or myorep chain. */
    parentSetId: text('parent_set_id'),
    weightKg: real('weight_kg'),
    reps: integer('reps'),
    /** Reps in reserve. Drives r_effective = reps + rir for e1RM. */
    rir: real('rir'),
    rpe: real('rpe'),
    durationS: integer('duration_s'),
    distanceM: real('distance_m'),
    effectiveLoadKg: real('effective_load_kg'),
    volumeKg: real('volume_kg').notNull().default(0),
    e1rmKg: real('e1rm_kg'),
    isCompleted: integer('is_completed').notNull().default(0),
    completedAt: text('completed_at'),
    isPr: integer('is_pr').notNull().default(0),
    /** JSON array of PrKind, denormalised for the PR badge on the set row. */
    prKinds: text('pr_kinds').notNull().default('[]'),
    notes: text('notes'),
    ...createdAt(),
    ...syncEnvelope(),
  },
  (t) => [
    // ACCESS: set-table rendering. The most frequent read in the app.
    index('sets_we_idx').on(t.workoutExerciseId, t.pos).where(sql`deleted_at IS NULL`),
    // ACCESS: e1RM sparkline per exercise, PR detection, "Previous" values, and
    //         the 1W/1M/3M/6M/1Y range filters.
    index('sets_user_exercise_time')
      .on(t.userId, t.exerciseId, t.completedAt)
      .where(sql`deleted_at IS NULL AND is_completed = 1`),
    // ACCESS: finish-summary aggregation — sum volume and reps in one scan.
    index('sets_workout_idx').on(t.workoutId).where(sql`deleted_at IS NULL`),
    // ACCESS: expand a drop-set chain.
    index('sets_parent_idx').on(t.parentSetId).where(sql`parent_set_id IS NOT NULL`),
  ],
);

/**
 * The black box: an append-only log of everything that happened in a session.
 *
 * Never UPDATEd and never soft-deleted, so no partial write can corrupt it. It
 * exists for three reasons: it can rebuild `sets` if the mutable tables are ever
 * inconsistent, it makes replay idempotent via (workout_id, device_id, seq), and
 * it is the source for rest-interval analytics.
 *
 * It carries no sync envelope because its merge policy is `append_only`: rows
 * are immutable and deduplicated by their natural key.
 */
export const workoutEvents = sqliteTable(
  'workout_events',
  {
    id: text('id').primaryKey(),
    workoutId: text('workout_id').notNull(),
    userId: text('user_id').notNull(),
    /** Monotonic per (workout, device). Gaps are detectable. */
    seq: integer('seq').notNull(),
    deviceId: text('device_id').notNull(),
    at: text('at').notNull(),
    kind: text('kind').$type<WorkoutEventKind>().notNull(),
    /** JSON. Whatever the event needs — set id, weight, reps, rest seconds. */
    payload: text('payload').notNull().default('{}'),
  },
  (t) => [
    // ACCESS: idempotent replay. A re-sent event collides here and is ignored.
    uniqueIndex('workout_events_key').on(t.workoutId, t.deviceId, t.seq),
    // ACCESS: replay in order for one workout, and rest-interval analytics.
    index('workout_events_workout_at').on(t.workoutId, t.at),
  ],
);

/* ------------------------------------------------------------------------- */
/* 3. PRs, body, photos                                                       */
/* ------------------------------------------------------------------------- */

/**
 * Personal records. `is_current` marks the reigning record for a
 * (user, exercise, kind, rep_target); superseded rows are kept so the PR history
 * chart has something to draw.
 *
 * Merge policy is `max`: a PR value only ever goes up, and ties resolve to the
 * earliest `achieved_at`. That makes offline replay from two devices idempotent
 * without a coordinator.
 *
 * Units: `value` is kilograms for weight-based kinds, reps for rep kinds,
 * seconds for duration and metres for distance — read `kind` before reading
 * `value`.
 */
export const personalRecords = sqliteTable(
  'personal_records',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    exerciseId: text('exercise_id').notNull(),
    kind: text('kind').$type<PrKind>().notNull(),
    /** Only for rep-specific kinds, e.g. "best 5-rep set". */
    repTarget: integer('rep_target'),
    value: real('value').notNull(),
    weightKg: real('weight_kg'),
    reps: integer('reps'),
    setId: text('set_id'),
    workoutId: text('workout_id'),
    achievedAt: text('achieved_at').notNull(),
    previousValue: real('previous_value'),
    previousAchievedAt: text('previous_achieved_at'),
    isCurrent: integer('is_current').notNull().default(1),
    engineVersion: integer('engine_version').notNull().default(1),
    ...createdAt(),
    ...syncEnvelope(),
  },
  (t) => [
    // ACCESS: idempotent PR upsert during offline replay — two devices can both
    //         claim the same PR and must converge on one current row.
    uniqueIndex('pr_current_key')
      .on(t.userId, t.exerciseId, t.kind, sql`COALESCE(rep_target, -1)`)
      .where(sql`is_current = 1 AND deleted_at IS NULL`),
    // ACCESS: lifetime "total PRs" stat and the PR badge feed.
    index('pr_user_time').on(t.userId, t.achievedAt).where(sql`deleted_at IS NULL`),
    // ACCESS: the PR strip on an exercise's detail screen.
    index('pr_user_exercise').on(t.userId, t.exerciseId, t.kind).where(sql`deleted_at IS NULL`),
  ],
);

/**
 * Bodyweight log. Kilograms, always — an imperial user's 180 lb entry is stored
 * as 81.647 kg and rendered back as 180 lb, never re-rounded through kg twice.
 *
 * The unique key includes `source` so a HealthKit re-import updates its own row
 * instead of duplicating a manual weigh-in on the same day.
 */
export const bodyweightEntries = sqliteTable(
  'bodyweight_entries',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    measuredAt: text('measured_at').notNull(),
    localDate: text('local_date').notNull(),
    weightKg: real('weight_kg').notNull(),
    bodyFatPct: real('body_fat_pct'),
    source: text('source').$type<BodyweightSource>().notNull().default('manual'),
    note: text('note'),
    ...createdAt(),
    ...syncEnvelope(),
  },
  (t) => [
    // ACCESS: dedupe HealthKit re-imports on replay; one weigh-in per day per source.
    uniqueIndex('bw_user_day_key').on(t.userId, t.localDate, t.source).where(sql`deleted_at IS NULL`),
    // ACCESS: bodyweight chart ranges and the trend regression window.
    index('bw_user_time').on(t.userId, t.measuredAt).where(sql`deleted_at IS NULL`),
  ],
);

/**
 * Progress photos. Private by default (AGENTS.md constraint 5): the file lives
 * on the device, `storage_path` stays NULL until the user opts in and the upload
 * queue drains, and `content_hash` makes a re-queued file idempotent rather than
 * a second row.
 */
export const progressPhotos = sqliteTable(
  'progress_photos',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    bodyweightEntryId: text('bodyweight_entry_id'),
    takenAt: text('taken_at').notNull(),
    localDate: text('local_date').notNull(),
    pose: text('pose').$type<PhotoPose>().notNull().default('front'),
    /** Path inside the app's private document directory. Always present. */
    localPath: text('local_path'),
    /** Remote storage key. NULL until the upload queue drains. */
    storagePath: text('storage_path'),
    thumbPath: text('thumb_path'),
    contentHash: text('content_hash'),
    width: integer('width'),
    height: integer('height'),
    bytes: integer('bytes'),
    blurhash: text('blurhash'),
    weightKgAtCapture: real('weight_kg_at_capture'),
    attachmentState: text('attachment_state').$type<AttachmentState>().notNull().default('queued_upload'),
    uploadAttempts: integer('upload_attempts').notNull().default(0),
    lastError: text('last_error'),
    ...createdAt(),
    ...syncEnvelope(),
  },
  (t) => [
    // ACCESS: photo timeline and the "same pose, N months apart" comparison picker.
    index('photos_user_time').on(t.userId, t.takenAt, t.pose).where(sql`deleted_at IS NULL`),
    // ACCESS: replay-safe — the same file queued twice never creates two rows.
    uniqueIndex('photos_hash_key').on(t.userId, t.contentHash).where(sql`content_hash IS NOT NULL`),
    // ACCESS: the upload queue drains by state, oldest first.
    index('photos_upload_queue').on(t.attachmentState, t.createdAt).where(sql`deleted_at IS NULL`),
  ],
);

/* ------------------------------------------------------------------------- */
/* 4. Derived state                                                           */
/* ------------------------------------------------------------------------- */

/**
 * Per-muscle recovery state, one row per (user, muscle).
 *
 * This is a pure function of the workout history plus the bundled muscle model,
 * so its merge policy is `server_wins` and it is always safe to throw away and
 * recompute — which is exactly what recovery does after a crash. Muscle identity
 * is the catalog's stable muscle slug.
 */
export const muscleReadinessState = sqliteTable(
  'muscle_readiness_state',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    /** Stable muscle slug from the bundled catalog, e.g. 'rectus_femoris'. */
    muscleSlug: text('muscle_slug').notNull(),
    lastTrainedAt: text('last_trained_at'),
    /** Effective hard-set-weighted volume, kg. */
    lastStimulusLoad: real('last_stimulus_load').notNull().default(0),
    acuteLoad7d: real('acute_load_7d').notNull().default(0),
    chronicLoad28d: real('chronic_load_28d').notNull().default(0),
    /** 0..100. 100 means fully recovered. */
    readinessPct: real('readiness_pct').notNull().default(100),
    recoveryEta: text('recovery_eta'),
    computedAt: text('computed_at').notNull(),
    computedFromWorkoutId: text('computed_from_workout_id'),
    engineVersion: integer('engine_version').notNull().default(1),
    ...syncEnvelope(),
  },
  (t) => [
    // ACCESS: recovery ring and per-muscle chips; the upsert target of the
    //         on-device readiness engine.
    uniqueIndex('readiness_key').on(t.userId, t.muscleSlug),
  ],
);

/**
 * Strength standing, one row per (user, scope, key).
 *
 * `points` is the continuous 0..1000 score; `level` and `level_sub` are its
 * banded presentation. `percentile` is the only server-owned column here — it is
 * a cross-user fact and cannot be computed on device.
 */
export const strengthScores = sqliteTable(
  'strength_scores',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    scope: text('scope').$type<StrengthScope>().notNull(),
    /** Set when scope = 'exercise'. */
    exerciseId: text('exercise_id'),
    /** Set when scope = 'muscle_group'. */
    muscleGroupSlug: text('muscle_group_slug'),
    e1rmKg: real('e1rm_kg'),
    /** e1RM divided by bodyweight. Dimensionless. */
    relativeStrength: real('relative_strength'),
    points: real('points'),
    level: text('level').$type<StrengthLevel>(),
    /** 1..3, the sub-band: "Novice II". */
    levelSub: integer('level_sub'),
    levelProgressPct: real('level_progress_pct'),
    /** Server-owned. Null until the device has synced at least once. */
    percentile: real('percentile'),
    standardSetVersion: integer('standard_set_version'),
    bodyweightKg: real('bodyweight_kg'),
    sampleSetId: text('sample_set_id'),
    computedAt: text('computed_at').notNull(),
    engineVersion: integer('engine_version').notNull().default(1),
    ...syncEnvelope(),
  },
  (t) => [
    // ACCESS: idempotent upsert from the on-device engine after every workout.
    uniqueIndex('strength_scores_key')
      .on(t.userId, t.scope, sql`COALESCE(exercise_id, '')`, sql`COALESCE(muscle_group_slug, '')`),
    // ACCESS: the World Standings list, strongest lift first.
    index('strength_scores_user_points').on(t.userId, t.points).where(sql`deleted_at IS NULL`),
  ],
);

/* ------------------------------------------------------------------------- */
/* 5. Local-only bookkeeping (never synced)                                   */
/* ------------------------------------------------------------------------- */

/**
 * Probable duplicates found while merging two offline sessions, surfaced for the
 * user to resolve.
 *
 * Nothing here is ever auto-deleted. A wrongly dropped set destroys a PR, and
 * with it the user's trust in every number the app shows (research brief,
 * PART 3, claim.ts).
 */
export const mergeConflicts = sqliteTable(
  'merge_conflicts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    kind: text('kind').notNull(),
    aId: text('a_id').notNull(),
    bId: text('b_id').notNull(),
    workoutId: text('workout_id'),
    createdAt: text('created_at').notNull(),
    resolvedAt: text('resolved_at'),
    resolution: text('resolution'),
  },
  (t) => [
    // ACCESS: the "we found two versions of this set" prompt after recovery.
    index('merge_conflicts_open').on(t.userId, t.createdAt).where(sql`resolved_at IS NULL`),
  ],
);

/**
 * Key/value scratch space for the database layer itself: schema version, last
 * recovery outcome, the device id. Local only — it describes this installation,
 * not the user's data.
 */
export const localMeta = sqliteTable('local_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull(),
});

/* ------------------------------------------------------------------------- */
/* Row types                                                                  */
/* ------------------------------------------------------------------------- */

export type ProfileRow = typeof profiles.$inferSelect;
export type NewProfileRow = typeof profiles.$inferInsert;
export type WorkoutRow = typeof workouts.$inferSelect;
export type NewWorkoutRow = typeof workouts.$inferInsert;
export type WorkoutExerciseRow = typeof workoutExercises.$inferSelect;
export type NewWorkoutExerciseRow = typeof workoutExercises.$inferInsert;
export type SetRow = typeof sets.$inferSelect;
export type NewSetRow = typeof sets.$inferInsert;
export type WorkoutEventRow = typeof workoutEvents.$inferSelect;
export type NewWorkoutEventRow = typeof workoutEvents.$inferInsert;
export type PersonalRecordRow = typeof personalRecords.$inferSelect;
export type NewPersonalRecordRow = typeof personalRecords.$inferInsert;
export type BodyweightEntryRow = typeof bodyweightEntries.$inferSelect;
export type NewBodyweightEntryRow = typeof bodyweightEntries.$inferInsert;
export type ProgressPhotoRow = typeof progressPhotos.$inferSelect;
export type NewProgressPhotoRow = typeof progressPhotos.$inferInsert;
export type MuscleReadinessStateRow = typeof muscleReadinessState.$inferSelect;
export type NewMuscleReadinessStateRow = typeof muscleReadinessState.$inferInsert;
export type StrengthScoreRow = typeof strengthScores.$inferSelect;
export type NewStrengthScoreRow = typeof strengthScores.$inferInsert;
export type MergeConflictRow = typeof mergeConflicts.$inferSelect;
export type LocalMetaRow = typeof localMeta.$inferSelect;

/** Every table in the local schema, for migration and diagnostic tooling. */
export const schema = {
  profiles,
  workouts,
  workoutExercises,
  sets,
  workoutEvents,
  personalRecords,
  bodyweightEntries,
  progressPhotos,
  muscleReadinessState,
  strengthScores,
  mergeConflicts,
  localMeta,
} as const;

/**
 * Tables that replicate to Supabase, in dependency order. Local-only tables
 * (merge_conflicts, local_meta) are deliberately absent: they describe this
 * device, not the user's training history.
 */
export const SYNCED_TABLES = [
  'profiles',
  'workouts',
  'workout_exercises',
  'sets',
  'workout_events',
  'personal_records',
  'bodyweight_entries',
  'progress_photos',
  'muscle_readiness_state',
  'strength_scores',
] as const;
export type SyncedTable = (typeof SYNCED_TABLES)[number];
