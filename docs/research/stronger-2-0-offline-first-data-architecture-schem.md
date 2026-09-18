# Stronger 2.0 — offline-first data architecture: schema, local-first storage, sync protocol, crash safety, RLS, media and derived data

## Summary


Recommendation: build the client on Expo/React Native with a dev client, not a Next.js PWA, and put PowerSync between local SQLite and the existing Supabase Postgres. The deciding fact is storage durability on iOS. WebKit grants non-browser origins roughly 15% of disk versus 60% for browser apps, evicts script-created data (IndexedDB, Cache API, OPFS) under ITP and storage pressure, and grants persistent mode only "based on heuristics like whether the website is opened as a Home Screen Web App". An app whose promise is that a session survives a force-kill and a dead battery cannot rest on a discretionary, revocable storage grant. Secondary reasons: PowerSync's web path needs OPFSCoopSyncVFS, cannot use shared workers, syncs in one tab at a time, and can hang on connect when a previous context still holds the OPFS handle — all actively fixed, all in the layer that must never fail mid-set. Native also buys camera, HealthKit, background upload and Live Activities for the rest timer. The team's Next.js skill is not wasted: the marketing site and web dashboard use @powersync/web against the identical schema, and all business logic lives in one platform-free TypeScript package.

The local SQLite database is the system of record; Postgres is a replica. Every primary key is a client-generated UUIDv7 so inserts are idempotent and replay-safe. Every child collection is ordered by a fractional index string rather than an integer position, so two offline devices inserting at the same slot both survive with no renumber storm. Every mutable row carries a hybrid logical clock rather than a bare updated_at, because a phone that cold-boots after dying can return with a skewed clock and would then silently win or lose every conflict. Conflict resolution is a per-table policy table in code — lww_row, lww_field, server_wins, or_set, max, append_only — not one global rule. Likes and follows are OR-Sets of rows, so counters are derived by trigger and never merged. The hard case, one in-progress workout logged on two devices, gets an advisory device claim for prevention and a set-level merge for correctness: workouts are never picked as winner and loser, sets are re-parented by client id, and probable duplicates are surfaced for the user rather than deleted, because a wrongly dropped set destroys a PR and with it the user's trust.

Crash safety is explicit. SQLite defaults are not durable against power loss; the app runs WAL with synchronous=NORMAL for browsing and raises it to FULL (plus fullfsync on iOS) for the duration of a live workout. Writes happen on semantic events, never keystrokes. Elapsed time is never stored — duration derives from started_at and paused_ms — and an append-only workout_events table acts as a black box. recoverOnLaunch replays the WAL, merges duplicate live sessions, recomputes aggregates, then resumes, confirms, or auto-closes at the last real set.

Derived data splits cleanly: everything a user sees about themselves (readiness, e1RM, PRs, strength level, volume charts) computes on device from local tables plus a bundled catalog, so analytics are instant with no signal; only cross-user facts (percentiles, distributions, feed counters) compute in Postgres materialized views. The exercise catalog, aliases, muscle contributions and the 144k-row strength-standards grid ship as a read-only SQLite file ATTACHed to the user database, never synced — the app is fully functional before login. Catalog updates never break history: ids are permanent, deprecation is a redirect, names are snapshotted on every logged exercise, and muscle contributions are versioned so retuning the model cannot silently rewrite last year's charts.


## Findings

### iOS Safari storage eviction is the single strongest argument against the PWA path

WebKit's storage policy grants non-browser apps only ~15% of disk as origin quota (vs 60% for browser apps), and ITP evicts script-created data (IndexedDB, Cache API, OPFS) LRU when a site has not been interacted with. Home-screen web apps get their own days-of-use counter and can be granted persistent mode via StorageManager.persist(), but WebKit grants it 'based on heuristics like whether the website is opened as a Home Screen Web App' — i.e. it is discretionary, not contractual. For an app whose entire promise is 'your workout survives', a discretionary storage grant is not an acceptable foundation.

Source: https://webkit.org/blog/14403/updates-to-storage-policy/

### PowerSync is the most production-ready sync engine for Supabase and it already solves the exact hard parts

Client writes land in local SQLite immediately and are queued in a blocking FIFO `ps_crud` table; `ps_oplog` holds server operations grouped by bucket and is only promoted into `ps_data__<table>` at a consistent checkpoint, which is precisely the race (server update arrives before local upload is acked) that hand-rolled sync gets wrong. Write checkpoints ensure the client's own mutations are replicated before downloaded data is applied. Bulk download after a long offline period uses the identical mechanism as incremental streaming — no special 'resync' path to get wrong.

Source: https://docs.powersync.com/architecture/powersync-protocol + https://docs.powersync.com/architecture/client-architecture

### PowerSync reads bypass RLS entirely — sync rules are the read authorization boundary

PowerSync consumes a Postgres logical replication slot (requires wal_level=logical and a publication literally named `powersync`), which sees all rows regardless of RLS. Writes go back through PostgREST with the user's JWT, so RLS guards only the write path. Consequence for the build: sync-rules.yaml must be diff-reviewed as security-critical code, and client parameters must never be used for access control (a client can send any value) — only `request.jwt()` token parameters.

Source: https://docs.powersync.com/sync/rules/client-parameters

### SQLite's default settings are not durable against power loss — which is exactly the 'phone dying' case in the brief

In WAL mode with synchronous=NORMAL, a committed transaction survives an application crash but 'might roll back following a power loss'. Rollback-journal mode needs synchronous=EXTRA for real durability. On Apple platforms fsync() does not flush the drive write cache, so fullfsync must be enabled explicitly. Recommendation: WAL + synchronous=NORMAL for browsing, raised to FULL for the duration of a live workout (synchronous is settable per connection at runtime), plus fullfsync on iOS.

Source: https://avi.im/blag/2025/sqlite-fsync/

### PowerSync's attachment queue is a ready-made answer for progress photos

Built-in since @powersync/react-native (standalone @powersync/attachments is deprecated). Syncs small metadata rows through the sync engine while files go to Supabase Storage / R2 via signed URLs, with a state machine QUEUED_UPLOAD → UPLOADING → SYNCED → QUEUED_DELETE → ARCHIVED, automatic retry on the next sync interval, local-file integrity verification, and LRU cleanup at a cache cap. This is roughly 1,500 lines you do not have to write or debug.

Source: https://docs.powersync.com/usage/use-case-examples/attachments-files

### ElectricSQL is now read-path only and therefore cannot be the primary store for this app

Electric deliberately narrowed scope to the sync engine: it does Postgres→client shape sync over HTTP and 'doesn't support sending write queries to the sync engine' — you keep using REST/server actions for writes. The client-side database layer moved to TanStack DB, which only added persistence in 0.6 (March 2026). An app whose core loop is offline WRITES cannot be built on a read-only sync path without rebuilding the entire write/queue/conflict layer yourself.

Source: https://electric-sql.com/blog/2026/03/25/tanstack-db-0.6-app-ready-with-persistence-and-includes

### PowerSync free tier will not survive launch; budget for Pro immediately

Free: 2 GB synced/month, 500 MB hosted, 50 peak concurrent clients, and projects deactivate after one week of inactivity. Pro starts at $49/mo with 30 GB synced + 10 GB hosted + 1,000 peak clients included, then $1/GB and $30 per additional 1,000 clients. An Open Edition (source-available, self-hosted, Postgres supported) exists as an escape hatch and as leverage — it means PowerSync is not an unexitable dependency.

Source: https://www.powersync.com/pricing

### Supabase has no first-party offline sync and is not shipping one

Offline support is the most upvoted and most commented discussion in the entire Supabase GitHub organisation and remains unimplemented; Supabase's own blog instead documents third-party paths (WatermelonDB, Legend-State, PowerSync). Planning around a future first-party solution would be planning around vapor.

Source: https://supabase.com/blog/local-first-expo-legend-state

### Supabase RLS has two non-negotiable performance rules that materially change the schema

(1) Wrap auth.uid() as `(select auth.uid())` so Postgres builds an initPlan and caches it per statement instead of calling it per row. (2) 'A column counts as indexed only when it comes first in a btree index' — so follows(followee_id,…) and group_members(user_id,…) each need their own leading-column index, and every policy must name its role with `to authenticated`. Nested lookups belong in SECURITY DEFINER helpers in a private schema to avoid recursive policy evaluation.

Source: https://supabase.com/docs/guides/database/postgres/row-level-security

### The best current e1RM formula is weight-dependent and published with a large dataset

1RM = w * (1 + (r-1)^0.85 / (-2.55 + 4.58*ln(w))), fit on 303,494 near-failure sets from 14,966 users across 388 exercises spanning 16 muscle groups; reduces inconsistency 17–22% vs four classical benchmarks, with positive improvement on all 183 exercises having sufficient data. Epley (w*(1+r/30)) and Brzycki (w/(1.0278-0.0278r)) stay accurate only in the 2–10 rep range within ~2 reps of failure, which is why the schema stores `rir` and computes r_effective = reps + rir rather than assuming every set was to failure.

Source: https://arxiv.org/abs/2603.17495

### Exercise media licensing is a real constraint with a clean commercial answer

ExerciseDB: 1,394 exercises with matching GIFs, one-time purchase perpetual license, explicitly permits self-hosting the JSON+media on your own CDN or bundling in-app, but forbids re-publishing the raw set as a competing database/API. free-exercise-db is public domain (~800 exercises, stills). wger's catalog is CC-BY-SA 3.0 — share-alike makes it a poor base for a proprietary catalog. MuscleWiki has 1,900+ exercises / 7,700+ videos under its own API terms. Budget for licensing plus transcoding GIF→MP4 (roughly 30x size reduction).

Source: https://exercisedb.io/faq

### Strength standards have a credible public basis for the world-standings tab

Strength Level publishes 2026 standards for 287 exercises derived from 195,513,376 lifts by 27,893,268 users, segmented by sex, bodyweight and age; ExRx norms and Symmetric Strength provide independent methodology. Public tables are calibrated on trained adults 20–40 and need roughly −5% per decade after 40. Model this as a versioned `strength_standard_sets` + grid of (scope, key, sex, age_band, bodyweight node, level) rows with interpolation between nodes — ~144k rows, ~6 MB, small enough to ship in the bundled catalog and evaluate fully offline.

Source: https://strengthlevel.com/strength-standards

### PowerSync on Expo requires a dev client and op-sqlite, not Expo Go

@powersync/op-sqlite requires @op-engineering/op-sqlite >= 1.17.0 as a direct dependency (RN autolinking only sees direct deps), cannot coexist with @journeyapps/react-native-quick-sqlite, and the native adapter does not work in Expo Go's sandbox (a JS-only @powersync/adapter-sql-js fallback exists for Expo Go). Expo apps also need @azure/core-asynciterator-polyfill. op-sqlite is JSI-based and measurably faster than expo-sqlite on write-heavy and large-result-set workloads, which is what a sync engine is.

Source: https://docs.powersync.com/client-sdks/reference/react-native-and-expo

### SQLite-on-web persistence is workable but fragile in exactly the situation gyms produce

PowerSync's web SDK needs OPFSCoopSyncVFS for Safari multi-tab, shared web workers cannot use OPFS (so it uses one dedicated worker plus cross-tab messaging), only one tab syncs at a time, and db.connect() can hang when a previous context still holds the OPFS access handle — commonly triggered by a reload before release and by iOS freezing background tabs instead of closing them. These are actively-fixed bugs, not design flaws, but they are bugs in the layer that must never fail mid-workout.

