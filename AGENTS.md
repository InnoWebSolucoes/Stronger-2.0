# Stronger 2.0

A strength-training tracker. Native iOS/Android. Competitor set: Hevy, Strong, Boostcamp, Fitbod.

## Locked decisions

| Area | Decision | Why |
|---|---|---|
| Client | Expo / React Native, `expo-router` | Needs background rest timers, haptics, camera, eviction-safe local storage. iOS Safari grants home-screen web apps a *revocable* storage quota, which disqualifies a PWA for an app promising a session survives a dead battery. |
| Data | Local-first SQLite (`expo-sqlite` + Drizzle) → Supabase sync | Gyms have no signal. A set must hit disk before anything else. Local is the system of record; the server is a replica. |
| Styling | Typed design tokens + `StyleSheet` | No NativeWind: zero build risk on RN 0.86, better perf on the heavy chart surfaces. |
| Exercise media | **~40 movement archetypes rendered as SVG animations we own outright** | Every third-party source is legally compromised (see below). Owning the rig gives total style consistency by construction and covers user-created exercises, which no licensed pack can. |

## Forbidden media sources — asserted in CI, not left to memory

These are the first results anyone searching "open exercise database" will find. Every one is unusable:

- **free-exercise-db images** — 1,746 Bodybuilding.com studio photographs of an identifiable model with no release. The Unlicense badge does not cover them. Its instruction prose is verbatim Bodybuilding.com copy. *Structured fields (names, muscles, equipment, force, mechanic, level) are factual data and may be used; images and prose may not.*
- **ExerciseDB free GIFs / hasaneyldrm videos** — byte-identical to files another repo publishes marked "© Gym Visual", while ExerciseDB.io sells them claiming original ownership.
- **MuscleWiki** — terms forbid downloading, exporting or storing videos, thumbnails or bodymaps for offline or CDN use.
- **Everkinetic / @bryllim CC-BY-SA art** — usable, but recolouring or re-cropping creates Adapted Material that must be re-released under CC-BY-SA-4.0. Keep any such derivative in a separate publishable directory, never mixed into app assets.

## Non-negotiable constraints

1. **Art and animation are standardised.** All demo animation comes from one archetype rig in `src/ui/anatomy` + `scripts/`. Fixed canvas, fixed figure treatment, fixed background, target muscle highlighted in the brand accent. Twelve exercises on one screen must look like one designer drew all twelve.
2. **`src/core` is pure TypeScript.** Zero imports from `react`, `react-native`, or `expo-*`. It holds the exercise catalog, scoring math, strength standards, readiness model and equivalents. Platform capabilities (clock, storage, randomness) are injected as parameters, never imported.
3. **A workout in progress survives anything.** Force-kill, battery death, three days offline. Write-ahead on every set mutation; `recoverOnLaunch()` runs before the first frame.
4. **Numbers must be correct.** e1RM, volume, PR detection and world standings are the product. Formulas live in `src/core/scoring` with tests and a cited source in every doc comment.
5. **Progress photos are GDPR Article 9 health data.** Explicit consent separate from the ToS, on-device by default, biometric-gated, never auto-attached to a social post. No face recognition or identity matching may ever run on one. A signed DPIA gates the feature shipping.
6. **Health methodology must be disclosed.** Apple Guideline 1.4.1 rejects health calculations without published method. e1RM, readiness, capacity and percentile each need an in-app "how this is calculated" disclosure with its citation.
7. **Sync rules are the read authorization boundary.** PowerSync-style replication bypasses Postgres RLS entirely on reads — RLS guards only writes. Sync rules are security-critical code.
8. **Weight-loss guidance is hard-coded and citable.** BMI 18.5 floor on goals, no weight goals under 18, 1%/week loss cap, rapid-loss detection. Every rejection shows its source (CDC, NHS/NICE).

## Layout

```
app/              expo-router routes (tabs: Log, Train, Progress, Community, Profile)
src/core/         pure TS domain logic — no RN imports, runs under plain node
src/db/           Drizzle schema, migrations, crash-safe write path
src/ui/theme/     design tokens (dark + light, contrast-tested)
src/ui/primitives/ buttons, tiles, chips, segmented controls
src/ui/charts/    sparklines, rings, heatmaps, body map, distribution curve
src/ui/anatomy/   the archetype animation rig — the single source of all demo art
src/features/     composed feature UI
src/lib/          platform glue (haptics, notifications, secure storage)
scripts/          catalog build + art generation pipeline
docs/research/    the 12 research briefs this project was specified from
```

## Conventions

- Path aliases: `@core/*`, `@db/*`, `@ui/*`, `@features/*`, `@lib/*`, `@/*` → `src/*`.
- Weights are stored in **kg, always**. Display conversion happens at the render layer only — never round-trip convert a stored value.
- Exercise IDs are **stable ULIDs with derived slugs**, never array indices, so history survives catalog updates. Display names are *generated* from components by `canonicalName()`, never typed by hand — that is what makes "Barbell Bench Press" and "Bench Press (Barbell)" structurally unable to both exist.
- Ordered rows use **fractional position strings**, not integer indices, so two offline devices reordering sets cannot collide.
- `npm test` runs the engine under node. `npm run typecheck` must be clean before any commit.
- Every user-visible number that can be zero needs a designed empty state. "0 kg" and "—" are different things.
