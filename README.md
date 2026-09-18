# Stronger 2.0

A strength-training tracker for iOS and Android. Log a workout set by set, see where your lifts
stand against world strength standards, and know which muscles are ready to train today.

Built offline-first: local SQLite is the system of record, the server is a replica. A workout in
progress survives a force-kill, a dead battery and three days without signal — because gyms are
basements, and losing a session is the fastest way to lose a user.

## Status

Early development. The engine and design system are being built; the UI is next.

## Stack

| | |
|---|---|
| App | Expo SDK 57 · React 19 · React Native 0.86 · `expo-router` |
| Local data | `expo-sqlite` + Drizzle ORM, WAL, crash-safe write path |
| Sync | Supabase (Postgres) |
| UI | Typed design tokens + `StyleSheet`, `react-native-svg`, Reanimated 4 |
| Engine tests | Vitest, running `src/core` under plain node |

## Getting started

```bash
npm install
npm start          # Expo dev server — press i / a / w
npm test           # engine test suite
npm run typecheck  # tsc --noEmit
```

Copy `.env.example` to `.env` for Supabase sync. The app is fully functional without it.

## Architecture

`src/core` is pure TypeScript with **zero** React Native imports — the exercise catalog, scoring
math, strength standards, readiness model and volume equivalents all run under plain node. That
keeps the parts where correctness actually matters unit-testable, and lets a web dashboard import
them untouched.

Everything demo-art related is generated from a single archetype rig we own outright, so the whole
catalog renders in one consistent visual language and carries no third-party licence.

See [AGENTS.md](AGENTS.md) for locked decisions and the constraints that shape the build, and
[docs/research/](docs/research/) for the briefs it was specified from.