Source: https://docs.powersync.com/client-sdks/reference/javascript-web

### Live workout duration must be derived from absolute anchors, and the lock-screen timer must be owned by the OS

iOS Live Activities should use the timerInterval initializer so the widget animates its own countdown independently of the app process; the app must not try to keep a ticking timer alive in the background. Combined with storing started_at + paused_ms rather than elapsed seconds, this makes duration correct after a force-kill, a battery death, or a 3-hour backgrounding — the durable workout row is the sole authority and startup reconciliation repairs any stale Live Activity.

Source: https://developer.apple.com/forums/thread/775968

## Recommendations

- Build the client as Expo (React Native) with a dev client, not a Next.js PWA — iOS grants home-screen web apps only heuristic, revocable persistent storage, and a lifting app cannot ship on a storage grant that Safari may withdraw.
- Keep Next.js for marketing, the web dashboard and share pages, and reuse the exact same @powersync/web SDK, schema and @stronger/engine package there — the team's Next.js+TS+Tailwind+Supabase skill transfers whole; only the shell changes.
- Adopt PowerSync Cloud against the existing Supabase Postgres as the sync engine, budget for the $49/mo Pro tier from launch, and keep PowerSync Open Edition self-hosting as a documented escape hatch.
- Use op-sqlite (>=1.17) as the SQLite driver via @powersync/op-sqlite, remove @journeyapps/react-native-quick-sqlite, and add the async-iterator polyfill required by Expo.
- Generate every primary key on the client as UUIDv7 so inserts are idempotent, replay-safe and btree-friendly, and never depend on a server round-trip to create a row.
- Order every child collection with fractional index strings (pos text), never integer positions, so two offline devices inserting sets at the same slot both survive without a renumber storm.
- Stamp every mutable row with a hybrid logical clock (rev_hlc text) instead of trusting updated_at, because a phone that cold-boots after dying can return with a skewed wall clock.
- Make conflict resolution a per-table policy table in code (lww_row / lww_field / server_wins / or_set / max / append_only) rather than a global LWW rule, and treat likes and follows as OR-Sets of rows so counters are never merged.
- Never merge an in-progress workout at the workout level — merge at the set level by client-generated id, keep every logged set, and surface probable duplicates as a user-resolvable conflict instead of silently deleting performed work.
- Add an advisory device claim (active_device_id + claim_expires_at + claim_seq) on in-progress workouts to prevent the common two-device case, while treating the set-level merge as the correctness guarantee.
- Run the database WAL + synchronous=NORMAL for browsing and raise synchronous to FULL (plus fullfsync on iOS) for the duration of a live workout, so a set that shows a checkmark has survived fsync.
- Persist on semantic events only — set completed, exercise added, field blurred, 400ms debounce, app backgrounded — never on keystroke, and never persist elapsed time; derive duration from started_at and paused_ms.
- Write an append-only workout_events table alongside the mutable tables as a black box that can rebuild a session and that doubles as the source for rest-interval analytics.
- Run recoverOnLaunch before the first frame: replay WAL, merge duplicate active workouts, recompute aggregates, then resume (<3h idle), confirm (<18h), or auto-close at the last real set.
- Ship the exercise catalog, aliases, muscle contributions and strength standards as a bundled read-only SQLite file ATTACHed to the user database, and keep it out of the sync engine entirely.
- Make exercise ids permanent — deprecate and redirect via merged_into_id plus a flattened exercise_redirects table, and snapshot exercise_slug and name on every workout_exercises row.
- Version muscle contributions (contribution_version) and record the version used on each logged exercise, so retuning the muscle model never silently rewrites a user's historical charts without an explicit recalculation.
- Compute everything a user sees about themselves on device via one shared, versioned TypeScript engine, and compute only cross-user facts (percentiles, distributions, feed counters, leaderboards) in Postgres materialized views refreshed by pg_cron.
- Run the same engine bundle in a Deno edge function on workout completion to write authoritative derived rows, and mark every derived row with engine_version so a formula change triggers background recompute rather than a silent history rewrite.
- Store rir on every set and compute e1RM with the weight-dependent equation using r_effective = reps + rir, rather than applying Epley to sets that were nowhere near failure.
- Wrap auth.uid() in (select …) in every RLS policy, name the role with `to authenticated`, and add a leading-column index on every column a policy filters — follows(followee_id), follows(follower_id), group_members(user_id).
- Move sex, birth_date and height_cm out of profiles into an own-row-only private_profiles table, because RLS is row-level and cannot hide columns from a follower who can read the row.
- Treat sync-rules.yaml as security-critical code with mandatory review, since PowerSync reads bypass RLS and a wrong bucket definition leaks data that no policy will catch.
- Serve exercise demo media as ~60KB content-addressed MP4 loops on Cloudflare R2 with immutable year-long cache headers, bundle the top ~150 in the binary, and never ship GIFs.
- Keep progress photos in a private Supabase bucket partitioned by user id with storage.foldername RLS, strip EXIF and resize on device before upload, use signed upload URLs, default to wifi-only, and cache the file rather than the signed URL.
- Use PowerSync's built-in attachment queue for photos instead of hand-rolling an upload state machine, and let photos render from local files so comparisons work with no signal.
- Make apply_mutations an idempotency-gated RPC keyed on a client-generated mutation_id with ON CONFLICT DO NOTHING, so at-least-once delivery becomes exactly-once application.
- Quarantine permanently-rejected mutations (FK, CHECK, RLS, bad input) into a dead-letter table and complete the transaction, because PowerSync's upload queue is blocking FIFO and one poison message stops all future sync.
- Use soft deletes with deleted_at as tombstones, hard-purge at 90 days via pg_cron, and state 90 days as the maximum supported offline window in both docs and telemetry.

## Data


================================================================================
PART 0 — CONVENTIONS (apply to every synced table)
================================================================================
- PK is always `id uuid` GENERATED ON THE CLIENT as UUIDv7 (time-ordered → good
  btree locality, no server round-trip, insert is idempotent via ON CONFLICT).
- Every syncable table carries the "sync envelope":
    updated_at  timestamptz not null default now()
    rev_hlc     text        not null   -- hybrid logical clock, lexicographically sortable
    origin_device uuid                  -- who last wrote
    deleted_at  timestamptz            -- soft delete = tombstone
- Ordering is NEVER an integer `position`. It is `pos text` (fractional index,
  LexoRank alphabet). Two offline devices inserting "between set 2 and 3"
  produce different keys and both survive. Integer positions require a
  renumber-write across siblings = guaranteed conflict storm.
- Enums are `text` + CHECK, not Postgres ENUM types: PowerSync/SQLite maps them
  to TEXT anyway, and `ALTER TYPE ... ADD VALUE` cannot run inside a migration
  transaction.
- Money/mass are `numeric(8,3)` on the server, REAL on the client. Store kg
  always; unit is a display preference (profiles.unit_system).
- Booleans on the client are INTEGER 0/1 (SQLite has no bool; PowerSync only
  supports TEXT/INTEGER/REAL).

================================================================================
PART 1 — FULL POSTGRES DDL
================================================================================

