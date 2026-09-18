/**
 * migrations.ts — the ordered list of schema migrations for the local database.
 *
 * Why hand-written SQL rather than `drizzle-kit generate` output: the generator
 * writes to a folder at the repository root and needs a root config file, and
 * the bundled-asset loader it ships for React Native adds a build step to the one
 * layer that must never fail to open. The statements here are the single source
 * of truth for what is on disk; `schema.ts` is the typed view of the same thing
 * and the two are kept in step by hand. `schema.test.ts` guards that pairing by
 * checking that every table and column in schema.ts appears in migration 1.
 *
 * Rules for adding a migration:
 *  - Never edit a migration that has shipped. Add a new one with the next
 *    version number. A user three days offline will replay exactly this list.
 *  - Every statement must be idempotent-safe under `IF NOT EXISTS` where SQLite
 *    allows it, because a migration can be interrupted by a force-kill. The
 *    runner wraps each migration in one transaction and bumps `user_version`
 *    inside it, so a half-applied migration rolls back whole.
 *  - SQLite cannot drop or retype a column in place. To change one, create the
 *    new table, copy, drop, rename — all inside the one migration.
 *
 * Storage conventions (see schema.ts): TEXT ids (ULID), TEXT ISO-8601 UTC
 * timestamps, INTEGER 0/1 booleans, REAL kilograms.
 */

export interface Migration {
  /** Monotonic. Matches PRAGMA user_version once applied. */
  readonly version: number;
  /** Human-readable, for logs and crash reports. */
  readonly name: string;
  /** Executed in order, inside one transaction. */
  readonly statements: readonly string[];
}

