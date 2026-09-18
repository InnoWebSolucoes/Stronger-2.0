# Stronger 2.0 — Engineering Brief

_Consolidated from 12 research agents._

## Verdict

We are building an offline-first NATIVE strength tracker where local SQLite is the system of record and the server is a replica. Expo dev client + op-sqlite + PowerSync against the existing Supabase Postgres; Next.js survives only as marketing and a web dashboard sharing the same engine package. iOS Safari grants home-screen web apps a discretionary, revocable storage quota, which disqualifies the PWA path for an app whose promise is that a session survives a dead battery.

Licensing decides the media layer and it is the one thing that can sink the feature. The two datasets every team reaches for first are both unusable: free-exercise-db's images are Bodybuilding.com studio photographs behind a void Unlicense badge, and ExerciseDB's GIFs are byte-identical to files another repo publishes as "© Gym Visual" while ExerciseDB.io sells them claiming original ownership. The answer is RepDB Standard at $499 one-time (601 exercises, verified 34-frame transparent animated WebP), Gym Visual N-CRFL bought direct for the gap, and a ~40-archetype programmatic SVG renderer for the long tail and for user-created exercises. A catalogue row does not ship until its demo exists.

The first shippable slice is one perfect workout: 114 core exercises, the set table, set types, rest timer, PR detection and the Finish summary — entirely offline, no account, no sync, surviving a force-kill mid-session. Dogfood it in a real gym for four weeks before building anything else.

Genuinely hard: exercise identity and alias resolution (136 of 600 measured overlap between two datasets), two-device offline merge correctness, honest percentiles on a small self-selected population, and the muscle contribution matrix that drives four features with no ground truth. Routine: the set table, charts, tokens, plate math, auth and feeds — the research delivered those near-complete.

Rank measures capability. Nothing you do in the app except lift moves it.

## Hard constraints

1. free-exercise-db's 1,746 images are Bodybuilding.com studio photographs of an identifiable model with no release, and its instruction prose is verbatim Bodybuilding.com copy. The Unlicense badge is void as to both. Ship the structured fields (names, muscles, equipment, force, mechanic, level) as factual data; never run an image fetch loop against the repo; rewrite every instruction string. Encode the URL pattern in build/forbidden-sources.json and assert it in CI, because it is the top Google result for 'open exercise database' and an engineer will reach for it on instinct.

2. ExerciseDB's free GIFs and hasaneyldrm's video files are the same bytes (109,751 B, SHA-256 a0e42d8d0c155b0af2dbda5a…) that another repo publishes with per-record '© Gym visual' attribution, while ExerciseDB.io sells them claiming original ownership. Do not use the free GIFs. Do not buy the $199/$599 pack without a written warranty and indemnity naming Gym Visual.

3. RepDB's licence has three clauses that shape architecture, not just credits: (1) the exact string 'Exercise data by RepDB (repdb.co)' must be visible in the app before the first build; (2) no redistribution 'as a dataset or a modified or derived dataset' — so Stronger 2.0 may NEVER expose a public exercise API, a partner feed, or an open catalogue export, and the API boundary must be designed now so exercise records are never the product; (3) no generative-AI derivation from their images, so the long-tail renderer must be built from our own rig and can never style-match their catalogue.

4. Gym Visual's N-CRFL explicitly permits 'Android or iOS mobile application (apps)' but prohibits use 'in products (both physical or digital) destined for resale'. That is ambiguous for a paid subscription app. Get written confirmation before wiring four figures; unresolved, it invalidates the purchase.

5. CC-BY-SA-4.0 on Everkinetic and @bryllim/workout-guide assets imposes ShareAlike on MODIFIED artwork. Recolouring or re-cropping those frames for the dark theme creates Adapted Material that must be re-released under CC-BY-SA-4.0. It does not infect app code or proprietary data. Keep those derivatives in a separate, publishable directory from day one.

6. MuscleWiki's terms forbid downloading, exporting, copying or storing its videos, thumbnails or bodymap images for offline, CDN or cloud storage, cap text caching at 30 days and thumbnails at 24 hours in the end user's client only, and require MuscleWiki branding to remain burned into the video. It can therefore only ever be an optional streamed enrichment layer with the verbatim ToS line 'Exercise data and videos provided by MuscleWiki.com', and the app must be fully usable with it off.

7. Progress photos tied to bodyweight are Article 9 special-category health data. They require a cumulative lawful basis — an Art. 6 basis AND explicit consent as a separate affirmative act from accepting the ToS — and a DPIA under Art. 35(3)(b) signed before the feature ships. Critically, a photograph becomes Art. 9 BIOMETRIC data only when processed 'through specific technical means allowing the unique identification' of a person, so pose landmarks for framing are permitted but must be ephemeral and never persisted, and no face recognition, face clustering or identity matching may ever run on a progress photo.

8. Under the UK Online Safety Act, content encouraging or promoting an eating disorder is primary priority content harmful to children. Because the app has a user-to-user Community tab, either prohibit that content outright in the T&Cs and moderate for it, or become subject to highly effective age assurance. Prohibit it, and never let the recommender optimise for leanness or weight-loss engagement.

9. Apple Guideline 1.4.1 requires disclosed data and methodology for health calculations or the app is rejected — this covers e1RM, strength percentiles, readiness and the capacity score, each of which needs an in-app 'how this is calculated' disclosure with its citation. Guideline 1.2 requires content filtering, reporting, blocking, a published contact and a 24-hour response window for a UGC app.

10. PowerSync reads bypass Row Level Security entirely, because it consumes a Postgres logical replication slot that sees every row. RLS guards only the write path. sync-rules.yaml IS the read authorization boundary and must be treated as security-critical code with two-person review and an automated test that connects as user A and asserts zero rows of user B. Client parameters must never be used for access control — only request.jwt() token parameters.

11. Weight-loss guidance is hard-coded and citable: CDC 1–2 lb/week, NHS/NICE 0.5–1 kg/week. A hard BMI 18.5 floor on goals, no weight goals under 18, a 1%/week loss cap, and a rapid-loss detector at >1.0%/week for three consecutive weeks. Every rejection must show its source. This is both an ethics floor and an app-review requirement.

12. Platform timer constraints are real and asymmetric: iOS Live Activities have an approximately 8-hour budget with system-imposed update throttling, and Android exact alarms require SCHEDULE_EXACT_ALARM / USE_EXACT_ALARM with Play Store policy implications. The rest timer must therefore be a persisted absolute deadline that is correct on resume even if no background execution happened at all.

## Decisions

### Client platform

**Expo / React Native with a dev client and op-sqlite (>=1.17) via @powersync/op-sqlite. Next.js survives only as marketing plus a web dashboard using @powersync/web against the identical schema and the identical @stronger/engine package.**

WebKit grants home-screen web apps roughly 15% of disk versus 60% for browser apps and grants persistent mode only 'based on heuristics' — an app whose entire promise is that a session survives a dead battery cannot rest on a revocable storage grant, and on-device pose landmarks for photo alignment require native anyway.