```sql
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;      -- exercise fuzzy search
create extension if not exists btree_gin;
create extension if not exists pg_cron;      -- nightly rollups, tombstone purge

-- ── shared sync trigger ────────────────────────────────────────────────────
create or replace function public.touch_row() returns trigger
language plpgsql as $$
begin
  new.updated_at := greatest(now(), coalesce(old.updated_at, 'epoch'::timestamptz) + interval '1 microsecond');
  if new.rev_hlc is null or (old is not null and new.rev_hlc = old.rev_hlc) then
    -- server-side HLC: microsecond epoch + counter + node id
    new.rev_hlc := lpad(to_char(extract(epoch from clock_timestamp())*1e6, 'FM9999999999999999'), 16, '0')
                   || '-0000-' || 'srv';
  end if;
  return new;
end $$;

-- ═══════════════════ 1. IDENTITY ═══════════════════════════════════════════
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  handle         text not null,
  display_name   text,
  bio            text,
  avatar_path    text,                       -- storage key, not URL
  is_pro         boolean not null default false,
  sex            text check (sex in ('male','female','unspecified')) default 'unspecified',
  birth_date     date,
  height_cm      numeric(5,1),
  unit_system    text not null default 'metric' check (unit_system in ('metric','imperial')),
  default_rest_s int  not null default 120,
  experience     text check (experience in ('beginner','intermediate','advanced')),
  -- visibility defaults
  profile_visibility text not null default 'public'
                 check (profile_visibility in ('public','followers','private')),
  default_workout_visibility text not null default 'followers'
                 check (default_workout_visibility in ('public','followers','private')),
  followers_count int not null default 0,     -- SERVER-OWNED (trigger)
  following_count int not null default 0,     -- SERVER-OWNED
  workouts_count  int not null default 0,     -- SERVER-OWNED
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  rev_hlc        text not null default '0',
  origin_device  uuid,
  deleted_at     timestamptz
);
create unique index profiles_handle_key on public.profiles (lower(handle)) where deleted_at is null;
-- ACCESS: @handle lookup from search + deep links.
create index profiles_handle_trgm on public.profiles using gin (lower(handle) gin_trgm_ops);
-- ACCESS: type-ahead user search in Community tab.
create trigger profiles_touch before insert or update on public.profiles
  for each row execute function public.touch_row();

create table public.user_devices (
  id            uuid primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  platform      text not null check (platform in ('ios','android','web')),
  app_version   text not null,
  schema_version int not null,
  push_token    text,
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index user_devices_user_idx on public.user_devices (user_id, last_seen_at desc);
-- ACCESS: "you have an unfinished workout on iPhone"; push fan-out.

create table public.follows (
  id           uuid primary key,
  follower_id  uuid not null references auth.users(id) on delete cascade,
  followee_id  uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'accepted' check (status in ('pending','accepted','blocked')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  rev_hlc      text not null default '0',
  origin_device uuid,
  deleted_at   timestamptz,
  constraint follows_no_self check (follower_id <> followee_id)
);
create unique index follows_pair_key on public.follows (follower_id, followee_id);
-- ACCESS: "am I following X" + idempotent re-follow after offline replay.
create index follows_followee_idx on public.follows (followee_id, status) where deleted_at is null;
-- ACCESS: RLS followers-only check + follower list. MUST be leading column (a
--         composite (follower_id, followee_id) index does NOT serve this).
create index follows_follower_idx on public.follows (follower_id, status) where deleted_at is null;
-- ACCESS: feed fan-in ("posts by people I follow").

create table public.blocks (
  id uuid primary key,
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index blocks_pair_key on public.blocks (blocker_id, blocked_id);

-- ═══════════════════ 2. EXERCISE CATALOG (server-owned, global) ════════════
create table public.catalog_versions (
  id           int primary key,            -- monotonic, e.g. 20260918
  released_at  timestamptz not null default now(),
  checksum     text not null,              -- sha256 of the shipped catalog.db
  bundle_path  text not null,              -- storage key of catalog.db + media manifest
  min_app_version text not null,
  notes        text
);

create table public.muscles (
  id            uuid primary key,
  slug          text not null unique,      -- 'rectus_femoris'
  name          text not null,
  group_slug    text not null,             -- 'quadriceps'
  region        text not null check (region in ('upper','lower','core','arms','back','chest','shoulders','legs','glutes','other')),
  body_side     text not null default 'anterior' check (body_side in ('anterior','posterior','both')),
  svg_region_id text,                      -- key into the anatomical body-map SVG
  recovery_hours_baseline int not null default 48,  -- drives readiness model
  sort          int not null default 0
);

create table public.equipment (
  id uuid primary key, slug text not null unique, name text not null,
  category text not null check (category in ('barbell','dumbbell','machine','cable','bodyweight','kettlebell','band','other')),
  icon text
);

create table public.exercises (
  id                uuid primary key,
  slug              text not null,
  name              text not null,
  catalog_version   int references public.catalog_versions(id),
  equipment_id      uuid references public.equipment(id),
  movement_pattern  text check (movement_pattern in
      ('horizontal_push','vertical_push','horizontal_pull','vertical_pull','squat',
       'hinge','lunge','carry','rotation','isolation','olympic','plyometric','cardio','other')),
  mechanic          text check (mechanic in ('compound','isolation')),
  force_vector      text check (force_vector in ('push','pull','static')),
  laterality        text not null default 'bilateral'
                    check (laterality in ('bilateral','unilateral_alternating','unilateral_separate')),
  -- how a set of this exercise is MEASURED. Drives the set-table UI + volume math.
  metric            text not null default 'weight_reps' check (metric in
      ('weight_reps','bodyweight_reps','weighted_bodyweight','assisted_bodyweight',
       'reps_only','duration','weight_duration','distance_duration','distance_only')),
  bodyweight_factor numeric(4,3) not null default 0,  -- push-up 0.64, pull-up 1.0, dip 1.0
  difficulty        text check (difficulty in ('beginner','intermediate','advanced')),
  is_custom         boolean not null default false,
  owner_id          uuid references auth.users(id) on delete cascade, -- non-null iff is_custom
  linked_exercise_id uuid references public.exercises(id),  -- custom → canonical mapping
  standard_key      text,                   -- join key into strength_standards
  instructions      jsonb not null default '[]'::jsonb,
  coach_tips        jsonb not null default '[]'::jsonb,
  source            text, license text, attribution text,
  deprecated_at     timestamptz,
  merged_into_id    uuid references public.exercises(id),  -- NEVER delete, always redirect
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  rev_hlc           text not null default '0',
  origin_device     uuid,
  deleted_at        timestamptz,
  constraint exercises_custom_owner check ((is_custom) = (owner_id is not null))
);
create unique index exercises_slug_key on public.exercises (slug) where is_custom = false;
create index exercises_name_trgm on public.exercises using gin (name gin_trgm_ops);
-- ACCESS: "bench" → Barbell Bench Press, in <5ms, offline (mirrored as FTS5 on device).
create index exercises_owner_idx on public.exercises (owner_id) where is_custom;
-- ACCESS: sync rule bucket "my custom exercises".
create index exercises_equipment_idx on public.exercises (equipment_id) where deleted_at is null;
-- ACCESS: Exercises tab equipment filter chips.

create table public.exercise_aliases (
  id uuid primary key,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  alias text not null, locale text not null default 'en',
  source text
);
create index exercise_aliases_lookup on public.exercise_aliases using gin (alias gin_trgm_ops);
create unique index exercise_aliases_key on public.exercise_aliases (exercise_id, lower(alias), locale);
-- ACCESS: "DB bench", "flat bench", "supino reto" all resolve to one exercise.

create table public.exercise_muscles (
  id uuid primary key,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  muscle_id   uuid not null references public.muscles(id),
  role        text not null check (role in ('primary','secondary','stabilizer')),
  contribution numeric(4,3) not null check (contribution between 0 and 1),
  contribution_version int not null default 1,   -- bumped when we retune the model
  constraint exercise_muscles_uq unique (exercise_id, muscle_id, contribution_version)
);
create index exercise_muscles_ex_idx on public.exercise_muscles (exercise_id, contribution_version);
-- ACCESS: per-set volume → per-muscle attribution (readiness, split breakdown, body map).
create index exercise_muscles_muscle_idx on public.exercise_muscles (muscle_id, role);
-- ACCESS: body-map filter chip "show me everything that hits lats".

create table public.exercise_media (
  id uuid primary key,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  kind    text not null check (kind in ('loop_mp4','loop_webm','loop_webp','poster','thumb','svg_map')),
  variant text not null default 'default',      -- '360','480','720'
  storage_path text not null,                   -- r2://exercise-media/<sha256>.mp4
  content_hash text not null,                   -- immutable cache key
  width int, height int, bytes int, duration_ms int,
  license text, attribution text,
  sort int not null default 0
);
create unique index exercise_media_key on public.exercise_media (exercise_id, kind, variant);
create index exercise_media_hash_idx on public.exercise_media (content_hash);
-- ACCESS: content-addressed disk cache; identical loops dedupe across variants.

create table public.exercise_redirects (   -- flattened transitive closure of merged_into_id
  from_id uuid primary key,
  to_id   uuid not null references public.exercises(id),
  reason  text, created_at timestamptz not null default now()
);
-- ACCESS: single-join id resolution on device; no recursive CTE in SQLite.

-- ═══════════════════ 3. ROUTINES / PROGRAMS ════════════════════════════════
create table public.routine_folders (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, pos text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  rev_hlc text not null default '0', origin_device uuid, deleted_at timestamptz
);
create index routine_folders_user_idx on public.routine_folders (user_id) where deleted_at is null;

create table public.programs (
  id uuid primary key,
  owner_id uuid references auth.users(id) on delete set null,
  name text not null, description text, author_name text,
  weeks int, days_per_week int, goal text,
  is_public boolean not null default false,
  fork_of_id uuid references public.programs(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  rev_hlc text not null default '0', origin_device uuid, deleted_at timestamptz
);
create index programs_public_idx on public.programs (is_public, updated_at desc) where deleted_at is null;

create table public.routines (
  id uuid primary key,
  user_id   uuid not null references auth.users(id) on delete cascade,
  folder_id uuid references public.routine_folders(id) on delete set null,
  program_id uuid references public.programs(id) on delete set null,
  program_week int, program_day int,
  name text not null, notes text, pos text not null,
  estimated_duration_s int,
  last_performed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  rev_hlc text not null default '0', origin_device uuid, deleted_at timestamptz
);
create index routines_user_idx on public.routines (user_id, deleted_at, pos);
-- ACCESS: Train tab list, ordered, excluding tombstones.
create index routines_program_idx on public.routines (program_id, program_week, program_day);
-- ACCESS: "next workout in your program" suggestion on the Log tab.

create table public.routine_exercises (
  id uuid primary key,
  routine_id uuid not null references public.routines(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id),
  exercise_slug text,                      -- resilience: survives id loss
  pos text not null, superset_group text,
  notes text, rest_s int,
  target_sets int, target_reps_low int, target_reps_high int,
  target_rpe numeric(3,1), target_weight_kg numeric(8,3), target_pct_1rm numeric(4,1),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  rev_hlc text not null default '0', origin_device uuid, deleted_at timestamptz
);
create index routine_exercises_routine_idx on public.routine_exercises (routine_id, pos) where deleted_at is null;

create table public.routine_sets (
  id uuid primary key,
  routine_exercise_id uuid not null references public.routine_exercises(id) on delete cascade,
  pos text not null,
  set_type text not null default 'normal' check (set_type in
      ('warmup','normal','drop','failure','myorep','cluster','backoff','amrap')),
  target_reps int, target_weight_kg numeric(8,3), target_rpe numeric(3,1), target_pct_1rm numeric(4,1),
  updated_at timestamptz not null default now(), rev_hlc text not null default '0',
  origin_device uuid, deleted_at timestamptz
);
create index routine_sets_parent_idx on public.routine_sets (routine_exercise_id, pos) where deleted_at is null;

-- ═══════════════════ 4. WORKOUTS (the hot path) ════════════════════════════
create table public.workouts (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  routine_id  uuid references public.routines(id) on delete set null,
  program_id  uuid references public.programs(id) on delete set null,
  title       text not null default 'Workout',
  notes       text,
  status      text not null default 'in_progress'
              check (status in ('in_progress','completed','discarded')),
  -- TIME: never store elapsed seconds. Store absolute anchors + pause ledger.
  started_at  timestamptz not null,
  ended_at    timestamptz,
  paused_ms   bigint not null default 0,
  pause_started_at timestamptz,
  tz          text not null default 'UTC',
  local_date  date generated always as (((started_at at time zone tz))::date) stored,
  -- device ownership of an in-progress session (see PART 6 claim protocol)
  active_device_id uuid, claim_expires_at timestamptz, claim_seq bigint not null default 0,
  -- CLIENT-OWNED aggregates (recomputed server-side on completion; server wins)
  total_volume_kg numeric(12,3) not null default 0,
  total_reps      int not null default 0,
  total_sets      int not null default 0,
  total_exercises int not null default 0,
  prs_count       int not null default 0,
  avg_rpe         numeric(3,1),
  perceived_effort int check (perceived_effort between 1 and 10),
  visibility  text not null default 'followers' check (visibility in ('public','followers','private')),
  like_count    int not null default 0,   -- SERVER-OWNED
  comment_count int not null default 0,   -- SERVER-OWNED
  engine_version int not null default 1,  -- which derived-stat model produced the aggregates
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  rev_hlc text not null default '0', origin_device uuid, deleted_at timestamptz,
  constraint workouts_ended check (status <> 'completed' or ended_at is not null)
);
create index workouts_user_recent on public.workouts (user_id, started_at desc)
  where deleted_at is null and status = 'completed';
-- ACCESS: Log tab history "This week / Last week", infinite scroll. THE hottest query.
create unique index workouts_one_active on public.workouts (user_id)
  where status = 'in_progress' and deleted_at is null;
-- ACCESS: enforces "one live session per user"; also the recovery-on-launch probe.
--         NOTE: this is deliberately a *server-side* guard. The client tolerates two
--         (see mergeDuplicateActiveWorkouts) because two devices can create
--         concurrently offline and neither insert may be rejected at write time.
create index workouts_user_local_date on public.workouts (user_id, local_date desc)
  where deleted_at is null;
-- ACCESS: week strip calendar dots, profile heatmap (6 months of day buckets).
create index workouts_routine_idx on public.workouts (routine_id, started_at desc);
-- ACCESS: "last time you did Push Day".
create index workouts_public_feed on public.workouts (visibility, started_at desc)
  where deleted_at is null and status='completed' and visibility <> 'private';
-- ACCESS: Discover feed.

create table public.workout_exercises (
  id uuid primary key,
  workout_id  uuid not null references public.workouts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade, -- denormalized for RLS + index
  exercise_id uuid not null references public.exercises(id),
  exercise_slug text,
  exercise_name_snapshot text,             -- what the user saw, frozen
  contribution_version int not null default 1, -- muscle model used at log time
  pos text not null, superset_group text,
  notes text, rest_s int,
  volume_kg numeric(12,3) not null default 0,
  best_set_id uuid, e1rm_kg numeric(8,3),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  rev_hlc text not null default '0', origin_device uuid, deleted_at timestamptz
);
create index we_workout_idx on public.workout_exercises (workout_id, pos) where deleted_at is null;
-- ACCESS: render the active/《historical》workout screen top-to-bottom.
create index we_user_exercise_recent on public.workout_exercises (user_id, exercise_id, created_at desc)
  where deleted_at is null;
-- ACCESS: the "Previous" column — last time this user did this exercise. Runs on
--         EVERY exercise added to a live workout, offline. Must be O(log n).

create table public.sets (
  id uuid primary key,
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade,  -- denormalized
  user_id    uuid not null references auth.users(id) on delete cascade,       -- denormalized (RLS)
  exercise_id uuid not null references public.exercises(id),                  -- denormalized (analytics)
  pos text not null,
  set_type text not null default 'normal' check (set_type in
      ('warmup','normal','drop','failure','myorep','cluster','backoff','amrap')),
  parent_set_id uuid references public.sets(id) on delete cascade,  -- drop/myorep chain
  weight_kg numeric(8,3), reps int, rir numeric(3,1), rpe numeric(3,1),
  duration_s int, distance_m numeric(9,2),
  effective_load_kg numeric(8,3),   -- weight + bodyweight_factor*bw  (client-computed)
  volume_kg numeric(10,3) not null default 0,
  e1rm_kg   numeric(8,3),
  is_completed boolean not null default false,
  completed_at timestamptz,
  is_pr boolean not null default false, pr_kinds text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  rev_hlc text not null default '0', origin_device uuid, deleted_at timestamptz
);
create index sets_we_idx on public.sets (workout_exercise_id, pos) where deleted_at is null;
-- ACCESS: set table rendering; the single most frequent read in the app.
create index sets_user_exercise_time on public.sets (user_id, exercise_id, completed_at desc)
  where deleted_at is null and is_completed;
-- ACCESS: e1RM sparkline per exercise, PR detection, "Previous" values, 1W/1M/3M/6M/1Y filters.
create index sets_workout_idx on public.sets (workout_id) where deleted_at is null;
-- ACCESS: finish-summary aggregation (sum volume/reps in one scan).
create index sets_parent_idx on public.sets (parent_set_id) where parent_set_id is not null;
-- ACCESS: expand a drop-set chain.

-- append-only black box; never UPDATEd, so it cannot be corrupted by a partial write
create table public.workout_events (
  id uuid primary key,
  workout_id uuid not null, user_id uuid not null,
  seq bigint not null, device_id uuid not null,
  at timestamptz not null,
  kind text not null,   -- 'workout_start','set_complete','set_edit','rest_start','exercise_add',...
  payload jsonb not null default '{}'::jsonb
);
create unique index workout_events_key on public.workout_events (workout_id, device_id, seq);
-- ACCESS: idempotent replay + forensic reconstruction + rest-interval analytics.

-- ═══════════════════ 5. PRs, BODY, PHOTOS ══════════════════════════════════
create table public.personal_records (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id),
  kind text not null check (kind in
      ('e1rm','max_weight','max_reps','reps_at_weight','set_volume','session_volume','max_duration','max_distance')),
  rep_target int,                        -- for 'reps_at_weight' / rep-specific PRs
  value numeric(12,3) not null,
  weight_kg numeric(8,3), reps int,
  set_id uuid, workout_id uuid,
  achieved_at timestamptz not null,
  previous_value numeric(12,3), previous_achieved_at timestamptz,
  is_current boolean not null default true,
  engine_version int not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  rev_hlc text not null default '0', origin_device uuid, deleted_at timestamptz
);
create unique index pr_current_key on public.personal_records
  (user_id, exercise_id, kind, coalesce(rep_target, -1)) where is_current and deleted_at is null;
-- ACCESS: idempotent PR upsert during offline replay (two devices can both claim a PR).
create index pr_user_time on public.personal_records (user_id, achieved_at desc) where deleted_at is null;
-- ACCESS: "total PRs" lifetime stat + PR badge feed.

create table public.bodyweight_entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_at timestamptz not null,
  local_date date not null,
  weight_kg numeric(6,3) not null,
  body_fat_pct numeric(4,1),
  source text not null default 'manual' check (source in ('manual','healthkit','health_connect','scale','import')),
  note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  rev_hlc text not null default '0', origin_device uuid, deleted_at timestamptz
);
create unique index bw_user_day_key on public.bodyweight_entries (user_id, local_date, source)
  where deleted_at is null;
-- ACCESS: dedupe HealthKit re-imports on replay; one canonical weigh-in per day per source.
create index bw_user_time on public.bodyweight_entries (user_id, measured_at desc) where deleted_at is null;
-- ACCESS: Bodyweight chart 1M/3M/6M/1Y/All; trend + projection regression window.

create table public.body_measurements (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  measured_at timestamptz not null, site text not null, value_cm numeric(6,2) not null,
  updated_at timestamptz not null default now(), rev_hlc text not null default '0',
  origin_device uuid, deleted_at timestamptz
);
create index bm_user_site_time on public.body_measurements (user_id, site, measured_at desc);

create table public.progress_photos (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  bodyweight_entry_id uuid references public.bodyweight_entries(id) on delete set null,
  taken_at timestamptz not null, local_date date not null,
  pose text not null default 'front' check (pose in ('front','side_left','side_right','back','custom')),
  storage_path text,        -- NULL until the upload queue drains
  thumb_path  text,
  content_hash text,        -- sha256, dedupe + idempotent upload
  width int, height int, bytes int, blurhash text,
  weight_kg_at_capture numeric(6,3),
  attachment_state text not null default 'queued_upload'
      check (attachment_state in ('queued_upload','uploading','synced','queued_delete','archived','failed')),
  upload_attempts int not null default 0, last_error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  rev_hlc text not null default '0', origin_device uuid, deleted_at timestamptz
);
create index photos_user_time on public.progress_photos (user_id, taken_at desc, pose) where deleted_at is null;
-- ACCESS: photo timeline + "same pose, N months apart" side-by-side comparison picker.
create unique index photos_hash_key on public.progress_photos (user_id, content_hash) where content_hash is not null;
-- ACCESS: replay-safe: the same file queued twice never creates two rows.

create table public.photo_comparisons (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  before_photo_id uuid not null references public.progress_photos(id) on delete cascade,
  after_photo_id  uuid not null references public.progress_photos(id) on delete cascade,
  caption text, is_shared boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  rev_hlc text not null default '0', origin_device uuid, deleted_at timestamptz
);

-- ═══════════════════ 6. DERIVED STATE ══════════════════════════════════════
create table public.muscle_readiness_state (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  muscle_id uuid not null references public.muscles(id),
  last_trained_at timestamptz,
  last_stimulus_load numeric(12,3) not null default 0,   -- effective hard-set-weighted volume
  acute_load_7d numeric(12,3) not null default 0,
  chronic_load_28d numeric(12,3) not null default 0,
  readiness_pct numeric(5,2) not null default 100,
  recovery_eta timestamptz,
  computed_at timestamptz not null default now(),
  computed_from_workout_id uuid,
  engine_version int not null default 1,
  updated_at timestamptz not null default now(), rev_hlc text not null default '0',
  origin_device uuid, deleted_at timestamptz
);
create unique index readiness_key on public.muscle_readiness_state (user_id, muscle_id);
-- ACCESS: recovery ring + per-muscle chips; upsert target for the on-device engine.

create table public.recovery_daily (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null, resting_hr int, hrv_ms int, sleep_hours numeric(4,2),
  sleep_score int, soreness int check (soreness between 1 and 10),
  capacity_score int check (capacity_score between 0 and 100),
  source text not null default 'manual',
  updated_at timestamptz not null default now(), rev_hlc text not null default '0',
  origin_device uuid, deleted_at timestamptz
);
create unique index recovery_daily_key on public.recovery_daily (user_id, local_date);

create table public.strength_standard_sets (
  id uuid primary key, version int not null unique, source text not null,
  methodology text, published_at timestamptz not null default now(), checksum text not null
);

create table public.strength_standards (
  id uuid primary key,
  standard_set_id uuid not null references public.strength_standard_sets(id) on delete cascade,
  scope text not null check (scope in ('exercise','muscle_group','overall')),
  key text not null,                -- exercise standard_key | muscle group_slug | 'overall'
  sex  text not null check (sex in ('male','female')),
  age_band text not null default '20-39',
  bodyweight_kg numeric(5,1) not null,       -- lookup grid node; interpolate between nodes
  level text not null check (level in ('untrained','novice','intermediate','advanced','elite','world_class')),
  value_kg numeric(8,3) not null,            -- e1RM threshold at this node
  percentile numeric(5,2)
);
create unique index std_node_key on public.strength_standards
  (standard_set_id, scope, key, sex, age_band, bodyweight_kg, level);
create index std_lookup on public.strength_standards (scope, key, sex, age_band, bodyweight_kg);
-- ACCESS: the World Standings tab. Whole table is ~6 levels x 30 bw nodes x 2 sexes x
--         ~400 keys ≈ 144k rows ≈ 6 MB → SHIP IT IN THE BUNDLED CATALOG DB, never sync it.

create table public.strength_scores (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('exercise','muscle_group','overall')),
  exercise_id uuid references public.exercises(id),
  muscle_group_slug text,
  e1rm_kg numeric(8,3), relative_strength numeric(6,3),
  points numeric(7,2),                      -- 0..1000 continuous strength score
  level text check (level in ('untrained','novice','intermediate','advanced','elite','world_class')),
  level_sub int check (level_sub between 1 and 3),   -- "Novice II"
  level_progress_pct numeric(5,2),          -- "5.2 pts to Novice III"
  percentile numeric(5,2),                  -- "Top 80%" — SERVER-OWNED
  standard_set_id uuid references public.strength_standard_sets(id),
  bodyweight_kg numeric(6,3), sample_set_id uuid,
  computed_at timestamptz not null default now(),
  engine_version int not null default 1,
  updated_at timestamptz not null default now(), rev_hlc text not null default '0',
  origin_device uuid, deleted_at timestamptz
);
create unique index strength_scores_key on public.strength_scores
  (user_id, scope, coalesce(exercise_id,'00000000-0000-0000-0000-000000000000'::uuid),
   coalesce(muscle_group_slug,''));
create index strength_scores_leaderboard on public.strength_scores (scope, muscle_group_slug, points desc)
  where deleted_at is null;
-- ACCESS: population percentile refresh job (see MV below).

-- population distribution, refreshed nightly, tiny, synced to every client
create materialized view public.strength_distribution as
  select scope, coalesce(muscle_group_slug, exercise_id::text) as key,
         p.sex, width_bucket(s.points, 0, 1000, 100) as bucket,
         count(*) as n
  from public.strength_scores s join public.profiles p on p.id = s.user_id
  where s.deleted_at is null and p.profile_visibility <> 'private'
  group by 1,2,3,4;
create unique index strength_distribution_key on public.strength_distribution (scope, key, sex, bucket);

-- ═══════════════════ 7. SOCIAL ═════════════════════════════════════════════
create table public.groups (
  id uuid primary key, slug text not null unique, name text not null, description text,
  avatar_path text, visibility text not null default 'public'
    check (visibility in ('public','private','invite')),
  owner_id uuid not null references auth.users(id) on delete cascade,
  member_count int not null default 0,     -- SERVER-OWNED
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  rev_hlc text not null default '0', origin_device uuid, deleted_at timestamptz
);

create table public.group_members (
  id uuid primary key,
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  status text not null default 'active' check (status in ('active','pending','banned')),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), rev_hlc text not null default '0',
  origin_device uuid, deleted_at timestamptz
);
create unique index group_members_key on public.group_members (group_id, user_id);
create index group_members_user_idx on public.group_members (user_id, status) where deleted_at is null;
-- ACCESS: RLS "can I see this group's posts"; must be leading column.

create table public.posts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid references public.workouts(id) on delete set null,
  group_id uuid references public.groups(id) on delete set null,
  body text,
  media jsonb not null default '[]'::jsonb,
  muscle_map_path text,                     -- rendered anatomical heat image (storage key)
  visibility text not null default 'followers' check (visibility in ('public','followers','private')),
  volume_kg numeric(12,3), total_reps int, duration_s int,
  like_count int not null default 0,        -- SERVER-OWNED (trigger)
  comment_count int not null default 0,     -- SERVER-OWNED (trigger)
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  rev_hlc text not null default '0', origin_device uuid, deleted_at timestamptz
);
create index posts_author_time on public.posts (user_id, created_at desc) where deleted_at is null;
-- ACCESS: profile Posts tab.
create index posts_feed on public.posts (created_at desc)
  where deleted_at is null and visibility = 'public' and group_id is null;
-- ACCESS: Discover feed (partial index keeps it small and hot).
create index posts_group_time on public.posts (group_id, created_at desc) where deleted_at is null;

create table public.post_likes (
  id uuid primary key,
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  deleted_at timestamptz, rev_hlc text not null default '0', origin_device uuid,
  updated_at timestamptz not null default now()
);
create unique index post_likes_key on public.post_likes (post_id, user_id);
-- ACCESS: like/unlike is an OR-Set (row add/remove), NOT a counter increment.
--         This is what makes offline likes conflict-free.
create index post_likes_user_idx on public.post_likes (user_id, created_at desc) where deleted_at is null;

create table public.post_comments (
  id uuid primary key,
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.post_comments(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  rev_hlc text not null default '0', origin_device uuid, deleted_at timestamptz
);
create index post_comments_post_time on public.post_comments (post_id, created_at) where deleted_at is null;

create or replace function public.sync_post_counts() returns trigger language plpgsql as $$
declare pid uuid := coalesce(new.post_id, old.post_id);
begin
  update public.posts p set
    like_count = (select count(*) from public.post_likes l where l.post_id = pid and l.deleted_at is null),
    comment_count = (select count(*) from public.post_comments c where c.post_id = pid and c.deleted_at is null)
  where p.id = pid;
  return null;
end $$;
create trigger post_likes_count after insert or update or delete on public.post_likes
  for each row execute function public.sync_post_counts();
create trigger post_comments_count after insert or update or delete on public.post_comments
  for each row execute function public.sync_post_counts();

-- ═══════════════════ 8. BADGES ═════════════════════════════════════════════
create table public.badges (
  id uuid primary key, slug text not null unique, name text not null, description text,
  icon text, tier text check (tier in ('bronze','silver','gold','platinum')),
  category text, points int not null default 0,
  criteria jsonb not null,      -- declarative, evaluated by the SAME TS engine on device + server
  engine_version int not null default 1
);

create table public.user_badges (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  earned_at timestamptz, progress numeric(5,2) not null default 0,
  workout_id uuid, seen_at timestamptz,
  updated_at timestamptz not null default now(), rev_hlc text not null default '0',
  origin_device uuid, deleted_at timestamptz
);
create unique index user_badges_key on public.user_badges (user_id, badge_id);
-- ACCESS: idempotent award on replay; a badge can only be earned once.

-- ═══════════════════ 9. SYNC INFRASTRUCTURE ════════════════════════════════
create table public.mutation_log (
  mutation_id uuid primary key,          -- client-generated; THE idempotency key
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null,
  client_seq bigint not null,
  table_name text not null, row_id uuid not null, op text not null check (op in ('put','patch','delete')),
  applied_at timestamptz not null default now(),
  result text not null default 'applied' check (result in ('applied','ignored_stale','rejected'))
);
create index mutation_log_device_seq on public.mutation_log (user_id, device_id, client_seq desc);
-- ACCESS: replay gap detection + "has this mutation landed?" ack.
-- RETENTION: pg_cron purge after 30 days (older than any plausible offline window).

create table public.sync_tombstones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, table_name text not null, row_id uuid not null,
  deleted_at timestamptz not null default now()
);
create index tombstones_user_time on public.sync_tombstones (user_id, deleted_at desc);
-- ACCESS: only needed for the non-PowerSync fallback protocol; PowerSync propagates
--         deletes through its own oplog. Soft-delete rows are hard-purged at 90d,
--         which is also the maximum supported offline window.
```

