# Stronger 2.0 — Strength Standards, Per-Muscle World Classification, and Rank Ladder System

## Summary

The whole world-standings feature rests on one insight I verified: every credible standards provider (Strength Level, Gravitus) anchors its five named levels to fixed population percentiles — Beginner = 5th, Novice = 20th, Intermediate = 50th, Advanced = 80th, Elite = 95th. That means the tables are not arbitrary tiers; they are five quantiles of a per-exercise, per-sex, per-bodyweight distribution. So the correct engineering move is to stop treating them as buckets and instead fit a continuous monotone curve through the five (load, z-score) anchor points. Every lift then yields a z-score, and everything downstream — percentile, points, rank, muscle classification — is a deterministic function of z. I collected real anchor tables in kg for 20 exercises (full 50–140 kg male / 40–120 kg female grids for bench, squat, deadlift, OHP, row; 5-point grids for hip thrust, leg press, hack squat, front squat, incline bench, close-grip bench, sumo DL, RDL, lat pulldown, seated row, pull-up, chin-up, dip, Bulgarian split squat, leg extension, leg curl, seated calf raise, barbell curl, tricep pushdown, lateral raise, DB bench, DB shoulder press, shrug).

Critical warning that will make or break credibility: the reference population matters enormously. Strength Level's median male bench at 85 kg BW is 104 kg (1.22×BW); the OpenPowerlifting competition median at 83 kg is 125 kg (1.51×BW); ExRx/Rippetoe-style prescriptive standards say "Intermediate = 1.5×BW". Same word, wildly different numbers. Pick one default (gym population), label it in the UI, and offer a "vs. competitive powerlifters" toggle.

Second rigor point, backed by Montenegro et al. 2026 (Sports Med Open, n=101,898): linear bodyweight multipliers are physiologically wrong. The 99th-percentile male deadlift multiplier falls from 4.37× at 59 kg to 2.65× at 120+ kg — and the decay steepens at higher percentiles (β = −0.0150 to −0.0196 per kg). Never ship "2× bodyweight bench = Advanced". The bodyweight-indexed tables already encode this; interpolate them, don't ratio them.

For the per-muscle rollup I designed a latent muscle-strength model: z_exercise ≈ Σ_m w[e][m]·θ_m + ε, solved as a hierarchical Bayesian ridge regression with a global user term. This is the correct structure because it handles overlapping muscle contributions, propagates uncertainty (so you never label a muscle you have no evidence for), and automatically shrinks unmeasured muscles toward the user's overall level.

The rank ladder is S = 36 + 18z, with 15-point bands and three 5-point sub-tiers each. That exactly reproduces the reference screenshot: score 27 → Novice II, Novice III at 31.0.

## Findings

### All major standards providers anchor named levels to identical fixed percentiles — this is the key to the whole system

Strength Level states explicitly: Beginner = stronger than 5% of lifters, Novice = 20%, Intermediate = 50%, Advanced = 80%, Elite = 95%. Gravitus (independent dataset, 10M workouts / 300k lifters) uses the exact same five anchors. This means the five published numbers per (exercise, sex, bodyweight) ARE the 5th/20th/50th/80th/95th percentiles of a distribution. Do not treat them as buckets — fit a monotone curve through the five (ln load, z) pairs where z = {-1.6449, -0.8416, 0, +0.8416, +1.6449} and you get a continuous percentile for any load.

Source: https://strengthlevel.com/about and https://gravitus.com/strength-standards/

### Strength Level 2026 dataset scale and methodology

195,513,376 lifts from 27,893,268 users across 287 exercises. Standards built from filtered calculator submissions (excluding unrealistic lifts, automated entries, unusual submission patterns), converted to estimated 1RMs, with joint modelling of lift weight against bodyweight for exact-bodyweight (not weight-class) scoring. Age-adjusted since 2016 using ages 25–40 as the adult baseline. First full refresh since 2022. Body Standards component drew 145,356 qualifying results from 717,401 community measurements.

Source: https://strengthlevel.com/about

### Linear bodyweight multipliers are physiologically invalid — peer-reviewed, with exact decay coefficients

Montenegro S, Wicker P, Wiedenmann T, Rappelt L, Donath L. 'Percentile-Based Normative Standards for Strength Assessment Beyond Linear Bodyweight Multipliers in Competitive Powerlifters.' Sports Medicine - Open 2026;12:136. n=101,898 unique athletes (67,789 M / 34,109 F), aged 21–49, drug-tested classic powerlifting 2015–Mar 2026. Quantile regression at 50/75/90/99th percentiles. β coefficients (absolute reduction in BW-multiple per +1 kg bodyweight): male deadlift −0.0150 to −0.0196; male squat −0.0092 to −0.0125; male bench −0.0059 to −0.0091; female squat −0.0111 to −0.0136 (steeper than males). All p<0.001. Decay STEEPENS at higher percentiles. Male 99th-percentile deadlift multiplier: 4.37× at 59 kg falling to 2.65× at 120+ kg (−1.72× over 61 kg). Root cause: square-cube law — muscle cross-sectional area scales as L² while mass scales as L³.

Source: https://link.springer.com/article/10.1186/s40798-026-01111-z

### Reference population choice changes 'Intermediate' by 25–30% — must be surfaced in UI

Same label, three very different numbers for an ~83–85 kg man's bench press: Strength Level (gym app users) Intermediate = 104 kg = 1.22×BW. OpenPowerlifting competition median = 276 lb = 125 kg = 1.51×BW. ExRx/Rippetoe prescriptive standard Intermediate = 1.5×BW. Competitive-lifter medians sit roughly at the gym population's Advanced level. If Stronger 2.0 silently picks the competition dataset, most users will be told they are Beginners and churn.

Source: https://strengthlevel.com/strength-standards/male/kg vs https://fitnessvolt.com/strength-standards/research/powerlifting-strength-percentiles/

### Symmetric Strength's architecture: 5 movement categories, weighted-average muscle scores, Wilks-derived normalisation

Single-lift score definition, verbatim: 'if the lifter were as strong in the performed lift as he or she were in all other lifts, then the score of the lift is equal to 1/4 of the lifter's hypothetical powerlifting Wilks, in addition to an age adjustment if the lifter is younger than 23 or older than 40.' Total = average of the highest score in each of 5 categories: squat, floor pull, horizontal press, vertical press, pull-up. Muscle group score = 'a weighted average of the lifts which involve that muscle group'. Age adjustment derived from Foster coefficients (under 23) and revised McCulloch coefficients (over 40), fitted as quadratic functions. Tier scale: Untrained 30, Novice 45, Intermediate 60, Proficient 75, Advanced 87.5, Exceptional 100, Elite 112.5, World Class 125. Score 100 is 'close to the limit attainable without PEDs' after 5–10 years; score 75 = 'strong by most people', 2–3 years.

Source: https://symmetricstrength.com/about

### Exact powerlifting scoring coefficients, verified from primary/canonical sources

DOTS: points = Total_kg × 500 / (a·bw⁴ + b·bw³ + c·bw² + d·bw + e). Men a=-0.000001093, b=0.0007391293, c=-0.1918759221, d=24.0900756, e=-307.75076. Women a=-0.0000010706, b=0.0005158568, c=-0.1126655495, d=13.6175032, e=-57.96288. Wilks 1994: coeff = 500/(a+bx+cx²+dx³+ex⁴+fx⁵); men a=-216.0475144, b=16.2606339, c=-0.002388645, d=-0.00113732, e=7.01863e-6, f=-1.291e-8; women a=594.31747775582, b=-27.23842536447, c=0.82112226871, d=-0.00930733913, e=4.731582e-5, f=-9.054e-8. Wilks-2020: coeff = 600/(...); men a=47.46178854, b=8.472061379, c=0.07369410346, d=-0.001395833811, e=7.07665973070743e-6, f=-1.20804336482315e-8; women a=-125.4255398, b=13.71219419, c=-0.03307250631, d=-0.001050400051, e=9.38773881462799e-6, f=-2.3334613884954e-8. IPF GL: points = Total × 100/(A − B·e^(−C·bw)); full precision from the OpenPowerlifting reference implementation — SBD Male Raw (1199.72839, 1025.18162, 0.009210), SBD Male Single-ply (1236.25115, 1449.21864, 0.01644), SBD Female Raw (610.32796, 1045.59282, 0.03048), SBD Female Single-ply (758.63878, 949.31382, 0.02435), Bench Male Raw (320.98041, 281.40258, 0.01008), Bench Male Single-ply (381.22073, 733.79378, 0.02398), Bench Female Raw (142.40398, 442.52671, 0.04724), Bench Female Single-ply (221.82209, 357.00377, 0.02937). Sinclair: 10^(A·(log10(x/b))²) for x<b else 1.0; 2017–2020 men A=0.751945030 b=175.508 kg, women A=0.783497476 b=153.655 kg; 2021–2024 men A=0.722762521 b=193.609 kg, women A=0.787004341 b=153.757 kg. 2025–2028 coefficients still being recalibrated after the mid-2025 weight-class change.

Source: https://en.wikipedia.org/wiki/Wilks_coefficient, https://github.com/sstangl/openpowerlifting crates/coefficients/src/goodlift.rs, https://www.powerlifting.sport/fileadmin/ipf/data/ipf-formula/IPF_GL_Coefficients-2020.pdf

### Foster (youth) and McCulloch (masters) age coefficients — and a clean quadratic fit for both

Foster, age→coeff: 14→1.23, 15→1.18, 16→1.13, 17→1.08, 18→1.06, 19→1.04, 20→1.03, 21→1.02, 22→1.01, 23→1.00. McCulloch: 40→1.000, 41→1.010, 42→1.020, 43→1.031, 44→1.043, 45→1.055, 46→1.068, 47→1.082, 48→1.097, 49→1.113, 50→1.130, 51→1.147, 52→1.165, 53→1.184, 54→1.204, 55→1.225, 56→1.246, 57→1.268, 58→1.291, 59→1.315, 60→1.340, 66→1.511, 67→1.543, 68→1.576, 69→1.610, 70→1.645, 75→1.835, 80→2.050, 83→2.190. I fitted C_masters(a) = 1 + 0.0085833·(a−40) + 0.00044167·(a−40)² — reproduces age 66 as 1.5217 vs actual 1.511 and age 80 as 2.050 exactly. Youth fit: C_youth(a) = 1 − 0.002444·d + 0.003111·d² where d = 23 − a; reproduces age 16 as 1.1353 vs 1.13.

Source: https://www.usapowerlifting.com/wp-content/uploads/2021/01/USAPL-Age-Coefficients.pdf

### Peer-reviewed age×sex×weight-class normative powerlifting data, n=809,986

van den Hoek DJ, Beaumont PL, van den Hoek AK, Owen PJ, Garrett JM, Buhmann R, Latella C. 'Normative data for the squat, bench press and deadlift exercises in powerlifting: Data from 809,986 competition entries.' Journal of Science and Medicine in Sport 2024;27(10):734-742. DOI 10.1016/j.jsams.2024.07.005. 571,650 males / 238,336 females, drug-tested unequipped competitions, stratified by UN age classification and IPF weight class, 10th–90th percentile. Relative strength peaks at 18–35 y: 90th percentile squat male 2.83×BW / female 2.26×BW; bench 1.95 / 1.35; deadlift 3.25 / 2.66; declining thereafter for all three lifts. Companion public tool at thestrengthinitiative.com. First published normative values for the deadlift.

Source: https://www.jsams.org/article/S1440-2440(24)00246-9/fulltext

### OpenPowerlifting competition percentiles by weight class (for the optional 'vs competitors' mode)

Men raw squat 50th/90th/95th pct: 66 kg → 336/430/463 lb (2.31/2.95/3.18×); 74 kg → 375/474/502 lb; 83 kg → 408/513/540 lb; 93 kg → 441/551/579 lb; 105 kg → 468/584/617 lb; 120 kg → 502/628/667 lb. Men raw bench: 66 kg → 220/292/314 lb (1.52/2.01/2.16×); 83 kg → 276/347/369; 105 kg → 320/402/430; 120 kg → 342/435/463. Men raw deadlift: 66 kg → 408/507/535 lb (2.80/3.48/3.67×); 83 kg → 480/584/617; 105 kg → 529/639/672; 120 kg → 551/667/705. Women raw squat: 52 kg → 204/270/292 lb (1.78/2.36/2.55×); 63 kg → 237/309/331; 76 kg → 281/364/391. Women raw bench: 52 kg → 116/160/176 lb (1.01/1.39/1.54×); 63 kg → 132/182/198; 76 kg → 154/209/231. Women raw deadlift: 52 kg → 254/326/347 lb (2.21/2.85/3.03×); 63 kg → 292/364/386; 76 kg → 331/408/437. Sample sizes 139k–419k lifts per lift/sex.