_Rejected:_ A Next.js PWA, which would have preserved the team's exact stack but ships the core promise on a discretionary storage grant, with OPFS multi-tab handle contention that hangs on connect precisely when a user reloads mid-session.

### Sync engine

**PowerSync Cloud against the existing Supabase Postgres, budgeted at the $49/mo Pro tier from launch, with a proven Open Edition self-host deployment as a documented escape hatch validated before launch.**

Its client architecture already solves the race that hand-rolled sync always gets wrong — server updates land in ps_oplog and are only promoted at a consistent checkpoint after the client's own writes are acked — and Supabase has no first-party offline story and is not shipping one.

_Rejected:_ ElectricSQL, which narrowed to read-path-only sync and explicitly does not accept writes, meaning an app whose core loop is offline WRITES would have to rebuild the entire write/queue/conflict layer regardless.

### Media: primary source

**RepDB free tier day one, RepDB Standard ($499 one-time) before public launch. Attribution string 'Exercise data by RepDB (repdb.co)' goes in Profile → About → Credits before the first build.**

It is the only catalogue-scale source whose licence grants free commercial in-app use and whose origin clause states the art is original AI-commissioned work, not derived from any third-party library; the paid sample was verified as a genuine 34-frame 512×512 RGBA animated WebP with the worked muscle tinted orange, which matches the app's amber accent and doubles as muscle-map storytelling.

_Rejected:_ free-exercise-db's 1,746 images (Bodybuilding.com studio photographs behind a void Unlicense badge) and ExerciseDB's free GIFs (byte-identical to Gym Visual-attributed files).

### Media: catalogue gap

**Buy Gym Visual N-CRFL direct at ~$0.90/GIF for the 600–900 movements RepDB lacks, but only after written confirmation that a paid subscription app is a permitted 'app' use and not a 'product destined for resale'.**

Gym Visual is the actual rights holder of the art that ExerciseDB resells; buying direct removes the title question entirely for roughly the same money.

_Rejected:_ ExerciseDB.io's $199/$599 packs, whose 'original creator and owner' claim is irreconcilable with byte-identical files another repo publishes as '© Gym visual'.

### Media: long tail and custom exercises

**Build the ~40-archetype programmatic SVG renderer — one 14-segment 2-D rig, joint angles keyframed via CSS transform:rotate on nested <g>, ~4–8 KB per exercise — from our own rig, never from licensed pixels.**

It covers the residual tail at zero marginal cost, is themable and resolution-independent, and is the only thing that lets a user-created custom exercise show a plausible animation instantly instead of an empty box. Building it from our own rig is also a licence requirement: RepDB term 5 forbids using their images as generative-AI input or style reference.