================================================================================
PART 2 — ROW LEVEL SECURITY
================================================================================
Two rules that matter: (a) `auth.uid()` is always wrapped in `(select …)` so
Postgres caches it as an initPlan instead of re-evaluating per row; (b) every
policy names its role with `to authenticated` so it never even runs for anon.

```sql
alter table public.profiles            enable row level security;
alter table public.workouts            enable row level security;
alter table public.workout_exercises   enable row level security;
alter table public.sets                enable row level security;
alter table public.personal_records    enable row level security;
alter table public.bodyweight_entries  enable row level security;
alter table public.progress_photos     enable row level security;
alter table public.muscle_readiness_state enable row level security;
alter table public.strength_scores     enable row level security;
alter table public.posts               enable row level security;
alter table public.post_likes          enable row level security;
alter table public.post_comments       enable row level security;
alter table public.follows             enable row level security;
alter table public.groups              enable row level security;
alter table public.group_members       enable row level security;
alter table public.user_badges         enable row level security;
alter table public.routines            enable row level security;
alter table public.routine_exercises   enable row level security;
alter table public.routine_sets        enable row level security;

-- ── security-definer helpers: these bypass RLS for the *lookup*, which is the
--    only way to avoid recursive policy evaluation on follows/group_members.
create schema if not exists priv;
revoke all on schema priv from public, anon, authenticated;

create or replace function priv.follows(viewer uuid, author uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select viewer = author or exists (
    select 1 from public.follows f
    where f.follower_id = viewer and f.followee_id = author
      and f.status = 'accepted' and f.deleted_at is null);
$$;

create or replace function priv.in_group(viewer uuid, g uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select g is null or exists (
    select 1 from public.group_members m
    where m.user_id = viewer and m.group_id = g
      and m.status = 'active' and m.deleted_at is null);
$$;

create or replace function priv.blocked(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks
                 where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

-- ── PRIVATE: strictly own-row. Applies to sets, workouts, PRs, bodyweight,
--    photos, readiness, strength_scores, routines, badges.
create policy own_select on public.workouts for select to authenticated
  using ((select auth.uid()) = user_id);
create policy own_insert on public.workouts for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy own_update on public.workouts for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_delete on public.workouts for delete to authenticated
  using ((select auth.uid()) = user_id);
-- repeat verbatim for: workout_exercises, sets, personal_records,
-- bodyweight_entries, body_measurements, progress_photos, photo_comparisons,
-- muscle_readiness_state, recovery_daily, strength_scores, routines,
-- routine_folders, routine_exercises(*), routine_sets(*), user_badges.
-- (*) these two have no user_id column — give them one (denormalized) rather
--     than writing a join in the policy. A join in a policy runs per row.

-- read-only-to-client, server-owned tables: grant SELECT only.
create policy readonly_public on public.exercises      for select to authenticated using (true);
create policy readonly_public on public.exercise_media for select to authenticated using (true);
create policy own_custom_write on public.exercises for insert to authenticated
  with check (is_custom and owner_id = (select auth.uid()));
create policy own_custom_update on public.exercises for update to authenticated
  using (is_custom and owner_id = (select auth.uid()))
  with check (is_custom and owner_id = (select auth.uid()));

-- ── FOLLOWERS-ONLY + PUBLIC: posts
create policy posts_read on public.posts for select to authenticated
using (
  deleted_at is null
  and not (select priv.blocked((select auth.uid()), user_id))
  and (select priv.in_group((select auth.uid()), group_id))
  and (
        user_id = (select auth.uid())
     or visibility = 'public'
     or (visibility = 'followers' and (select priv.follows((select auth.uid()), user_id)))
  )
);
create policy posts_write on public.posts for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy posts_update on public.posts for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- likes/comments inherit the post's visibility
create policy likes_read on public.post_likes for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));  -- posts RLS applies inside
create policy likes_write on public.post_likes for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy likes_toggle on public.post_likes for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy comments_read on public.post_comments for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy comments_write on public.post_comments for insert to authenticated
  with check (user_id = (select auth.uid()));

-- profiles: public fields readable, private fields split into a view
create policy profiles_read on public.profiles for select to authenticated
  using (profile_visibility = 'public'
         or id = (select auth.uid())
         or (profile_visibility = 'followers' and (select priv.follows((select auth.uid()), id))));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
-- NOTE: birth_date/height_cm/sex must NOT leak. Move them to `private_profiles`
-- (own-row only) and keep `profiles` to display fields. RLS is row-level, not
-- column-level; column privileges are the wrong tool for a synced table.

create policy follows_read on public.follows for select to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));
create policy follows_write on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid()));
create policy follows_update on public.follows for update to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));

create policy groups_read on public.groups for select to authenticated
  using (visibility = 'public' or (select priv.in_group((select auth.uid()), id)));
create policy gm_read on public.group_members for select to authenticated
  using (user_id = (select auth.uid()) or (select priv.in_group((select auth.uid()), group_id)));

-- ── STORAGE
-- bucket 'progress-photos'  : private, path = <uid>/<photo_id>/<variant>.jpg
-- bucket 'avatars'          : public,  path = <uid>/<hash>.jpg
-- bucket 'exercise-media'   : public,  immutable, content-addressed (or Cloudflare R2)
create policy photos_own on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos'
         and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos'
              and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos'
         and (storage.foldername(name))[1] = (select auth.uid())::text);
```

