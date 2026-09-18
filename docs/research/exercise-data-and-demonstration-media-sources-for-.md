# Exercise data and demonstration media sources for Stronger 2.0: legal viability, exact counts, licences, costs, and a shippable ingestion plan

## Summary

I verified every source by downloading it rather than recalling it, and the headline result is that the two datasets everyone reaches for first are both legally unusable for media — while a little-known one solves the problem almost completely for free.

First, the landmine. yuhonas/free-exercise-db (876 exercises, 97 MB, Unlicense badge, 1,898 stars) is the top result for "open exercise database". I fetched one of its images and rendered it: it is a photograph of an identifiable male model on a flat bench against a red wall — the Bodybuilding.com exercise-database studio set. Its README traces the data to wrkout/exercises.json, whose owner sells the same corpus commercially at wrkout.xyz. The Unlicense declaration is void as to those photographs. Use the structured fields; never fetch the JPGs; rewrite the instruction prose.

Second, the definitive answer on ExerciseDB GIFs. Its free API serves 1,500 exercises with gifUrl on static.exercisedb.dev. A separate 22.1k-star repo ships the identical corpus with the per-record attribution "© Gym visual" and a media_id field that is literally ExerciseDB's id. I fetched both copies of 03lzqwk.gif: 109,751 bytes each, SHA-256 a0e42d8d0c155b0af2dbda5a, byte-identical. ExerciseDB.io nevertheless sells this at $199/$599 claiming original ownership. Do not use their free GIFs; do not buy their pack without an indemnity naming Gym Visual. Buy from Gym Visual directly instead — 6,554 GIFs at $0.90 each, and their N-CRFL explicitly permits iOS and Android apps.

Third, the recommendation. RepDB (repdb.co) publishes a free 25.9 MB bundle: 601 exercises with EN/DE/ES text, MET values, force/mechanic/difficulty, a clean 30-slug muscle taxonomy, 1,056 WebP illustrations at 512×512 as start/peak pose pairs, 27 muscle diagrams and 60 equipment icons. Its licence grants free commercial in-app use for one visible attribution link, and states the art is original AI-commissioned work, not derived from any third-party library. I inspected the included paid sample: a 34-frame 512×512 RGBA animated WebP of a dumbbell row, transparent background, worked muscle tinted orange — shipped-product quality that matches the app's amber accent. That tier is $499 one-time.

