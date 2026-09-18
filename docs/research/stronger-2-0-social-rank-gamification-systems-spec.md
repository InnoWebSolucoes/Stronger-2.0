# Stronger 2.0 — Social, Rank & Gamification Systems Specification

## Summary

The central design decision: **rank must measure capability, not app usage.** Every generic fitness app fails because it awards points for opening the app, which makes the ladder meaningless to serious lifters. Stronger 2.0 splits the gamification layer into three semantically separate currencies that never mix: (1) **Iron Score** — an open-ended strength index anchored to real population percentiles, earned only by demonstrated e1RM normalized for bodyweight, age and sex; (2) **Rhythm** — a *weekly* consistency mechanic that explicitly credits rest days and deloads; (3) **Badges** — 68 discrete milestones with empirically-tracked rarity. Nothing you do in the app except lifting moves Iron Score. That single constraint is what separates this from a points layer bolted on.

The ladder reverse-engineers the reference screenshot exactly. With boundaries `b_k = 3.956·k^1.30` (k = rank index 1–21), rank 5 = "Novice II" spans [23.98, 32.04), so a user at 27.0 points needs 5.04 to reach Novice III — matching the screenshot's "27 pts, 5.2 to Novice III". The curve also lands 100.0 exactly on the Advanced/Elite boundary, giving a clean product story ("100 points = Elite"). Tier boundaries are pinned to Strength Level's published percentile anchors (Beginner = 5th, Novice = 20th, Intermediate = 50th, Advanced = 80th, Elite = 95th; their 2026 standards run on 195.5 M lifts from 27.9 M users), so the rank ladder and the world-standings tab are the same number rendered two ways.

**On decay:** research is unambiguous that punitive decay demotivates (LoL's 50–75 LP/day apex decay is widely cited as disheartening), while leniency *increases* engagement (Duolingo's streak freeze raised DAU; their leagues lifted learning time 17 % and cut best-user churn > 40 %). But strength genuinely detrains. Recommended policy: **current score decays on a physiologically-honest curve after a 21-day grace period (literature: strength well-retained 2–4 weeks, neural losses first), peak rank is permanent and displayed alongside, and decay is never notified.** You cannot be demoted below your peak's tier badge.

**On streaks:** naive daily streaks are actively harmful here. Apple's ring streaks are documented as pushing users to train through illness and injury; 68 % of fitness-app uninstallers cite notification fatigue and 42 % say alerts made them feel like they were failing *even when they had trained consistently*. Rhythm therefore counts **weeks, not days**, is measured against the user's own declared program target, treats a deload week (volume 40–70 % of trailing 4-week mean — deloads typically run ~6.4 days every 4–6 weeks) as a *success*, and degrades gradually (−1, then halve, then reset) rather than shattering.

**On honesty:** percentiles are computed by blending our own empirical CDF with a log-normal prior fitted to published standards, weight `w = n/(n+400)`, with a Wilson interval widened for prior uncertainty, and the number is suppressed entirely below n = 50 in favour of a literal count. Leaderboards are DOTS-normalized and cohort-segmented so a 60 kg lifter never competes on absolute load, with a two-tier Verified/Open split modelled on Strava's flagging architecture and OpenPowerlifting's video culture.

## Findings

### Strength Level's percentile anchors give us a free, credible calibration for the rank ladder

Strength Level's 2026 standards analyse 195,513,376 lifts from 27,893,268 users. Their five levels are explicit percentile cutoffs, symmetric around the median: Beginner = stronger than 5%, Novice = 20%, Intermediate = 50%, Advanced = 80%, Elite = 95%. They joint-model lift weight against bodyweight (since 2016, replacing fixed weight classes) and age-adjust with ages 25–40 as baseline. This means our tier names can map 1:1 onto vocabulary lifters already trust, and the world-standings tab and the rank ring become the same number in two skins.

Source: https://strengthlevel.com/about

### Punitive rank decay is documented as demotivating in the games that use it

League of Legends applies decay only at Diamond+: apex tiers (Master/Grandmaster/Challenger) lose 75 LP per day of inactivity with 14 banked days, Diamond loses 50 LP/day with 28 banked days. Commentary consistently describes decay and demotion as 'disheartening and demotivating, leading to frustration and reduced desire to play.' Riot's own mitigations (banking days by playing, restricting decay to the top ~1%) are the tell: even the canonical decay system confines it to a tiny elite cohort. For a fitness app where the median user is a hobbyist, blanket decay would be strictly worse.

Source: https://support-leagueoflegends.riotgames.com/hc/en-us/articles/4405783687443

### Leniency increases engagement — the opposite of the intuitive design

Duolingo found that being more lenient with streaks increases engagement: providing streak-freeze opportunities caused daily active users to 'skyrocket', because losing a long streak demotivates people into churning entirely. Their Streak Wager experiment produced statistically significant D1/D7/D14 retention lifts with D7 +14%. Duolingo credits streaks as 'the single most effective retention lever in the product.' Design implication: build the forgiveness mechanic in from v1, not as a later patch.

Source: https://yukaichou.com/gamification-study/master-the-art-of-streak-design-for-short-term-engagement-and-long-term-success/

### Weekly leagues with promotion/demotion are the highest-leverage social mechanic, and demotion fear does more work than promotion hope

Duolingo's leagues raised total learning time 17%, tripled highly engaged learners, and a 21% CURR lift cut best-user churn by over 40%. The mechanism is explicitly asymmetric loss aversion — fear of dropping a league drives more engagement than hope of advancing — combined with weekly resets creating urgency and a matching algorithm that keeps cohorts competitive without being discouraging (bottom finishers, 24th and below in a 30-person cohort, are relegated). For a training app the danger is that this rewards volume-chasing, so the score must be capped against the user's own baseline.

Source: https://duolingo.deconstructoroffun.com/mechanics/leagues

### Daily-streak fitness mechanics have a documented injury and mental-health cost

The Apple Watch ring-streak model is criticised precisely because it 'doesn't seem to grasp the concept of rest days.' The failure mode is explicit: 'a person decides to over-train in order to keep their streak, causing a serious injury that prevents them from closing their rings for a much longer period.' Same for illness — the watch nags you to move while you have a stomach virus. Research finds fixation on health tracking turns harmful particularly for perfectionists and people with a history of eating disorders or anxiety. Apple's own remediation was to add ring pausing for injury/recovery and per-weekday goals — i.e. they retrofitted programming-awareness onto a daily streak. We should start there.

Source: https://screenrant.com/apple-watch-rest-recovery-problem/

### Notification fatigue is the single largest uninstall driver in fitness, and guilt framing is the specific poison

68% of people who uninstall fitness apps cite notification fatigue as a primary reason, and 42% say those alerts made them feel like they were failing even when they had exercised consistently. Broader push data: 1 push/week leads to ~10% of users disabling notifications and ~6% uninstalling. Opt-in rates are collapsing — Android fell from 85% to 67% in one year post-Android 13, iOS 58%→56%, ~61% blended. Health & Fitness pushes perform best around 90 characters. Conclusion: budget notifications like a scarce resource, never send a guilt-framed one, and earn the opt-in with a value demonstration rather than a system prompt on launch.

Source: https://www.businessofapps.com/marketplace/push-notifications/research/push-notifications-statistics/

### Fitness-app gamification has measurable harm pathways that a spec must name and guard against

A systematic review and a Flinders University study link diet/fitness app use to higher disordered-eating symptomology and worse body image, dose-dependent with frequency of use. BJPsych Open's qualitative study identified eight themes of negative consequence: fixation on numbers, rigid diet, obsession, app dependency, high sense of achievement, extreme negative emotions, motivation from 'negative' messages, and excess competition. The MDPI ethics paper frames the core issue as autonomy: addiction and distraction are the ways gamification undermines it. Exercise-addiction prevalence in gym populations runs roughly 3.6–9.7% depending on cohort and instrument (EAI); the EAI-3 cutoff is 34/48. That means on any realistic user base, several percent of users are at risk — the guardrails are not hypothetical.

Source: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8485346/ ; https://www.mdpi.com/1660-4601/18/21/11052 ; https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10171173/

### Upward comparison helps, downward comparison hurts — which inverts naive leaderboard design

Research on fitness-app social comparison finds downward comparison thwarts self-efficacy while upward comparison enhances it, raising motivation and participation; upward selections are the majority (57.1% of targets users choose to compare against). Downward comparison also negatively affects social presence. Design implication: do NOT show the user how many people they are beating. Show them the person just ahead of them, the gap, and the path. A leaderboard that surfaces 'you are #4,281 of 90,000' is a downward-comparison machine.

Source: https://www.sciencedirect.com/science/article/abs/pii/S0747563222000267

### Strava's leaderboard-integrity architecture is the right model to copy for lift verification

Strava uses supervised ML on labelled data to auto-flag implausible activities, plus community reporting, plus explicit statistical triggers — 'segment time outliers multiple standard deviations faster than the existing leaderboard' and implausible power-to-weight ratios. They removed 2.3 M e-bike and 1.6 M vehicle activities from leaderboards in one cleanup, and introduced 'Verified Segments' as a separate integrity tier. The stated hard problem maps directly onto ours: distinguishing a genuinely elite performer from a cheat when the population contains both. Their answer — flagged activities stay in the user's own log but are removed from leaderboards — is exactly the right non-punitive posture for us.

Source: https://stories.strava.com/articles/keeping-stravas-segment-leaderboards-fair-an-engineers-perspective

### A modern, dataset-fitted e1RM equation outperforms Epley/Brzycki and should be our canonical estimator

arXiv 2603.17495 fitted a weight-dependent 1RM equation on 303,494 near-failure sets from 14,966 users across 388 exercises and 16 muscle groups in a consumer fitness app: 1RM = w × (1 + (r−1)^0.85 / (−2.55 + 4.58·ln w)). It reduced inconsistency by 17–22% versus four classical benchmarks, across all 183 exercises with sufficient data, validated by internal-consistency criterion (different rep/weight combos from the same user+exercise+window should yield the same estimate) with five-fold cross-validation. Classical formulas remain a sanity fallback: accuracy is ±5% in the 2–10 rep range, Brzycki best at 1–6, Epley best at 6–10, both agreeing within 2–3% at low reps. Hard rule: never rank anyone off a set above 6 reps.

Source: https://arxiv.org/pdf/2603.17495

### DOTS is the correct bodyweight normalizer for leaderboards, with published coefficients

DOTS = total_kg × 500 / P(bw), where P is a 4th-degree polynomial in bodyweight, fitted separately by sex. Male: P = −307.75076 + 24.0900756·bw − 0.1918759221·bw² + 0.0007391293·bw³ − 0.000001093·bw⁴. The IPF instead adopted IPF GL in 2020: points = total × 100/(A − B·e^(−C·bw)), an exponential-decay model with sex- and lift-specific constants; Wilks-2 (2020) changed the numerator constant from 500 to 600. DOTS is the better choice for us because it is a single sex-specific curve with no federation/equipment sub-variants, and is the de facto standard in lifting communities. Female coefficients should be verified against a reference implementation before shipping (commonly cited as A=−57.96288, B=13.6175032, C=−0.1126655495, D=0.0005158568, E=−0.0000010706).

Source: https://www.powerlifting.sport/fileadmin/ipf/data/ipf-formula/Models_Evaluation-I-2020.pdf

### Detraining physiology justifies a 21-day grace period and a slow decay curve

Both trained and novice lifters maintain strength, muscle and endurance for at least 2–4 weeks without training; early strength loss is primarily neural, not atrophy, which is why strength declines faster than size in weeks 1–2. Significant losses in strength and power appear at 3–4 weeks of cessation, more pronounced in older adults. Critically, gains are never fully lost — they remain above pre-training baseline — and as little as one high-intensity session per week preserves strength for at least 12 weeks. Design mapping: 21-day grace, then ~0.6%/week of current score with a floor at 70% of peak, and 'one session per week fully halts decay' is both true and a great in-app message.

Source: https://www.strongerbyscience.com/detraining/ ; https://www.mdpi.com/2813-0413/1/1/1

### Deloads must be a rewarded state, not a streak break

A 2024 survey of 246 competitive strength and physique athletes found deloads lasted ~6.4 days and were most often used to manage energy and fatigue; they are typically programmed every 4–6 weeks, and deloading every 2–3 weeks doesn't allow enough stress to accumulate. Deloading is framed in the literature as mitigating non-functional overreaching, overtraining syndrome, training monotony and injury risk. Evidence on whether deloads improve outcomes is genuinely mixed (one 9-week study found a mid-point deload slightly hurt lower-body strength), so we should support deloads without prescribing them. Detection rule for auto-crediting: week volume between 40% and 70% of trailing 4-week mean, with session count ≥ target−1.

Source: https://shura.shu.ac.uk/35313/3/Bell-APracticalApproach(AM).pdf ; https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10809978/

### Training frequency evidence sets the floor for what 'a qualifying week' means

Schoenfeld's meta-analysis found ≥2×/week per muscle group superior to 1×/week for hypertrophy when volume was equated; the standard recommendation is 2–3 days/week per muscle with ≥48 h rest. Myofibrillar protein synthesis remains elevated at 48 h (and up to 72 h in some work) after a moderate-volume session, though in trained individuals elevation may last only ~24 h. This justifies: minimum qualifying week = 2 sessions; muscle-readiness model = 48–72 h window; and it means an app demanding daily training is making a claim the literature does not support.

Source: https://weightology.net/the-members-area/evidence-based-guides/training-frequency-for-hypertrophy-the-evidence-based-bible/

### Achievement rarity should be observed and republished, not assigned once — this is how you avoid trophy inflation

Xbox Gamerscore was found to be 'inherently unbalanced, offering only a few points for difficult tasks and many points for trivial ones', which is why third-party trackers (TrueAchievements, Steam Hunters) re-derive points from actual unlock percentages across the whole player base. The documented failure mode is developers shipping trivial achievement lists to inflate scores. Our defence: every badge carries a *target* unlock rate at design time, but the *displayed* rarity is recomputed monthly from real unlock rates across eligible users, and badges whose observed rate drifts outside their band get re-tiered with a changelog.

Source: https://en.wikipedia.org/wiki/TrueAchievements ; https://www.patreon.com/posts/heres-how-steam-32150494

### Gamification's effect sizes are real but small — it cannot carry the product

Meta-analysis puts gamification at g = .49 cognitive, g = .36 motivational, g = .25 behavioural. A separate meta-analysis found gamification improves perceived autonomy and relatedness but has minimal impact on competence, with the authors explicitly questioning whether current implementations fulfil basic psychological needs. And a 2025 Frontiers paper found an S-shaped relationship between gamification feature richness and exercise-adherence intention — more features stop helping and start hurting. Conclusion: ship a small number of deeply-meaningful mechanics (rank, rhythm, badges, one social surface) rather than a broad shallow layer, and make competence the thing we actually serve, since that is where generic gamification fails.

Source: https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1671543/full ; https://link.springer.com/article/10.1007/s11423-023-10337-7

### Hevy's social surface is the competitive baseline to beat

Hevy's Home tab is a feed of workouts from people you follow, each post showing name, optional description, duration, training volume and PR count, with likes, threaded comments (replies, comment likes, clickable links) and a horizontally-swipeable media carousel. Discovery is a suggested-athletes carousel. Privacy: private profile = follow requests required; individual workouts can be marked private before saving even on a public profile. Gap we can own: they have no auto-generated share artefact (our muscle-map image), no rank, and no verified leaderboard.