CRITICAL NOTE ON RLS + POWERSYNC: PowerSync reads via the Postgres **logical
replication slot**, which bypasses RLS entirely. RLS is therefore NOT your read
authorization boundary — Sync Rules are. RLS still guards the write path,
because writes go back through PostgREST with the user's JWT. Any table in a
sync bucket must have a matching sync rule; any table missing one is simply not
synced, and any table with a *wrong* one leaks. Treat sync-rules.yaml as
security-critical code and diff-review it like RLS.

```yaml
# sync-rules.yaml
bucket_definitions:
  user_private:
    parameters: select request.jwt() ->> 'sub' as user_id
    data:
      - select * from workouts where user_id = bucket.user_id and deleted_at is null
      - select * from workout_exercises where user_id = bucket.user_id
      - select * from sets where user_id = bucket.user_id
      - select * from personal_records where user_id = bucket.user_id
      - select * from bodyweight_entries where user_id = bucket.user_id
      - select * from progress_photos where user_id = bucket.user_id
      - select * from muscle_readiness_state where user_id = bucket.user_id
      - select * from strength_scores where user_id = bucket.user_id
      - select * from routines where user_id = bucket.user_id
      - select * from routine_exercises where user_id = bucket.user_id
      - select * from routine_sets where user_id = bucket.user_id
      - select * from user_badges where user_id = bucket.user_id
      - select * from exercises where owner_id = bucket.user_id
  social_graph:
    parameters: select request.jwt() ->> 'sub' as user_id
    data:
      - select * from follows where follower_id = bucket.user_id or followee_id = bucket.user_id
  followed_feed:
    parameters: |
      select followee_id as author_id from follows
      where follower_id = request.jwt() ->> 'sub' and status = 'accepted'
    data:
      - select id, user_id, workout_id, body, media, muscle_map_path, visibility,
               volume_kg, total_reps, duration_s, like_count, comment_count, created_at
        from posts where user_id = bucket.author_id and visibility in ('public','followers')
      - select id, handle, display_name, avatar_path, is_pro from profiles where id = bucket.author_id
  global_small:
    data:
      - select * from badges
      - select * from strength_distribution   # ~20k rows, needed for the percentile curve
# DELIBERATELY ABSENT: exercises catalog, exercise_media, exercise_muscles,
# strength_standards. Those ship as a bundled read-only SQLite file (PART 8).
```