const initial: Migration = {
  version: 1,
  name: 'initial_schema',
  statements: [
    /* ── profiles ──────────────────────────────────────────────────────── */
    `CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY NOT NULL,
      handle TEXT NOT NULL,
      display_name TEXT,
      bio TEXT,
      avatar_path TEXT,
      is_pro INTEGER NOT NULL DEFAULT 0 CHECK (is_pro IN (0, 1)),
      sex TEXT NOT NULL DEFAULT 'unspecified' CHECK (sex IN ('male','female','unspecified')),
      birth_date TEXT,
      height_cm REAL,
      unit_system TEXT NOT NULL DEFAULT 'metric' CHECK (unit_system IN ('metric','imperial')),
      default_rest_s INTEGER NOT NULL DEFAULT 120,
      experience TEXT CHECK (experience IN ('beginner','intermediate','advanced')),
      profile_visibility TEXT NOT NULL DEFAULT 'public' CHECK (profile_visibility IN ('public','followers','private')),
      default_workout_visibility TEXT NOT NULL DEFAULT 'followers' CHECK (default_workout_visibility IN ('public','followers','private')),
      followers_count INTEGER NOT NULL DEFAULT 0,
      following_count INTEGER NOT NULL DEFAULT 0,
      workouts_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      rev_hlc TEXT NOT NULL DEFAULT '0',
      origin_device TEXT,
      deleted_at TEXT
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS profiles_handle_key ON profiles (handle) WHERE deleted_at IS NULL`,

    /* ── workouts ──────────────────────────────────────────────────────── */
    `CREATE TABLE IF NOT EXISTS workouts (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      routine_id TEXT,
      program_id TEXT,
      title TEXT NOT NULL DEFAULT 'Workout',
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','discarded')),
      started_at TEXT NOT NULL,
      ended_at TEXT,
      paused_ms INTEGER NOT NULL DEFAULT 0 CHECK (paused_ms >= 0),
      pause_started_at TEXT,
      tz TEXT NOT NULL DEFAULT 'UTC',
      local_date TEXT NOT NULL,
      active_device_id TEXT,
      claim_expires_at TEXT,
      claim_seq INTEGER NOT NULL DEFAULT 0,
      total_volume_kg REAL NOT NULL DEFAULT 0,
      total_reps INTEGER NOT NULL DEFAULT 0,
      total_sets INTEGER NOT NULL DEFAULT 0,
      total_exercises INTEGER NOT NULL DEFAULT 0,
      prs_count INTEGER NOT NULL DEFAULT 0,
      avg_rpe REAL,
      perceived_effort INTEGER CHECK (perceived_effort IS NULL OR perceived_effort BETWEEN 1 AND 10),
      visibility TEXT NOT NULL DEFAULT 'followers' CHECK (visibility IN ('public','followers','private')),
      like_count INTEGER NOT NULL DEFAULT 0,
      comment_count INTEGER NOT NULL DEFAULT 0,
      engine_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      rev_hlc TEXT NOT NULL DEFAULT '0',
      origin_device TEXT,
      deleted_at TEXT,
      CHECK (status <> 'completed' OR ended_at IS NOT NULL)
    )`,
    `CREATE INDEX IF NOT EXISTS workouts_user_recent ON workouts (user_id, started_at DESC)
       WHERE deleted_at IS NULL AND status = 'completed'`,
    `CREATE INDEX IF NOT EXISTS workouts_active ON workouts (user_id, started_at ASC)
       WHERE status = 'in_progress' AND deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS workouts_user_local_date ON workouts (user_id, local_date DESC)
       WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS workouts_routine_idx ON workouts (routine_id, started_at DESC)`,

    /* ── workout_exercises ─────────────────────────────────────────────── */
    `CREATE TABLE IF NOT EXISTS workout_exercises (
      id TEXT PRIMARY KEY NOT NULL,
      workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      exercise_id TEXT NOT NULL,
      exercise_slug TEXT,
      exercise_name_snapshot TEXT,
      contribution_version INTEGER NOT NULL DEFAULT 1,
      pos TEXT NOT NULL,
      superset_group TEXT,
      notes TEXT,
      rest_s INTEGER,
      volume_kg REAL NOT NULL DEFAULT 0,
      best_set_id TEXT,
      e1rm_kg REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      rev_hlc TEXT NOT NULL DEFAULT '0',
      origin_device TEXT,
      deleted_at TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS we_workout_idx ON workout_exercises (workout_id, pos) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS we_user_exercise_recent ON workout_exercises (user_id, exercise_id, created_at DESC)
       WHERE deleted_at IS NULL`,

    /* ── sets ──────────────────────────────────────────────────────────── */
    `CREATE TABLE IF NOT EXISTS sets (
      id TEXT PRIMARY KEY NOT NULL,
      workout_exercise_id TEXT NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
      workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      exercise_id TEXT NOT NULL,
      pos TEXT NOT NULL,
      set_type TEXT NOT NULL DEFAULT 'normal'
        CHECK (set_type IN ('warmup','normal','drop','failure','myorep','cluster','backoff','amrap')),
      parent_set_id TEXT REFERENCES sets(id) ON DELETE CASCADE,
      weight_kg REAL,
      reps INTEGER CHECK (reps IS NULL OR reps >= 0),
      rir REAL,
      rpe REAL CHECK (rpe IS NULL OR rpe BETWEEN 0 AND 10),
      duration_s INTEGER CHECK (duration_s IS NULL OR duration_s >= 0),
      distance_m REAL CHECK (distance_m IS NULL OR distance_m >= 0),
      effective_load_kg REAL,
      volume_kg REAL NOT NULL DEFAULT 0,
      e1rm_kg REAL,
      is_completed INTEGER NOT NULL DEFAULT 0 CHECK (is_completed IN (0, 1)),
      completed_at TEXT,
      is_pr INTEGER NOT NULL DEFAULT 0 CHECK (is_pr IN (0, 1)),
      pr_kinds TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      rev_hlc TEXT NOT NULL DEFAULT '0',
      origin_device TEXT,
      deleted_at TEXT,
      CHECK (is_completed = 0 OR completed_at IS NOT NULL)
    )`,
    `CREATE INDEX IF NOT EXISTS sets_we_idx ON sets (workout_exercise_id, pos) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS sets_user_exercise_time ON sets (user_id, exercise_id, completed_at DESC)
       WHERE deleted_at IS NULL AND is_completed = 1`,
    `CREATE INDEX IF NOT EXISTS sets_workout_idx ON sets (workout_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS sets_parent_idx ON sets (parent_set_id) WHERE parent_set_id IS NOT NULL`,

    /* ── workout_events (append-only black box) ────────────────────────── */
    `CREATE TABLE IF NOT EXISTS workout_events (
      id TEXT PRIMARY KEY NOT NULL,
      workout_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      device_id TEXT NOT NULL,
      at TEXT NOT NULL,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}'
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS workout_events_key ON workout_events (workout_id, device_id, seq)`,
    `CREATE INDEX IF NOT EXISTS workout_events_workout_at ON workout_events (workout_id, at)`,

    /* ── personal_records ──────────────────────────────────────────────── */
    `CREATE TABLE IF NOT EXISTS personal_records (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      exercise_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN
        ('e1rm','max_weight','max_reps','reps_at_weight','set_volume','session_volume','max_duration','max_distance')),
      rep_target INTEGER,
      value REAL NOT NULL,
      weight_kg REAL,
      reps INTEGER,
      set_id TEXT,
      workout_id TEXT,
      achieved_at TEXT NOT NULL,
      previous_value REAL,
      previous_achieved_at TEXT,
      is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0, 1)),
      engine_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      rev_hlc TEXT NOT NULL DEFAULT '0',
      origin_device TEXT,
      deleted_at TEXT
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS pr_current_key
       ON personal_records (user_id, exercise_id, kind, COALESCE(rep_target, -1))
       WHERE is_current = 1 AND deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS pr_user_time ON personal_records (user_id, achieved_at DESC) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS pr_user_exercise ON personal_records (user_id, exercise_id, kind) WHERE deleted_at IS NULL`,

    /* ── bodyweight_entries ────────────────────────────────────────────── */
    `CREATE TABLE IF NOT EXISTS bodyweight_entries (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      measured_at TEXT NOT NULL,
      local_date TEXT NOT NULL,
      weight_kg REAL NOT NULL CHECK (weight_kg > 0),
      body_fat_pct REAL CHECK (body_fat_pct IS NULL OR body_fat_pct BETWEEN 0 AND 100),
      source TEXT NOT NULL DEFAULT 'manual'
        CHECK (source IN ('manual','healthkit','health_connect','scale','import')),
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      rev_hlc TEXT NOT NULL DEFAULT '0',
      origin_device TEXT,
      deleted_at TEXT
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS bw_user_day_key ON bodyweight_entries (user_id, local_date, source)
       WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS bw_user_time ON bodyweight_entries (user_id, measured_at DESC) WHERE deleted_at IS NULL`,

    /* ── progress_photos ───────────────────────────────────────────────── */
    `CREATE TABLE IF NOT EXISTS progress_photos (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      bodyweight_entry_id TEXT REFERENCES bodyweight_entries(id) ON DELETE SET NULL,
      taken_at TEXT NOT NULL,
      local_date TEXT NOT NULL,
      pose TEXT NOT NULL DEFAULT 'front' CHECK (pose IN ('front','side_left','side_right','back','custom')),
      local_path TEXT,
      storage_path TEXT,
      thumb_path TEXT,
      content_hash TEXT,
      width INTEGER,
      height INTEGER,
      bytes INTEGER,
      blurhash TEXT,
      weight_kg_at_capture REAL,
      attachment_state TEXT NOT NULL DEFAULT 'queued_upload'
        CHECK (attachment_state IN ('queued_upload','uploading','synced','queued_delete','archived','failed')),
      upload_attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      rev_hlc TEXT NOT NULL DEFAULT '0',
      origin_device TEXT,
      deleted_at TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS photos_user_time ON progress_photos (user_id, taken_at DESC, pose) WHERE deleted_at IS NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS photos_hash_key ON progress_photos (user_id, content_hash)
       WHERE content_hash IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS photos_upload_queue ON progress_photos (attachment_state, created_at)
       WHERE deleted_at IS NULL`,

    /* ── muscle_readiness_state ────────────────────────────────────────── */
    `CREATE TABLE IF NOT EXISTS muscle_readiness_state (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      muscle_slug TEXT NOT NULL,
      last_trained_at TEXT,
      last_stimulus_load REAL NOT NULL DEFAULT 0,
      acute_load_7d REAL NOT NULL DEFAULT 0,
      chronic_load_28d REAL NOT NULL DEFAULT 0,
      readiness_pct REAL NOT NULL DEFAULT 100 CHECK (readiness_pct BETWEEN 0 AND 100),
      recovery_eta TEXT,
      computed_at TEXT NOT NULL,
      computed_from_workout_id TEXT,
      engine_version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      rev_hlc TEXT NOT NULL DEFAULT '0',
      origin_device TEXT,
      deleted_at TEXT
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS readiness_key ON muscle_readiness_state (user_id, muscle_slug)`,

    /* ── strength_scores ───────────────────────────────────────────────── */
    `CREATE TABLE IF NOT EXISTS strength_scores (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      scope TEXT NOT NULL CHECK (scope IN ('exercise','muscle_group','overall')),
      exercise_id TEXT,
      muscle_group_slug TEXT,
      e1rm_kg REAL,
      relative_strength REAL,
      points REAL CHECK (points IS NULL OR points BETWEEN 0 AND 1000),
      level TEXT CHECK (level IS NULL OR level IN
        ('untrained','novice','intermediate','advanced','elite','world_class')),
      level_sub INTEGER CHECK (level_sub IS NULL OR level_sub BETWEEN 1 AND 3),
      level_progress_pct REAL,
      percentile REAL,
      standard_set_version INTEGER,
      bodyweight_kg REAL,
      sample_set_id TEXT,
      computed_at TEXT NOT NULL,
      engine_version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      rev_hlc TEXT NOT NULL DEFAULT '0',
      origin_device TEXT,
      deleted_at TEXT
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS strength_scores_key
       ON strength_scores (user_id, scope, COALESCE(exercise_id, ''), COALESCE(muscle_group_slug, ''))`,
    `CREATE INDEX IF NOT EXISTS strength_scores_user_points ON strength_scores (user_id, points DESC)
       WHERE deleted_at IS NULL`,

    /* ── local-only bookkeeping ────────────────────────────────────────── */
    `CREATE TABLE IF NOT EXISTS merge_conflicts (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      a_id TEXT NOT NULL,
      b_id TEXT NOT NULL,
      workout_id TEXT,
      created_at TEXT NOT NULL,
      resolved_at TEXT,
      resolution TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS merge_conflicts_open ON merge_conflicts (user_id, created_at DESC)
       WHERE resolved_at IS NULL`,

    `CREATE TABLE IF NOT EXISTS local_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ],
};

/**
 * All migrations, in ascending version order. `runMigrations` in client.ts
 * applies every migration whose version is greater than PRAGMA user_version.
 */
export const MIGRATIONS: readonly Migration[] = [initial];

/** The schema version a fully-migrated database reports in PRAGMA user_version. */
export const LATEST_SCHEMA_VERSION: number = MIGRATIONS.reduce(
  (max, m) => (m.version > max ? m.version : max),
  0,
);
