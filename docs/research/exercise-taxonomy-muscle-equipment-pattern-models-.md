# Exercise taxonomy, muscle/equipment/pattern models, catalog enumeration, naming and ID strategy for Stronger 2.0

## Summary

I designed a four-level taxonomy (Region > Muscle Group > Muscle > body-map SVG region) with 9 regions, 21 muscle groups, and 74 muscle entries of which 48 are shadeable on a front/back body map (41 front paths, 39 back paths) and 26 are deep/listed-only. Hevy — the app we are beating — exposes only 15 muscle filters with no delt split, no obliques, and no adductors/abductors, so 21 groups is a genuine differentiator, but 21 chips will not fit one row: store readiness at 21 and display a 12-chip compact row that expands. Every exercise carries a groupWeights vector summing to 1.0 rather than primary/secondary arrays, which turns volume attribution and muscle-readiness decay into a dot product and is what makes the world-standings-per-muscle-group tab computable without a second data model.\n\nOn counts: the combinatorial ceiling is 210 base movements x 44 equipment x 5 grips x 4 angles x 3 stances x 2 limb modes = 705,600, of which roughly 0.17% are physically valid and actually named. \"Every exercise in the world\" is a naming problem, not a data problem. I set the practical line with a four-question Distinctness Test (load comparability, >10pp muscle shift, demo divergence, input-schema change); anything passing all four is an attribute on the set, not a catalog row. That yields 114 core exercises covering ~85% of logged sets, 698 at v1.0, and 1,190 at v1.2, with a per-muscle-group table. Those 1,190 need only 552 authored animations at 2.16 exercises per animation.\n\nThe legal picture is decisive. free-exercise-db is Unlicense/public-domain with 876 exercises (678 resistance-only, all unique names) and is the correct seed. ExerciseDB is AGPL-3.0 and viral. ExerciseGymGifsDB's 1,323 GIFs are self-described as scraped with rights retained by original authors. So the animations must be produced in-house — as rigged SVG/Lottie loops at ~25 KB each (13.8 MB total, theme-recolorable) rather than raster GIFs at ~400 KB (~220 MB).\n\nNaming follows Hevy's confirmed \"Movement (Equipment)\" form but generated, never typed, with a fixed modifier order (Limb > Position > Angle > Stance > Grip > ROM > Base > (Load, Equipment)) and a 42-character cap for the active-workout row. Identity is a ULID that history references plus a component-derived slug, with a partial unique index on the identity tuple, fuzzy near-dupe scoring at import, and an exercise_merges table with transitive resolution so merging never orphans a user's PRs.\n\nTwo numbers should shape the roadmap: only 287 exercises have published world standards (StrengthLevel, 195.5M lifts, 27.9M users, percentile tiers 5/20/50/80/95), and only 183 accumulate enough data for reliable per-exercise analysis. The other ~900 exercises need proxy-ratio mapping to a parent lift.

## Findings

### free-exercise-db is the only license-clean seed corpus: 876 exercises, Unlicense (public domain)

Verified by downloading dist/exercises.json: 876 total exercises; filtering to resistance categories (strength/powerlifting/olympic weightlifting/strongman) leaves 678. All 678 names are unique. License badge in README is Unlicense (public domain). Schema enums: force = static|pull|push|null; mechanic = compound|isolation|null; level = beginner|intermediate|expert; 13 equipment values; 17 primaryMuscles values; 7 categories. Actual distribution measured: compound 491 / isolation 298 / null 87; push 371 / pull 371 / static 104 / null 30. Per-primary-muscle (resistance only): shoulders 114, quads 93, abs 81, chest 69, triceps 69, biceps 50, hamstrings 50, mid back 30, lats 29, forearms 23, lower back 16, glutes 16, calves 15, traps 15, neck 5, adductors 2, abductors 2.

Source: https://github.com/yuhonas/free-exercise-db + raw dist/exercises.json

### The competitor bar is 400-1,400 exercises; 11,000 is a data-hygiene failure, not a target

Hevy official: 400+ exercises (marketing elsewhere claims 1,000+). Boostcamp: 450+ with demos. StrengthLog: 450+. JEFIT: 1,400+ with animations. ExerciseGymGifsDB: 1,323 with GIFs. ExerciseDB claims 11,000+ exercises with 5,000+ GIFs but is AGPL-3.0 and its count comes from not deduplicating variants. Target 1,190 curated rows to beat every mainstream competitor except JEFIT on count, and beat JEFIT on quality.

Source: hevyapp.com/features/exercise-library, boostcamp.app, github.com/ExerciseDB/exercisedb-api

### Hevy's naming convention is 'Movement (Equipment)' — confirmed verbatim from their library

Exact strings scraped from hevyapp.com/exercises: 'Bench Press - Close Grip (Barbell)', 'Arnold Press (Dumbbell)', 'Shrug (Barbell)', 'Triceps Dip (Weighted)', 'Sumo Deadlift', 'Clean and Jerk', 'Handstand Push Up', 'One-Arm Push-Up', 'Sternum Pull up (Gironda)'. Note their own inconsistency: 'Handstand Push Up' vs 'One-Arm Push-Up' vs 'Sternum Pull up'. Their muscle filters: Chest, Shoulders, Biceps, Triceps, Upper Back, Lower Back, Lats, Forearms, Abdominals, Neck, Quadriceps, Hamstrings, Glutes, Traps, Calves, Full Body — 15 groups, no delt split, no obliques, no adductors/abductors. Our 21-group model is strictly finer.

Source: https://www.hevyapp.com/exercises/

### Only 287 exercises in the world have published strength standards, and only 183 have enough data to analyze

StrengthLevel covers 287 exercises, built from 195,513,376 lifts by 27,893,268 users, yielding 46,245,785 qualifying results (as of March 2026). Its five tiers are percentile-defined: Beginner = stronger than 5% of lifters, Novice = 20%, Intermediate = 50%, Advanced = 80%, Elite = 95%. Concrete anchor: male 75 kg bodyweight bench press standards in kg are 51 / 70 / 92 / 117 / 144. Separately, the 2026 arXiv 1RM paper (2603.17495) used 303,494 near-failure sets from 14,966 users across 388 exercises but found only 183 exercises had sufficient data for per-exercise analysis. Implication: ~900 of our 1,190 exercises need proxy-ratio mapping to a parent lift for the world-standings tab.

Source: https://strengthlevel.com/strength-standards, https://arxiv.org/abs/2603.17495

### Bodyweight load coefficients are measured, published numbers — use them, don't guess

Ebben, Wurm, VanderZanden et al., 'Kinetic Analysis of Several Variations of Push-Ups', J Strength Cond Res 25(10):2891-2894, 2011 (23 subjects, force-plate GRF): hands elevated 61 cm = 41% BW, knee push-up = 49%, hands elevated 30.5 cm = 55%, regular push-up = 64%, feet elevated 30.5 cm = 70%, feet elevated 61 cm = 74%. Suprak, Dawes, Stephenson, JSCR 25(2):497-503, 2011 (28 strength-trained males) confirms subjects support less mass in the up position than the down position, and the up-to-down delta is larger for the modified (knee) variant. These give defensible bwFactor values for bodyweight volume math instead of the 'count it as zero' or 'count it as full bodyweight' errors competitors make.

Source: JSCR 25(10):2891-2894 (2011); JSCR 25(2):497-503 (2011)

### Hevy ships 8 tracking types and 4 set types — we should ship 10 and 7

Hevy's custom-exercise types, confirmed from their help centre: weight & reps, bodyweight reps, weighted bodyweight, assisted bodyweight, duration, duration & weight, distance & duration, weight & distance. Their set types are exactly four: Normal, Warm-up, Drop, Failure, changed by tapping the set number in the SET column. Our spec adds reps_only and distance_only to tracking (10 total) and myo_rep, rest_pause, partial to set types (7 total).

Source: help.hevyapp.com articles 35382889578135 and 34896293707927

### The combinatorial ceiling is 705,600 but the real world contains ~1,200 named exercises

210 base movements x 44 equipment x 5 grips x 4 angles x 3 stances x 2 limb modes = 705,600 nominal combinations. Physically valid AND actually named in gym culture is ~0.17% of that. 'Every exercise that exists' is therefore a naming problem, not a data problem: the world has ~210 movements that people have given ~1,200 names to. Our tiered plan: 114 core (day one, covers ~85% of logged sets), 698 at v1.0, 1,190 at v1.2.

Source: derived enumeration cross-checked against JEFIT 1,400 and ExerciseGymGifsDB 1,323

### 1,190 exercises need only 552 authored animations, not 1,190

Unilateral, grip and stance variants of the same movement+equipment pair reuse one demo with a text annotation, giving 2.16 exercises per animation. 552 assets is achievable in-house. Critically, the two large GIF corpora are unusable: ExerciseDB is AGPL-3.0 (viral, kills a closed app) and ExerciseGymGifsDB explicitly states its 1,323 GIFs were collected from the internet with rights retained by original authors. Produce them as rigged SVG/Lottie loops (~25 KB each, 13.8 MB total, theme-recolorable, resolution-independent) rather than raster GIFs (~400 KB each, ~220 MB total).