Source: https://fitnessvolt.com/strength-standards/research/powerlifting-strength-percentiles/

### The canonical RTS/Tuchscherer RPE→%1RM table — use it when the RPE column is filled

Reps × RPE10/9.5/9/8.5/8/7.5/7/6.5/6 as % of 1RM. 1: 100/98/96/94/92/90.5/89/87.5/86. 2: 95/93.5/92/90.5/89/87.5/86/84.5/83. 3: 92/90.5/89/87.5/86/85/84/82.5/81. 4: 89/87.5/86/85/84/82.5/81/80/79. 5: 86/85/84/82.5/81/80/79/77.5/76. 6: 84/82.5/81/80/79/77.5/76/75/74. 7: 81/80/79/77.5/76/75/74/73/72. 8: 79/77.5/76/75/74/73/72/70.5/69. 9: 76/75/74/73/72/70.5/69/68/67. 10: 74/73/72/70.5/69/68/67/66/65. Beware: many sites publish a naive linear 2.5%-per-step chart (1@10=100, 5@8=80) — that is NOT the RTS chart and overestimates 1RM from high-rep sets.

Source: https://www.strongermobileapp.com/blog/rpe-chart

### Best-in-class e1RM formula, derived from 303,494 near-failure app sets across 388 exercises

Marzagao T. 'A Weight-Dependent 1RM Prediction Equation Optimized on 303,494 Near-Failure Sets Across 388 Exercises.' arXiv:2603.17495. Equation: 1RM = w · (1 + (r−1)^0.85 / (−2.55 + 4.58·ln w)). The conversion factor varies logarithmically with load rather than being fixed. 14,966 users, 16 muscle groups. Optimized against an internal-consistency criterion (do different weight/rep combos from the same person/exercise/time window yield the same 1RM). Reduced inconsistency by 17–22% vs four classical benchmarks, with the improvement positive for every one of the 183 exercises with sufficient data. Note w must be in the paper's units — validate against known 1RMs before shipping, and note it degrades for very light loads (ln w near 0.557 → singularity at w≈1.74). Classical alternatives: Epley w(1+0.0333r), Brzycki w·36/(37−r), Wathan 100w/(48.8+53.8e^(−0.075r)), Lombardi w·r^0.1, O'Conner w(1+0.025r), Lander 100w/(101.3−2.67123r).

Source: https://arxiv.org/abs/2603.17495

### The existing 'Stronger' app already uses six tiers incl. World Class, from OpenPowerlifting

1,668,369 verified competition lifts across 556,880 lifters, updated Sept 2026, drug-tested and untested pooled. Six levels: Beginner, Novice, Intermediate, Advanced, Elite, World Class. Men's median competition bench 281 lb, women's 127 lb. Men's bench table by BW bracket (Beginner/Novice/Intermediate/Advanced/Elite/World Class in kg): <65 kg 20/40/55/75/95/120; 65–75 20/50/65/85/110/135; 75–85 20/55/75/95/120/150; 85–95 20/60/80/105/130/160; 95–105 20/65/85/110/140/170; 105–115 20/70/90/115/145/175; 115–125 20/75/95/120/150/180; 125+ 20/80/100/125/155/185. Women's: <55 kg 20/23/30/40/55/70; 55–65 20/25/35/50/65/80; 65–75 20/30/40/55/70/90; 75–85 20/30/45/60/75/95; 85–95 20/35/50/65/80/100; 95–105 20/35/50/65/85/105; 105+ 20/40/55/70/90/110. Note the crude 20 kg floor and 5 kg quantisation — Stronger 2.0 should beat this with continuous interpolation.

Source: https://www.strongermobileapp.com/standards/bench-press

### The 5-anchor distribution is NOT lognormal — it is left-skewed in log space, so fit a spline not a parametric curve

Worked example, male bench at 80 kg BW (56/75/98/124/151 kg). Implied σ in log space from each anchor pair: from the 5th pct (ln98−ln56)/1.6449 = 0.3405; from the 20th (ln98−ln75)/0.8416 = 0.3185; from the 80th (ln124−ln98)/0.8416 = 0.2792; from the 95th (ln151−ln98)/1.6449 = 0.2626. σ falls monotonically from 0.34 to 0.26 as you move up the distribution — a single lognormal would misplace an Elite lifter by roughly a third of a tier. Fix: monotone PCHIP (Fritsch–Carlson) interpolation through the five (ln load, z) points with linear extrapolation from the end slopes. This reproduces the published tables exactly and generalises smoothly.

Source: Derived from https://strengthlevel.com/strength-standards/male/kg

### Bodyweight-exercise standards are published as ADDED weight, and can be negative

Pull-up and dip standards are 'assistance weight (negative) or added weight via belt (positive)'. Male pull-up at 80 kg BW: −2/+14/+33/+54/+75 kg. Female at 60 kg BW: −16/−4/+9/+23/+38 kg. This breaks naive log-space interpolation (ln of a negative is undefined) and breaks any 'total system load' assumption. Fix: convert to total system load T = k·BW + added, where k ≈ 0.93 for pull-up/chin-up/dip (fraction of body mass actually being lifted), then interpolate in ln T. For a 60 kg woman at Beginner: T = 0.93·60 − 16 = 39.8 kg, which is positive and well-behaved.

Source: https://strengthlevel.com/strength-standards/pull-ups/kg and /dips/kg

### Dumbbell standards are PER DUMBBELL and include the ~2 kg handle

Strength Level states verbatim: 'Dumbbell weights are for one dumbbell and include the weight of the bar, normally 2 kg / 4.4 lb.' Male DB bench at 80 kg BW: 19/28/40/53/68 kg per dumbbell. Male DB shoulder press at 80 kg: 15/22/31/42/54 kg per dumbbell. If the app logs total load (both dumbbells) — which Hevy and Strong do NOT, they log per-dumbbell — the comparison will be 2× wrong. Store a perSide boolean on every exercise definition and normalise before scoring.

Source: https://strengthlevel.com/strength-standards/dumbbell-bench-press/kg

### EMG %MVC data gives a defensible prior for muscle contribution weights, but is NOT the contribution weight itself

Bench press: pectoralis major up to 95% MVC, anterior deltoid 79%, triceps 67%. Squat ascent: quadriceps up to 74% MVC, glutes 52%, hamstrings 43%. But EMG amplitude measures activation, not how much the muscle limits the load. Erectors fire hard in a squat as stabilisers yet rarely cap the lift. Use EMG-normalised shares as the Bayesian prior for the contribution matrix W, then refit W from the app's own data via factor analysis once ~50k users have multi-exercise histories. This is a real moat — nobody else has per-user cross-exercise data at that scale.

Source: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7579505/ and https://www.jefit.com/blog/best-exercises-for-each-major-muscle-group-backed-emg-data

## Recommendations

- Store the five published level values per (exercise, sex, bodyweight) as percentile anchors at z = {-1.6449, -0.8416, 0, +0.8416, +1.6449} and fit a monotone PCHIP spline in (ln load, z) — never bucket a user into a tier by table lookup.
- Ship S = 36 + 18·z as the single scoring primitive, with 15-point bands and three 5-point sub-tiers, which exactly reproduces the reference screenshot (score 27 → Novice II, Novice III at 31.0).
- Default the reference population to gym-app lifters (Strength Level / Gravitus style) and label it visibly as 'vs. 27M app lifters', with a toggle for 'vs. competitive powerlifters' (OpenPowerlifting) so the numbers are never silently misleading.
- Never display or compute a fixed bodyweight multiplier as a standard — interpolate the bodyweight-indexed tables, because the 99th-percentile male deadlift multiplier legitimately drops from 4.37× at 59 kg to 2.65× at 120 kg.
- Solve per-muscle scores as a hierarchical Bayesian ridge regression z_e ≈ Σ_m w[e][m]·θ_m + ε with a global user term, so unmeasured muscles inherit the user's overall level instead of defaulting to 'Intermediate'.
- Divide the weighted-mean pattern z by sqrt(wᵀRw) before converting to a percentile — the lifts are correlated at ρ ≈ 0.6–0.85, and skipping this correction compresses everyone toward the 50th percentile and makes 'Top 80%' wrong.
- Gate every tier label behind a posterior SD threshold (show a range, not a label, until SD < 0.35 z ≈ one sub-tier) and render a 'Calibrating — 2 more sessions' state for new users.
- Require at least two distinct sessions and use the second-highest qualifying e1RM (not the max) for any exercise with three or more qualifying sets, so a single fluke or mis-typed set can never move a classification.
- Convert bodyweight exercises to total system load T = 0.93·BW + added before scoring, because published pull-up/dip standards are added weight and go negative.
- Store perSide and includesImplementWeight flags on every exercise definition and normalise dumbbell loads before comparison — Strength Level dumbbell standards are per dumbbell and include a 2 kg handle.
- Use the RTS/Tuchscherer table when the RPE column is filled and the Marzagao weight-dependent equation otherwise, and refuse to compute an e1RM from sets above 12 reps or from warm-up / drop-set / myo-rep continuation segments.
- Implement age adjustment as two visible modes — 'Age-graded' (divide the reference by the Foster/McCulloch quadratic) and 'Open class' (unadjusted) — and default to age-graded for users under 23 or over 40.
- Apply a time-decay to stale e1RMs (inflate τ by (weeks/8)² and shift the mean −0.012 z/week after 4 weeks idle for that pattern) so the world-standings tab reflects current, not historical, strength.
- Bootstrap standards for the long tail of exercises via anchor mapping (standard_e = r_e × standard_anchor) with literature priors for r_e, then refit r_e from the median paired e1RM ratio among users who log both exercises.

## Data

## PART 1 — STANDARDS TABLES (JSON)

Levels are percentile anchors, identical across Strength Level and Gravitus:
`beginner = P5, novice = P20, intermediate = P50, advanced = P80, elite = P95`.
All loads in **kg**, all bodyweights in **kg**. Source: strengthlevel.com 2026 refresh (195,513,376 lifts / 27,893,268 users).