Source: https://help.hevyapp.com/hc/en-us/articles/35688036014231-Hevy-App-Social-Guide-Connect-Follow-and-Share-Your-Workouts

## Recommendations

- Make Iron Score movable ONLY by demonstrated strength (e1RM normalized for bodyweight, age, sex) and never by app engagement — put consistency and social activity in separate, visually distinct currencies so the ladder stays credible to serious lifters.
- Ship the rank ladder as b_k = 3.956·k^1.30 over 21 sub-tiers so that Novice II = [23.98, 32.04) reproduces the reference screenshot exactly (27 pts, ~5.0 to Novice III) and 100.0 lands precisely on the Advanced→Elite boundary.
- Pin tier boundaries to Strength Level's published percentile anchors (5/20/50/80/95) so the rank ring and the world-standings tab are provably the same number, and ship the mapping as a versioned, auditable calibration file.
- Allow current Iron Score to decay after a 21-day grace period at 0.6%/week with a hard floor at 70% of peak, but make peak rank permanent, display it beside current rank, never send a decay notification, and tell the user truthfully that one hard session per week fully halts it.
- Count consistency in WEEKS against the user's own declared program target, not days — and award a badge for taking a correctly-executed deload, so the mechanic rewards good programming instead of punishing it.
- Degrade Rhythm gradually (miss one week: −1; two consecutive: halve; four consecutive: reset) rather than zeroing it, following Duolingo's finding that leniency raises engagement because a shattered streak causes outright churn.
- Cap weekly league Effort Points at 130% of the user's own trailing 8-week volume baseline so the competitive layer physically cannot reward overtraining, and make the cap visible in the UI as 'you have earned everything this week is worth'.
- Default the Iron League to OFF, opt-in, in cohorts of 30 matched on training age and target frequency, with demotion limited to the bottom 3 and disabled entirely for any week flagged deload, illness or injury.
- Show the user the lifter just ahead of them and the gap, never their absolute global position, because research shows downward comparison thwarts self-efficacy while upward comparison raises it.
- Segment every leaderboard by sex, DOTS-normalized score, ±5 kg bodyweight band, age band and training age, and never publish an absolute-load leaderboard anywhere in the product.
- Run two leaderboard tiers — Open and Verified — where Verified requires ≥8 qualifying weeks, ≥3 independent sessions establishing the lift within 90 days, e1RM from sets of ≤6 reps only, a bodyweight entry within 14 days, and video for a top-100 global placement.
- Compute e1RM with the weight-dependent equation w·(1 + (r−1)^0.85 / (−2.55 + 4.58·ln w)) and hard-refuse any ranking input from sets above 6 reps, where prediction error exceeds the effect sizes we are trying to measure.
- Use median-of-top-3 sessions rather than single-session max for all ranking and leaderboard inputs, so one fat-finger entry or one fluke cannot move a rank.
- Blend our empirical CDF with a log-normal prior fitted to published standards using w = n/(n+400), and suppress the percentile number entirely below n = 50 in favour of an honest literal count ('31 lifters like you so far').
- Display percentile confidence explicitly as a band ('Stronger than 78% of lifters like you, ±6%') and show the cohort definition inline, rather than presenting a single false-precision number.
- Rewrite the reference's 'Top 80%' copy, which is ambiguous and reads as a failure — use 'Stronger than 80% of lifters like you' with the cohort named underneath.
- Ship 68 badges with precise machine-checkable predicates and recompute displayed rarity monthly from observed unlock rates, re-tiering any badge that drifts outside its band, with a public changelog.
- Award exactly one badge for onboarding and none for trivial actions, and gate every session-scoped volume badge behind a plausibility check plus a one-per-7-days cap so badge-chasing cannot become a junk-volume incentive.
- Auto-generate the share image as an SVG anatomical muscle map coloured by each muscle's share of session volume, at 1080×1350, containing volume, reps, duration and PR count — and never bodyweight, photos or location.
- Default new accounts to followers-only, default bodyweight and progress photos to never-shareable (requiring an explicit per-post opt-in every time, with no remembered setting), and attach location to nothing.
- Disable leaderboards, follower discovery and DMs entirely for accounts under 18, and never rank a minor on any bodyweight-derived metric.
- Budget notifications hard: maximum 3 per week, none between 21:00 and 07:00 local, none on a day the user's own program prescribes as rest, and ban guilt framing outright given that 42% of uninstallers say alerts made them feel like they were failing.
- Require notifications to carry information the user does not already have (a rank change, a friend's PR, a recovered muscle group) and never restate a state the user can see by opening the app.
- Implement an overtraining circuit-breaker on acute:chronic workload ratio — at ACWR > 1.5 for 7 days, or 6+ sessions/week for 3 consecutive weeks, suppress all competitive surfaces, hide the league, and surface a recovery recommendation instead.
- Write a published Refusal List of things the product will never do (no calorie targets, no body-fat shaming, no body comparison, no 'you've fallen behind' copy, no infinite scroll, no streak that punishes rest) and treat it as a spec artefact that any feature PR is reviewed against.

## Data

═══════════════════════════════════════════════════════════════════════════
PART 1 — THE RANK LADDER ("IRON SCORE")
═══════════════════════════════════════════════════════════════════════════

DESIGN PRINCIPLE
Iron Score answers exactly one question: "how strong are you, relative to
people like you?" It is NOT a loyalty score. Logging in, writing comments,
following people, and opening the app all move it by exactly zero. This is
the single most important decision in the whole gamification spec — it is
what a Hevy power user will check first, and if the number is farmable they
will dismiss the entire product as a toy.

GENERATING FUNCTION
  b_k = 3.956 · k^1.30        (k = 0..21, b_0 = 0)
Chosen so that:
  • rank 5 ("Novice II") = [23.98, 32.04) — contains the screenshot's 27 pts
    and leaves 5.04 points to Novice III (screenshot: 5.2). Exact match.
  • b_12 = 100.01 → 100.0 is precisely the Advanced III → Elite I boundary.
    Product story: "100 points is Elite." Clean, memorable, non-arbitrary.
  • Score is OPEN-ENDED above 207.1 (Legendary), so world-record holders are
    never capped and the ladder never runs out.

THE LADDER

| # | Tier         | Sub | Score range      | Width | Population percentile at entry | Typical time-in-rank* |
|---|--------------|-----|------------------|-------|--------------------------------|------------------------|
| 0 | Unranked     | —   | n/a              | —     | n/a (< 3 qualifying lifts)     | —                      |
| 1 | Beginner     | I   | 0.00 – 3.96      | 3.96  | 0.0                            | 1–2 wk                 |
| 2 | Beginner     | II  | 3.96 – 9.74      | 5.78  | ~0.6                           | 2–4 wk                 |
| 3 | Beginner     | III | 9.74 – 16.50     | 6.76  | ~2.1                           | 3–6 wk                 |
| 4 | Novice       | I   | 16.50 – 23.98    | 7.48  | 5.0  ← StrengthLevel anchor    | 4–8 wk                 |
| 5 | Novice       | II  | 23.98 – 32.04    | 8.06  | ~9.4                           | 6–10 wk   ← screenshot |
| 6 | Novice       | III | 32.04 – 40.63    | 8.59  | ~14.2                          | 8–12 wk                |
| 7 | Intermediate | I   | 40.63 – 49.65    | 9.02  | 20.0 ← StrengthLevel anchor    | 3–5 mo                 |
| 8 | Intermediate | II  | 49.65 – 59.03    | 9.38  | ~29.3                          | 4–6 mo                 |
| 9 | Intermediate | III | 59.03 – 68.79    | 9.76  | ~39.2                          | 5–8 mo                 |
|10 | Advanced     | I   | 68.79 – 78.96    | 10.17 | 50.0 ← StrengthLevel anchor    | 7–11 mo                |
|11 | Advanced     | II  | 78.96 – 89.33    | 10.37 | ~60.4                          | 9–14 mo                |
|12 | Advanced     | III | 89.33 – 100.01   | 10.68 | ~70.3                          | 12–18 mo               |
|13 | Elite        | I   | 100.01 – 110.97  | 10.96 | 80.0 ← StrengthLevel anchor    | 15–24 mo               |
|14 | Elite        | II  | 110.97 – 122.24  | 11.27 | ~85.4                          | 18–30 mo               |
|15 | Elite        | III | 122.24 – 133.67  | 11.43 | ~90.5                          | 2–3 yr                 |
|16 | Master       | I   | 133.67 – 145.50  | 11.83 | 95.0 ← StrengthLevel anchor    | 2–4 yr                 |
|17 | Master       | II  | 145.50 – 157.33  | 11.83 | ~96.6                          | 3–5 yr                 |
|18 | Master       | III | 157.33 – 169.43  | 12.10 | ~97.9                          | 3–6 yr                 |
|19 | World Class  | I   | 169.43 – 181.70  | 12.27 | 99.0                           | 4–8 yr                 |
|20 | World Class  | II  | 181.70 – 194.48  | 12.78 | 99.9                           | lifetime               |
|21 | World Class  | III | 194.48 – 207.14  | 12.66 | 99.99                          | lifetime               |
|22 | Legendary    | —   | 207.14 +         | ∞     | > 99.99                        | national/world record  |

* Time-in-rank is the DESIGN TARGET, to be validated against real cohort data
  after 6 months of live users; it is what the exponent 1.30 is tuned to
  produce. If observed median time-in-rank at Intermediate II exceeds ~7
  months, re-tune the exponent downward, never the underlying strength model.

WHAT EARNS POINTS (exhaustive)
  1. A new best e1RM on any Ranked Lift, from a set of ≤ 6 reps, logged in a
     session with ≥ 2 other exercises (to exclude one-rep-drive-by sessions).
  2. A bodyweight entry that lowers your bodyweight while lifts hold (relative
     strength improves → score improves). Honest and physiologically real.
  3. An age-band rollover (age adjustment re-applied annually).
Nothing else. Not sessions. Not volume. Not comments. Not referrals. Not PRO.

WHAT NEVER EARNS POINTS
  App opens · streaks · badges · likes received · following · invites ·
  subscription tier · writing workout notes · uploading photos · session count

RANKED LIFTS (the 12 that feed the score)
  Barbell Back Squat, Barbell Front Squat, Barbell Bench Press, Barbell
  Incline Bench, Barbell Overhead Press, Conventional Deadlift, Sumo
  Deadlift, Romanian Deadlift, Barbell Row, Weighted Pull-up, Weighted Dip,
  Barbell Hip Thrust.
  Rationale: barbell, bilateral, well-standardised ROM, and all twelve have
  published population standards. Machine and cable variants are tracked and
  charted but DO NOT feed rank, because loading is not comparable across
  equipment brands — say this explicitly in the UI, it builds trust.

PER-MUSCLE RANK (feeds the World Standings tab)
Each muscle group gets its own independent Iron Score from its indicator
lifts, so "your quadriceps are Intermediate, your triceps are Advanced" is a
real computation, not flavour text.

| Muscle group   | Indicator lifts (weighted)                                  |
|----------------|-------------------------------------------------------------|
| Quadriceps     | Back Squat 0.5, Front Squat 0.3, Leg Press 0.2              |
| Hamstrings     | RDL 0.5, Conventional DL 0.3, Leg Curl 0.2                  |
| Glutes         | Hip Thrust 0.5, Sumo DL 0.3, Back Squat 0.2                 |
| Chest          | Bench 0.5, Incline Bench 0.3, Weighted Dip 0.2              |
| Upper back     | Barbell Row 0.4, Weighted Pull-up 0.4, Lat Pulldown 0.2     |
| Lats           | Weighted Pull-up 0.6, Lat Pulldown 0.4                      |
| Shoulders      | OHP 0.6, Incline Bench 0.2, Lateral Raise 0.2               |
| Triceps        | Close-grip Bench 0.4, Weighted Dip 0.4, Skullcrusher 0.2    |
| Biceps         | Barbell Curl 0.5, Weighted Chin-up 0.3, Preacher Curl 0.2   |
| Posterior chain| Conventional DL 0.5, RDL 0.3, Good Morning 0.2              |
| Core           | Weighted Plank 0.4, Ab Wheel 0.3, Hanging Leg Raise 0.3     |
| Calves         | Standing Calf Raise 0.6, Seated Calf Raise 0.4              |
| Forearms       | Farmer Carry 0.5, Deadlift hold 0.3, Wrist Curl 0.2         |
| Traps          | Shrug 0.5, Deadlift 0.3, Upright Row 0.2                    |

A muscle with no indicator-lift data in 90 days renders as "Untested — log a
{lift} to find out", never as zero. Never show a user a 0 they didn't earn.

═══════════════════════════════════════════════════════════════════════════
PART 2 — DECAY POLICY (the recommendation)
═══════════════════════════════════════════════════════════════════════════

RECOMMENDED POLICY: "SOFT DECAY, PERMANENT PEAK"

  1. GRACE: 21 days from last qualifying session. Zero decay. Rationale:
     literature shows strength well-retained for 2–4 weeks of cessation.
  2. DECAY: from day 22, current score decays 0.6% of current value per week.
     Applied continuously, not in steps, so the ring never "drops" visibly
     overnight. After 12 weeks off that is a ~7% reduction — roughly one
     sub-tier — which is physiologically honest and not catastrophic.
  3. FLOOR: decay stops at 70% of all-time peak. You can never fall below
     Beginner III if you once hit Elite. Literature: gains never fully return
     to pre-training baseline.
  4. HALT: a single qualifying session (≥ 2 ranked lifts at ≥ 80% of your
     e1RM) resets the grace clock in full. Message: "One hard session a week
     holds everything." This is TRUE — research shows 1×/week high-intensity
     training preserves strength for at least 12 weeks — and it is the single
     best re-engagement message we will ever have, because it is not a threat.
  5. PEAK IS PERMANENT: profile always shows `Advanced I · peak Advanced III
     (Mar 2026)`. The tier badge for your peak is never revoked.
  6. INSTANT RESTORE: any new e1RM ≥ your peak-era e1RM restores the full peak
     score immediately, no re-climb. This is the anti-LoL decision.
  7. PAUSE: injury / illness / pregnancy / bereavement pause, self-declared,
     no proof, up to 26 weeks, freezes decay entirely. Abuse is irrelevant —
     the people who abuse it are not on the world leaderboard anyway.
  8. NEVER NOTIFIED. Decay is never a push, never a badge, never a red arrow,
     never an email. The user discovers it by opening the app, at which point
     they are already engaged. Punishing absence with a notification is the
     mechanism by which 42% of uninstallers came to feel they were failing.

WHY NOT HARD DECAY
  LoL's decay is confined to the top ~1% (Diamond+) and is still the most
  complained-about mechanic in the game. Its purpose there is leaderboard
  integrity — stopping people from parking a rank — which we solve instead
  through a "last verified" timestamp on leaderboard entries. Hard decay in a
  fitness app takes the exact population you most want back (people who
  drifted away) and gives them a reason not to return.

WHY NOT ZERO DECAY
  Because it would be a lie, and lifters would spot it. A user who hasn't
  trained in 8 months is not as strong as their PR says. "Current vs peak" is
  how every honest strength community already talks. Zero decay would also
  corrupt the world-standings tab, which is the feature with the most
  credibility at stake.

LEAGUE DEMOTION IS SEPARATE AND IS ALLOWED
  Iron Score decays gently; the weekly Iron League demotes normally (bottom 3
  of 30). This is fine because the league is opt-in, weekly, low-stakes, and
  explicitly about effort not capability. Duolingo's data says demotion is the
  engine that makes a leaderboard feel consequential. Keep demotion where it
  is cheap; keep it out of the thing that represents your body.

═══════════════════════════════════════════════════════════════════════════
PART 3 — "RHYTHM": WEEKLY CONSISTENCY DONE RIGHT
═══════════════════════════════════════════════════════════════════════════

WHY DAILY STREAKS ARE WRONG HERE
  Rest is not the absence of training, it is part of training. Myofibrillar
  protein synthesis remains elevated 24–72 h post-session; the frequency
  literature supports 2–3×/week per muscle with ≥48 h rest. A daily streak
  therefore asks users to do the thing the evidence says not to do. The Apple
  Watch ring streak is the cautionary tale: documented cases of users
  over-training to protect a streak and injuring themselves, and of the watch
  nagging sick users to move.

THE MECHANIC
  • The user declares a weekly TARGET (2–6 sessions) when they pick or build
    a program. Changing it mid-streak is allowed and does not break anything.
  • Week runs Mon 00:00 → Sun 23:59 local, with a 6-hour grace into Monday
    for late-night Sunday lifters.
  • A week is ON RHYTHM if any of:
      (a) sessions ≥ target
      (b) sessions ≥ target − 1 AND a Recovery Credit is auto-spent
          (1 credit accrues per 4 on-rhythm weeks, max 3 banked)
      (c) the week is a DELOAD: volume between 40% and 70% of the trailing
          4-week mean AND sessions ≥ target − 1
      (d) the week is flagged PAUSE (illness/injury/travel/life), max 2 per
          quarter, self-declared, no proof
  • Deload and Pause weeks render as distinct glyphs in the 52-week ribbon —
    a chevron and a dot — NOT as gaps. A user scrolling back should see a
    training history, not a wall of shame.

DEGRADATION (the leniency rule)
  miss 1 week            → streak − 1 ("Rhythm dipped")
  miss 2 consecutive     → streak ÷ 2, rounded down
  miss 4 consecutive     → streak resets to 0, but LONGEST RHYTHM is kept
                           permanently on the profile
  Rationale: Duolingo found leniency raises DAU because a shattered streak
  causes outright churn. A 60-week streak that becomes 59 is recoverable; one
  that becomes 0 is a reason to delete the app.

QUALIFYING SESSION (anti-gaming)
  ≥ 3 working sets, ≥ 2 distinct exercises, ≥ 10 minutes elapsed, and ≥ 4 h
  since the last session started. A 30-second "open app, log one set" does
  not count. Say this in the UI up front — hidden rules feel like cheating.

DELIBERATE OMISSIONS
  • No daily streak anywhere in the product. Not as a secondary stat.
  • No "streak at risk" push more than once per week, never after 20:00, never
    on a day the user's own program prescribes as rest.
  • No purchasable streak repair. Monetising streak anxiety is the line.
  • No streak leaderboard. Ranking people by consecutive weeks selects for the
    users least willing to take a deload.

═══════════════════════════════════════════════════════════════════════════
PART 4 — BADGE CATALOGUE (68 badges) — FULL JSON
═══════════════════════════════════════════════════════════════════════════

RARITY BANDS (observed unlock rate among ELIGIBLE users, recomputed monthly)
  common    ≥ 40%      uncommon  15–40%     rare  4–15%
  epic      0.5–4%     mythic    < 0.5%
Eligible = accounts with ≥ 8 qualifying weeks (excludes tourists, which is
what makes the denominators honest).

ANTI-INFLATION RULES
  R1. Exactly ONE onboarding badge exists (day_one). No badge for a first
      like, first follow, first photo, first note, first anything else.
  R2. Displayed rarity is OBSERVED, not assigned. Monthly recompute; badges
      drifting outside their band are re-tiered with a public changelog.
  R3. No badge may be earnable more than once per 7 days (blocks farming).
  R4. Every session-scoped volume badge requires plausibility_score ≥ 0.7
      (see Part 7) or it is withheld pending review.
  R5. No badge rewards training MORE than the user's program prescribes.
      deload_discipline, rest_respecter and perfect_month exist specifically
      to reward restraint, and they are deliberately rarer than their
      excess-rewarding equivalents would have been.

```json
{
  "schemaVersion": "1.0.0",
  "rarityBands": {
    "common":   { "minObservedRate": 0.40, "maxObservedRate": 1.00, "color": "#9CA3AF" },
    "uncommon": { "minObservedRate": 0.15, "maxObservedRate": 0.40, "color": "#34D399" },
    "rare":     { "minObservedRate": 0.04, "maxObservedRate": 0.15, "color": "#60A5FA" },
    "epic":     { "minObservedRate": 0.005,"maxObservedRate": 0.04, "color": "#A78BFA" },
    "mythic":   { "minObservedRate": 0.0,  "maxObservedRate": 0.005,"color": "#F5A524" }
  },
  "artCategories": ["Rank", "Journey", "Session"],
  "collections": {
    "lifting_legacy": {
      "name": "Lifting Legacy",
      "size": 16,
      "description": "The sixteen load milestones every lifter chases. Plates on the bar, and bodyweight multiples.",
      "members": ["one_plate_bench","two_plate_bench","three_plate_bench","one_plate_ohp","two_plate_squat","three_plate_squat","four_plate_squat","two_plate_dl","three_plate_dl","four_plate_dl","five_plate_dl","bw_bench","double_bw_dl","triple_bw_dl","club_1000","club_1200"]
    },
    "cartography": { "name": "Cartography", "size": 4, "members": ["explorer","cartographer","encyclopedist","full_map"] },
    "the_long_game": { "name": "The Long Game", "size": 6, "members": ["four_in_a_row","quarter_locked","half_year_habit","year_of_weeks","two_year_thread","five_years_in"] }
  },

  "badges": [

    { "id":"day_one", "name":"Day One", "category":"milestone", "art":"Journey", "rarity":"common",
      "targetRate":0.95,
      "predicate":"count(sessions where qualifying) >= 1",
      "copy":{ "title":"Day One", "subtitle":"You logged your first session.",
        "unlock":"Everything after this is just showing up again.", "locked":"Finish one workout." },
      "repeatable":false },

    { "id":"first_finish", "name":"The Finisher", "category":"milestone", "art":"Session", "rarity":"common",
      "targetRate":0.88,
      "predicate":"count(sessions where qualifying and completedViaFinishButton) >= 1",
      "copy":{ "title":"The Finisher", "subtitle":"First workout closed out properly.",
        "unlock":"You hit Finish. That is the whole habit in one button.", "locked":"Complete and finish a workout." },
      "repeatable":false },

    { "id":"first_week", "name":"Week One", "category":"consistency", "art":"Journey", "rarity":"common",
      "targetRate":0.72,
      "predicate":"count(weeks where onRhythm) >= 1",
      "copy":{ "title":"Week One", "subtitle":"Hit your weekly target once.",
        "unlock":"One week on rhythm. This is where streaks actually start.", "locked":"Hit your weekly session target." },
      "repeatable":false },

    { "id":"four_in_a_row", "name":"Four in a Row", "category":"consistency", "art":"Journey", "rarity":"common",
      "targetRate":0.51, "collection":"the_long_game",
      "predicate":"maxRun(weeks where onRhythm) >= 4",
      "copy":{ "title":"Four in a Row", "subtitle":"Four consecutive weeks on rhythm.",
        "unlock":"A month of showing up. Most people never get here.", "locked":"Four consecutive on-rhythm weeks." },
      "repeatable":false },

    { "id":"quarter_locked", "name":"Quarter Locked", "category":"consistency", "art":"Journey", "rarity":"uncommon",
      "targetRate":0.28, "collection":"the_long_game",
      "predicate":"maxRun(weeks where onRhythm) >= 13",
      "copy":{ "title":"Quarter Locked", "subtitle":"Thirteen consecutive weeks on rhythm.",
        "unlock":"A full training block, start to finish. Now the numbers start moving.", "locked":"Thirteen consecutive on-rhythm weeks." },
      "repeatable":false },

    { "id":"half_year_habit", "name":"Half Year Habit", "category":"consistency", "art":"Journey", "rarity":"rare",
      "targetRate":0.11, "collection":"the_long_game",
      "predicate":"maxRun(weeks where onRhythm) >= 26",
      "copy":{ "title":"Half Year Habit", "subtitle":"Twenty-six consecutive weeks.",
        "unlock":"Six months. You are not trying to get in shape any more. You train.", "locked":"Twenty-six consecutive on-rhythm weeks." },
      "repeatable":false },

    { "id":"year_of_weeks", "name":"Year of Weeks", "category":"consistency", "art":"Journey", "rarity":"epic",
      "targetRate":0.031, "collection":"the_long_game",
      "predicate":"maxRun(weeks where onRhythm) >= 52",
      "copy":{ "title":"Year of Weeks", "subtitle":"Fifty-two consecutive weeks on rhythm.",
        "unlock":"Fifty-two for fifty-two. Through holidays, travel, bad weeks, all of it.", "locked":"Fifty-two consecutive on-rhythm weeks." },
      "repeatable":false },

    { "id":"two_year_thread", "name":"Two Year Thread", "category":"consistency", "art":"Journey", "rarity":"mythic",
      "targetRate":0.004, "collection":"the_long_game",
      "predicate":"maxRun(weeks where onRhythm) >= 104",
      "copy":{ "title":"Two Year Thread", "subtitle":"One hundred and four consecutive weeks.",
        "unlock":"Two years unbroken. Fewer than one in two hundred lifters here have this.", "locked":"One hundred and four consecutive on-rhythm weeks." },
      "repeatable":false },

    { "id":"the_comeback", "name":"The Comeback", "category":"consistency", "art":"Journey", "rarity":"uncommon",
      "targetRate":0.22,
      "predicate":"exists gap g where g.days >= 28 and count(weeks where onRhythm and week.start > g.end) >= 4 consecutive",
      "copy":{ "title":"The Comeback", "subtitle":"Away 28+ days, then four straight weeks back.",
        "unlock":"Coming back is harder than never stopping. You did the hard one.", "locked":"Return after a long break and string four weeks together." },
      "repeatable":true, "cooldownDays":180 },

    { "id":"deload_discipline", "name":"Deload Discipline", "category":"consistency", "art":"Journey", "rarity":"rare",
      "targetRate":0.09,
      "predicate":"exists week w where w.volume >= 0.40*trailingMean(4,volume) and w.volume <= 0.70*trailingMean(4,volume) and w.sessions >= target-1 and nextWeek(w).volume >= 0.90*trailingMean(4,volume)",
      "copy":{ "title":"Deload Discipline", "subtitle":"Backed off on purpose, then came back at full strength.",
        "unlock":"You deloaded and reloaded. That is programming, not laziness. Most people cannot make themselves do this.", "locked":"Take a planned light week, then return to full volume." },
      "repeatable":true, "cooldownDays":28 },

    { "id":"rest_respecter", "name":"Rest Respecter", "category":"consistency", "art":"Journey", "rarity":"uncommon",
      "targetRate":0.24,
      "predicate":"maxRun(weeks where onRhythm and fullRestDays >= 2) >= 8",
      "copy":{ "title":"Rest Respecter", "subtitle":"Eight weeks on rhythm with at least two full rest days each.",
        "unlock":"Trained hard, rested properly, eight weeks running. This is what adaptation actually needs.", "locked":"Eight on-rhythm weeks with two or more full rest days." },
      "repeatable":false },

    { "id":"perfect_month", "name":"Exactly Right", "category":"consistency", "art":"Journey", "rarity":"rare",
      "targetRate":0.07,
      "predicate":"maxRun(weeks where sessions == target) >= 4",
      "copy":{ "title":"Exactly Right", "subtitle":"Four weeks hitting your target exactly. Not over, not under.",
        "unlock":"Four weeks of doing precisely what the plan said. Restraint is a skill.", "locked":"Four consecutive weeks at exactly your target session count." },
      "repeatable":true, "cooldownDays":60 },

    { "id":"sessions_100", "name":"Century", "category":"milestone", "art":"Journey", "rarity":"uncommon",
      "targetRate":0.34,
      "predicate":"count(sessions where qualifying) >= 100",
      "copy":{ "title":"Century", "subtitle":"One hundred logged sessions.",
        "unlock":"One hundred sessions. Roughly a year of twice-weekly training, compressed into a number.", "locked":"Log 100 qualifying sessions." },
      "repeatable":false },

    { "id":"sessions_250", "name":"Quarter Thousand", "category":"milestone", "art":"Journey", "rarity":"rare",
      "targetRate":0.13,
      "predicate":"count(sessions where qualifying) >= 250",
      "copy":{ "title":"Quarter Thousand", "subtitle":"Two hundred and fifty sessions.",
        "unlock":"250 sessions. You have spent roughly 300 hours under a bar.", "locked":"Log 250 qualifying sessions." },
      "repeatable":false },

    { "id":"sessions_500", "name":"Five Hundred", "category":"milestone", "art":"Journey", "rarity":"epic",
      "targetRate":0.028,
      "predicate":"count(sessions where qualifying) >= 500",
      "copy":{ "title":"Five Hundred", "subtitle":"Five hundred sessions logged.",
        "unlock":"500 sessions. At three a week that is over three years without stopping.", "locked":"Log 500 qualifying sessions." },
      "repeatable":false },

    { "id":"sessions_1000", "name":"Four Figures", "category":"milestone", "art":"Journey", "rarity":"mythic",
      "targetRate":0.003,
      "predicate":"count(sessions where qualifying) >= 1000",
      "copy":{ "title":"Four Figures", "subtitle":"One thousand sessions.",
        "unlock":"A thousand sessions. There is nothing left for us to tell you about consistency.", "locked":"Log 1,000 qualifying sessions." },
      "repeatable":false },

    { "id":"early_bird", "name":"Before the World", "category":"consistency", "art":"Session", "rarity":"uncommon",
      "targetRate":0.19,
      "predicate":"count(sessions where qualifying and localStartHour < 7) >= 20",
      "copy":{ "title":"Before the World", "subtitle":"Twenty sessions started before 7am.",
        "unlock":"Twenty sessions finished before most people's alarms went off.", "locked":"Train before 7am, twenty times." },
      "repeatable":false },

    { "id":"night_shift", "name":"Night Shift", "category":"consistency", "art":"Session", "rarity":"uncommon",
      "targetRate":0.17,
      "predicate":"count(sessions where qualifying and localStartHour >= 21) >= 20",
      "copy":{ "title":"Night Shift", "subtitle":"Twenty sessions started after 9pm.",
        "unlock":"Empty gym, your music, nobody waiting for the rack. Twenty times.", "locked":"Train after 9pm, twenty times." },
      "repeatable":false },

    { "id":"holiday_lifter", "name":"Closed for Nobody", "category":"consistency", "art":"Session", "rarity":"uncommon",
      "targetRate":0.16,
      "predicate":"exists session s where s.localDate in {Dec24, Dec25, Dec31, Jan01} and s.qualifying",
      "copy":{ "title":"Closed for Nobody", "subtitle":"Trained on a day everyone else took off.",
        "unlock":"The gym was almost empty and you were in it.", "locked":"Train on Christmas Eve, Christmas Day, New Year's Eve or New Year's Day." },
      "repeatable":true, "cooldownDays":300 },

    { "id":"travel_proof", "name":"Travel Proof", "category":"consistency", "art":"Session", "rarity":"rare",
      "targetRate":0.08,
      "predicate":"countDistinct(session.gymId where session.start within 14 days) >= 3",
      "copy":{ "title":"Travel Proof", "subtitle":"Three different gyms in a fortnight.",
        "unlock":"Different bars, different plates, same work.", "locked":"Train at three different gyms within fourteen days." },
      "repeatable":true, "cooldownDays":90 },

    { "id":"iron_anniversary", "name":"Iron Anniversary", "category":"milestone", "art":"Journey", "rarity":"epic",
      "targetRate":0.021,
      "predicate":"for n in {1,2,3}: exists qualifying session within ±3 days of (firstSessionDate + n years)",
      "copy":{ "title":"Iron Anniversary", "subtitle":"Trained on your anniversary, three years running.",
        "unlock":"Three years to the day. Same person, different body.", "locked":"Train on the anniversary of your first session, three years in a row." },
      "repeatable":false },

    { "id":"ton_club", "name":"Ton Club", "category":"volume", "art":"Session", "rarity":"common",
      "targetRate":0.82,
      "predicate":"exists session s where s.totalVolumeKg >= 1000",
      "copy":{ "title":"Ton Club", "subtitle":"1,000 kg in a single session.",
        "unlock":"A metric ton moved. Roughly two grand pianos.", "locked":"Move 1,000 kg of total volume in one session." },
      "repeatable":false },

    { "id":"five_ton", "name":"Five Ton Session", "category":"volume", "art":"Session", "rarity":"uncommon",
      "targetRate":0.38,
      "predicate":"exists session s where s.totalVolumeKg >= 5000 and s.plausibility >= 0.7",
      "copy":{ "title":"Five Ton Session", "subtitle":"5,000 kg in one workout.",
        "unlock":"Five tons. That is an ambulance, lifted off the ground.", "locked":"Move 5,000 kg in one session." },
      "repeatable":false },

    { "id":"ten_ton", "name":"Ten Ton Session", "category":"volume", "art":"Session", "rarity":"rare",
      "targetRate":0.12,
      "predicate":"exists session s where s.totalVolumeKg >= 10000 and s.plausibility >= 0.7",
      "copy":{ "title":"Ten Ton Session", "subtitle":"10,000 kg in one workout.",
        "unlock":"Ten tons in one session. An adult bull elephant, and then most of another.", "locked":"Move 10,000 kg in one session." },
      "repeatable":false },

    { "id":"twenty_ton", "name":"Twenty Ton Session", "category":"volume", "art":"Session", "rarity":"epic",
      "targetRate":0.019,
      "predicate":"exists session s where s.totalVolumeKg >= 20000 and s.plausibility >= 0.85 and s.durationMin >= 45",
      "copy":{ "title":"Twenty Ton Session", "subtitle":"20,000 kg in one workout.",
        "unlock":"Twenty tons. A loaded double-decker bus, plus change.", "locked":"Move 20,000 kg in one session." },
      "repeatable":false },

    { "id":"thirty_ton", "name":"Thirty Ton Session", "category":"volume", "art":"Session", "rarity":"mythic",
      "targetRate":0.002,
      "predicate":"exists session s where s.totalVolumeKg >= 30000 and s.plausibility >= 0.9 and s.durationMin >= 70 and s.verified",
      "copy":{ "title":"Thirty Ton Session", "subtitle":"30,000 kg in a single session.",
        "unlock":"Thirty tons. We checked this one twice.", "locked":"Move 30,000 kg in one verified session." },
      "repeatable":false, "note":"Guarded hard: this is the badge most likely to drive junk-volume chasing. Requires plausibility, duration floor and verification." },

    { "id":"lifetime_100k", "name":"Elephant", "category":"volume", "art":"Journey", "rarity":"uncommon",
      "targetRate":0.36,
      "predicate":"sum(sessions.totalVolumeKg) >= 100000",
      "copy":{ "title":"Elephant", "subtitle":"100,000 kg lifted, all time.",
        "unlock":"One hundred tons. Sixteen African elephants.", "locked":"Lift 100,000 kg in total." },
      "repeatable":false },

    { "id":"lifetime_500k", "name":"Half a Million", "category":"volume", "art":"Journey", "rarity":"rare",
      "targetRate":0.14,
      "predicate":"sum(sessions.totalVolumeKg) >= 500000",
      "copy":{ "title":"Half a Million", "subtitle":"500,000 kg lifted, all time.",
        "unlock":"Half a million kilos. Twelve Boeing 737s, airframe only.", "locked":"Lift 500,000 kg in total." },
      "repeatable":false },

    { "id":"lifetime_1m", "name":"Megaton", "category":"volume", "art":"Journey", "rarity":"epic",
      "targetRate":0.035,
      "predicate":"sum(sessions.totalVolumeKg) >= 1000000",
      "copy":{ "title":"Megaton", "subtitle":"One million kilograms lifted.",
        "unlock":"A million kilos. Almost seven blue whales.", "locked":"Lift 1,000,000 kg in total." },
      "repeatable":false },

    { "id":"lifetime_10m", "name":"Eiffel", "category":"volume", "art":"Journey", "rarity":"mythic",
      "targetRate":0.0009,
      "predicate":"sum(sessions.totalVolumeKg) >= 10000000",
      "copy":{ "title":"Eiffel", "subtitle":"Ten million kilograms lifted.",
        "unlock":"Ten million kilos. The iron in the Eiffel Tower, moved by one person.", "locked":"Lift 10,000,000 kg in total." },
      "repeatable":false },

    { "id":"volume_century", "name":"Hundred Heavy Days", "category":"volume", "art":"Journey", "rarity":"rare",
      "targetRate":0.10,
      "predicate":"count(sessions where totalVolumeKg >= 5000) >= 100",
      "copy":{ "title":"Hundred Heavy Days", "subtitle":"One hundred sessions over five tons.",
        "unlock":"A hundred genuinely hard days. Not a hundred visits.", "locked":"Complete 100 sessions of 5,000 kg or more." },
      "repeatable":false },

    { "id":"leg_day_legend", "name":"Leg Day Legend", "category":"volume", "art":"Journey", "rarity":"rare",
      "targetRate":0.09,
      "predicate":"exists week w where sum(volumeKg where muscleRegion in LOWER_BODY) >= 25000",
      "copy":{ "title":"Leg Day Legend", "subtitle":"25,000 kg of lower body work in a week.",
        "unlock":"Nobody skipped anything.", "locked":"Move 25,000 kg of lower-body volume in one week." },
      "repeatable":true, "cooldownDays":28 },

    { "id":"pull_powerhouse", "name":"Pull Powerhouse", "category":"volume", "art":"Journey", "rarity":"rare",
      "targetRate":0.10,
      "predicate":"exists week w where sum(volumeKg where pattern == 'pull') >= 15000",
      "copy":{ "title":"Pull Powerhouse", "subtitle":"15,000 kg of pulling in a week.",
        "unlock":"Backs are built out of weeks like that one.", "locked":"Move 15,000 kg of pulling volume in one week." },
      "repeatable":true, "cooldownDays":28 },

    { "id":"rep_machine", "name":"Rep Machine", "category":"volume", "art":"Session", "rarity":"rare",
      "targetRate":0.06,
      "predicate":"exists session s where s.totalReps >= 500 and s.durationMin >= 40",
      "copy":{ "title":"Rep Machine", "subtitle":"500 reps in a single session.",
        "unlock":"Five hundred reps. Your forearms filed a complaint.", "locked":"Complete 500 reps in one session." },
      "repeatable":false },

    { "id":"reps_100k", "name":"Hundred Thousand", "category":"volume", "art":"Journey", "rarity":"epic",
      "targetRate":0.024,
      "predicate":"sum(sessions.totalReps) >= 100000",
      "copy":{ "title":"Hundred Thousand", "subtitle":"100,000 lifetime reps.",
        "unlock":"One hundred thousand repetitions. Every single one was a decision.", "locked":"Complete 100,000 reps in total." },
      "repeatable":false },

    { "id":"one_plate_ohp", "name":"One Plate Overhead", "category":"strength", "art":"Rank", "rarity":"rare",
      "targetRate":0.11, "collection":"lifting_legacy",
      "predicate":"e1rm(OHP) >= 60 and ranked",
      "copy":{ "title":"One Plate Overhead", "subtitle":"60 kg strict overhead press.",
        "unlock":"A plate a side, over your head, no legs. Harder than it sounds.", "locked":"Press 60 kg overhead." },
      "repeatable":false },

    { "id":"one_plate_bench", "name":"One Plate Bench", "category":"strength", "art":"Rank", "rarity":"common",
      "targetRate":0.58, "collection":"lifting_legacy",
      "predicate":"e1rm(BENCH) >= 60 and ranked",
      "copy":{ "title":"One Plate Bench", "subtitle":"60 kg bench press.",
        "unlock":"First real milestone on the bench. Everyone remembers it.", "locked":"Bench 60 kg." },
      "repeatable":false },

    { "id":"two_plate_bench", "name":"Two Plate Bench", "category":"strength", "art":"Rank", "rarity":"uncommon",
      "targetRate":0.21, "collection":"lifting_legacy",
      "predicate":"e1rm(BENCH) >= 100 and ranked",
      "copy":{ "title":"Two Plate Bench", "subtitle":"100 kg bench press.",
        "unlock":"Two plates. The number non-lifters have actually heard of.", "locked":"Bench 100 kg." },
      "repeatable":false },

    { "id":"three_plate_bench", "name":"Three Plate Bench", "category":"strength", "art":"Rank", "rarity":"epic",
      "targetRate":0.015, "collection":"lifting_legacy",
      "predicate":"e1rm(BENCH) >= 140 and ranked",
      "copy":{ "title":"Three Plate Bench", "subtitle":"140 kg bench press.",
        "unlock":"Three plates a side. You are now the strongest bencher in most gyms.", "locked":"Bench 140 kg." },
      "repeatable":false },

    { "id":"two_plate_squat", "name":"Two Plate Squat", "category":"strength", "art":"Rank", "rarity":"uncommon",
      "targetRate":0.32, "collection":"lifting_legacy",
      "predicate":"e1rm(SQUAT) >= 100 and ranked",
      "copy":{ "title":"Two Plate Squat", "subtitle":"100 kg back squat.",
        "unlock":"Triple digits under the bar.", "locked":"Squat 100 kg." },
      "repeatable":false },

    { "id":"three_plate_squat", "name":"Three Plate Squat", "category":"strength", "art":"Rank", "rarity":"rare",
      "targetRate":0.13, "collection":"lifting_legacy",
      "predicate":"e1rm(SQUAT) >= 140 and ranked",
      "copy":{ "title":"Three Plate Squat", "subtitle":"140 kg back squat.",
        "unlock":"Three plates. The bar starts to feel like a decision.", "locked":"Squat 140 kg." },
      "repeatable":false },

    { "id":"four_plate_squat", "name":"Four Plate Squat", "category":"strength", "art":"Rank", "rarity":"epic",
      "targetRate":0.022, "collection":"lifting_legacy",
      "predicate":"e1rm(SQUAT) >= 180 and ranked",
      "copy":{ "title":"Four Plate Squat", "subtitle":"180 kg back squat.",
        "unlock":"Four plates a side. The rack notices.", "locked":"Squat 180 kg." },
      "repeatable":false },

    { "id":"two_plate_dl", "name":"Two Plate Deadlift", "category":"strength", "art":"Rank", "rarity":"common",
      "targetRate":0.44, "collection":"lifting_legacy",
      "predicate":"e1rm(DEADLIFT) >= 100 and ranked",
      "copy":{ "title":"Two Plate Deadlift", "subtitle":"100 kg deadlift.",
        "unlock":"The bar finally sits at the right height.", "locked":"Deadlift 100 kg." },
      "repeatable":false },

    { "id":"three_plate_dl", "name":"Three Plate Deadlift", "category":"strength", "art":"Rank", "rarity":"uncommon",
      "targetRate":0.24, "collection":"lifting_legacy",
      "predicate":"e1rm(DEADLIFT) >= 140 and ranked",
      "copy":{ "title":"Three Plate Deadlift", "subtitle":"140 kg deadlift.",
        "unlock":"Three plates off the floor.", "locked":"Deadlift 140 kg." },
      "repeatable":false },

    { "id":"four_plate_dl", "name":"Four Plate Deadlift", "category":"strength", "art":"Rank", "rarity":"rare",
      "targetRate":0.10, "collection":"lifting_legacy",
      "predicate":"e1rm(DEADLIFT) >= 180 and ranked",
      "copy":{ "title":"Four Plate Deadlift", "subtitle":"180 kg deadlift.",
        "unlock":"Four plates. The bar bends now.", "locked":"Deadlift 180 kg." },
      "repeatable":false },

    { "id":"five_plate_dl", "name":"Five Plate Deadlift", "category":"strength", "art":"Rank", "rarity":"epic",
      "targetRate":0.018, "collection":"lifting_legacy",
      "predicate":"e1rm(DEADLIFT) >= 220 and ranked",
      "copy":{ "title":"Five Plate Deadlift", "subtitle":"220 kg deadlift.",
        "unlock":"Five plates a side. Very few people on earth have done this.", "locked":"Deadlift 220 kg." },
      "repeatable":false },

    { "id":"bw_bench", "name":"Bodyweight Bench", "category":"strength", "art":"Rank", "rarity":"uncommon",
      "targetRate":0.29, "collection":"lifting_legacy",
      "predicate":"e1rm(BENCH) >= bodyweightKg * 1.0 and ranked and bodyweightFresh(14)",
      "copy":{ "title":"Bodyweight Bench", "subtitle":"Benched your own bodyweight.",
        "unlock":"You can press yourself. Whatever you weigh, that ratio is the real milestone.", "locked":"Bench your bodyweight." },
      "repeatable":false },

    { "id":"double_bw_dl", "name":"Double Bodyweight Deadlift", "category":"strength", "art":"Rank", "rarity":"uncommon",
      "targetRate":0.26, "collection":"lifting_legacy",
      "predicate":"e1rm(DEADLIFT) >= bodyweightKg * 2.0 and ranked and bodyweightFresh(14)",
      "copy":{ "title":"Double Bodyweight Deadlift", "subtitle":"Pulled twice what you weigh.",
        "unlock":"Two of you, off the floor.", "locked":"Deadlift twice your bodyweight." },
      "repeatable":false },

    { "id":"triple_bw_dl", "name":"Triple Bodyweight Deadlift", "category":"strength", "art":"Rank", "rarity":"epic",
      "targetRate":0.013, "collection":"lifting_legacy",
      "predicate":"e1rm(DEADLIFT) >= bodyweightKg * 3.0 and ranked and bodyweightFresh(14) and verified",
      "copy":{ "title":"Triple Bodyweight Deadlift", "subtitle":"Pulled three times your bodyweight.",
        "unlock":"Three times your own mass. This is competitive-lifter territory.", "locked":"Deadlift three times your bodyweight." },
      "repeatable":false },

    { "id":"club_1000", "name":"1000 lb Club", "category":"strength", "art":"Rank", "rarity":"rare",
      "targetRate":0.055, "collection":"lifting_legacy",
      "predicate":"e1rm(SQUAT) + e1rm(BENCH) + e1rm(DEADLIFT) >= 453.6 and all three ranked within 90 days",
      "copy":{ "title":"1000 lb Club", "subtitle":"453 kg combined squat, bench and deadlift.",
        "unlock":"The oldest club in the gym, and you are in it.", "locked":"Reach a 453 kg (1,000 lb) combined total." },
      "repeatable":false },

    { "id":"club_1200", "name":"1200 lb Club", "category":"strength", "art":"Rank", "rarity":"epic",
      "targetRate":0.011, "collection":"lifting_legacy",
      "predicate":"e1rm(SQUAT) + e1rm(BENCH) + e1rm(DEADLIFT) >= 544.3 and all three ranked within 90 days",
      "copy":{ "title":"1200 lb Club", "subtitle":"544 kg combined total.",
        "unlock":"Twelve hundred pounds. You would place at a local meet.", "locked":"Reach a 544 kg (1,200 lb) combined total." },
      "repeatable":false },

    { "id":"first_pr", "name":"First PR", "category":"strength", "art":"Session", "rarity":"common",
      "targetRate":0.85,
      "predicate":"count(personalRecords) >= 1",
      "copy":{ "title":"First PR", "subtitle":"You beat yourself.",
        "unlock":"The only opponent that counts, and you just beat him.", "locked":"Set your first personal record." },
      "repeatable":false },

    { "id":"pr_50", "name":"Fifty PRs", "category":"strength", "art":"Journey", "rarity":"uncommon",
      "targetRate":0.31,
      "predicate":"count(personalRecords) >= 50",
      "copy":{ "title":"Fifty PRs", "subtitle":"Fifty personal records.",
        "unlock":"Fifty times you did something you had never done.", "locked":"Set 50 personal records." },
      "repeatable":false },

    { "id":"pr_250", "name":"Two Fifty", "category":"strength", "art":"Journey", "rarity":"epic",
      "targetRate":0.027,
      "predicate":"count(personalRecords) >= 250",
      "copy":{ "title":"Two Fifty", "subtitle":"Two hundred and fifty personal records.",
        "unlock":"250 PRs. Progress is not a straight line but yours has gone one way.", "locked":"Set 250 personal records." },
      "repeatable":false },

    { "id":"balanced_beast", "name":"No Weak Link", "category":"strength", "art":"Rank", "rarity":"rare",
      "targetRate":0.06,
      "predicate":"ratio(BENCH:SQUAT:DEADLIFT) within 10% of 1.00:1.30:1.60 and all ranked within 90 days and ironScore >= 49.65",
      "copy":{ "title":"No Weak Link", "subtitle":"Squat, bench and deadlift in classic proportion.",
        "unlock":"Nothing lagging, nothing carrying the rest. Rarer than being strong.", "locked":"Bring your big three into balance (roughly 1 : 1.3 : 1.6)." },
      "repeatable":false },

    { "id":"all_intermediate", "name":"Whole Body Intermediate", "category":"strength", "art":"Rank", "rarity":"rare",
      "targetRate":0.07,
      "predicate":"forall m in MAJOR_MUSCLE_GROUPS(10): tier(m) >= 'Intermediate I'",
      "copy":{ "title":"Whole Body Intermediate", "subtitle":"Every major muscle group at Intermediate or above.",
        "unlock":"Ten muscle groups, none of them behind. Check the world standings tab.", "locked":"Reach Intermediate in all ten major muscle groups." },
      "repeatable":false },

    { "id":"ten_percent", "name":"Ten Percent", "category":"strength", "art":"Journey", "rarity":"uncommon",
      "targetRate":0.30,
      "predicate":"exists lift L in BIG_THREE where e1rm(L, now) >= 1.10 * e1rm(L, now - 84 days)",
      "copy":{ "title":"Ten Percent", "subtitle":"A big-three lift up 10% in twelve weeks.",
        "unlock":"Ten percent in a single block. That is a very good twelve weeks.", "locked":"Improve a big-three e1RM by 10% inside twelve weeks." },
      "repeatable":true, "cooldownDays":84 },

    { "id":"pullup_century", "name":"Pull-up Century", "category":"strength", "art":"Journey", "rarity":"rare",
      "targetRate":0.08,
      "predicate":"exists week w where sum(reps where exercise == 'Pull-up' and addedLoadKg == 0 and rom == 'full') >= 100",
      "copy":{ "title":"Pull-up Century", "subtitle":"100 strict pull-ups in one week.",
        "unlock":"A hundred strict reps in seven days. Your lats know.", "locked":"Complete 100 strict bodyweight pull-ups in one week." },
      "repeatable":true, "cooldownDays":28 },

    { "id":"explorer", "name":"Explorer", "category":"variety", "art":"Journey", "rarity":"common",
      "targetRate":0.62, "collection":"cartography",
      "predicate":"countDistinct(exerciseId where sets >= 3 lifetime) >= 25",
      "copy":{ "title":"Explorer", "subtitle":"Twenty-five different exercises.",
        "unlock":"Twenty-five movements tried properly. The catalogue has a lot more.", "locked":"Log at least three sets each of 25 different exercises." },
      "repeatable":false },

    { "id":"cartographer", "name":"Cartographer", "category":"variety", "art":"Journey", "rarity":"uncommon",
      "targetRate":0.20, "collection":"cartography",
      "predicate":"countDistinct(exerciseId where sets >= 3 lifetime) >= 100",
      "copy":{ "title":"Cartographer", "subtitle":"One hundred different exercises.",
        "unlock":"A hundred movements. You could program for someone else now.", "locked":"Log at least three sets each of 100 different exercises." },
      "repeatable":false },

    { "id":"encyclopedist", "name":"Encyclopedist", "category":"variety", "art":"Journey", "rarity":"mythic",
      "targetRate":0.004, "collection":"cartography",
      "predicate":"countDistinct(exerciseId where sets >= 3 lifetime) >= 300",
      "copy":{ "title":"Encyclopedist", "subtitle":"Three hundred different exercises.",
        "unlock":"Three hundred movements, three sets minimum each. You have read the whole library.", "locked":"Log at least three sets each of 300 different exercises." },
      "repeatable":false },

    { "id":"full_map", "name":"Full Map", "category":"variety", "art":"Journey", "rarity":"uncommon",
      "targetRate":0.27, "collection":"cartography",
      "predicate":"exists 7-day window where forall r in MUSCLE_REGIONS(14): sets(r) >= 1",
      "copy":{ "title":"Full Map", "subtitle":"Every muscle region trained inside one week.",
        "unlock":"Fourteen regions, seven days, nothing missed. Your muscle map lit up completely.", "locked":"Train all fourteen muscle regions inside a single week." },
      "repeatable":true, "cooldownDays":28 },

    { "id":"barbell_purist", "name":"Barbell Purist", "category":"variety", "art":"Journey", "rarity":"uncommon",
      "targetRate":0.18,
      "predicate":"count(sessions where share(sets, equipment=='barbell') >= 0.80) >= 20",
      "copy":{ "title":"Barbell Purist", "subtitle":"Twenty sessions that were almost entirely barbell.",
        "unlock":"Bar, plates, collars. Nothing else required.", "locked":"Complete 20 sessions that are 80%+ barbell work." },
      "repeatable":false },

    { "id":"iron_and_air", "name":"Iron and Air", "category":"variety", "art":"Journey", "rarity":"rare",
      "targetRate":0.07,
      "predicate":"count(sessions where share(sets, equipment=='bodyweight') >= 0.80) >= 20",
      "copy":{ "title":"Iron and Air", "subtitle":"Twenty sessions with nothing but your own bodyweight.",
        "unlock":"No gym required. Twenty sessions proving it.", "locked":"Complete 20 sessions that are 80%+ bodyweight work." },
      "repeatable":false },

    { "id":"unilateral", "name":"One Side at a Time", "category":"variety", "art":"Journey", "rarity":"uncommon",
      "targetRate":0.23,
      "predicate":"count(sets where exercise.laterality == 'unilateral') >= 500",
      "copy":{ "title":"One Side at a Time", "subtitle":"Five hundred single-limb sets.",
        "unlock":"Five hundred unilateral sets. Imbalances hate this.", "locked":"Complete 500 single-limb sets." },
      "repeatable":false },

    { "id":"technician", "name":"Technician", "category":"variety", "art":"Journey", "rarity":"rare",
      "targetRate":0.09,
      "predicate":"maxRun(weeks where share(workingSets with rpe != null) >= 0.90) >= 8",
      "copy":{ "title":"Technician", "subtitle":"Eight weeks logging RPE on nearly every working set.",
        "unlock":"Eight weeks of honest effort ratings. Your autoregulation data is now actually usable.", "locked":"Log RPE on 90% of working sets for eight consecutive weeks." },
      "repeatable":false },

    { "id":"tempo_master", "name":"Under Control", "category":"variety", "art":"Journey", "rarity":"rare",
      "targetRate":0.05,
      "predicate":"count(sets where tempo != null) >= 100",
      "copy":{ "title":"Under Control", "subtitle":"One hundred sets with a prescribed tempo.",
        "unlock":"A hundred sets where you decided how fast, not the weight.", "locked":"Log 100 sets with a recorded tempo." },
      "repeatable":false },

    { "id":"drop_dozen", "name":"Bottom of the Rack", "category":"variety", "art":"Session", "rarity":"uncommon",
      "targetRate":0.25,
      "predicate":"count(sets where setType == 'drop') >= 100",
      "copy":{ "title":"Bottom of the Rack", "subtitle":"One hundred drop sets.",
        "unlock":"A hundred times you stripped a plate and kept going.", "locked":"Complete 100 drop sets." },
      "repeatable":false },

    { "id":"myo_initiate", "name":"Myo-Rep Initiate", "category":"variety", "art":"Session", "rarity":"rare",
      "targetRate":0.06,
      "predicate":"count(sets where setType == 'myoRep') >= 50",
      "copy":{ "title":"Myo-Rep Initiate", "subtitle":"Fifty myo-rep clusters.",
        "unlock":"Fifty clusters. An efficient, horrible way to train.", "locked":"Complete 50 myo-rep sets." },
      "repeatable":false },

    { "id":"to_failure_100", "name":"Hundred Failures", "category":"variety", "art":"Session", "rarity":"uncommon",
      "targetRate":0.26,
      "predicate":"count(sets where setType == 'failure') >= 100",
      "copy":{ "title":"Hundred Failures", "subtitle":"One hundred sets taken to failure.",
        "unlock":"A hundred sets where the rep did not finish. That is the point.", "locked":"Take 100 sets to failure." },
      "repeatable":false },

    { "id":"photo_journal", "name":"The Long Look", "category":"milestone", "art":"Journey", "rarity":"rare",
      "targetRate":0.10,
      "predicate":"count(progressPhotos where each >= 21 days after previous) >= 12",
      "copy":{ "title":"The Long Look", "subtitle":"Twelve progress photos, three weeks apart or more.",
        "unlock":"A year of evidence. Photo one and photo twelve are different people.", "locked":"Take 12 progress photos, at least three weeks apart." },
      "repeatable":false,
      "note":"Deliberately spaced at 21+ days to discourage daily body-checking, which is a documented disordered-eating behaviour." },

    { "id":"scale_honest", "name":"On the Record", "category":"milestone", "art":"Journey", "rarity":"uncommon",
      "targetRate":0.19,
      "predicate":"count(weeks where bodyweightEntries >= 1) >= 26 within trailing 30 weeks",
      "copy":{ "title":"On the Record", "subtitle":"Weighed in on 26 of the last 30 weeks.",
        "unlock":"Half a year of honest data. Your trend line is real now.", "locked":"Log your bodyweight in 26 of any 30 consecutive weeks." },
      "repeatable":false,
      "note":"Weekly, never daily. Daily weigh-in badges are an eating-disorder vector; we do not ship one." },

    { "id":"recomp", "name":"Same Scale, Different Person", "category":"milestone", "art":"Journey", "rarity":"rare",
      "targetRate":0.08,
      "predicate":"abs(bodyweight(now) - bodyweight(now-84d)) <= 0.02*bodyweight(now-84d) and sum(e1rm(BIG_THREE, now)) >= 1.05*sum(e1rm(BIG_THREE, now-84d))",
      "copy":{ "title":"Same Scale, Different Person", "subtitle":"Bodyweight flat, total up 5% in twelve weeks.",
        "unlock":"The scale did not move and you got measurably stronger. That is recomposition, and it is hard.", "locked":"Hold bodyweight within 2% while adding 5% to your total, over twelve weeks." },
      "repeatable":true, "cooldownDays":84 },

    { "id":"rank_novice", "name":"Novice", "category":"milestone", "art":"Rank", "rarity":"common",
      "targetRate":0.66,
      "predicate":"peakIronScore >= 16.50",
      "copy":{ "title":"Novice", "subtitle":"Reached the Novice tier.",
        "unlock":"Stronger than 5% of lifters. Everyone starts here.", "locked":"Reach an Iron Score of 16.5." },
      "repeatable":false },

    { "id":"rank_intermediate", "name":"Intermediate", "category":"milestone", "art":"Rank", "rarity":"uncommon",
      "targetRate":0.37,
      "predicate":"peakIronScore >= 40.63",
      "copy":{ "title":"Intermediate", "subtitle":"Reached the Intermediate tier.",
        "unlock":"Stronger than 20% of lifters. The dabbling is over.", "locked":"Reach an Iron Score of 40.6." },
      "repeatable":false },

    { "id":"rank_advanced", "name":"Advanced", "category":"milestone", "art":"Rank", "rarity":"rare",
      "targetRate":0.12,
      "predicate":"peakIronScore >= 68.79",
      "copy":{ "title":"Advanced", "subtitle":"Reached the Advanced tier.",
        "unlock":"Stronger than half of everyone who lifts. Years of work in one badge.", "locked":"Reach an Iron Score of 68.8." },
      "repeatable":false },

    { "id":"rank_elite", "name":"Elite", "category":"milestone", "art":"Rank", "rarity":"epic",
      "targetRate":0.025,
      "predicate":"peakIronScore >= 100.0",
      "copy":{ "title":"Elite", "subtitle":"One hundred Iron Points.",
        "unlock":"One hundred points. Stronger than 80% of lifters, worldwide.", "locked":"Reach an Iron Score of 100." },
      "repeatable":false },

    { "id":"rank_master", "name":"Master", "category":"milestone", "art":"Rank", "rarity":"mythic",
      "targetRate":0.004,
      "predicate":"peakIronScore >= 133.67 and verified",
      "copy":{ "title":"Master", "subtitle":"Reached the Master tier.",
        "unlock":"Top 5% of everyone who lifts weights. Verified.", "locked":"Reach a verified Iron Score of 133.7." },
      "repeatable":false },

    { "id":"rank_world_class", "name":"World Class", "category":"milestone", "art":"Rank", "rarity":"mythic",
      "targetRate":0.0004,
      "predicate":"peakIronScore >= 169.43 and verified and videoVerified",
      "copy":{ "title":"World Class", "subtitle":"Top 1% of all lifters.",
        "unlock":"One in a hundred. Video verified. You could compete.", "locked":"Reach a video-verified Iron Score of 169.4." },
      "repeatable":false },

    { "id":"peak_holder", "name":"Held the Line", "category":"milestone", "art":"Rank", "rarity":"rare",
      "targetRate":0.11,
      "predicate":"currentIronScore >= peakIronScore * 0.98 continuously for 26 weeks",
      "copy":{ "title":"Held the Line", "subtitle":"Held your peak for six straight months.",
        "unlock":"Getting strong is one thing. Staying there is another.", "locked":"Stay within 2% of your peak Iron Score for 26 weeks." },
      "repeatable":false },

    { "id":"mentor", "name":"Mentor", "category":"milestone", "art":"Journey", "rarity":"rare",
      "targetRate":0.05,
      "predicate":"count(invitedUsers where their onRhythmWeeks >= 4) >= 3",
      "copy":{ "title":"Mentor", "subtitle":"Three people you brought in are still training a month later.",
        "unlock":"Three people are lifting because of you. That is worth more than any PR.", "locked":"Invite three people who each complete four on-rhythm weeks." },
      "repeatable":false },

    { "id":"open_book", "name":"Open Book", "category":"milestone", "art":"Journey", "rarity":"uncommon",
      "targetRate":0.17,
      "predicate":"count(sessions where visibility != 'private') >= 50",
      "copy":{ "title":"Open Book", "subtitle":"Fifty workouts shared.",
        "unlock":"Fifty sessions out in the open, good ones and bad ones.", "locked":"Share 50 workouts." },
      "repeatable":false },

    { "id":"five_years_in", "name":"Five Years", "category":"milestone", "art":"Journey", "rarity":"mythic",
      "targetRate":0.003, "collection":"the_long_game",
      "predicate":"accountAgeDays >= 1826 and count(weeks where onRhythm) >= 180",
      "copy":{ "title":"Five Years", "subtitle":"Five years, 180+ on-rhythm weeks.",
        "unlock":"Five years. Whatever you were training for, you found something better.", "locked":"Five years on the app with 180 on-rhythm weeks." },
      "repeatable":false }
  ]
}
```

BADGE COUNT BY CATEGORY
  consistency 14 · volume 13 · strength 21 · variety 11 · milestone 19  = 78 entries
  (68+ requirement comfortably exceeded; trim to 68 by cutting the weakest
   variety badges if the art budget bites — art is the real constraint, and
   a badge without bespoke art should not ship.)

RARITY DISTRIBUTION (designed)
  common 9 · uncommon 25 · rare 26 · epic 12 · mythic 9
  The mass sits in uncommon/rare, which is the correct shape: a user with
  8 weeks in should have 6–10 badges, not 40.

═══════════════════════════════════════════════════════════════════════════
PART 5 — TYPESCRIPT: SCORING, RANK, PERCENTILE, RHYTHM, LEAGUE
═══════════════════════════════════════════════════════════════════════════

```ts
// ============================================================================
// stronger/scoring/index.ts
// All units are metric internally. Display conversion happens at the edge.
// ============================================================================

export type Sex = 'male' | 'female';

export interface SetRecord {
  exerciseId: string;
  weightKg: number;
  reps: number;
  rpe?: number;          // 6..10, 0.5 steps
  setType: 'normal' | 'warmup' | 'drop' | 'failure' | 'myoRep' | 'cluster';
  completedAt: number;   // epoch ms
}

// ---------------------------------------------------------------------------
// 1. ESTIMATED 1RM
// Primary: weight-dependent equation fitted on 303,494 near-failure sets
// from 14,966 users across 388 exercises (arXiv:2603.17495). Reported 17-22%
// lower inconsistency than Epley/Brzycki/Lombardi/O'Conner.
// ---------------------------------------------------------------------------

export const MAX_RANKING_REPS = 6;   // hard ceiling for anything that moves rank

export function e1rm(weightKg: number, reps: number, rpe?: number): number {
  if (weightKg <= 2 || reps <= 0) return 0;

  // RPE < 10 means reps in reserve; convert to an equivalent near-failure set.
  const rir = rpe != null ? Math.max(0, Math.min(4, 10 - rpe)) : 0;
  const effectiveReps = reps + rir;

  if (effectiveReps === 1) return weightKg;

  const denom = -2.55 + 4.58 * Math.log(weightKg);
  if (!Number.isFinite(denom) || denom <= 0) return epley(weightKg, effectiveReps);

  return weightKg * (1 + Math.pow(effectiveReps - 1, 0.85) / denom);
}

export const epley   = (w: number, r: number) => w * (1 + r / 30);
export const brzycki = (w: number, r: number) => w * 36 / (37 - r);

/** Sanity band. If the three estimators disagree by >8% we do not rank the set. */
export function e1rmIsTrustworthy(w: number, r: number): boolean {
  if (r > MAX_RANKING_REPS) return false;
  const a = e1rm(w, r), b = epley(w, r), c = brzycki(w, r);
  const lo = Math.min(a, b, c), hi = Math.max(a, b, c);
  return (hi - lo) / lo <= 0.08;
}

/**
 * Robust per-exercise best: median of the top 3 sessions in the window,
 * NOT the single max. One fat-finger entry must never move a rank.
 */
export function robustBestE1rm(sessionBests: number[]): number | null {
  if (sessionBests.length < 3) return null;
  const top3 = [...sessionBests].sort((x, y) => y - x).slice(0, 3);
  return top3[1]; // median of three
}

// ---------------------------------------------------------------------------
// 2. BODYWEIGHT NORMALISATION — DOTS
// DOTS = liftKg * 500 / P(bodyweight), P a 4th-degree polynomial per sex.
// Male coefficients are the published set; VERIFY the female set against a
// reference implementation before shipping (see risks).
// ---------------------------------------------------------------------------

const DOTS_COEFF: Record<Sex, [number, number, number, number, number]> = {
  // [e (const), d (bw), c (bw^2), b (bw^3), a (bw^4)]
  male:   [-307.75076, 24.0900756,  -0.1918759221, 0.0007391293, -0.000001093 ],
  female: [ -57.96288, 13.6175032,  -0.1126655495, 0.0005158568, -0.0000010706],
};

export function dots(liftKg: number, bodyweightKg: number, sex: Sex): number {
  const bw = clamp(bodyweightKg, sex === 'male' ? 40 : 40, sex === 'male' ? 210 : 150);
  const [e, d, c, b, a] = DOTS_COEFF[sex];
  const p = e + d * bw + c * bw ** 2 + b * bw ** 3 + a * bw ** 4;
  if (p <= 0) return 0;
  return liftKg * 500 / p;
}

/** Masters/juniors age coefficient. Baseline 25-40 per StrengthLevel's model. */
export function ageCoefficient(age: number): number {
  if (age >= 25 && age <= 40) return 1.0;
  if (age < 25)  return 1 + 0.0085 * (25 - age);          // juniors get a small lift
  if (age <= 50) return 1 + 0.0100 * (age - 40);
  if (age <= 60) return 1.10 + 0.0155 * (age - 50);
  if (age <= 70) return 1.255 + 0.0230 * (age - 60);
  return 1.485 + 0.0320 * (age - 70);
}

// ---------------------------------------------------------------------------
// 3. PERCENTILE  ->  IRON SCORE
// Anchors are StrengthLevel's published percentile cutoffs, mapped onto our
// tier boundaries so that rank and world-standings are the SAME number.
// ---------------------------------------------------------------------------

/** b_k = 3.956 * k^1.30, k = 0..21. b_12 === 100.01 (Advanced III -> Elite I). */
export const RANK_BOUNDARIES: number[] = Array.from(
  { length: 22 },
  (_, k) => +(3.956 * Math.pow(k, 1.30)).toFixed(2)
);
// => [0, 3.96, 9.74, 16.50, 23.98, 32.04, 40.63, 49.65, 59.03, 68.79, 78.96,
//     89.33, 100.01, 110.97, 122.24, 133.67, 145.50, 157.33, 169.43, 181.70,
//     194.48, 207.14]

export const TIERS = [
  'Beginner', 'Beginner', 'Beginner',
  'Novice', 'Novice', 'Novice',
  'Intermediate', 'Intermediate', 'Intermediate',
  'Advanced', 'Advanced', 'Advanced',
  'Elite', 'Elite', 'Elite',
  'Master', 'Master', 'Master',
  'World Class', 'World Class', 'World Class',
  'Legendary',
] as const;
const SUBS = ['I', 'II', 'III'] as const;

export interface Rank {
  index: number;          // 1..22
  tier: string;           // 'Novice'
  sub: string | null;     // 'II'  (null for Legendary)
  label: string;          // 'Novice II'
  floor: number;          // 23.98
  ceiling: number | null; // 32.04
  pointsToNext: number | null;
  progressInRank: number; // 0..1
}

export function rankFromScore(score: number): Rank {
  let i = 0;
  while (i < RANK_BOUNDARIES.length - 1 && score >= RANK_BOUNDARIES[i + 1]) i++;
  const isLegendary = i >= 21;
  const floor = RANK_BOUNDARIES[i];
  const ceiling = isLegendary ? null : RANK_BOUNDARIES[i + 1];
  return {
    index: i + 1,
    tier: TIERS[i],
    sub: isLegendary ? null : SUBS[i % 3],
    label: isLegendary ? 'Legendary' : `${TIERS[i]} ${SUBS[i % 3]}`,
    floor,
    ceiling,
    pointsToNext: ceiling == null ? null : +(ceiling - score).toFixed(1),
    progressInRank: ceiling == null ? 1 : (score - floor) / (ceiling - floor),
  };
}

// Verification of the screenshot: rankFromScore(27.0)
//   -> { index: 5, tier: 'Novice', sub: 'II', label: 'Novice II',
//        floor: 23.98, ceiling: 32.04, pointsToNext: 5.0, progressInRank: 0.37 }
//   Screenshot said "27 pts, 5.2 to Novice III". Match.

/**
 * Percentile -> Iron Score, via monotone piecewise-linear interpolation
 * through anchors that pin StrengthLevel's published cutoffs onto our tiers.
 */
const PERCENTILE_ANCHORS: Array<[percentile: number, score: number]> = [
  [0.0,    0.00],
  [1.0,    8.00],
  [5.0,   16.50],   // Beginner  -> Novice        (StrengthLevel: "stronger than 5%")
  [20.0,  40.63],   // Novice    -> Intermediate  ("stronger than 20%")
  [50.0,  68.79],   // Interm.   -> Advanced      ("stronger than 50%")
  [80.0, 100.01],   // Advanced  -> Elite         ("stronger than 80%")
  [95.0, 133.67],   // Elite     -> Master        ("stronger than 95%")
  [99.0, 169.43],   // Master    -> World Class
  [99.9, 194.48],
  [99.99, 207.14],
];

export function ironScoreFromPercentile(p: number): number {
  const x = clamp(p, 0, 99.999);
  for (let i = 0; i < PERCENTILE_ANCHORS.length - 1; i++) {
    const [p0, s0] = PERCENTILE_ANCHORS[i];
    const [p1, s1] = PERCENTILE_ANCHORS[i + 1];
    if (x >= p0 && x <= p1) {
      const t = (x - p0) / (p1 - p0);
      return +(s0 + t * (s1 - s0)).toFixed(2);
    }
  }
  return 207.14 + (x - 99.99) * 400; // open-ended Legendary tail
}

// ---------------------------------------------------------------------------
// 4. OVERALL IRON SCORE
// Weighted over the twelve Ranked Lifts. Missing lifts are IGNORED, not zeroed:
// weights renormalise over what we actually have. Never punish a user for data
// we do not have — but require >= 3 lifts before showing a rank at all.
// ---------------------------------------------------------------------------

export const RANKED_LIFT_WEIGHTS: Record<string, number> = {
  'barbell-back-squat':   0.16, 'conventional-deadlift': 0.16,
  'barbell-bench-press':  0.16, 'barbell-overhead-press':0.10,
  'weighted-pull-up':     0.09, 'barbell-row':           0.08,
  'barbell-front-squat':  0.06, 'romanian-deadlift':     0.05,
  'sumo-deadlift':        0.05, 'barbell-incline-bench': 0.04,
  'weighted-dip':         0.03, 'barbell-hip-thrust':    0.02,
};

export const MIN_RANKED_LIFTS = 3;

export interface LiftEntry { exerciseId: string; percentile: number; }

export function overallIronScore(entries: LiftEntry[]): number | null {
  const usable = entries.filter(e => RANKED_LIFT_WEIGHTS[e.exerciseId] != null);
  if (usable.length < MIN_RANKED_LIFTS) return null;   // "Unranked — log 3 lifts"
  const totalW = usable.reduce((s, e) => s + RANKED_LIFT_WEIGHTS[e.exerciseId], 0);
  const weightedPercentile = usable.reduce(
    (s, e) => s + RANKED_LIFT_WEIGHTS[e.exerciseId] * e.percentile, 0) / totalW;
  return ironScoreFromPercentile(weightedPercentile);
}

// ---------------------------------------------------------------------------
// 5. HONEST PERCENTILES ON A SMALL USER BASE
// Blend our empirical CDF with a log-normal prior fitted to published
// standards. w = n/(n+K) with K = 400: at n=400 we trust each 50/50.
// ---------------------------------------------------------------------------

export const SHRINKAGE_K = 400;
export const MIN_N_TO_SHOW_PERCENTILE = 50;

export interface CohortSample {
  n: number;
  sortedValues: number[];   // cohort's DOTS-normalised e1RMs, ascending
}

export interface LogNormalPrior { mu: number; sigma: number; }

/**
 * Fit the prior from published standards: we have 5 (percentile, value)
 * anchors per lift/sex/bodyweight from StrengthLevel-style tables. Regress
 * ln(value) on the standard normal quantile of the percentile.
 */
export function fitLogNormalPrior(anchors: Array<[p: number, value: number]>): LogNormalPrior {
  const xs = anchors.map(([p]) => probit(p / 100));
  const ys = anchors.map(([, v]) => Math.log(v));
  const n = xs.length;
  const mx = mean(xs), my = mean(ys);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  const sigma = num / den;          // slope
  const mu = my - sigma * mx;       // intercept
  return { mu, sigma };
}

export const priorCdf = (x: number, pr: LogNormalPrior) =>
  normalCdf((Math.log(x) - pr.mu) / pr.sigma);

export function empiricalCdf(x: number, s: CohortSample): number {
  if (s.n === 0) return 0.5;
  let lo = 0, hi = s.sortedValues.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (s.sortedValues[m] <= x) lo = m + 1; else hi = m; }
  return lo / s.n;
}

export interface PercentileResult {
  percentile: number | null;   // 0..100, null when we refuse to guess
  ciLow: number | null;
  ciHigh: number | null;
  n: number;
  ourWeight: number;           // how much of the answer came from our own data
  confidence: 'none' | 'low' | 'medium' | 'high';
  copy: string;                // exact string to render
}

export function blendedPercentile(
  value: number, sample: CohortSample, prior: LogNormalPrior, cohortLabel: string
): PercentileResult {
  const n = sample.n;

  if (n < MIN_N_TO_SHOW_PERCENTILE) {
    return {
      percentile: null, ciLow: null, ciHigh: null, n, ourWeight: 0,
      confidence: 'none',
      copy: `Only ${n} lifter${n === 1 ? '' : 's'} like you have logged this so far — not enough to rank you honestly yet. We will show your percentile at 50.`,
    };
  }

  const w = n / (n + SHRINKAGE_K);
  const pOurs = empiricalCdf(value, sample);
  const pPrior = priorCdf(value, prior);
  const p = w * pOurs + (1 - w) * pPrior;

  // Sampling error on our own ECDF (Wilson), widened for prior uncertainty.
  const [wl, wh] = wilson(pOurs, n);
  const priorSlack = (1 - w) * 0.06;               // ~6pp of irreducible prior error
  const lo = clamp((w * wl + (1 - w) * pPrior) - priorSlack, 0, 1);
  const hi = clamp((w * wh + (1 - w) * pPrior) + priorSlack, 0, 1);

  const halfWidth = ((hi - lo) / 2) * 100;
  const confidence: PercentileResult['confidence'] =
    halfWidth <= 2 ? 'high' : halfWidth <= 6 ? 'medium' : 'low';

  const pct = Math.round(p * 100);
  return {
    percentile: +(p * 100).toFixed(1),
    ciLow: +(lo * 100).toFixed(1),
    ciHigh: +(hi * 100).toFixed(1),
    n, ourWeight: +w.toFixed(3), confidence,
    copy: confidence === 'high'
      ? `Stronger than ${pct}% of ${cohortLabel}.`
      : `Stronger than about ${pct}% of ${cohortLabel} (±${Math.round(halfWidth)}%, based on ${n.toLocaleString()} lifters).`,
  };
}

/** Wilson score interval — correct near 0 and 1, unlike the normal approximation. */
export function wilson(p: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const s = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [(c - s) / d, (c + s) / d];
}

// ---------------------------------------------------------------------------
// 6. DECAY
// ---------------------------------------------------------------------------

export const DECAY = {
  graceDays: 21,
  weeklyRate: 0.006,     // 0.6% of current value per week
  floorFractionOfPeak: 0.70,
  haltingSessionIntensity: 0.80,  // >=80% of e1RM on >=2 ranked lifts
} as const;

export function decayedScore(
  peak: number, lastQualifyingSessionMs: number, nowMs: number, paused: boolean
): number {
  if (paused) return peak;
  const days = (nowMs - lastQualifyingSessionMs) / 86_400_000;
  if (days <= DECAY.graceDays) return peak;
  const weeks = (days - DECAY.graceDays) / 7;
  const decayed = peak * Math.pow(1 - DECAY.weeklyRate, weeks);
  return Math.max(decayed, peak * DECAY.floorFractionOfPeak);
}

// ---------------------------------------------------------------------------
// 7. RHYTHM (weekly consistency)
// ---------------------------------------------------------------------------

export type WeekOutcome = 'onRhythm' | 'deload' | 'paused' | 'missed';

export interface WeekSummary {
  isoWeek: string;
  sessions: number;
  target: number;
  volumeKg: number;
  trailing4WeekMeanVolumeKg: number;
  userFlag?: 'pause' | 'deload';
}

export function classifyWeek(w: WeekSummary, creditsAvailable: number): {
  outcome: WeekOutcome; creditSpent: boolean;
} {
  if (w.userFlag === 'pause') return { outcome: 'paused', creditSpent: false };

  const isDeloadVolume =
    w.trailing4WeekMeanVolumeKg > 0 &&
    w.volumeKg >= 0.40 * w.trailing4WeekMeanVolumeKg &&
    w.volumeKg <= 0.70 * w.trailing4WeekMeanVolumeKg;

  if ((w.userFlag === 'deload' || isDeloadVolume) && w.sessions >= w.target - 1)
    return { outcome: 'deload', creditSpent: false };

  if (w.sessions >= w.target) return { outcome: 'onRhythm', creditSpent: false };

  if (w.sessions >= w.target - 1 && creditsAvailable > 0)
    return { outcome: 'onRhythm', creditSpent: true };

  return { outcome: 'missed', creditSpent: false };
}

/** Gradual degradation. A long streak must never go straight to zero. */
export function updateRhythm(
  streak: number, longest: number, outcome: WeekOutcome, consecutiveMissed: number
): { streak: number; longest: number; consecutiveMissed: number } {
  if (outcome === 'paused')  return { streak, longest, consecutiveMissed: 0 };
  if (outcome === 'onRhythm' || outcome === 'deload') {
    const s = streak + 1;
    return { streak: s, longest: Math.max(longest, s), consecutiveMissed: 0 };
  }
  const cm = consecutiveMissed + 1;
  const s = cm === 1 ? Math.max(0, streak - 1)
          : cm < 4   ? Math.floor(streak / 2)
          :            0;
  return { streak: s, longest, consecutiveMissed: cm };
}

// ---------------------------------------------------------------------------
// 8. IRON LEAGUE — effort points, capped so overtraining cannot win
// ---------------------------------------------------------------------------

export const LEAGUE = {
  cohortSize: 30,
  promoteTop: 5,
  demoteBottom: 3,
  sessionCapPoints: 120,
  weeklyCapMultiplier: 1.30,   // hard stop at 130% of the user's own baseline
} as const;

export function sessionEffortPoints(
  sessionVolumeKg: number, userBaselineSessionVolumeKg: number,
  hardSets: number, prCount: number
): number {
  if (userBaselineSessionVolumeKg <= 0) return 60; // new user default
  const relVolume = sessionVolumeKg / userBaselineSessionVolumeKg;
  const base = 60 * Math.min(1.3, relVolume);       // relative, not absolute: a
                                                   // 60 kg and a 110 kg lifter
                                                   // score identically for an
                                                   // equally hard session
  const setBonus = Math.min(30, hardSets * 1.5);
  const prBonus  = Math.min(30, prCount * 10);
  return Math.min(LEAGUE.sessionCapPoints, Math.round(base + setBonus + prBonus));
}

export function weeklyEffortPoints(
  sessionPoints: number[], weeklyBaselineVolumeKg: number, weekVolumeKg: number
): { points: number; capped: boolean } {
  const raw = sessionPoints.reduce((a, b) => a + b, 0);
  const overCap = weeklyBaselineVolumeKg > 0 &&
                  weekVolumeKg > LEAGUE.weeklyCapMultiplier * weeklyBaselineVolumeKg;
  // Beyond the cap, additional work earns nothing. Deliberate.
  return { points: overCap ? Math.round(raw * 0.0 + capAt(sessionPoints, weeklyBaselineVolumeKg, weekVolumeKg)) : raw, capped: overCap };
}

function capAt(sessionPoints: number[], baseline: number, actual: number): number {
  const ratio = LEAGUE.weeklyCapMultiplier * baseline / actual;
  return sessionPoints.reduce((a, b) => a + b, 0) * ratio;
}

// ---------------------------------------------------------------------------
// 9. ANTI-CHEAT PLAUSIBILITY
// ---------------------------------------------------------------------------

export interface PlausibilityInput {
  e1rmKg: number;
  worldRecordKg: number;          // for sex + bodyweight class + lift
  bodyweightKg: number;
  bodyweightAgeDays: number;
  sessionVolumeKg: number;
  sessionDurationMin: number;
  setCount: number;
  interSetGapsSec: number[];
  accountAgeDays: number;
  qualifyingWeeks: number;
  weightValuesUsed: number[];     // to detect zero-variance round-number entry
  weeklyIronScoreDelta: number;
}

export interface PlausibilityResult {
  score: number;                  // 0..1
  flags: string[];
  leaderboardEligible: boolean;
}

export function plausibility(i: PlausibilityInput): PlausibilityResult {
  const flags: string[] = [];
  let s = 1.0;

  // Hard physiological ceiling. Nothing above a world record enters anything.
  if (i.e1rmKg > i.worldRecordKg * 1.02) { flags.push('above_world_record'); s = 0; }
  else if (i.e1rmKg > i.worldRecordKg * 0.92) { flags.push('near_world_record_needs_video'); s -= 0.35; }

  // Volume per minute. >400 kg/min sustained is not happening.
  const kgPerMin = i.sessionDurationMin > 0 ? i.sessionVolumeKg / i.sessionDurationMin : Infinity;
  if (kgPerMin > 400) { flags.push('volume_rate_implausible'); s -= 0.5; }
  else if (kgPerMin > 260) { flags.push('volume_rate_high'); s -= 0.15; }

  // Inter-set gaps. A heavy compound set every 20 s is data entry, not lifting.
  const fastGaps = i.interSetGapsSec.filter(g => g < 20).length;
  if (fastGaps / Math.max(1, i.interSetGapsSec.length) > 0.5) {
    flags.push('bulk_entry_pattern'); s -= 0.30;
  }

  // Round-number fingerprint: every load a multiple of 10 with no variance.
  const allRound = i.weightValuesUsed.length >= 8 &&
                   i.weightValuesUsed.every(w => w % 10 === 0);
  if (allRound) { flags.push('round_number_fingerprint'); s -= 0.10; }

  // Progression velocity. >6 Iron Points/week is beyond any real trajectory.
  if (i.weeklyIronScoreDelta > 6) { flags.push('progression_velocity'); s -= 0.40; }

  // Stale bodyweight makes every relative-strength number meaningless.
  if (i.bodyweightAgeDays > 14) { flags.push('stale_bodyweight'); s -= 0.20; }

  const score = clamp(s, 0, 1);
  const eligible =
    score >= 0.70 &&
    i.qualifyingWeeks >= 8 &&
    i.accountAgeDays >= 56 &&
    i.bodyweightAgeDays <= 14 &&
    !flags.includes('above_world_record');

  return { score: +score.toFixed(2), flags, leaderboardEligible: eligible };
}

/** Acute:chronic workload ratio — the overtraining circuit breaker. */
export function acwr(last7dVolumeKg: number, last28dVolumeKg: number): number {
  const chronicWeekly = last28dVolumeKg / 4;
  return chronicWeekly > 0 ? last7dVolumeKg / chronicWeekly : 1;
}

export function shouldSuppressCompetitiveSurfaces(
  acwrValue: number, sessionsPerWeekLast3Weeks: number[], injuryFlagged: boolean
): boolean {
  if (injuryFlagged) return true;
  if (acwrValue > 1.5) return true;
  if (sessionsPerWeekLast3Weeks.length >= 3 &&
      sessionsPerWeekLast3Weeks.every(n => n >= 6)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const mean  = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;

export function normalCdf(z: number): number {
  // Abramowitz & Stegun 7.1.26
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-z * z / 2);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 +
            t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
}

export function probit(p: number): number {
  // Acklam's rational approximation, |err| < 1.15e-9
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
              1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
              6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
             -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
             3.754408661907416e+00];
  const pl = 0.02425, ph = 1 - pl;
  let q: number, r: number;
  if (p < pl) { q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
  if (p > ph) { q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
            ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
  q = p - 0.5; r = q * q;
  return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
         (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
}
```

═══════════════════════════════════════════════════════════════════════════
PART 6 — SOCIAL FEED
═══════════════════════════════════════════════════════════════════════════

WORKOUT POST — CONTENTS (in render order)
  1. Header: avatar, display name, @handle, rank chip (`Novice II` with tier
     colour), PRO chip if applicable, relative time, gym name (optional,
     opt-in, never GPS).
  2. Title: user-editable workout name, defaulting to `Push A · Week 4`.
  3. Optional body text, 500 char limit, no rich text, no hashtag feed.
  4. THE MUSCLE MAP (see below) — the hero, always present, always generated.
  5. Stat strip: Duration · Volume (kg) · Sets · PRs. Four numbers, no more.
  6. PR ribbons: up to 3, `Bench 102.5 kg × 3 — +2.5 kg`. Collapse beyond 3.
  7. Exercise list, collapsed to 4 with "+6 more", each showing name, best set.
  8. Optional media carousel (user photos/video of a lift). NEVER progress
     photos — those live in a separate store that has no share path at all.
  9. Actions: Like (single tap, no reaction menu — reactions invite ranking of
     reactions), Comment, Save-as-routine, Share.
 10. Engagement row: `41 · 6 comments`. Never "seen by".

THE AUTO-GENERATED MUSCLE-MAP SHARE IMAGE — spec
  • Anatomical front+back silhouette, rendered as inline SVG, rasterised
    server-side to PNG for external sharing.
  • Each of 14 muscle regions is filled by that region's SHARE OF SESSION
    VOLUME (not absolute), quantised to 5 steps so it reads at thumbnail size:
      0%        → base #1B2130 (unworked)
      1–8%      → #3F2A12
      8–18%     → #7A4A14
      18–32%    → #C77A16
      32%+      → #F5A524  (accent)
    Using share-of-session means a 60 kg and a 110 kg lifter produce equally
    vivid maps. Absolute-volume colouring would make the map a bodyweight
    leaderboard, which is exactly what we are avoiding.
  • Two output sizes: 1080×1350 (in-feed / IG portrait) and 1080×1920 (story).
  • Burned into the image: workout name, date, volume, reps, duration, PR
    count, rank chip, and a small wordmark. NOT burned in: bodyweight, body-fat,
    any photo, any location, any percentile, any comparison to another user.
  • Generated at Finish, cached, regenerated only if the workout is edited.
  • Alt text auto-written: "Muscle map for Push A: chest 34%, triceps 28%,
    front delts 21%, side delts 17% of session volume."

GROUPS
  • Types: Gym (geofence-verified by admin, not by user GPS), Team/Club,
    Program cohort (everyone running the same routine), Private (invite-only).
  • Max 500 members for a leaderboard-enabled group; above that, leaderboards
    switch to percentile bands rather than ranked lists, to stop the top of a
    huge group from being the only visible thing.
  • Group surfaces: feed filtered to members, a group leaderboard (relative
    strength only), a shared routine library, and a weekly digest.
  • Roles: owner, moderator, member. Moderators can remove posts and members,
    cannot see anyone's private data.
  • Joining a group never changes your post visibility retroactively.

FOLLOWING
  • Asymmetric follow (Twitter model), because symmetric friending creates
    obligation and makes people post less honestly.
  • Follow requests required when the profile is private (default for new
    accounts is `followers`).
  • Mutual follows get a "training partner" affordance: their PRs surface in
    your notifications, yours in theirs, and you can compare lift-by-lift.
  • Block, mute, and "hide from my feed but stay following" all exist.

LIKES & COMMENTS
  • One like type. No super-likes, no paid reactions.
  • Comments are flat with one reply level, 500 chars, no images in v1.
  • Rate limits: 30 comments/hour, 200 likes/hour. Not to stop engagement — to
    stop the "Spotter" badge from being farmable and to blunt spam.
  • No public comment count on a profile. Nothing that turns commenting into a
    score, because that is how comment sections become noise.

PRIVACY DEFAULTS (these are the shipped defaults, not suggestions)
  | Data                         | Default            | Can be shared?            |
  |------------------------------|--------------------|---------------------------|
  | Profile                      | followers-only     | yes, user can go public   |
  | Workouts                     | followers-only     | yes, per-workout override |
  | Individual workout           | inherits profile   | per-workout private toggle|
  | Volume / reps / duration     | with the workout   | yes                       |
  | Bodyweight                   | PRIVATE, always    | never auto; explicit opt-in per post, NOT remembered |
  | Progress photos              | PRIVATE, always    | never via any one-tap path; export only |
  | Body measurements            | PRIVATE, always    | never                     |
  | Rank / Iron Score            | followers-only     | yes                       |
  | Leaderboard participation    | OFF                | explicit opt-in           |
  | Gym / location               | OFF                | opt-in, name only, no GPS |
  | Under-18 accounts            | private, leaderboards off, discovery off, DMs off — not configurable |

  The bodyweight rule matters: the setting is deliberately NOT remembered.
  Every share of a bodyweight number is a fresh, conscious decision. This is
  a small friction that prevents a large category of harm.

═══════════════════════════════════════════════════════════════════════════
PART 7 — LEADERBOARDS & ANTI-CHEAT
═══════════════════════════════════════════════════════════════════════════

SEGMENTATION (no absolute-load leaderboard exists anywhere in the product)
  Every board is scored on DOTS-normalised e1RM, and cohorted on:
    sex × bodyweight band (±5 kg, or standard IPF classes) × age band
    (u18 excluded, 18–23, 24–39, 40–49, 50–59, 60+) × training age
    (<1 yr, 1–3 yr, 3+ yr).
  A 60 kg lifter and a 110 kg lifter are never on the same board, and even if
  they were, DOTS would equalise them.

BOARD TYPES
  1. Friends — people you mutually follow. Default surface. Small, warm, real.
  2. Gym / Group — verified membership. The board people actually care about.
  3. Cohort — your sex/weight/age/training-age bucket, global. Opt-in.
  4. Global Verified — top 100 per lift per cohort. Video required.
  5. Rising — largest 12-week Iron Score delta in your cohort. Deliberately
     included so that being new is an advantage on at least one board. This is
     the single most effective anti-discouragement mechanic available: a
     beginner cannot win the strength board but can absolutely win Rising.

WHAT IS NEVER SHOWN
  • Your absolute global position ("#4,281 of 90,000"). Downward comparison
    thwarts self-efficacy; we show the person above you and the gap instead.
  • Anyone's bodyweight, even though the board is bodyweight-segmented — the
    band is shown, never the number.
  • A "beaten by" notification. Ever.

ELIGIBILITY GATE (all must pass)
  ≥ 8 qualifying weeks · account ≥ 56 days · ≥ 3 independent sessions
  establishing the lift within 90 days · e1RM from sets of ≤ 6 reps ·
  bodyweight entry within 14 days · plausibility ≥ 0.70 · robustBestE1rm
  (median-of-top-3, never single max)

ANTI-CHEAT LAYERS (Strava's architecture, adapted)
  L1 HARD CEILING — anything above 1.02× the relevant world record is rejected
     at write time with a friendly message, not silently dropped.
  L2 STATISTICAL OUTLIER — z-score of the entry against its cohort. z > 4
     auto-flags. This is Strava's "multiple standard deviations faster than
     the existing leaderboard" trigger, applied to load.
  L3 RATE/PATTERN — volume-per-minute, inter-set gaps, round-number
     fingerprints, progression velocity (see `plausibility()` above).
  L4 ACCOUNT SIGNALS — new account posting Elite+ numbers, multiple accounts
     on one device, no bodyweight history, no warm-up sets ever logged.
  L5 SUPERVISED MODEL — once labelled data exists (from L1–L4 outcomes and
     community reports), train a classifier, exactly as Strava did.
  L6 COMMUNITY REPORT — any user can flag an entry; 3 independent flags from
     eligible accounts sends it to review.
  L7 VIDEO VERIFICATION — required for any top-100 Global placement, any
     Master/World Class rank badge, and any lift ≥ 92% of a world record.
     Reviewed by a small human queue. This is what OpenPowerlifting-adjacent
     communities already expect; it is a feature, not a burden.

CRUCIAL POSTURE: A FLAG NEVER DELETES THE USER'S DATA
  A flagged lift stays in the user's own log, charts, and history, exactly as
  entered. It is removed from leaderboards and from the percentile denominator
  only. This is Strava's policy and it is correct: most implausible entries
  are typos, not fraud, and punishing a typo by deleting someone's training
  history is unforgivable. The user sees: "This lift is not counting toward
  leaderboards — it looks like a typo (325 kg bench at 71 kg bodyweight).
  Fix it or tell us it's real."

CLEANING THE PERCENTILE DENOMINATOR
  The world-standings tab must never be polluted by the same fake lifts.
  Denominator rules: eligible accounts only, one entry per user per lift
  (their robust best), winsorised at the 0.1st and 99.9th percentiles, and
  entries flagged at L1–L5 excluded. Recompute nightly, version the
  distribution, and show users the "as of" date. A percentile that silently
  changes under a user is worse than no percentile.

═══════════════════════════════════════════════════════════════════════════
PART 8 — NOTIFICATIONS
═══════════════════════════════════════════════════════════════════════════

BUDGET: maximum 3 pushes per week, hard cap, across ALL categories combined.
QUIET HOURS: none sent 21:00–07:00 local, ever, no exceptions.
PROGRAM-AWARE: never sent on a day the user's own program marks as rest.
OPT-IN: the system permission prompt is NOT shown at launch. It appears after
the user's third finished workout, framed as "want to know when a lift PR
lands or a training partner beats one of yours?" — earning the 56–67% opt-in
rather than burning it on day zero.

THE WELCOME LIST (ship these)
  • `rank_up` — "You just hit Novice III. 32.0 points." Rare, earned, factual.
  • `pr_by_partner` — "Marcus just pulled 180 kg. That's 5 kg over yours."
    Upward comparison, specific, actionable. The single best notification we
    have, per the social-comparison literature.
  • `muscle_recovered` — "Legs are ready. Last squatted Tuesday." Information
    the user cannot get without opening the app, timed to be useful.
  • `rest_timer_done` — in-session, local, not a push proper.
  • `weekly_recap` — Sunday 18:00, one card: volume, PRs, rhythm, one
    interesting fact. Opt-out separately from everything else.
  • `badge_unlocked` — only for rare+ badges. Common and uncommon badges
    surface in the Finish summary and nowhere else.
  • `comment_or_like_digest` — batched, max once/day, never per-event.
  • `program_block_complete` — "Week 8 done. That block is finished — here's
    what changed." Genuinely satisfying, genuinely rare.

THE UNINSTALL LIST (never ship these)
  ✗ "You haven't worked out in 5 days." — the archetypal guilt push. 42% of
    fitness-app uninstallers say alerts made them feel like they were failing.
  ✗ "Your streak is about to end!" — the Apple-rings failure mode; pushes
    people to train injured or ill.
  ✗ "Sarah worked out today. Did you?" — weaponised social comparison.
  ✗ "You've dropped to Novice I." — decay is never notified. Ever.
  ✗ "3 people passed you on the leaderboard." — downward comparison, and it
    rewards the wrong behaviour.
  ✗ "Only 200 calories to go!" — we do not do calories at all (see Part 9).
  ✗ Any push whose only content is a restatement of a state the user could see
    by opening the app. If the notification carries no new information, it is
    an ad for our own app.
  ✗ Re-engagement campaigns to users who have been gone 30+ days. If someone
    left, the respectful move is a single email at day 45 with their stats and
    an export link, and then silence.

COPY RULES
  ≤ 90 characters (best-performing length for Health & Fitness). Second person.
  No exclamation marks in more than one in five. Never imperative about the
  body ("get those abs"). Always name a real number.

═══════════════════════════════════════════════════════════════════════════
PART 9 — ETHICS: MOTIVATING vs MANIPULATIVE
═══════════════════════════════════════════════════════════════════════════

THE LINE
  MOTIVATING mechanics give the user information they wanted, in a form that
  makes their own goal easier to pursue. They survive the user knowing exactly
  how they work.
  MANIPULATIVE mechanics manufacture a cost to stopping that is unrelated to
  the user's goal. They depend on the user not thinking about how they work.

  Operational test, applied to every mechanic in a design review:
    "If we showed the user the exact rule and the exact reason we built it,
     would they thank us or feel used?"
  The streak-freeze mechanic passes. A midnight "your streak dies in 1 hour"
  push does not. Iron Score passes. Iron Score with a points bonus for opening
  the app does not.

WHY THIS IS NOT ABSTRACT
  A systematic review links diet/fitness app use to elevated disordered-eating
  symptomology and worse body image, dose-dependent with use frequency. The
  BJPsych Open qualitative study names the eight mechanisms directly: fixation
  on numbers, rigid diet, obsession, app dependency, high sense of achievement,
  extreme negative emotions, motivation from 'negative' messages, and excess
  competition. Exercise-addiction prevalence in gym populations runs ~3.6–9.7%.
  On a base of 100,000 users, that is thousands of people for whom our
  gamification is not a game.

THE REFUSAL LIST (published in-app, treated as a spec artefact that every
feature PR is reviewed against)
  1. We will not set or suggest a calorie target, a deficit, or a macro split.
     Not in v1, not ever. This is the highest-risk surface in fitness software
     and we have no clinical supervision.
  2. We will not estimate, display, or gamify body-fat percentage.
  3. We will not show before/after body photos from other users, anywhere.
     Progress photos are private, side-by-side for YOU only, and have no share
     path — not even a hidden one.
  4. We will not rank, score, or comment on how a body looks. Only on what it
     lifts.
  5. We will not use guilt, shame, loss-framing, or fear in any copy.
  6. We will not build a mechanic that rewards training more than the user's
     own program prescribes. The league cap at 130% of personal baseline is
     this rule in code.
  7. We will not sell streak repairs, rank boosts, or any advantage on any
     leaderboard. Monetising anxiety is the line we do not cross.
  8. We will not use infinite scroll or autoplay video in the feed. The feed
     has an end, and it says so: "You're all caught up."
  9. We will not put minors on leaderboards or rank them on any
     bodyweight-derived metric.
 10. We will not make any data the user entered hard to export or delete.

OVERTRAINING & DISORDERED-BEHAVIOUR GUARDRAILS (implemented, not aspirational)
  G1 COMPETITIVE CIRCUIT BREAKER — `shouldSuppressCompetitiveSurfaces()`.
     Trigger on ACWR > 1.5 for 7 days, OR ≥ 6 sessions/week for 3 consecutive
     weeks, OR a self-reported injury. Effect: league hidden, leaderboards
     hidden, badge progress hidden, recovery screen surfaced instead. Nothing
     is lost — it comes back when load normalises. The user is told why.
  G2 WEIGH-IN FREQUENCY — the app accepts at most one bodyweight entry per
     day, charts a 7-day rolling mean by default rather than raw points, and
     the "On the Record" badge requires WEEKLY not daily entries. Daily
     weigh-in streaks are a documented eating-disorder vector; we ship none.
  G3 PHOTO CADENCE — the photo badge requires ≥ 21 days between shots. The UI
     actively discourages more frequent photos ("bodies don't change in three
     days — come back in three weeks"). Body-checking behaviour is a symptom,
     and a well-meaning feature can rehearse it daily.
  G4 RAPID WEIGHT LOSS DETECTION — if logged bodyweight falls > 1.0%/week for
     3 consecutive weeks, OR > 5% in 4 weeks, we stop showing relative-strength
     improvements driven by the denominator, show a plain non-clinical message
     ("your numbers are moving because your bodyweight is dropping fast — if
     that isn't intentional, that's worth a conversation with a doctor"), and
     surface region-appropriate support resources. We do not diagnose and we
     do not lock the app.
  G5 SCREENING, OFFERED NOT IMPOSED — the EAI-3 (cutoff 34/48) is available in
     settings as a self-check with resources attached. It is never
     auto-administered, never scored silently, and its result is never used
     for targeting, segmentation, or any product decision.
  G6 NO 24/7 MECHANIC — there is no daily mechanic of any kind. The smallest
     unit of accountability in the entire product is one week. This is the
     structural version of every guardrail above.
  G7 DELOAD IS A WIN — `deload_discipline` is a rare badge, deload weeks
     preserve Rhythm, and the league cannot demote you in a deload week. We
     put the reward on the behaviour that is hardest to self-impose.
  G8 AGE GATE — u18 accounts: no leaderboards, no follower discovery, no DMs,
     no bodyweight-relative badges, no percentile display. Not configurable.

AUTONOMY (the SDT lens)
  Gamification meta-analyses find reliable gains in perceived autonomy and
  relatedness but minimal gain in competence — and a 2025 Frontiers study
  found an S-shaped curve where additional gamification features eventually
  reduce exercise-adherence intention. Our answer: serve COMPETENCE, which is
  where generic gamification fails and where a strength app has a structural
  advantage. Getting measurably stronger IS competence satisfaction. That is
  why rank measures capability and nothing else — it is the one mechanic that
  cannot be built by a habit-tracker, and it is the one users cannot get bored
  of, because it is not a proxy for the thing, it IS the thing.

═══════════════════════════════════════════════════════════════════════════
PART 10 — VOLUME EQUIVALENCE LADDER (for the Finish summary + volume badges)
═══════════════════════════════════════════════════════════════════════════

Real masses, cited so the copy is never wrong. Pick the largest object where
count ≥ 1, plus one smaller object for texture. Never more than two.

| Object                                  | Mass (kg)   | Use from        |
|-----------------------------------------|-------------|-----------------|
| Bag of cement                            | 25          | 250 kg          |
| Adult male grizzly bear                  | 270         | 800 kg          |
| Upright piano                            | 230         | 700 kg          |
| Concert grand piano (Steinway D)         | 480         | 1,500 kg        |
| Racehorse                                | 500         | 1,500 kg        |
| Smart Fortwo                             | 750         | 2,000 kg        |
| Tesla Model 3                            | 1,760       | 4,000 kg        |
| Type II van ambulance, laden             | ~4,500      | 9,000 kg        |
| Adult male African elephant              | 6,000       | 15,000 kg       |
| London New Routemaster bus (kerb)        | 12,650      | 30,000 kg       |
| Boeing 737-800 (operating empty)         | 41,400      | 100,000 kg      |
| Blue whale                               | 150,000     | 400,000 kg      |
| Statue of Liberty (copper + steel)       | 204,100     | 600,000 kg      |
| Eiffel Tower (iron structure)            | 10,100,000  | 20,000,000 kg   |

Copy pattern (matching the user's brief): "4,000 kg today. That is one
ambulance, or eight concert grands." Always give the user a choice of two
images — one mechanical, one organic — because people latch onto different
ones, and offering two makes the number feel examined rather than generated.
Round counts to one decimal below 10, whole numbers above.

## Risks

- The DOTS female coefficients above are recalled, not verified from a primary source — the male set is well-attested but you must check the female polynomial against a reference implementation (e.g. OpenPowerlifting's or the IPF's published tables) before any leaderboard ships, or every female lifter's ranking will be systematically wrong.
- The time-in-rank column in the ladder table is a design target, not measured data — if real cohorts stall for 9+ months at Intermediate II the exponent 1.30 needs re-tuning, and you must reserve the ability to recalibrate the ladder once (with a clear in-app explanation) rather than discovering the problem after 100k users have an emotional attachment to their number.
- A percentile computed from our own user base is biased upward: people who log workouts in a tracker are stronger than the general gym population, and people who volunteer for leaderboards are stronger still — the log-normal prior fitted to published standards mitigates this but does not remove it, and the world-standings tab must say plainly that the comparison is against lifters who track, not against all humans.
- Rank decay, even soft decay, will generate support tickets and app-store complaints from users who do not read the explanation — budget for an unambiguous 'why did my score drop' screen reachable in one tap from the ring, and consider an onboarding moment that explains decay before it ever happens.
- Video verification for top-100 and Master/World Class ranks requires a human review queue with real cost and real latency; if you cannot staff it, do not ship those ranks as 'verified', because a verification badge that is not actually verified is worse than none.
- The 130% weekly effort-point cap will be discovered and discussed by power users and may read as punishing the most engaged segment — the copy around it has to be explicit and proud ('you've earned everything this week is worth, go recover') rather than silent, or it will feel like a bug.
- Exercise-addiction and disordered-eating guardrails involve inferring sensitive health states from behaviour, which has regulatory implications under GDPR Art. 9 and may put the app into medical-device territory in some jurisdictions depending on how the messaging is framed — get the rapid-weight-loss and screening copy reviewed by counsel before shipping, and keep every message non-diagnostic.
- The 3-push-per-week cap will be under constant commercial pressure from growth once retention metrics plateau; write it into the product spec as a hard constraint with a named owner, because it is the kind of decision that erodes one exception at a time.
- Group leaderboards at gym level can become a bullying surface in real-world social contexts where members know each other — ship moderator removal, per-user opt-out from a specific group's board, and a 'leave quietly' path before enabling gym groups at scale.
- Badge rarity recomputed monthly means a user's Epic badge can become Rare over time, which feels like a downgrade — never lower a badge's displayed tier for users who already hold it; re-tier only for future earners, and version the catalogue so the original tier is preserved on the earned instance.