Source: github.com/JahelCuadrado/ExerciseGymGifsDB disclaimer; github.com/ExerciseDB/exercisedb-api license

### NSCA's 8 foundational movement patterns are too coarse for a tracker; split to 20

NSCA's framework is squat, hinge, lunge, push, pull, carry, rotation, gait. A tracker's training-split breakdown chart needs push and pull split by vector (horizontal/vertical), isolation split by joint action (flexion/extension/abduction/adduction), and explicit anti-rotation / anti-extension / anti-lateral-flexion for core work, plus olympic, plyometric and isometric_hold. 20 patterns total.

Source: https://www.nsca.com/education/articles/tsac-report/the-8-main-movement-patterns/

### The 2026 weight-dependent e1RM equation beats Epley and Brzycki, especially on the isolation long tail

1RM = w x (1 + (r-1)^0.85 / (-2.55 + 4.58 x ln(w))), fit on 303,494 near-failure sets from 14,966 users across 388 exercises and 16 muscle groups. Reduced inconsistency 17-22% versus four classical benchmarks including Epley and Brzycki, with improvements positive across all 183 exercises that had sufficient data. The weight-dependent conversion factor accounts for 91% of the improvement, and the benefit is largest for lighter exercises — which is exactly the isolation-heavy majority of a 1,190-exercise catalog.

Source: https://arxiv.org/abs/2603.17495

### wger's open taxonomy is too thin to copy but useful as a floor

wger's live API returns only 8 exercise categories (Abs, Arms, Back, Calves, Cardio, Chest, Legs, Shoulders), 15 muscles, and 12 equipment items (Barbell, Bench, Cable machine, Dumbbell, Gym mat, Incline bench, Kettlebell, Pull-up bar, Resistance band, SZ-Bar, Swiss Ball, none). Notably it models Bench and Incline bench as equipment, which is a modelling error we should avoid — bench angle is a variant axis on the movement, not a piece of equipment.

Source: https://wger.de/api/v2/exercisecategory/ and /muscle/ and /equipment/

## Recommendations

- Model exercises as (movement_id, equipment_id, load_mode, sorted_variant_signature) with a database-level unique index on that tuple, and GENERATE the display name from those components so a hand-typed duplicate is structurally impossible.

## Data

================================================================================
PART A — MUSCLE TAXONOMY (3 levels: REGION > GROUP > MUSCLE)
================================================================================

A1. REGIONS (9) — used for the body-map filter chips on Progress > Exercises
   chest | back | shoulders | arms | core | legs | neck | full_body | cardio

A2. MUSCLE GROUPS (21) — used for readiness chips, split analysis, world standings
    `recoveryHours` = hours to ~95% readiness after a hard session (MEV-to-MAV volume).
    Derived from muscle size / eccentric damage literature: small distal muscles
    (delts, calves, forearms) recover in 24-48h; large hip/thigh musculature 48-72h;
    hamstrings + lower back are the slowest because of high eccentric strain.

```json
[
 {"id":"chest","region":"chest","label":"Chest","short":"Chest","chip":1,"recoveryHours":48,"volumeSharePct":11,"muscles":["pec_major_clavicular","pec_major_sternal","pec_major_costal","pec_minor","serratus_anterior"]},
 {"id":"upper_back","region":"back","label":"Upper Back","short":"Up. Back","chip":2,"recoveryHours":48,"volumeSharePct":9,"muscles":["rhomboid_major","rhomboid_minor","trapezius_middle","trapezius_lower","teres_major","teres_minor","infraspinatus","supraspinatus","subscapularis","levator_scapulae"]},
 {"id":"lats","region":"back","label":"Lats","short":"Lats","chip":3,"recoveryHours":48,"volumeSharePct":9,"muscles":["latissimus_dorsi_upper","latissimus_dorsi_lower"]},
 {"id":"traps","region":"back","label":"Traps","short":"Traps","chip":4,"recoveryHours":36,"volumeSharePct":3,"muscles":["trapezius_upper"]},
 {"id":"lower_back","region":"back","label":"Lower Back","short":"Low. Back","chip":5,"recoveryHours":72,"volumeSharePct":4,"muscles":["erector_spinae_iliocostalis","erector_spinae_longissimus","erector_spinae_spinalis","quadratus_lumborum","multifidus"]},
 {"id":"front_delts","region":"shoulders","label":"Front Delts","short":"F. Delts","chip":6,"recoveryHours":48,"volumeSharePct":5,"muscles":["deltoid_anterior"]},
 {"id":"side_delts","region":"shoulders","label":"Side Delts","short":"S. Delts","chip":7,"recoveryHours":36,"volumeSharePct":6,"muscles":["deltoid_lateral"]},
 {"id":"rear_delts","region":"shoulders","label":"Rear Delts","short":"R. Delts","chip":8,"recoveryHours":36,"volumeSharePct":4,"muscles":["deltoid_posterior"]},
 {"id":"biceps","region":"arms","label":"Biceps","short":"Biceps","chip":9,"recoveryHours":48,"volumeSharePct":6,"muscles":["biceps_long_head","biceps_short_head","brachialis","coracobrachialis"]},
 {"id":"triceps","region":"arms","label":"Triceps","short":"Triceps","chip":10,"recoveryHours":48,"volumeSharePct":7,"muscles":["triceps_long_head","triceps_lateral_head","triceps_medial_head","anconeus"]},
 {"id":"forearms","region":"arms","label":"Forearms","short":"Forearms","chip":11,"recoveryHours":24,"volumeSharePct":3,"muscles":["brachioradialis","wrist_flexors","wrist_extensors","pronator_teres","supinator"]},
 {"id":"abs","region":"core","label":"Abs","short":"Abs","chip":12,"recoveryHours":36,"volumeSharePct":5,"muscles":["rectus_abdominis_upper","rectus_abdominis_lower","transversus_abdominis"]},
 {"id":"obliques","region":"core","label":"Obliques","short":"Obliques","chip":13,"recoveryHours":36,"volumeSharePct":3,"muscles":["external_oblique","internal_oblique"]},
 {"id":"quads","region":"legs","label":"Quads","short":"Quads","chip":14,"recoveryHours":72,"volumeSharePct":9,"muscles":["rectus_femoris","vastus_lateralis","vastus_medialis","vastus_intermedius","sartorius"]},
 {"id":"hamstrings","region":"legs","label":"Hamstrings","short":"Hams","chip":15,"recoveryHours":72,"volumeSharePct":7,"muscles":["biceps_femoris_long","biceps_femoris_short","semitendinosus","semimembranosus"]},
 {"id":"glutes","region":"legs","label":"Glutes","short":"Glutes","chip":16,"recoveryHours":48,"volumeSharePct":6,"muscles":["gluteus_maximus"]},
 {"id":"hip_flexors","region":"legs","label":"Hip Flexors","short":"Hip Flex","chip":17,"recoveryHours":36,"volumeSharePct":1,"muscles":["psoas_major","iliacus"]},
 {"id":"adductors","region":"legs","label":"Adductors","short":"Adductors","chip":18,"recoveryHours":48,"volumeSharePct":2,"muscles":["adductor_magnus","adductor_longus","adductor_brevis","gracilis","pectineus"]},
 {"id":"abductors","region":"legs","label":"Abductors","short":"Abductors","chip":19,"recoveryHours":36,"volumeSharePct":2,"muscles":["gluteus_medius","gluteus_minimus","tensor_fasciae_latae","piriformis"]},
 {"id":"calves","region":"legs","label":"Calves","short":"Calves","chip":20,"recoveryHours":36,"volumeSharePct":3,"muscles":["gastrocnemius_medial","gastrocnemius_lateral","soleus","tibialis_anterior","fibularis_longus"]},
 {"id":"neck","region":"neck","label":"Neck","short":"Neck","chip":21,"recoveryHours":36,"volumeSharePct":1,"muscles":["sternocleidomastoid","scalenes","splenius_capitis","splenius_cervicis"]}
]
```
UI RULE: 21 chips is too many for a single row. Ship a **12-chip compact row**
(Chest, Back, Shoulders, Biceps, Triceps, Abs, Quads, Hamstrings, Glutes, Calves,
Forearms, Traps) that collapses `upper_back+lats+lower_back -> Back` and
`front/side/rear_delts -> Shoulders`, with an "expand" that reveals all 21.
Store readiness at the 21-group level; aggregate for display with a
volume-weighted mean, never a simple average.

A3. MUSCLES (62) with body-map SVG regions
`view`: which body-map face shows it. `deep:true` muscles are listed in the
exercise detail but never shaded (they are not visible on a surface render).
`mapRegions` are the SVG path ids your front.svg / back.svg must expose.