================================================================================
PART 3 — SYNC PROTOCOL (TypeScript)
================================================================================

```ts
// ─────────────────────────────────────────────────────────────────────────────
// ids.ts — client-generated, time-ordered ids + fractional ordering
// ─────────────────────────────────────────────────────────────────────────────
import { getRandomBytes } from 'expo-crypto';

/** UUIDv7: 48-bit ms timestamp || 12-bit seq || 62-bit random.
 *  Time-ordered => btree inserts append instead of fragmenting, and set rows
 *  for one workout land on adjacent pages both in SQLite and Postgres. */
let _lastMs = 0, _seq = 0;
export function uuidv7(): string {
  const ms = Date.now();
  if (ms === _lastMs) { _seq = (_seq + 1) & 0xfff; } else { _lastMs = ms; _seq = 0; }
  const b = getRandomBytes(16);
  b[0]=(ms/2**40)&0xff; b[1]=(ms/2**32)&0xff; b[2]=(ms/2**24)&0xff;
  b[3]=(ms/2**16)&0xff; b[4]=(ms/2**8)&0xff;  b[5]=ms&0xff;
  b[6]=0x70|((_seq>>8)&0x0f); b[7]=_seq&0xff;
  b[8]=0x80|(b[8]&0x3f);
  const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

/** Fractional index over base-62. between('a','b') -> 'aU'. Never renumbers
 *  siblings, so two offline devices inserting at the same slot both survive and
 *  order deterministically. Ties broken by id. */
const A = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
export function between(lo: string | null, hi: string | null): string {
  lo = lo ?? ''; hi = hi ?? '';
  let i = 0, out = '';
  for (;; i++) {
    const l = i < lo.length ? A.indexOf(lo[i]) : -1;
    const h = i < hi.length ? A.indexOf(hi[i]) : A.length;
    if (h - l > 1) return out + A[Math.floor((l + h) / 2)];
    out += i < lo.length ? lo[i] : A[0];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// hlc.ts — Hybrid Logical Clock. Plain `updated_at` LWW is wrong: a phone that
// died and cold-booted can come back with a wall clock minutes off, and would
// then silently lose or win every conflict. HLC keeps causality when clocks lie.
// ─────────────────────────────────────────────────────────────────────────────
export type HLC = { ms: number; ctr: number; node: string };
const MAX_DRIFT_MS = 60_000;

export function hlcNow(local: HLC, nodeId: string): HLC {
  const wall = Date.now();
  if (wall > local.ms) return { ms: wall, ctr: 0, node: nodeId };
  return { ms: local.ms, ctr: local.ctr + 1, node: nodeId };
}
export function hlcRecv(local: HLC, remote: HLC, nodeId: string): HLC {
  const wall = Date.now();
  if (remote.ms - wall > MAX_DRIFT_MS) throw new Error('clock drift too large');
  const ms = Math.max(wall, local.ms, remote.ms);
  const ctr = ms === local.ms && ms === remote.ms ? Math.max(local.ctr, remote.ctr) + 1
            : ms === local.ms                     ? local.ctr + 1
            : ms === remote.ms                    ? remote.ctr + 1 : 0;
  return { ms, ctr, node: nodeId };
}
/** Lexicographically sortable => stored as a single TEXT column, compared with `>`. */
export const encodeHLC = (h: HLC) =>
  `${h.ms.toString().padStart(15,'0')}-${h.ctr.toString().padStart(5,'0')}-${h.node}`;
export const cmpHLC = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// ─────────────────────────────────────────────────────────────────────────────
// policy.ts — per-table conflict rules. This table IS the sync protocol.
// ─────────────────────────────────────────────────────────────────────────────
export type Merge =
  | 'lww_row'        // whole row, highest HLC wins
  | 'lww_field'      // per-column, highest HLC per column wins
  | 'server_wins'    // server recomputes; client value is a hint only
  | 'client_wins'    // server never writes it
  | 'or_set'         // add/remove rows; add wins over concurrent remove
  | 'max'            // monotonic numeric, take the larger
  | 'append_only';   // immutable log, insert-only, PK dedupe

export const POLICY: Record<string, { merge: Merge; serverOwned?: string[]; clientOwned?: string[] }> = {
  workouts: {
    merge: 'lww_field',
    // aggregates are recomputed by the server on completion and overwrite the client's
    serverOwned: ['total_volume_kg','total_reps','total_sets','total_exercises','prs_count',
                  'like_count','comment_count','local_date'],
    clientOwned: ['started_at','ended_at','paused_ms','notes','title','status','visibility'],
  },
  workout_exercises: { merge: 'lww_field' },
  sets:              { merge: 'lww_field' },   // finest granularity that still makes sense
  workout_events:    { merge: 'append_only' },
  personal_records:  { merge: 'max' },          // PR value only ever goes up; ties → earliest achieved_at
  bodyweight_entries:{ merge: 'lww_row' },
  progress_photos:   { merge: 'lww_field', serverOwned: ['storage_path','thumb_path'] },
  muscle_readiness_state: { merge: 'server_wins' },  // pure function of workouts; recompute, never merge
  strength_scores:   { merge: 'server_wins', serverOwned: ['percentile'] },
  post_likes:        { merge: 'or_set' },
  follows:           { merge: 'or_set' },
  posts:             { merge: 'lww_field', serverOwned: ['like_count','comment_count'] },
  user_badges:       { merge: 'max' },          // earned_at = earliest non-null
  routines:          { merge: 'lww_field' },
};

// ─────────────────────────────────────────────────────────────────────────────
// mutation.ts — every local write produces an envelope. Envelopes are the unit
// of upload, retry, dedupe and ack.
// ─────────────────────────────────────────────────────────────────────────────
export interface Mutation {
  mutation_id: string;   // uuidv7, THE idempotency key — generated once, reused on every retry
  device_id: string;
  client_seq: number;    // monotonic per device; server detects gaps
  table: string;
  row_id: string;
  op: 'put' | 'patch' | 'delete';
  data: Record<string, unknown>;
  hlc: string;
  created_at: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// upload.ts — PowerSync uploadData(). Batches the FIFO ps_crud queue into one
// RPC. Blocking-FIFO semantics matter: if item N fails permanently and you do
// not remove it, nothing after it ever uploads. That is the #1 way a local-first
// app silently stops syncing. Handle it explicitly.
// ─────────────────────────────────────────────────────────────────────────────
import type { AbstractPowerSyncDatabase, CrudEntry, PowerSyncBackendConnector } from '@powersync/react-native';

const PERMANENT = new Set(['23503','23514','42501','22P02']); // FK, CHECK, RLS denial, bad input

export class StrongerConnector implements PowerSyncBackendConnector {
  constructor(private supabase: SupabaseClient, private deviceId: string) {}

  async fetchCredentials() {
    const { data } = await this.supabase.auth.getSession();
    if (!data.session) return null;
    return { endpoint: POWERSYNC_URL, token: data.session.access_token };
  }

  async uploadData(db: AbstractPowerSyncDatabase) {
    const tx = await db.getNextCrudTransaction();
    if (!tx) return;

    const mutations: Mutation[] = tx.crud.map((e: CrudEntry, i) => ({
      mutation_id: (e.opData?.__mutation_id as string) ?? deterministicId(tx.transactionId!, i),
      device_id: this.deviceId,
      client_seq: tx.transactionId! * 1000 + i,
      table: e.table,
      row_id: e.id,
      op: e.op === 'PUT' ? 'put' : e.op === 'PATCH' ? 'patch' : 'delete',
      data: stripLocalFields(e.opData ?? {}),
      hlc: (e.opData?.rev_hlc as string) ?? '0',
      created_at: Date.now(),
    }));

    try {
      // ONE round trip for the whole transaction — a 40-set workout uploads as a
      // single request, which is what makes reconnecting on 3G at the gym door work.
      const { error } = await this.supabase.rpc('apply_mutations', { p_mutations: mutations });
      if (error) throw error;
      await tx.complete();                       // ack: removes from ps_crud
    } catch (err: any) {
      if (PERMANENT.has(err?.code)) {
        // Do NOT retry forever. Quarantine, notify, unblock the queue.
        await db.execute(
          `INSERT INTO sync_dead_letter(id, payload, error, created_at) VALUES (?,?,?,?)`,
          [uuidv7(), JSON.stringify(mutations), JSON.stringify(err), Date.now()]);
        await tx.complete();
        reportToSentry('sync.permanent_reject', { err, mutations });
        return;
      }
      throw err;   // transient: PowerSync retries with backoff, order preserved
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// claim.ts — THE HARD CASE: the same in-progress workout logged offline on two
// devices. Two mechanisms, in order of preference.
//
// 1. PREVENTION (soft lock): a workout carries active_device_id +
//    claim_expires_at, renewed every 60 s while the session is foregrounded.
//    A second device that sees a live, unexpired claim offers "Continue on this
//    phone?" and must explicitly steal it (claim_seq + 1). Offline, the claim is
//    unverifiable, so this is advisory only — it stops ~95% of real cases (user
//    opens the iPad mid-session) without pretending we have a distributed lock.
//
// 2. MERGE (always correct): if both devices logged anyway, we do NOT pick a
//    winner at the workout level — that would throw away real sets the user
//    performed. We merge at the SET level, because a set has a client-generated
//    uuid and is semantically an append. The only true duplicate is "same
//    exercise, same weight, same reps, completed within 90 s on two devices",
//    which we surface for the user to resolve rather than silently dropping.
// ─────────────────────────────────────────────────────────────────────────────
export async function mergeDuplicateActiveWorkouts(db: DB, userId: string) {
  const live = await db.getAll<WorkoutRow>(
    `SELECT * FROM workouts WHERE user_id=? AND status='in_progress' AND deleted_at IS NULL
     ORDER BY started_at ASC`, [userId]);
  if (live.length < 2) return;

  const [keep, ...rest] = live;             // earliest start survives; it has the true anchor
  for (const dup of rest) {
    await db.writeTransaction(async tx => {
      const exs = await tx.getAll(
        `SELECT * FROM workout_exercises WHERE workout_id=? AND deleted_at IS NULL ORDER BY pos`, [dup.id]);
      for (const ex of exs) {
        // fold into an existing block for the same exercise, else re-parent it
        const target = await tx.getOptional<{id:string}>(
          `SELECT id FROM workout_exercises
           WHERE workout_id=? AND exercise_id=? AND deleted_at IS NULL LIMIT 1`, [keep.id, ex.exercise_id]);
        const targetId = target?.id ?? ex.id;
        if (!target) {
          const last = await tx.getOptional<{pos:string}>(
            `SELECT pos FROM workout_exercises WHERE workout_id=? ORDER BY pos DESC LIMIT 1`, [keep.id]);
          await tx.execute(`UPDATE workout_exercises SET workout_id=?, pos=?, rev_hlc=? WHERE id=?`,
            [keep.id, between(last?.pos ?? null, null), nextHLC(), ex.id]);
        }
        const sets = await tx.getAll<SetRow>(
          `SELECT * FROM sets WHERE workout_exercise_id=? AND deleted_at IS NULL ORDER BY pos`, [ex.id]);
        let cursor = await lastPos(tx, targetId);
        for (const s of sets) {
          const twin = await tx.getOptional<{id:string}>(
            `SELECT id FROM sets WHERE workout_exercise_id=? AND weight_kg IS ? AND reps IS ?
               AND abs(strftime('%s',completed_at) - strftime('%s',?)) < 90 AND id <> ?`,
            [targetId, s.weight_kg, s.reps, s.completed_at, s.id]);
          if (twin) {
            // probable double-log: keep both, flag for user review. Never auto-delete
            // performed work — a wrongly deleted set destroys a PR and trust.
            await tx.execute(
              `INSERT INTO merge_conflicts(id,user_id,kind,a_id,b_id,created_at) VALUES (?,?,?,?,?,?)`,
              [uuidv7(), userId, 'duplicate_set', twin.id, s.id, Date.now()]);
          }
          cursor = between(cursor, null);
          await tx.execute(
            `UPDATE sets SET workout_exercise_id=?, workout_id=?, pos=?, rev_hlc=? WHERE id=?`,
            [targetId, keep.id, cursor, nextHLC(), s.id]);
        }
      }
      // absorb time: the session really did run from the earliest start to the latest activity
      await tx.execute(
        `UPDATE workouts SET paused_ms = MIN(paused_ms, ?), rev_hlc=? WHERE id=?`,
        [dup.paused_ms, nextHLC(), keep.id]);
      await tx.execute(
        `UPDATE workouts SET status='discarded', deleted_at=?, notes=?, rev_hlc=? WHERE id=?`,
        [new Date().toISOString(), `merged into ${keep.id}`, nextHLC(), dup.id]);
    });
  }
  await recomputeWorkoutAggregates(db, keep.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// generic-sync.ts — the fallback protocol, if you do NOT use PowerSync.
// Watermark pull + batched idempotent push. Included because you should
// understand what PowerSync is doing for you, and because this is exactly what
// you would have to build (and maintain) yourself.
// ─────────────────────────────────────────────────────────────────────────────
const SYNC_TABLES = ['workouts','workout_exercises','sets','personal_records',
  'bodyweight_entries','progress_photos','routines','routine_exercises','routine_sets',
  'muscle_readiness_state','strength_scores','follows','posts','post_likes',
  'post_comments','user_badges','exercises'] as const;

export async function syncCycle(db: DB, api: Api) {
  await push(db, api);   // push FIRST: our writes must be on the server before we
  await pull(db, api);   // accept server state, otherwise we clobber ourselves.
}

async function push(db: DB, api: Api) {
  for (;;) {
    const batch = await db.getAll<Mutation>(
      `SELECT * FROM _outbox ORDER BY client_seq LIMIT 500`);
    if (!batch.length) return;
    // mutation_id is stable across retries => at-least-once delivery becomes
    // exactly-once application.
    const res = await api.post('/apply_mutations', { mutations: batch });
    await db.writeTransaction(async tx => {
      for (const r of res.results) {
        await tx.execute(`DELETE FROM _outbox WHERE mutation_id=?`, [r.mutation_id]);
        if (r.result === 'rejected')
          await tx.execute(`INSERT INTO sync_dead_letter(id,payload,error,created_at) VALUES (?,?,?,?)`,
            [uuidv7(), JSON.stringify(batch.find(m=>m.mutation_id===r.mutation_id)), r.error, Date.now()]);
      }
    });
  }
}

async function pull(db: DB, api: Api) {
  for (const table of SYNC_TABLES) {
    let cursor = await db.get<string>(`SELECT value FROM _sync_cursor WHERE table_name=?`, [table]) ?? '0';
    for (;;) {
      // cursor is (rev_hlc, id) so it is stable even when 10k rows share a timestamp
      const page = await api.get(`/changes/${table}`, { since: cursor, limit: 1000 });
      if (!page.rows.length) break;
      await db.writeTransaction(async tx => {
        for (const remote of page.rows) {
          const local = await tx.getOptional<any>(`SELECT * FROM ${table} WHERE id=?`, [remote.id]);
          const merged = mergeRow(table, local, remote);
          if (merged === null) continue;                     // local wins, skip
          if (remote.deleted_at && !hasPendingLocalEdit(local, remote))
            await tx.execute(`DELETE FROM ${table} WHERE id=?`, [remote.id]);  // apply tombstone
          else
            await tx.execute(upsertSql(table, merged), Object.values(merged));
        }
        await tx.execute(
          `INSERT INTO _sync_cursor(table_name,value) VALUES(?,?)
             ON CONFLICT(table_name) DO UPDATE SET value=excluded.value`,
          [table, page.next_cursor]);
      });
      cursor = page.next_cursor;
      if (page.rows.length < 1000) break;
    }
  }
}

export function mergeRow(table: string, local: any, remote: any): any | null {
  const p = POLICY[table] ?? { merge: 'lww_row' as Merge };
  if (!local) return remote;
  switch (p.merge) {
    case 'append_only': return null;                          // PK dedupe, first write wins
    case 'server_wins': return remote;
    case 'client_wins': return null;
    case 'max':
      return Number(remote.value ?? 0) > Number(local.value ?? 0) ? remote : null;
    case 'or_set':
      // add beats concurrent remove; a re-like after an offline unlike resurrects the row
      if (!remote.deleted_at) return remote;
      return local.deleted_at ? remote : null;
    case 'lww_row':
      return cmpHLC(remote.rev_hlc, local.rev_hlc) > 0 ? remote : null;
    case 'lww_field': {
      const out = { ...local };
      const localNewer = cmpHLC(local.rev_hlc, remote.rev_hlc) > 0;
      for (const k of Object.keys(remote)) {
        if (p.serverOwned?.includes(k)) { out[k] = remote[k]; continue; }   // always take server
        if (p.clientOwned?.includes(k) && localNewer) continue;             // keep ours
        if (!localNewer) out[k] = remote[k];
      }
      out.rev_hlc = localNewer ? local.rev_hlc : remote.rev_hlc;
      return out;
    }
  }
}
```