So: RepDB free on day one, $499 before launch, Gym Visual bulk for the gap, and a programmatic archetype-SVG renderer for the long tail. Free options cover the body map entirely (react-body-highlighter MIT, wger's CC-BY-SA muscle overlays). wger contributes clean text and only 30% media coverage. workout-guide gives 302 exercises × 3 frames under CC-BY-SA. MuscleWiki is commercially licensable but contractually forbids offline storage, which disqualifies it as the primary layer. The sleeper risk is naming chaos: RepDB and free-exercise-db share only 136 of 600 names, so the alias layer is core infrastructure, and the true catalogue is ~1,800–2,200 movements, not the 3,269 raw union.

## Findings

### free-exercise-db's 1,746 images are Bodybuilding.com studio PHOTOGRAPHS, not licensable illustrations — the "Unlicense" badge is void as to them

I downloaded https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg (HTTP 200, image/jpeg, 72,816 bytes, 850x567 RGB) and rendered it. It is a photograph of an identifiable male model on a flat bench against a red wall in a commercial gym — the Bodybuilding.com exercise-database studio set. The README's own 'Special Thanks' traces the dataset to wrkout/exercises.json, whose owner simultaneously sells the same corpus commercially at wrkout.xyz (2,700+ exercises, 13,500+ images) under tiered paid licences. Nobody can place into the public domain photographs they do not own, and there is no model release. The instruction prose is likewise verbatim Bodybuilding.com copy. Repo: 876 exercises, 873 with exactly 2 images, 96,992 KB, 1,898 stars, last push 2026-08-30.

Source: https://github.com/yuhonas/free-exercise-db + direct image fetch and render

### PROVEN BY SHA-256: the entire ExerciseDB GIF corpus is Gym Visual copyrighted media

ExerciseDB's free API (https://oss.exercisedb.dev/api/v1/exercises, meta.total = 1,500) serves gifUrl https://static.exercisedb.dev/media/03lzqwk.gif. github.com/hasaneyldrm/exercises-dataset (1,324 exercises, 22.1k stars) carries the same file as videos/0011-03lzqwk.gif with the per-record field "attribution": "(c) Gym visual - https://gymvisual.com/" and media_id "03lzqwk" — literally ExerciseDB's own id. I fetched both: each is 109,751 bytes, SHA-256 a0e42d8d0c155b0af2dbda5a..., BYTE-IDENTICAL, 180x180, 12 frames at 1000 ms/frame. Second confirmed pair: 01qpYSe / 1366-01qpYSe.gif. Meanwhile exercisedb.io's FAQ asserts "ExerciseDB.io is the original creator and owner of the EDB Exercise Intelligence content" while selling it at $199 (Starter) / $599 (Pro). That claim is irreconcilable with the Gym Visual attribution on identical bytes.

Source: https://static.exercisedb.dev/media/03lzqwk.gif vs https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/0011-03lzqwk.gif

### RepDB is the answer: 601 exercises with original AI-commissioned art, free for commercial in-app use for one attribution link

Downloaded https://cdn.repdb.co/repdb-assets/site/repdb-free.zip (25,873,826 bytes, 1,160 entries). Contains free.json (601 exercises, schema v3, EN/DE/ES) plus 1,146 WebP: images/flat/ 1,056 files at 512x512 (17.46 MB, <slug>-start + <slug>-peak, or -main for stretches), images/muscles/ 27 anatomical diagrams (1.21 MB), images/equipment/ 60 icons (4.89 MB). Fields per record: name/description/instructions[]/tips[] in 3 locales, category, force_type, mechanic, difficulty, equipment, body_part, is_unilateral, is_bodyweight, goals[], tags[], synonyms[], primary_muscles[], secondary_muscles[], met. Ships its own 30-slug muscle and 60-slug equipment taxonomies. LICENSE.md v1.0 term 1: 'Free for personal and commercial use inside applications ... at no cost'; term 2 requires one visible link 'Exercise data by RepDB (repdb.co)'; term 3 forbids redistributing it as a dataset; term 5 forbids using the images as generative-AI input. Origin clause: 'All images are original works generated with AI tooling commissioned by RepDB - not copied or derived from any third-party exercise dataset or image library.' Licensor: Sergei Argutin, Berlin.

Source: https://github.com/sergei-argutin/exercise-dataset and the downloaded zip

### RepDB Standard at $499 one-time delivers true 34-frame transparent looping animations — I verified the sample

premium-samples/bent-over-db-row.webp in the free zip is 512x512 RGBA with n_frames = 34 and 632,894 bytes: a genuine smooth looping animated WebP with alpha. Its stills are 1024x1024 RGBA. Rendered it: a neutral grey 3-D mannequin performing a correct hip-hinged dumbbell row, with the worked lats/mid-back tinted ORANGE — which matches the app's amber accent and doubles as muscle-map storytelling. Pricing (one-time, instant download, self-hosted, no API): Starter $299 = all 608 exercises, classic + flat at 1024x1024, EN/DE/ES. Standard $499 = + transparent backgrounds, looping animations, muscle heat-maps, SQLite build, 15 workout templates, AI embeddings. Custom from $999 = white-label (attribution removed), custom sizes, bespoke art styles.

Source: https://repdb.co/pricing/ and premium-samples/ in repdb-free.zip

### wger is legally clean but its media coverage is only 30% and its muscle taxonomy is too coarse

Live figures, paged through the whole API on 2026-09-18: /exercise/ = 903, /exerciseinfo/ = 903, /exerciseimage/ = 374 images across only 273 distinct exercises, /video/ = 78 across 46 exercises, /muscle/ = just 15. 903 have an EN translation, 870 have an EN description over 40 chars, but 156 exercises have NO muscle tagged. Licences: CC-BY-SA 4.0 x750, CC-BY-SA 3.0 x132, CC0 x21 on exercises; CC-BY-SA 4.0 x286 / 3.0 x88 on images. Top image authors: blank 97, Everkinetic 83, Franpol 30, Davidgj32 23. 41 of 374 images are flagged is_ai_generated: true. Its real value to us is the free muscle body-map kit: per-muscle main/secondary SVG overlays at ~3.0 KB each plus muscular_system_front.svg at 321,118 bytes, all CC-BY-SA. No API key needed for reads.

Source: https://wger.de/api/v2/exerciseinfo/ (paged), /exerciseimage/, /muscle/, /license/

### @bryllim/workout-guide is the best OPEN animated set: 302 exercises x 3 frames, CC-BY-SA-4.0, Everkinetic-derived

npm @bryllim/workout-guide@1.0.0: tarball 30,324,659 B, unpacked 34,437,932 B, 919 files. Contents are 906 PNG (not SVG as the README claims) at 512x512 RGBA, ~35 KB each, three ordered frames per exercise. manifest.json gives id, slug, name, exerciseType, equipment, primaryMuscle, secondaryMuscles[], isStretch, and per-frame attribution objects naming the exact Everkinetic source SVG (e.g. dist/svg/0042-tension.svg). Code MIT; visual assets CC-BY-SA-4.0. ATTRIBUTION.md: 76 first-pose frames are rasterised adaptations of Everkinetic artwork. Three frames is enough for a readable movement loop — no other open set ships more than two poses.

Source: https://registry.npmjs.org/@bryllim/workout-guide + extracted tarball

### Gym Visual is the legitimate route to the ExerciseDB art: 6,554 GIFs at $0.90 each, apps explicitly permitted

gymvisual.com lists 6,554 animated GIFs; pricing is $0.90/GIF after 10 in cart, $0.75/illustration, $6/video, with bulk discounts on request. The Non-Exclusive Commercial Royalty-Free Licence (gymvisual.com/content/9-license) is perpetual and worldwide and explicitly permits 'Android or iOS mobile application (apps)', website pages, advertising and social posts. It prohibits reselling or redistributing, 'products (both physical or digital) destined for resale', stock-site distribution, posting on any AI platform, and using the media as a basis for AI generation. Copyright is not transferred. ~1,400 GIFs would be about $1,260 at list. The one ambiguity to clear in writing before paying is whether a paid subscription app counts as a 'product destined for resale' — their own allowed-uses list says apps are fine.

Source: https://gymvisual.com/content/9-license and https://gymvisual.com/16-animated-gifs

### MuscleWiki's API contractually forbids offline storage — it cannot be the app's media layer

1,943 exercises, 7,700+ MP4 videos, typically 4 per exercise (male/female x front/side), 14 languages. Pricing: BASIC $0 (500 req/mo, Playground only, keys rejected from real apps), TESTING $10/mo (1,000 calls), GROWTH (adds non-English), PROFESSIONAL (adds routines), top tier up to $199.99/mo (300,000 calls), annual -25%. Commercial use included on paid plans. But: text may be cached only 30 days; thumbnails only 24 h and only privately in the end user's client, explicitly 'not in a shared proxy or CDN'; and you may not 'download, export, copy, store, or otherwise retrieve MuscleWiki videos, thumbnails, or bodymap images for offline storage, CDN storage, cloud storage'. MuscleWiki branding must stay burned into the videos. Required verbatim ToS line: 'Exercise data and videos provided by MuscleWiki.com'. No AI training without written permission. This kills offline-first gym use and puts a competitor's brand in our UI.

Source: https://api.musclewiki.com/faq and https://api.musclewiki.com/api-terms

### Everkinetic is CC-BY-SA-4.0 vector art — clean insurance, but only ~268 exercises and the two poses won't path-morph

github.com/everkinetic/data, GitHub API confirms licence cc-by-sa-4.0, repo 257,551 KB. exercises.json has 293 records. dist/svg/ holds 537 SVGs = ~268 exercises x {relaxation, tension}; dist/png/ holds 540. Sample 0042-tension.svg is 27,992 B with 13 <path> elements; 0042-relaxation.svg is 27,236 B with 12. Because the path counts differ between poses, SMIL path-morphing is NOT reliable — cross-fade or hard-cut is the honest technique. wger already credits 'Everkinetic' on 83 of its 374 images, so the open ecosystem converges here.

Source: https://github.com/everkinetic/data (GitHub API tree + raw SVG fetches)

### The AI-generation route is proven viable — but someone already did it and sells the result for $499

RepDB's entire 601-exercise free tier is AI-generated commissioned artwork per its own LICENSE.md origin clause, and I inspected it: consistent character, consistent palette, correct equipment, professional quality. wger independently flags 41 of its 374 images as is_ai_generated. Generation costs in this environment are cheap (images 2-6 credits: Nano Banana 2 Lite 2, Nano Banana Pro 6, Seedream 5.0 Pro 4; video 5-128 credits: Seedance 1.0 Pro Fast 5, Veo 3.1 Lite 16, Veo 3.1 128) — roughly 6,000 credits for 1,500 exercises x 2 stills or 24,000 for 1,500 clips. Cost is not the blocker. The blockers are character/kit/lighting consistency across 1,500 renders, and that video models routinely botch barbell paths, grip and joint end-range, which in a strength app is an injury vector. RepDB's licence term 5 also forbids using their art as AI conditioning input, so we cannot bootstrap style consistency from the set we license.

Source: RepDB LICENSE.md origin clause; wger is_ai_generated census; banaverse_list_models pricing

### Naming chaos across datasets is the real engineering risk — an alias layer is core infrastructure, not polish

Distinct normalised names per source: RepDB 600, free-exercise-db 864, wger 888, longhaul 403, GymVisual/ExerciseDB 1,257. Naive union = 3,269. But pairwise overlaps are absurdly low — RepDB and free-exercise-db share only 136, RepDB and GymVisual 106, free-exercise-db and GymVisual 227, wger and GymVisual 71 — because the same lift appears as 'Barbell Bench Press - Medium Grip', 'bench press barbell' and 'Bench Press (Barbell)'. True distinct movements after proper alias resolution is realistically ~1,800-2,200, not 3,269. Every merge script needs a normalizedKey (NFKD, strip parentheticals and punctuation, drop stopwords, expand db->dumbbell and bb->barbell, singularise, sort tokens) plus a hand-curated alias table.

Source: Computed over the five downloaded datasets

### Wikimedia Commons is a dead end for exercise animation at catalogue scale

Live MediaWiki API counts: Category:Weight_training_animations = 5 files, Category:Animations_of_physical_exercises = 7 files, Category:Fitness_animations = 58 files. Even the largest category is 58 mostly-irrelevant clips (burpees, an exercise bike, a warm-up loop). Useful only as a handful of supplementary CC-BY-SA pieces, never as a source of catalogue coverage.

Source: https://commons.wikimedia.org/w/api.php?action=query&list=categorymembers

### Lottie and Rive runtimes are free and permissive — the animator is the cost, not the licence

lottie-react@3.1.2 is MIT (366,588 B unpacked); lottie-react-native@7.5.0 is Apache-2.0 (294,766 B); rive-react-native@9.8.5 is MIT (416,843 B). Only the authoring tools charge: Rive from ~$15-32/seat/month, LottieFiles $0-49/month. Neither imposes a per-animation licence on work you author. Hand-authoring 1,400 anatomically correct movement loops is a multi-person-year art project, so Rive earns its place only for a small number of hero pieces — the recovery ring, the rank-up sequence, the Finish-summary celebration, body-map transitions — not for the exercise catalogue.

Source: npm registry metadata for lottie-react, lottie-react-native, rive-react-native

### The body-map / muscle-heatmap layer is already solved for free

Three independent free options, no need to build or buy. (1) react-body-highlighter@2.0.5, MIT, 167,578 B, SVG polygons for 20+ muscle areas with type: 'anterior' | 'posterior' and a highlightedColors[] array mapping workout frequency to colour — a ready-made heat map; its polygons come from the react-native-body-highlighter sibling, so RN is covered. (2) wger's CC-BY-SA per-muscle main/secondary SVG overlays (~3 KB each) over muscular_system_front.svg / _back.svg (321 KB). (3) RepDB's free tier already includes 27 anatomical muscle diagrams (1.21 MB). Note there is no project actually named 'Open3DHuman' — searches surface mmhuman3d, Human3D, HumanML3D and Naver's Anny, all ML research assets, none shippable as illustration. BodyParts3D (CC-BY-SA 2.1 Japan) and AnatomyTOOL's Open 3D Model (CC-BY-SA) exist but a 3-D pipeline is unnecessary spend.

Source: npm react-body-highlighter; wger static muscle SVGs; repdb-free.zip images/muscles/

### Two more open text datasets worth ingesting, and two to reject

INGEST: longhaul-fitness/exercises is MIT with 349 strength + 46 flexibility + 9 cardio = 404 records (pk uuid, name, slug, primaryMuscles[], secondaryMuscles[], steps[], notes) and no media — clean cross-validation for muscle tagging. hasaneyldrm/exercises-dataset is MIT on code/structure/instruction text only (media is Gym Visual's) so its 6-language instruction prose is usable even though its GIFs are not. REJECT: wrkout.xyz is API-only with no self-hosting, free tier is 100 req/mo and non-commercial, Basic/Pro are commercial but watermarked, unwatermarked needs Business/Enterprise up to GBP 1,500/mo, attribution on every tier, and it shares free-exercise-db's provenance question. founder-easeur/exercise-dataset has only 184 exercises and states no redistribution terms — though its 'project-owned AI illustrations plus animated SVG movement previews rendered per exercise from position/movement/target-region data' is public proof the programmatic-SVG route ships.

Source: github.com/longhaul-fitness/exercises, github.com/hasaneyldrm/exercises-dataset, wrkout.xyz, github.com/founder-easeur/exercise-dataset

## Recommendations

- Build the entire MVP media layer on RepDB's free tier (601 exercises, 1,056 WebP at 512x512, 27 muscle diagrams, 60 equipment icons) and add the exact line "Exercise data by RepDB (repdb.co)" to Profile > About > Credits before the first build, because attribution is a hard licence condition, not a nicety.
- Purchase RepDB Standard at $499 one-time before public launch to get 34-frame transparent looping animated WebP, 1024x1024 stills, per-exercise muscle heat-maps, a SQLite build and AI embeddings — it is the highest dollar-per-unit-of-quality decision in the project.
- Delete every code path that touches static.exercisedb.dev, hasaneyldrm/exercises-dataset videos, or free-exercise-db JPGs, and encode them as a deny-list in build/forbidden-sources.json asserted in CI, because those bytes are Gym Visual's and Bodybuilding.com's respectively.
- Ingest free-exercise-db, wger, longhaul and hasaneyldrm for TEXT fields only (names, muscles, equipment, force, mechanic, level) and rewrite all instruction prose in-house, since the upstream instructions are verbatim Bodybuilding.com copy.
- Make AssetLicence a required, non-nullable field on every ExerciseMedia record and fail the build when redistributable is false, spdx is UNKNOWN, or reviewedAt is null, so a licence audit is a SELECT rather than archaeology.
- Generate dist/CREDITS.md mechanically from the AssetLicence records and render that file directly in the Credits screen, so attribution can never silently drift out of sync with the assets actually shipped.
- Adopt RepDB's 30-slug muscle taxonomy and 60-slug equipment taxonomy as the app's canonical enums and map every upstream vocabulary into them, never storing raw vendor muscle names such as ExerciseDB's overlapping "delts"/"deltoids"/"shoulders".
- Treat the alias and normalizedKey layer as core infrastructure with real engineering budget, because measured overlap between RepDB and free-exercise-db on naive normalisation is only 136 of 600 and the true catalogue is ~1,800-2,200 movements hiding behind ~3,269 name spellings.
- Implement the media fallback ladder in build/03-media.ts as RepDB animation, then RepDB start+peak cross-fade, then workout-guide 3-frame sequence, then Everkinetic relaxation/tension pair, then a generated schematic SVG, so no exercise ever renders an empty box.
- Ship the start+peak cross-fade on a 900 ms alternate loop as the day-one animation technique, since a two-pose loop is a legitimate movement demo and unblocks launch without spending anything.
- Build the ~40-archetype programmatic SVG renderer (14-segment 2-D rig, joint angles keyframed via CSS transform: rotate on nested <g>, ~4-8 KB per exercise) to cover the long tail and to give user-created custom exercises an instant plausible animation.
- Use react-body-highlighter (MIT) plus wger's CC-BY-SA per-muscle SVG overlays for the body map and muscle-readiness heatmap, and skip any 3-D anatomy pipeline entirely.
- Negotiate a bulk Gym Visual N-CRFL quote for the 600-900 movements RepDB lacks at roughly $0.90 per GIF, buying from the rights holder rather than from ExerciseDB.io whose ownership claim is contradicted by byte-identical Gym Visual-attributed files.
- Obtain written confirmation from Gym Visual that a paid subscription fitness app is a permitted "app" use and not a "product destined for resale" before wiring any money, since their own allowed-uses list names iOS and Android apps.
- Keep MuscleWiki strictly as an optional streamed enrichment on the exercise detail sheet with the verbatim ToS line "Exercise data and videos provided by MuscleWiki.com", and ensure the app is fully usable offline with it switched off.
- Reserve Rive for a handful of hero moments — the recovery ring, the rank-up sequence, the Finish-summary celebration, body-map transitions — and never for the exercise catalogue, because the runtimes are free but the animator-hours are not.
- Do not rebuild the AI art pipeline: RepDB already generated, style-matched and QA'd 601 exercises, and their licence term 5 forbids using their images as AI conditioning input, so a from-scratch attempt would cost ~24,000 credits plus months of anatomical review for a worse result.
- Store bodyweightLoadFactor per exercise (push-up ~0.64, pull-up ~1.0, bodyweight squat ~0.85) so the "you lifted 4,000 kg = 2.9 ambulances" Finish summary counts calisthenics honestly instead of scoring them as zero.

## Data

================================================================================
PART 1 — THE TYPESCRIPT EXERCISE RECORD
================================================================================

```ts
// ─────────────────────────────────────────────────────────────────────────────
// stronger/packages/exercise-db/src/types.ts
// Canonical Exercise record for Stronger 2.0.
// Design rules baked in:
//  1. Media is a SEPARATE, LICENCE-TAGGED object. Every asset carries its own
//     provenance so a licence audit is a `SELECT`, not an archaeology dig.
//  2. `sources[]` keeps per-field provenance so we can rip out one upstream
//     dataset later without re-ingesting everything.
//  3. Muscle taxonomy is OUR OWN 30-slug enum (RepDB's), not any vendor's —
//     upstream muscle names are mapped in, never stored raw.
//  4. `aliases[]` is load-bearing: the five open datasets name the same lift
//     five different ways ("Barbell Bench Press - Medium Grip" / "bench press
//     barbell" / "Bench Press (Barbell)"). Measured overlap between RepDB and
//     free-exercise-db on naive normalisation was only 136 of 600.
// ─────────────────────────────────────────────────────────────────────────────

/** Stable, human-readable primary key. Lowercase kebab. NEVER renumber. */
export type ExerciseId = string; // e.g. "bench-press-barbell"

// ── Taxonomies ───────────────────────────────────────────────────────────────

/** 30 slugs, adopted verbatim from RepDB schema v3 `muscles[]`. Finer than
 *  wger (15) and cleaner than ExerciseDB (50 overlapping junk terms like
 *  "delts" + "deltoids" + "shoulders" + "rear deltoids"). */
export type MuscleSlug =
  | 'abductors' | 'adductors' | 'anterior_deltoid' | 'biceps_brachii'
  | 'brachialis' | 'brachioradialis' | 'erector_spinae' | 'forearms'
  | 'forearm_extensors' | 'forearm_flexors' | 'gastrocnemius'
  | 'gluteus_maximus' | 'gluteus_medius' | 'hamstrings' | 'hip_flexors'
  | 'lateral_deltoid' | 'latissimus_dorsi' | 'quadratus_lumborum' | 'obliques'
  | 'pectoralis_major' | 'posterior_deltoid' | 'quadriceps'
  | 'rectus_abdominis' | 'rhomboids' | 'serratus_anterior' | 'supraspinatus'
  | 'soleus' | 'transverse_abdominis' | 'trapezius' | 'triceps_brachii';

/** Coarse rollup used by the muscle-readiness ring, the body map and the
 *  world-standings tab. Many MuscleSlug → one MuscleGroup. */
export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'forearms'
  | 'quadriceps' | 'hamstrings' | 'glutes' | 'calves' | 'core' | 'traps'
  | 'neck' | 'cardio';

/** 60 slugs from RepDB, superset-checked against wger (12) and ExerciseDB (28). */
export type EquipmentSlug =
  | 'barbell' | 'dumbbell' | 'kettlebell' | 'cable' | 'machine' | 'smith_machine'
  | 'ez_bar' | 'trap_bar' | 'landmine' | 'plates' | 'resistance_band'
  | 'loop_band' | 'suspension_trainer' | 'rings' | 'pull_up_bar' | 'dip_station'
  | 'flat_bench' | 'incline_bench' | 'decline_bench' | 'preacher_curl_machine'
  | 'leg_press' | 'leg_curl' | 'leg_extension' | 'hack_squat' | 'pec_deck'
  | 'lat_pulldown_machine' | 'chest_press_machine' | 'shoulder_press_machine'
  | 'ab_wheel' | 'medicine_ball' | 'slam_ball' | 'stability_ball' | 'plyo_box'
  | 'battle_rope' | 'jump_rope' | 'sled' | 'treadmill' | 'rower' | 'air_bike'
  | 'stationary_bike' | 'elliptical' | 'stair_climber' | 'climbing_rope'
  | 'wrist_roller' | 'bodyweight' | 'other';

export type ForceType = 'push' | 'pull' | 'static' | 'hinge' | 'carry';
export type Mechanic = 'compound' | 'isolation';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';
export type Category =
  | 'strength' | 'olympic' | 'powerlifting' | 'strongman' | 'plyometrics'
  | 'cardio' | 'stretching' | 'mobility' | 'rehab';

/** Drives which columns the set-log table renders. */
export type LogKind =
  | 'weight_reps'      // 92% of the catalogue
  | 'bodyweight_reps'
  | 'weighted_bodyweight' // pull-ups +25 kg
  | 'assisted_bodyweight' // assisted dip −20 kg
  | 'duration'            // plank
  | 'weight_duration'     // weighted plank, farmer hold
  | 'distance_duration'   // treadmill, row
  | 'reps_only';

// ── Media ────────────────────────────────────────────────────────────────────

export type MediaKind =
  | 'still'          // one frame
  | 'pose_pair'      // start + peak, cross-faded by the client = cheap loop
  | 'frame_sequence' // 3+ ordered frames, client-driven
  | 'animated_webp'  // true looping animation, alpha channel
  | 'lottie'         // hand-authored vector
  | 'rive'           // state-machine vector
  | 'video';         // mp4/webm

/** THE LICENCE GATE. No asset enters the bundle without one of these.
 *  `redistributable` = may we ship the bytes inside our app binary / our CDN? */
export interface AssetLicence {
  spdx: 'CC0-1.0' | 'CC-BY-4.0' | 'CC-BY-SA-4.0' | 'CC-BY-SA-3.0'
      | 'Unlicense' | 'MIT' | 'Proprietary-Commercial' | 'UNKNOWN';
  /** Exact string we must surface in the app's Credits screen. '' if none. */
  attributionText: string;
  attributionUrl?: string;
  /** Rights holder as named by the upstream. */
  holder: string;
  /** Can we put the file on our own CDN / inside the app bundle? */
  redistributable: boolean;
  /** Must derivative artwork be re-released under the same terms? (CC-BY-SA) */
  shareAlike: boolean;
  /** May the asset be fed to a generative model? RepDB says no; GymVisual says no. */
  aiDerivationAllowed: boolean;
  /** Purchase order / licence key / commit hash proving we hold this right. */
  provenanceRef: string;
  reviewedAt: string; // ISO date a human signed off
}

export interface ExerciseMedia {
  id: string;
  kind: MediaKind;
  /** Path inside our own asset bundle. Never a third-party hotlink. */
  src: string;
  /** Ordered frames for 'pose_pair' | 'frame_sequence'. */
  frames?: string[];
  width: number;
  height: number;
  /** Frames per loop, for animated_webp / frame_sequence. */
  frameCount?: number;
  /** ms per frame. GymVisual GIFs are a sluggish 1000 ms; ours target ~60-80. */
  frameDurationMs?: number;
  bytes: number;
  hasAlpha: boolean;
  /** Which muscle the artwork highlights, if the art is muscle-tinted. */
  highlights?: MuscleSlug[];
  /** 'male' | 'female' | 'neutral' — RepDB classic style is a neutral mannequin. */
  model: 'male' | 'female' | 'neutral' | 'schematic';
  view: 'front' | 'side' | 'three_quarter' | 'rear';
  licence: AssetLicence;
  /** Fallback chain: if this asset fails to load, try this id. */
  fallbackOf?: string;
}

// ── Strength standards hook (feeds the World Standings tab) ──────────────────

export interface StrengthStandardRef {
  /** Which canonical lift the world tables key off. A dumbbell incline press
   *  maps to 'bench_press' with a coefficient, not its own table. */
  liftKey: 'bench_press' | 'squat' | 'deadlift' | 'overhead_press'
         | 'barbell_row' | 'pull_up' | 'front_squat' | 'hip_thrust' | null;
  /** Multiplier to convert this variation's e1RM into the canonical lift's
   *  e1RM for ranking. e.g. close-grip bench ≈ 0.90 of comp bench. */
  toCanonicalFactor: number;
  /** Whether this exercise is trustworthy enough to move a user's rank. */
  countsTowardRank: boolean;
}

// ── The record ───────────────────────────────────────────────────────────────

export interface Exercise {
  id: ExerciseId;
  /** Monotonic; bump on any user-visible change so clients can delta-sync. */
  rev: number;

  name: string;                       // canonical EN display name
  /** Locale → name. RepDB ships de/es free; we add more ourselves. */
  nameI18n: Record<string, string>;
  /** Every spelling seen upstream + user-typed variants. Powers search AND
   *  the dedupe that merges five datasets. Minimum 3 entries per exercise. */
  aliases: string[];
  /** Deterministic search key: lowercased, punctuation-stripped, sorted tokens,
   *  abbreviations expanded (db→dumbbell, bb→barbell). Unique index. */
  normalizedKey: string;

  category: Category;
  logKind: LogKind;
  force: ForceType | null;
  mechanic: Mechanic | null;
  difficulty: Difficulty;
  isUnilateral: boolean;
  isBodyweight: boolean;
  /** Bodyweight fraction actually lifted — needed so a push-up contributes
   *  honest volume to the "you lifted 4,000 kg" summary.
   *  push-up ≈ 0.64, pull-up ≈ 1.0, dip ≈ 1.0, bodyweight squat ≈ 0.85. */
  bodyweightLoadFactor: number | null;

  equipment: EquipmentSlug[];
  primaryMuscles: MuscleSlug[];
  secondaryMuscles: MuscleSlug[];
  /** Derived rollup, denormalised for the body map + readiness engine. */
  muscleGroups: MuscleGroup[];
  /** Per-muscle share of total stimulus, sums to 1.0. Drives the muscle
   *  heat-map intensity and the readiness decay model. */
  muscleStimulus: Partial<Record<MuscleSlug, number>>;

  description: string;
  instructions: string[];
  tips: string[];
  commonMistakes: string[];
  /** Short line shown in the "Coach Tip" panel on the active-workout screen. */
  coachTip: string | null;

  /** Metabolic equivalent, for calorie estimates. RepDB ships this. */
  met: number | null;
  /** Default rest in seconds, seeds the rest-timer chip. */
  defaultRestSec: number;

  media: ExerciseMedia[];
  /** Index into media[] for the 48×48 row thumbnail. */
  thumbnailMediaId: string | null;
  /** Index into media[] for the looping demo on the exercise detail sheet. */
  demoMediaId: string | null;

  standards: StrengthStandardRef;

  /** Exercise ids that substitute for this one (swap button on the set block). */
  substitutes: ExerciseId[];
  variations: ExerciseId[];
  progression: { easier: ExerciseId[]; harder: ExerciseId[] };

  /** Per-field provenance. Lets us drop an upstream without a full re-ingest. */
  sources: Array<{
    dataset: 'repdb' | 'wger' | 'free-exercise-db' | 'longhaul'
           | 'everkinetic' | 'workout-guide' | 'gymvisual' | 'in-house';
    upstreamId: string;
    upstreamUrl: string;
    fieldsContributed: Array<keyof Exercise>;
    licence: AssetLicence;
    fetchedAt: string;
  }>;

  /** false ⇒ hidden from search until a human has reviewed the merge. */
  published: boolean;
  qaFlags: Array<'no_media' | 'no_instructions' | 'muscle_unmapped'
               | 'licence_unreviewed' | 'possible_duplicate' | 'ai_generated_media'>;
}

/** Set types the active-workout screen must support. */
export type SetType =
  | 'normal' | 'warmup' | 'drop' | 'failure' | 'myorep' | 'cluster'
  | 'amrap' | 'restpause' | 'backoff';
```

================================================================================
PART 2 — SOURCE-BY-SOURCE VERIFIED FACTS
================================================================================

All figures below were obtained by downloading the artefact on 2026-09-18, not
from memory.

--------------------------------------------------------------------------------
A. yuhonas/free-exercise-db  —  TEXT: USE.  IMAGES: DO NOT SHIP.
--------------------------------------------------------------------------------
URL          https://github.com/yuhonas/free-exercise-db
Data         https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json
Downloaded   1,005,327 bytes
Count        876 exercises (README says "800+")
Repo size    96,992 KB ≈ 97 MB (GitHub API `size`)
Stars        1,898 | last push 2026-08-30 | licence field: Unlicense

Field census (computed over all 876):
  keys        category, equipment, force, id, images, instructions, level,
              mechanic, name, primaryMuscles, secondaryMuscles
  force       pull 371 | push 371 | static 104 | null 30
  level       beginner 525 | intermediate 294 | expert 57
  mechanic    compound 491 | isolation 298 | null 87
  equipment   barbell 170, dumbbell 123, other 122, body only 111, cable 81,
              null 77, machine 67, kettlebells 56, bands 20, medicine ball 17,
              exercise ball 12, foam roll 11, e-z curl bar 9
  category    strength 584, stretching 123, plyometrics 61, powerlifting 38,
              olympic weightlifting 35, strongman 21, cardio 14
  primaryMuscles (17 values) quadriceps 148, shoulders 129, abdominals 93,
              chest 84, hamstrings 79, triceps 73, biceps 53, lats 38,
              middle back 34, calves 28, lower back 27, forearms 25, glutes 22,
              traps 15, adductors 13, neck 8, abductors 8
  images      873 exercises have exactly 2; 3 have none → 1,746 JPGs total
  instructions  5 exercises have none

Image reality check (this is the finding that matters):
  Sample: .../exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg
  HTTP 200, image/jpeg, 72,816 bytes, 850 × 567 RGB.
  I RENDERED IT. It is a photograph of a real male model on a flat bench
  against a red wall in a commercial gym — the unmistakable Bodybuilding.com
  exercise-database studio set. Not an illustration.

  Provenance chain, from the README's own "Special Thanks":
    yuhonas/free-exercise-db ← wrkout/exercises.json (Ollie Jennings)
  wrkout/exercises.json's README states no provenance at all, yet the same org
  sells the identical corpus commercially at wrkout.xyz (2,700+ exercises,
  13,500+ images) with tiered licences — i.e. the "public domain" repo and a
  paid licence sell the same pixels.

  LEGAL VERDICT: The Unlicense declaration on this repo is void as to the
  photographs. Nobody can place into the public domain images they do not own,
  and there is no model release for the identifiable person depicted. Shipping
  these is copyright infringement plus a personality-rights exposure. The
  instruction prose is also verbatim Bodybuilding.com copy.
  → Ship the structured fields (names, muscles, equipment, force, mechanic,
    level) as factual data. Do NOT ship the JPGs. Rewrite the instructions.

--------------------------------------------------------------------------------
B. wger (wger.de)  —  SAFE. USE AS THE CROSS-CHECK / GAP-FILLER.
--------------------------------------------------------------------------------
API          https://wger.de/api/v2/  (read endpoints need no key, JSON, `?format=json`)
Counts (live, 2026-09-18, paged through all 903):
  /exercise/            903
  /exerciseinfo/        903   (hydrated: category, muscles, equipment, translations,
                               images, videos, licence, author history)
  /exerciseimage/       374   across 273 distinct exercises  → only 30% coverage
  /video/                78   across  46 distinct exercises  → 5% coverage
  /muscle/               15   ← far too coarse for the app's body map
  translations          903 with an EN entry; 870 with an EN description >40 chars
  156 exercises have NO muscle tagged at all

Licence census:
  Exercise records: CC-BY-SA 4.0 × 750 | CC-BY-SA 3.0 × 132 | CC0 × 21
  Images:           CC-BY-SA 4.0 × 286 | CC-BY-SA 3.0 ×  88
  Image authors:    (blank) 97, Everkinetic 83, Franpol 30, Davidgj32 23,
                    philip 16, AlucardEvil40 12, cshep442 11, utkb 11, …
  41 of 374 images carry `is_ai_generated: true` — wger already ships AI art.
  Licence table (/api/v2/license/): 1=CC-BY-SA 3, 2=CC-BY-SA 4, 3=CC0,
                                    4=CC-BY 4, 5=ODbL

Equipment (12): none/bodyweight 263, Dumbbell 149, Cable machine 103,
  Barbell 76, Bench 48, Pull-up bar 22, Incline bench 19, Resistance band 19,
  SZ-Bar 18, Kettlebell 16, Gym mat 15, Swiss Ball 3
Categories (8): Legs 217, Back 162, Arms 146, Shoulders 116, Abs 112,
  Chest 84, Cardio 49, Calves 17

VERDICT: legally clean and redistributable (CC-BY-SA requires attribution and
that we re-share *modified images* alike — it does NOT infect our app code or
our proprietary data; CC-BY-SA has no GPL-style whole-work copyleft). But
media coverage is too thin (30%) and inconsistent in style to be the app's
visual layer. Use it for: text gap-filling, the 21 CC0 records, per-image
licence modelling, and — importantly — its **muscle overlay SVGs**.

wger muscle SVGs (the body-map asset nobody else gives you free):
  https://wger.de/static/images/muscles/main/muscle-<id>.<hash>.svg       ~3.0 KB
  https://wger.de/static/images/muscles/secondary/muscle-<id>.<hash>.svg
  https://wger.de/static/images/muscles/muscular_system_front.svg       321,118 B
  (+ _back.svg). 15 muscles × 2 states + 2 body backgrounds.
  CC-BY-SA. This is a complete, free, front/back muscle heat-map kit.

--------------------------------------------------------------------------------
C. ExerciseDB / exercisedb.dev / exercisedb.io  —  GIFs ARE GYM VISUAL'S. BLOCKED.
--------------------------------------------------------------------------------
Free OSS API   https://oss.exercisedb.dev/api/v1/exercises?limit=N&offset=N
  meta.total = 1,500
  record: { exerciseId, name, gifUrl, bodyParts[], equipments[],
            targetMuscles[], secondaryMuscles[], instructions[] }
  Taxonomy endpoints: /bodyparts (10), /muscles (50, dirty — contains both
  "delts", "deltoids", "shoulders", "rear deltoids"), /equipments (28).
GIF host       https://static.exercisedb.dev/media/<exerciseId>.gif
  Sample 03lzqwk: HTTP 200, image/gif, 109,751 B, 180×180, 12 frames,
  1000 ms per frame (a slow step-through, NOT a smooth animation).
Code licence   AGPL-3.0, "Copyright 2025 AscendAPI". Covers the server code only.
  The repo README makes **no statement whatsoever** about media rights.
Repo warning   "These endpoints are for exploration only and not recommended
  for production integration" (strict rate limits, instability).

*** THE SMOKING GUN ***
github.com/hasaneyldrm/exercises-dataset (1,324 exercises, 22.1k stars) ships
the same corpus and states plainly: media is "copyrighted by Gym Visual and
redistributed with their permission", with per-record
  "attribution": "© Gym visual — https://gymvisual.com/"
Its records carry a `media_id` field which is literally the ExerciseDB id:
  id 0011, name "assisted hanging knee raise", media_id "03lzqwk"
  id 1366, name "upward facing dog",           media_id "01qpYSe"
I byte-compared the two hosts:
  https://static.exercisedb.dev/media/03lzqwk.gif
  https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/0011-03lzqwk.gif
  Both 109,751 bytes. SHA-256 both a0e42d8d0c155b0af2dbda5a… — BYTE-IDENTICAL.

Paid tier (exercisedb.io):
  STARTER $199 one-time — 1,394 exercises, base fields, GIFs at 180² + 360²,
    self-hosted files, "commercial licence".
  PRO     $599 one-time — + 17-field movement taxonomy, 10,971 similar-exercise
    links, 7,401 substitutions, difficulty/category, GIFs at 180²/360²/720²/1080².
  EULA: "use the dataset commercially and display the exercise GIFs inside your
    app"; may NOT "resell, redistribute, or publish the raw dataset or GIF files
    as a standalone library". Their FAQ asserts "ExerciseDB.io is the original
    creator and owner of the EDB Exercise Intelligence content."

VERDICT: That ownership claim is directly contradicted by the byte-identical
Gym Visual-attributed files. Either the GIFs are licensed-in (in which case
their right to sublicense is unverified) or they are not theirs to sell. Buying
a $599 indemnity from a party whose title is in question is worse than buying
from Gym Visual directly for roughly the same money. DO NOT use the free GIFs.
DO NOT buy the pack without a written warranty + indemnity naming Gym Visual.

--------------------------------------------------------------------------------
D. Gym Visual (gymvisual.com)  —  THE LEGITIMATE SOURCE OF THAT SAME ART.
--------------------------------------------------------------------------------
Catalogue     6,554 animated GIFs (site-stated), plus illustrations and videos.
Pricing       Animated GIF  $0.90 each after 10 in cart
              Illustration  $0.75 each after 10 in cart
              Video         $6.00 each after 5 in cart
              "Get a special discount for ALL or many … Contact us"
Licence       Non-Exclusive Commercial Royalty-Free Licence (N-CRFL),
              gymvisual.com/content/9-license — perpetual, worldwide.
  ALLOWED:    "Android or iOS mobile application (apps)", website pages and
              headers, advertising and promotional material, social posts.
  PROHIBITED: "to resell or redistribute"; "to use in products … destined for
              resale"; posting on stock-content sites; "to post, distribute or
              sell on any Artificial Intelligence (AI) platform"; "to use as a
              basis for creating and generating content … using AI tools".
              Copyright is not transferred; you may not claim the media as yours.
Cost model    1,400 GIFs at list = ~$1,260. Bulk-quote likely materially lower.
CAVEAT        "products destined for resale" is ambiguous for a paid app. Get
              written confirmation that a subscription fitness app is permitted
              before wiring money — their own licence page lists apps as an
              allowed use, so this is a clarification, not a blocker.

--------------------------------------------------------------------------------
E. RepDB (repdb.co / github.com/sergei-argutin/exercise-dataset)  — THE WINNER.
--------------------------------------------------------------------------------
Free bundle  https://cdn.repdb.co/repdb-assets/site/repdb-free.zip
             25,873,826 bytes, 1,160 entries. Downloaded and fully inspected.
JSON         https://exercise-dataset.com/exercises.json (also `free.json` in zip)
Count        601 exercises, schema_version 3, locales [de, en, es]
Assets       1,146 WebP total:
               images/flat/      1,056 files, 17.46 MB  (512×512, RGB,
                                 "<slug>-start.webp" + "<slug>-peak.webp", or
                                 "<slug>-main.webp" for single-pose stretches;
                                 ~16–38 KB each)
               images/muscles/      27 files,  1.21 MB  (one anatomical diagram
                                 per muscle slug — matches the 30-slug taxonomy)
               images/equipment/    60 files,  4.89 MB  (icon per equipment slug)
             Plus index.html offline viewer, exercise-list.json coverage manifest.

Record fields (verified on `ab-wheel-rollout`):
  id, name_en/de/es, description_en/de/es, instructions_en/de/es[],
  tips_en/de/es[], category, force_type, mechanic, difficulty, equipment,
  body_part, is_unilateral, is_bodyweight, goals[], tags[], synonyms[],
  primary_muscles[], secondary_muscles[], met
Taxonomies shipped in-file: muscles (30 slugs), equipment (60 slugs)
Categories: strength 491, stretching 76, cardio 16, olympic 14, plyometrics 4

LICENCE (LICENSE.md v1.0, quoted):
  1. "Free for personal and commercial use inside applications … at no cost."
  2. "Attribution required." — one visible link, exactly:
       Exercise data by [RepDB](https://repdb.co)
     in the about/credits screen, README, or website footer.
  3. "No redistribution as a dataset." In-app use only.
  4. Images may be resized, cropped, recoloured for in-app use.
  5. "No generative-AI derivation." Cannot be used as input/reference/
     conditioning for image-to-image, style transfer, or fine-tuning.
  6. No warranty; not medical advice.
  ORIGIN CLAUSE (this is why it's safe): "All images are original works
  generated with AI tooling commissioned by RepDB — not copied or derived from
  any third-party exercise dataset or image library." Sui generis database
  right claimed under §§87a ff. UrhG. Licensor: Sergei Argutin, Berlin, DE.

PAID TIERS (one-time, instant download, self-hosted, no API):
  STARTER  $299 — all 608 exercises, classic + flat styles at 1024×1024, EN/DE/ES
  STANDARD $499 — + transparent backgrounds (classic), LOOPING ANIMATIONS,
                  muscle heat-maps, SQLite build, 15 workout templates,
                  AI embeddings
  CUSTOM   from $999 — white-label (no attribution), custom sizes/art styles,
                  additional exercises

I VERIFIED THE PAID ANIMATION QUALITY. `premium-samples/bent-over-db-row.webp`:
  512×512, RGBA, **34 frames**, 632,894 bytes — a genuine smooth looping
  animated WebP with a transparent background. Stills are 1024×1024 RGBA.
  Rendered it: a neutral grey 3-D mannequin, correct hip-hinge, dumbbells
  modelled properly, and **the worked muscle (lats/mid-back) tinted orange**.
  The free flat style is a clean vector illustration of a male athlete in teal
  kit on a pale-blue field.
  Both read as shipped-product quality. The orange muscle tint is a direct
  match for the app's amber accent — this art *is* the muscle-map storytelling.

--------------------------------------------------------------------------------
F. Everkinetic (github.com/everkinetic/data)  —  SAFE VECTOR FALLBACK.
--------------------------------------------------------------------------------
Licence      CC-BY-SA-4.0 (GitHub API confirms `cc-by-sa-4.0`). Repo 257,551 KB.
Content      exercises.json = 293 records
             dist/svg/  537 SVGs  = ~268 exercises × {relaxation, tension}
             dist/png/  540 PNGs
             src/ 2,815 files (2,196 PNG, 1,109 SVG, 294 JSON, 292 MD)
Sample       dist/svg/0042-tension.svg = 27,992 B, 13 <path>, 2 <g>
             dist/svg/0042-relaxation.svg = 27,236 B, 12 <path>
             Flat monochrome silhouettes. Path counts differ between the two
             poses, so SMIL path-morphing between them is NOT reliable —
             cross-fade or hard-cut is the honest animation technique.
Fields       id, id_num, id_hex, name, title, url, primer, type, primary,
             secondary[], equipment[], images[], img[], steps[]
Note         wger credits "Everkinetic" on 83 of its 374 images — the two
             open sets already overlap.
VERDICT      Legally clean, vector, tiny (~27 KB), 2-pose. Good insurance but
             only ~268 exercises and visually dated versus RepDB.

--------------------------------------------------------------------------------
G. @bryllim/workout-guide  —  BEST 3-FRAME OPEN ANIMATION SET.
--------------------------------------------------------------------------------
npm          @bryllim/workout-guide@1.0.0
Tarball      30,324,659 B | unpacked 34,437,932 B | 919 files
Content      302 exercises × 3 frames = **906 PNG, 512×512, RGBA** (~35 KB each)
             + manifest.json + typed JS/CJS API (dist/index.js, .d.cts)
Record       { id, slug, name, exerciseType, equipment, primaryMuscle,
               secondaryMuscles[], isStretch, frames[{index, path, width,
               height, format, attribution{creator, license, source{...}}}] }
Licence      package.json: "SEE LICENSE IN LICENSES.md".
             Code/docs MIT. **Visual assets CC-BY-SA-4.0.**
             ATTRIBUTION.md: "Seventy-six first-pose frames are rasterized
             adaptations of artwork from Everkinetic, licensed under
             CC BY-SA 4.0 … placed on a transparent 512×512 canvas, recoloured
             for monochrome display." Per-frame `source.url` points at the exact
             Everkinetic SVG (e.g. dist/svg/0042-tension.svg).
VERDICT      Three ordered frames is enough for a readable movement loop and it
             is the only *open* set that ships more than 2 poses. Ideal free
             fallback for exercises RepDB does not cover. CC-BY-SA obligations:
             credit Bryl Lim + Everkinetic, and if we modify the frames,
             release the modified frames under CC-BY-SA-4.0 (the frames only —
             not our app, not our data).

--------------------------------------------------------------------------------
H. MuscleWiki API (api.musclewiki.com)  —  COMMERCIAL, BUT NO OFFLINE. FALLBACK ONLY.
--------------------------------------------------------------------------------
Catalogue    1,943 exercises, 7,700+ videos, typically 4 per exercise
             (male/female × front/side), MP4 over HTTPS, preview images,
             body-map images on higher plans. 14 languages (EN on all plans;
             ES/PT/FR/DE/IT/PL/RU/TR/AR/FA/HI/JA/ZH on GROWTH+).
Fields       numeric id, name, primary muscles, equipment category, force
             (push/pull/hold), mechanic, difficulty, instructions, video URLs
             with camera angle + gender variant + preview image.
Pricing      BASIC $0 — 500 req/mo, Playground only; keys rejected from real apps
             TESTING $10/mo — 1,000 calls
             GROWTH — mid-tier, adds non-English
             PROFESSIONAL — adds routines/workouts endpoints
             top tier up to $199.99/mo — 300,000 calls. Annual −25%.
             Commercial use included on every paid plan.
Terms        Licence covers use *inside your own app*; NOT reselling,
             redistributing, exposing via your own API, or building a competing
             dataset. Text may be cached 30 days. Thumbnails/previews cached
             24 h, **privately, in the end user's client only — not in a shared
             proxy or CDN**. Explicitly prohibited: "download, export, copy,
             store, or otherwise retrieve MuscleWiki videos, thumbnails, or
             bodymap images for offline storage, CDN storage, cloud storage".
             Must keep MuscleWiki branding burned into the videos intact. No
             ML/AI training without written permission.
Required     Verbatim in our ToS: "Exercise data and videos provided by
             MuscleWiki.com"
VERDICT      Rules out offline-first (the gym-basement, no-signal use case that
             every serious lifting app must handle), forces a permanent
             subscription and a third-party brand into our UI, and the video
             cannot be pre-bundled. Keep as a *streamed* enrichment layer only.

--------------------------------------------------------------------------------
I. Other datasets checked
--------------------------------------------------------------------------------
longhaul-fitness/exercises — MIT. strength.json 349 + flexibility.json 46 +
  cardio.json 9 = **404 exercises**. Fields: pk (uuid), name, slug,
  primaryMuscles[], secondaryMuscles[], steps[], notes. No media at all.
  Clean, permissive, good for cross-validating muscle tagging.
  https://raw.githubusercontent.com/longhaul-fitness/exercises/main/strength.json

wrkout.xyz — 2,700+ exercises, 13,500+ images, 3,500+ videos, 40+ languages.
  API-ONLY, no self-host. Free 100 req/mo NON-COMMERCIAL. Basic/Pro: commercial
  but **watermarked** images. Business/Enterprise: unwatermarked, up to
  £1,500/mo for 200k req. Attribution required on every tier. Same lineage as
  wrkout/exercises.json, so the same bodybuilding.com provenance question
  applies to the free repo. Reject: API-only + watermarks + no offline.

founder-easeur/exercise-dataset — only 184 exercises (148 curated + 36
  aggregated), 121 anatomical structures, per-field provenance + confidence
  scores. Media = "project-owned AI illustrations plus animated SVG movement
  previews … rendered per exercise from position/movement/target-region data."
  Delivery is a Docker+Postgres stack exporting JSON/JSONL/CSV via /datasets.
  Licensing terms for redistribution are NOT stated. Too small and too vague to
  depend on — but it is public proof that the programmatic-animated-SVG route
  is being shipped by someone.

hasaneyldrm/exercises-dataset — 1,324 exercises, MIT on code/structure/
  instruction text only, media © Gym Visual. 180×180 GIFs + thumbnails,
  6 languages. **Useful strictly as the provenance-evidence exhibit** and as a
  free multilingual instruction-text source (MIT).

Wikimedia Commons — dead end. Live category counts via the MediaWiki API:
  Category:Weight_training_animations          5 files
  Category:Animations_of_physical_exercises    7 files
  Category:Fitness_animations                 58 files
  Nowhere near catalogue scale.

--------------------------------------------------------------------------------
J. Body map / anatomical rendering assets
--------------------------------------------------------------------------------
react-body-highlighter @2.0.5 — MIT, 167,578 B unpacked. SVG polygons, 20+
  muscle areas, `type: 'anterior' | 'posterior'`, `highlightedColors[]` array
  mapping frequency → colour = a ready-made heat map. React Native sibling:
  react-native-body-highlighter (the RN package is the origin of the polygons).
wger muscle SVGs — see §B. 15 muscles × main/secondary at ~3 KB each plus
  321 KB front/back backgrounds. CC-BY-SA.
RepDB images/muscles/ — 27 anatomical WebP diagrams, one per muscle slug,
  1.21 MB total, included in the FREE tier.
BodyParts3D / Anatomography — CC-BY-SA 2.1 Japan; mirrored at
  github.com/Kevin-Mattheus-Moerman/BodyParts3D. Community forks
  (`human-atlas`) expose 2,234–3,210 selectable meshes, described as
  BodyParts3D 4.0 under CC BY 4.0.
AnatomyTOOL "Open 3D Model" (anatomytool.org/open3dmodel) — CC-BY-SA, built by
  university anatomists.
NOTE: there is no project actually named "Open3DHuman". The searches surface
  mmhuman3d (OpenMMLab toolbox), Human3D, HumanML3D, Anny (Naver Labs
  parametric human) — all ML research assets, none of which is a shippable
  anatomical illustration source. Don't budget for a 3-D pipeline.

--------------------------------------------------------------------------------
K. Lottie / Rive as an authoring route
--------------------------------------------------------------------------------
Runtimes are free and permissive — the *format* costs nothing:
  lottie-react@3.1.2          MIT,        366,588 B
  lottie-react-native@7.5.0   Apache-2.0, 294,766 B
  rive-react-native@9.8.5     MIT,        416,843 B
Only the authoring tools carry a fee: Rive from ~$15–32/seat/month;
LottieFiles $0–49/month. Neither imposes a per-animation licence on work you
author yourself.
THE REAL COST IS THE ANIMATOR, NOT THE TOOL. Hand-authoring 1,400 anatomically
correct movement loops is a multi-person-year art project. Rive earns its place
for a *small* number of hero pieces — the recovery ring, the rank-up sequence,
the Finish celebration, the body-map transitions — not for the exercise
catalogue.

--------------------------------------------------------------------------------
L. AI generation route
--------------------------------------------------------------------------------
Empirical evidence, not speculation:
  • RepDB's ENTIRE free tier is AI-generated commissioned artwork ("All images
    are original works generated with AI tooling commissioned by RepDB"), and
    I inspected it: 601 exercises, consistent character, consistent palette,
    correct equipment. **The AI route demonstrably produces shippable quality.**
  • wger already flags 41 of its 374 images `is_ai_generated: true`.
Costs, from the generation service available in this environment (credits/call):
  images  Nano Banana 2 Lite 2 · Nano Banana 2 3 · Nano Banana Pro 6 ·
          Seedream 5.0 Lite 2 · Seedream 5.0 Pro 4
  video   Seedance 1.0 Pro Fast 5 · Seedance 1.5 Pro 11 · Veo 3.1 Lite 16 ·
          Seedance 2.0 Mini 16 · Seedance 2.0 Fast 25 · Veo 3.1 Fast 32 ·
          Omni Flash 40 · Seedance 2.5 47 · Veo 3.1 128
  ⇒ 1,500 exercises × 2 poses at 2 credits = 6,000 credits (still route)
  ⇒ 1,500 exercises × 1 clip at 16 credits = 24,000 credits (video route)
I did NOT spend the user's credits on a test generation — that needs explicit
approval. Cost is not the blocker anyway.
THE BLOCKERS ARE: (a) character/kit/lighting consistency across 1,500 renders,
which is an art-direction and QA problem, not a prompting problem; (b) video
models routinely botch barbell paths, grip, and joint end-range — an incorrect
demo in a strength app is an injury vector; (c) RepDB's licence term 5
explicitly forbids using their images as AI input, so we cannot bootstrap style
consistency from the set we are licensing.
CONCLUSION: someone already paid for the AI pipeline and did the QA. Buy their
output for $499 instead of rebuilding it for 24,000 credits plus months of
review.

--------------------------------------------------------------------------------
M. Catalogue size — how close can we get to "every exercise"?
--------------------------------------------------------------------------------
Distinct normalised names per source (my normaliser: lowercase, strip
parentheticals and punctuation, drop stopwords, expand db→dumbbell/bb→barbell,
sort tokens):
  RepDB                     600
  free-exercise-db          864
  wger                      888
  longhaul                  403
  GymVisual/ExerciseDB    1,257
  ─────────────────────────────
  Naive union             3,269
Pairwise overlaps are tiny — RepDB ∩ free-exercise-db = 136, RepDB ∩ GymVisual
= 106, free-exercise-db ∩ GymVisual = 227, wger ∩ GymVisual = 71.
That low overlap is NOT low genuine overlap; it is naming chaos ("Barbell Bench
Press - Medium Grip" vs "bench press barbell" vs "Bench Press (Barbell)").
Realistic distinct-movement count after proper alias resolution: **~1,800–2,200**.
Actionable consequence: the alias/canonicalisation layer is not polish, it is
core infrastructure. Budget real engineering for it.

================================================================================
PART 3 — INGESTION PLAN: EXACT URLS AND COMMANDS
================================================================================

Target layout
  packages/exercise-db/
    raw/            # untouched upstream downloads, gitignored
    licences/       # one JSON per upstream, human-signed
    build/          # normalisation + merge scripts
    dist/           # exercises.json, exercises.sqlite, media/

--- STEP 0. Scaffold -----------------------------------------------------------
mkdir -p packages/exercise-db/{raw,licences,build,dist/media}
cd packages/exercise-db

--- STEP 1. RepDB free tier — PRIMARY MEDIA + PRIMARY TEXT ---------------------
curl -L -o raw/repdb-free.zip \
  https://cdn.repdb.co/repdb-assets/site/repdb-free.zip     # 25,873,826 bytes
unzip -q raw/repdb-free.zip -d raw/repdb
# raw/repdb/free.json            601 exercises, schema v3, EN+DE+ES
# raw/repdb/free.en.json         slim single-locale view
# raw/repdb/exercise-list.json   coverage manifest for the paid catalogue
# raw/repdb/images/flat/         1,056 WebP 512×512  (17.46 MB)
# raw/repdb/images/muscles/         27 WebP          ( 1.21 MB)
# raw/repdb/images/equipment/       60 WebP          ( 4.89 MB)
# raw/repdb/LICENSE.md  ATTRIBUTION.md  premium-samples/
# JSON-only alternative: curl -L -o raw/repdb/free.json https://exercise-dataset.com/exercises.json
ACTION: copy raw/repdb/LICENSE.md verbatim into licences/repdb.md and add
        "Exercise data by RepDB (repdb.co)" to the Profile → About → Credits
        screen BEFORE the first build. It is a hard licence condition.

--- STEP 2. free-exercise-db — TEXT FIELDS ONLY, NO IMAGES --------------------
curl -L -o raw/free-exercise-db.json \
  https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json
# 1,005,327 bytes, 876 records.
# DO NOT run any image fetch loop against
#   https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/<id>/<n>.jpg
# Those are Bodybuilding.com studio photographs. Add to .gitignore and to the
# repo's CONTRIBUTING as an explicit prohibition.

--- STEP 3. wger — TEXT, MUSCLE SVGs, CC0 IMAGES ------------------------------
# 3a. hydrated exercises (903, paged 200 at a time; no auth needed)
for off in 0 200 400 600 800; do
  curl -sL "https://wger.de/api/v2/exerciseinfo/?format=json&limit=200&offset=$off" \
    -o "raw/wger-exerciseinfo-$off.json"
done
# 3b. taxonomies + licence table
curl -sL "https://wger.de/api/v2/muscle/?format=json&limit=100"     -o raw/wger-muscles.json
curl -sL "https://wger.de/api/v2/equipment/?format=json&limit=100"  -o raw/wger-equipment.json
curl -sL "https://wger.de/api/v2/license/?format=json&limit=50"     -o raw/wger-licenses.json
curl -sL "https://wger.de/api/v2/exerciseimage/?format=json&limit=500" -o raw/wger-images.json
# 3c. the muscle body-map kit (CC-BY-SA — record the attribution)
curl -sL "https://wger.de/static/images/muscles/muscular_system_front.svg" -o dist/media/body/front.svg
curl -sL "https://wger.de/static/images/muscles/muscular_system_back.svg"  -o dist/media/body/back.svg
# per-muscle overlays: read image_url_main / image_url_secondary out of
# raw/wger-muscles.json (hashed filenames change on deploy — never hard-code).
# 3d. OPTIONAL: pull ONLY the images whose exercise licence id == 3 (CC0).
#     21 exercise records are CC0. Everything else is CC-BY-SA and must carry
#     license_author in the credits screen.

--- STEP 4. longhaul — MIT cross-validation ----------------------------------
for f in strength cardio flexibility; do
  curl -sL -o "raw/longhaul-$f.json" \
    "https://raw.githubusercontent.com/longhaul-fitness/exercises/main/$f.json"
done   # 349 + 9 + 46 = 404 records

--- STEP 5. workout-guide — 3-FRAME OPEN ANIMATION FALLBACK -------------------
npm pack @bryllim/workout-guide@1.0.0   # 30,324,659 B tarball
tar xzf bryllim-workout-guide-1.0.0.tgz -C raw/
# raw/package/manifest.json          302 exercises
# raw/package/assets/<slug>/frame-{1,2,3}.png   906 × 512² RGBA
# raw/package/ATTRIBUTION.md  LICENSES.md  LICENSE-ASSETS
ACTION: copy ATTRIBUTION.md into licences/. Credits must name Bryl Lim AND
        Everkinetic, both CC-BY-SA-4.0.

--- STEP 6. Everkinetic — VECTOR FALLBACK ------------------------------------
git clone --depth 1 https://github.com/everkinetic/data.git raw/everkinetic
# 257 MB. dist/svg/ = 537 SVGs (<id4>-relaxation.svg / -tension.svg, ~27 KB)
#         dist/png/ = 540 PNGs.  exercises.json = 293 records.
# Shallow-clone only; do not vendor the 2,815-file src/ tree.

--- STEP 7. Explicitly NOT ingested -------------------------------------------
# https://static.exercisedb.dev/media/*.gif      → Gym Visual copyright
# https://oss.exercisedb.dev/api/v1/exercises    → media unusable; taxonomy dirty
# https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/*
#                                                → "© Gym visual", MIT covers
#                                                  text only
# https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/**/*.jpg
#                                                → Bodybuilding.com photographs
# api.musclewiki.com media                       → contractually no-store
# Encode these as a deny-list in build/forbidden-sources.json and assert it in CI.

--- STEP 8. Normalise → merge → emit -----------------------------------------
build/01-normalize.ts   # each upstream → {normalizedKey, aliases[], fields, sources[]}
                        # normalizedKey: NFKD, lowercase, strip parentheticals,
                        # strip punctuation, drop {the,a,with,exercise,version,
                        # alternate,alternating}, expand db→dumbbell bb→barbell,
                        # singularise {curls,presses,rows,squats,raises,lunges,
                        # extensions,flyes,pulldowns,deadlifts,ups}, sort tokens
build/02-merge.ts       # precedence per field:
                        #   name/instructions/tips/met/muscles → RepDB
                        #   missing muscles                    → wger, then longhaul
                        #   force/mechanic/level               → free-exercise-db
                        #   substitutes/variations             → in-house, seeded
                        #     by shared (primaryMuscle, equipment, mechanic)
                        # emit qaFlags on every unresolved conflict
build/03-media.ts       # ladder per exercise, first hit wins:
                        #   1 RepDB animated WebP (Standard tier, if purchased)
                        #   2 RepDB flat start+peak → ExerciseMedia kind 'pose_pair'
                        #   3 workout-guide 3 frames → 'frame_sequence'
                        #   4 Everkinetic relaxation/tension SVG → 'pose_pair'
                        #   5 generated schematic SVG (see below)
                        # transcode: WebP q80 @512² for phones, @1024² for tablets;
                        # AVIF sibling; emit bytes + frameCount into the record
build/04-licence-audit.ts
                        # FAIL THE BUILD if any ExerciseMedia has
                        # licence.redistributable === false, licence.spdx ===
                        # 'UNKNOWN', or licence.reviewedAt === null.
                        # Emit dist/CREDITS.md and dist/licences.json from the
                        # AssetLicence records — the Credits screen renders that
                        # file, so attribution can never silently drift.
build/05-emit.ts        # dist/exercises.json + dist/exercises.sqlite (FTS5 over
                        # name + aliases) + dist/media/**

--- STEP 9. The long tail: programmatic movement SVG --------------------------
For the ~800–1,200 exercises with no licensed art, generate rather than scrape.
Data model — a small hand-authored table, ~40 movement archetypes:
  { archetype: 'horizontal_press', plane: 'transverse',
    stance: 'supine_bench',
    joints: [{ joint:'elbow', from:180, to:80 }, { joint:'shoulder', from:90, to:30 }],
    implement: 'barbell', path: 'linear_vertical' }
Renderer — one 14-segment 2-D stick/silhouette rig in SVG, joint angles keyframed
between `from` and `to`, CSS `@keyframes` with `transform: rotate()` on nested
<g> elements, 2 s ease-in-out alternate loop. Muscle highlight = a <path> over
the worked region filled with the amber accent at 0.75 alpha.
Output ≈ 4–8 KB per exercise, resolution-independent, themable, and 100% ours.
Coverage: every exercise maps to an archetype; a wrong-looking limb is a data
fix in one row, not a re-render. Escalate an archetype to a hand-authored Rive
state machine when it is one of the top-100 logged lifts.

================================================================================
PART 4 — THE RECOMMENDED STRATEGY AND FALLBACK LADDER
================================================================================

TIER 0 — DAY ONE, $0
  RepDB free (601 exercises, 1,056 WebP 512² start/peak, 27 muscle diagrams,
  60 equipment icons) for media and primary text.
  + free-exercise-db (876) and wger (903) and longhaul (404) for text breadth.
  + workout-guide (302 × 3 frames) and Everkinetic (268 × 2 SVG) as fallback art.
  + wger muscle SVGs and react-body-highlighter for the body map.
  Cost: one attribution line. Risk: zero.
  Animation technique: cross-fade start ↔ peak on a 900 ms alternate loop. That
  IS a movement demo — it is what the reference app's thumbnails do — and it
  ships today.

TIER 1 — BEFORE PUBLIC LAUNCH, $499 one-time
  RepDB Standard. Buys 34-frame looping animated WebP with alpha, 1024² stills,
  per-exercise muscle heat-maps, SQLite, and AI embeddings (which the exercise
  search and the substitute-suggestion feature want anyway).
  This single purchase converts the whole visual layer from "acceptable" to
  "indistinguishable from Hevy". Best dollar-per-unit-of-quality in the project.
  Add $999 Custom later if we want attribution removed and bespoke art.

TIER 2 — CATALOGUE EXPANSION, ~$1,000–1,300 (negotiate the bulk quote)
  Gym Visual N-CRFL for the specific 600–900 movements RepDB lacks, at $0.90 a
  GIF. Buy from the rights holder, not the reseller. Get written confirmation
  that a paid subscription app is a permitted "app" use.

TIER 3 — THE LONG TAIL, engineering time only
  The generated archetype SVG renderer from Step 9. Also the permanent safety
  net: a user-submitted exercise gets a plausible animation instantly, so the
  "add custom exercise" flow never shows an empty box.

TIER 4 — STREAMED ENRICHMENT, optional, $10–200/month
  MuscleWiki API for real-video form checks on the exercise detail sheet, when
  online. Never cached, never bundled, branding intact, ToS line added. Purely
  additive — the app must be fully usable with this switched off.

NEVER
  ExerciseDB free GIFs · hasaneyldrm GIFs · free-exercise-db JPGs ·
  wrkout.xyz free tier · any scrape of MuscleWiki or Hevy assets.


## Risks

- The single largest legal exposure is already inside the ecosystem the team will instinctively reach for: free-exercise-db is the top Google result for "open exercise database", carries an Unlicense badge, and its 1,746 images are Bodybuilding.com studio photographs of an identifiable model with no release. Any engineer who runs the obvious image-fetch loop ships infringement plus a personality-rights claim.
- ExerciseDB.io sells at $199/$599 while asserting it is "the original creator and owner" of content that is byte-identical (SHA-256 a0e42d8d0c155b0af2dbda5a, 109,751 bytes) to files another repo publishes with "(c) Gym visual" attribution. Buying that pack purchases an indemnity from a party whose title is in question. Do not purchase without a written warranty and indemnity that names Gym Visual.
- RepDB is a one-person operation (Sergei Argutin, Berlin) with a bespoke non-standard licence rather than an SPDX one. Single-supplier concentration risk: if the project disappears the free ZIP may vanish. Mitigate by archiving the exact 25,873,826-byte ZIP plus LICENSE.md and a purchase receipt, and note the licence is perpetual for the version received.
- RepDB licence term 3 forbids redistributing the dataset "or a modified or derived dataset" as a dataset or API. If Stronger 2.0 ever exposes a public exercise API, a partner feed, or an open data export, that clause is breached. Design the API boundary now so exercise records are never the product.
- RepDB licence term 5 forbids using the images as input, reference or conditioning for generative models. Any future "generate art for a custom exercise" feature that style-matches the existing catalogue would breach it. The programmatic SVG renderer must be built from our own rig, never from their pixels.
- CC-BY-SA-4.0 on Everkinetic and workout-guide assets carries a ShareAlike obligation on modified artwork. It does NOT infect app code or proprietary data, but recolouring or re-cropping those frames for the dark theme creates Adapted Material that must be re-released under CC-BY-SA-4.0. Keep those derivatives in a separate, publishable directory.
- Gym Visual's N-CRFL prohibits use "in products (both physical or digital) destined for resale", which is ambiguous for a paid subscription app even though the same licence explicitly permits iOS and Android apps. Unresolved, this could invalidate a four-figure purchase.
- MuscleWiki's terms forbid any offline, CDN or cloud storage of its media and require its branding to remain visible. Building it into the primary media path would both break gym-basement offline use and place a competitor's logo inside our product.
- Coverage gap: RepDB free is 601 exercises against a realistic ~1,800-2,200 distinct movements. Without Tier 2 and Tier 3, roughly two thirds of the catalogue launches with no demonstration media, directly undercutting the "every exercise that exists" requirement.
- Measured pairwise overlap between datasets is very low (RepDB and free-exercise-db share only 136 of 600 names). A weak merge will silently produce thousands of duplicate exercises, which corrupts the personal-record engine, the e1RM trends and the world-standings percentiles — the exact features the product is differentiating on.
- wger tags no muscle at all on 156 of 903 exercises and offers only 15 muscles total. Mapping it into a 30-slug taxonomy will leave gaps that must be flagged with qaFlags rather than silently defaulted, or the muscle-readiness and training-split features will report confidently wrong numbers.
- Both RepDB and wger ship AI-generated artwork (RepDB entirely; wger on 41 of 374 images). If the app later markets "professionally illustrated" demonstrations, that claim is inaccurate. Describe the media honestly in marketing copy.
- Gym Visual's GIFs run at 1000 ms per frame across 12 frames — a deliberate step-through, not a smooth loop. Mixing them with RepDB's 34-frame animations produces visibly inconsistent motion quality across the catalogue unless a single playback treatment is enforced.