```json
[
 {"id":"pec_major_clavicular","group":"chest","latin":"Pectoralis major (pars clavicularis)","common":"Upper chest","view":"front","deep":false,"mapRegions":["f_chest_upper_l","f_chest_upper_r"]},
 {"id":"pec_major_sternal","group":"chest","latin":"Pectoralis major (pars sternocostalis)","common":"Mid chest","view":"front","deep":false,"mapRegions":["f_chest_mid_l","f_chest_mid_r"]},
 {"id":"pec_major_costal","group":"chest","latin":"Pectoralis major (pars abdominalis)","common":"Lower chest","view":"front","deep":false,"mapRegions":["f_chest_low_l","f_chest_low_r"]},
 {"id":"pec_minor","group":"chest","latin":"Pectoralis minor","common":"Pec minor","view":"front","deep":true,"mapRegions":[]},
 {"id":"serratus_anterior","group":"chest","latin":"Serratus anterior","common":"Serratus","view":"front","deep":false,"mapRegions":["f_serratus_l","f_serratus_r"]},

 {"id":"rhomboid_major","group":"upper_back","latin":"Rhomboideus major","common":"Rhomboids","view":"back","deep":true,"mapRegions":["b_upperback_mid"]},
 {"id":"rhomboid_minor","group":"upper_back","latin":"Rhomboideus minor","common":"Rhomboids","view":"back","deep":true,"mapRegions":["b_upperback_mid"]},
 {"id":"trapezius_middle","group":"upper_back","latin":"Trapezius (pars transversa)","common":"Mid traps","view":"back","deep":false,"mapRegions":["b_traps_mid"]},
 {"id":"trapezius_lower","group":"upper_back","latin":"Trapezius (pars ascendens)","common":"Lower traps","view":"back","deep":false,"mapRegions":["b_traps_lower"]},
 {"id":"teres_major","group":"upper_back","latin":"Teres major","common":"Teres major","view":"back","deep":false,"mapRegions":["b_teres_l","b_teres_r"]},
 {"id":"teres_minor","group":"upper_back","latin":"Teres minor","common":"Teres minor (cuff)","view":"back","deep":false,"mapRegions":["b_cuff_l","b_cuff_r"]},
 {"id":"infraspinatus","group":"upper_back","latin":"Infraspinatus","common":"Infraspinatus (cuff)","view":"back","deep":false,"mapRegions":["b_cuff_l","b_cuff_r"]},
 {"id":"supraspinatus","group":"upper_back","latin":"Supraspinatus","common":"Supraspinatus (cuff)","view":"back","deep":true,"mapRegions":["b_cuff_upper"]},
 {"id":"subscapularis","group":"upper_back","latin":"Subscapularis","common":"Subscapularis (cuff)","view":"back","deep":true,"mapRegions":[]},
 {"id":"levator_scapulae","group":"upper_back","latin":"Levator scapulae","common":"Levator scapulae","view":"back","deep":true,"mapRegions":["b_neck_side"]},

 {"id":"latissimus_dorsi_upper","group":"lats","latin":"Latissimus dorsi (upper fibres)","common":"Upper lats","view":"back","deep":false,"mapRegions":["b_lat_upper_l","b_lat_upper_r"]},
 {"id":"latissimus_dorsi_lower","group":"lats","latin":"Latissimus dorsi (lower fibres)","common":"Lower lats","view":"back","deep":false,"mapRegions":["b_lat_lower_l","b_lat_lower_r"]},

 {"id":"trapezius_upper","group":"traps","latin":"Trapezius (pars descendens)","common":"Upper traps","view":"both","deep":false,"mapRegions":["b_traps_upper","f_traps_front"]},

 {"id":"erector_spinae_iliocostalis","group":"lower_back","latin":"Iliocostalis","common":"Erectors (lateral)","view":"back","deep":false,"mapRegions":["b_erector_l","b_erector_r"]},
 {"id":"erector_spinae_longissimus","group":"lower_back","latin":"Longissimus","common":"Erectors (mid)","view":"back","deep":false,"mapRegions":["b_erector_l","b_erector_r"]},
 {"id":"erector_spinae_spinalis","group":"lower_back","latin":"Spinalis","common":"Erectors (medial)","view":"back","deep":true,"mapRegions":["b_erector_column"]},
 {"id":"quadratus_lumborum","group":"lower_back","latin":"Quadratus lumborum","common":"QL","view":"back","deep":true,"mapRegions":["b_lowback_deep"]},
 {"id":"multifidus","group":"lower_back","latin":"Multifidus","common":"Multifidus","view":"back","deep":true,"mapRegions":[]},

 {"id":"deltoid_anterior","group":"front_delts","latin":"Deltoideus (pars clavicularis)","common":"Front delt","view":"front","deep":false,"mapRegions":["f_delt_front_l","f_delt_front_r"]},
 {"id":"deltoid_lateral","group":"side_delts","latin":"Deltoideus (pars acromialis)","common":"Side delt","view":"both","deep":false,"mapRegions":["f_delt_side_l","f_delt_side_r","b_delt_side_l","b_delt_side_r"]},
 {"id":"deltoid_posterior","group":"rear_delts","latin":"Deltoideus (pars spinalis)","common":"Rear delt","view":"back","deep":false,"mapRegions":["b_delt_rear_l","b_delt_rear_r"]},

 {"id":"biceps_long_head","group":"biceps","latin":"Biceps brachii (caput longum)","common":"Biceps long head","view":"front","deep":false,"mapRegions":["f_bicep_outer_l","f_bicep_outer_r"]},
 {"id":"biceps_short_head","group":"biceps","latin":"Biceps brachii (caput breve)","common":"Biceps short head","view":"front","deep":false,"mapRegions":["f_bicep_inner_l","f_bicep_inner_r"]},
 {"id":"brachialis","group":"biceps","latin":"Brachialis","common":"Brachialis","view":"front","deep":false,"mapRegions":["f_brachialis_l","f_brachialis_r"]},
 {"id":"coracobrachialis","group":"biceps","latin":"Coracobrachialis","common":"Coracobrachialis","view":"front","deep":true,"mapRegions":[]},

 {"id":"triceps_long_head","group":"triceps","latin":"Triceps brachii (caput longum)","common":"Triceps long head","view":"back","deep":false,"mapRegions":["b_tri_inner_l","b_tri_inner_r"]},
 {"id":"triceps_lateral_head","group":"triceps","latin":"Triceps brachii (caput laterale)","common":"Triceps lateral head","view":"back","deep":false,"mapRegions":["b_tri_outer_l","b_tri_outer_r"]},
 {"id":"triceps_medial_head","group":"triceps","latin":"Triceps brachii (caput mediale)","common":"Triceps medial head","view":"back","deep":true,"mapRegions":["b_tri_lower_l","b_tri_lower_r"]},
 {"id":"anconeus","group":"triceps","latin":"Anconeus","common":"Anconeus","view":"back","deep":true,"mapRegions":[]},

 {"id":"brachioradialis","group":"forearms","latin":"Brachioradialis","common":"Brachioradialis","view":"front","deep":false,"mapRegions":["f_forearm_outer_l","f_forearm_outer_r"]},
 {"id":"wrist_flexors","group":"forearms","latin":"Flexor carpi radialis / ulnaris, palmaris longus, flexor digitorum","common":"Wrist flexors","view":"front","deep":false,"mapRegions":["f_forearm_front_l","f_forearm_front_r"]},
 {"id":"wrist_extensors","group":"forearms","latin":"Extensor carpi radialis longus / brevis, extensor carpi ulnaris, extensor digitorum","common":"Wrist extensors","view":"back","deep":false,"mapRegions":["b_forearm_back_l","b_forearm_back_r"]},
 {"id":"pronator_teres","group":"forearms","latin":"Pronator teres","common":"Pronator","view":"front","deep":true,"mapRegions":[]},
 {"id":"supinator","group":"forearms","latin":"Supinator","common":"Supinator","view":"front","deep":true,"mapRegions":[]},

 {"id":"rectus_abdominis_upper","group":"abs","latin":"Rectus abdominis (superior)","common":"Upper abs","view":"front","deep":false,"mapRegions":["f_abs_upper"]},
 {"id":"rectus_abdominis_lower","group":"abs","latin":"Rectus abdominis (inferior)","common":"Lower abs","view":"front","deep":false,"mapRegions":["f_abs_lower"]},
 {"id":"transversus_abdominis","group":"abs","latin":"Transversus abdominis","common":"TVA","view":"front","deep":true,"mapRegions":[]},
 {"id":"external_oblique","group":"obliques","latin":"Obliquus externus abdominis","common":"External obliques","view":"front","deep":false,"mapRegions":["f_oblique_l","f_oblique_r"]},
 {"id":"internal_oblique","group":"obliques","latin":"Obliquus internus abdominis","common":"Internal obliques","view":"front","deep":true,"mapRegions":["f_oblique_l","f_oblique_r"]},

 {"id":"rectus_femoris","group":"quads","latin":"Rectus femoris","common":"Rectus femoris","view":"front","deep":false,"mapRegions":["f_quad_mid_l","f_quad_mid_r"]},
 {"id":"vastus_lateralis","group":"quads","latin":"Vastus lateralis","common":"Outer quad","view":"front","deep":false,"mapRegions":["f_quad_outer_l","f_quad_outer_r"]},
 {"id":"vastus_medialis","group":"quads","latin":"Vastus medialis","common":"VMO / teardrop","view":"front","deep":false,"mapRegions":["f_quad_inner_l","f_quad_inner_r"]},
 {"id":"vastus_intermedius","group":"quads","latin":"Vastus intermedius","common":"Vastus intermedius","view":"front","deep":true,"mapRegions":[]},
 {"id":"sartorius","group":"quads","latin":"Sartorius","common":"Sartorius","view":"front","deep":false,"mapRegions":["f_sartorius_l","f_sartorius_r"]},

 {"id":"biceps_femoris_long","group":"hamstrings","latin":"Biceps femoris (caput longum)","common":"Ham lateral","view":"back","deep":false,"mapRegions":["b_ham_outer_l","b_ham_outer_r"]},
 {"id":"biceps_femoris_short","group":"hamstrings","latin":"Biceps femoris (caput breve)","common":"Ham short head","view":"back","deep":true,"mapRegions":["b_ham_outer_l","b_ham_outer_r"]},
 {"id":"semitendinosus","group":"hamstrings","latin":"Semitendinosus","common":"Ham medial","view":"back","deep":false,"mapRegions":["b_ham_inner_l","b_ham_inner_r"]},
 {"id":"semimembranosus","group":"hamstrings","latin":"Semimembranosus","common":"Ham medial deep","view":"back","deep":true,"mapRegions":["b_ham_inner_l","b_ham_inner_r"]},

 {"id":"gluteus_maximus","group":"glutes","latin":"Gluteus maximus","common":"Glute max","view":"back","deep":false,"mapRegions":["b_glute_l","b_glute_r"]},
 {"id":"gluteus_medius","group":"abductors","latin":"Gluteus medius","common":"Glute med","view":"back","deep":false,"mapRegions":["b_hip_side_l","b_hip_side_r"]},
 {"id":"gluteus_minimus","group":"abductors","latin":"Gluteus minimus","common":"Glute min","view":"back","deep":true,"mapRegions":[]},
 {"id":"tensor_fasciae_latae","group":"abductors","latin":"Tensor fasciae latae","common":"TFL","view":"front","deep":false,"mapRegions":["f_tfl_l","f_tfl_r"]},
 {"id":"piriformis","group":"abductors","latin":"Piriformis","common":"Piriformis","view":"back","deep":true,"mapRegions":[]},

 {"id":"adductor_magnus","group":"adductors","latin":"Adductor magnus","common":"Adductor magnus","view":"both","deep":false,"mapRegions":["f_adductor_upper_l","f_adductor_upper_r","b_adductor_l","b_adductor_r"]},
 {"id":"adductor_longus","group":"adductors","latin":"Adductor longus","common":"Adductor longus","view":"front","deep":false,"mapRegions":["f_adductor_l","f_adductor_r"]},
 {"id":"adductor_brevis","group":"adductors","latin":"Adductor brevis","common":"Adductor brevis","view":"front","deep":true,"mapRegions":[]},
 {"id":"gracilis","group":"adductors","latin":"Gracilis","common":"Gracilis","view":"front","deep":false,"mapRegions":["f_gracilis_l","f_gracilis_r"]},
 {"id":"pectineus","group":"adductors","latin":"Pectineus","common":"Pectineus","view":"front","deep":true,"mapRegions":[]},

 {"id":"gastrocnemius_medial","group":"calves","latin":"Gastrocnemius (caput mediale)","common":"Inner calf","view":"back","deep":false,"mapRegions":["b_calf_inner_l","b_calf_inner_r"]},
 {"id":"gastrocnemius_lateral","group":"calves","latin":"Gastrocnemius (caput laterale)","common":"Outer calf","view":"back","deep":false,"mapRegions":["b_calf_outer_l","b_calf_outer_r"]},
 {"id":"soleus","group":"calves","latin":"Soleus","common":"Soleus","view":"back","deep":false,"mapRegions":["b_soleus_l","b_soleus_r"]},
 {"id":"tibialis_anterior","group":"calves","latin":"Tibialis anterior","common":"Shin / tib","view":"front","deep":false,"mapRegions":["f_shin_l","f_shin_r"]},
 {"id":"fibularis_longus","group":"calves","latin":"Fibularis (peroneus) longus","common":"Peroneals","view":"front","deep":false,"mapRegions":["f_shin_outer_l","f_shin_outer_r"]},

 {"id":"psoas_major","group":"hip_flexors","latin":"Psoas major","common":"Psoas","view":"front","deep":true,"mapRegions":[]},
 {"id":"iliacus","group":"hip_flexors","latin":"Iliacus","common":"Iliacus","view":"front","deep":true,"mapRegions":["f_hipflexor_l","f_hipflexor_r"]},

 {"id":"sternocleidomastoid","group":"neck","latin":"Sternocleidomastoideus","common":"SCM","view":"front","deep":false,"mapRegions":["f_neck_front_l","f_neck_front_r"]},
 {"id":"scalenes","group":"neck","latin":"Scalenus anterior / medius / posterior","common":"Scalenes","view":"front","deep":true,"mapRegions":[]},
 {"id":"splenius_capitis","group":"neck","latin":"Splenius capitis","common":"Neck extensors","view":"back","deep":false,"mapRegions":["b_neck_back"]},
 {"id":"splenius_cervicis","group":"neck","latin":"Splenius cervicis","common":"Neck extensors","view":"back","deep":true,"mapRegions":["b_neck_back"]}
]
```
Count: 74 muscle entries across 21 groups; 48 are shadeable (deep:false),
26 are deep/listed-only. Your front.svg needs 41 distinct paths, back.svg 39.