```json
{
  "meta": {
    "version": "2026.09",
    "referencePopulation": "gym_app_lifters",
    "source": "strengthlevel.com 2026 standards refresh",
    "sourceUrl": "https://strengthlevel.com/strength-standards",
    "unit": "kg",
    "ageBaseline": [25, 40],
    "levelPercentiles": { "beginner": 0.05, "novice": 0.20, "intermediate": 0.50, "advanced": 0.80, "elite": 0.95 },
    "levelZ": { "beginner": -1.6449, "novice": -0.8416, "intermediate": 0.0, "advanced": 0.8416, "elite": 1.6449 }
  },

  "exercises": {

    "bench_press": {
      "name": "Barbell Bench Press", "loadType": "external", "perSide": false, "pattern": "horizontal_press",
      "male": {
        "bw":           [ 50, 55, 60, 65, 70, 75, 80, 85, 90, 95,100,105,110,115,120,125,130,135,140],
        "beginner":     [ 27, 32, 37, 42, 47, 51, 56, 60, 65, 69, 73, 77, 81, 85, 89, 93, 97,100,104],
        "novice":       [ 41, 47, 53, 59, 64, 70, 75, 80, 85, 90, 95, 99,104,108,113,117,121,125,129],
        "intermediate": [ 58, 65, 72, 79, 85, 92, 98,104,109,115,120,125,131,135,140,145,150,154,158],
        "advanced":     [ 78, 87, 95,102,110,117,124,130,137,143,149,155,160,166,171,176,181,186,191],
        "elite":        [101,110,119,128,136,144,151,158,165,172,179,185,191,197,203,209,214,220,225]
      },
      "female": {
        "bw":           [ 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95,100,105,110,115,120],
        "beginner":     [ 10, 12, 14, 17, 19, 21, 22, 24, 26, 28, 30, 31, 33, 35, 36, 38, 39],
        "novice":       [ 19, 22, 25, 28, 31, 33, 36, 38, 40, 43, 45, 47, 49, 51, 53, 54, 56],
        "intermediate": [ 33, 36, 40, 44, 47, 50, 53, 56, 59, 61, 64, 66, 69, 71, 73, 75, 77],
        "advanced":     [ 49, 54, 58, 62, 66, 70, 74, 77, 80, 83, 86, 89, 92, 94, 97, 99,102],
        "elite":        [ 68, 74, 79, 84, 88, 92, 96,100,104,107,111,114,117,120,123,126,128]
      }
    },

    "back_squat": {
      "name": "Barbell Back Squat", "loadType": "external", "perSide": false, "pattern": "squat",
      "male": {
        "bw":           [ 50, 55, 60, 65, 70, 75, 80, 85, 90, 95,100,105,110,115,120,125,130,135,140],
        "beginner":     [ 36, 43, 49, 56, 62, 69, 75, 81, 87, 93, 98,104,109,115,120,125,130,135,140],
        "novice":       [ 55, 63, 71, 79, 86, 94,101,108,115,121,128,134,140,147,152,158,164,169,175],
        "intermediate": [ 78, 88, 98,107,116,124,132,140,148,156,163,170,177,184,191,197,203,209,215],
        "advanced":     [106,118,129,139,149,159,168,177,186,194,203,211,218,226,233,240,247,254,261],
        "elite":        [137,150,162,174,185,196,206,216,226,235,244,253,261,270,278,285,293,300,307]
      },
      "female": {
        "bw":           [ 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95,100,105,110,115,120],
        "beginner":     [ 19, 23, 26, 29, 32, 35, 37, 40, 42, 45, 47, 49, 52, 54, 56, 58, 60],
        "novice":       [ 34, 38, 42, 46, 49, 53, 56, 59, 62, 65, 68, 71, 74, 76, 79, 81, 83],
        "intermediate": [ 53, 58, 63, 68, 72, 76, 80, 84, 88, 91, 94, 98,101,104,107,109,112],
        "advanced":     [ 76, 82, 88, 94, 99,104,109,113,117,121,125,129,132,136,139,142,145],
        "elite":        [102,110,116,123,129,134,140,145,149,154,158,162,166,170,174,177,181]
      }
    },

    "deadlift": {
      "name": "Barbell Deadlift (conventional)", "loadType": "external", "perSide": false, "pattern": "hinge",
      "male": {
        "bw":           [ 50, 55, 60, 65, 70, 75, 80, 85, 90, 95,100,105,110,115,120,125,130,135,140],
        "beginner":     [ 46, 54, 61, 68, 75, 82, 89, 96,102,108,114,120,126,132,137,143,148,153,159],
        "novice":       [ 68, 77, 86, 95,103,111,119,127,134,141,148,155,161,168,174,180,186,192,198],
        "intermediate": [ 96,107,117,127,137,146,155,164,172,180,188,195,203,210,217,224,231,237,243],
        "advanced":     [129,141,153,164,175,186,196,205,215,224,232,241,249,257,265,272,280,287,294],
        "elite":        [164,178,191,204,216,228,239,250,260,270,279,289,298,306,315,323,331,339,346]
      },
      "female": {
        "bw":           [ 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95,100,105,110,115,120],
        "beginner":     [ 26, 30, 34, 37, 40, 43, 46, 49, 52, 54, 57, 59, 61, 64, 66, 68, 70],
        "novice":       [ 43, 48, 52, 56, 60, 64, 68, 71, 74, 77, 80, 83, 86, 89, 91, 94, 96],
        "intermediate": [ 65, 71, 76, 81, 86, 90, 95, 99,102,106,109,113,116,119,122,125,128],
        "advanced":     [ 92, 99,105,111,116,121,126,131,135,139,143,147,151,154,158,161,164],
        "elite":        [121,129,136,143,149,155,160,166,170,175,180,184,188,192,196,200,203]
      }
    },

    "overhead_press": {
      "name": "Barbell Overhead / Shoulder Press", "loadType": "external", "perSide": false, "pattern": "vertical_press",
      "male": {
        "bw":           [ 50, 55, 60, 65, 70, 75, 80, 85, 90, 95,100,105,110,115,120,125,130,135,140],
        "beginner":     [ 15, 18, 21, 24, 27, 30, 33, 36, 38, 41, 44, 47, 49, 52, 54, 56, 59, 61, 63],
        "novice":       [ 24, 28, 32, 35, 39, 43, 46, 49, 53, 56, 59, 62, 65, 68, 71, 73, 76, 79, 81],
        "intermediate": [ 36, 41, 45, 50, 54, 58, 62, 66, 70, 74, 77, 81, 84, 87, 90, 94, 97,100,102],
        "advanced":     [ 51, 56, 62, 67, 72, 76, 81, 85, 90, 94, 98,102,105,109,113,116,119,123,126],
        "elite":        [ 67, 73, 79, 85, 90, 96,101,106,111,115,120,124,128,132,136,140,144,147,151]
      },
      "female": {
        "bw":           [ 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95,100,105,110,115,120],
        "beginner":     [  7,  9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 24],
        "novice":       [ 13, 15, 17, 19, 20, 22, 23, 25, 26, 27, 28, 30, 31, 32, 33, 34, 35],
        "intermediate": [ 22, 24, 27, 29, 31, 32, 34, 36, 37, 39, 40, 42, 43, 45, 46, 47, 48],
        "advanced":     [ 33, 36, 38, 41, 43, 45, 47, 49, 51, 53, 54, 56, 58, 59, 61, 62, 64],
        "elite":        [ 45, 48, 51, 54, 57, 59, 62, 64, 66, 68, 70, 72, 74, 75, 77, 79, 80]
      }
    },

    "barbell_row": {
      "name": "Barbell Bent Over Row", "loadType": "external", "perSide": false, "pattern": "horizontal_pull",
      "male": {
        "bw":           [ 50, 55, 60, 65, 70, 75, 80, 85, 90, 95,100,105,110,115,120,125,130,135,140],
        "beginner":     [ 23, 27, 31, 36, 40, 44, 48, 52, 56, 59, 63, 67, 70, 74, 77, 80, 84, 87, 90],
        "novice":       [ 36, 41, 46, 51, 56, 61, 66, 71, 75, 79, 84, 88, 92, 96,100,103,107,111,114],
        "intermediate": [ 52, 59, 65, 71, 77, 83, 88, 93, 99,104,108,113,118,122,127,131,135,139,143],
        "advanced":     [ 72, 80, 87, 94,101,107,114,120,125,131,136,142,147,152,157,161,166,170,175],
        "elite":        [ 94,103,111,119,127,134,141,147,154,160,166,172,178,183,188,194,199,203,208]
      },
      "female": {
        "bw":           [ 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95,100,105,110,115,120],
        "beginner":     [ 12, 14, 15, 17, 18, 19, 20, 22, 23, 24, 25, 26, 27, 28, 29, 29, 30],
        "novice":       [ 21, 23, 25, 27, 29, 30, 32, 33, 35, 36, 37, 38, 40, 41, 42, 43, 44],
        "intermediate": [ 33, 36, 38, 41, 43, 44, 46, 48, 50, 51, 53, 54, 56, 57, 58, 60, 61],
        "advanced":     [ 48, 51, 54, 57, 59, 62, 64, 66, 68, 69, 71, 73, 74, 76, 78, 79, 80],
        "elite":        [ 65, 69, 72, 75, 78, 80, 83, 85, 87, 89, 91, 93, 95, 97, 99,100,102]
      }
    },

    "front_squat": {
      "name": "Barbell Front Squat", "loadType": "external", "perSide": false, "pattern": "squat",
      "male":   { "bw": [60,70,80,90,100], "beginner":[40,50,59,68,76], "novice":[57,69,79,90,99],  "intermediate":[79,92,104,116,127], "advanced":[104,119,133,146,158], "elite":[130,147,163,177,190] },
      "female": { "bw": [50,60,70,80],     "beginner":[26,31,35,38],    "novice":[39,44,48,53],      "intermediate":[54,60,65,70],       "advanced":[72,79,85,90],          "elite":[91,99,106,112] }
    },

    "hack_squat": {
      "name": "Machine Hack Squat", "loadType": "external_machine", "perSide": false, "pattern": "squat", "machineVariance": "high",
      "male":   { "bw":[60,70,80,90,100], "beginner":[41,52,63,74,84], "novice":[73,88,102,115,127], "intermediate":[117,135,152,168,183], "advanced":[171,193,213,232,249], "elite":[231,257,280,302,321] },
      "female": { "bw":[50,60,70,80],     "beginner":[19,24,28,32],    "novice":[43,50,56,62],       "intermediate":[78,87,95,102],        "advanced":[124,135,145,154],      "elite":[176,190,202,212] }
    },

    "leg_press": {
      "name": "Sled Leg Press", "loadType": "external_machine", "perSide": false, "pattern": "squat", "machineVariance": "very_high",
      "male":   { "bw":[60,70,80,90,100], "beginner":[71,90,109,127,144], "novice":[115,139,162,184,205], "intermediate":[173,202,230,255,280], "advanced":[242,277,309,338,366], "elite":[319,359,395,429,460] },
      "female": { "bw":[50,60,70,80],     "beginner":[39,49,58,67],       "novice":[73,87,100,111],       "intermediate":[122,140,155,170],     "advanced":[183,204,223,240],      "elite":[252,277,299,319] }
    },

    "bulgarian_split_squat": {
      "name": "Bulgarian Split Squat", "loadType": "external_total", "perSide": false, "pattern": "squat", "note": "total load incl. ~20kg bar",
      "male":   { "bw":[60,70,80,90,100], "beginner":[10,15,21,26,32], "novice":[25,33,41,48,55], "intermediate":[47,58,68,78,87], "advanced":[77,90,103,115,126], "elite":[112,128,143,157,170] },
      "female": { "bw":[50,60,70,80],     "beginner":[8,10,12,13],     "novice":[18,20,23,25],    "intermediate":[32,36,39,42],    "advanced":[50,55,59,63],        "elite":[72,77,82,87] }
    },

    "hip_thrust": {
      "name": "Barbell Hip Thrust", "loadType": "external", "perSide": false, "pattern": "hinge",
      "male":   { "bw":[60,70,80,90,100], "beginner":[32,44,56,68,80], "novice":[63,80,96,111,126], "intermediate":[107,129,149,168,186], "advanced":[163,189,213,236,257], "elite":[227,257,285,311,335] },
      "female": { "bw":[50,60,70,80],     "beginner":[30,35,39,43],    "novice":[56,63,69,74],      "intermediate":[92,100,108,114],      "advanced":[137,147,155,163],     "elite":[187,199,209,218] }
    },

    "romanian_deadlift": {
      "name": "Romanian Deadlift", "loadType": "external", "perSide": false, "pattern": "hinge",
      "male":   { "bw":[60,70,80,90,100], "beginner":[43,54,65,75,85], "novice":[65,79,92,104,115], "intermediate":[93,110,125,139,152], "advanced":[127,145,163,179,194], "elite":[163,184,203,221,238] },
      "female": { "bw":[50,60,70,80],     "beginner":[27,31,34,37],    "novice":[42,47,51,54],      "intermediate":[61,67,71,75],        "advanced":[84,90,96,100],       "elite":[109,116,122,128] }
    },

    "sumo_deadlift": {
      "name": "Sumo Deadlift", "loadType": "external", "perSide": false, "pattern": "hinge",
      "male":   { "bw":[60,70,80,90,100], "beginner":[72,88,102,116,128], "novice":[100,118,135,150,165], "intermediate":[134,155,174,192,208], "advanced":[174,197,218,238,256], "elite":[216,241,265,287,307] },
      "female": { "bw":[50,60,70,80],     "beginner":[43,47,51,55],       "novice":[62,68,73,77],         "intermediate":[87,93,99,104],        "advanced":[115,122,129,135],     "elite":[146,154,161,168] }
    },

    "incline_bench_press": {
      "name": "Incline Barbell Bench Press", "loadType": "external", "perSide": false, "pattern": "horizontal_press",
      "male":   { "bw":[60,70,80,90,100], "beginner":[32,41,50,58,66], "novice":[45,56,66,76,86], "intermediate":[62,75,87,98,108], "advanced":[82,96,109,122,134], "elite":[103,119,134,147,160] },
      "female": { "bw":[50,60,70,80],     "beginner":[11,14,18,21],    "novice":[20,25,29,34],    "intermediate":[33,39,45,50],     "advanced":[49,56,63,69],       "elite":[67,76,84,91] }
    },

    "close_grip_bench_press": {
      "name": "Close Grip Bench Press", "loadType": "external", "perSide": false, "pattern": "horizontal_press",
      "male":   { "bw":[60,70,80,90,100], "beginner":[35,45,55,64,73], "novice":[49,61,72,83,93], "intermediate":[66,80,93,105,116], "advanced":[86,101,116,129,142], "elite":[107,124,140,155,169] },
      "female": { "bw":[50,60,70,80],     "beginner":[16,20,24,28],    "novice":[26,31,37,41],    "intermediate":[39,46,52,58],      "advanced":[55,63,70,77],       "elite":[72,82,90,97] }
    },

    "dumbbell_bench_press": {
      "name": "Dumbbell Bench Press", "loadType": "external", "perSide": true, "implementWeightKg": 2, "pattern": "horizontal_press",
      "male":   { "bw":[60,70,80,90,100], "beginner":[13,16,19,22,25], "novice":[20,24,28,32,36], "intermediate":[30,35,40,44,48], "advanced":[42,48,53,58,63], "elite":[55,62,68,74,79] },
      "female": { "bw":[50,60,70,80],     "beginner":[5,7,8,9],        "novice":[10,12,14,15],    "intermediate":[16,19,21,23],    "advanced":[25,28,30,33],    "elite":[34,38,41,44] }
    },

    "dumbbell_shoulder_press": {
      "name": "Dumbbell Shoulder Press", "loadType": "external", "perSide": true, "implementWeightKg": 2, "pattern": "vertical_press",
      "male":   { "bw":[60,70,80,90,100], "beginner":[10,12,15,18,20], "novice":[15,19,22,25,28], "intermediate":[23,27,31,35,39], "advanced":[32,37,42,46,50], "elite":[43,48,54,59,63] },
      "female": { "bw":[50,60,70,80],     "beginner":[5,6,7,8],        "novice":[8,10,11,12],     "intermediate":[13,15,16,17],    "advanced":[18,20,22,24],    "elite":[25,27,29,31] }
    },

    "lat_pulldown": {
      "name": "Lat Pulldown", "loadType": "external_machine", "perSide": false, "pattern": "vertical_pull", "machineVariance": "medium",
      "male":   { "bw":[60,70,80,90,100], "beginner":[35,42,47,52,57], "novice":[50,57,64,70,76], "intermediate":[69,77,85,92,98], "advanced":[90,99,108,116,123], "elite":[113,123,133,142,150] },
      "female": { "bw":[50,60,70,80],     "beginner":[20,23,25,27],    "novice":[30,33,36,38],    "intermediate":[42,46,49,52],    "advanced":[56,60,64,68],       "elite":[72,76,81,85] }
    },

    "seated_cable_row": {
      "name": "Seated Cable Row", "loadType": "external_machine", "perSide": false, "pattern": "horizontal_pull", "machineVariance": "medium",
      "male":   { "bw":[60,70,80,90,100], "beginner":[33,40,47,53,59], "novice":[49,57,65,72,79], "intermediate":[68,78,87,96,104], "advanced":[90,102,112,122,131], "elite":[115,128,140,150,160] },
      "female": { "bw":[50,60,70,80],     "beginner":[18,21,24,26],    "novice":[28,32,35,38],    "intermediate":[41,45,50,53],     "advanced":[56,62,66,71],        "elite":[73,79,85,89] }
    },

    "pull_up": {
      "name": "Pull-Up (pronated)", "loadType": "added_bodyweight", "bodyweightFraction": 0.93, "pattern": "vertical_pull",
      "male":   { "bw":[50,60,70,80,90,100], "beginner":[-5,-4,-2,-2,-2,-3], "novice":[7,11,13,14,15,15], "intermediate":[22,27,31,33,35,36], "advanced":[39,45,50,54,57,59], "elite":[56,64,71,75,79,82] },
      "female": { "bw":[40,50,60,70,80],    "beginner":[-14,-14,-16,-18,-20], "novice":[-5,-4,-4,-5,-7], "intermediate":[6,8,9,9,8],        "advanced":[17,21,23,24,24],   "elite":[30,35,38,40,41] }
    },

    "chin_up": {
      "name": "Chin-Up (supinated)", "loadType": "added_bodyweight", "bodyweightFraction": 0.93, "pattern": "vertical_pull",
      "male":   { "bw":[60,70,80,90,100], "beginner":[-2,-1,0,0,-1], "novice":[12,14,16,17,17], "intermediate":[28,32,34,36,37], "advanced":[46,50,54,57,59], "elite":[64,70,75,79,81] },
      "female": { "bw":[50,60,70,80],     "beginner":[-10,-10,-11,-13], "novice":[-1,-1,-1,-2], "intermediate":[8,10,10,10],    "advanced":[19,21,23,23],   "elite":[30,33,35,36] }
    },

    "dip": {
      "name": "Dip (chest/triceps)", "loadType": "added_bodyweight", "bodyweightFraction": 0.93, "pattern": "horizontal_press",
      "male":   { "bw":[60,70,80,90,100], "beginner":[-1,2,5,6,8], "novice":[17,22,26,30,32], "intermediate":[39,46,52,57,61], "advanced":[64,73,81,87,92], "elite":[91,101,111,118,125] },
      "female": { "bw":[50,60,70,80],     "beginner":[-15,-15,-16,-17], "novice":[-2,0,0,0], "intermediate":[14,17,19,20],    "advanced":[32,37,40,42],   "elite":[52,58,62,66] }
    },

    "leg_extension": {
      "name": "Leg Extension", "loadType": "external_machine", "perSide": false, "pattern": "isolation_quad", "machineVariance": "high",
      "male":   { "bw":[60,70,80,90,100], "beginner":[36,42,48,53,58], "novice":[57,65,72,79,85], "intermediate":[85,95,103,111,119], "advanced":[119,130,140,149,158], "elite":[156,169,180,191,201] },
      "female": { "bw":[50,60,70,80],     "beginner":[19,22,24,27],    "novice":[34,38,41,44],    "intermediate":[55,59,64,67],      "advanced":[80,86,91,95],         "elite":[109,115,121,126] }
    },

    "lying_leg_curl": {
      "name": "Lying Leg Curl", "loadType": "external_machine", "perSide": false, "pattern": "isolation_hamstring", "machineVariance": "high",
      "male":   { "bw":[60,70,80,90,100], "beginner":[21,25,30,35,39], "novice":[34,40,46,51,57], "intermediate":[52,59,66,73,79], "advanced":[73,82,90,98,105], "elite":[96,107,116,125,133] },
      "female": { "bw":[50,60,70,80],     "beginner":[13,15,17,19],    "novice":[21,24,27,29],    "intermediate":[32,36,40,43],    "advanced":[46,51,55,58],     "elite":[62,67,71,75] }
    },

    "seated_calf_raise": {
      "name": "Seated Calf Raise", "loadType": "external_machine", "perSide": false, "pattern": "isolation_calf", "machineVariance": "high",
      "male":   { "bw":[60,70,80,90,100], "beginner":[20,26,31,37,42], "novice":[41,50,57,64,71], "intermediate":[73,83,93,102,111], "advanced":[112,126,138,149,159], "elite":[158,174,188,201,213] },
      "female": { "bw":[50,60,70,80],     "beginner":[11,14,17,20],    "novice":[29,34,38,42],    "intermediate":[56,63,69,74],      "advanced":[93,102,109,116],      "elite":[137,147,156,164] }
    },

    "barbell_shrug": {
      "name": "Barbell Shrug", "loadType": "external", "perSide": false, "pattern": "isolation_trap",
      "male":   { "bw":[60,70,80,90,100], "beginner":[30,42,53,65,76], "novice":[55,70,85,99,113], "intermediate":[89,108,126,143,159], "advanced":[130,154,175,195,214], "elite":[178,205,230,253,274] },
      "female": { "bw":[50,60,70,80],     "beginner":[12,17,22,27],    "novice":[28,35,42,49],    "intermediate":[51,61,71,79],       "advanced":[82,95,106,117],       "elite":[119,134,147,159] }
    },

    "barbell_curl": {
      "name": "Barbell Curl", "loadType": "external", "perSide": false, "pattern": "isolation_bicep",
      "male":   { "bw":[60,70,80,90,100], "beginner":[15,18,22,25,28], "novice":[24,28,33,36,40], "intermediate":[36,41,46,51,55], "advanced":[50,57,63,68,73], "elite":[66,74,80,87,92] },
      "female": { "bw":[50,60,70,80],     "beginner":[6,8,9,11],       "novice":[12,14,16,18],    "intermediate":[20,23,26,28],    "advanced":[31,34,37,40],    "elite":[43,47,51,54] }
    },

    "tricep_pushdown": {
      "name": "Cable Tricep Pushdown", "loadType": "external_machine", "perSide": false, "pattern": "isolation_tricep", "machineVariance": "medium",
      "male":   { "bw":[60,70,80,90,100], "beginner":[14,18,22,25,29], "novice":[26,31,36,41,46], "intermediate":[43,50,56,62,67], "advanced":[64,73,80,87,93], "elite":[89,98,107,115,122] },
      "female": { "bw":[50,60,70,80],     "beginner":[7,9,11,12],      "novice":[14,17,19,22],    "intermediate":[24,28,31,34],    "advanced":[38,42,46,50],    "elite":[53,59,63,67] }
    },

    "dumbbell_lateral_raise": {
      "name": "Dumbbell Lateral Raise", "loadType": "external", "perSide": true, "implementWeightKg": 2, "pattern": "isolation_sidedelt",
      "male":   { "bw":[60,70,80,90,100], "beginner":[3,4,5,6,7], "novice":[7,9,10,11,12], "intermediate":[13,15,16,18,19], "advanced":[20,23,25,27,28], "elite":[29,32,34,37,39] },
      "female": { "bw":[50,60,70,80],     "beginner":[3,3,3,4],   "novice":[5,6,6,6],      "intermediate":[8,9,9,10],       "advanced":[12,13,14,14],    "elite":[16,17,18,19] }
    }
  }
}
```

