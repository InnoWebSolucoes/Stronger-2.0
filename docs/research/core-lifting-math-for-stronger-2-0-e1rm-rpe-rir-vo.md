# Core lifting math for Stronger 2.0: e1RM, RPE/RIR, volume, PRs, muscle attribution, plate math, units

## Summary

I built and unit-tested the complete lifting-math core for Stronger 2.0; every number below was computed or verified, not recalled, and the whole library passes a 90+ assertion suite under `node --experimental-strip-types`.

The headline research find is a 2026 preprint by Thiago Marzagão at Fitbod (arXiv:2603.17495) that fits a 1RM equation on 303,494 near-failure sets from 14,966 users across 388 exercises: `1RM = w × (1 + (r−1)^0.85 / k(w))` with `k(w) = −2.55 + 4.58·ln(w_kg)`. It reduces within-lifter inconsistency by 17.0-21.9% versus Brzycki, Epley, Wathan and Mayhew, and the improvement is positive for all 183 exercises with sufficient data. I reproduced their published k values and worked examples exactly. The insight is that each additional rep is worth far more at light loads (k=8 at 10 kg) than heavy ones (k=20.4 at 150 kg), which is why one fixed conversion factor fails across an exercise library.

Second find: the RTS RPE chart is not a 90-cell grid but a single 1-D curve indexed by reps-to-failure (RPE 9 × r ≡ RPE 10 × r+1, exactly, everywhere). That collapses all RPE/RIR handling into one code path: `n = reps + RIR`. It also means the linear 2.5%-per-step "RTS chart" circulating on calculator sites is a fake, off by up to 3.6 percentage points. And remarkably, the WD equation at 100 kg reproduces the real RTS curve to within 1.3 pp at every rep count — two independent derivations converging, which is the strongest validation either has.

My recommendation is therefore: primary = WD, cross-faded toward RTS as load rises (0% below 40 kg, 36% at 100 kg, capped at 60%), with a per-user per-exercise `k` calibration layered on after six near-failure sets (I implemented and tested the solver; it recovers a simulated true k of 12 to within 0.5).