A4. GROUP-WEIGHT MODEL (the thing that actually drives readiness + volume charts)
Every exercise carries `groupWeights: Record<MuscleGroupId, number>` summing to 1.0.
This is strictly better than primary/secondary arrays because volume attribution
becomes a dot product. Examples:
  Barbell Bench Press  -> {chest:0.55, front_delts:0.20, triceps:0.25}
  Barbell Back Squat   -> {quads:0.50, glutes:0.25, lower_back:0.10, adductors:0.10, hamstrings:0.05}
  Conventional Deadlift-> {hamstrings:0.25, glutes:0.25, lower_back:0.25, traps:0.10, lats:0.08, forearms:0.07}
  Weighted Pull Up     -> {lats:0.50, upper_back:0.20, biceps:0.20, forearms:0.10}
  Lateral Raise (DB)   -> {side_delts:0.85, traps:0.10, front_delts:0.05}
  Romanian Deadlift    -> {hamstrings:0.50, glutes:0.28, lower_back:0.17, forearms:0.05}
Readiness fatigue per group = sum over sets of (set_volume_kg * groupWeight) then
decayed exponentially with the group's `recoveryHours` half-life.

================================================================================
PART B — EQUIPMENT TAXONOMY (44 items, 7 classes)
================================================================================

```json
[
 {"class":"free_weight","items":[
  {"id":"barbell","label":"Barbell","barKg":20,"avail":"ubiquitous"},
  {"id":"dumbbell","label":"Dumbbell","avail":"ubiquitous"},
  {"id":"kettlebell","label":"Kettlebell","avail":"common"},
  {"id":"ez_bar","label":"EZ Bar","barKg":10,"avail":"common"},
  {"id":"trap_bar","label":"Trap Bar","barKg":25,"avail":"common"},
  {"id":"safety_squat_bar","label":"Safety Squat Bar","barKg":25,"avail":"uncommon"},
  {"id":"cambered_bar","label":"Cambered Bar","barKg":25,"avail":"rare"},
  {"id":"swiss_bar","label":"Swiss / Football Bar","barKg":20,"avail":"uncommon"},
  {"id":"axle_bar","label":"Axle Bar","barKg":25,"avail":"rare"},
  {"id":"log_bar","label":"Log","barKg":50,"avail":"rare"},
  {"id":"weight_plate","label":"Weight Plate","avail":"ubiquitous"},
  {"id":"sandbag","label":"Sandbag","avail":"uncommon"},
  {"id":"medicine_ball","label":"Medicine Ball","avail":"common"},
  {"id":"slam_ball","label":"Slam Ball","avail":"common"},
  {"id":"atlas_stone","label":"Atlas Stone","avail":"rare"},
  {"id":"macebell","label":"Macebell","avail":"rare"},
  {"id":"indian_club","label":"Indian Club","avail":"rare"}]},

 {"class":"machine","items":[
  {"id":"machine_selectorized","label":"Machine","avail":"ubiquitous"},
  {"id":"machine_plate_loaded","label":"Plate Loaded Machine","avail":"common"},
  {"id":"smith_machine","label":"Smith Machine","barKg":15,"avail":"common"},
  {"id":"hack_squat_machine","label":"Hack Squat Machine","avail":"common"},
  {"id":"leg_press_machine","label":"Leg Press","avail":"ubiquitous"},
  {"id":"pendulum_squat","label":"Pendulum Squat","avail":"rare"},
  {"id":"belt_squat","label":"Belt Squat","avail":"uncommon"},
  {"id":"reverse_hyper","label":"Reverse Hyper","avail":"uncommon"},
  {"id":"ghd","label":"Glute Ham Developer","avail":"uncommon"},
  {"id":"back_extension_bench","label":"45° Back Extension","avail":"common"},
  {"id":"assisted_machine","label":"Assisted Pull Up / Dip Machine","avail":"common"},
  {"id":"neck_machine","label":"4-Way Neck Machine","avail":"rare"}]},

 {"class":"cable","items":[
  {"id":"cable","label":"Cable","avail":"ubiquitous"},
  {"id":"functional_trainer","label":"Functional Trainer","avail":"common"},
  {"id":"lat_pulldown_station","label":"Lat Pulldown","avail":"ubiquitous"}]},

 {"class":"bodyweight","items":[
  {"id":"bodyweight","label":"Bodyweight","avail":"ubiquitous"},
  {"id":"pull_up_bar","label":"Pull Up Bar","avail":"ubiquitous"},
  {"id":"dip_bars","label":"Dip Bars","avail":"common"},
  {"id":"gymnastic_rings","label":"Rings","avail":"uncommon"},
  {"id":"parallettes","label":"Parallettes","avail":"uncommon"},
  {"id":"suspension_trainer","label":"Suspension Trainer","avail":"common"},
  {"id":"ab_wheel","label":"Ab Wheel","avail":"common"},
  {"id":"bench","label":"Bench","avail":"ubiquitous"},
  {"id":"plyo_box","label":"Box","avail":"common"},
  {"id":"stability_ball","label":"Stability Ball","avail":"common"},
  {"id":"sliders","label":"Sliders / Valslides","avail":"common"}]},

 {"class":"band","items":[
  {"id":"resistance_band","label":"Resistance Band","avail":"ubiquitous"},
  {"id":"mini_band","label":"Mini Band","avail":"common"},
  {"id":"chains","label":"Chains","avail":"rare"}]},

 {"class":"implement","items":[
  {"id":"sled","label":"Sled / Prowler","avail":"uncommon"},
  {"id":"yoke","label":"Yoke","avail":"rare"},
  {"id":"farmers_handles","label":"Farmer's Handles","avail":"uncommon"},
  {"id":"landmine","label":"Landmine","avail":"common"},
  {"id":"battle_ropes","label":"Battle Ropes","avail":"common"},
  {"id":"weighted_vest","label":"Weighted Vest","avail":"uncommon"},
  {"id":"dip_belt","label":"Dip Belt","avail":"common"},
  {"id":"neck_harness","label":"Neck Harness","avail":"rare"},
  {"id":"wrist_roller","label":"Wrist Roller","avail":"uncommon"},
  {"id":"grip_trainer","label":"Grip Trainer","avail":"common"},
  {"id":"tire","label":"Tire","avail":"rare"}]},

 {"class":"cardio_machine","items":[
  {"id":"treadmill","label":"Treadmill","avail":"ubiquitous"},
  {"id":"rower","label":"Rowing Machine","avail":"common"},
  {"id":"air_bike","label":"Air Bike","avail":"common"},
  {"id":"stationary_bike","label":"Stationary Bike","avail":"ubiquitous"},
  {"id":"elliptical","label":"Elliptical","avail":"common"},
  {"id":"stair_climber","label":"Stair Climber","avail":"common"},
  {"id":"ski_erg","label":"Ski Erg","avail":"uncommon"},
  {"id":"jump_rope","label":"Jump Rope","avail":"common"}]}
]
```
CABLE ATTACHMENT is a separate axis (NOT equipment): rope, straight_bar, ez_bar,
v_bar, d_handle, single_d, lat_bar_wide, ankle_strap, tricep_v, mag_grip,
stirrup, belt. It is a **variant** only where it renames the lift in common use
(Rope Pushdown vs Bar Pushdown). Otherwise store it as a per-set note.