### 1b. Optional second reference population — competitive powerlifters (OpenPowerlifting)

```json
{
  "meta": { "referencePopulation": "competitive_powerlifters_raw_drugtested",
            "source": "OpenPowerlifting / van den Hoek 2024 / Montenegro 2026", "unit": "xBodyweight" },
  "p90_age18_35": { "male": { "squat": 2.83, "bench": 1.95, "deadlift": 3.25 },
                    "female": { "squat": 2.26, "bench": 1.35, "deadlift": 2.66 } },
  "byWeightClass": {
    "male_squat":    { "66": {"p50":2.31,"p90":2.95,"p95":3.18}, "74": {"p50":2.30,"p90":2.91,"p95":3.07},
                       "83": {"p50":2.23,"p90":2.80,"p95":2.95}, "93": {"p50":2.15,"p90":2.69,"p95":2.82},
                       "105":{"p50":2.02,"p90":2.52,"p95":2.67}, "120":{"p50":1.90,"p90":2.38,"p95":2.52} },
    "male_bench":    { "66": {"p50":1.52,"p90":2.01,"p95":2.16}, "74": {"p50":1.52,"p90":1.96,"p95":2.09},
                       "83": {"p50":1.51,"p90":1.90,"p95":2.02}, "93": {"p50":1.42,"p90":1.83,"p95":1.94},
                       "105":{"p50":1.38,"p90":1.74,"p95":1.86}, "120":{"p50":1.29,"p90":1.65,"p95":1.75} },
    "male_deadlift": { "66": {"p50":2.80,"p90":3.48,"p95":3.67}, "74": {"p50":2.74,"p90":3.38,"p95":3.53},
                       "83": {"p50":2.62,"p90":3.19,"p95":3.37}, "93": {"p50":2.47,"p90":3.01,"p95":3.15},
                       "105":{"p50":2.29,"p90":2.76,"p95":2.90}, "120":{"p50":2.08,"p90":2.52,"p95":2.67} },
    "female_squat":  { "52": {"p50":1.78,"p90":2.36,"p95":2.55}, "57": {"p50":1.80,"p90":2.33,"p95":2.50},
                       "63": {"p50":1.71,"p90":2.22,"p95":2.38}, "69": {"p50":1.78,"p90":2.28,"p95":2.41},
                       "76": {"p50":1.68,"p90":2.17,"p95":2.34}, "84": {"p50":1.46,"p90":1.93,"p95":2.08} },
    "female_bench":  { "52": {"p50":1.01,"p90":1.39,"p95":1.54}, "57": {"p50":1.01,"p90":1.40,"p95":1.54},
                       "63": {"p50":0.95,"p90":1.31,"p95":1.43}, "69": {"p50":0.98,"p90":1.30,"p95":1.42},
                       "76": {"p50":0.92,"p90":1.25,"p95":1.38}, "84": {"p50":0.80,"p90":1.10,"p95":1.22} },
    "female_deadlift":{"52": {"p50":2.21,"p90":2.85,"p95":3.03}, "57": {"p50":2.19,"p90":2.76,"p95":2.94},
                       "63": {"p50":2.10,"p90":2.62,"p95":2.78}, "69": {"p50":2.10,"p90":2.61,"p95":2.75},
                       "76": {"p50":1.97,"p90":2.43,"p95":2.61}, "84": {"p50":1.73,"p90":2.17,"p95":2.29} }
  },
  "quantileRegressionBeta_perKgBodyweight": {
    "note": "Montenegro 2026: absolute reduction in BW-multiple per +1 kg bodyweight. Steeper at higher percentiles.",
    "male_deadlift": [-0.0150, -0.0196], "male_squat": [-0.0092, -0.0125],
    "male_bench": [-0.0059, -0.0091],    "female_squat": [-0.0111, -0.0136]
  }
}
```

