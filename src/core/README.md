# src/core

Pure TypeScript domain logic. **Zero imports from `react`, `react-native`, or `expo-*`.**

This rule is what makes the engine unit-testable under plain node (`npm test`) and lets a
future Next.js dashboard import it untouched. If you need a platform capability here,
take it as a function argument instead.

| Module | Owns |
|---|---|
| `exercises/` | Taxonomy, muscle enum, movement archetypes, canonical naming, catalog types |
| `scoring/` | e1RM, volume load, PR detection, plate math, unit conversion |
| `standards/` | World strength standards, per-muscle classification, rank ladder |
| `readiness/` | Per-muscle fatigue accrual and recovery decay, daily capacity |
| `equivalents/` | Volume → real-world mass comparisons for the Finish summary |
| `bodyweight/` | Weight smoothing, trend and projection |
| `types/` | Shared domain types |