BAR WEIGHT: store `barWeightKgDefault` per equipment and let the user override
per gym profile. Smith machines carry 6-20 kg of counterbalanced carriage —
ship 15 kg default and expose it, because silently wrong bar weight is the #1
source of bad volume numbers in competitor apps.

================================================================================
PART C — MOVEMENT PATTERN TAXONOMY (20)
================================================================================

Built on the NSCA's foundational patterns (squat, hinge, lunge, push, pull,
carry, rotation, gait), with push/pull split by vector and isolation split by
joint action — a strength tracker needs finer resolution than a coaching
framework because it drives the training-split breakdown chart.

| id | Definition | Canonical examples |
|---|---|---|
| horizontal_push | Load moves away from torso in the transverse plane | Bench Press, Push Up, Chest Press |
| vertical_push | Load moves overhead in the frontal/sagittal plane | Overhead Press, Handstand Push Up |
| horizontal_pull | Load moves toward torso in the transverse plane | Barbell Row, Seated Cable Row, Inverted Row |
| vertical_pull | Load moves down toward torso from overhead | Pull Up, Lat Pulldown |
| squat | Knee-dominant bilateral triple flexion/extension | Back Squat, Leg Press, Hack Squat |
| hinge | Hip-dominant flexion/extension, minimal knee travel | Deadlift, RDL, Good Morning, Hip Thrust |
| lunge | Split-stance knee-dominant, unilateral | Bulgarian Split Squat, Walking Lunge, Step Up |
| carry | Loaded gait under static hold | Farmer's Walk, Suitcase Carry, Yoke Walk |
| gait | Locomotion for conditioning | Run, Row, Ski Erg |
| rotation | Trunk rotation under load | Cable Woodchop, Russian Twist, Landmine 180 |
| anti_rotation | Resisting trunk rotation | Pallof Press, Renegade Row |
| anti_extension | Resisting lumbar extension | Plank, Ab Wheel, Dead Bug |
| anti_lateral_flexion | Resisting lateral trunk flexion | Side Plank, Suitcase Carry, Copenhagen Plank |
| isolation_flexion | Single-joint flexion | Biceps Curl, Leg Curl, Crunch |
| isolation_extension | Single-joint extension | Triceps Pushdown, Leg Extension, Back Extension |
| isolation_abduction | Limb away from midline | Lateral Raise, Hip Abduction, Reverse Fly |
| isolation_adduction | Limb toward midline | Cable Crossover, Pec Deck, Hip Adduction |
| olympic | Triple-extension explosive full-body | Clean, Snatch, Jerk, Thruster |
| plyometric | Stretch-shortening, ballistic | Box Jump, Depth Jump, Clap Push Up |
| isometric_hold | Static loaded position | Wall Sit, Dead Hang, Isometric Bench Hold |

================================================================================
PART D — FORCE / MECHANIC / UNILATERAL / TRACKING TYPES
================================================================================

D1. FORCE (4): push | pull | static | carry
    (free-exercise-db ships only push/pull/static; `carry` is added because
    loaded gait is neither and the Analytics split chart needs it.)

D2. MECHANIC (2): compound | isolation
    Rule: compound = >1 joint crosses meaningful load. In free-exercise-db's
    678 resistance exercises the split is 491 compound / 298 isolation / 87 null
    (across all 876) — expect ~58/42 in a curated catalog.

D3. UNILATERAL (bool) + `limbMode: 'bilateral' | 'unilateral_alternating' | 'unilateral_sequential'`
    Critical because entered weight semantics differ. Store
    `weightIsPerLimb: boolean`. Single-Arm DB Row at 40 kg = 40 kg volume per rep,
    NOT 80. Get this wrong and every unilateral PR is double-counted.

D4. TRACKING TYPES (10). Matches Hevy's 8 plus `reps_only` and `distance_only`.

| id | Inputs | Volume formula (kg) | Examples |
|---|---|---|---|
| weight_reps | kg, reps | kg × reps | Bench Press, Squat |
| bodyweight_reps | reps | bwFactor × userBW × reps | Push Up, Pull Up, Dip |
| weighted_bodyweight | +kg, reps | (bwFactor × userBW + kg) × reps | Weighted Dip, Weighted Pull Up |
| assisted_bodyweight | −kg, reps | max(0, bwFactor × userBW − kg) × reps | Assisted Pull Up |
| reps_only | reps | 0 (counted in reps + set tallies only) | Band Pull Apart, Calf Raise (BW) |
| duration | seconds | bwFactor × userBW × (sec/3) proxy | Plank, Dead Hang, Wall Sit |
| duration_weight | kg, seconds | kg × (sec/3) | Weighted Plank, Isometric Hold |
| distance_duration | m, seconds | 0 (reported as distance + pace) | Row, Run, Ski Erg |
| weight_distance | kg, m | kg × m ÷ 10 (carry-volume proxy) | Farmer's Walk, Suitcase Carry |
| distance_only | m | 0 | Sled Push (per length) |