---

## PART 2 — MUSCLE CONTRIBUTION MATRIX (JSON)

17 muscle groups. Each exercise's weights sum to 1.0. These are **limiting contributions** — how much the exercise's load ceiling is determined by that muscle — not raw EMG amplitude. EMG %MVC literature is the prior; refit from app data once cross-exercise histories exist.

```json
{
  "muscles": ["chest","frontDelt","sideDelt","rearDelt","triceps","biceps","forearms",
              "lats","upperBack","traps","lowerBack","abs","glutes","quads","hamstrings","adductors","calves"],

  "patterns": ["squat","hinge","horizontal_press","vertical_press","horizontal_pull","vertical_pull"],
  "patternWeights": { "squat":0.22,"hinge":0.22,"horizontal_press":0.17,"vertical_press":0.11,
                      "horizontal_pull":0.14,"vertical_pull":0.14 },
  "patternCorrelation": {
    "order": ["squat","hinge","horizontal_press","vertical_press","horizontal_pull","vertical_pull"],
    "R": [[1.00,0.85,0.68,0.62,0.66,0.58],
          [0.85,1.00,0.64,0.58,0.70,0.62],
          [0.68,0.64,1.00,0.80,0.72,0.66],
          [0.62,0.58,0.80,1.00,0.70,0.68],
          [0.66,0.70,0.72,0.70,1.00,0.82],
          [0.58,0.62,0.66,0.68,0.82,1.00]]
  },

  "W": {
    "bench_press":            {"chest":0.46,"frontDelt":0.22,"triceps":0.28,"sideDelt":0.02,"lats":0.02},
    "incline_bench_press":    {"chest":0.38,"frontDelt":0.32,"triceps":0.26,"sideDelt":0.04},
    "close_grip_bench_press": {"chest":0.30,"frontDelt":0.20,"triceps":0.46,"sideDelt":0.04},
    "dumbbell_bench_press":   {"chest":0.48,"frontDelt":0.22,"triceps":0.24,"sideDelt":0.03,"forearms":0.03},
    "machine_chest_press":    {"chest":0.50,"frontDelt":0.22,"triceps":0.26,"sideDelt":0.02},
    "cable_fly":              {"chest":0.78,"frontDelt":0.14,"biceps":0.04,"forearms":0.04},
    "push_up":                {"chest":0.44,"frontDelt":0.20,"triceps":0.26,"abs":0.07,"sideDelt":0.03},
    "dip":                    {"chest":0.38,"triceps":0.38,"frontDelt":0.18,"sideDelt":0.02,"abs":0.04},

    "overhead_press":         {"frontDelt":0.40,"sideDelt":0.16,"triceps":0.28,"upperBack":0.04,"abs":0.08,"traps":0.04},
    "dumbbell_shoulder_press":{"frontDelt":0.42,"sideDelt":0.18,"triceps":0.26,"abs":0.08,"traps":0.06},
    "dumbbell_lateral_raise": {"sideDelt":0.80,"frontDelt":0.08,"traps":0.10,"forearms":0.02},
    "rear_delt_fly":          {"rearDelt":0.62,"upperBack":0.28,"traps":0.08,"forearms":0.02},
    "face_pull":              {"rearDelt":0.44,"upperBack":0.34,"traps":0.14,"biceps":0.05,"forearms":0.03},

    "tricep_pushdown":        {"triceps":0.88,"forearms":0.06,"chest":0.03,"frontDelt":0.03},
    "overhead_tricep_ext":    {"triceps":0.88,"frontDelt":0.05,"forearms":0.04,"abs":0.03},
    "barbell_curl":           {"biceps":0.78,"forearms":0.16,"frontDelt":0.04,"upperBack":0.02},
    "hammer_curl":            {"biceps":0.62,"forearms":0.34,"frontDelt":0.04},

    "barbell_row":            {"lats":0.32,"upperBack":0.26,"rearDelt":0.10,"biceps":0.12,"lowerBack":0.12,"forearms":0.06,"traps":0.02},
    "t_bar_row":              {"lats":0.34,"upperBack":0.28,"rearDelt":0.09,"biceps":0.12,"lowerBack":0.09,"forearms":0.06,"traps":0.02},
    "seated_cable_row":       {"lats":0.34,"upperBack":0.30,"rearDelt":0.09,"biceps":0.14,"forearms":0.07,"lowerBack":0.06},
    "lat_pulldown":           {"lats":0.50,"upperBack":0.16,"biceps":0.18,"rearDelt":0.06,"forearms":0.08,"abs":0.02},
    "pull_up":                {"lats":0.48,"upperBack":0.15,"biceps":0.17,"rearDelt":0.05,"forearms":0.09,"abs":0.06},
    "chin_up":                {"lats":0.42,"biceps":0.26,"upperBack":0.13,"forearms":0.09,"abs":0.06,"rearDelt":0.04},
    "barbell_shrug":          {"traps":0.74,"upperBack":0.12,"forearms":0.12,"lowerBack":0.02},

    "back_squat":             {"quads":0.40,"glutes":0.26,"adductors":0.10,"hamstrings":0.08,"lowerBack":0.10,"abs":0.06},
    "front_squat":            {"quads":0.48,"glutes":0.20,"adductors":0.08,"lowerBack":0.10,"abs":0.09,"upperBack":0.05},
    "hack_squat":             {"quads":0.58,"glutes":0.22,"adductors":0.09,"hamstrings":0.06,"abs":0.05},
    "leg_press":              {"quads":0.48,"glutes":0.28,"adductors":0.12,"hamstrings":0.08,"calves":0.04},
    "bulgarian_split_squat":  {"quads":0.40,"glutes":0.34,"adductors":0.10,"hamstrings":0.08,"abs":0.05,"calves":0.03},
    "walking_lunge":          {"quads":0.36,"glutes":0.36,"adductors":0.10,"hamstrings":0.09,"abs":0.06,"calves":0.03},
    "leg_extension":          {"quads":0.94,"abs":0.03,"calves":0.03},

    "deadlift":               {"hamstrings":0.22,"glutes":0.24,"lowerBack":0.22,"quads":0.12,"traps":0.08,"forearms":0.07,"upperBack":0.05},
    "sumo_deadlift":          {"glutes":0.26,"quads":0.20,"adductors":0.14,"hamstrings":0.16,"lowerBack":0.14,"forearms":0.06,"traps":0.04},
    "romanian_deadlift":      {"hamstrings":0.38,"glutes":0.28,"lowerBack":0.20,"forearms":0.07,"traps":0.04,"upperBack":0.03},
    "hip_thrust":             {"glutes":0.62,"hamstrings":0.20,"quads":0.12,"abs":0.06},
    "lying_leg_curl":         {"hamstrings":0.90,"calves":0.07,"glutes":0.03},
    "good_morning":           {"hamstrings":0.34,"lowerBack":0.34,"glutes":0.26,"abs":0.06},
    "back_extension":         {"lowerBack":0.50,"glutes":0.28,"hamstrings":0.22},

    "standing_calf_raise":    {"calves":0.94,"quads":0.03,"abs":0.03},
    "seated_calf_raise":      {"calves":1.00},
    "hanging_leg_raise":      {"abs":0.80,"lats":0.10,"forearms":0.06,"quads":0.04},
    "ab_wheel_rollout":       {"abs":0.72,"lats":0.12,"frontDelt":0.08,"lowerBack":0.08}
  },

  "exerciseNoise_tau": {
    "_comment": "Base measurement SD in z units. Higher = less trustworthy as a strength probe.",
    "barbell_compound": 0.28, "dumbbell_compound": 0.34, "bodyweight_loaded": 0.32,
    "cable_isolation": 0.42, "machine_compound": 0.48, "machine_isolation": 0.52,
    "unilateral": 0.40
  },

  "anchorMapping": {
    "_comment": "For exercises with no published standards: standard_e(bw,level) = ratio * standard_anchor(bw,level). Priors below; refit as median paired e1RM ratio among users logging both.",
    "smith_machine_bench_press": { "anchor": "bench_press", "ratio": 1.06, "confidence": 0.7 },
    "machine_chest_press":       { "anchor": "bench_press", "ratio": 1.02, "confidence": 0.6 },
    "decline_bench_press":       { "anchor": "bench_press", "ratio": 1.05, "confidence": 0.8 },
    "paused_bench_press":        { "anchor": "bench_press", "ratio": 0.93, "confidence": 0.9 },
    "floor_press":               { "anchor": "bench_press", "ratio": 0.90, "confidence": 0.8 },
    "seated_overhead_press":     { "anchor": "overhead_press", "ratio": 1.05, "confidence": 0.85 },
    "push_press":                { "anchor": "overhead_press", "ratio": 1.30, "confidence": 0.8 },
    "arnold_press":              { "anchor": "dumbbell_shoulder_press", "ratio": 0.90, "confidence": 0.7 },
    "pendlay_row":               { "anchor": "barbell_row", "ratio": 0.92, "confidence": 0.8 },
    "chest_supported_row":       { "anchor": "barbell_row", "ratio": 0.95, "confidence": 0.7 },
    "box_squat":                 { "anchor": "back_squat", "ratio": 1.02, "confidence": 0.8 },
    "safety_bar_squat":          { "anchor": "back_squat", "ratio": 0.92, "confidence": 0.75 },
    "smith_machine_squat":       { "anchor": "back_squat", "ratio": 1.10, "confidence": 0.6 },
    "goblet_squat":              { "anchor": "front_squat", "ratio": 0.55, "confidence": 0.6 },
    "trap_bar_deadlift":         { "anchor": "deadlift", "ratio": 1.08, "confidence": 0.8 },
    "deficit_deadlift":          { "anchor": "deadlift", "ratio": 0.90, "confidence": 0.8 },
    "rack_pull":                 { "anchor": "deadlift", "ratio": 1.25, "confidence": 0.6 },
    "stiff_leg_deadlift":        { "anchor": "romanian_deadlift", "ratio": 0.95, "confidence": 0.85 },
    "single_leg_hip_thrust":     { "anchor": "hip_thrust", "ratio": 0.42, "confidence": 0.6 },
    "seated_leg_curl":           { "anchor": "lying_leg_curl", "ratio": 1.05, "confidence": 0.8 },
    "preacher_curl":             { "anchor": "barbell_curl", "ratio": 0.80, "confidence": 0.8 },
    "ez_bar_curl":               { "anchor": "barbell_curl", "ratio": 1.00, "confidence": 0.9 },
    "skullcrusher":              { "anchor": "close_grip_bench_press", "ratio": 0.48, "confidence": 0.7 }
  }
}
```

---

## PART 3 — RANK LADDER (JSON)

`S = 36 + 18·z`, clipped to [0, 120]. 15-point bands, three 5-point sub-tiers per band. This reproduces the reference screenshot exactly: **score 27 → Novice II, next tier Novice III at 31.0**.

```json
{
  "scoreFromZ": { "intercept": 36, "slope": 18, "clip": [0, 120] },
  "subTierWidth": 5.0,
  "ladder": [
    { "tier": "Untrained",   "from": 0.0,  "to": 6.0,  "subTiers": [],                                      "zFrom": -2.00, "pctFrom": 0.023 },
    { "tier": "Beginner",    "from": 6.0,  "to": 21.0, "subTiers": [{"n":"I","at":6.0},{"n":"II","at":11.0},{"n":"III","at":16.0}], "zFrom": -1.667, "pctFrom": 0.048 },
    { "tier": "Novice",      "from": 21.0, "to": 36.0, "subTiers": [{"n":"I","at":21.0},{"n":"II","at":26.0},{"n":"III","at":31.0}], "zFrom": -0.833, "pctFrom": 0.202 },
    { "tier": "Intermediate","from": 36.0, "to": 51.0, "subTiers": [{"n":"I","at":36.0},{"n":"II","at":41.0},{"n":"III","at":46.0}], "zFrom": 0.000,  "pctFrom": 0.500 },
    { "tier": "Advanced",    "from": 51.0, "to": 66.0, "subTiers": [{"n":"I","at":51.0},{"n":"II","at":56.0},{"n":"III","at":61.0}], "zFrom": 0.833,  "pctFrom": 0.798 },
    { "tier": "Elite",       "from": 66.0, "to": 81.0, "subTiers": [{"n":"I","at":66.0},{"n":"II","at":71.0},{"n":"III","at":76.0}], "zFrom": 1.667,  "pctFrom": 0.952 },
    { "tier": "World Class", "from": 81.0, "to": 96.0, "subTiers": [{"n":"I","at":81.0},{"n":"II","at":86.0},{"n":"III","at":91.0}], "zFrom": 2.500,  "pctFrom": 0.9938 },
    { "tier": "Legendary",   "from": 96.0, "to": 120.0,"subTiers": [],                                      "zFrom": 3.333,  "pctFrom": 0.99957 }
  ],
  "alignmentCheck": {
    "P5_beginner":      { "z": -1.6449, "score": 6.39 },
    "P20_novice":       { "z": -0.8416, "score": 20.85 },
    "P50_intermediate": { "z":  0.0000, "score": 36.00 },
    "P80_advanced":     { "z":  0.8416, "score": 51.15 },
    "P95_elite":        { "z":  1.6449, "score": 65.61 }
  }
}
```