Server side of the idempotent write path:

```sql
create or replace function public.apply_mutations(p_mutations jsonb)
returns jsonb language plpgsql security invoker as $$   -- INVOKER => RLS applies
declare m jsonb; results jsonb := '[]'::jsonb; uid uuid := auth.uid();
begin
  for m in select * from jsonb_array_elements(p_mutations) loop
    begin
      -- idempotency gate: a replayed mutation is a no-op, not a duplicate row
      insert into public.mutation_log(mutation_id, user_id, device_id, client_seq,
                                      table_name, row_id, op)
      values ((m->>'mutation_id')::uuid, uid, (m->>'device_id')::uuid,
              (m->>'client_seq')::bigint, m->>'table', (m->>'row_id')::uuid, m->>'op')
      on conflict (mutation_id) do nothing;
      if not found then
        results := results || jsonb_build_object('mutation_id', m->>'mutation_id','result','duplicate');
        continue;
      end if;

      -- staleness gate: never let an old offline write overwrite a newer one
      perform public.apply_one(m, uid);
      results := results || jsonb_build_object('mutation_id', m->>'mutation_id','result','applied');
    exception when others then
      update public.mutation_log set result = 'rejected' where mutation_id = (m->>'mutation_id')::uuid;
      results := results || jsonb_build_object('mutation_id', m->>'mutation_id',
                                               'result','rejected','error', sqlerrm, 'code', sqlstate);
    end;
  end loop;
  return results;
end $$;
```

================================================================================
PART 4 — CRASH SAFETY FOR THE IN-PROGRESS WORKOUT
================================================================================

```ts
// ─────────────────────────────────────────────────────────────────────────────
// durability.ts
// SQLite's defaults are NOT durable. In WAL mode with synchronous=NORMAL a
// committed transaction survives a process crash but may roll back on power
// loss. "The phone dying" is power loss. So: raise synchronous to FULL for the
// duration of a live workout only, and drop back to NORMAL for browsing.
// ─────────────────────────────────────────────────────────────────────────────
export async function initDb(db: DB) {
  await db.execute(`PRAGMA journal_mode = WAL`);        // concurrent read while writing
  await db.execute(`PRAGMA synchronous = NORMAL`);
  await db.execute(`PRAGMA busy_timeout = 3000`);
  await db.execute(`PRAGMA foreign_keys = ON`);
  await db.execute(`PRAGMA wal_autocheckpoint = 200`);  // keep the -wal small; crash recovery is O(wal)
}
export const setDurability = (db: DB, live: boolean) =>
  db.execute(`PRAGMA synchronous = ${live ? 'FULL' : 'NORMAL'}`);
// iOS note: also set fullfsync. Apple's fsync() does not flush the drive cache.
// op-sqlite exposes it; otherwise `PRAGMA fullfsync = ON`.

// ─────────────────────────────────────────────────────────────────────────────
// WHAT GETS WRITTEN, WHEN. Rule: persist on every *semantic* event, never on
// every keystroke. Each of these is one <1 ms transaction.
// ─────────────────────────────────────────────────────────────────────────────
//  start workout        -> INSERT workouts(status='in_progress', started_at=NOW)  [+ event]
//  add exercise         -> INSERT workout_exercises                               [+ event]
//  add set              -> INSERT sets(is_completed=0)                             [+ event]
//  reps/kg field edit   -> UPDATE sets  debounced 400 ms AND flushed on blur,
//                          on set-complete, on app background, and on nav away
//  tick the checkmark   -> UPDATE sets SET is_completed=1, completed_at=NOW        [+ event]
//                          + recompute workout aggregates in the SAME transaction
//  rest timer start     -> UPDATE workouts / event only (timers are derived, see below)
//  app backgrounds      -> flush pending debounce, PRAGMA wal_checkpoint(PASSIVE)
//  finish               -> UPDATE workouts SET status='completed', ended_at=NOW
//                          + PR pass + readiness recompute, ALL in one transaction
//
// NEVER stored: elapsed seconds, "time remaining", any counter that ticks.
// Duration is always derived: now() - started_at - paused_ms. A value that is
// only correct while the process is alive is a value that lies after a crash.

export function elapsedMs(w: WorkoutRow, now = Date.now()): number {
  const base = now - new Date(w.started_at).getTime() - w.paused_ms;
  const inPause = w.pause_started_at ? now - new Date(w.pause_started_at).getTime() : 0;
  return Math.max(0, base - inPause);
}

// ─────────────────────────────────────────────────────────────────────────────
// recovery.ts — runs before the first frame renders.
// ─────────────────────────────────────────────────────────────────────────────
export async function recoverOnLaunch(db: DB, userId: string): Promise<Recovery> {
  await initDb(db);                                  // SQLite replays the -wal here
  await mergeDuplicateActiveWorkouts(db, userId);    // two-device case

  const w = await db.getOptional<WorkoutRow>(
    `SELECT * FROM workouts WHERE user_id=? AND status='in_progress' AND deleted_at IS NULL
     ORDER BY started_at DESC LIMIT 1`, [userId]);
  if (!w) return { kind: 'none' };

  // Repair: did the black-box log capture events that never made it into `sets`?
  // (only possible if a write landed mid-transaction on a corrupt FS; cheap to check)
  await replayOrphanEvents(db, w.id);
  await recomputeWorkoutAggregates(db, w.id);

  const lastActivity = await db.get<number>(
    `SELECT COALESCE(MAX(strftime('%s', completed_at)), strftime('%s', ?)) * 1000
     FROM sets WHERE workout_id=? AND is_completed=1`, [w.started_at, w.id]);
  const idleH = (Date.now() - lastActivity) / 3_600_000;

  if (idleH < 3)  return { kind: 'resume',  workout: w };          // walk straight back in
  if (idleH < 18) return { kind: 'confirm', workout: w, idleH };   // "Still training? 4h ago"
  // >18 h: auto-close at the last real activity rather than inventing a 3-day session
  await db.writeTransaction(async tx => {
    await tx.execute(
      `UPDATE workouts SET status='completed', ended_at=?, notes=COALESCE(notes,'')||?, rev_hlc=?
       WHERE id=?`, [new Date(lastActivity).toISOString(), '\n(auto-closed)', nextHLC(), w.id]);
    await tx.execute(`DELETE FROM sets WHERE workout_id=? AND is_completed=0`, [w.id]);
  });
  await runFinishPipeline(db, w.id);
  return { kind: 'auto_closed', workout: w };
}
```