D5. BODYWEIGHT LOAD COEFFICIENTS (`bwFactor`) — cite these, they are measured,
not invented. Ebben, Wurm, VanderZanden et al., "Kinetic Analysis of Several
Variations of Push-Ups," J Strength Cond Res 25(10):2891-2894, 2011; and Suprak,
Dawes, Stephenson, "The Effect of Position on the Percentage of Body Mass
Supported During Traditional and Modified Push-Up Variants," JSCR 25(2):497-503, 2011.

| Exercise | bwFactor | Source |
|---|---|---|
| Push Up (standard) | 0.64 | Ebben 2011, measured |
| Push Up, hands elevated 30.5 cm | 0.55 | Ebben 2011, measured |
| Push Up, hands elevated 61 cm | 0.41 | Ebben 2011, measured |
| Push Up, feet elevated 30.5 cm | 0.70 | Ebben 2011, measured |
| Push Up, feet elevated 61 cm | 0.74 | Ebben 2011, measured |
| Knee (modified) Push Up | 0.49 | Ebben 2011, measured |
| Pull Up / Chin Up | 0.95 | BW minus forearms+hands distal to bar (~5% segment mass) |
| Dip | 0.94 | BW minus forearms+hands |
| Inverted Row (feet on floor, torso ~45°) | 0.55 | derived from suspension-row GRF work; tune per strap length |
| Inverted Row (feet elevated, horizontal) | 0.70 | derived |
| Bodyweight Squat | 0.78 | BW minus shanks+feet (~22% segment mass, Dempster) |
| Pistol Squat | 0.85 | per-leg, minus support leg |
| Plank | 0.55 | static, forearm support |
| Nordic Curl | 0.60 | torso+head above knee axis |
| Handstand Push Up | 0.92 | BW minus forearms |