Display rule for percentile: `Top X%` where `X = round(100 × (1 − percentile))`, clamped to [0.1, 99]. Score 27 → z = −0.5 → percentile 30.85 → "Top 69%". Score 20.85 → z = −0.8416 → "Top 80%" (matches reference).

---

## PART 4 — AGE & SEX ADJUSTMENT (JSON)

```json
{
  "sex": {
    "method": "separate_reference_distributions",
    "note": "Never apply a multiplier. Use the sex-specific table. Offer an explicit 'compare me against: men / women / both' selector; 'both' blends the two log-normal-ish distributions weighted by population share of the app."
  },
  "age": {
    "baselineWindow": [25, 40],
    "modes": ["age_graded", "open"],
    "default": "age_graded_if_under_23_or_over_40",
    "method": "referenceMedian_adjusted = referenceMedian / C(age); then interpolate as normal",
    "youth": {
      "source": "Foster coefficients (USA Powerlifting)",
      "table": { "14":1.23,"15":1.18,"16":1.13,"17":1.08,"18":1.06,"19":1.04,"20":1.03,"21":1.02,"22":1.01,"23":1.00 },
      "quadraticFit": "C(a) = 1 - 0.002444*d + 0.003111*d^2, d = 23 - a, for 14 <= a < 23",
      "note": "Below age 14 do NOT classify; show 'Youth mode - tracking only'."
    },
    "masters": {
      "source": "McCulloch coefficients (revised, WRPF/USAPL)",
      "table": { "40":1.000,"41":1.010,"42":1.020,"43":1.031,"44":1.043,"45":1.055,"46":1.068,"47":1.082,
                 "48":1.097,"49":1.113,"50":1.130,"51":1.147,"52":1.165,"53":1.184,"54":1.204,"55":1.225,
                 "56":1.246,"57":1.268,"58":1.291,"59":1.315,"60":1.340,"66":1.511,"67":1.543,"68":1.576,
                 "69":1.610,"70":1.645,"71":1.681,"72":1.718,"73":1.756,"74":1.795,"75":1.835,"76":1.876,
                 "77":1.918,"78":1.961,"79":2.005,"80":2.050,"81":2.096,"82":2.143,"83":2.190 },
      "quadraticFit": "C(a) = 1 + 0.0085833*(a-40) + 0.00044167*(a-40)^2, for a >= 40",
      "fitAccuracy": { "age66": { "fit": 1.5217, "table": 1.511 }, "age80": { "fit": 2.050, "table": 2.050 } },
      "cap": "Clamp C at age 80 (C = 2.050) for display to avoid runaway classifications."
    },
    "corroboration": "van den Hoek 2024 (n=809,986): relative strength peaks 18-35 y and declines thereafter for squat, bench and deadlift, consistent with the McCulloch direction."
  }
}
```

---

## PART 5 — RUNNABLE TYPESCRIPT