Crash-safety invariants worth stating plainly:
1. The local SQLite DB is the system of record. The server is a replica.
2. A set exists the instant the checkmark is tapped, in a committed transaction,
   with `synchronous=FULL`. There is no window in which a completed set lives
   only in React state.
3. `workout_events` is append-only, so no partial UPDATE can corrupt it; it can
   rebuild `sets` if the mutable tables are ever inconsistent.
4. Nothing in the live-workout path requires the network. Not PR detection, not
   "Previous", not the muscle map, not the finish summary — all read local tables
   plus the bundled catalog.

================================================================================
PART 5 — DERIVED DATA: WHERE EACH NUMBER IS COMPUTED
================================================================================
One pure TypeScript package, `@stronger/engine`, versioned by `engine_version`,
compiled once and run in two places: on device (expo/RN + web via the same JS),
and in a Supabase Edge Function (Deno, same bundle). No logic is written twice
and no logic lives in plpgsql.

| Quantity | Where | Why |
|---|---|---|
| Set volume, effective load | device, at write time | must be instant, must work offline |
| Workout totals (volume/reps/sets) | device on write, Edge re-verify on finish | user sees live counters; server is the tiebreak |
| e1RM per set | device | pure function of weight/reps/RIR |
| PR detection | device | needs the Finish screen to fire confetti with no network |
| Muscle readiness | device | pure function of local workout history + catalog contributions |
| Strength level & points | device | pure function of e1RM + bodyweight + bundled standards table |
| **Percentile vs other users** | **Postgres** (nightly MV) | needs other users' data; ships down as a 20k-row distribution the device interpolates |
| Feed ranking, counters | Postgres triggers / MV | server-owned by definition |
| Weekly recap push, badge fan-out | Edge Function on cron | needs secrets + push tokens |

e1RM: use `Epley` for 1–10 reps as the display default because users recognise
it, but store `rir` and compute a corrected load — a set at RIR 3 is not a set to
failure and the naive formula understates it. The current best published fit is
weight-dependent:

    1RM = w * (1 + (r - 1)^0.85 / (-2.55 + 4.58 * ln(w)))

(fit on 303,494 near-failure sets from 14,966 users over 388 exercises; reported
17–22% lower inconsistency than four classical formulas, improvement positive on
all 183 exercises with sufficient data). Apply it with `r_effective = reps + rir`.
Stamp every stored e1RM with `engine_version` so a formula change triggers a
background recompute instead of silently redrawing everyone's history.

Readiness model (on device, per muscle m):
```
stimulus(m, workout) = Σ_sets volume_kg * contribution(exercise, m) * typeWeight(set_type)
   typeWeight: warmup 0.25, normal 1.0, drop 0.8, failure 1.15, myorep 0.9
readiness(m, t) = 100 * (1 - Σ_w stimulus(m,w) * exp(-(t - t_w) / τ(m)) / capacity(m))
   τ(m)        = muscles.recovery_hours_baseline, scaled by chronic_load_28d / acute_load_7d
   capacity(m) = rolling 28-day p75 of weekly stimulus for that muscle
```
Recompute lazily: only on workout finish and on app foreground, writing
`muscle_readiness_state`. Never on render.

================================================================================
PART 6 — MEDIA
================================================================================
Exercise demo media — do NOT ship GIFs. A 3-second 480×480 GIF is 1.5–3 MB; the
same loop as H.264 MP4 is 40–90 KB and as WebP-animated ~120 KB. 1,400 exercises
× 3 MB = 4.2 GB of GIF vs ~110 MB of MP4.
- Store content-addressed: `exercise-media/<sha256>.mp4`. Immutable forever, so
  `Cache-Control: public, max-age=31536000, immutable`, no invalidation logic.
- Host on Cloudflare R2 + Cloudflare CDN (zero egress fees) rather than Supabase
  Storage, whose bandwidth is metered. Public bucket, no signing.
- Bundle the ~150 most-used exercises' loops in the app binary (~12 MB) so the
  first offline session is never a grey box. Everything else lazy-downloads to
  `expo-file-system` cache keyed by content hash, capped by LRU at ~300 MB,
  prefetched for every exercise in the user's routines whenever on wifi.
- Sourcing: ExerciseDB sells a one-time perpetual commercial license, 1,394
  exercises with matching GIFs, self-hostable (transcode to MP4 on ingest); its
  license forbids re-publishing the raw set as a competing database, which is
  fine for in-app use. free-exercise-db (public domain, ~800 exercises, stills
  only) is the safe fallback and a good source of names/aliases. wger's catalog
  is CC-BY-SA 3.0 — usable with attribution, but the share-alike terms make it a
  poor base for a proprietary catalog. Commission or synthesize the remaining
  long tail; treat `exercise_media.license` and `attribution` as required fields.

Progress photos — private, and treated as such:
- Private bucket, path `progress-photos/<user_id>/<photo_id>/<variant>.jpg`, RLS
  keyed on `(storage.foldername(name))[1] = auth.uid()::text`.
- On capture: strip EXIF (GPS especially), resize to max 1440 px, encode JPEG
  q80 (~250 KB), sha256, write the row with `attachment_state='queued_upload'`
  and the local file path. The photo exists locally and is visible in the app
  immediately; upload is a background concern.
- Upload via `createSignedUploadUrl` so the client never holds a service key.
  Default to wifi-only + charging; never burn a user's data plan on 40 photos.
- PowerSync's attachment queue handles the state machine
  (queued_upload → uploading → synced → archived) with retry, integrity checks
  and LRU cache eviction; use it rather than hand-rolling.
- Read back with short-lived signed URLs (1 h) and cache the file, not the URL.
  A signed URL is a bearer token: once issued it works for anyone until it
  expires, so never log it, never put it in analytics, never render it in a
  shareable DOM attribute.
- Comparison view renders from local files, so it works offline.
- Optional "extra private" mode: client-side XChaCha20 envelope encryption with
  the key in SecureStore/Keychain. Costs you server-side thumbnails and makes
  key loss = photo loss; offer it, do not default to it.

================================================================================
PART 7 — EXERCISE CATALOG MIGRATION
================================================================================
The catalog does not go through the sync engine at all. It ships as a separate
read-only SQLite file, `catalog-<version>.db`, ATTACHed next to the user DB:

```ts
await db.execute(`ATTACH DATABASE ? AS cat`, [catalogPath]);
// joins work across the attachment:
//   SELECT s.*, ce.name FROM sets s JOIN cat.exercises ce ON ce.id = s.exercise_id
```
Why: 1,400 exercises + aliases + muscle contributions + 144k strength-standard
rows is ~15 MB that is identical for every user and never changes per-user.
Syncing it costs every user a large first-run download over gym wifi, bloats the
sync service's hosted-data bill, and gains nothing. Shipping it means the app is
fully functional on first launch, offline, before login.

Rules for updating it under live user history:
1. Exercise ids are permanent. Never reuse, never delete. Deprecation is
   `deprecated_at` + `merged_into_id`, and `exercise_redirects` carries the
   flattened transitive closure so the client resolves in one join.
2. Every `workout_exercises` row snapshots `exercise_slug` and
   `exercise_name_snapshot`. If an id is ever orphaned, history still renders.
3. `exercise_muscles` is versioned by `contribution_version`, and each
   `workout_exercises` row records the version it was logged under. Retuning the
   muscle model therefore does not silently rewrite last year's "you trained
   quads 40%" charts. Recomputation is an explicit, user-visible action
   ("Recalculate history with the improved muscle model") that bumps
   `engine_version` and re-derives in the background.
4. Catalog updates ship two ways: bundled with app releases, and as a delta file
   downloadable at runtime (`catalog_versions.bundle_path` + checksum) so you can
   ship exercises without an App Store review. Download to temp, verify sha256,
   atomically rename, ATTACH the new file, DETACH the old, delete. Never mutate
   the attached file in place.
5. `min_app_version` on each catalog version guards against a new catalog using
   a `metric` or `set_type` an old binary cannot render.
6. Custom user exercises live in the synced DB with `is_custom=true`. When a
   custom exercise is later added to the canonical catalog, set
   `linked_exercise_id` instead of rewriting history; analytics unions on
   `COALESCE(linked_exercise_id, id)`.


## Risks

- PowerSync is a single-vendor dependency in the critical path; mitigate by keeping mutations expressible as plain PostgREST upserts, keeping apply_mutations vendor-neutral, and validating an Open Edition self-host deployment before launch so the exit is proven rather than theoretical.
- Supabase logical replication slots are known to cause runaway WAL growth on idle instances (interacting with archive_timeout defaults), which can fill the database disk and take the backend down; add disk and slot-lag alerting on day one.
- Sync rules bypass RLS, so a single mistyped bucket definition can leak another user's private workouts or progress photos with no policy backstop; require two-person review on sync-rules.yaml and add an automated test that connects as user A and asserts user B's rows are absent.
- synchronous=FULL during live workouts costs an fsync per set on some Android devices with slow eMMC; measure the p99 write latency on a cheap device before committing, and fall back to NORMAL plus a checkpoint on background if it exceeds ~30ms.
- Choosing Expo diverges from the team's Next.js muscle memory; the mitigation (shared engine package, shared schema, PowerSync web SDK for the dashboard) only works if the engine package is genuinely platform-free — any accidental React Native import in it silently breaks the web build.
- OPFS multi-tab handle contention on iOS Safari makes the PWA fallback risky precisely when a user reloads mid-session; if the PWA path is chosen anyway, force single-tab operation and show an explicit 'this session is open in another tab' state rather than hanging on connect.
- Exercise media licensing is the likeliest legal exposure: ExerciseDB forbids redistributing the raw set, wger's data is share-alike, and scraped GIFs are not licensed at all; keep license and attribution mandatory on every media row and audit before launch.
- World-standings percentiles computed from your own user base will be badly biased while the base is small and self-selected; seed with published standards and only blend in observed percentiles above a per-bucket sample threshold, or the app will tell early users they are world-class.
- Client-computed aggregates being overwritten by server recomputation creates visible number-flicker on the Finish screen if the two engines disagree; enforce a single shared engine bundle and add a CI test asserting device and edge produce byte-identical results for a fixture corpus.
- Hard-purging tombstones at 90 days means a device offline longer than that resurrects deleted rows on reconnect; detect last_seen_at older than the retention window and force a full local wipe and resync instead of an incremental one.
- Storing rir on every set is a UX tax that many users will skip, leaving e1RM systematically underestimated for the exact users who never log RIR; default RIR by set_type (failure=0, normal=2) and mark such estimates as inferred in the data model.
- The append-only workout_events table grows unboundedly and is mostly useless after a workout is completed and verified; schedule local compaction that drops events for workouts completed more than 30 days ago and verified against sets.