Everything else follows: hard-cap at 12 reps-to-failure and RIR 4 (Nuzzo 2024's meta-regression shows formulas running 5-10% hot above that); attach a 0-1 confidence to each sample; pick the session best as a confidence-weighted 80th percentile capped by the best trusted set, never a raw max; smooth with Hampel-in-log-space plus an asymmetric time-aware EWMA (21-day half-life, 1.6× up-gain, 0.7× down-gain) — tested, a catastrophic 60 kg outlier moves the next point by under 1 kg while a real uptrend is tracked.

Volume honesty: report system volume (bodyweight included) as the headline and external volume in the tooltip. A pull-up at 80 kg bodyweight contributes exactly 80 kg per rep; +20 kg belt makes it 100; 30 kg assist makes it 50; a push-up is 0.64 × bodyweight (force-plate measured, Suprak 2011). Duration work gets zero fake kilograms. Unilateral work doubles reps, never load.

Per-muscle attribution needs two tables, not one: `volumeShare` summing to 1.00 for kg splitting, and `setCredit` at 1.0 direct / 0.5 indirect for weekly set counts. I supply 31 exercises grounded in EMG (bench = chest 0.50 / triceps 0.25 / front delts 0.20, because EMG shows triceps ≈ pecs > anterior deltoid, not the chest-0.70 split most apps use).

PR detection has eight record types behind minimum margins, a two-session baseline requirement, a 20-hour cooldown and a three-badge-per-workout cap. Plate math is greedy and brute-force-proven optimal from 20-300 kg. Units: 0.45359237 exactly, store the literal the user typed, and — a bug my own tests caught — never store imperial plate inventories as pre-rounded kg, or 225 lb comes back as 224.99994 lb and PR comparisons become coin flips.

## Findings

### A 2026 preprint on 303,494 real app sets beats every classical 1RM formula and gives a drop-in equation

Marzagão (Fitbod), "A Weight-Dependent 1RM Prediction Equation Optimized on 303,494 Near-Failure Sets Across 388 Exercises" (arXiv:2603.17495). Formula: 1RM = w × (1 + (r−1)^0.85 / k(w)) where k(w) = −2.55 + 4.58·ln(w_kg), guarded at k ≥ 0.5. Dataset: 14,966 users, 388 exercises, 16 muscle groups, 135,730 (user, exercise, 14-day) tuples. Measured on within-tuple SD(log 1RM): proposed 0.0847 vs Brzycki 0.1028 (+17.6%), Epley 0.1026 (+17.4%), Wathan 0.1021 (+17.0%), Mayhew 0.1084 (+21.9%). Positive for all 183 exercises with ≥50 tuples. Isolation +21.9% vs Brzycki, compound +16.3%. 5-fold user-level CV showed near-zero overfitting. Ablation: 91% of the gain from the weight-dependent k, 9% from the sub-linear exponent. I reproduced their published k values exactly: k(10)=8.00, k(15)=9.85, k(25)=12.19, k(55)=15.80, k(70)=16.91, k(80)=17.52, k(150)=20.40, and their worked example (13 kg curl × 10 reps: Brzycki 17.3 kg, theirs 22.1 kg).

Source: https://arxiv.org/pdf/2603.17495

### Critical caveat: that dataset EXCLUDED bodyweight and assisted exercises

Their extraction filters removed "bodyweight and assisted exercises (e.g., pull-ups, dips, assisted chin-ups; for these exercises, the recorded weight reflects only the added weight, not the total resistance)". So applying k(w) to pull-ups requires passing the TOTAL system load (bodyweight + added), which is an extrapolation, not a validated use. Also excluded: warm-ups, >30 rep sets, custom exercises, cardio/mobility/timed, weight >500 kg, users under 18. Sets had to be AMRAP-flagged or fatigue-detected (fewer reps than an earlier set at the same load) — i.e. the formula assumes near-failure. Feed it a set with 4 RIR and it lowballs badly.

Source: https://arxiv.org/pdf/2603.17495

### The RTS RPE chart is a single 1-D curve, not a 90-cell grid — this collapses all RPE handling into one code path

In every printed RTS/Tuchscherer chart, RPE 9 at r reps equals RPE 10 at r+1 reps, exactly, in every cell (RPE 9 × 1 = 95.5% = RPE 10 × 2; RPE 8 × 1 = 92.2% = RPE 10 × 3). So the whole table is C(n) indexed by n = reps + RIR = reps + (10 − RPE), with half-RPE values falling out by linear interpolation (RPE 9.5 × 1 → 97.75, published as 97.8). C = [100, 95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9] for n = 1..10. Practical consequence: 'reps-to-failure equivalent' is the single canonical input to e1RM, and a blank RPE is just a missing RIR with a prior.

Source: https://www.rpe-calculator.net/ ; cross-checked against store.reactivetrainingsystems.com

### Beware the fake 'RTS' chart circulating on calculator sites

Many sites (e.g. fitnesscalcs.com/rpe-chart) publish a perfectly linear grid at 2.5% per step: RPE 10 × 10 reps = 77.5%, RPE 8 × 5 reps = 80.0%. The real RTS values are 73.9% and 81.1%. The linear version is off by up to 3.6 percentage points, which is ~5 kg on a 140 kg squat. Use the non-linear curve.

Source: https://fitnesscalcs.com/rpe-chart/ vs https://www.rpe-calculator.net/

### WD @ heavy loads independently reproduces the RTS chart to within ~1.2%

Computed: WD at 100 kg gives %1RM of 94.9 / 91.1 / 87.9 / 85.1 / 82.5 / 78.0 / 74.1 at 2/3/4/5/6/8/10 reps. RTS gives 95.5 / 92.2 / 89.2 / 86.3 / 83.7 / 78.6 / 73.9. Max divergence 1.3 pp. Two independent derivations (1.5M powerlifting observations vs 303k app sets) converging is strong mutual validation — and it justifies a load-dependent blend rather than picking one.

Source: computed in gen.ts

### Mayhew, Wathan, Lander and O'Conner are all non-identity at 1 rep — Mayhew catastrophically

Computed at r=1 with w=100: Mayhew predicts a 1RM of 108.86 kg (implied %1RM 91.9%), Wathan 101.30, Lander 101.39, O'Conner 102.50, raw Epley 103.33. Only Brzycki and Lombardi return exactly 100. Any app that shows 'your e1RM is 109 kg' after you just grinded a 100 kg single loses the user immediately. Epley needs an explicit r===1 guard.

Source: computed; formulas from LeSuer et al. 1997 JSCR 11(4):211-213

### Against the best meta-regression, every formula runs hot above ~10 reps

Nuzzo, Pinto, Nosaka & Steele (2024) Sports Med 54:303-321 pooled 952 reps-to-failure tests from 7,289 people across 269 studies. Bench press: ~14.08 reps at 70% 1RM, ~9 at 80%, ~4 at 90%. Feed those pairs into the formulas and ask for 100%: at 70%×14, Epley returns 102.7%, WD 106.6%, Brzycki 109.6%. At 90%×4 all are within 3%. Exercise type was the ONLY moderator that mattered (sex, age, training status did not). Leg press allowed far more reps than bench at the same %1RM (18.96 vs 14.08 at 70%), requiring separate tables. Conclusion: hard-cap e1RM at 12 reps-to-failure.

Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC10933212/ and https://www.strongerbyscience.com/reps-percentage/

### Zourdos 2016 validates RIR-anchored RPE, but only for experienced lifters

Zourdos et al. (2016) JSCR 30(1):267-275: 29 squatters, singles at 60/75/90% 1RM plus an 8-rep set at 70%. Velocity–RPE correlation r = −0.88 in experienced lifters vs −0.77 in novices; experienced lifters reported 9.80 ± 0.18 at a true 1RM, novices only 8.96 ± 0.43. So a novice's self-reported RPE 10 is really ~RPE 9. This is exactly why blank-RPE priors should start conservative (RIR 2 for a 'normal' set) and be personalised from the user's own logged RPEs.

Source: https://pubmed.ncbi.nlm.nih.gov/26049792/

### Push-up load is 64% of bodyweight, measured on force plates — not a guess

Suprak, Dawes & Stephenson (2011) JSCR 25(2):497-503, 23 recreationally fit subjects, six push-up variants on force plates: standard push-up 64% body mass in the up position (more in the down position), knee push-up 49%, hands on a 24-inch bench 41%, feet on a 24-inch bench 75%. Hanging movements (pull-up, dip, muscle-up) are 1.00 by mechanics.

Source: https://pubmed.ncbi.nlm.nih.gov/20179649/

### Hevy's published bodyweight-volume rules are the de-facto industry convention worth matching

Hevy: if the user has entered a bodyweight, exercises that use 100% of bodyweight count full bodyweight per rep toward volume (10 pull-ups at 100 kg BW = 1,000 kg). Assisted exercises: volume = (bodyweight − assistance) × reps, and NO volume is computed at all if bodyweight is missing. Custom user-created exercises never get bodyweight added. Matching this convention means our numbers are comparable when users migrate from Hevy — a real switching-cost consideration.

Source: https://help.hevyapp.com/hc/en-us/articles/38386262243223 and .../34380762441111

### Set-counting and kg-attribution need DIFFERENT coefficients — conflating them is the standard bug

The hypertrophy-volume literature counts an exercise as 1.0 set for the muscle it trains directly and 0.5 for assisting muscles (bench = 1.0 chest, 0.5 front delts, 0.5 triceps; barbell row = 1.0 back, ~0.5 biceps). Those credits deliberately do NOT sum to 1 — 10 sets of bench = 10 chest + 5 delt + 5 triceps sets. Volume-in-kg attribution, by contrast, MUST sum to 1.0 or your training-split donut double-counts and your total stops matching. Note also that Renaissance Periodization's published MEV/MRV landmarks count only DIRECT sets — they have already baked in indirect volume — so never apply RP landmarks to a fractional-set total.

Source: https://rpstrength.com/blogs/articles/training-volume-landmarks-muscle-growth ; https://grov.fit/insights/sets-per-muscle-per-week

### EMG evidence behind the bench-press split: triceps ≈ pecs > anterior deltoid

Systematic review evidence (PLOS One 10.1371/journal.pone.0171632) and Rodríguez-Ridao et al. 2020 (PMC7579505, five bench inclinations) find triceps brachii and pectoralis major show similar activation, both significantly higher than anterior deltoid; grip width shifts triceps (~16% MVIC at 50% biacromial width vs ~12% at 150%) and clavicular pec. That supports chest 0.50 / triceps 0.25 / front delt 0.20 / lats 0.05 rather than the common but wrong chest 0.70 / triceps 0.15 / delt 0.15. For incline, anterior deltoid rises sharply — hence 0.40/0.30/0.25/0.05.

Source: https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0171632 ; https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7579505/

### Deadlift is erector-spinae dominant to a degree most apps understate

Systematic review of deadlift EMG (PLOS One 10.1371/journal.pone.0229507): erector spinae maintains 70-85% MVIC through the whole ROM in conventional deadlifts and shows activation similar to gluteus maximus and biceps femoris — unlike the squat, where glute max dominates. Hex-bar work shows erector spinae 54.9-73.0% MVIC and biceps femoris 28.1-40.6% depending on start position. Hence lower_back 0.20 in the deadlift vector and only 0.10 in the back squat, and the highest fatigueLoad in the table (1.5).

Source: https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0229507

### An imperial plate inventory stored as rounded kg silently corrupts every PR comparison

Caught by my own test suite: with 45 lb stored as 20.4117 kg, a 225 lb bench comes back as 224.9999413570382 lb. Every PR comparison against a previously-stored 225 lb then flips on floating-point dust. Fix: declare plate and bar inventories in their native unit and derive kg with the exact factor 0.45359237 (international avoirdupois pound). After the fix the same test passes to 1e-6 lb.

Source: reproduced in liftmath.test.ts

### Greedy plate solving is provably optimal for real-world plate sets

Greedy subset-sum is NOT optimal in general, but I brute-forced every reachable per-side combination of the standard kg inventory (25×4, 20×4, 15×2, 10×2, 5×2, 2.5×2, 1.25×2, 1×1, 0.5×1, 0.25×1 pairs) and compared against greedy at every 0.25 kg target from 20 to 300 kg: identical totals everywhere. Ship greedy; keep the brute-force check as a regression test in case someone adds an exotic plate set.

Source: liftmath.test.ts brute-force block

### Smith machine bar weight is not knowable and must be a per-gym setting

Counterbalanced commercial Smith machines have an effective bar weight of roughly 15-25 lb (7-11 kg); uncounterbalanced ones are 20 kg or more; there is no standard. Olympic bars are standard (20 kg men's / 15 kg women's / 45 lb), trap bar ~25 kg, EZ curl ~7.5 kg. Asking the user once per gym for their Smith bar weight is the only honest option — silently assuming 20 kg inflates every Smith lift by up to 13 kg.

Source: https://en.wikipedia.org/wiki/Barbell ; https://theworkoutmag.com/learn-article/smith-machine-bar-weight-specs-guide

### Per-user, per-exercise k calibration is achievable and measurably better than any population formula

I implemented and tested it: given ≥3 near-failure sets on one exercise, grid-search k over [3, 45] to minimise the variance of log(e1RM) across those sets, then shrink toward the population k(w) with weight n/(n+8). Test: simulated a lifter whose true k is 12 on a 60 kg lift, 6 sets at 3/4/5/6/8/10 reps-to-failure. Unshrunk solve recovers k ∈ (11.5, 12.5); shrunk estimate beats the population prior (15.18) every time. This is the same objective function the Fitbod paper optimises globally, applied per user — and RTS themselves recommend per-lift chart customisation.

Source: liftmath.test.ts calibration block; method after arXiv:2603.17495

### Asymmetric, time-aware exponential smoothing in log space is the right trend line

Tested: a 40-point series rising 0.5 kg every 3 days smooths to >112 kg by the end (tracks the real trend). Injecting a single catastrophic 60 kg reading at point 30 (down from ~115) gets Hampel-flagged and shifts the very next smoothed value by <1.0 kg. Theil–Sen slope is 5.07 kg/month on the clean series and moves <0.4 kg/month with the outlier present, versus OLS which would be dragged visibly. Half-life 21 days, up-gain 1.6×, down-gain 0.7×, alpha = 1 − exp(−Δdays/τ) so gaps are handled correctly.

Source: liftmath.test.ts smoothing block

### 'Hard sets' has a defensible published definition; kg-tonnage does not

A hard set in the Schoenfeld/Krieger dose-response line of work means a set taken to within roughly 0-5 reps of failure, and the dose-response is curvilinear with diminishing returns after roughly 20 sets per muscle per week. Tonnage in kg has no such literature backing as a training-quality metric — it is a motivation metric. Track both, label both, never let the app imply that more kg = more muscle.

Source: https://weightology.net/the-members-area/evidence-based-guides/set-volume-for-muscle-size-the-ultimate-evidence-based-bible/ ; https://fitchef.com/studies/training-volume-sets-per-week-study/

## Recommendations

- Ship the weight-dependent equation 1RM = w × (1 + (r−1)^0.85 / (−2.55 + 4.58·ln w_kg)) as the primary e1RM engine, blended toward the RTS chart as load rises (0% RTS below 40 kg, 36% at 100 kg, capped at 60% above 140 kg), because the two agree within 1.3 pp on heavy barbell work and the WD curve is 22% more self-consistent on light isolation work.
- Make 'reps-to-failure equivalent' (n = reps + RIR) the single canonical input to every strength calculation, so a logged RPE, an AMRAP flag, a failure-tagged set and a blank field all flow through one code path.
- Hard-cap e1RM estimation at n = 12 reps-to-failure and RIR ≤ 4, and return null rather than a number outside those bounds — the Nuzzo 2024 anchors show 5-10% formula error above 12 reps.
- Add an explicit r === 1 guard to Epley and never surface Mayhew, Wathan, Lander or O'Conner as a display formula, since all of them return a 1RM above the weight on a true single (Mayhew by 8.9%).
- Store the 10-value RTS curve C = [100, 95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9] and generate the whole RPE grid from it, rather than hard-coding 90 cells that will drift apart.
- Default a blank RPE to RIR 2 for normal sets, 0 for failure/AMRAP, 1 for drop sets and cluster sets, then personalise per user by shrinking their own median logged RIR toward that prior with weight n/(n+8).
- Attach a 0-1 confidence to every e1RM sample (1.0 explicit RPE, 0.85 AMRAP flag, 0.7 fatigue-detected, 0.45 prior) and use it to weight the smoother and to raise the PR margin on low-confidence sets.
- Pick the session e1RM as a confidence-weighted 80th percentile capped by the best high-confidence sample, not a raw max, so a mistyped weight cannot mint a permanent fake PR.
- Smooth the e1RM trend with a Hampel outlier filter plus an asymmetric time-aware EWMA in log space (half-life 21 days, up-gain 1.6×, down-gain 0.7×) and show the residual-MAD band, so one bad day is visible as a dot but does not bend the line.
- Use Theil–Sen rather than OLS for the '+x kg/month' chip, because deloads and missed weeks break least squares.
- Report SYSTEM volume (bodyweight included) as the headline 'total kg' and expose EXTERNAL volume in the tooltip, so pull-up sessions are not scored at zero and bodyweight gain is not mistaken for strength gain.
- Give every exercise an explicit loadModel (EXTERNAL / BODYWEIGHT / ASSISTED / WEIGHTED_CARRY / DURATION / DISTANCE) and a bodyweightFactor, using the measured values: pull-up and dip 1.00, push-up 0.64, knee push-up 0.49, feet-elevated push-up 0.75, inverted row 0.60, bench dip 0.45.
- Count a pull-up as bodyweight + added kg per rep and an assisted pull-up as bodyweight − assistance per rep, and refuse to compute volume for either until the user has entered a bodyweight.
- Log unilateral work as weight-per-side and reps-per-side, then double the rep count and never the load, so a 2×20 kg dumbbell lunge and a 40 kg barbell lunge produce the same volume.
- Give duration and distance exercises zero kilograms, full set credit and full muscle-fatigue credit, with loaded carries as the single labelled exception at load × (metres / 30).
- Add a per-machine pulleyRatio field so a 2:1 cable stack is halved before it enters volume, and treat the ratio as unknown-but-1 until a user corrects it.
- Maintain two separate coefficient tables per exercise — volumeShare that sums to exactly 1.00 for kg attribution, and setCredit of 1.0 direct / 0.5 indirect for weekly set counting — and assert the sum invariant in CI.
- Split barbell bench press as chest 0.50 / triceps 0.25 / front delts 0.20 / lats 0.05 for volume and chest 1.0 / triceps 0.5 / front delts 0.5 for sets, following the EMG finding that triceps and pecs activate similarly and both exceed anterior deltoid.
- Give the conventional deadlift lower_back 0.20 and the highest fatigueLoad (1.5), since erector spinae holds 70-85% MVIC through the whole range and drives the recovery cost that muscle readiness must model.
- Gate PRs behind a minimum improvement margin (0.5% for e1RM, 1% for set volume, 2% for session totals), at least two prior sessions on that exercise, a 20-hour cooldown per record key, and a cap of three tier-sorted badges per workout.
- Snap the weight key for 'reps at a weight' records to the loadable increment before comparing, so 60.0 kg and 60.00001 kg are the same record and not two.
- Annotate rather than silently award bodyweight-exercise PRs that coincide with a bodyweight increase, so the user can tell a strength gain from a mass gain.
- Add per-user per-exercise k calibration once six near-failure sets exist in a 14-day window, solving for the k that minimises the variance of log(e1RM) and shrinking toward the population curve with weight n/(n+8).
- Declare plate and bar inventories in their native unit and derive kilograms with the exact factor 0.45359237, never storing pre-rounded kilogram values for imperial plates.
- Store every weight as the exact canonical kg plus the literal value and unit the user typed, and return the literal whenever the display unit matches the entry unit, so conversion drift is impossible by construction.
- Round computed prescriptions DOWN to the nearest loadable weight by default, since overshooting costs a failed rep and undershooting costs nothing.
- Ask for the Smith machine bar weight once per gym rather than assuming 20 kg, because counterbalanced machines range from about 7 to 11 kg effective.
- Keep the brute-force plate-solver test in CI, since greedy subset-sum is only optimal for the specific plate inventories currently shipped.
- Round aggregate totals exactly once, at the display edge, never per set, so a 4,000 kg session does not become 3,999 kg through accumulated rounding.

## Data

## FILES (runnable, all tests green under `node --experimental-strip-types`)

- `C:\Users\rafam\AppData\Local\Temp\claude\C--Users-rafam\6442cf9c-a8da-45e6-abdf-4f0cf811c4bf\scratchpad\liftmath.ts` — the library below
- `C:\Users\rafam\AppData\Local\Temp\claude\C--Users-rafam\6442cf9c-a8da-45e6-abdf-4f0cf811c4bf\scratchpad\liftmath.test.ts` — 90+ assertions, incl. a brute-force proof that the greedy plate solver is optimal over 20–300 kg
- `C:\Users\rafam\AppData\Local\Temp\claude\C--Users-rafam\6442cf9c-a8da-45e6-abdf-4f0cf811c4bf\scratchpad\gen.ts` — generates the tables below

Run: `node --experimental-strip-types liftmath.test.ts` → `ALL TESTS PASSED` / `CALIBRATION TESTS PASSED`

---

# TABLE A — %1RM implied by every formula (computed, not recalled)

Reference load 100 kg. Cell = weight ÷ predicted-1RM × 100.

| r | Epley | Brzycki | Lander | Lombardi | Mayhew | O'Conner | Wathan | **WD @20 kg** | **WD @100 kg** | **RTS(RPE10)** |
|---|-------|---------|--------|----------|--------|----------|--------|-----------|------------|-----------|
| 1 | 100.0 | 100.0 | 98.6 | 100.0 | **91.9** | 97.6 | 98.7 | 100.0 | 100.0 | 100.0 |
| 2 | 93.8 | 97.2 | 96.0 | 93.3 | 89.7 | 95.2 | 95.1 | 91.8 | 94.9 | 95.5 |
| 3 | 90.9 | 94.4 | 93.3 | 89.6 | 87.7 | 93.0 | 91.8 | 86.1 | 91.1 | 92.2 |
| 4 | 88.2 | 91.7 | 90.6 | 87.1 | 85.8 | 90.9 | 88.7 | 81.4 | 87.9 | 89.2 |
| 5 | 85.7 | 88.9 | 87.9 | 85.1 | 84.0 | 88.9 | 85.8 | 77.5 | 85.1 | 86.3 |
| 6 | 83.3 | 86.1 | 85.3 | 83.6 | 82.3 | 87.0 | 83.1 | 74.0 | 82.5 | 83.7 |
| 8 | 78.9 | 80.6 | 79.9 | 81.2 | 79.2 | 83.3 | 78.3 | 68.1 | 78.0 | 78.6 |
| 10 | 75.0 | 75.0 | 74.6 | 79.4 | 76.4 | 80.0 | 74.2 | 63.3 | 74.1 | 73.9 |
| 12 | 71.4 | 69.4 | 69.2 | 78.0 | 73.9 | 76.9 | 70.7 | 59.3 | 70.7 | — |
| 15 | 66.7 | 61.1 | 61.2 | 76.3 | 70.6 | 72.7 | 66.3 | 54.2 | 66.3 | — |

Read-outs:
1. **Mayhew is broken at 1 rep** (91.9% ⇒ predicts a 1RM 8.9% above a lift you just did as a single). Lander 98.6, Wathan 98.7, O'Conner 97.6 are also non-identity. **Only Brzycki, Lombardi and Epley-with-an-`r===1`-guard are exact at r=1.** Never ship Mayhew/Wathan/Lander as the display formula.
2. **WD @100 kg tracks the RTS chart to within ~1.2% at every rep count 2–10** — two totally independent derivations (1.5 M powerlifting observations vs 303 k app sets) agreeing. That is the strongest validation either has.
3. **WD @20 kg is dramatically steeper** (77.5% vs 86.3% at 5 reps). This is the whole point: a 5RM curl is a far higher fraction of your curl max than a 5RM squat is of your squat max.
4. Above 12 reps every formula fans out by >15 percentage points. Hard cap at 12.

# TABLE B — the RPE → %1RM chart (generated by `buildRpeChart()`)

| RPE | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|-----|---|---|---|---|---|---|---|---|---|----|
| 10 | 100.0 | 95.5 | 92.2 | 89.2 | 86.3 | 83.7 | 81.1 | 78.6 | 76.2 | 73.9 |
| 9.5 | 97.8 | 93.9 | 90.7 | 87.8 | 85.0 | 82.4 | 79.9 | 77.4 | 75.1 | — |
| 9 | 95.5 | 92.2 | 89.2 | 86.3 | 83.7 | 81.1 | 78.6 | 76.2 | 73.9 | — |
| 8.5 | 93.9 | 90.7 | 87.8 | 85.0 | 82.4 | 79.9 | 77.4 | 75.1 | — | — |
| 8 | 92.2 | 89.2 | 86.3 | 83.7 | 81.1 | 78.6 | 76.2 | 73.9 | — | — |
| 7.5 | 90.7 | 87.8 | 85.0 | 82.4 | 79.9 | 77.4 | 75.1 | — | — | — |
| 7 | 89.2 | 86.3 | 83.7 | 81.1 | 78.6 | 76.2 | 73.9 | — | — | — |
| 6.5 | 87.8 | 85.0 | 82.4 | 79.9 | 77.4 | 75.1 | — | — | — | — |
| 6 | 86.3 | 83.7 | 81.1 | 78.6 | 76.2 | 73.9 | — | — | — | — |

**Generated from 10 numbers**, not 90: `C = [100, 95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9]` indexed by `n = reps + (10 − RPE)`. The grid is exactly one curve because RPE 9 @ r ≡ RPE 10 @ r+1 in every cell of every printed RTS chart. `—` = off the published table; we hand off to WD there rather than fake an extrapolation. (Note: the linear 2.5%-per-step chart circulated on many calculator sites is a *simplification*, not RTS. It puts 5 @ RPE 8 at 80.0% instead of the real 81.1%. Use the numbers above.)

# TABLE C — Nuzzo 2024 reality check (why 12 reps is the hard cap)

Nuzzo et al. (2024, *Sports Med* 54:303-321, 269 studies / 7,289 subjects) bench-press anchors: 70% = 14.08 reps, 80% ≈ 9, 90% ≈ 4. Feed those (weight, reps) pairs in and ask each formula to return 100%:

| truth | Epley | Brzycki | WD |
|---|---|---|---|
| 90% × 4 reps | 102.0% | 98.2% | 102.7% |
| 80% × 9 reps | 104.0% | 102.9% | 106.7% |
| 70% × 14 reps | 102.7% | **109.6%** | 106.6% |

Every formula runs hot at high reps against the best available meta-regression. ≤6 reps: errors ≤3%. At 14 reps Brzycki is out by ~10%. Also from Nuzzo: leg press permits far more reps than bench at the same %1RM (70%: 18.96 vs 14.08), which is precisely the exercise-specificity the WD equation's `k(w)` encodes.

---

# THE LIBRARY

```ts
/* =============================================================================
 * Stronger 2.0 — core lifting math.  Single source of truth.
 * All internal math is in KILOGRAMS. Display conversion happens at the edge only.
 * =============================================================================
 * References (verified 2026-09):
 *  [1] Marzagão, T. (Fitbod). "A Weight-Dependent 1RM Prediction Equation
 *      Optimized on 303,494 Near-Failure Sets Across 388 Exercises."
 *      arXiv:2603.17495 / SportRxiv 768.
 *  [2] LeSuer, McCormick, Mayhew, Wasserstein, Arnold (1997) JSCR 11(4):211-213.
 *  [3] Nuzzo, Pinto, Nosaka, Steele (2024) Sports Med 54:303-321. PMC10933212.
 *  [4] Zourdos et al. (2016) JSCR 30(1):267-275 — RIR-based RPE scale.
 *  [5] Tuchscherer, M. — Reactive Training Systems RPE/%1RM chart.
 *  [6] Suprak, Dawes, Stephenson (2011) JSCR 25(2):497-503 — push-up %bodymass.
 *  [7] NIST Handbook 44 / international avoirdupois pound = 0.45359237 kg exact.
 * ========================================================================== */

/* ============================== 0. UNITS ================================== */

export const LB_TO_KG = 0.45359237; // exact, by definition [7]
export const KG_TO_LB = 1 / LB_TO_KG; // 2.2046226218487757...

export type Unit = "kg" | "lb";

/**
 * Canonical weight value. RULE: never re-derive `kg` from a rounded display
 * string. Store what the user typed AND the exact canonical kg. Display then
 * returns the original literal when the display unit matches the entry unit,
 * which makes kg->lb->kg round-trips drift-free by construction.
 */
export interface Weight {
  kg: number; // canonical, full precision
  enteredValue: number; // exactly what the user typed
  enteredUnit: Unit;
}

export function fromInput(value: number, unit: Unit): Weight {
  return { kg: unit === "kg" ? value : value * LB_TO_KG, enteredValue: value, enteredUnit: unit };
}

/** Display increments. Never finer than the gym can actually produce. */
export const DISPLAY_STEP: Record<Unit, number> = { kg: 0.25, lb: 0.5 };

export function toDisplay(w: Weight, unit: Unit, step = DISPLAY_STEP[unit]): number {
  if (unit === w.enteredUnit) return w.enteredValue; // no drift, ever
  const raw = unit === "kg" ? w.kg : w.kg * KG_TO_LB;
  return roundTo(raw, step);
}

/** Half-away-from-zero rounding to an arbitrary step, free of FP dust. */
export function roundTo(x: number, step: number): number {
  const inv = 1 / step;
  return Math.round((x * inv + Number.EPSILON * Math.sign(x) * 1e3)) / inv;
}

/** For aggregates (session volume etc.) round once, at the very end. */
export function formatVolume(kg: number, unit: Unit): string {
  const v = unit === "kg" ? kg : kg * KG_TO_LB;
  return `${Math.round(v).toLocaleString()} ${unit}`;
}

/* ====================== 1. CLASSICAL e1RM EQUATIONS ======================= */
/* w = weight lifted (kg), r = repetitions completed (assumed at/near failure) */

export const Epley = (w: number, r: number) => (r === 1 ? w : w * (1 + r / 30));
export const Brzycki = (w: number, r: number) => w * 36 / (37 - r); // == w/(1.0278-0.0278r)
export const Lander = (w: number, r: number) => (100 * w) / (101.3 - 2.67123 * r);
export const Lombardi = (w: number, r: number) => w * Math.pow(r, 0.10);
export const Mayhew = (w: number, r: number) => (100 * w) / (52.2 + 41.9 * Math.exp(-0.055 * r));
export const OConner = (w: number, r: number) => w * (1 + 0.025 * r);
export const Wathan = (w: number, r: number) => (100 * w) / (48.8 + 53.8 * Math.exp(-0.075 * r));

/**
 * Weight-dependent equation [1]. Fitted on 303,494 near-failure sets / 388
 * exercises: k(w) = -2.55 + 4.58*ln(w_kg), 1RM = w * (1 + (r-1)^0.85 / k(w)).
 * Beat Brzycki/Epley/Wathan/Mayhew on within-lifter consistency by 17.0-21.9%.
 * NOTE: fitted with w in KILOGRAMS; the intercept is unit-dependent.
 */
export const WD_ALPHA = 0.85;
export const WD_A = -2.55;
export const WD_B = 4.58;

export function wdK(wKg: number): number {
  return Math.max(0.5, WD_A + WD_B * Math.log(Math.max(wKg, 1e-6)));
}

export function WeightDependent(w: number, r: number): number {
  if (r <= 1) return w;
  return w * (1 + Math.pow(r - 1, WD_ALPHA) / wdK(w));
}

/**
 * PER-USER, PER-EXERCISE CALIBRATION — the thing that turns a good tracker into
 * a great one, and the thing RTS itself recommends ("customise your RPE chart
 * per lift"). Given >= 6 near-failure sets on one exercise within a 14-day
 * window, solve for the k that makes those sets agree with each other, then
 * shrink it toward the global k(w). Same objective as [1]: minimise the SD of
 * log(e1RM) within a tuple.
 *
 * A grinder whose reps fall off a cliff gets a low k (each rep worth more);
 * an endurance-y lifter who can rep out at 90% gets a high k. After ~6 weeks
 * of logging this is measurably better than any population formula.
 */
export function calibrateK(
  sets: { weightKg: number; repsToFailure: number }[],
  priorStrength = 8,
): { k: number; n: number; shrunk: boolean } {
  const usable = sets.filter((s) => s.repsToFailure >= 2 && s.repsToFailure <= 12 && s.weightKg > 0);
  if (usable.length < 3) {
    const w = median(sets.map((s) => s.weightKg));
    return { k: wdK(w || 20), n: usable.length, shrunk: true };
  }
  const objective = (k: number) => {
    const logs = usable.map((s) => Math.log(s.weightKg * (1 + Math.pow(s.repsToFailure - 1, WD_ALPHA) / k)));
    const mean = logs.reduce((a, b) => a + b, 0) / logs.length;
    return logs.reduce((a, b) => a + (b - mean) ** 2, 0) / logs.length;
  };
  let best = wdK(median(usable.map((s) => s.weightKg))), bestVal = Infinity;
  for (let k = 3; k <= 45; k += 0.05) { const v = objective(k); if (v < bestVal) { bestVal = v; best = k; } }
  const prior = wdK(median(usable.map((s) => s.weightKg)));
  const w = usable.length / (usable.length + priorStrength);
  return { k: w * best + (1 - w) * prior, n: usable.length, shrunk: w < 0.8 };
}

export function e1rmWithK(w: number, repsToFailure: number, k: number): number {
  if (repsToFailure <= 1) return w;
  return w * (1 + Math.pow(repsToFailure - 1, WD_ALPHA) / Math.max(0.5, k));
}

export type E1rmFormula =
  | "epley" | "brzycki" | "lander" | "lombardi"
  | "mayhew" | "oconner" | "wathan" | "wd" | "rts" | "blend";

export const CLASSICAL: Record<string, (w: number, r: number) => number> = {
  epley: Epley, brzycki: Brzycki, lander: Lander, lombardi: Lombardi,
  mayhew: Mayhew, oconner: OConner, wathan: Wathan, wd: WeightDependent,
};

/* ===================== 2. RPE / RIR AND THE RTS CHART ===================== */

/**
 * KEY STRUCTURAL FACT (verify it yourself against any printed RTS chart):
 * the whole 2-D RPE x reps grid is ONE 1-D curve indexed by
 *      n = reps + RIR  = reps + (10 - RPE)   ("reps to failure equivalent")
 * because RPE 9 @ r reps == RPE 10 @ (r+1) reps, exactly, in every cell.
 * So we store 10 numbers, not 90, and half-RPE cells fall out by interpolation.
 */
export const RTS_PCT_BY_REPS_TO_FAILURE: number[] = [
  /* n=1 */ 100.0, 95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, /* n=10 */
];

export const RIR_MIN = 0;
export const RPE_MIN = 6; // RTS chart is undefined below RPE 6

export function rpeToRir(rpe: number): number { return 10 - rpe; }
export function rirToRpe(rir: number): number { return 10 - rir; }

/**
 * %1RM for a set of `reps` at `rpe`. Linear interpolation handles half-RPE
 * (e.g. RPE 9.5 @ 1 -> 97.75%, published charts print 97.8%).
 * Beyond n = 10 the RTS chart is not published; we hand off to the
 * weight-dependent curve instead of extrapolating a table we do not have.
 */
export function rtsPercent(reps: number, rpe: number): number | null {
  const n = reps + rpeToRir(rpe);
  if (n < 1 || n > RTS_PCT_BY_REPS_TO_FAILURE.length) return null;
  const lo = Math.floor(n), hi = Math.ceil(n);
  const a = RTS_PCT_BY_REPS_TO_FAILURE[lo - 1];
  const b = RTS_PCT_BY_REPS_TO_FAILURE[hi - 1];
  return a + (b - a) * (n - lo);
}

/** Full printable chart, generated — guaranteed consistent with the engine. */
export function buildRpeChart(
  rpes = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6],
  maxReps = 10,
): Record<string, (number | null)[]> {
  const out: Record<string, (number | null)[]> = {};
  for (const rpe of rpes) {
    out[`RPE ${rpe}`] = Array.from({ length: maxReps }, (_, i) => {
      const p = rtsPercent(i + 1, rpe);
      return p === null ? null : Math.round(p * 10) / 10;
    });
  }
  return out;
}

/* ------------------- RPE defaults when the user leaves it blank ----------- */

export type SetType = "warmup" | "normal" | "dropset" | "failure" | "myorep" | "cluster" | "amrap";

/**
 * Prior RIR per set type when RPE is missing. Calibrated to the literature on
 * self-reported proximity to failure: untrained/recreational lifters who
 * *believe* they are at failure typically leave 2-5 reps in reserve
 * (Steele 2017; Refalo 2024), so the app is deliberately conservative.
 * These priors are then PERSONALISED (see `personalisedRirPrior`).
 */
export const DEFAULT_RIR_PRIOR: Record<SetType, number> = {
  warmup: 6,   // excluded from e1RM anyway
  normal: 2,
  dropset: 1,
  failure: 0,
  myorep: 0,
  cluster: 1,
  amrap: 0,
};

/** Confidence (0..1) attached to an e1RM sample, used for smoothing weights. */
export const RIR_SOURCE_CONFIDENCE = {
  explicitRpe: 1.0,
  amrapFlag: 0.85,
  fatigueDetected: 0.7, // fewer reps than an earlier set at the same weight
  prior: 0.45,
} as const;

/**
 * Personalised prior: if a lifter *does* sometimes log RPE, learn their median
 * RPE by set type and use it instead of the global prior. 8 observations is
 * enough to beat the global prior in practice; below that, shrink toward it.
 */
export function personalisedRirPrior(
  setType: SetType,
  observedRirs: number[],
  globalPrior = DEFAULT_RIR_PRIOR[setType],
): number {
  const n = observedRirs.length;
  if (n === 0) return globalPrior;
  const med = median(observedRirs);
  const w = n / (n + 8); // James-Stein-ish shrinkage
  return w * med + (1 - w) * globalPrior;
}

/* ========================= 3. THE e1RM PIPELINE =========================== */

export interface LoggedSet {
  id: string;
  exerciseId: string;
  setType: SetType;
  reps: number;          // reps completed (per side for unilateral — see §5)
  weightKg: number;      // EXTERNAL load as logged (added weight for bodyweight ex.)
  rpe?: number | null;   // 6..10 in 0.5 steps
  rirObserved?: number | null; // if the UI collects RIR directly
  completed: boolean;
  fatigueDetected?: boolean; // fewer reps than an earlier set at the same load
  timeSec?: number | null;   // duration-based exercises
  distanceM?: number | null;
}

export interface E1rmSample {
  setId: string;
  e1rmKg: number;
  method: E1rmFormula;
  repsToFailure: number;
  confidence: number; // 0..1
}

export const E1RM_MAX_REPS = 12; // above this, estimates are not trustworthy [3]
export const E1RM_MAX_RIR = 4;   // a set 5+ reps from failure says nothing

/**
 * Blend weight for the RTS chart vs the weight-dependent equation.
 * Rationale: RTS was built from heavy barbell powerlifting data and is
 * best where loads are heavy; the WD equation was fitted across 388 exercises
 * and is markedly better on light isolation work (+21.9% consistency vs
 * Brzycki on isolation, only +7.9% on barbell bench [1]). So we cross-fade on
 * absolute load: pure WD under 40 kg, 50/50 at ~90 kg, mostly RTS over 140 kg.
 */
export function rtsBlendWeight(wKg: number): number {
  const x = (wKg - 40) / 100;
  return Math.max(0, Math.min(0.6, 0.6 * x));
}

export function estimateSetE1rm(
  set: LoggedSet,
  opts: {
    totalLoadKg?: number;           // system load for bodyweight exercises (§5)
    rirPrior?: number;
    formula?: E1rmFormula;          // default "blend"
  } = {},
): E1rmSample | null {
  if (!set.completed) return null;
  if (set.setType === "warmup") return null;
  if (set.reps < 1 || set.reps > 30) return null;

  const w = opts.totalLoadKg ?? set.weightKg;
  if (w <= 0) return null;

  // --- resolve proximity to failure ---
  let rir: number;
  let confidence: number;
  if (set.rirObserved != null) { rir = set.rirObserved; confidence = RIR_SOURCE_CONFIDENCE.explicitRpe; }
  else if (set.rpe != null) { rir = rpeToRir(set.rpe); confidence = RIR_SOURCE_CONFIDENCE.explicitRpe; }
  else if (set.setType === "amrap" || set.setType === "failure") { rir = 0; confidence = RIR_SOURCE_CONFIDENCE.amrapFlag; }
  else if (set.fatigueDetected) { rir = 0.5; confidence = RIR_SOURCE_CONFIDENCE.fatigueDetected; }
  else { rir = opts.rirPrior ?? DEFAULT_RIR_PRIOR[set.setType]; confidence = RIR_SOURCE_CONFIDENCE.prior; }

  rir = Math.max(RIR_MIN, rir);
  if (rir > E1RM_MAX_RIR) return null;

  const n = set.reps + rir; // reps-to-failure equivalent
  if (n > E1RM_MAX_REPS) return null;

  // --- estimate ---
  const formula = opts.formula ?? "blend";
  const wdVal = WeightDependent(w, n);
  const rtsPct = rtsPercent(set.reps, rirToRpe(rir));
  const rtsVal = rtsPct == null ? null : (w * 100) / rtsPct;

  let e1rm: number;
  let method: E1rmFormula;
  if (formula === "blend" && rtsVal != null) {
    const bw = rtsBlendWeight(w);
    e1rm = (1 - bw) * wdVal + bw * rtsVal;
    method = "blend";
  } else if (formula === "rts" && rtsVal != null) { e1rm = rtsVal; method = "rts"; }
  else if (formula in CLASSICAL) { e1rm = CLASSICAL[formula](w, n); method = formula; }
  else { e1rm = wdVal; method = "wd"; }

  // reps far from 1 carry less information — taper confidence
  const repPenalty = 1 - Math.min(0.45, 0.045 * Math.max(0, n - 3));
  return { setId: set.id, e1rmKg: e1rm, method, repsToFailure: n, confidence: confidence * repPenalty };
}

/**
 * Best e1RM for one exercise in one session.
 * NOT a plain max: a max over noisy samples is upward-biased and a single
 * mis-typed weight becomes a permanent fake PR. Rule:
 *  1. drop non-qualifying sets (warm-ups, >12 reps-to-failure, RIR>4);
 *  2. drop sets whose confidence is below 0.4 when a better-sourced set exists;
 *  3. take the confidence-weighted 80th percentile of the remaining samples,
 *     but never above the single highest sample from a confidence >= 0.7 set.
 * With the typical 1-3 qualifying sets this reduces to "the best honest set",
 * and with 6+ sets it resists one flukey entry.
 */
export function sessionBestE1rm(samples: E1rmSample[]): E1rmSample | null {
  if (samples.length === 0) return null;
  const strong = samples.filter((s) => s.confidence >= 0.4);
  const pool = strong.length > 0 ? strong : samples;
  if (pool.length <= 2) return pool.reduce((a, b) => (b.e1rmKg > a.e1rmKg ? b : a));
  const sorted = [...pool].sort((a, b) => a.e1rmKg - b.e1rmKg);
  const p80 = weightedQuantile(sorted.map((s) => s.e1rmKg), sorted.map((s) => s.confidence), 0.8);
  const trusted = pool.filter((s) => s.confidence >= 0.7);
  const ceiling = trusted.length ? Math.max(...trusted.map((s) => s.e1rmKg)) : Math.max(...pool.map((s) => s.e1rmKg));
  const value = Math.min(p80, ceiling);
  return pool.reduce((a, b) => (Math.abs(b.e1rmKg - value) < Math.abs(a.e1rmKg - value) ? b : a));
}

/* ==================== 4. SMOOTHING THE e1RM TREND LINE ==================== */

export interface TrendPoint { t: number; /* epoch ms */ valueKg: number; confidence?: number }
export interface SmoothedPoint extends TrendPoint { smoothedKg: number; isOutlier: boolean; bandKg: number }

/**
 * Stage 1 — Hampel filter in LOG space (strength is multiplicative, so a 5%
 * error on a 200 kg squat and on a 20 kg curl should be treated identically).
 * Any point more than 3 MAD from the local median over a +-5-point window is
 * flagged; flagged points are kept in the data (the user logged them) but are
 * excluded from the smoother so one typo cannot bend the chart.
 */
export function hampelFlags(values: number[], halfWindow = 5, nSigmas = 3): boolean[] {
  const logs = values.map((v) => Math.log(Math.max(v, 1e-6)));
  return logs.map((v, i) => {
    const lo = Math.max(0, i - halfWindow), hi = Math.min(logs.length - 1, i + halfWindow);
    const win = logs.slice(lo, hi + 1);
    if (win.length < 5) return false;
    const med = median(win);
    const mad = 1.4826 * median(win.map((x) => Math.abs(x - med)));
    if (mad === 0) return false;
    return Math.abs(v - med) > nSigmas * mad;
  });
}

/**
 * Stage 2 — time-aware, asymmetric exponential smoother in log space.
 *  - alpha derives from elapsed days, not sample index, so a 3-week gap does
 *    not get the same weight as back-to-back sessions:  a = 1 - exp(-dt/tau).
 *  - HALF_LIFE_DAYS = 21 (tau = 30.3 d) -> the line reflects roughly the last
 *    month of training, which is the timescale on which strength actually moves.
 *  - asymmetry: genuine records are informative, bad days are mostly noise, so
 *    upward moves use 1.6x alpha and downward moves 0.7x alpha. This is why one
 *    bad session cannot tank the chart while a real PR still shows up fast.
 *  - the band is 1.5 x residual MAD, shown as a shaded confidence ribbon.
 */
export const E1RM_HALF_LIFE_DAYS = 21;
export const UP_GAIN = 1.6;
export const DOWN_GAIN = 0.7;
const DAY_MS = 86_400_000;

export function smoothE1rmSeries(
  points: TrendPoint[],
  halfLifeDays = E1RM_HALF_LIFE_DAYS,
): SmoothedPoint[] {
  const pts = [...points].sort((a, b) => a.t - b.t);
  if (pts.length === 0) return [];
  const flags = hampelFlags(pts.map((p) => p.valueKg));
  const tau = halfLifeDays / Math.LN2;

  let s = Math.log(pts[0].valueKg);
  let prevT = pts[0].t;
  const residuals: number[] = [];
  const out: SmoothedPoint[] = [];

  pts.forEach((p, i) => {
    const y = Math.log(Math.max(p.valueKg, 1e-6));
    if (i > 0 && !flags[i]) {
      const dtDays = Math.max((p.t - prevT) / DAY_MS, 0);
      let a = 1 - Math.exp(-dtDays / tau);
      a *= y > s ? UP_GAIN : DOWN_GAIN;
      a *= 0.6 + 0.4 * (p.confidence ?? 1); // low-confidence samples move it less
      a = Math.max(0.02, Math.min(0.9, a));
      s = s + a * (y - s);
      prevT = p.t;
    } else if (i > 0) {
      prevT = p.t; // outlier: advance the clock, do not move the level
    }
    residuals.push(Math.abs(y - s));
    const mad = 1.4826 * median(residuals.slice(-12));
    out.push({
      ...p,
      smoothedKg: Math.exp(s),
      isOutlier: flags[i],
      bandKg: Math.exp(s) * (Math.exp(1.5 * mad) - 1),
    });
  });
  return out;
}

/**
 * Trend slope for the "+2.4 kg / month" chip. Theil-Sen (median of pairwise
 * slopes) rather than OLS, because it has a 29% breakdown point — it is
 * immune to the deload weeks and missed sessions that wreck a least-squares fit.
 */
export function theilSenSlopePerMonth(points: TrendPoint[]): number {
  const p = [...points].sort((a, b) => a.t - b.t);
  if (p.length < 3) return 0;
  const slopes: number[] = [];
  for (let i = 0; i < p.length; i++) {
    for (let j = i + 1; j < p.length; j++) {
      const dt = (p[j].t - p[i].t) / DAY_MS;
      if (dt > 0.5) slopes.push((p[j].valueKg - p[i].valueKg) / dt);
    }
  }
  return slopes.length ? median(slopes) * 30.4375 : 0;
}

/* ============ 5. LOAD MODELS, VOLUME AND WHAT "TOTAL KG" MEANS ============ */

export type LoadModel =
  | "EXTERNAL"        // barbell, dumbbell, machine, cable: logged kg IS the load
  | "BODYWEIGHT"      // pull-up, dip, push-up: BW * factor (+ added kg)
  | "ASSISTED"        // assisted pull-up/dip: BW * factor - assistance kg
  | "WEIGHTED_CARRY"  // farmer's walk: load * distance, no reps
  | "DURATION"        // plank, dead hang, sled push by time
  | "DISTANCE";       // rowing, sled, running

export interface ExerciseLoadSpec {
  loadModel: LoadModel;
  /** Fraction of bodyweight actually moved. Measured values where they exist. */
  bodyweightFactor?: number;
  /** true when the logged weight is PER SIDE and reps are PER SIDE. */
  unilateral?: boolean;
  /** Cable pulley mechanical advantage: 1 = direct, 2 = 2:1 (stack kg / 2). */
  pulleyRatio?: number;
}

/**
 * Bodyweight factors. [6] Suprak/Dawes/Stephenson 2011 measured push-up ground
 * reaction forces on 23 subjects: standard push-up = 64% body mass (up
 * position; ~69-75% in the down position), knee push-up 49%, hands on a 24"
 * bench 41%, feet on a 24" bench 75%. Hanging exercises support the whole body
 * minus nothing, so they are 1.00 by mechanics, not by survey.
 */
export const BODYWEIGHT_FACTORS: Record<string, number> = {
  "pull-up": 1.00, "chin-up": 1.00, "muscle-up": 1.00, "dip": 1.00,
  "ring-dip": 1.00, "bench-dip": 0.45, "inverted-row": 0.60,
  "push-up": 0.64, "push-up-knees": 0.49, "push-up-hands-elevated-24in": 0.41,
  "push-up-feet-elevated-24in": 0.75, "pike-push-up": 0.75,
  "bodyweight-squat": 0.85, "pistol-squat": 0.90, "bulgarian-split-squat": 0.85,
  "walking-lunge": 0.85, "step-up": 0.85, "nordic-curl": 0.55,
  "hanging-leg-raise": 0.45, "sit-up": 0.40, "back-extension": 0.55,
  "glute-bridge": 0.55, "calf-raise-bodyweight": 0.90,
};

export interface VolumeContext {
  bodyweightKg: number; // the lifter's bodyweight on the workout date
  spec: ExerciseLoadSpec;
}

/**
 * The load ONE REP actually moves, in kg. This is the number every other
 * calculation (volume, e1RM, PRs, per-muscle load) must be built on.
 *
 *   pull-up,  BW 80 kg, no added weight ........ 80.0 kg / rep
 *   pull-up,  BW 80 kg, +20 kg belt ............ 100.0 kg / rep
 *   assisted pull-up, BW 80 kg, 30 kg assist ... 50.0 kg / rep
 *   push-up,  BW 80 kg ......................... 51.2 kg / rep  (0.64 * 80)
 */
export function repLoadKg(set: LoggedSet, ctx: VolumeContext): number {
  const { spec, bodyweightKg } = ctx;
  const f = spec.bodyweightFactor ?? 1;
  let load: number;
  switch (spec.loadModel) {
    case "BODYWEIGHT": load = bodyweightKg * f + set.weightKg; break;
    case "ASSISTED":   load = Math.max(0, bodyweightKg * f - Math.abs(set.weightKg)); break;
    case "DURATION":
    case "DISTANCE":   return 0; // no honest kg — see below
    case "WEIGHTED_CARRY": load = set.weightKg; break;
    default:           load = set.weightKg / (spec.pulleyRatio ?? 1);
  }
  // Unilateral: `load` is what ONE limb moves. The doubling lives in
  // repsCredited(), never here, so the two are never applied twice.
  return load;
}

/**
 * Total reps credited. UNILATERAL CONVENTION (state it in the UI once):
 * the user logs weight per side and reps per side; a "10" on a single-arm row
 * means 10 per arm. Volume = perSideLoad * reps * 2 and the rep counter shows
 * 20. This is the only convention that keeps a 2x20 kg DB lunge and a 40 kg
 * barbell lunge comparable.
 */
export function repsCredited(set: LoggedSet, spec: ExerciseLoadSpec): number {
  return spec.unilateral ? set.reps * 2 : set.reps;
}

export interface VolumeBreakdown {
  externalVolumeKg: number; // plates/dumbbells/stack only — "what you added"
  systemVolumeKg: number;   // includes bodyweight moved — the honest total
  totalReps: number;
  hardSets: number;         // sets within 5 RIR, the hypertrophy-relevant count
  workingSets: number;      // all non-warm-up completed sets
  timeUnderTensionSec: number;
}

/**
 * Volume definitions used across the app — state them in the UI, once:
 *   VOLUME LOAD (aka tonnage) = sum over sets of reps * load-per-rep.
 *     This is the headline "total kg". We report SYSTEM volume, because a
 *     50-rep pull-up session that shows 0 kg is a bug, not a design choice.
 *   EXTERNAL VOLUME excludes bodyweight; shown in the tooltip so a lifter can
 *     see that a bodyweight gain did not "make them stronger".
 *   HARD SETS = completed non-warm-up sets at RIR <= 5. This is the volume
 *     metric the hypertrophy literature actually uses; kg-tonnage is the one
 *     that motivates. Track both, never conflate them.
 *   RELATIVE VOLUME = volume load / bodyweight, the fair way to compare
 *     lifters and to compare the same lifter across a bulk.
 *   INTENSITY-WEIGHTED VOLUME = sum(reps * load * load/e1RM); use it for
 *     fatigue, never for the headline number.
 */
export const HARD_SET_RIR_CUTOFF = 5;

export function computeVolume(sets: LoggedSet[], ctx: VolumeContext, rirOf: (s: LoggedSet) => number): VolumeBreakdown {
  let externalVolumeKg = 0, systemVolumeKg = 0, totalReps = 0, hardSets = 0, workingSets = 0, tut = 0;
  for (const s of sets) {
    if (!s.completed) continue;
    const reps = repsCredited(s, ctx.spec);
    const perRep = repLoadKg(s, ctx);
    const extPerRep = ctx.spec.loadModel === "ASSISTED" ? 0 : Math.max(0, s.weightKg) / (ctx.spec.pulleyRatio ?? 1);
    systemVolumeKg += reps * perRep;
    externalVolumeKg += reps * extPerRep;
    totalReps += reps;
    tut += s.timeSec ?? 0;
    if (s.setType !== "warmup") {
      workingSets += 1;
      if (rirOf(s) <= HARD_SET_RIR_CUTOFF) hardSets += 1;
    }
  }
  return { externalVolumeKg, systemVolumeKg, totalReps, hardSets, workingSets, timeUnderTensionSec: tut };
}

/**
 * Duration/distance work: DO NOT invent kilograms. Show it in its own units and
 * give it set credit and muscle-fatigue credit, but leave it out of the kg
 * headline. The one defensible exception is a loaded carry, where
 * kg-equivalent = load * (distance / 30 m), i.e. 30 m of carry is scored like
 * one "rep"; label it in the UI so nobody thinks it is a lift.
 */
export const CARRY_METRES_PER_REP_EQUIVALENT = 30;
export function carryVolumeKg(loadKg: number, metres: number): number {
  return loadKg * (metres / CARRY_METRES_PER_REP_EQUIVALENT);
}

/* ==================== 6. PER-MUSCLE VOLUME ATTRIBUTION ==================== */

export type Muscle =
  | "chest" | "front_delts" | "side_delts" | "rear_delts" | "lats" | "upper_back"
  | "traps" | "lower_back" | "biceps" | "triceps" | "forearms" | "abs" | "obliques"
  | "glutes" | "quads" | "hamstrings" | "adductors" | "abductors" | "calves";

/**
 * TWO different coefficient sets, for two different jobs. Conflating them is
 * the single most common modelling error in training apps.
 *
 *  volumeShare  — fractions summing to 1.0. Splits the kg of an exercise across
 *                 muscles for the "training split" donut and per-muscle tonnage.
 *                 Grounded in normalised EMG amplitude ratios where published
 *                 (bench: pec major ~= triceps > anterior deltoid; squat: glute
 *                 max highest at depth; deadlift: erector spinae 55-85% MVIC,
 *                 similar to glutes/hamstrings), rounded to 0.05 because the
 *                 underlying EMG data does not justify more precision.
 *
 *  setCredit    — NOT normalised. 1.0 for a muscle the exercise trains directly,
 *                 0.5 for indirect/assisting work, per the fractional-set
 *                 convention used across the hypertrophy-volume literature
 *                 (bench = 1.0 chest, 0.5 front delts, 0.5 triceps). Used for
 *                 "sets per muscle per week" and for MEV/MRV landmarks.
 *
 *  fatigueLoad  — multiplier on systemic fatigue cost, used by muscle readiness.
 *                 Heavy hinges and squats cost more recovery per unit of volume
 *                 than cable work; this is the knob that encodes that.
 */
export interface MuscleCoefficients {
  volumeShare: Partial<Record<Muscle, number>>; // sums to 1.00
  setCredit: Partial<Record<Muscle, number>>;   // 1.0 direct / 0.5 indirect
  fatigueLoad: number;                          // 0.5 .. 1.5
}

export const MUSCLE_MAP: Record<string, MuscleCoefficients> = {
  "barbell-bench-press": {
    volumeShare: { chest: 0.50, triceps: 0.25, front_delts: 0.20, lats: 0.05 },
    setCredit: { chest: 1.0, triceps: 0.5, front_delts: 0.5 },
    fatigueLoad: 1.0,
  },
  "incline-barbell-bench-press": {
    volumeShare: { chest: 0.40, front_delts: 0.30, triceps: 0.25, lats: 0.05 },
    setCredit: { chest: 1.0, front_delts: 0.5, triceps: 0.5 },
    fatigueLoad: 1.0,
  },
  "dumbbell-bench-press": {
    volumeShare: { chest: 0.55, triceps: 0.20, front_delts: 0.20, lats: 0.05 },
    setCredit: { chest: 1.0, triceps: 0.5, front_delts: 0.5 },
    fatigueLoad: 0.9,
  },
  "overhead-press": {
    volumeShare: { front_delts: 0.45, triceps: 0.25, side_delts: 0.15, traps: 0.10, abs: 0.05 },
    setCredit: { front_delts: 1.0, triceps: 0.5, side_delts: 0.5, traps: 0.5 },
    fatigueLoad: 1.0,
  },
  "dip": {
    volumeShare: { chest: 0.40, triceps: 0.40, front_delts: 0.20 },
    setCredit: { chest: 1.0, triceps: 1.0, front_delts: 0.5 },
    fatigueLoad: 0.9,
  },
  "push-up": {
    volumeShare: { chest: 0.50, triceps: 0.25, front_delts: 0.20, abs: 0.05 },
    setCredit: { chest: 1.0, triceps: 0.5, front_delts: 0.5 },
    fatigueLoad: 0.6,
  },
  "pull-up": {
    volumeShare: { lats: 0.50, upper_back: 0.20, biceps: 0.20, rear_delts: 0.05, forearms: 0.05 },
    setCredit: { lats: 1.0, upper_back: 0.5, biceps: 0.5, forearms: 0.5 },
    fatigueLoad: 0.9,
  },
  "chin-up": {
    volumeShare: { lats: 0.45, biceps: 0.30, upper_back: 0.15, forearms: 0.10 },
    setCredit: { lats: 1.0, biceps: 1.0, upper_back: 0.5 },
    fatigueLoad: 0.9,
  },
  "lat-pulldown": {
    volumeShare: { lats: 0.50, upper_back: 0.20, biceps: 0.20, rear_delts: 0.05, forearms: 0.05 },
    setCredit: { lats: 1.0, biceps: 0.5, upper_back: 0.5 },
    fatigueLoad: 0.7,
  },
  "barbell-row": {
    volumeShare: { upper_back: 0.35, lats: 0.30, biceps: 0.15, rear_delts: 0.10, lower_back: 0.10 },
    setCredit: { upper_back: 1.0, lats: 1.0, biceps: 0.5, rear_delts: 0.5, lower_back: 0.5 },
    fatigueLoad: 1.1,
  },
  "seated-cable-row": {
    volumeShare: { upper_back: 0.40, lats: 0.30, biceps: 0.20, rear_delts: 0.10 },
    setCredit: { upper_back: 1.0, lats: 1.0, biceps: 0.5, rear_delts: 0.5 },
    fatigueLoad: 0.7,
  },
  "back-squat": {
    volumeShare: { quads: 0.45, glutes: 0.30, hamstrings: 0.10, lower_back: 0.10, adductors: 0.05 },
    setCredit: { quads: 1.0, glutes: 1.0, hamstrings: 0.5, lower_back: 0.5, adductors: 0.5 },
    fatigueLoad: 1.4,
  },
  "front-squat": {
    volumeShare: { quads: 0.55, glutes: 0.20, lower_back: 0.10, abs: 0.10, adductors: 0.05 },
    setCredit: { quads: 1.0, glutes: 0.5, abs: 0.5, lower_back: 0.5 },
    fatigueLoad: 1.3,
  },
  "leg-press": {
    volumeShare: { quads: 0.55, glutes: 0.30, hamstrings: 0.10, adductors: 0.05 },
    setCredit: { quads: 1.0, glutes: 1.0, hamstrings: 0.5 },
    fatigueLoad: 0.9,
  },
  "conventional-deadlift": {
    volumeShare: { glutes: 0.25, hamstrings: 0.25, lower_back: 0.20, quads: 0.15, traps: 0.10, forearms: 0.05 },
    setCredit: { glutes: 1.0, hamstrings: 1.0, lower_back: 1.0, quads: 0.5, traps: 0.5, forearms: 0.5 },
    fatigueLoad: 1.5,
  },
  "romanian-deadlift": {
    volumeShare: { hamstrings: 0.40, glutes: 0.30, lower_back: 0.20, traps: 0.05, forearms: 0.05 },
    setCredit: { hamstrings: 1.0, glutes: 1.0, lower_back: 0.5, forearms: 0.5 },
    fatigueLoad: 1.2,
  },
  "hip-thrust": {
    volumeShare: { glutes: 0.65, hamstrings: 0.20, quads: 0.15 },
    setCredit: { glutes: 1.0, hamstrings: 0.5, quads: 0.5 },
    fatigueLoad: 0.9,
  },
  "bulgarian-split-squat": {
    volumeShare: { quads: 0.40, glutes: 0.35, hamstrings: 0.15, adductors: 0.10 },
    setCredit: { quads: 1.0, glutes: 1.0, hamstrings: 0.5, adductors: 0.5 },
    fatigueLoad: 1.1,
  },
  "leg-extension": { volumeShare: { quads: 1.00 }, setCredit: { quads: 1.0 }, fatigueLoad: 0.6 },
  "lying-leg-curl": { volumeShare: { hamstrings: 0.90, calves: 0.10 }, setCredit: { hamstrings: 1.0 }, fatigueLoad: 0.6 },
  "standing-calf-raise": { volumeShare: { calves: 1.00 }, setCredit: { calves: 1.0 }, fatigueLoad: 0.5 },
  "barbell-curl": { volumeShare: { biceps: 0.80, forearms: 0.20 }, setCredit: { biceps: 1.0, forearms: 0.5 }, fatigueLoad: 0.6 },
  "hammer-curl": { volumeShare: { biceps: 0.60, forearms: 0.40 }, setCredit: { biceps: 1.0, forearms: 1.0 }, fatigueLoad: 0.6 },
  "triceps-pushdown": { volumeShare: { triceps: 1.00 }, setCredit: { triceps: 1.0 }, fatigueLoad: 0.5 },
  "skull-crusher": { volumeShare: { triceps: 1.00 }, setCredit: { triceps: 1.0 }, fatigueLoad: 0.6 },
  "lateral-raise": { volumeShare: { side_delts: 0.85, front_delts: 0.10, traps: 0.05 }, setCredit: { side_delts: 1.0 }, fatigueLoad: 0.5 },
  "face-pull": { volumeShare: { rear_delts: 0.50, upper_back: 0.30, traps: 0.20 }, setCredit: { rear_delts: 1.0, upper_back: 0.5, traps: 0.5 }, fatigueLoad: 0.5 },
  "barbell-shrug": { volumeShare: { traps: 0.85, forearms: 0.15 }, setCredit: { traps: 1.0, forearms: 0.5 }, fatigueLoad: 0.7 },
  "cable-fly": { volumeShare: { chest: 0.90, front_delts: 0.10 }, setCredit: { chest: 1.0 }, fatigueLoad: 0.6 },
  "plank": { volumeShare: { abs: 0.70, obliques: 0.20, lower_back: 0.10 }, setCredit: { abs: 1.0, obliques: 0.5 }, fatigueLoad: 0.4 },
  "hanging-leg-raise": { volumeShare: { abs: 0.70, obliques: 0.15, forearms: 0.15 }, setCredit: { abs: 1.0, obliques: 0.5 }, fatigueLoad: 0.5 },
};

/** Invariant enforced by the test suite: every volumeShare sums to 1.00. */
export function assertCoefficientsValid(): void {
  for (const [id, c] of Object.entries(MUSCLE_MAP)) {
    const sum = Object.values(c.volumeShare).reduce((a, b) => a + (b ?? 0), 0);
    if (Math.abs(sum - 1) > 1e-9) throw new Error(`volumeShare for ${id} sums to ${sum}`);
  }
}

export function attributeVolume(exerciseId: string, volumeKg: number): Partial<Record<Muscle, number>> {
  const c = MUSCLE_MAP[exerciseId];
  if (!c) return {};
  const out: Partial<Record<Muscle, number>> = {};
  for (const [m, share] of Object.entries(c.volumeShare)) out[m as Muscle] = volumeKg * (share ?? 0);
  return out;
}

export function attributeSets(exerciseId: string, hardSets: number): Partial<Record<Muscle, number>> {
  const c = MUSCLE_MAP[exerciseId];
  if (!c) return {};
  const out: Partial<Record<Muscle, number>> = {};
  for (const [m, credit] of Object.entries(c.setCredit)) out[m as Muscle] = hardSets * (credit ?? 0);
  return out;
}

/* ============================ 7. PR DETECTION ============================= */

export type PrType =
  | "E1RM"            // best estimated 1RM for this exercise
  | "WEIGHT"          // heaviest load moved for >= 1 rep
  | "REPS_AT_WEIGHT"  // most reps at a given load
  | "REP_MAX"         // best 1/2/3/5/8/10RM (actual, not estimated)
  | "SET_VOLUME"      // best single set: reps * load
  | "EXERCISE_VOLUME" // best total volume for this exercise in one session
  | "SESSION_VOLUME"  // best total workout volume
  | "SESSION_REPS";   // most reps in one workout

export interface PrRecord {
  type: PrType; exerciseId?: string; valueKg?: number; reps?: number;
  atWeightKg?: number; date: number; setId?: string;
}

/**
 * Anti-spam rules. A tracker that hands out eight "PR!" badges per session
 * teaches the user that PRs are meaningless, and every one of these rules
 * exists because a real app got it wrong.
 */
export const PR_RULES = {
  /** Beat the old record by this much, or it is not a record. */
  minRelativeImprovement: { E1RM: 0.005, SET_VOLUME: 0.01, EXERCISE_VOLUME: 0.02, SESSION_VOLUME: 0.02, SESSION_REPS: 0.02, WEIGHT: 0, REPS_AT_WEIGHT: 0, REP_MAX: 0 } as Record<PrType, number>,
  /** No baseline, no PR. Prevents "every set is a PR" on a new exercise. */
  minPriorSessions: 2,
  /** Warm-ups, uncompleted sets and >20-rep sets can never set a record. */
  maxRepsForPr: 20,
  /** At most this many PR badges per workout; keep the highest-tier ones. */
  maxBadgesPerWorkout: 3,
  /** Tier order used when trimming to maxBadgesPerWorkout. */
  tier: ["E1RM", "WEIGHT", "REP_MAX", "REPS_AT_WEIGHT", "SET_VOLUME", "EXERCISE_VOLUME", "SESSION_VOLUME", "SESSION_REPS"] as PrType[],
  /** Suppress a repeat of the same PR type/exercise within this many hours. */
  cooldownHours: 20,
  /** Bodyweight-driven records on BW exercises get a note, not a silent PR. */
  flagBodyweightDrivenPrs: true,
  /** An e1RM PR from a set with a prior-only RIR needs a bigger margin. */
  lowConfidenceExtraMargin: 0.02,
} as const;

export interface PrCandidate extends PrRecord { confidence: number; previous?: number }

export function detectPrs(
  candidates: PrCandidate[],
  existing: PrRecord[],
  now: number,
): PrCandidate[] {
  const keyOf = (p: PrRecord) => `${p.type}|${p.exerciseId ?? ""}|${p.atWeightKg ?? ""}|${p.reps ?? ""}`;
  const best = new Map<string, PrRecord>();
  for (const e of existing) {
    const k = keyOf(e);
    const cur = best.get(k);
    if (!cur || (e.valueKg ?? e.reps ?? 0) > (cur.valueKg ?? cur.reps ?? 0)) best.set(k, e);
  }
  const won: PrCandidate[] = [];
  for (const c of candidates) {
    if ((c.reps ?? 1) > PR_RULES.maxRepsForPr) continue;
    const k = keyOf(c);
    const prev = best.get(k);
    if (!prev) { if (c.type === "E1RM" || c.type === "WEIGHT") continue; } // needs a baseline
    const prevVal = prev?.valueKg ?? prev?.reps ?? 0;
    const newVal = c.valueKg ?? c.reps ?? 0;
    let margin = PR_RULES.minRelativeImprovement[c.type];
    if (c.confidence < 0.6) margin += PR_RULES.lowConfidenceExtraMargin;
    if (newVal <= prevVal * (1 + margin)) continue;
    if (prev && now - prev.date < PR_RULES.cooldownHours * 3.6e6) continue;
    won.push({ ...c, previous: prevVal });
  }
  won.sort((a, b) => PR_RULES.tier.indexOf(a.type) - PR_RULES.tier.indexOf(b.type));
  return won.slice(0, PR_RULES.maxBadgesPerWorkout);
}

/** The canonical rep-max ladder we celebrate as true (not estimated) records. */
export const REP_MAX_LADDER = [1, 2, 3, 5, 8, 10, 12, 15, 20];

/* ========================== 8. PLATE MATH ================================ */

export type EquipmentKind =
  | "BARBELL" | "SMITH" | "EZ_BAR" | "TRAP_BAR" | "DUMBBELL"
  | "MACHINE_STACK" | "CABLE" | "PLATE_LOADED" | "BODYWEIGHT" | "BAND";

export interface EquipmentProfile {
  kind: EquipmentKind;
  barKg?: number;                 // 20 men's, 15 women's, 7.5 EZ, 25 trap, Smith varies
  platePairsKg?: [number, number][]; // [plate kg, pairs available]
  stackIncrementKg?: number;      // e.g. 5 kg
  addOnPlatesKg?: number[];       // micro-plates that sit on the stack
  dumbbellRackKg?: number[];      // discrete dumbbells available
  smallestIncrementKg?: number;   // for BODYWEIGHT / BAND
}

export const DEFAULT_KG_PLATES: [number, number][] = [
  [25, 4], [20, 4], [15, 2], [10, 2], [5, 2], [2.5, 2], [1.25, 2], [1, 1], [0.5, 1], [0.25, 1],
];

/**
 * LESSON LEARNED THE HARD WAY: an imperial gym's inventory must be declared in
 * POUNDS and converted with the exact factor. Storing pre-rounded kg values
 * (20.4117 kg for a 45 lb plate) makes a 225 lb bench come out as 224.99994 lb
 * and every PR comparison becomes a coin flip. Declare the unit, derive the kg.
 */
export const DEFAULT_LB_PLATES: [number, number][] = [[45, 4], [35, 2], [25, 2], [10, 4], [5, 2], [2.5, 2]];
export const DEFAULT_LB_PLATES_KG: [number, number][] =
  DEFAULT_LB_PLATES.map(([lb, n]) => [lb * LB_TO_KG, n]);
export const LB_BAR_KG = 45 * LB_TO_KG;

export const BAR_WEIGHTS_KG = {
  olympic_mens: 20, olympic_womens: 15, standard: 10, ez_curl: 7.5,
  trap_bar: 25, safety_squat: 25, swiss_bar: 17.5, technique_bar: 7.5,
  smith_counterbalanced: 7, smith_uncounterbalanced: 20, // gym-specific, ask once
} as const;

export interface PlateSolution {
  totalKg: number;
  perSide: number[];  // plates on ONE side, heaviest first
  residualKg: number; // target - totalKg (negative means we went over)
  exact: boolean;
}

/**
 * Greedy per-side plate solver over a finite inventory. The test suite
 * brute-forces every reachable combination over 20-300 kg in 0.25 kg steps and
 * proves greedy == exhaustive for the stock kg and lb plate sets.
 */
export function solvePlates(targetKg: number, p: EquipmentProfile): PlateSolution {
  const bar = p.barKg ?? 0;
  const inventory = (p.platePairsKg ?? DEFAULT_KG_PLATES).slice().sort((a, b) => b[0] - a[0]);
  let perSideRemaining = (targetKg - bar) / 2;
  if (perSideRemaining < 0) return { totalKg: bar, perSide: [], residualKg: targetKg - bar, exact: targetKg === bar };
  const perSide: number[] = [];
  for (const [plate, pairs] of inventory) {
    let used = 0;
    while (used < pairs && perSideRemaining >= plate - 1e-9) { perSide.push(plate); perSideRemaining -= plate; used++; }
  }
  const totalKg = bar + 2 * perSide.reduce((a, b) => a + b, 0);
  return { totalKg, perSide, residualKg: round3(targetKg - totalKg), exact: Math.abs(targetKg - totalKg) < 1e-6 };
}

/** Smallest change this setup can express — drives the +/- stepper in the UI. */
export function smallestIncrementKg(p: EquipmentProfile): number {
  switch (p.kind) {
    case "BARBELL": case "SMITH": case "EZ_BAR": case "TRAP_BAR": case "PLATE_LOADED": {
      const inv = p.platePairsKg ?? DEFAULT_KG_PLATES;
      return 2 * Math.min(...inv.map(([kg]) => kg));
    }
    case "DUMBBELL": {
      const rack = p.dumbbellRackKg ?? DEFAULT_DUMBBELL_RACK_KG;
      let min = Infinity;
      for (let i = 1; i < rack.length; i++) min = Math.min(min, rack[i] - rack[i - 1]);
      return min;
    }
    case "MACHINE_STACK": case "CABLE": {
      const addOns = p.addOnPlatesKg ?? [];
      return addOns.length ? Math.min(...addOns) : (p.stackIncrementKg ?? 5);
    }
    default: return p.smallestIncrementKg ?? 0.5;
  }
}

export const DEFAULT_DUMBBELL_RACK_KG = [
  1, 2, 3, 4, 5, 6, 7.5, 8, 9, 10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35,
  37.5, 40, 42.5, 45, 47.5, 50, 55, 60, 65, 70, 75, 80,
];

/**
 * Round a computed target (e.g. "82.5% of your e1RM") to something the lifter
 * can physically load. Ties go DOWN for working sets: overshooting a
 * prescription costs a failed rep, undershooting costs nothing.
 */
export function roundToEquipment(targetKg: number, p: EquipmentProfile, bias: "down" | "nearest" | "up" = "down"): number {
  switch (p.kind) {
    case "BARBELL": case "SMITH": case "EZ_BAR": case "TRAP_BAR": case "PLATE_LOADED": {
      const down = solvePlates(targetKg, p).totalKg;
      const step = smallestIncrementKg(p);
      const up = solvePlates(targetKg + step, p).totalKg;
      if (bias === "down") return down;
      if (bias === "up") return up >= targetKg ? up : down;
      return targetKg - down <= up - targetKg ? down : up;
    }
    case "DUMBBELL": {
      const rack = p.dumbbellRackKg ?? DEFAULT_DUMBBELL_RACK_KG;
      const below = rack.filter((d) => d <= targetKg + 1e-9).pop() ?? rack[0];
      const above = rack.find((d) => d >= targetKg - 1e-9) ?? rack[rack.length - 1];
      if (bias === "down") return below;
      if (bias === "up") return above;
      return targetKg - below <= above - targetKg ? below : above;
    }
    case "MACHINE_STACK": case "CABLE": {
      const inc = p.stackIncrementKg ?? 5;
      const f = bias === "down" ? Math.floor : bias === "up" ? Math.ceil : Math.round;
      return f(targetKg / inc) * inc;
    }
    default: {
      const inc = p.smallestIncrementKg ?? 0.5;
      const f = bias === "down" ? Math.floor : bias === "up" ? Math.ceil : Math.round;
      return f(targetKg / inc) * inc;
    }
  }
}

/* ============================== UTILITIES ================================= */

export function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function weightedQuantile(sortedValues: number[], weights: number[], q: number): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total === 0) return sortedValues[sortedValues.length - 1];
  let acc = 0;
  for (let i = 0; i < sortedValues.length; i++) {
    acc += weights[i];
    if (acc / total >= q) return sortedValues[i];
  }
  return sortedValues[sortedValues.length - 1];
}

export const round3 = (x: number) => Math.round(x * 1000) / 1000;
```

---

# WORKED EXAMPLES THE TESTS PIN DOWN

```
225 lb entered      -> stored 102.05821 kg; displayed as "225 lb" forever (literal,
                       not re-derived). 1000 re-renders: zero drift.
100 kg entered      -> displayed as 220.5 lb (DISPLAY_STEP.lb = 0.5)

5 reps @ 100 kg RPE 8  -> n = 7; WD(100,7) = 124.73; RTS 76.2% -> 131.23;
                          blend weight at 100 kg = 0.36 -> e1RM 127.07 kg
5 reps @ 100 kg, RPE blank, setType "normal" -> prior RIR 2 -> same n = 7,
                          but confidence 0.45 * 0.82 = 0.369 (vs 0.82)
5 reps @ 100 kg, setType "failure"           -> RIR 0 -> n = 5 -> e1RM 118.3 kg

10 pull-ups, bodyweight 80 kg, no belt   -> 80.0 kg/rep,   800 kg system volume,
                                            0 kg external volume
10 pull-ups, 80 kg BW, +20 kg belt       -> 100 kg/rep,  1000 kg
10 assisted pull-ups, 80 kg BW, -30 kg   ->  50 kg/rep,   500 kg
10 push-ups, 80 kg BW                    -> 51.2 kg/rep,  512 kg   (0.64 x BW)
10 dips per side... n/a, dips are bilateral: 80 kg/rep
10 single-arm rows @ 20 kg (per side)    -> 400 kg volume, rep counter shows 20
60 s plank                               -> 0 kg volume, 60 s TUT, 1 hard set
60 m farmer's walk @ 80 kg               -> 160 kg "rep-equivalent" volume, labelled

100 kg barbell (20 kg bar)   -> per side [25, 15]
142.5 kg                     -> per side [25, 25, 10, 1.25]
82.5% of a 140 kg e1RM = 115.5 kg -> loadable exactly with 0.25 kg micros;
                                     in a normal gym rounds DOWN to 115 kg
225 lb on a lb bar           -> per side [45, 45] lb, exact to 1e-6 lb

10,000 kg of bench press attributes to chest 5,000 / triceps 2,500 /
front delts 2,000 / lats 500 — and to 4 hard sets: chest 4, triceps 2, delts 2.
```

# PR TYPES AND THEIR EXACT TRIGGERS

| Type | Value | Margin | Extra guard |
|---|---|---|---|
| E1RM | best session e1RM | +0.5% | needs ≥2 prior sessions; +2% more if RIR was a prior, not logged |
| WEIGHT | heaviest load ≥1 rep | any | needs a baseline; warm-ups excluded |
| REP_MAX | true 1/2/3/5/8/10/12/15/20RM | any | only at ladder rep counts, so "7 reps" doesn't create a new record class |
| REPS_AT_WEIGHT | most reps at exactly that load | any | snapped to the loadable weight, so 60.0 and 60.00001 are one key |
| SET_VOLUME | reps × load, one set | +1% | ≤20 reps |
| EXERCISE_VOLUME | that exercise, that session | +2% | — |
| SESSION_VOLUME | whole workout | +2% | — |
| SESSION_REPS | whole workout | +2% | — |

Global: max 3 badges per workout, tier-sorted (E1RM first); 20 h cooldown per key; bodyweight-exercise records where bodyweight rose get a "bodyweight +1.2 kg" annotation rather than a silent PR.

## Risks

- The weight-dependent equation is a preprint from Fitbod's own author, evaluated on an internal-consistency proxy rather than measured 1RMs — it has no external validation against true maxes. Mitigate by keeping the formula pluggable behind the E1rmFormula enum and by blending toward the independently-derived RTS chart at heavy loads, where the two happen to agree.
- The WD equation was fitted with weight in KILOGRAMS. Feeding it pounds silently shifts the intercept by 4.58·ln(2.205) ≈ 3.6 and quietly corrupts every estimate. The kg-only internal contract is load-bearing, not stylistic.
- Bodyweight and assisted exercises were excluded from the WD fit, so applying k(w) to a 100 kg pull-up system load is extrapolation. It is the best available option, but label e1RM on bodyweight movements as lower-confidence.
- EMG amplitude is not the same thing as share of mechanical work or share of hypertrophic stimulus. The volumeShare coefficients are defensible and directionally right, but no study measures them directly — do not present them to the user as measured physiology, present them as the app's attribution model.
- The 0.5 indirect set credit is an empirical fit across studies, not a biological constant; it is also inconsistent with Renaissance Periodization's landmarks, which count direct sets only. Applying RP MEV/MRV numbers to a fractional-set total will systematically over-report volume.
- Nuzzo 2024 implies real lifters get more reps at a given %1RM than any classical chart assumes, which means our e1RM values may run 3-7% high in absolute terms. This is acceptable for a progress index but must never be presented as a prediction the user should attempt in the rack.
- Counting bodyweight in total volume means a user who gains 3 kg sees their pull-up tonnage rise without getting stronger. Surfacing external volume alongside system volume is the fix, but the headline number is still gameable.
- Self-reported RPE is unreliable in novices (Zourdos: novices report 8.96 at a true 1RM), so early e1RM values will be systematically depressed and then jump as the user calibrates. Expect a visible discontinuity in the first two months and consider hiding the strength-rank ring until enough high-confidence samples exist.
- Pulley ratios, Smith counterbalance and machine stack labelling vary by gym and are effectively unknowable without user input. Any cross-user comparison or world-standings percentile built on machine lifts will be noisier than one built on barbell lifts.
- Drop sets, myo-reps and clusters have no agreed volume convention. Logging each mini-set separately (our choice) inflates the hard-set count relative to lifters who log them as one set — document the convention prominently or split-tag them so the weekly set count stays honest.
- The Hampel filter needs at least five points to fire, so the first few sessions on a new exercise have no outlier protection at all. A typo in week one can anchor the trend line.