_Rejected:_ Hand-authoring 552 Rive/Lottie loops, a multi-person-year art project, and AI-generating the catalogue from scratch (~24,000 credits plus months of anatomical review to reproduce work someone already QA'd and sells for $499).

### Media format

**Animated WebP with alpha at 512² (phone) and 1024² (tablet), content-addressed on Cloudflare R2 with immutable year-long cache headers, top ~150 bundled in the binary. Never GIF.**

MP4 cannot carry an alpha channel and the transparent background is exactly what lets a demo sit on the near-black surface without a grey box; R2's zero egress avoids Supabase's metered bandwidth on the single largest asset class in the product.

_Rejected:_ MP4/WebM (no alpha) and GIF (1,400 × 3MB ≈ 4.2GB versus ~110MB).

### Exercise identity

**Exercises are (movement_id, equipment_id, load_mode, sorted_variant_signature) with a database-level partial unique index, an immutable ULID that history references, a component-derived slug, and a display name GENERATED by canonicalName() with a fixed modifier order and a 42-character cap.**

There is no code path to inserting 'Barbell Bench Press' and 'Bench Press (Barbell)' as two rows, because both compute the same tuple and the second insert fails at the database. Renaming in the UI changes zero slugs and zero history.

_Rejected:_ Name-keyed identity, which is how every competitor accumulates duplicates that silently split a user's PR history.

### Alias resolution

**Treat it as core infrastructure with a named engineer, a fuzzy near-dupe scorer, and a human review queue, not as a data-cleaning chore.**

Measured overlap between RepDB and free-exercise-db on naive normalisation is 136 of 600 — the true catalogue is ~1,800–2,200 movements hiding behind ~3,269 name spellings, and a weak merge silently corrupts PR detection, e1RM trends and world percentiles, which are precisely the features the product differentiates on.

_Rejected:_ Shipping a merge script and fixing duplicates reactively.

### Muscle taxonomy

**21 canonical muscle groups, one groupWeights vector per exercise summing to 1.00 (CI-asserted), plus a separate non-normalised setCredit map at 1.0 direct / 0.5 indirect. The 74-muscle detail layer is display-only on the exercise sheet.**

Volume attribution becomes a dot product, the readiness engine and the world-standings tab share one model, and Hevy exposes only 15 filters with no delt split — so 21 is a genuine differentiator. Keeping setCredit separate prevents the standard bug where a fractional-set total is compared against RP landmarks that count direct sets only.

_Rejected:_ RepDB's 30 slugs as canonical (finer than any feature uses, and vendor-coupled) and a single matrix serving both kg attribution and weekly set counting.

### e1RM

**Marzagão weight-dependent equation as primary, cross-faded toward the RTS RPE chart as load rises (0% below 40kg, ~36% at 100kg, capped at 60% above 140kg), with per-user per-exercise k calibration after six near-failure sets. Hard-refuse above 12 reps-to-failure for trends and above 6 reps for anything that moves a world rank.**

Two independent derivations agree within 1.3 percentage points at heavy barbell loads, while the weight-dependent curve is 22% more self-consistent on light isolation work; and against the best available meta-regression every formula runs 5–10% hot above 12 reps.

_Rejected:_ Epley/Brzycki alone (both fan out above 10 reps), and Mayhew/Wathan/Lander as display formulas (all return a 1RM above a weight you just did as a single — Mayhew by 8.9%).

### Volume definition

**Report SYSTEM volume (bodyweight included) as the headline total kg, with EXTERNAL volume in the tooltip and the bodyweight factor stated in the set-row hint ('Push Up counted at 64% of your 82 kg = 52.5 kg/rep'). Warm-ups excluded by default with a toggle.**

A 50-rep pull-up session showing 0 kg is a bug, not a design choice; exposing the assumption is what stops users accusing the app of inflating volume; and matching Hevy's convention keeps migrated histories comparable.

_Rejected:_ External-only volume (scores calisthenics at zero) and silently including warm-ups (every power user notices and the volume number becomes untrusted).

### Rank ladder

**b_k = 3.956·k^1.30 over 22 ranks, tier boundaries pinned to the published 5/20/50/80/95 percentile anchors, so the rank ring and the world-standings tab are provably the same number in two skins. Score 27.0 → 'Novice II, 5.0 to Novice III'.**

It reproduces the reference screenshot exactly, lands 100.0 precisely on Advanced→Elite as a clean product story, and the widening bands are the physiologically right shape given that log-space σ shrinks from 0.34 to 0.26 moving up the distribution.

_Rejected:_ Fixed 15-point bands, which demand a larger strength gain to advance at the bottom than at the top.

### What moves rank

**Only demonstrated strength — e1RM normalised for bodyweight, age and sex, from sets of ≤6 reps, on 12 barbell Ranked Lifts. App opens, streaks, badges, likes, session count, subscription tier and volume move it by exactly zero. Machine lifts are tracked and charted but carry countsTowardRank=false.**

This is the single constraint that separates the product from every habit-tracker with a points layer bolted on; a serious lifter checks the ladder first and dismisses the whole app if it is farmable. Machine loading varies 20–40% by manufacturer, so including it would corrupt the one number that has to be credible.

_Rejected:_ An engagement-weighted score, and including machine lifts in rank.

### Rank decay

**21-day grace, then 0.6%/week of current score with a hard floor at 70% of peak; peak rank permanent and displayed beside current; instant full restore on matching the peak-era e1RM; self-declared pause; and decay is NEVER notified.**

Zero decay would be a lie lifters spot and would corrupt the standings tab; punitive decay takes the exact population you most want back and gives them a reason not to return. 'One hard session a week holds everything' is true — one weekly high-intensity session preserves strength for at least 12 weeks — and is the best re-engagement message available because it is not a threat.

_Rejected:_ League-of-Legends-style hard decay (confined to the top 1% there and still the most-complained-about mechanic in the game) and no decay at all.

### Consistency mechanic

**Rhythm counts WEEKS against the user's own declared program target, credits a correctly-executed deload week (volume 40–70% of the trailing 4-week mean with sessions ≥ target−1) as a success, and degrades gradually (−1, then halve, then reset) with longest-ever kept permanently. There is no daily streak anywhere in the product.**

The evidence says train each muscle 2–3×/week with ≥48h rest, so a daily streak asks users to do the thing the literature says not to do — Apple's ring streaks are documented as pushing people to train through illness and injury, and 42% of fitness-app uninstallers say alerts made them feel like they were failing even when they had trained consistently.

_Rejected:_ Daily streaks in any form, including as a secondary stat, and purchasable streak repair.

### Percentile honesty

**Blend our empirical CDF with a log-normal prior fitted to published standards at w = n/(n+400), show a Wilson band widened for prior slack, and suppress the number entirely below n=50 in favour of an honest literal count ('31 lifters like you so far'). Copy is 'Stronger than 78% of lifters like you (±6%)', never 'Top 80%'.**

Our own population is biased upward twice over and 'Top 80%' reads as a failure grade; naming the cohort inline and showing the band is what makes the whole tab credible rather than a made-up number.

_Rejected:_ Raw empirical percentiles from launch, and a single false-precision figure with no cohort or interval.

### Reference population

**Default to gym-app lifters, labelled visibly as 'vs 27M app lifters worldwide · age-graded · 80 kg male', with an optional 'vs competitive powerlifters' toggle.**

The same 1.5×BW bench is Intermediate against the gym population and Novice against competition medians — silently picking the competition dataset would tell most users they are Beginners and churn them.

_Rejected:_ OpenPowerlifting as the default, and never stating which population the number compares against.

### Crash safety

**WAL + synchronous=NORMAL for browsing, raised to FULL (plus fullfsync on iOS) for the duration of a live workout. Persist on semantic events only. Never store elapsed time — duration is now − started_at − paused_ms. An append-only workout_events table is the black box. recoverOnLaunch runs before the first frame.**

SQLite's default synchronous=NORMAL survives a process crash but may roll back on power loss, and 'the phone dying' is power loss; a set that shows a checkmark must have survived fsync. On iOS fsync() does not flush the drive cache, hence fullfsync.

_Rejected:_ Keeping a ticking counter in memory, and trusting the OS default durability class.

### Conflict resolution

**Client-generated UUIDv7 keys, fractional index strings for ordering, an HLC per mutable row, and a per-table policy table (lww_row / lww_field / server_wins / or_set / max / append_only). Two devices logging the same live workout merge at the SET level by client id; probable duplicates are surfaced for the user, never auto-deleted.**

A phone that cold-boots after dying can return with a skewed wall clock, which makes bare updated_at LWW silently wrong; integer positions force a renumber-write across siblings and guarantee conflict storms; and a wrongly deleted set destroys a PR and with it the user's trust.

_Rejected:_ Global last-write-wins, integer positions, server-assigned ids, and picking a winner at the workout level.

### Catalog delivery

**Ship exercises, aliases, groupWeights, equipment and the ~144k-row strength-standards grid as a read-only catalog-<version>.db ATTACHed next to the user database. Never sync it. Deltas download to temp, verify sha256, atomically rename.**

It is ~15MB identical for every user and never changes per-user; syncing it costs every user a large first-run download over gym wifi and gains nothing, while bundling means the app is fully functional offline before login.

_Rejected:_ Putting the catalogue in sync buckets.

### Catalog immutability

**Exercise ids are permanent — deprecation is merged_into_id plus a flattened exercise_redirects table, every workout_exercises row snapshots exercise_slug and name, and muscle contributions are versioned with the version recorded on each logged exercise.**

Retuning the muscle model must not silently rewrite last year's 'you trained quads 40%' charts; recomputation becomes an explicit, user-visible action rather than a number that changes under someone.

_Rejected:_ Deleting or renaming catalogue rows in place.

### Progress photos

**App-internal storage only, encrypted at rest with a Secure-Enclave/StrongBox-wrapped key, excluded from iCloud and Android backup, never written to the OS photo library (we never request add-to-library permission), in a separate store with NO API path to the post composer. Cloud backup is opt-in, server-side encrypted by default, with E2E behind an explicit recovery-code flow.**

Users will not adopt photo tracking unless the privacy story is structural rather than a promise, and 'the code cannot reach Community' is a stronger guarantee than a permission check. Defaulting to E2E is rejected because key loss equals photo loss and the support burden is enormous.

_Rejected:_ Shared storage with a permission gate, and E2E by default.

### Photo capture

**On-device pose landmarks (Vision 19-point / MediaPipe 33-point, scored on the shoulders/hips/ankles subset both expose) versus the previous session's stored reference, with ghost overlay, edge silhouette and auto-shutter at 400ms of held alignment, front→side→back auto-advance. Landmarks are computed for framing only and NEVER persisted. Zero face recognition, ever.**

Hevy caps you at one photo per day so a three-pose set takes three days; nobody in the category scores alignment automatically, which is what makes a full set fit in ~25 seconds. Not persisting landmarks and never running identification is what keeps a photo out of GDPR Art. 9 biometric territory.

_Rejected:_ Manual ghost-overlay alignment only, and any face clustering or identity matching.

### Bodyweight math

**Continuous-time EWMA trend += (1 − e^(−Δt/τ))·(w − trend) with τ = 10 days, a Huber outlier gate against a MAD-derived residual scale, exposed lag correction, and a projection shown as a damped date BAND capped at min(90 days, 2× history).**

The Δt-aware exponent handles irregular weigh-ins without imputation (imputation systematically understates variability), and at Δt = 1 day it reproduces the Hacker's Diet α = 0.0952 exactly. A single confident projected date is a promise the data cannot keep.

_Rejected:_ A Kalman smoother (similar accuracy, more machinery, nothing users can see), daily imputation, and a point-estimate goal date.

### Eating-disorder safety

**Hard BMI 18.5 floor on weight goals, no weight goals at all under 18, loss capped at 1%/week with the CDC/NHS citation shown, a blind mode that shows trend and photos with the number hidden, photo cadence of ≥21 days, at most one bodyweight entry per day, and a competitive circuit breaker that hides leagues and leaderboards at ACWR > 1.5 for 7 days.**

30% of surveyed eating-disorder patients who used MyFitnessPal believed it contributed to their disorder, and MyFitnessPal's underweight warning is dismissible. Exercise-addiction prevalence in gym populations runs 3.6–9.7%, so on any realistic user base several percent of users are at risk.

_Rejected:_ A dismissible warning, and any daily weigh-in or daily body-check mechanic.

### Set types in the UI

**Six types in the menu opened by tapping the SET NUMBER — normal, warm-up, drop, failure, myo-rep, cluster — while storing the full nine-value enum. The rest timer does NOT auto-start when the next set is a drop set or myo-rep.**

Tapping the set number is the interaction every competitor's users already have muscle memory for; nine items in a menu attached to a set number is unusable one-handed; and firing a 2-minute timer on a drop set is a bug the user has to dismiss mid-burn.

_Rejected:_ Long-press-only set typing, a nine-item menu, and a rest timer that fires on every completed set.

### Design system

**Adopt the verified token set at C:\Users\rafam\Stronger-2.0\design\tokens.css and tokens.ts verbatim, with a lint rule failing any hex literal outside design/. Four categorical data colours maximum. Elevation from surface lightness plus a 1px inset top highlight, never shadows. Tabular figures mandatory on every column, counter, axis label and numeric input.**

Every value was measured, not recalled: the obvious #2F80F5 primary fails AA at 3.80:1, green fills need ink not white labels, and no 7-colour categorical palette survives deuteranopia on dark (min ΔE 9.0). Amber-as-solid-fill is reserved to mean 'record' and nothing else.

_Rejected:_ Purple→blue gradients, glassmorphism on cards, emoji as icons, pure #000/#FFF, and any fifth categorical colour.

### Monetisation posture

**Nothing in the act of logging is ever gated: unlimited routines, unlimited exercises, unlimited history, offline logging, CSV/JSON export, and the finish summary are all free forever. Pro sells analytics depth, world standings, photo cloud backup and programming. No streak repairs, no rank boosts, no leaderboard advantage.**

Strong's 3-template cap and Fitbod's no-free-tier generate the worst review clusters in the category ('should be borderline illegal'), while Hevy's generous free tier is the single most-praised attribute in its reviews. Monetising anxiety is the line.

_Rejected:_ Template caps, gating export, and any purchasable competitive advantage.

### Notifications

**Three pushes per week, hard cap, across all categories. None between 21:00 and 07:00 local. None on a day the user's own program marks as rest. The system permission prompt appears only after the third finished workout. Guilt framing is banned by a copy lint rule.**

68% of fitness-app uninstallers cite notification fatigue and 42% say alerts made them feel like they were failing even when they had trained consistently; a notification that restates a state the user could see by opening the app is an ad for our own app.

_Rejected:_ Streak-at-risk pushes, 'Sarah worked out today, did you?', decay notifications, and prompting for permission at launch.

## Build sequence

### Phase 0 — Legal, licensing and foundations (Week 0–2, runs in parallel with everything, blocks nothing but gates launch)

- Buy RepDB Standard ($499). Archive the exact 25,873,826-byte free ZIP, LICENSE.md, and the purchase receipt in cold storage — RepDB is one person in Berlin with a bespoke non-SPDX licence.
- Send the Gym Visual letter today: written confirmation that a paid subscription fitness app is a permitted 'app' use and not a 'product destined for resale', plus a bulk quote for 600–900 GIFs. Legal correspondence has unbounded latency; starting it in month 3 is how you miss launch.
- Add 'Exercise data by RepDB (repdb.co)' to Profile → About → Credits BEFORE the first build. It is a licence condition, not a nicety.
- build/forbidden-sources.json deny-list (static.exercisedb.dev, hasaneyldrm videos, free-exercise-db JPGs, api.musclewiki media) asserted by a CI test that fails the build on any fetch.
- Start the GDPR Art. 35 DPIA for progress photos + bodyweight. It must be signed before the photo feature ships, not after.
- Monorepo: Expo dev client + @powersync/op-sqlite (>=1.17, remove react-native-quick-sqlite) + Supabase + PowerSync Open Edition running locally for dev.
- @stronger/engine package skeleton — platform-free TypeScript, no React Native imports, CI-enforced. Seed it with the units module and the UUIDv7/HLC/fractional-index module.
- Import C:\Users\rafam\Stronger-2.0\design\tokens.css at the app root and add the lint rule that fails on any hex literal outside design/.

**Risk:** Gym Visual's written answer is the only item with genuinely unbounded latency and it gates ~600 exercises of catalogue expansion. If no answer by end of Phase 4, fall back to the archetype SVG renderer for that entire tranche rather than waiting.

### Phase 1 — The canonical catalog (the thing every other feature reads from)

- Ingest pipeline exactly as specced: RepDB free ZIP (601 + 1,056 WebP), free-exercise-db JSON (text fields only), wger /exerciseinfo paged (903), longhaul (404), @bryllim/workout-guide (302 × 3 frames), Everkinetic shallow clone.
- Identity model: id = ULID immutable forever; slug derived from components; partial unique index on (movement_id, equipment_id, load_mode, sorted_variant_signature) WHERE status='active'. Display name is GENERATED by the canonicalName() function, never typed. This is what makes 'Barbell Bench Press' and 'Bench Press (Barbell)' structurally impossible to both exist.
- Alias/normalisation layer with the fuzzy near-dupe scorer (0.45 token_set_ratio + 0.25 movement match + 0.20 equipment class + 0.10 groupWeights cosine); ≥0.92 auto-merge, 0.80–0.92 human review queue (~60 rows seeding 876), <0.80 distinct. exercise_merges table with transitive resolution, depth-capped at 8.
- 21-group canonical muscle enum (from C:\temp\stronger-taxonomy\taxonomy.ts), with RepDB's 30 slugs and wger's 15 mapped in and never stored raw. One groupWeights vector per exercise summing to 1.00, CI-asserted. Separate setCredit map (1.0 direct / 0.5 indirect).
- ~40 movement archetypes, each carrying default axialLoad / loadedStretchIndex / sfr / defaultEccentricSec so the readiness engine has parameters for all 1,190 exercises without authoring four fields per row by hand. Override only the top 150.
- build/04-licence-audit.ts fails the build when any ExerciseMedia has redistributable=false, spdx='UNKNOWN', or reviewedAt=null. dist/CREDITS.md generated mechanically from AssetLicence records and rendered directly in the Credits screen.
- catalog.db: read-only SQLite, ATTACHed next to the user DB, containing exercises + aliases + FTS5 + groupWeights + equipment + the ~144k-row strength standards grid. ~15MB. Never synced.
- Tier 0: 114 core exercises, human-reviewed, each with a demo asset present. Ship nothing without its demo.

**Risk:** Highest-uncertainty phase. Measured overlap between RepDB and free-exercise-db on naive normalisation is 136 of 600 — the alias layer will take longer than anyone estimates, and a weak merge silently corrupts every PR, e1RM trend and percentile downstream. Budget a named engineer and a human review queue, not a weekend.

### Phase 2 — The local write path (start of the first shippable slice)

- SQLite: WAL + synchronous=NORMAL browsing, raised to FULL (+ fullfsync on iOS) for the duration of a live workout. busy_timeout 3000, wal_autocheckpoint 200.
- Workout/exercise/set tables with the sync envelope (updated_at, rev_hlc, origin_device, deleted_at) and fractional pos strings. Append-only workout_events black box.
- Active workout screen to the P0 interaction spec: SET | PREVIOUS | KG | REPS | [RPE] | ✓; set type by tapping the set number; PREVIOUS cell copies on tap; swipe-left delete, swipe-right duplicate; custom numeric keypad with a persistent accessory bar (plate calc, ±steppers, prev/next field, Done) that never covers the focused row; 56pt checkmark with 8pt clear space.
- Rest timer as a persisted absolute endsAt + scheduled local notification. Auto-start on ✓, suppressed when the next set is a drop set or myo-rep, or the next target is a different exercise in a superset. Separate warm-up vs working durations per exercise.
- Duration derived as now − started_at − paused_ms. Never store elapsed seconds.
- recoverOnLaunch(): replay WAL → merge duplicate active workouts → recompute aggregates → resume (<3h idle) / confirm (<18h) / auto-close at last real set (>18h). Runs before the first frame.
- Soft delete with a session-long 'Recently removed' drawer. No 3-second toast is ever the sole undo.
- Engine v1: e1RM (weight-dependent blended to RTS by load), volume with loadModel/bodyweightFactor/unilateral handling, robust session best (confidence-weighted P80 capped by best trusted set), PR detection with margins and the 3-badge cap.
- Plate calculator with native-unit inventories and the brute-force regression test proving greedy optimality over 20–300 kg.

**Risk:** Crash safety is invisible until it fails in production. Write a device-level test that force-kills the process at 200 random points during a scripted 40-set workout and asserts zero data loss; do not rely on manual QA.

### Phase 3 — The Finish payoff (completes the first shippable slice)

- Finish pipeline: aggregate → PR pass → readiness recompute → summary render, all in one transaction, <500ms, zero network.
- Swipeable card deck: session headline with the volume-equivalence line (corrected object masses — 4,000 kg is 0.74 ambulances or 8.3 concert grands, not 2.9 and 45); PRs with old→new deltas or 'closest to a PR'; muscle map; comparison vs your average and vs this routine last time; readiness forecast; lifetime delta.
- Muscle-map share image: SVG front/back, 14 render regions, filled by each region's SHARE of session volume (not absolute, so a 60kg and a 110kg lifter produce equally vivid maps), rasterised on device to 1080×1350 and 1080×1920. Burns in volume/reps/duration/PRs. Never bodyweight, never a photo, never location.
- Volume-equivalence selector: log-Gaussian count score centred on 6.5× with a hard 1.5–40× window, scale-aware relatability↔spectacle blend, 12-deep cooldown with golden-ratio rotation, same-category and near-mass duplicate penalties, 'a whole blue whale' rendering at count ≈ 1.0. Chosen equivalent ids stored on the workout so reopening an old summary is identical forever.
- SHIPPABLE SLICE 1 EXITS HERE: 114 exercises, full logging loop, full finish summary, 100% offline, no account, no sync, no paywall, survives a battery death mid-session. Dogfood it in a real gym for four weeks before building anything else.

**Risk:** Rendering budget. SVG→PNG rasterisation plus six cards plus a count-up animation must land in under 500ms on a mid-range Android right after a workout, with the screen still hot from the set table.

### Phase 4 — Sync, identity and multi-device

- PowerSync connector with the blocking-FIFO dead-letter escape hatch: permanent rejects (23503 FK, 23514 CHECK, 42501 RLS, 22P02) get quarantined and tx.complete()'d, because one poison message otherwise stops all future sync forever.
- apply_mutations RPC: idempotency-gated on client-generated mutation_id with ON CONFLICT DO NOTHING, SECURITY INVOKER so RLS applies, per-mutation result codes.
- sync-rules.yaml under two-person review, plus an automated test that connects as user A and asserts zero rows of user B — PowerSync reads bypass RLS entirely, so this file is the read boundary and no policy will catch a mistake in it.
- RLS everywhere with (select auth.uid()) initPlan wrapping, `to authenticated` on every policy, SECURITY DEFINER helpers in a private schema for follows/group_members, and leading-column indexes on follows(followee_id), follows(follower_id), group_members(user_id).
- Move sex/birth_date/height_cm into a private_profiles own-row table — RLS is row-level and cannot hide a column from a follower who can read the row.
- Advisory device claim (active_device_id, claim_expires_at, claim_seq) for prevention; set-level merge by client id for correctness, with probable duplicates surfaced to the user rather than deleted.
- Adversarial two-device test harness: airplane-mode both, log overlapping workouts, reconnect in both orders, assert set counts and PRs reconcile identically.
- Hevy/Strong CSV import with an exercise-name resolution preview screen, and CSV+JSON export reachable in ≤3 taps with no Pro gate.

**Risk:** Schema migrations. A partial migration is how Boostcamp lost a year of a user's data. Every migration writes a pre-migration snapshot, asserts post-migration row counts ≥ pre, and rolls back on failure.

### Phase 5 — Progress: analytics, readiness, bodyweight, photos

- e1RM trend: Hampel outlier flag in log space + asymmetric time-aware EWMA (21-day half-life, 1.6× up-gain, 0.7× down-gain) + Theil-Sen slope for the per-month chip. Outliers stay in the data, are visible as dots, and do not bend the line.
- Readiness engine on device: two-compartment decay per muscle (structural τ 20–40h, metabolic τ 8–13h) + two-compartment systemic (16h/60h). Warm-ups at 0.15/0.10 and zero volume credit; failure sets get a 1.30 tau-stretch as well as a magnitude bump; drop sets get metabolic 1.85 / structural 1.15 with 0.45^n per-drop attenuation.
- Capacity score = 0.50 systemic + 0.35 volume-weighted muscular + 0.15 uncoupled-ACWR ramp, from the training log alone, with wearables as bounded multiplicative modifiers and an explicit confidence ladder. Cold start returns 100/low with honest copy until two sessions exist.
- Bodyweight: continuous-time EWMA trend += (1 − e^(−Δt/τ))·(w − trend), τ=10 days (reproduces Hacker's Diet α=0.0952 at Δt=1), Huber gate against MAD-derived residual scale, lag correction exposed, projection shown as a damped date band capped at min(90 days, 2× history).
- Progress photos: app-internal storage only, encrypted at rest with a Secure Enclave / StrongBox-wrapped key, excluded from iCloud/Android backup, never written to the OS photo library (we never request add-to-library permission), in a separate store with no API path to the post composer.
- Pose-guided capture: on-device Vision (19 points) / MediaPipe (33 points) scoring the live frame against the previous session's stored landmark subset (shoulders, hips, ankles), ghost overlay + edge silhouette, auto-shutter when alignment holds 400ms, front→side→back auto-advance targeting ~25s. Landmarks are computed for framing and never persisted — persisting them is what would turn a photo into Art. 9 biometric data.
- Goal safety: hard BMI 18.5 floor, no weight goals under 18, loss capped at 1%/week with the CDC/NHS citation shown, blind mode showing trend direction and photos with the number hidden.
- 'How this is calculated' disclosure on every derived number — required by Apple Guideline 1.4.1 and it is also the single best trust feature in the product.

**Risk:** Pose-guided auto-capture is the genuine differentiator and nobody ships it — which means no reference implementation, no known-good thresholds, and a real chance of a frustrating 'it never fires' failure mode. Ship a manual shutter alongside it from day one.

### Phase 6 — World standings

- Standards grid in catalog.db: (scope, key, sex, age_band, bodyweight node, level) with monotone PCHIP interpolation across bodyweight and across the five (ln load, z) percentile anchors. Entirely offline.
- load → z via PCHIP; z → percentile via normCdf; percentile → Iron Score via the anchor table; Iron Score → rank via b_k = 3.956·k^1.30. Score 27.0 renders 'Novice II, 5.0 to Novice III', matching the reference.
- Overall score computed in z-space with the correlation correction z_overall = mean / sqrt(wᵀRw) BEFORE converting to percentile. Averaging per-lift percentiles is wrong and compresses everyone toward the median.
- Per-muscle latent model: hierarchical Bayesian ridge z_e ≈ Σ w[e][m]·θ_m + global, with tier labels gated behind posterior SD < 0.35 and a 'Calibrating — 2 more sessions' state otherwise. Untested muscles render hollow with 'Log a set to unlock', never as zero.
- Reference population defaulted to gym-app lifters, labelled visibly as 'vs 27M app lifters worldwide · age-graded · 80 kg male', with an optional 'vs competitive powerlifters' toggle.
- Percentile honesty: blend own empirical CDF with a log-normal prior fitted to published standards at w = n/(n+400), Wilson interval widened for prior slack, and suppress the number entirely below n=50 in favour of a literal count.
- Copy: 'Stronger than 78% of lifters like you (±6%)', never 'Top 80%'. Weakest group framed as 'your biggest opportunity', with the gap converted back to a concrete load via loadFromZ.
- Machine lifts tracked and charted but countsTowardRank=false, with high τ in the latent model — leg press 'Elite' at 460 kg on one machine is Intermediate on another.

**Risk:** Chicken-and-egg. Percentiles from our own base are biased upward twice (people who track are stronger; people who opt into leaderboards are stronger still). Launch on published standards only, blend own data per-bucket at n≥50, freeze the reference distribution per version, and announce recalibrations.

### Phase 7 — Social, gamification and the Community tab

- Feed, follows (asymmetric), likes as an OR-Set of rows, flat comments with one reply level, groups with roles.
- Privacy defaults shipped as: profile followers-only, workouts followers-only, bodyweight PRIVATE with per-post opt-in that is deliberately NOT remembered, progress photos with no share path at all, leaderboards OFF, location OFF, u18 locked to private with leaderboards/discovery/DMs disabled and not configurable.
- Rhythm: weekly, against the user's own declared target, deload weeks (volume 40–70% of trailing 4-week mean, sessions ≥ target−1) counted as successes, gradual degradation (−1, halve, reset) with longest-ever kept permanently. No daily streak anywhere in the product.
- Iron Score decay: 21-day grace, 0.6%/week of current, floor at 70% of peak, peak permanent and displayed beside current, instant full restore on matching the peak-era e1RM, self-declared pause, and NEVER notified.
- Leaderboards: DOTS-normalised, cohorted by sex × ±5kg band × age band × training age, Open and Verified tiers, showing the person just ahead and the gap — never an absolute global position. Plus a 'Rising' board on 12-week delta so a beginner can win something.
- Anti-cheat ladder L1–L7 with the crucial posture that a flag never deletes the user's data: the lift stays in their log and charts, and is removed only from leaderboards and the percentile denominator.
- Notification budget: 3/week hard cap, none 21:00–07:00 local, none on a program rest day, permission prompt deferred to after the third finished workout, and a banned-copy lint rule.
- Moderation console, report queue, appeals path, published contact and 24-hour response — Apple Guideline 1.2 requires all of it for a UGC app.
- Published Refusal List treated as a spec artefact every feature PR is reviewed against.

**Risk:** Moderation is an ops cost nobody scheduled. Do not ship the Community tab until there is a named human on the report queue and a legal takedown path.

### Phase 8 — Catalog expansion to 1,190, watch, and the long tail

- Gym Visual tranche ingested for the 600–900 movements RepDB lacks, transcoded to a single playback treatment so their 12-frame/1000ms step-through does not sit visibly next to RepDB's 34-frame loops.
- The ~40-archetype programmatic SVG renderer: one 14-segment 2-D rig, joint angles keyframed via CSS transform:rotate on nested <g>, ~4–8 KB per exercise, resolution-independent, theme-recolourable, 100% ours. Covers the residual tail AND gives every user-created custom exercise an instant plausible demo, so the add-custom-exercise flow never shows an empty box.
- In-house instruction/tips/coachTip prose for all 1,190 — the upstream text is verbatim Bodybuilding.com copy and cannot ship.
- Apple Watch app as a second write client with its own device claim, standalone logging so the phone can stay in the locker, and haptic-only timer expiry. Apple Fitness records no sets, reps or weight at all — this is free competitive ground.
- HealthKit / Health Connect two-way sync for bodyweight only. Never photos, never measurements-with-photos.
- Import/export hardening, localisation of the volume-equivalence object set by region.

**Risk:** 552+ demo assets is an art and QA pipeline, not an engineering task, and a wrong demo in a strength app is an injury vector. Keep the rule that a catalog row does not ship until its demo is authored and reviewed.

## Hardest parts

- EXERCISE IDENTITY AND ALIAS RESOLUTION. Measured overlap between RepDB and free-exercise-db on naive normalisation is 136 of 600, because the same lift appears as 'Barbell Bench Press - Medium Grip', 'bench press barbell' and 'Bench Press (Barbell)'. The true catalogue is ~1,800–2,200 movements behind ~3,269 spellings. Get this wrong and you silently create thousands of duplicate exercises, which corrupts the PR engine, the e1RM trends and the world percentiles — the exact three features the product differentiates on. This is the highest-uncertainty estimate in the whole plan.
- TWO-DEVICE OFFLINE MERGE CORRECTNESS. Fractional indexing, hybrid logical clocks, a per-table conflict policy, idempotent mutation replay and set-level merge of a duplicated live workout are each individually understood, but their interaction is only exercised by adversarial testing. The failure mode is invisible in QA and catastrophic in production, and it is where the largest share of schedule risk hides because nobody can estimate debugging a distributed-state bug.
- HONEST PERCENTILES ON A SMALL, SELF-SELECTED POPULATION. Our base is biased upward twice (people who track are stronger; people who opt into leaderboards are stronger again), machine lifts vary 20–40% by manufacturer, and the reference population you choose swings 'Intermediate' by 25–30%. Blending a log-normal prior with shrinkage at w = n/(n+400) and suppressing below n=50 is the right architecture, but calibrating it is an ongoing statistical job, not a ticket.
- THE MUSCLE CONTRIBUTION MATRIX. It is expert judgement informed by EMG, and EMG amplitude is not the same as share of mechanical work or of hypertrophic stimulus. If bench is weighted wrong, a user with a big bench and no triceps isolation gets told their triceps are Elite. It drives volume attribution, the readiness decay, the body map and the per-muscle world standings simultaneously — one matrix, four features, no ground truth.
- THE MEDIA GAP BETWEEN 601 LICENSED AND 1,190 TARGET. Roughly 590 exercises need either a Gym Visual purchase (gated on a letter with unbounded latency) or generated art from a rig that does not exist yet. The rule that a catalogue row does not ship without its demo makes this the binding constraint on catalogue size, and an exercise picker with missing demos reads as broken.
- ON-DEVICE POSE-GUIDED AUTO-CAPTURE. This is the photo feature's differentiator and nobody in the category ships it, which means no reference thresholds, no known-good alignment scoring, and a real risk of a shutter that never fires or fires wrong. Cross-platform it also has to work against the intersection of Vision's 19 points and MediaPipe's 33.
- THE FINISH SUMMARY'S PERFORMANCE BUDGET. Six cards, a rasterised SVG muscle map, a PR pass, a readiness recompute and a count-up animation must land under 500ms on a mid-range Android, entirely offline, immediately after the set table. It looks like a rendering task and is actually a pipeline-scheduling one — and it is the single most emotionally load-bearing screen in the product.
- OPERATIONALISING THE SAFETY GUARDRAILS. Detecting rapid weight loss, overtraining via ACWR, and disordered patterns means inferring sensitive health states from behaviour, which has regulatory implications and can drift toward medical-device framing. Every message has to be non-diagnostic, legally reviewed, and correct — and the circuit breaker that hides leaderboards has to be something users experience as care rather than punishment.

## Gaps

- MONETISATION IS ABSENT FROM ALL ELEVEN TRACKS. No pricing, no entitlement model, no paywall placement, no free-tier limits — yet the UX teardown proves that where you place the gate is the single largest driver of 1-star reviews, and the media CDN cost is a real per-user variable. Entitlements also touch the schema, the sync rules and the RLS policies. Decide pricing before Phase 4, not after.
- APPLE AND GOOGLE REVIEW EXPOSURE IS UNDER-SCOPED. Guideline 1.4.1 requires disclosed methodology for health calculations, and this app ships four of them (e1RM, strength percentile, muscle readiness, capacity score) — a fitness app was rejected for BMI/RMR maths without sources. Guideline 1.2 requires filtering, reporting, blocking, a published contact and 24-hour response for a UGC app. Neither was scoped as work.
- NO WATCH APP SPEC, despite the research finding that Apple Fitness records no sets, reps or weight at all (free competitive ground) and that Strong's broken watch app is a top-3 complaint. A watch app is a SECOND WRITE CLIENT into the sync engine with its own device-claim semantics — architecturally significant, not a skin.
- CSV IMPORT WAS RECOMMENDED IN ONE LINE AND IS ACTUALLY THE ALIAS PROBLEM AGAIN, HARDER. Resolving arbitrary exercise strings from Hevy/Strong/JEFIT exports against our canonical ids has no clean answer, needs a user-facing mapping UI, and has to handle their unit conventions and their per-dumbbell semantics. Budget it as a feature, not a parser.
- CONTENT MODERATION HAS A POLICY BUT NO OPERATIONS. Report queue, moderator console, appeals, legal takedown, CSAM obligations on community media, and a named human on rotation. The UK Online Safety Act posture (prohibit ED-promoting content outright to avoid mandatory age assurance) only works if someone actually moderates.
- LOCALISATION IS UNOWNED. RepDB ships en/de/es; the volume-equivalence catalogue is culturally anchored (a London double-decker and an 80,000 lb US federal semi-truck limit mean nothing in Brazil, and the semi is simply wrong in the EU at 40,000 kg); number and date formatting, and RTL, are unaddressed. The equivalence objects need a region field.
- ACCESSIBILITY BEYOND COLOUR IS MISSING. Contrast and colour-vision were done rigorously; VoiceOver/TalkBack for the set table was not. A grid of unlabelled numeric inputs with a checkmark is a screen-reader disaster, and Switch Control users need the ✓ reachable. Dynamic Type at the largest setting must degrade the set row to two lines rather than truncating numbers.
- ANDROID BACKGROUND RESTRICTIONS FOR THE REST TIMER. Live Activity was specced for iOS; Android needs SCHEDULE_EXACT_ALARM / USE_EXACT_ALARM (with Play Store policy implications) and must still be correct on resume on Xiaomi/Huawei/Samsung devices that kill the process and sometimes drop the alarm entirely.
- THE ENGINE-VERSION CHANGE HAS NO UX. Stamping engine_version and background-recomputing is specced; what the user sees when a formula fix moves their rank is not. That is a trust event. It needs a changelog, a 'your numbers changed because…' screen, and a policy that a displayed rank never silently drops.
- EXERCISE PROSE IS A CONTENT PROJECT NOBODY SCHEDULED. The upstream instructions are verbatim Bodybuilding.com copy and cannot ship, so instructions + tips + common mistakes + coachTip must be written in-house for up to 1,190 exercises. That is several hundred hours of specialist writing, and it gates catalogue expansion just as hard as the art does.
- READINESS NEEDS FOUR MORE AUTHORED FIELDS PER EXERCISE (axialLoad, loadedStretchIndex, sfr, defaultEccentricSec) that no ingestion source provides. Mitigation is to default them from the ~40 movement archetypes already needed for the SVG renderer and override only the top 150 — but that coupling has to be designed deliberately, not discovered.
- NO OBSERVABILITY PLAN. Sync failure rate, dead-letter volume, merge-conflict rate, e1RM outlier rate, plausibility-flag rate and catalogue review-queue depth are the metrics that tell you the system is quietly broken. Without them the first signal is an app-store review saying the app lost a year of data.
- COST MODEL IS UNBUILT. R2 egress per active user, PowerSync per-GB synced and per-1,000 peak clients, Supabase storage for photos, and the cost of a free user who downloads 300MB of demo media. This determines whether the free tier is viable and it was never computed.
- US STATE HEALTH-PRIVACY LAW IS UNADDRESSED. GDPR was covered well; Washington's My Health My Data Act and its consumer-health-data definitions are a live exposure for an app holding body photos, bodyweight and inferred readiness, and it carries a private right of action. Also unaddressed: how age gating is actually verified rather than merely declared.
- PER-EXERCISE UNIT AND BAR OVERRIDES. Storage was solved exactly; entry was not. A US user logging a 20kg bar, per-gym lb plate inventories, Smith machine counterbalance asked once per gym, and the fact that switching units mid-history re-renders every PREVIOUS value — all need a gym-profile object nobody specced.

## Contradictions resolved

- MEDIA LEGALITY — Track 2 called free-exercise-db 'Unlicense (public domain), safe to ingest and modify' including images; Track 1 downloaded one, rendered it, and identified a photograph of an identifiable model on the Bodybuilding.com studio set, traced the corpus to wrkout/exercises.json whose owner sells the same pixels commercially. RESOLVED for Track 1: empirical provenance beats a README badge. Structured fields only; the JPGs go on the CI deny-list; every instruction string is rewritten.
- BUYING THE EXERCISEDB PACK — Track 10 recommended ExerciseDB's one-time commercial licence (1,394 exercises with GIFs, self-hostable) as the media answer; Track 1 SHA-256-compared the bytes and found them identical (a0e42d8d…, 109,751 B) to files another repo publishes with '© Gym visual' per-record attribution, while ExerciseDB.io's FAQ claims original ownership. RESOLVED for Track 1: buying a $599 indemnity from a party whose title is contradicted by byte-identical evidence is worse than buying from the rights holder for similar money.
- BUILD vs BUY THE ANIMATIONS — Track 2 said the 552 animations 'must be produced in-house' as rigged SVG/Lottie; Track 1 verified a 34-frame 512×512 RGBA animated WebP in RepDB's paid sample and priced the tier at $499. RESOLVED: buy for the covered catalogue, build for the long tail. 552 hand-authored anatomically-correct loops is a multi-person-year art project; Track 2's rig idea is right but its correct target is the ~600 exercises nobody licenses, plus user-created custom exercises.
- MEDIA FORMAT — Track 10 said MP4/WebM (40–90KB, 30× smaller than GIF); Track 2 said SVG/Lottie (~25KB); Track 1's licensed asset is animated WebP with alpha. RESOLVED for animated WebP: MP4 cannot carry an alpha channel, and the transparent background is exactly what lets a demo sit on the #0B0F19 surface without a grey box. SVG is the format for the generated tail only.
- MUSCLE TAXONOMY SIZE — five different enums arrived: 30 slugs (T1, RepDB's), 21 groups + 74 muscles (T2), 21 groups (T4), 19 (T5), 14 render regions (T11). RESOLVED to Track 2's 21 groups as the single canonical enum, because readiness (T4) independently converged on 21 and it is the only one shipped with a full front/back SVG region map. Track 4's tibialis folds into calves; Track 2's hip_flexors gets a 36h τ. RepDB's 30 and wger's 15 are mapped in and never stored raw. The 74-muscle layer is display-only.
- THE RANK LADDER — Track 3 proposed S = 36 + 18z with fixed 15-point bands; Track 11 proposed b_k = 3.956·k^1.30 with widening bands. Both reproduce the reference screenshot's 'Novice II at 27 points'. RESOLVED for Track 11's power curve, and the deciding argument comes from Track 3's own data: it measured σ in log space falling monotonically from 0.34 to 0.26 moving up the distribution, which means fixed-width score bands demand a larger strength gain at the bottom than at the top. Widening bands is the physiologically correct shape, and the curve lands 100.0 exactly on Advanced→Elite.
- OVERALL SCORE COMPOSITION — Track 11's overallIronScore takes a weighted mean of per-lift PERCENTILES; Track 3 divides a weighted mean of z by sqrt(wᵀRw) to correct for ρ ≈ 0.6–0.85 between lifts. RESOLVED for Track 3 and Track 11's function is a bug: averaging percentiles of correlated variables compresses everyone toward the 50th and makes 'Top X%' systematically wrong. Track 3's worked example moves a consistent lifter from the 67th to the 70th percentile.
- PERCENTILE COPY — Track 3 specced 'Top 80%' (X = 100 − percentile); Track 11 said that string reads as a failure grade and is ambiguous. RESOLVED for Track 11: 'Stronger than 80% of lifters like you', with the cohort named underneath and the confidence band shown.
- REP CAP FOR e1RM — Track 5 capped at 12 reps-to-failure; Track 11 capped ranking inputs at 6. NOT ACTUALLY IN CONFLICT and both ship as separate thresholds: ≤12 to draw an e1RM trend line, ≤6 to move a world rank. Above 12 the formulas fan out more than the effect being measured.
- BODYWEIGHT LOAD FACTORS — pull-up and dip are 1.00 (T1, T5) or 0.95/0.94 (T2, segment-mass reasoning); bodyweight squat is 0.85 (T1) or 0.78 (T2, Dempster). RESOLVED to 1.00 and 0.85: the 5% forearm-mass correction is unverifiable by any user, and 1.00 matches Hevy's published convention so migrated volume histories stay comparable. Push-up 0.64 and the full Ebben variant table are measured and ship as-is, with the assumption exposed in the set-row tooltip.
- PHOTO ENCRYPTION — Track 9 designed for Secure-Enclave-wrapped per-photo keys with E2E cloud and a 12-word recovery code; Track 10 warned against defaulting to client-side encryption because key loss equals photo loss and you lose server thumbnails. RESOLVED by splitting the two: local-at-rest encryption is always on (free, no downside, and it is what makes 'excluded from backup, never in the photo library' credible), while cloud backup defaults to server-side encryption with E2E as an opt-in behind an explicit recovery-code flow. Track 9's structural decision — photos live in a store with no API path to the post composer — is kept in full and is the most valuable line in that track.
- SET TYPES — 9 (T1), 8 (T4), 7 (T2), 6 (T7). RESOLVED to 6 in the tap-the-set-number menu (normal, warm-up, drop, failure, myo-rep, cluster) because a 9-item menu attached to a set number is unusable one-handed with chalk on your hands, while STORING the full 9-value enum so backoff / AMRAP / rest-pause / partial can be enabled later without a migration.
- MUSCLE CONTRIBUTION MATRICES — three arrived: muscleStimulus (T1), the latent-model W (T3), and volumeShare (T5), all summing to 1.0 and all giving slightly different bench splits. RESOLVED to ONE groupWeights matrix seeded from Track 5's EMG-cited values (chest 0.50 / triceps 0.25 / front delts 0.20 / lats 0.05), reused by volume attribution, readiness fatigue and the latent strength model, PLUS one separate non-normalised setCredit map (1.0 direct / 0.5 indirect) for weekly hard-set counting. Track 5 is right that conflating those two is the standard bug in this category.
- TREND ESTIMATOR — Track 5 used Theil-Sen for e1RM slope; Track 9 used weighted OLS with a confidence interval for bodyweight rate. RESOLVED by series type: Theil-Sen on raw, sparse, outlier-prone series (e1RM), OLS on the already-smoothed series (bodyweight trend), because the EWMA has already removed the outliers OLS would choke on and OLS is what gives the projection band its interval.