```ts
// ============================================================================
// Stronger 2.0 — strength-standards engine
// ============================================================================

export type Sex = 'male' | 'female';
export type Level = 'beginner' | 'novice' | 'intermediate' | 'advanced' | 'elite';

/** Percentile anchors shared by Strength Level and Gravitus. */
export const LEVEL_Z: Record<Level, number> = {
  beginner: -1.6449,      // P5
  novice: -0.8416,        // P20
  intermediate: 0.0,      // P50
  advanced: 0.8416,       // P80
  elite: 1.6449,          // P95
};
const ANCHOR_Z = [LEVEL_Z.beginner, LEVEL_Z.novice, LEVEL_Z.intermediate, LEVEL_Z.advanced, LEVEL_Z.elite];

// ---------------------------------------------------------------------------
// 1. Normal distribution helpers
// ---------------------------------------------------------------------------

/** Abramowitz & Stegun 7.1.26, |err| < 1.5e-7 */
export function erf(x: number): number {
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
export const normCdf = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));

/** Acklam's inverse normal CDF, |rel err| < 1.15e-9 */
export function normInv(p: number): number {
  if (p <= 0) return -Infinity; if (p >= 1) return Infinity;
  const a = [-3.969683028665376e+1, 2.209460984245205e+2, -2.759285104469687e+2, 1.383577518672690e+2, -3.066479806614716e+1, 2.506628277459239e+0];
  const b = [-5.447609879822406e+1, 1.615858368580409e+2, -1.556989798598866e+2, 6.680131188771972e+1, -1.328068155288572e+1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e+0, -2.549732539343734e+0, 4.374664141464968e+0, 2.938163982698783e+0];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e+0, 3.754408661907416e+0];
  const pl = 0.02425, ph = 1 - pl; let q: number, r: number;
  if (p < pl) { q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
  if (p > ph) { q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
  q = p - 0.5; r = q * q;
  return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}

// ---------------------------------------------------------------------------
// 2. Monotone cubic (PCHIP / Fritsch–Carlson) interpolation
//    Used twice: across bodyweight, and across (ln load -> z).
// ---------------------------------------------------------------------------

export function pchipSlopes(xs: number[], ys: number[]): number[] {
  const n = xs.length, h: number[] = [], del: number[] = [];
  for (let i = 0; i < n - 1; i++) { h.push(xs[i+1]-xs[i]); del.push((ys[i+1]-ys[i])/(xs[i+1]-xs[i])); }
  const m = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    if (del[i-1] * del[i] <= 0) { m[i] = 0; continue; }
    const w1 = 2*h[i] + h[i-1], w2 = h[i] + 2*h[i-1];
    m[i] = (w1 + w2) / (w1/del[i-1] + w2/del[i]);
  }
  // Endpoints: one-sided three-point formula, clamped to preserve monotonicity.
  const endSlope = (hA: number, hB: number, dA: number, dB: number) => {
    let e = ((2*hA + hB) * dA - hA * dB) / (hA + hB);
    if (e * dA <= 0) e = 0;
    else if (dA * dB <= 0 && Math.abs(e) > Math.abs(3*dA)) e = 3*dA;
    return e;
  };
  m[0]   = n > 2 ? endSlope(h[0], h[1], del[0], del[1]) : del[0];
  m[n-1] = n > 2 ? endSlope(h[n-2], h[n-3], del[n-2], del[n-3]) : del[n-2];
  return m;
}

/** Evaluate PCHIP; LINEAR extrapolation beyond the ends using the end slopes. */
export function pchipEval(xs: number[], ys: number[], m: number[], x: number): number {
  const n = xs.length;
  if (x <= xs[0])   return ys[0]   + m[0]   * (x - xs[0]);
  if (x >= xs[n-1]) return ys[n-1] + m[n-1] * (x - xs[n-1]);
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid] <= x) lo = mid; else hi = mid; }
  const h = xs[hi] - xs[lo], t = (x - xs[lo]) / h, t2 = t*t, t3 = t2*t;
  return (2*t3 - 3*t2 + 1)*ys[lo] + (t3 - 2*t2 + t)*h*m[lo]
       + (-2*t3 + 3*t2)*ys[hi]    + (t3 - t2)*h*m[hi];
}

// ---------------------------------------------------------------------------
// 3. Standards -> anchors at an exact bodyweight
// ---------------------------------------------------------------------------

export interface SexTable { bw: number[]; beginner: number[]; novice: number[]; intermediate: number[]; advanced: number[]; elite: number[]; }
export interface ExerciseStandard {
  name: string;
  loadType: 'external' | 'external_machine' | 'external_total' | 'added_bodyweight';
  perSide?: boolean;
  implementWeightKg?: number;
  bodyweightFraction?: number;   // for added_bodyweight, e.g. 0.93
  pattern: string;
  machineVariance?: 'medium' | 'high' | 'very_high';
  male: SexTable; female: SexTable;
}

/** The five level loads at an exact bodyweight (monotone-interpolated). */
export function anchorsAtBodyweight(std: ExerciseStandard, sex: Sex, bwKg: number): number[] {
  const t = std[sex];
  const cols: (keyof SexTable)[] = ['beginner','novice','intermediate','advanced','elite'];
  return cols.map(c => {
    const ys = t[c] as number[];
    return pchipEval(t.bw, ys, pchipSlopes(t.bw, ys), bwKg);
  });
}

/** Normalise a logged load into the units the standards table uses. */
export function normaliseLoad(std: ExerciseStandard, loggedKg: number, bwKg: number): number {
  let load = loggedKg;
  if (std.loadType === 'added_bodyweight') load = (std.bodyweightFraction ?? 0.93) * bwKg + loggedKg;
  return Math.max(load, 0.5);
}
export function normaliseAnchors(std: ExerciseStandard, anchors: number[], bwKg: number): number[] {
  if (std.loadType !== 'added_bodyweight') return anchors;
  const k = std.bodyweightFraction ?? 0.93;
  return anchors.map(a => Math.max(k * bwKg + a, 0.5));
}

// ---------------------------------------------------------------------------
// 4. Load -> z-score.  THE core primitive.
//    Monotone spline through the 5 (ln load, z) anchor points; linear beyond.
// ---------------------------------------------------------------------------

export function zFromLoad(loadKg: number, anchorsKg: number[]): number {
  const x = anchorsKg.map(a => Math.log(a));
  // Guarantee strict monotonicity (tables are integer-rounded and can tie).
  for (let i = 1; i < x.length; i++) if (x[i] <= x[i-1]) x[i] = x[i-1] + 1e-6;
  const m = pchipSlopes(x, ANCHOR_Z);
  const z = pchipEval(x, ANCHOR_Z, m, Math.log(loadKg));
  return Math.max(-3.5, Math.min(4.5, z));
}

export function loadFromZ(z: number, anchorsKg: number[]): number {
  const x = anchorsKg.map(a => Math.log(a));
  for (let i = 1; i < x.length; i++) if (x[i] <= x[i-1]) x[i] = x[i-1] + 1e-6;
  const m = pchipSlopes(ANCHOR_Z, x);
  return Math.exp(pchipEval(ANCHOR_Z, x, m, z));
}

// ---------------------------------------------------------------------------
// 5. Age adjustment
// ---------------------------------------------------------------------------

export function ageFactor(age: number): number {
  if (age >= 40) { const d = Math.min(age, 80) - 40; return 1 + 0.0085833*d + 0.00044167*d*d; }
  if (age < 23)  { const d = 23 - Math.max(age, 14);  return 1 - 0.002444*d + 0.003111*d*d; }
  return 1.0;
}
/** Age-graded: divide the reference anchors by C(age) so older/younger lifters are judged fairly. */
export const ageGradeAnchors = (anchors: number[], age: number, mode: 'age_graded'|'open') =>
  mode === 'open' ? anchors : anchors.map(a => a / ageFactor(age));

// ---------------------------------------------------------------------------
// 6. Score & rank ladder
// ---------------------------------------------------------------------------

export const scoreFromZ = (z: number) => Math.max(0, Math.min(120, 36 + 18 * z));
export const zFromScore = (s: number) => (s - 36) / 18;

const LADDER = [
  { tier: 'Untrained',    from: 0,  subs: [] as string[] },
  { tier: 'Beginner',     from: 6,  subs: ['I','II','III'] },
  { tier: 'Novice',       from: 21, subs: ['I','II','III'] },
  { tier: 'Intermediate', from: 36, subs: ['I','II','III'] },
  { tier: 'Advanced',     from: 51, subs: ['I','II','III'] },
  { tier: 'Elite',        from: 66, subs: ['I','II','III'] },
  { tier: 'World Class',  from: 81, subs: ['I','II','III'] },
  { tier: 'Legendary',    from: 96, subs: [] as string[] },
];
const SUB_W = 5.0;

export interface Rank { label: string; tier: string; sub: string | null; score: number;
                        nextLabel: string | null; nextAt: number | null; toNext: number | null;
                        progress: number; percentile: number; topPercent: number; }

export function rankFromScore(score: number): Rank {
  const s = Math.max(0, Math.min(120, score));
  let bi = 0; for (let i = 0; i < LADDER.length; i++) if (s >= LADDER[i].from) bi = i;
  const band = LADDER[bi];
  const si = band.subs.length ? Math.min(band.subs.length - 1, Math.floor((s - band.from) / SUB_W)) : -1;
  const sub = si >= 0 ? band.subs[si] : null;
  const label = sub ? `${band.tier} ${sub}` : band.tier;

  let nextAt: number | null = null, nextLabel: string | null = null, floor = band.from;
  if (si >= 0 && si < band.subs.length - 1) { nextAt = band.from + (si+1)*SUB_W; nextLabel = `${band.tier} ${band.subs[si+1]}`; floor = band.from + si*SUB_W; }
  else if (bi < LADDER.length - 1) { const nb = LADDER[bi+1]; nextAt = nb.from; nextLabel = nb.subs.length ? `${nb.tier} ${nb.subs[0]}` : nb.tier; floor = si >= 0 ? band.from + si*SUB_W : band.from; }

  const pct = normCdf(zFromScore(s));
  return { label, tier: band.tier, sub, score: Math.round(s * 10) / 10,
    nextLabel, nextAt, toNext: nextAt === null ? null : Math.round((nextAt - s) * 10) / 10,
    progress: nextAt === null ? 1 : (s - floor) / (nextAt - floor),
    percentile: pct, topPercent: Math.max(0.1, Math.min(99, Math.round((1 - pct) * 100))) };
}
// rankFromScore(27)  -> { label:'Novice II', nextLabel:'Novice III', nextAt:31, toNext:4, topPercent:69 }

// ---------------------------------------------------------------------------
// 7. e1RM estimation (RTS chart when RPE present; Marzagao otherwise)
// ---------------------------------------------------------------------------

const RTS: Record<number, Record<number, number>> = {
  1:{10:100,9.5:98,9:96,8.5:94,8:92,7.5:90.5,7:89,6.5:87.5,6:86},
  2:{10:95,9.5:93.5,9:92,8.5:90.5,8:89,7.5:87.5,7:86,6.5:84.5,6:83},
  3:{10:92,9.5:90.5,9:89,8.5:87.5,8:86,7.5:85,7:84,6.5:82.5,6:81},
  4:{10:89,9.5:87.5,9:86,8.5:85,8:84,7.5:82.5,7:81,6.5:80,6:79},
  5:{10:86,9.5:85,9:84,8.5:82.5,8:81,7.5:80,7:79,6.5:77.5,6:76},
  6:{10:84,9.5:82.5,9:81,8.5:80,8:79,7.5:77.5,7:76,6.5:75,6:74},
  7:{10:81,9.5:80,9:79,8.5:77.5,8:76,7.5:75,7:74,6.5:73,6:72},
  8:{10:79,9.5:77.5,9:76,8.5:75,8:74,7.5:73,7:72,6.5:70.5,6:69},
  9:{10:76,9.5:75,9:74,8.5:73,8:72,7.5:70.5,7:69,6.5:68,6:67},
  10:{10:74,9.5:73,9:72,8.5:70.5,8:69,7.5:68,7:67,6.5:66,6:65},
};

/** Marzagao 2026 (arXiv:2603.17495) — weight-dependent, fitted on 303,494 near-failure sets. */
export function e1rmMarzagao(weightKg: number, reps: number): number {
  const w = Math.max(weightKg, 5);
  const denom = -2.55 + 4.58 * Math.log(w);
  if (denom <= 0.5) return e1rmBlend(w, reps);      // guard the singularity at low load
  return w * (1 + Math.pow(reps - 1, 0.85) / denom);
}
/** Classical blend (Epley + Brzycki + Wathan), used as a fallback / sanity bound. */
export function e1rmBlend(w: number, r: number): number {
  const epley = w * (1 + 0.0333 * r);
  const brzycki = r < 37 ? w * 36 / (37 - r) : epley;
  const wathan = 100 * w / (48.8 + 53.8 * Math.exp(-0.075 * r));
  return (epley + brzycki + wathan) / 3;
}
export function e1rm(weightKg: number, reps: number, rpe?: number): number {
  if (reps < 1 || weightKg <= 0) return 0;
  if (rpe != null) {
    const r = Math.min(10, Math.max(1, Math.round(reps)));
    const e = Math.min(10, Math.max(6, Math.round(rpe * 2) / 2));
    const pct = RTS[r]?.[e];
    if (pct) return weightKg / (pct / 100);
  }
  if (reps === 1) return weightKg;
  return e1rmMarzagao(weightKg, reps);
}

// ---------------------------------------------------------------------------
// 8. Robust per-exercise e1RM (anti-fluke)
// ---------------------------------------------------------------------------

export interface LoggedSet {
  weightKg: number; reps: number; rpe?: number; completed: boolean;
  setType: 'normal' | 'warmup' | 'dropset' | 'failure' | 'myorep' | 'cluster';
  isDropContinuation?: boolean; isMyorepContinuation?: boolean;
  sessionId: string; performedAt: number;  // epoch ms
}
export interface RobustResult { e1rm: number | null; nSets: number; nSessions: number;
                                ageDays: number; confidence: number; flags: string[]; }

export function robustE1RM(sets: LoggedSet[], now = Date.now(), windowDays = 120): RobustResult {
  const flags: string[] = [];
  const cutoff = now - windowDays * 864e5;
  const q = sets.filter(s =>
    s.completed && s.weightKg > 0 && s.reps >= 1 && s.reps <= 12 &&
    s.setType !== 'warmup' && !s.isDropContinuation && !s.isMyorepContinuation &&
    s.performedAt >= cutoff &&
    (s.rpe == null || s.rpe >= 7 || s.setType === 'failure'));   // sub-RPE7 sets are a lower bound only

  if (q.length === 0) return { e1rm: null, nSets: 0, nSessions: 0, ageDays: Infinity, confidence: 0, flags: ['no_qualifying_sets'] };

  const est = q.map(s => ({ v: e1rm(s.weightKg, s.reps, s.rpe), at: s.performedAt, sid: s.sessionId }))
               .sort((a, b) => b.v - a.v);
  const sessions = new Set(q.map(s => s.sessionId)).size;

  // Unit-entry guard: a single value >1.8x the median is almost always lb-in-kg or a typo.
  const median = est[Math.floor(est.length / 2)].v;
  if (est[0].v > 1.8 * median && est.length >= 3) { flags.push('outlier_suspected_unit_error'); est.shift(); }

  // "Best of two must agree": with 3+ estimates take the 2nd-highest, so one fluke cannot move a rank.
  let chosen = est.length >= 3 ? est[1] : est[0];
  if (est.length >= 3 && est[0].v > 1.12 * est[1].v) flags.push('top_set_discarded_as_outlier');

  const ageDays = (now - chosen.at) / 864e5;
  let confidence = Math.min(1, est.length / 4) * Math.min(1, sessions / 2);
  if (ageDays > 56) confidence *= Math.exp(-(ageDays - 56) / 120);
  if (sessions < 2) flags.push('single_session_only');

  return { e1rm: chosen.v, nSets: est.length, nSessions: sessions, ageDays, confidence, flags };
}

// ---------------------------------------------------------------------------
// 9. Latent per-muscle strength model
//    z_e  ~=  sum_m W[e][m] * theta_m  +  eps_e,   eps_e ~ N(0, tau_e^2)
//    theta_m = global + delta_m,  delta_m ~ N(0, sigma_b^2),  global ~ N(mu0, sigma0^2)
//    Closed-form posterior mean & variance via ridge / Cholesky.
// ---------------------------------------------------------------------------

export interface MuscleObservation { exerciseId: string; z: number; tau: number; }

function cholesky(A: number[][]): number[][] {
  const n = A.length, L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = A[i][j]; for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
    L[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / L[j][j];
  } return L;
}
function cholSolve(L: number[][], b: number[]): number[] {
  const n = L.length, y = new Array(n).fill(0), x = new Array(n).fill(0);
  for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i][k]*y[k]; y[i] = s / L[i][i]; }
  for (let i = n-1; i >= 0; i--) { let s = y[i]; for (let k = i+1; k < n; k++) s -= L[k][i]*x[k]; x[i] = s / L[i][i]; }
  return x;
}
function cholInverse(L: number[][]): number[][] {
  const n = L.length, inv: number[][] = Array.from({length:n},()=>new Array(n).fill(0));
  for (let c = 0; c < n; c++) { const e = new Array(n).fill(0); e[c] = 1; const col = cholSolve(L, e); for (let r = 0; r < n; r++) inv[r][c] = col[r]; }
  return inv;
}

export interface MuscleSolveOpts {
  muscles: string[];
  W: Record<string, Record<string, number>>;
  sigmaB?: number;   // how far a single muscle may deviate from the user's overall level
  sigma0?: number;   // prior width on the user's overall level
  mu0?: number;      // prior mean for overall level (from onboarding experience)
}
export interface MuscleSolveResult {
  global: number; globalSd: number;
  theta: Record<string, number>; thetaSd: Record<string, number>;
}

export function solveMuscleScores(obs: MuscleObservation[], o: MuscleSolveOpts): MuscleSolveResult {
  const { muscles, W } = o;
  const sigmaB = o.sigmaB ?? 0.55, sigma0 = o.sigma0 ?? 1.10, mu0 = o.mu0 ?? 0;
  const M = muscles.length, P = M + 1;           // params = [global, delta_1..delta_M]
  const idx = new Map(muscles.map((m, i) => [m, i + 1]));

  const A: number[][] = Array.from({ length: P }, () => new Array(P).fill(0));
  const b: number[] = new Array(P).fill(0);

  // Priors
  A[0][0] += 1 / (sigma0 * sigma0); b[0] += mu0 / (sigma0 * sigma0);
  for (let i = 1; i < P; i++) A[i][i] += 1 / (sigmaB * sigmaB);

  // Observations
  for (const ob of obs) {
    const row = W[ob.exerciseId]; if (!row) continue;
    const prec = 1 / (ob.tau * ob.tau);
    const x = new Array(P).fill(0);
    x[0] = 1;                                     // weights sum to 1 -> global loads fully
    for (const [m, w] of Object.entries(row)) { const j = idx.get(m); if (j != null) x[j] += w; }
    for (let i = 0; i < P; i++) { if (x[i] === 0) continue;
      b[i] += prec * x[i] * ob.z;
      for (let j = 0; j < P; j++) if (x[j] !== 0) A[i][j] += prec * x[i] * x[j]; }
  }

  const L = cholesky(A);
  const mean = cholSolve(L, b);
  const cov = cholInverse(L);

  const theta: Record<string, number> = {}, thetaSd: Record<string, number> = {};
  muscles.forEach((m, k) => {
    const j = k + 1;
    theta[m] = mean[0] + mean[j];
    thetaSd[m] = Math.sqrt(Math.max(cov[0][0] + cov[j][j] + 2 * cov[0][j], 1e-9));
  });
  return { global: mean[0], globalSd: Math.sqrt(Math.max(cov[0][0], 1e-9)), theta, thetaSd };
}

/** Only show a hard tier label when the estimate is tighter than about one sub-tier. */
export const LABEL_SD_THRESHOLD = 0.35;   // z units ~= 6.3 points ~= 1.26 sub-tiers
export function muscleVerdict(z: number, sd: number) {
  const score = scoreFromZ(z);
  if (sd > LABEL_SD_THRESHOLD) {
    const lo = rankFromScore(scoreFromZ(z - sd)), hi = rankFromScore(scoreFromZ(z + sd));
    return { state: 'calibrating' as const, score, range: [lo.label, hi.label], confidence: 1 - Math.min(1, sd) };
  }
  return { state: 'ranked' as const, score, ...rankFromScore(score), confidence: 1 - Math.min(1, sd) };
}

// ---------------------------------------------------------------------------
// 10. Overall score & percentile — with the correlation correction
// ---------------------------------------------------------------------------

export const PATTERNS = ['squat','hinge','horizontal_press','vertical_press','horizontal_pull','vertical_pull'] as const;
export type Pattern = typeof PATTERNS[number];
export const PATTERN_W: Record<Pattern, number> = {
  squat: 0.22, hinge: 0.22, horizontal_press: 0.17, vertical_press: 0.11,
  horizontal_pull: 0.14, vertical_pull: 0.14,
};
export const PATTERN_R: number[][] = [
  [1.00,0.85,0.68,0.62,0.66,0.58],
  [0.85,1.00,0.64,0.58,0.70,0.62],
  [0.68,0.64,1.00,0.80,0.72,0.66],
  [0.62,0.58,0.80,1.00,0.70,0.68],
  [0.66,0.70,0.72,0.70,1.00,0.82],
  [0.58,0.62,0.66,0.68,0.82,1.00],
];

/**
 * The correction most apps miss: the weighted mean of k CORRELATED standard
 * normals has SD sqrt(w'Rw) < 1, so dividing by it is required or every user
 * is dragged toward the 50th percentile and "Top X%" is simply wrong.
 */
export function overallFromPatterns(best: Partial<Record<Pattern, number>>) {
  const present = PATTERNS.filter(p => best[p] != null);
  if (!present.length) return { z: 0, score: 36, percentile: 0.5, coverage: 0 };
  const tot = present.reduce((s, p) => s + PATTERN_W[p], 0);
  const w = present.map(p => PATTERN_W[p] / tot);
  const mean = present.reduce((s, p, i) => s + w[i] * (best[p] as number), 0);
  let v = 0;
  present.forEach((p, i) => present.forEach((q, j) => {
    v += w[i] * w[j] * PATTERN_R[PATTERNS.indexOf(p)][PATTERNS.indexOf(q)];
  }));
  const z = mean / Math.sqrt(Math.max(v, 1e-6));
  return { z, score: scoreFromZ(z), percentile: normCdf(z), coverage: tot };
}

// ---------------------------------------------------------------------------
// 11. Cold start
// ---------------------------------------------------------------------------

export type Experience = 'never' | 'under_3m' | '3_12m' | '1_2y' | '2_5y' | '5y_plus';
export const EXPERIENCE_PRIOR: Record<Experience, { mu: number; sigma: number }> = {
  never:     { mu: -1.9, sigma: 0.70 },
  under_3m:  { mu: -1.5, sigma: 0.75 },
  '3_12m':   { mu: -1.0, sigma: 0.85 },
  '1_2y':    { mu: -0.4, sigma: 0.95 },
  '2_5y':    { mu:  0.1, sigma: 1.00 },
  '5y_plus': { mu:  0.5, sigma: 1.10 },
};

// ---------------------------------------------------------------------------
// 12. Display smoothing & guard rails
// ---------------------------------------------------------------------------

export interface DisplayState { shown: number; lastLabel: string; updatedAt: number; }
export const EWMA_ALPHA = 0.35, HYSTERESIS = 1.0, MAX_DAILY_MOVE = 3.0;

export function smoothScore(prev: DisplayState | null, raw: number, now = Date.now()): DisplayState {
  if (!prev) return { shown: raw, lastLabel: rankFromScore(raw).label, updatedAt: now };
  let next = prev.shown + EWMA_ALPHA * (raw - prev.shown);
  const days = Math.max((now - prev.updatedAt) / 864e5, 0.25);
  const cap = MAX_DAILY_MOVE * days;
  next = Math.max(prev.shown - cap, Math.min(prev.shown + cap, next));
  // Hysteresis: require clearing the boundary by HYSTERESIS before the label flips.
  const cand = rankFromScore(next);
  let label = cand.label;
  if (cand.label !== prev.lastLabel) {
    const prevRank = rankFromScore(prev.shown);
    const boundary = next > prev.shown ? (prevRank.nextAt ?? Infinity) : null;
    if (boundary != null && next < boundary + HYSTERESIS) label = prev.lastLabel;
  }
  return { shown: next, lastLabel: label, updatedAt: now };
}

// ---------------------------------------------------------------------------
// 13. End-to-end
// ---------------------------------------------------------------------------

export interface Profile { sex: Sex; bodyweightKg: number; age: number; ageMode: 'age_graded'|'open'; experience: Experience; }

export function classifyExercise(std: ExerciseStandard, p: Profile, loggedE1rmKg: number) {
  const perSideKg = std.perSide ? loggedE1rmKg : loggedE1rmKg;   // caller passes per-dumbbell for perSide lifts
  const raw = anchorsAtBodyweight(std, p.sex, p.bodyweightKg);
  const bwAdj = normaliseAnchors(std, raw, p.bodyweightKg);
  const anchors = ageGradeAnchors(bwAdj, p.age, p.ageMode);
  const load = normaliseLoad(std, perSideKg, p.bodyweightKg);
  const z = zFromLoad(load, anchors);
  return { z, score: scoreFromZ(z), percentile: normCdf(z), rank: rankFromScore(scoreFromZ(z)),
           nextLevelKg: loadFromZ(Math.min(z + 0.25, 4.5), anchors) };
}

export function tauFor(std: ExerciseStandard, r: RobustResult): number {
  const base = std.machineVariance === 'very_high' ? 0.52
             : std.machineVariance === 'high' ? 0.48
             : std.machineVariance === 'medium' ? 0.42
             : std.loadType === 'added_bodyweight' ? 0.32
             : std.perSide ? 0.34 : 0.28;
  const nPenalty = 0.09 / Math.max(r.nSessions, 1);
  const stalePenalty = Math.pow(Math.max(0, r.ageDays - 56) / 56, 2) * 0.09;
  return Math.sqrt(base * base + nPenalty + stalePenalty);
}

/** Strength decays after ~4 weeks without training that pattern. */
export const decayZ = (z: number, daysIdle: number) =>
  daysIdle <= 28 ? z : Math.max(z - 0.012 * ((daysIdle - 28) / 7), z * 0.6);
```