Store `bwFactor` per exercise, allow a user override in settings, and ALWAYS
show the assumption in the set row tooltip ("Push Up counted at 64% of your
82 kg = 52.5 kg/rep"). This is a trust feature — apps that hide it get accused
of inflating volume.

D6. SET TYPES (ship 7)
```json
["normal","warm_up","drop","failure","myo_rep","rest_pause","partial"]
```
Hevy ships 4 (normal, warm-up, drop, failure). Ship 7 and you beat them.
Rules: warm_up sets are EXCLUDED from volume, PR detection, e1RM, and readiness
fatigue. drop/rest_pause/myo_rep sets count toward volume but are flagged so
e1RM is computed only from the first sub-set. failure sets get RIR=0 pinned.
`partial` sets get a `romPct` (default 60) and are volume-discounted by that
factor, otherwise lengthened-partial users inflate their charts.

================================================================================
PART E — THE ENUMERATION: HOW MANY EXERCISES ACTUALLY EXIST
================================================================================

E1. THE DISTINCTNESS TEST (this is the whole answer to "where is the line")
An entry earns its own catalog row if it fails ANY of these four:

  1. LOAD COMPARABILITY — could a user's working weight on A and B be plotted on
     the same chart without being misleading? (Barbell vs Dumbbell bench: NO ->
     separate rows. Bench with a red bar vs a black bar: YES -> same row.)
  2. MUSCLE SHIFT — does `groupWeights` change by >10 percentage points on any
     group? (Pull Up vs Chin Up: biceps 0.20 -> 0.32 -> separate rows. Grip 2 cm
     wider: no -> same row.)
  3. DEMO DIVERGENCE — would a viewer of the animation be doing the wrong thing?
     (Sumo vs Conventional Deadlift: YES -> separate. Tempo 3-1-1 vs 2-0-1: NO.)
  4. INPUT SCHEMA — does the tracking type change? (Pull Up vs Weighted Pull Up
     vs Assisted Pull Up: three different input schemas -> three rows.)

Everything that passes all four is an ATTRIBUTE, logged on the set or the
exercise instance, never a new catalog row:
  tempo, rest time, RPE/RIR, bar type within a class, cable attachment (unless
  it renames the lift), exact grip width in cm, exact bench angle in degrees,
  foot position micro-adjustments, straps/belt/sleeves, machine brand,
  seat height, breathing, unilateral order, set type, partial ROM percentage.

E2. THE COMBINATORIAL CEILING (the honest "how many exist" number)
  210 base movements × 44 equipment × 5 grips × 4 angles × 3 stances × 2 limb modes
  = 705,600 nominal combinations.
  Physically valid + actually named in gym culture: ~0.17% of that = ~1,200.
  This is why "every exercise in the world" is a naming problem, not a data
  problem. The world does not contain 700k exercises; it contains ~210 movements
  that people have given ~1,200 names to.

E3. MARKET CALIBRATION (verified counts, so we know where the bar is)
  | Product | Catalog size | Note |
  |---|---|---|
  | Hevy | 400+ official (marketing claims up to 1,000) | market leader |
  | Boostcamp | 450+ with demos | |
  | StrengthLog | 450+ | |
  | JEFIT | 1,400+ with animations | largest mainstream |
  | free-exercise-db (Unlicense) | 876 total / 678 resistance-only | our legal seed |
  | ExerciseGymGifsDB | 1,323 with GIFs | scraped, NOT license-safe |
  | ExerciseDB (AGPL-3.0) | 11,000+ claimed, 5,000+ GIFs | mostly duplicate rows |
  | StrengthLevel | 287 exercises with world standards | our standards ceiling |
  | arXiv 2603.17495 1RM study | 388 exercises logged, only 183 with enough data | the analytic long tail |

  The 11,000 number is an artifact of not applying a distinctness test. The 287
  and 183 numbers are the ones that matter: **fewer than 300 exercises will ever
  carry a world-standings comparison, and fewer than 200 accumulate enough user
  data to sparkline meaningfully.** Everything else is catalog completeness.

E4. THE SHIP PLAN — THREE TIERS

| Muscle group | T0 Core (day 1) | T1 Ship (v1.0) | T2 Complete (v1.2) | Unique animations (T2) |
|---|---|---|---|---|
| Chest | 10 | 58 | 96 | 42 |
| Lats | 8 | 46 | 78 | 34 |
| Upper Back | 7 | 42 | 72 | 32 |
| Traps | 3 | 18 | 32 | 14 |
| Lower Back | 3 | 22 | 36 | 18 |
| Front Delts | 6 | 30 | 52 | 24 |
| Side Delts | 4 | 24 | 42 | 18 |
| Rear Delts | 4 | 20 | 36 | 16 |
| Biceps | 7 | 42 | 72 | 30 |
| Triceps | 7 | 44 | 76 | 32 |
| Forearms | 3 | 26 | 42 | 20 |
| Abs | 6 | 44 | 70 | 34 |
| Obliques | 3 | 26 | 44 | 22 |
| Quads | 11 | 62 | 108 | 46 |
| Hamstrings | 6 | 34 | 58 | 26 |
| Glutes | 6 | 38 | 66 | 30 |
| Hip Flexors | 1 | 8 | 14 | 8 |
| Adductors | 2 | 14 | 24 | 12 |
| Abductors | 2 | 14 | 24 | 12 |
| Calves | 3 | 18 | 32 | 14 |
| Neck | 1 | 12 | 20 | 10 |
| Olympic / Full Body | 4 | 24 | 42 | 26 |
| Strongman / Carry | 3 | 18 | 32 | 18 |
| Cardio / Conditioning | 4 | 14 | 22 | 14 |
| **TOTAL** | **114** | **698** | **1,190** | **552** |

Counted by PRIMARY group; each exercise appears exactly once. 1,190 exercises
share 552 authored animations (2.16 exercises per animation) because unilateral,
grip and stance variants of the same movement+equipment reuse one demo with a
text annotation. That is the number that makes "a GIF for every exercise"
achievable: **552 assets, not 1,190.**

E5. WORKED ENUMERATION FOR CHEST (58) — the pattern for every other group
  Barbell (11): Bench Press, Incline Bench Press, Decline Bench Press, Wide Grip
    Bench Press, Guillotine Press, Floor Press, Spoto Press, Board Press,
    Pin Press, Reverse Grip Bench Press, Larsen Press
  Dumbbell (12): Bench Press, Incline Bench Press, Decline Bench Press,
    Neutral Grip Bench Press, Single Arm Bench Press, Floor Press, Squeeze Press,
    Chest Fly, Incline Chest Fly, Decline Chest Fly, Pullover, Around The World
  Machine (7): Chest Press, Incline Chest Press, Decline Chest Press, Pec Deck,
    Converging Chest Press, Single Arm Chest Press, Seated Chest Fly
  Cable (8): High Crossover, Mid Crossover, Low Crossover, Standing Chest Fly,
    Incline Chest Fly, Single Arm Chest Press, Standing Chest Press, Pullover
  Smith (3): Bench Press, Incline Bench Press, Decline Bench Press
  Bodyweight (11): Push Up, Wide Push Up, Decline Push Up, Incline Push Up,
    Deficit Push Up, Archer Push Up, Single Arm Push Up, Clap Push Up,
    Ring Push Up, Chest Dip, Weighted Chest Dip
  Other (6): Landmine Press, Plate Squeeze Press (Svend), Band Chest Fly,
    Band Chest Press, Suspension Chest Fly, Medicine Ball Chest Throw
  -> 58. Note what is NOT here: "Bench Press with 2s pause", "Bench Press with
  chains", "Bench Press with a cambered bar" — those are attributes/modifiers,
  except where powerlifting culture has named them (Spoto, Board, Pin, Larsen
  all earn rows because they fail the LOAD COMPARABILITY test).

E6. THE 114 CORE (Tier 0) — these must exist before anything ships, because they
cover ~85% of all logged sets in every public dataset:
  Bench Press (Barbell/Dumbbell/Incline ×2/Machine), Push Up, Chest Fly (Dumbbell/
  Cable/Machine), Chest Dip; Pull Up, Chin Up, Lat Pulldown (Cable/Close Grip/
  Neutral), Bent Over Row (Barbell/Dumbbell), Seated Row (Cable/Machine), T Bar
  Row, Single Arm Row (Dumbbell), Straight Arm Pulldown, Face Pull, Shrug
  (Barbell/Dumbbell); Overhead Press (Barbell/Dumbbell/Seated/Machine), Arnold
  Press, Lateral Raise (Dumbbell/Cable/Machine), Front Raise, Reverse Fly
  (Dumbbell/Machine/Cable), Upright Row; Biceps Curl (Barbell/Dumbbell/EZ Bar/
  Cable), Hammer Curl, Preacher Curl, Incline Curl; Triceps Pushdown (Rope/Bar),
  Overhead Triceps Extension, Skullcrusher, Close Grip Bench Press, Triceps Dip,
  Triceps Kickback; Back Squat, Front Squat, Goblet Squat, Hack Squat, Leg Press,
  Bulgarian Split Squat, Lunge (Walking/Reverse), Step Up, Leg Extension,
  Deadlift, Sumo Deadlift, Romanian Deadlift (Barbell/Dumbbell), Leg Curl
  (Lying/Seated), Nordic Curl, Good Morning, Hip Thrust (Barbell/Machine), Glute
  Bridge, Cable Kickback, Hip Abduction (Machine), Hip Adduction (Machine), Calf
  Raise (Standing/Seated/Leg Press), Plank, Side Plank, Crunch (Cable/Machine),
  Hanging Leg Raise, Hanging Knee Raise, Ab Wheel Rollout, Russian Twist, Pallof
  Press, Cable Woodchop, Back Extension, Farmer's Walk, Wrist Curl, Reverse Wrist
  Curl, Dead Hang, Clean, Power Clean, Snatch, Clean and Jerk, Thruster, Kettlebell
  Swing, Burpee, Box Jump, Treadmill Run, Rowing Machine, Air Bike, Jump Rope,
  Neck Curl.

================================================================================
PART F — CANONICAL NAMING CONVENTION
================================================================================

F1. THE GENERATOR (names are COMPUTED, never hand-typed; that is what prevents
"Barbell Bench Press" and "Bench Press (Barbell)" from both existing)

```ts
function canonicalName(ex: Exercise): string {
  const mods = [
    v(ex,'limb'),      // "Single Arm" | "Single Leg" | "Alternating"
    v(ex,'position'),  // "Seated" | "Standing" | "Lying" | "Prone" | "Kneeling" | "Bent Over" | "Chest Supported"
    v(ex,'angle'),     // "Incline" | "Decline" | "Flat"(omitted) | "45 Degree"
    v(ex,'stance'),    // "Sumo" | "Wide Stance" | "Narrow Stance" | "B Stance" | "Split" | "Deficit"
    v(ex,'grip'),      // "Close Grip" | "Wide Grip" | "Neutral Grip" | "Reverse Grip" | "Behind The Neck"
    v(ex,'rom'),       // "Paused" | "Pin" | "Board" | "Floor" | "One and a Half"
  ].filter(Boolean);
  const load = ex.tracking === 'weighted_bodyweight' ? 'Weighted'
             : ex.tracking === 'assisted_bodyweight' ? 'Assisted' : null;
  const base = MOVEMENTS[ex.movementId].label;              // "Bench Press"
  const equip = EQUIPMENT_SUFFIX[ex.equipmentId];           // "Barbell" | null
  const head = [...mods, base].join(' ');
  const parens = [load, equip].filter(Boolean).join(', ');  // "Weighted" | "Barbell"
  return parens ? `${head} (${parens})` : head;
}
```
Modifier order is FIXED: **Limb > Position > Angle > Stance > Grip > ROM > Base > (Load, Equipment)**.
Any other order is rejected by CI.

F2. OUTPUT EXAMPLES
```
Bench Press (Barbell)
Incline Bench Press (Dumbbell)
Close Grip Bench Press (Barbell)
Single Arm Bench Press (Dumbbell)
Seated Overhead Press (Barbell)
Behind The Neck Overhead Press (Barbell)
Bent Over Row (Barbell)
Single Arm Bent Over Row (Dumbbell)
Chest Supported Row (Machine)
Romanian Deadlift (Barbell)
Single Leg Romanian Deadlift (Dumbbell)
Sumo Deadlift (Barbell)
Lat Pulldown (Cable)
Close Grip Lat Pulldown (Cable)
Pull Up
Pull Up (Weighted)
Pull Up (Assisted)
Chin Up
Bulgarian Split Squat (Dumbbell)
Lateral Raise (Dumbbell)
Single Arm Lateral Raise (Cable)
Triceps Pushdown (Cable, Rope)      <- attachment allowed as 2nd paren token ONLY for pushdown/row/curl families
Standing Calf Raise (Machine)
Farmer's Walk (Dumbbell)
Plank
Hanging Leg Raise
```

F3. ORTHOGRAPHY RULES (enforced by a lint rule in CI over the catalog JSON)
  - Title Case every word except articles/prepositions inside a phrase ("Behind
    The Neck" keeps The capitalised for scanability at 14px).
  - No hyphens in grip/position modifiers: "Close Grip", not "Close-Grip".
  - Two words, no hyphen: "Pull Up", "Push Up", "Sit Up", "Chin Up", "Step Up".
  - Singular base nouns: "Curl" not "Curls", "Raise" not "Raises".
  - No abbreviations in canonical names: Dumbbell not DB, Barbell not BB,
    Romanian Deadlift not RDL, Overhead Press not OHP.
  - American spelling for the canonical; localisations live in `i18n`.
  - "Triceps"/"Biceps" always take the s (they are singular Latin nouns).
    Never "Tricep Pushdown" — but DO alias it, because 40% of users type it.
  - Equipment suffix is OMITTED when the equipment is definitional:
    Pull Up, Push Up, Dip, Plank, Muscle Up, Handstand Push Up, Burpee,
    Clean, Snatch, Kettlebell Swing (kettlebell is in the name).
  - Equipment suffix is REQUIRED whenever the same movement exists with ≥2
    equipment classes. Bench Press always gets a suffix. Always.
  - Max 42 characters. Longer than that and the active-workout row truncates.
    If the generator exceeds 42, drop the ROM modifier into `subtitle`.

F4. ALIASES — the search index, not the display name
Every exercise carries `aliases: string[]`. Generated automatically plus a
hand-curated list. Generation rules:
  1. Equipment-first permutation: "Bench Press (Barbell)" -> "Barbell Bench Press"
  2. Paren-stripped: -> "Bench Press Barbell"
  3. Abbreviation expansion map applied in reverse:
     bb->barbell, db->dumbbell, kb->kettlebell, ohp->overhead press,
     rdl->romanian deadlift, sldl->stiff leg deadlift, bss->bulgarian split squat,
     ghr->glute ham raise, hspu->handstand push up, bor->bent over row,
     cgbp->close grip bench press, jm->jm press, dl->deadlift, sq->squat,
     bp->bench press, latpd->lat pulldown, pjr->poor man's, ldl->landmine deadlift
  4. Common misspellings/variants: tricep->triceps, bicep->biceps,
     "lat pull down"->"lat pulldown", "pullup"->"pull up", "dead lift"->"deadlift",
     "skull crusher"/"skullcrusher"/"lying triceps extension" all -> Skullcrusher
  5. Gym-slang and eponyms (hand-curated, ~180 entries):
     "Pec Deck" -> Chest Fly (Machine)
     "Peck Deck" -> Chest Fly (Machine)
     "Hammer Strength Row" -> Chest Supported Row (Plate Loaded Machine)
     "Pendlay Row" -> Bent Over Row (Barbell) [dead-stop variant, own row in T2]
     "Yates Row" -> Reverse Grip Bent Over Row (Barbell)
     "Meadows Row" -> Single Arm Landmine Row
     "Kroc Row" -> Single Arm Bent Over Row (Dumbbell)
     "Gironda Dip", "Sternum Chin Up", "JM Press", "Tate Press",
     "California Press", "Zercher Squat", "Hatfield Squat", "Anderson Squat",
     "Jefferson Curl", "Kas Glute Bridge", "Copenhagen Plank", "Poliquin Raise",
     "Lu Raise", "Egyptian Lateral Raise", "Bayesian Curl", "Zottman Curl",
     "Cossack Squat", "Sissy Squat", "Nordic Curl"/"Nordic Ham Curl"/"Russian Leg Curl",
     "Good Girl / Bad Girl Machine" -> Hip Adduction / Hip Abduction (Machine),
     "21s" -> attribute on Biceps Curl, not an exercise
  6. Non-English (ship es, pt, de, fr, it at minimum given the EU market):
     "press de banca", "supino reto", "Bankdrücken", "développé couché",
     "panca piana" all -> Bench Press (Barbell)

Search implementation: a single `search_tokens` tsvector/FTS column built from
canonicalName + aliases + movement label + equipment label + muscle group labels,
queried with trigram fallback (pg_trgm similarity > 0.3) so "benhc pres" resolves.

================================================================================
PART G — DEDUPLICATION AND ID STRATEGY
================================================================================

G1. TWO KEYS, DIFFERENT JOBS
  - `id`: ULID, immutable forever. **This is the only thing user history stores.**
    Never derived from the name. Never reused. Never changed for any reason.
  - `slug`: deterministic, human-readable, UNIQUE, used for content authoring,
    deep links, and CSV import. Derived from components, NOT from the display name:
      slug = [limb, position, angle, stance, grip, rom].filter.join('-')
           + (mods ? '-' : '') + movementId
           + '--' + equipmentId
           + (loadMode ? '--' + loadMode : '')
    Examples:
      bench-press--barbell
      incline-bench-press--dumbbell
      close-grip-bench-press--barbell
      single-arm-bent-over-row--dumbbell
      pull-up--bodyweight
      pull-up--bodyweight--weighted
      pull-up--bodyweight--assisted
      single-leg-romanian-deadlift--dumbbell
      standing-calf-raise--machine_selectorized
    Because the slug is built from IDs, renaming "Chest Fly" to "Pec Fly" in the
    UI changes zero slugs and zero history.

G2. THE UNIQUENESS CONSTRAINT (this is what makes both-names-existing impossible)
```sql
CREATE UNIQUE INDEX exercise_identity ON exercises (
  movement_id, equipment_id, load_mode, variant_signature
) WHERE status = 'active';
-- variant_signature = array_to_string(sort(variant_keys), '|')
```
There is no path to inserting a duplicate: two rows for "Barbell Bench Press"
and "Bench Press (Barbell)" would both compute
(movement=bench_press, equipment=barbell, load=none, variants='') and the
second insert fails at the database level. The display name is generated, so it
is never the thing being compared.

G3. IMPORT-TIME NEAR-DUPLICATE DETECTION (for seeding from free-exercise-db,
user submissions, and CSV imports from Strong/Hevy/JEFIT)
```
score = 0.45 * token_set_ratio(normalize(a.name), normalize(b.name))
      + 0.25 * (a.movement_id == b.movement_id)
      + 0.20 * (a.equipment_class == b.equipment_class)
      + 0.10 * cosine(a.groupWeights, b.groupWeights)
normalize(): lowercase, strip diacritics, strip punctuation, expand the
abbreviation map, drop stopwords {the, a, with, on, using}, singularize.
score >= 0.92 -> auto-merge, log it
0.80..0.92    -> human review queue (this is ~60 rows when seeding 876)
< 0.80        -> distinct
```

G4. MERGE SEMANTICS — history must survive
```sql
CREATE TABLE exercise_merges (
  from_id  ulid PRIMARY KEY,
  into_id  ulid NOT NULL REFERENCES exercises(id),
  merged_at timestamptz NOT NULL,
  reason   text
);
```
Rules:
  - NEVER delete or hard-rename an exercise row. Set `status='merged'` and write
    the merge record. The row stays queryable forever.
  - Client resolution: on sync, any `exercise_id` in local history is passed
    through `resolve(id) = follow merges transitively, max depth 8`.
    Server returns the merge table with every catalog delta.
  - PR/e1RM recomputation: merging A into B triggers a background job that
    re-runs PR detection over the union of both histories, because a user's old
    "Barbell Bench Press" PR and new "Bench Press (Barbell)" PR must reconcile
    to one number. Emit a one-time in-app notice: "We merged 2 duplicate
    exercises in your history. Your Bench Press PR is now 102.5 kg."
  - Merges are irreversible in the client but auditable; keep `pre_merge_snapshot`
    JSON for 90 days.
  - Splits (rare, e.g. discovering that our single "Cable Crossover" should be
    High/Mid/Low) are handled as: keep the old id as the "Mid" canonical, create
    two NEW ids, do not reassign history. Never split history retroactively.

G5. USER CUSTOM EXERCISES
  - `origin='user'`, `owner_id` set, slug prefixed `u_{shortOwnerHash}__{slug}`
    so two users' "My Curl" never collide in a global unique index.
  - On creation, run G3 scoring against the catalog. If score >= 0.88, show
    "This looks like **Bench Press (Barbell)** — use that instead?" with a
    one-tap adopt that migrates zero history (nothing logged yet).
  - Promotion path: if >500 users create ~the same custom exercise, it enters
    the catalog review queue. When promoted, each user's custom row gets a
    merge record pointing to the new canonical id.

G6. CATALOG VERSIONING AND DELIVERY
  - `catalog_version` integer, bumped on every content release.
  - Client stores the catalog locally (SQLite / IndexedDB), fetches
    `GET /catalog/delta?since={version}` returning
    `{ version, upserts: Exercise[], merges: Merge[], deprecations: id[] }`.
  - ETag + gzip. Full catalog at 1,190 exercises with group weights and aliases
    is ~1.1 MB JSON, ~180 KB gzipped — ship it in the bundle for cold start.
  - Animations are NOT in the catalog payload; `demoAssetId` resolves to a CDN
    URL, lazy-loaded, cached on disk.
  - A deprecated exercise stays selectable in history views but is hidden from
    the add-exercise picker (`status='deprecated'`).

G7. LEGAL / SOURCING NOTE ON THE SEED AND THE ANIMATIONS
  - free-exercise-db is **Unlicense (public domain)** — 876 exercises + images,
    safe to ingest and modify. Use it as the seed for names, muscle mappings,
    force/mechanic, and instructions, then normalize through the generator.
  - ExerciseDB is **AGPL-3.0** — viral; do NOT link its code or redistribute its
    data in a closed app.
  - ExerciseGymGifsDB's 1,323 GIFs are self-described as scraped from the
    internet with rights retained by original authors — **do not ship these.**
  - The 552 animations must be produced in-house. Recommended: author them as
    2D rigged SVG/Lottie loops (one rig, per-movement keyframes) rather than
    raster GIFs — ~25 KB each vs ~400 KB, they recolor for dark/light theme,
    and they stay sharp on any density. 552 × 25 KB = 13.8 MB total, fully
    cacheable, versus ~220 MB of GIFs.

================================================================================
PART H — WORLD STANDINGS MAPPING (how the taxonomy feeds that tab)
================================================================================

Only ~287 exercises have published population standards (StrengthLevel, built on
195,513,376 lifts from 27,893,268 users, 46,245,785 qualifying results as of
March 2026, tiers: Beginner=stronger than 5%, Novice=20%, Intermediate=50%,
Advanced=80%, Elite=95%). The other ~900 exercises get standards by PROXY:

```ts
standardsRef?: { parentId: string; ratio: number }
// Incline Bench Press (Barbell) -> { parentId: 'bench-press--barbell', ratio: 0.80 }
// Close Grip Bench Press        -> { parentId: 'bench-press--barbell', ratio: 0.88 }
// Front Squat (Barbell)         -> { parentId: 'back-squat--barbell',  ratio: 0.85 }
// Romanian Deadlift (Barbell)   -> { parentId: 'deadlift--barbell',    ratio: 0.75 }
```
Per-MUSCLE-GROUP standing = volume-weighted best e1RM across that group's
exercises, normalized by the `groupWeights` vector and bodyweight, then mapped
to the 5 tiers. This is what makes "your quadriceps are Intermediate, your
triceps are Advanced" computable from the same taxonomy — no extra data model.
Note for the e1RM engine: the 2026 weight-dependent equation
`1RM = w × (1 + (r-1)^0.85 / (-2.55 + 4.58·ln(w)))` (arXiv 2603.17495, fit on
303,494 near-failure sets across 388 exercises) reduced inconsistency 17-22% vs
Epley/Brzycki and matters most for LIGHT exercises — i.e. exactly the isolation
long tail this taxonomy is full of. Use it instead of Epley.

Taxonomy TypeScript types written to: C:\temp\stronger-taxonomy\taxonomy.ts

## Risks

- Shipping 1,190 exercises without the 552 animations is worse than shipping 400 with all of them — an exercise picker with missing demos reads as broken; gate Tier 2 catalog rows behind their animation being authored.