---

## PART 6 — WORKED EXAMPLE (verifies the whole chain)

80 kg male, age 31, bench press e1RM 110 kg.

1. `anchorsAtBodyweight` → [56, 75, 98, 124, 151] kg.
2. `ln` → [4.0254, 4.3175, 4.5850, 4.8203, 5.0173]; ln(110) = 4.7005.
3. PCHIP through (ln load → z) at 4.7005 → **z ≈ +0.418**.
4. `normCdf(0.418)` → percentile **66.2** → "Top 34%".
5. `scoreFromZ` → 36 + 18(0.418) = **43.5**.
6. `rankFromScore(43.5)` → **Intermediate II**, next Intermediate III at 46.0, **2.5 points to go**.
7. Same lifter also squats 150 kg (z = +0.41), deadlifts 190 kg (z = +0.52), OHP 70 kg (z = +0.49), rows 105 kg (z = +0.51), pull-up +30 kg (z = +0.38). Weighted mean z = 0.452; w'Rw with all six present = 0.7176, sqrt = 0.847. **z_overall = 0.452 / 0.847 = 0.534** → score **45.6**, percentile **70.3** → "Top 30%". Note how the correlation correction lifted the percentile from 67 to 70 — skip it and you systematically under-rate consistent lifters.
8. Feed the six z-scores into `solveMuscleScores` with W. Chest gets direct evidence only from bench (τ = 0.28); quads from squat (τ = 0.28); calves get **no** direct evidence, so θ_calves collapses to the global term (≈ 0.53, Intermediate III) with sd ≈ σ_b = 0.55 > 0.35 → UI shows "Calves — not enough data, add a calf raise" rather than a fake label. That is the behaviour you want.

---

## PART 7 — UI COPY RULES FOR THE WORLD-STANDINGS TAB

- Header: the overall rank ring — `Intermediate II · 43.5 pts · 2.5 to Intermediate III`, with the distribution curve and the marker at percentile 66.
- Subhead must always name the population: `vs. 27M lifters worldwide · age-graded · 80 kg male`.
- Muscle map: colour by score using the same 8-tier palette. Untested muscles render hollow with a dashed outline and a tap target that says "Log a set to unlock".
- Never write "Your calves are Beginner". Write "Calves — your biggest opportunity (Novice I, ~14 kg from Novice II on seated calf raise)". Convert every gap back into a concrete load via `loadFromZ`.
- Show the confidence band on every muscle: `Quadriceps · Advanced I (±1 tier)` until sd < 0.35.
- Rank-up moment: fire a full-screen celebration only on a *band* change (Novice → Intermediate), a lighter one on a sub-tier change, and never on a fluctuation that hysteresis has already suppressed.

## PART 8 — SOURCES

- https://strengthlevel.com/about — percentile anchors (5/20/50/80/95), 195,513,376 lifts / 27,893,268 users / 287 exercises, methodology
- https://strengthlevel.com/strength-standards/male/kg and /female/kg — full bench/squat/deadlift/OHP/row tables
- https://strengthlevel.com/strength-standards/{hip-thrust,leg-press,dips,front-squat,incline-bench-press,lat-pulldown,romanian-deadlift,barbell-curl,leg-extension,lying-leg-curl,seated-cable-row,tricep-pushdown,dumbbell-lateral-raise,hack-squat,pull-ups,chin-ups,close-grip-bench-press,sumo-deadlift,bulgarian-split-squat,barbell-shrug,seated-calf-raise,dumbbell-bench-press,dumbbell-shoulder-press}/kg
- https://symmetricstrength.com/about — 5 movement categories, weighted-average muscle scores, Wilks-derived normalisation, Foster/McCulloch quadratic age fits
- https://gravitus.com/strength-standards/ — independent corroboration of the 5/20/50/80/95 anchors, 10M workouts / 300k lifters
- https://link.springer.com/article/10.1186/s40798-026-01111-z — Montenegro et al., Sports Med Open 2026;12:136, n=101,898, quantile-regression β coefficients, square-cube argument against linear multipliers
- https://www.jsams.org/article/S1440-2440(24)00246-9/fulltext — van den Hoek et al., JSAMS 2024;27(10):734-742, DOI 10.1016/j.jsams.2024.07.005, n=809,986
- https://fitnessvolt.com/strength-standards/research/powerlifting-strength-percentiles/ — OpenPowerlifting percentiles by weight class
- https://en.wikipedia.org/wiki/Wilks_coefficient — Wilks 1994 and Wilks-2020 coefficients
- https://en.wikipedia.org/wiki/Sinclair_coefficient — Sinclair formula and cycle coefficients
- https://www.powerlifting.sport/fileadmin/ipf/data/ipf-formula/IPF_GL_Coefficients-2020.pdf and the OpenPowerlifting reference implementation (crates/coefficients/src/goodlift.rs) — full-precision IPF GL coefficients
- https://www.usapowerlifting.com/wp-content/uploads/2021/01/USAPL-Age-Coefficients.pdf — Foster and McCulloch age coefficient tables
- https://arxiv.org/abs/2603.17495 — Marzagao, weight-dependent 1RM equation, 303,494 near-failure sets
- https://www.strongermobileapp.com/blog/rpe-chart and /standards/bench-press — canonical RTS RPE chart; the incumbent app's six-tier OpenPowerlifting-based standards
- https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7579505/ — EMG %MVC for pectoralis/anterior deltoid/triceps across bench inclinations

## Risks

- Reference-population mismatch is the single biggest churn risk: if a user's 1.5×BW bench reads 'Intermediate' against the gym population but 'Novice' against competitors, and the app doesn't say which, they will assume the app is broken.
- Strength Level's data is self-reported calculator input, not verified lifts. It is inflated at the top (people report their best-ever guess) and skewed by who bothers to use a 1RM calculator. Do not present it as 'the world' without qualification; call it 'app lifters'.
- The contribution matrix W is the weakest link — it is EMG-informed judgement, not measured. If weights are wrong, a user with a huge bench and no triceps isolation will be told their triceps are Elite. Mitigate with wide priors, visible confidence, and a plan to refit W from real data.
- Machine exercise standards (leg press, hack squat, chest press, cable stacks) vary 20–40% by manufacturer due to leverage, sled weight and pulley ratios. Leg press 'Elite' at 460 kg on one machine is Intermediate on another. Either exclude machines from muscle classification or apply a large τ penalty.
- The McCulloch coefficients are calibrated on competitive masters and become generous past age 75 (2.05× at 80). Capping is required or an 82-year-old will be told they are World Class.
- The Marzagao 1RM equation was optimised on an internal-consistency criterion with no directly measured maxima in the dataset, and has a singularity near w ≈ 1.74 in its unit system. Validate against known 1RMs before making it the default.
- Sex-binary tables exclude nonbinary and transgender users. Shipping only 'male/female' tables will draw criticism; offer an explicit 'compare me against' selector rather than inferring from a gender field.
- Telling someone their quadriceps are 'Beginner' is demotivating in a way 'Advanced triceps' is not. The muscle-map UI needs an asymmetric tone: frame the weakest group as 'biggest opportunity', not as a failing grade.
- Rank inflation over time: as the app's own user base becomes the reference population and improves, thresholds drift. Freeze the reference distribution per season/version and announce recalibrations, or people will lose ranks without getting weaker.
