# Muscle readiness / recovery model for Stronger 2.0 — per-muscle fatigue accrual, decay, 0-100 capacity score, and the train-today/train-tomorrow recommender

## Summary

I built and ran a calibrated per-muscle readiness engine and grounded every constant in a citable source. The core architecture is a two-compartment exponential decay per muscle — a STRUCTURAL (eccentric-damage) compartment with muscle-specific time constants from 20h (calves, abs) to 40h (erectors), and a METABOLIC/peripheral compartment at 8-13h — plus a separate two-compartment SYSTEMIC layer (16h fast / 60h slow) fed by axial load and stimulus-to-fatigue ratio. Readiness = 1 - (0.62*tanh(structural/4.8) + 0.38*tanh(metabolic/4.8)). The tanh saturation is what keeps a brutal session at ~15-20% rather than negative. Three calibration passes were needed: the first draft read 10% quads at 20h post and 61% at 72h, which contradicts the force-recovery literature; the shipped version reads 29% at 20h, 81% at 72h and 89% at 96h after heavy squats to failure plus a leg-extension drop set, with calves at 87% by 28h. Key evidence that shaped structure rather than just numbers. (1) MPS is the wrong clock: MacDougall 1995 has MPS back within 14% of control by 36h, so it cannot generate the day-to-day spread a readiness chip needs — force recovery and EIMD must drive it. (2) Failure training elongates the whole recovery curve by 24-48h (Vieira meta; Refalo 2023 velocity data: -25%/-13%/-8% at 4min for failure/1-RIR/3-RIR), so failure sets need a time-constant stretch (1.30x) as well as a magnitude bump, not magnitude alone. (3) Drop sets are metabolic, not structural — Havers 2026 meta gives RPE SMD 1.62 and lactate SMD 0.67 with equal hypertrophy — so they get metabolic 1.85 / structural 1.15 with 0.45^n per-drop structural attenuation. (4) Warm-ups at 0.15/0.10 and zero volume credit, verified: a warm-up-only session leaves chest at 99%. On the 0-100 capacity score, the base is 0.50*systemic + 0.35*volume-weighted muscular + 0.15*uncoupled-ACWR ramp, computed purely from the training log, which is why the reference screenshot's 100 with everything "Not connected" is legitimate and reproduces exactly in my run. Wearables are bounded multiplicative modifiers (HRV via Ln rMSSD z-score, clamp 0.80-1.08; RHR 0.82-1.05; sleep 0.80-1.03) with an explicit confidence ladder from 0.45 to 0.93. Sleep is deliberately weak on the score and strong on the recovery RATE, because Craven 2022 found acute sleep loss costs only -0.3% on strength but -7.6% on performance overall. ACWR is uncoupled and weighted at 15%, with Impellizzeri 2020 and Lolli 2019 dictating that it is never presented as injury risk. The recommender multiplies readiness^1.6, weekly volume deficit against mesocycle-ramped RP landmarks (hard-blocked above MRV), a Gaussian staleness term peaking at 1.9*tau, and the user's own weekday habit; it simulates today's chosen session forward 24h to produce a real "tomorrow". Cold start returns 100/low with honest copy until two sessions are logged, assumes low familiarity (which raises damage 1.6-1.8x for beginners, matching Damas), and personalises tau online with k=6 shrinkage toward the population prior.

## Findings

### MPS timeline is the wrong clock for a readiness UI — force recovery is the right one

MacDougall 1995 measured MPS at +50% at 4h, +109% at 24h, and back to within 14% of the control arm by 36h post heavy resistance exercise. Damas 2015 (Sports Med, PMID 25739559) showed the MPS response peaks earlier and is shorter-lived in TRAINED lifters, and that 48h-integrated MPS does not correlate with hypertrophy in untrained subjects until ~3 weeks of training because early MPS is damage repair. Implication: MPS is essentially back to baseline by 36-48h regardless of muscle, so it cannot generate the 20h-vs-72h spread users expect from a readiness chip. The chip must be driven by FORCE/performance recovery and EIMD, which do differ markedly by muscle and by set type.

Source: https://cdnsciencepub.com/doi/10.1139/h95-038 ; https://link.springer.com/article/10.1007/s40279-015-0320-0

### Training to failure elongates the recovery curve by 24-48h — this is the single largest set-type effect

Vieira et al. meta-analysis: recovery time courses are elongated by 24-48 hours when training to failure, with higher session RPE. Refalo 2023 (PMC9908800) measured lifting-velocity loss at 4 min post: -25% (failure), -13% (1-RIR), -8% (3-RIR); at 24h: -3% (failure), -3% (1-RIR), +2% (3-RIR); differences gone by 48h. This justifies BOTH a magnitude multiplier (1.18x structural) AND a time-constant stretch (tauStretch 1.30) for failure sets — magnitude alone cannot reproduce the elongation.

Source: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9908800/

### Drop sets are a metabolic cost, not a structural one — RPE SMD 1.62, lactate SMD 0.67

Havers et al. 2026 meta-analysis (Sports Med Open, 12 studies, 274 participants): drop sets produce significantly higher RPE (SMD 1.62, 95% CI 0.33-2.91) and blood lactate (SMD 0.67, 95% CI 0.20-1.14) than traditional sets, with equal hypertrophy and strength in a third to half the time. Correct modelling: drop sets get a LARGE metabolic multiplier (1.85) and only a modest structural one (1.15), with per-drop structural attenuation of 0.45^n because mechanical tension collapses as the weight drops while metabolite accumulation does not.

Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC13043944/

### Real RP volume landmarks table, per muscle, in weekly hard sets

MV ~6 sets/week for most muscles. MEV/MAV/MRV: Chest 8/12-20/22+; Back width 8/12-20/25+; Back thickness 6/10-16/20+; Side+rear delts 6/12-20/25+; Front delts 0/0-6/12; Biceps 6/10-16/20+; Triceps 4/8-14/18+; Quads 6(RP guide says 8)/10-18/20+; Hamstrings 4/8-14/16+; Glutes 4/8-16/20+; Calves 6/10-16/20+. RP's own article confirms MV ~6 working sets/week and 'train each muscle at least twice weekly'.

Source: https://arvo.guru/tools/volume-calculator ; https://rpstrength.com/blogs/articles/training-volume-landmarks-muscle-growth

### ACWR is usable only in its uncoupled form and only as a soft modifier

Gabbett 2016 (BJSM 50:273-80) gives the 0.8-1.3 'sweet spot' and >1.5 'danger zone'. But Impellizzeri 2020 (IJSPP 15(6):907-13) shows the ratio magnifies the acute-load effect without adding predictive value and that the window lengths have no physiological justification, and Lolli 2019 shows the conventional COUPLED ratio (acute inside chronic) produces spurious correlation via mathematical coupling. Design decision: compute uncoupled ACWR (last 7 days vs the prior 21 days, non-overlapping), weight it at only 15% of the capacity score, taper gently (0.32 per unit above 1.3, floor 0.70), and never label it 'injury risk'.

Source: https://journals.humankinetics.com/view/journals/ijspp/15/6/article-p907.xml

### Fitness-Fatigue / TrainingPeaks constants are 42-day and 7-day, and TSB = CTL - ATL

Banister: g(t) = k1*exp(-t/tau1) - k2*exp(-t/tau2). TrainingPeaks Performance Manager operationalises this with CTL = 42-day exponentially-weighted moving average of daily TSS/TRIMP and ATL = 7-day EWMA, TSB = CTL - ATL. Morton's original constants were 50d fitness / 15d fatigue; other fits use 20d/7d with k1=1, k2=1.5. For lifting these day-scale constants are the SYSTEMIC layer only — per-muscle EIMD needs hour-scale constants (20-40h), which is why our model is two-layer.

Source: https://www.trainingpeaks.com/learn/articles/the-science-of-the-performance-manager/

### Fibre-type data gives a defensible, non-arbitrary per-muscle recovery ordering

Johnson 1973 (36 human muscles): soleus ~80% type I (range 64-100%), superficial triceps brachii 67.5% type II (i.e. ~33% type I), vastus lateralis ~32% type I superficially (Staron 2000: ~40% type I in men). Combined with the finding that elbow flexors (fusiform, long fascicles) are far more damage-susceptible than pennate knee extensors, this yields the tau ordering: calves/abs 20h < forearms/obliques/neck 22h < side+rear delts 24h < traps/front delts 26h < upper back/triceps 28h < chest/biceps 30h < lats/adductors 32h < quads/glutes 34h < hamstrings 38h < lower back 40h.

Source: Johnson MA et al. J Neurol Sci 1973;18(1):111-29 ; https://journals.sagepub.com/doi/10.1177/002215540004800506

### Sleep loss barely dents peak strength but wrecks work capacity — so sleep belongs on the recovery RATE, not the strength score

Craven et al. 2022 (Sports Med 52:2669-2690, 227 outcomes from 69 publications, 66 strength measures): overall physical performance -7.56% (95% CI -11.9 to -3.13), but STRENGTH specifically -0.30% (95% CI -0.59 to 0.01, p=0.051) for sleep deprivation and -0.10% for early restriction. PM exercise is hit harder than AM. Design decision: sleep debt gets only a -3%/hour modifier on the capacity score (floor 0.80) but a +5.5%/hour multiplier on EVERY recovery time constant, which is where it actually bites.

Source: https://pubmed.ncbi.nlm.nih.gov/35708888/

### A 100/100 score with wearables 'Not connected' is legitimate and should be shipped with an explicit confidence level

The base score is 0.50*systemic + 0.35*muscular + 0.15*ramp from the training log alone; with no recent training all three terms are 1.0, so 100 is the correct answer, not a placeholder. Wearables enter as bounded multiplicative modifiers: HRV clamp 0.80-1.08, RHR clamp 0.82-1.05, sleep clamp 0.80-1.03. Confidence starts at 0.45 (log only) and climbs +0.30 HRV, +0.12 RHR, +0.10 sleep, +0.08 subjective. Notably, NO consumer recovery algorithm (Whoop, Oura, Garmin) has published RCT evidence that its score beats simply asking the user how they feel — so a cheap subjective check-in is a defensible +0.08 and should be offered before pushing hardware.

Source: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12367097/

### HRV must be Ln rMSSD, 7-day rolling, z-scored against the user's own 60-day baseline

Raw daily rMSSD is too noisy to drive a score. Plews/Kiviniemi standard: take ln(rMSSD), 7-day rolling mean, compare to a 60-day mean and SD of ln rMSSD, and act on the z-score. Javaloyes 2018/2020 (PMID 29809080) found HRV-guided prescription beat block periodization in well-trained cyclists on peak power, FTP and 40-min TT — the only decent RCT evidence that daily HRV-guided decisions improve outcomes. Our modifier is 1 + 0.055*z clamped to [0.80, 1.08], i.e. a 2-SD bad day costs ~11 points, never more than 20.

Source: https://pubmed.ncbi.nlm.nih.gov/29809080/

### Repeated-bout effect should be modelled as two separate, non-multiplied terms

Nosaka & Clarkson: a single eccentric bout protects for up to ~24 weeks, with the largest protection at the first re-exposure; mechanisms include sarcomere addition, ECM remodelling and altered motor-unit recruitment, and the effect persists with electrically stimulated contractions so it is not purely neural. Note one study found RBE absent in already resistance-trained men (PMC2783719) — i.e. the effect saturates. Implementation: muscle familiarity term (1 + 0.60*(1-fam)) and a movement-novelty term (1 + 0.35*novelty*fam). Scaling novelty BY familiarity prevents double-counting: for an unadapted muscle the familiarity term already covers the damage, and it stops a beginner's first cable fly from reading as a 2.5x fatigue event.

Source: https://pubmed.ncbi.nlm.nih.gov/12641640/ ; https://pmc.ncbi.nlm.nih.gov/articles/PMC2783719/

### e1RM: use the weight-dependent equation fitted on 303,494 real app sets, not Epley

arXiv:2603.17495 derived 1RM = w * (1 + (r-1)^0.85 / (-2.55 + 4.58*ln w)) from 303,494 near-failure sets by 14,966 users across 388 exercises and 16 muscle groups, reducing internal inconsistency 17-22% versus four classical formulas, with the improvement positive for every one of the 183 exercises with sufficient data. Classical fallbacks: Epley 1RM = w(1+r/30) best at 6-10 reps; Brzycki 1RM = w/(1.0278-0.0278r) best at 1-6. This matters for readiness because fatigue accrual is a function of load RELATIVE to e1RM, so a bad e1RM corrupts every readiness number downstream.

Source: https://arxiv.org/abs/2603.17495

### Frequency research constrains the recommender more than the recovery model does

Schoenfeld/Grgic/Krieger 2019 (PMID 30558493): volume-equated, frequencies of 1-6 days/week produce similar hypertrophy; evidence slightly favours 2+/week over 1/week especially at high volume; when SESSION volume exceeds ~15 sets, splitting across more sessions wins. So the recommender should not chase a theoretically 'optimal' frequency — it should enforce >=2x/week for majors, cap per-session per-muscle volume near 10-12 hard sets, and otherwise defer to the user's own weekday habit (we weight habit at 0.55 + 0.75*affinity).

Source: https://pubmed.ncbi.nlm.nih.gov/30558493/

### DOMS is the wrong signal to block training on, but the right signal to earn trust with

Soreness rises within 24h, peaks 24-72h and disappears by 5-7 days, while force loss at 24-48h is the better damage marker (PLOS One 2022 meta on indirect markers, PMC9282447). A model that blocks training on soreness will contradict the literature; a model that ignores the user's soreness report will feel broken. Resolution: soreness contributes at most -12 readiness points (4 per point on a 0-3 scale) and feeds the personalisation residual, but never sets the readiness value.

Source: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9282447/

### Stimulus-to-fatigue ratio belongs on the SYSTEMIC term, not the per-muscle term

Israetel's SFR concept: axially loaded, multi-joint, heavy movements (conventional deadlift, back squat, rack pull) cause fatigue across the whole body disproportionate to the hypertrophy stimulus, while Bulgarian split squats reach a larger hip ROM without the axial load. Implementation: per-exercise axialLoad (deadlift 1.00, back squat 0.95, front squat 0.80, barbell row 0.70, OHP 0.55, leg press 0.25, leg extension 0.02) and sfr (deadlift 0.65, back squat 0.90, chest-supported row 1.30, face pull 1.40) multiply only the SYSTEMIC deposit. This is what makes 'a deadlift day costs you Wednesday' fall out of the model rather than being hard-coded.

Source: https://rpstrength.com/ ; https://outlift.com/stimulus-to-fatigue-ratio-sfr/

## Recommendations

- Ship the two-compartment model (structural EIMD tau 20-40h per muscle + metabolic tau 8-13h) rather than a single decay, because it is the only structure that makes a drop set feel different from a heavy triple tomorrow morning.

## Data

// =============================================================================
// Stronger 2.0 — Muscle Readiness & Recovery Engine  (readiness.ts)
// Verified: type-strips and runs under Node 24 (`node --experimental-strip-types readiness.ts`).
// Calibration output at bottom of this field.
// =============================================================================

/**
 * SCIENTIFIC BASIS (full citations in REFERENCES block at end)
 *  - MacDougall 1995: MPS +50% @4h, +109% @24h, within 14% of control @36h post heavy RT.
 *  - Damas 2015/2016: MPS response peaks earlier and is shorter-lived in trained lifters;
 *    early-training MPS is largely damage repair, not net hypertrophy.
 *  - DOMS: rises <24h, peaks 24-72h, resolves 5-7d. Soreness is a POOR damage proxy;
 *    force loss at 24-48h is the better marker.
 *  - Vieira 2022 meta: training to failure elongates recovery by 24-48h vs 2-3 RIR.
 *    Refalo 2023: velocity loss at 4 min = -25% (failure), -13% (1-RIR), -8% (3-RIR);
 *    at 24h = -3% / -3% / +2%.
 *  - Havers 2026 (Sports Med Open): drop sets => RPE SMD 1.62, lactate SMD 0.67 vs
 *    straight sets => large extra METABOLIC cost, modest structural cost.
 *  - Nosaka & Clarkson: repeated-bout effect, protection up to ~24 weeks.
 *  - Johnson 1973 (36 human muscles): soleus ~80% type I, superficial triceps ~67.5%
 *    type II, vastus lateralis ~32-40% type I.
 *  - Banister impulse-response; Coggan/TrainingPeaks CTL(42d)/ATL(7d), TSB = CTL - ATL.
 *  - Gabbett 2016 ACWR 0.8-1.3 "sweet spot"; Impellizzeri 2020 + Lolli 2019 show the
 *    COUPLED ratio is mathematically coupled/spuriously correlated => we use UNCOUPLED,
 *    as a soft modifier only, never as an injury claim.
 *  - RP volume landmarks MV/MEV/MAV/MRV in weekly hard sets.
 *  - Craven 2022: acute sleep loss hits peak strength only mildly (-0.3%, CI -0.59..0.01)
 *    but degrades work capacity => sleep weighted on capacity + RECOVERY RATE, not on
 *    max-strength readiness.
 *  - Plews/Kiviniemi: Ln rMSSD 7-day rolling mean vs rolling baseline, not raw rMSSD.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. MUSCLE TAXONOMY + REAL CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export type MuscleId =
  | 'chest' | 'front_delts' | 'side_delts' | 'rear_delts'
  | 'lats' | 'upper_back' | 'lower_back' | 'traps'
  | 'biceps' | 'triceps' | 'forearms'
  | 'abs' | 'obliques'
  | 'glutes' | 'quads' | 'hamstrings' | 'adductors' | 'abductors'
  | 'calves' | 'tibialis' | 'neck';

export interface MuscleConstants {
  id: MuscleId;
  label: string;
  region: 'push' | 'pull' | 'legs' | 'core' | 'arms';
  /** Structural (EIMD) fatigue decay time constant, HOURS. Fatigue -> 37% at t=tau. */
  tauStructuralH: number;
  /** Metabolic / peripheral-neuromuscular decay time constant, HOURS. */
  tauMetabolicH: number;
  /** % type-I fibres (Johnson 1973 / Staron 2000). */
  slowTwitchPct: number;
  /** Relative susceptibility to eccentric damage. Elbow flexors & hamstrings highest,
   *  pennate + slow-twitch (calves, delts) lowest. 1.0 = chest reference. */
  eccentricSensitivity: number;
  /** How much of a set on this muscle spills into SYSTEMIC fatigue (mass proxy). */
  systemicShare: number;
  /** Renaissance Periodization weekly HARD SET landmarks. */
  mv: number; mev: number; mavLow: number; mavHigh: number; mrv: number;
  /** Sessions/week (Schoenfeld 2016/2019: >=2x for majors). */
  targetFrequency: number;
  /** Hard floor: never recommend re-loading sooner than this (hours). */
  minRetrainH: number;
}

/**
 * tau calibrated so a MAXIMAL session yields readiness(48h) ≈ 100 - 62*e^(-48/tau):
 *   quads (tau 34h): ~75% @48h, ~88% @72h, ~94% @96h — matches force-recovery literature
 *   calves (tau 20h): ~87% @48h — matches an ~80% type-I soleus
 */
export const MUSCLES: Record<MuscleId, MuscleConstants> = {
  chest:       { id:'chest',       label:'Chest',             region:'push', tauStructuralH:30, tauMetabolicH:11, slowTwitchPct:42, eccentricSensitivity:1.00, systemicShare:0.85, mv:4, mev:8, mavLow:12, mavHigh:20, mrv:22, targetFrequency:2, minRetrainH:36 },
  front_delts: { id:'front_delts', label:'Front delts',       region:'push', tauStructuralH:26, tauMetabolicH:10, slowTwitchPct:45, eccentricSensitivity:0.85, systemicShare:0.40, mv:0, mev:0, mavLow:0,  mavHigh:6,  mrv:12, targetFrequency:2, minRetrainH:24 },
  side_delts:  { id:'side_delts',  label:'Side delts',        region:'push', tauStructuralH:24, tauMetabolicH:9,  slowTwitchPct:45, eccentricSensitivity:0.80, systemicShare:0.35, mv:4, mev:6, mavLow:12, mavHigh:20, mrv:26, targetFrequency:3, minRetrainH:20 },
  rear_delts:  { id:'rear_delts',  label:'Rear delts',        region:'pull', tauStructuralH:24, tauMetabolicH:9,  slowTwitchPct:50, eccentricSensitivity:0.80, systemicShare:0.30, mv:0, mev:6, mavLow:10, mavHigh:18, mrv:24, targetFrequency:3, minRetrainH:20 },
  lats:        { id:'lats',        label:'Lats',              region:'pull', tauStructuralH:32, tauMetabolicH:11, slowTwitchPct:50, eccentricSensitivity:1.00, systemicShare:0.85, mv:6, mev:8, mavLow:12, mavHigh:20, mrv:25, targetFrequency:2, minRetrainH:36 },
  upper_back:  { id:'upper_back',  label:'Upper back',        region:'pull', tauStructuralH:28, tauMetabolicH:10, slowTwitchPct:54, eccentricSensitivity:0.90, systemicShare:0.60, mv:4, mev:6, mavLow:10, mavHigh:16, mrv:20, targetFrequency:2, minRetrainH:30 },
  traps:       { id:'traps',       label:'Traps',             region:'pull', tauStructuralH:26, tauMetabolicH:10, slowTwitchPct:54, eccentricSensitivity:0.85, systemicShare:0.45, mv:0, mev:4, mavLow:8,  mavHigh:16, mrv:20, targetFrequency:3, minRetrainH:24 },
  lower_back:  { id:'lower_back',  label:'Lower back',        region:'pull', tauStructuralH:40, tauMetabolicH:13, slowTwitchPct:58, eccentricSensitivity:1.15, systemicShare:1.00, mv:2, mev:4, mavLow:6,  mavHigh:10, mrv:12, targetFrequency:2, minRetrainH:48 },
  biceps:      { id:'biceps',      label:'Biceps',            region:'arms', tauStructuralH:30, tauMetabolicH:10, slowTwitchPct:45, eccentricSensitivity:1.30, systemicShare:0.25, mv:4, mev:6, mavLow:10, mavHigh:16, mrv:20, targetFrequency:2, minRetrainH:30 },
  triceps:     { id:'triceps',     label:'Triceps',           region:'arms', tauStructuralH:28, tauMetabolicH:10, slowTwitchPct:33, eccentricSensitivity:1.05, systemicShare:0.30, mv:4, mev:4, mavLow:8,  mavHigh:14, mrv:18, targetFrequency:2, minRetrainH:28 },
  forearms:    { id:'forearms',    label:'Forearms',          region:'arms', tauStructuralH:22, tauMetabolicH:9,  slowTwitchPct:55, eccentricSensitivity:1.10, systemicShare:0.15, mv:2, mev:4, mavLow:6,  mavHigh:12, mrv:16, targetFrequency:3, minRetrainH:20 },
  abs:         { id:'abs',         label:'Abs',               region:'core', tauStructuralH:20, tauMetabolicH:8,  slowTwitchPct:55, eccentricSensitivity:0.85, systemicShare:0.20, mv:0, mev:0, mavLow:6,  mavHigh:16, mrv:25, targetFrequency:3, minRetrainH:18 },
  obliques:    { id:'obliques',    label:'Obliques',          region:'core', tauStructuralH:22, tauMetabolicH:8,  slowTwitchPct:55, eccentricSensitivity:0.90, systemicShare:0.20, mv:0, mev:0, mavLow:4,  mavHigh:12, mrv:20, targetFrequency:3, minRetrainH:18 },
  glutes:      { id:'glutes',      label:'Glutes',            region:'legs', tauStructuralH:34, tauMetabolicH:12, slowTwitchPct:52, eccentricSensitivity:1.10, systemicShare:0.95, mv:0, mev:4, mavLow:8,  mavHigh:16, mrv:20, targetFrequency:2, minRetrainH:40 },
  quads:       { id:'quads',       label:'Quads',             region:'legs', tauStructuralH:34, tauMetabolicH:12, slowTwitchPct:42, eccentricSensitivity:1.15, systemicShare:1.00, mv:6, mev:8, mavLow:12, mavHigh:18, mrv:20, targetFrequency:2, minRetrainH:40 },
  hamstrings:  { id:'hamstrings',  label:'Hamstrings',        region:'legs', tauStructuralH:38, tauMetabolicH:12, slowTwitchPct:48, eccentricSensitivity:1.35, systemicShare:0.85, mv:3, mev:4, mavLow:8,  mavHigh:14, mrv:16, targetFrequency:2, minRetrainH:44 },
  adductors:   { id:'adductors',   label:'Adductors',         region:'legs', tauStructuralH:32, tauMetabolicH:11, slowTwitchPct:50, eccentricSensitivity:1.15, systemicShare:0.45, mv:0, mev:0, mavLow:4,  mavHigh:12, mrv:16, targetFrequency:2, minRetrainH:36 },
  abductors:   { id:'abductors',   label:'Abductors',         region:'legs', tauStructuralH:26, tauMetabolicH:10, slowTwitchPct:55, eccentricSensitivity:0.90, systemicShare:0.25, mv:0, mev:0, mavLow:4,  mavHigh:12, mrv:16, targetFrequency:3, minRetrainH:24 },
  calves:      { id:'calves',      label:'Calves',            region:'legs', tauStructuralH:20, tauMetabolicH:8,  slowTwitchPct:80, eccentricSensitivity:0.75, systemicShare:0.25, mv:6, mev:8, mavLow:12, mavHigh:16, mrv:20, targetFrequency:3, minRetrainH:20 },
  tibialis:    { id:'tibialis',    label:'Tibialis anterior', region:'legs', tauStructuralH:20, tauMetabolicH:8,  slowTwitchPct:73, eccentricSensitivity:0.85, systemicShare:0.10, mv:0, mev:0, mavLow:4,  mavHigh:10, mrv:14, targetFrequency:3, minRetrainH:18 },
  neck:        { id:'neck',        label:'Neck',              region:'core', tauStructuralH:22, tauMetabolicH:8,  slowTwitchPct:60, eccentricSensitivity:0.85, systemicShare:0.10, mv:0, mev:0, mavLow:4,  mavHigh:10, mrv:14, targetFrequency:3, minRetrainH:20 },
};

export const ALL_MUSCLES = Object.keys(MUSCLES) as MuscleId[];

const W_STRUCTURAL = 0.62;
const W_METABOLIC  = 0.38;
const TAU_SYSTEMIC_FAST_H = 16;
const TAU_SYSTEMIC_SLOW_H = 60;
const W_SYS_FAST = 0.45;
const W_SYS_SLOW = 0.55;

// ─────────────────────────────────────────────────────────────────────────────
// 2. EXERCISE FATIGUE PROFILES
// ─────────────────────────────────────────────────────────────────────────────

export interface ExerciseProfile {
  id: string;
  name: string;
  /** Fractional involvement. 1.0 prime mover, ~0.5 strong synergist, 0.15-0.25 stabiliser.
   *  Doubles as the "hard set" credit toward weekly volume landmarks. */
  contributions: Partial<Record<MuscleId, number>>;
  /** Spinal / whole-body axial load 0..1. Deadlift 1.0, machine curl 0.02. */
  axialLoad: number;
  /** Loaded-stretch index: tension at long muscle length — the biggest driver of EIMD. */
  loadedStretchIndex: number;
  /** Stimulus-to-fatigue ratio (Israetel). >1 efficient, <1 costly. Scales systemic cost. */
  sfr: number;
  defaultEccentricSec: number;
  unilateral?: boolean;
}

export const EXERCISES: Record<string, ExerciseProfile> = {
  barbell_bench_press:  { id:'barbell_bench_press', name:'Barbell Bench Press',
    contributions:{ chest:1.0, front_delts:0.55, triceps:0.50, lats:0.10 },
    axialLoad:0.25, loadedStretchIndex:1.20, sfr:1.05, defaultEccentricSec:2 },
  incline_db_press:     { id:'incline_db_press', name:'Incline Dumbbell Press',
    contributions:{ chest:1.0, front_delts:0.65, triceps:0.45 },
    axialLoad:0.20, loadedStretchIndex:1.30, sfr:1.15, defaultEccentricSec:2.5 },
  dips:                 { id:'dips', name:'Weighted Dips',
    contributions:{ chest:0.85, triceps:0.90, front_delts:0.50 },
    axialLoad:0.15, loadedStretchIndex:1.35, sfr:1.00, defaultEccentricSec:2 },
  cable_fly:            { id:'cable_fly', name:'Cable Fly',
    contributions:{ chest:1.0, front_delts:0.25 },
    axialLoad:0.05, loadedStretchIndex:1.40, sfr:1.20, defaultEccentricSec:2.5 },
  back_squat:           { id:'back_squat', name:'Barbell Back Squat',
    contributions:{ quads:1.0, glutes:0.70, adductors:0.45, lower_back:0.45, hamstrings:0.25, abs:0.20, calves:0.10 },
    axialLoad:0.95, loadedStretchIndex:1.25, sfr:0.90, defaultEccentricSec:2 },
  front_squat:          { id:'front_squat', name:'Front Squat',
    contributions:{ quads:1.0, glutes:0.50, upper_back:0.35, lower_back:0.35, abs:0.30 },
    axialLoad:0.80, loadedStretchIndex:1.25, sfr:0.95, defaultEccentricSec:2 },
  leg_press:            { id:'leg_press', name:'Leg Press',
    contributions:{ quads:1.0, glutes:0.55, adductors:0.35, hamstrings:0.15 },
    axialLoad:0.25, loadedStretchIndex:1.15, sfr:1.25, defaultEccentricSec:2 },
  leg_extension:        { id:'leg_extension', name:'Leg Extension',
    contributions:{ quads:1.0 },
    axialLoad:0.02, loadedStretchIndex:0.95, sfr:1.30, defaultEccentricSec:2 },
  bulgarian_split_squat:{ id:'bulgarian_split_squat', name:'Bulgarian Split Squat',
    contributions:{ quads:0.90, glutes:0.95, adductors:0.40, hamstrings:0.25, abductors:0.25 },
    axialLoad:0.35, loadedStretchIndex:1.40, sfr:1.10, defaultEccentricSec:2.5, unilateral:true },
  conventional_deadlift:{ id:'conventional_deadlift', name:'Conventional Deadlift',
    contributions:{ lower_back:1.0, glutes:0.90, hamstrings:0.80, quads:0.40, traps:0.55, upper_back:0.50, forearms:0.45, lats:0.30 },
    axialLoad:1.00, loadedStretchIndex:1.10, sfr:0.65, defaultEccentricSec:1.5 },
  romanian_deadlift:    { id:'romanian_deadlift', name:'Romanian Deadlift',
    contributions:{ hamstrings:1.0, glutes:0.80, lower_back:0.65, traps:0.30, forearms:0.35 },
    axialLoad:0.75, loadedStretchIndex:1.45, sfr:0.95, defaultEccentricSec:3 },
  lying_leg_curl:       { id:'lying_leg_curl', name:'Lying Leg Curl',
    contributions:{ hamstrings:1.0, calves:0.15 },
    axialLoad:0.02, loadedStretchIndex:1.00, sfr:1.30, defaultEccentricSec:2 },
  hip_thrust:           { id:'hip_thrust', name:'Barbell Hip Thrust',
    contributions:{ glutes:1.0, hamstrings:0.40, quads:0.20 },
    axialLoad:0.25, loadedStretchIndex:0.85, sfr:1.20, defaultEccentricSec:2 },
  pull_up:              { id:'pull_up', name:'Weighted Pull-Up',
    contributions:{ lats:1.0, biceps:0.60, upper_back:0.55, rear_delts:0.30, forearms:0.35, abs:0.20 },
    axialLoad:0.15, loadedStretchIndex:1.35, sfr:1.10, defaultEccentricSec:2.5 },
  barbell_row:          { id:'barbell_row', name:'Barbell Row',
    contributions:{ lats:0.85, upper_back:1.0, rear_delts:0.45, biceps:0.50, lower_back:0.55, forearms:0.30 },
    axialLoad:0.70, loadedStretchIndex:1.15, sfr:0.90, defaultEccentricSec:2 },
  lat_pulldown:         { id:'lat_pulldown', name:'Lat Pulldown',
    contributions:{ lats:1.0, biceps:0.55, upper_back:0.45, rear_delts:0.25, forearms:0.25 },
    axialLoad:0.08, loadedStretchIndex:1.25, sfr:1.25, defaultEccentricSec:2.5 },
  chest_supported_row:  { id:'chest_supported_row', name:'Chest-Supported Row',
    contributions:{ upper_back:1.0, lats:0.75, rear_delts:0.55, biceps:0.45 },
    axialLoad:0.10, loadedStretchIndex:1.20, sfr:1.30, defaultEccentricSec:2.5 },
  overhead_press:       { id:'overhead_press', name:'Standing Overhead Press',
    contributions:{ front_delts:1.0, side_delts:0.45, triceps:0.65, upper_back:0.25, abs:0.25, lower_back:0.30 },
    axialLoad:0.55, loadedStretchIndex:1.05, sfr:0.95, defaultEccentricSec:2 },
  lateral_raise:        { id:'lateral_raise', name:'Dumbbell Lateral Raise',
    contributions:{ side_delts:1.0, traps:0.25, front_delts:0.15 },
    axialLoad:0.05, loadedStretchIndex:0.90, sfr:1.35, defaultEccentricSec:2 },
  face_pull:            { id:'face_pull', name:'Cable Face Pull',
    contributions:{ rear_delts:1.0, upper_back:0.55, traps:0.35 },
    axialLoad:0.04, loadedStretchIndex:0.95, sfr:1.40, defaultEccentricSec:2 },
  incline_db_curl:      { id:'incline_db_curl', name:'Incline Dumbbell Curl',
    contributions:{ biceps:1.0, forearms:0.30 },
    axialLoad:0.03, loadedStretchIndex:1.45, sfr:1.10, defaultEccentricSec:3 },
  ez_bar_curl:          { id:'ez_bar_curl', name:'EZ-Bar Curl',
    contributions:{ biceps:1.0, forearms:0.35 },
    axialLoad:0.10, loadedStretchIndex:1.10, sfr:1.20, defaultEccentricSec:2 },
  overhead_tricep_ext:  { id:'overhead_tricep_ext', name:'Overhead Cable Triceps Extension',
    contributions:{ triceps:1.0 },
    axialLoad:0.05, loadedStretchIndex:1.45, sfr:1.15, defaultEccentricSec:2.5 },
  tricep_pushdown:      { id:'tricep_pushdown', name:'Triceps Pushdown',
    contributions:{ triceps:1.0, forearms:0.15 },
    axialLoad:0.03, loadedStretchIndex:0.85, sfr:1.35, defaultEccentricSec:2 },
  standing_calf_raise:  { id:'standing_calf_raise', name:'Standing Calf Raise',
    contributions:{ calves:1.0 },
    axialLoad:0.20, loadedStretchIndex:1.35, sfr:1.25, defaultEccentricSec:2.5 },
  hanging_leg_raise:    { id:'hanging_leg_raise', name:'Hanging Leg Raise',
    contributions:{ abs:1.0, obliques:0.40, forearms:0.30 },
    axialLoad:0.05, loadedStretchIndex:1.20, sfr:1.25, defaultEccentricSec:2.5 },
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. SET MODEL
// ─────────────────────────────────────────────────────────────────────────────

export type SetType = 'warmup' | 'normal' | 'failure' | 'drop' | 'myorep' | 'cluster' | 'backoff' | 'amrap';

export interface LoggedSet {
  exerciseId: string;
  type: SetType;
  weightKg: number;
  reps: number;
  /** Reps in reserve. If the user logged RPE (6-10): rir = 10 - rpe. */
  rir?: number;
  eccentricSec?: number;
  dropSegments?: { weightKg: number; reps: number }[];
  at: number; // unix ms
}

/**
 *  - warmup: 10-15% of a working set. The single most important asymmetry in the model:
 *    four warm-up sets must never read as "trained".
 *  - failure: Vieira 2022 — recovery elongated 24-48h + higher sRPE. +18% structural AND
 *    tauStretch 1.30 (≈ +31h on the full ~3*tau quad recovery curve).
 *  - drop: Havers 2026 — RPE SMD 1.62, lactate SMD 0.67 => large metabolic surcharge,
 *    modest structural surcharge (tension falls as the weight drops).
 *  - cluster: intra-set rest clears metabolites => high tension, LOW metabolic cost.
 */
export const SET_TYPE: Record<SetType, { structural: number; metabolic: number; tauStretch: number; defaultRir: number; volumeCredit: number }> = {
  warmup:  { structural: 0.15, metabolic: 0.10, tauStretch: 1.00, defaultRir: 6, volumeCredit: 0.00 },
  normal:  { structural: 1.00, metabolic: 1.00, tauStretch: 1.00, defaultRir: 2, volumeCredit: 1.00 },
  backoff: { structural: 0.85, metabolic: 1.05, tauStretch: 1.00, defaultRir: 2, volumeCredit: 1.00 },
  amrap:   { structural: 1.15, metabolic: 1.30, tauStretch: 1.25, defaultRir: 0, volumeCredit: 1.00 },
  failure: { structural: 1.18, metabolic: 1.35, tauStretch: 1.30, defaultRir: 0, volumeCredit: 1.00 },
  drop:    { structural: 1.15, metabolic: 1.85, tauStretch: 1.22, defaultRir: 0, volumeCredit: 1.50 },
  myorep:  { structural: 1.20, metabolic: 1.70, tauStretch: 1.20, defaultRir: 0, volumeCredit: 1.50 },
  cluster: { structural: 1.05, metabolic: 0.75, tauStretch: 1.05, defaultRir: 1, volumeCredit: 1.25 },
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. e1RM (needed to know how HEAVY a set was relative to the user)
// ─────────────────────────────────────────────────────────────────────────────

export const epley   = (w: number, r: number) => w * (1 + r / 30);
export const brzycki = (w: number, r: number) => w / (1.0278 - 0.0278 * r);

/**
 * Weight-dependent e1RM fitted on 303,494 near-failure sets / 14,966 users / 388 exercises
 * (arXiv:2603.17495): 1RM = w * (1 + (r-1)^0.85 / (-2.55 + 4.58*ln w))
 * Reduced internal inconsistency 17-22% vs Epley/Brzycki/Lombardi/O'Conner on all 183
 * exercises with sufficient data. RIR-adjust first: effective reps = reps + rir.
 */
export function e1rm(weightKg: number, reps: number, rir = 0): number {
  const r = Math.max(1, reps + Math.max(0, rir));
  if (weightKg <= 0) return 0;
  const denom = -2.55 + 4.58 * Math.log(weightKg);
  if (denom <= 0.35) return epley(weightKg, r);
  const wd = weightKg * (1 + Math.pow(r - 1, 0.85) / denom);
  return r <= 3 ? 0.5 * wd + 0.5 * brzycki(weightKg, r) : wd;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. FATIGUE ACCRUAL FROM A LOGGED SET
// ─────────────────────────────────────────────────────────────────────────────

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Reference set = 1.0 Fatigue Unit: 8 reps @ 75% e1RM, RIR 1, contribution 1.0. */
const REF = { relIntensity: 0.75, reps: 8, rir: 1, ecc: 1.0 };
/** Loaded-stretch index of the reference movement (a typical barbell compound). */
const REF_STRETCH = 1.20;

function tensionTerm(relIntensity: number): number {
  // Mechanical tension per rep. Rises with load, saturates: MU recruitment is near
  // complete by ~80-85% 1RM, and near failure the last reps are maximal anyway.
  return clamp(0.42 + 0.78 * clamp(relIntensity, 0.15, 1.05), 0.42, 1.24);
}
function effortTerm(rir: number): number {
  // RIR0=1.00, 1=0.78, 2=0.61, 3=0.47, 4=0.37, 5=0.29, 6=0.22 — matches the strongly
  // non-linear fatigue-vs-RIR pattern (failure -25% velocity @4min, 1-RIR -13%, 3-RIR -8%).
  return Math.exp(-0.25 * clamp(rir, 0, 10));
}

const REF_TENSION = tensionTerm(REF.relIntensity);
const REF_EFFORT  = effortTerm(REF.rir);
const REF_STRUCT  = Math.pow(REF_TENSION, 1.8) * Math.pow(REF.reps, 0.55) * REF_EFFORT;
const REF_METAB   = Math.pow(REF_TENSION, 0.6) * Math.pow(REF.reps, 0.95) * Math.pow(REF_EFFORT, 1.2);

export interface FatigueDeposit {
  muscle: MuscleId; at: number;
  structural: number; metabolic: number;
  tauStructuralH: number; tauMetabolicH: number;
}
export interface SystemicDeposit { at: number; fast: number; slow: number; }

export interface AccrualContext {
  e1rmByExercise: Record<string, number>;
  /** 0..1 familiarity per muscle — drives the repeated-bout effect. 1 = fully adapted. */
  familiarity: Partial<Record<MuscleId, number>>;
  lastPerformed: Record<string, number>;
  /** Global multiplier on all recovery time constants from lifestyle. */
  tauScale: number;
}

export interface SetFatigueResult {
  deposits: FatigueDeposit[];
  systemic: SystemicDeposit;
  volumeCredit: Partial<Record<MuscleId, number>>;
  stimulatingReps: number;
}

export function accrueSet(set: LoggedSet, ctx: AccrualContext): SetFatigueResult {
  const ex = EXERCISES[set.exerciseId];
  if (!ex) throw new Error(`Unknown exercise ${set.exerciseId}`);
  const st = SET_TYPE[set.type];
  const rir = set.rir ?? st.defaultRir;
  const eccSec = set.eccentricSec ?? ex.defaultEccentricSec;

  const known = ctx.e1rmByExercise[set.exerciseId];
  const est = known && known > 0 ? known : e1rm(set.weightKg, set.reps, rir);
  const relIntensity = est > 0 ? set.weightKg / est : REF.relIntensity;
  const tension = tensionTerm(relIntensity);
  const effort  = effortTerm(rir);

  // Damage scales with (a) eccentric time under tension and (b) tension AT LONG LENGTH.
  // loadedStretchIndex is normalised against REF_STRETCH so the term is ~1.0 for an
  // average movement rather than inflating every exercise.
  const tempoEcc  = clamp(1 + 0.11 * (eccSec - 2), 0.80, 1.75);
  const eccFactor = tempoEcc * (ex.loadedStretchIndex / REF_STRETCH);

  // Each successive drop is on an already-fatigued muscle at a lower load: tension (and
  // damage) falls off fast, metabolite accumulation does not.
  let extraMetabolic = 0, extraStructural = 0;
  if (set.dropSegments?.length) {
    set.dropSegments.forEach((seg, i) => {
      const segRel = est > 0 ? seg.weightKg / est : 0.55;
      const segT = tensionTerm(segRel);
      const structAtten = Math.pow(0.45, i + 1);   // 0.45, 0.20, 0.09 ...
      const metabAtten  = Math.pow(0.85, i + 1);   // 0.85, 0.72, 0.61 ...
      extraStructural += structAtten * Math.pow(segT, 1.8) * Math.pow(Math.max(1, seg.reps), 0.55);
      extraMetabolic  += metabAtten  * Math.pow(segT, 0.6) * Math.pow(Math.max(1, seg.reps), 0.95);
    });
  }

  const baseStruct = (Math.pow(tension, 1.8) * Math.pow(Math.max(1, set.reps), 0.55) * effort + extraStructural) / REF_STRUCT;
  const baseMetab  = (Math.pow(tension, 0.6) * Math.pow(Math.max(1, set.reps), 0.95) * Math.pow(effort, 1.2) + extraMetabolic) / REF_METAB;

  const daysSinceExercise = ctx.lastPerformed[set.exerciseId]
    ? (set.at - ctx.lastPerformed[set.exerciseId]) / 86_400_000 : Infinity;
  // Nosaka & Clarkson: protection largest at first re-exposure, decays over weeks.
  const exerciseNovelty = daysSinceExercise === Infinity ? 1.0
    : clamp((daysSinceExercise - 14) / 70, 0, 1);     // 0 at <=14d, 1 at >=84d

  const deposits: FatigueDeposit[] = [];
  const volumeCredit: Partial<Record<MuscleId, number>> = {};
  let systemicSum = 0;

  for (const [mid, cRaw] of Object.entries(ex.contributions) as [MuscleId, number][]) {
    const m = MUSCLES[mid];
    const c = clamp(cRaw, 0, 1);

    const fam = clamp(ctx.familiarity[mid] ?? 0.15, 0, 1);
    const rbeMult = 1 + 0.60 * (1 - fam);
    // Movement novelty only adds damage ON TOP of muscle familiarity — for an unadapted
    // muscle the RBE term already covers it, so scale novelty by fam (protection is
    // largely muscle+movement specific) to avoid double-counting.
    const noveltyMult = 1 + 0.35 * exerciseNovelty * fam;

    // Type-II fibres take more structural damage per unit tension; type-I fibres are
    // markedly more fatigue-resistant metabolically (Johnson 1973 distributions).
    const fiberStruct = 1 + 0.006 * (50 - m.slowTwitchPct);  // triceps(33%)=>1.10, soleus(80%)=>0.82
    const fiberMetab  = 1 - 0.004 * (m.slowTwitchPct - 50);  // triceps=>1.07, soleus=>0.88

    const structural = c * baseStruct * st.structural * eccFactor *
                       m.eccentricSensitivity * fiberStruct * rbeMult * noveltyMult;
    const metabolic  = c * baseMetab * st.metabolic * fiberMetab;

    deposits.push({
      muscle: mid, at: set.at, structural, metabolic,
      tauStructuralH: m.tauStructuralH * st.tauStretch * ctx.tauScale,
      tauMetabolicH:  m.tauMetabolicH * ctx.tauScale,
    });
    volumeCredit[mid] = (volumeCredit[mid] ?? 0) + c * st.volumeCredit;
    systemicSum += structural * m.systemicShare;
  }

  // Systemic cost: axial load x structural spill x inverse SFR.
  // SYS_COEF calibrates a heavy squat set ≈ 1.0 systemic unit, a cable fly ≈ 0.05.
  const SYS_COEF = 0.22;
  const sysMagnitude = SYS_COEF * (0.35 + 0.95 * ex.axialLoad) * systemicSum / Math.max(0.5, ex.sfr);

  return {
    deposits,
    systemic: { at: set.at, fast: sysMagnitude, slow: sysMagnitude * 0.55 },
    volumeCredit,
    // Stimulating reps (RP heuristic): the last ~5 reps before failure.
    stimulatingReps: st.volumeCredit === 0 ? 0 : clamp(Math.min(set.reps, 5) - Math.max(0, rir - 1), 0, 5),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. DECAY + READINESS STATE
// ─────────────────────────────────────────────────────────────────────────────

const H = 3_600_000;

export interface LifestyleInputs {
  sleepHours?: number[];       // most recent first
  sleepNeed?: number;          // default 8
  stress?: number;             // 1..5, 3 = normal
  restingHr?: number;
  restingHrBaseline?: number;
  rmssdToday?: number;
  rmssd7dEwma?: number;
  lnRmssdBaselineMean?: number;
  lnRmssdBaselineSd?: number;
  soreness?: Partial<Record<MuscleId, number>>;  // 0..3 per muscle
  energyBalance?: number;      // -1 deficit .. +1 surplus
}

/**
 * Lifestyle does not just dock points — it slows the physiology. Craven 2022: acute
 * sleep loss barely hurts peak strength (-0.3%) but degrades work capacity and repeated
 * efforts, which is exactly a slower-recovery effect.
 */
export function recoveryTauScale(l: LifestyleInputs): number {
  const need = l.sleepNeed ?? 8;
  const nights = l.sleepHours ?? [];
  const debt = nights.slice(0, 3).reduce((a, h) => a + Math.max(0, need - h), 0);
  const stressPenalty = 0.05 * Math.max(0, (l.stress ?? 3) - 3);
  const dietPenalty = l.energyBalance !== undefined && l.energyBalance < 0 ? 0.12 * Math.abs(l.energyBalance) : 0;
  return clamp(1 + 0.055 * debt + stressPenalty + dietPenalty, 1.0, 1.55);
}

export interface ReadinessState { deposits: FatigueDeposit[]; systemic: SystemicDeposit[]; }

export interface MuscleReadiness {
  muscle: MuscleId;
  pct: number;                 // 0..100 chip value
  structural: number; metabolic: number;
  status: 'ready' | 'primed' | 'moderate' | 'fatigued' | 'not_ready';
  hoursToReady: number;        // hours until >=85%
  lastTrainedAt: number | null;
}

function decayed(d: FatigueDeposit, now: number) {
  const dt = Math.max(0, now - d.at) / H;
  return { s: d.structural * Math.exp(-dt / d.tauStructuralH), m: d.metabolic * Math.exp(-dt / d.tauMetabolicH) };
}

export function muscleFatigue(state: ReadinessState, muscle: MuscleId, now: number) {
  let s = 0, m = 0, last: number | null = null;
  for (const d of state.deposits) {
    if (d.muscle !== muscle || d.at > now) continue;
    const r = decayed(d, now); s += r.s; m += r.m;
    if (last === null || d.at > last) last = d.at;
  }
  return { structural: s, metabolic: m, lastTrainedAt: last };
}

/** Saturating map from raw FU to a 0..1 readiness deficit. tanh gives a soft ceiling so
 *  a brutal session lands ~15-20% readiness rather than going negative. */
const FU_SCALE = 4.8;
function deficit(fu: number, scale = FU_SCALE): number { return Math.tanh(fu / scale); }
/** Systemic fatigue saturates later — whole-body load is additive across many muscles. */
const SYS_SCALE = 5.0;

export function readinessForMuscle(
  state: ReadinessState, muscle: MuscleId, now: number, lifestyle: LifestyleInputs = {},
): MuscleReadiness {
  const f = muscleFatigue(state, muscle, now);
  let raw = 1 - (W_STRUCTURAL * deficit(f.structural) + W_METABOLIC * deficit(f.metabolic));

  // Self-reported soreness is a weak damage proxy but a strong USER-TRUST signal.
  // Capped at 12 points so a sore-but-recovered muscle is never hard-blocked.
  const sore = lifestyle.soreness?.[muscle];
  if (sore !== undefined) raw -= clamp(sore, 0, 3) * 0.04;

  const pct = clamp(Math.round(raw * 100), 0, 100);

  let hoursToReady = 0;
  if (pct < 85) {
    let t = 0;
    while (t < 168) {
      t += 1;
      const fut = muscleFatigue(state, muscle, now + t * H);
      const r = 1 - (W_STRUCTURAL * deficit(fut.structural) + W_METABOLIC * deficit(fut.metabolic));
      if (r >= 0.85) break;
    }
    hoursToReady = t;
  }

  const m = MUSCLES[muscle];
  if (f.lastTrainedAt !== null) {
    const sinceH = (now - f.lastTrainedAt) / H;
    if (sinceH < m.minRetrainH * 0.5 && pct > 70) {
      hoursToReady = Math.max(hoursToReady, m.minRetrainH * 0.5 - sinceH);
    }
  }

  const status: MuscleReadiness['status'] =
    pct >= 90 ? 'ready' : pct >= 78 ? 'primed' : pct >= 62 ? 'moderate' : pct >= 42 ? 'fatigued' : 'not_ready';

  return { muscle, pct, structural: f.structural, metabolic: f.metabolic, status, hoursToReady, lastTrainedAt: f.lastTrainedAt };
}

export function allMuscleReadiness(state: ReadinessState, now: number, lifestyle: LifestyleInputs = {}) {
  return ALL_MUSCLES.map(m => readinessForMuscle(state, m, now, lifestyle));
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. SYSTEMIC LOAD, CTL/ATL, UNCOUPLED ACWR
// ─────────────────────────────────────────────────────────────────────────────

export function systemicFatigue(state: ReadinessState, now: number): number {
  let fast = 0, slow = 0;
  for (const s of state.systemic) {
    if (s.at > now) continue;
    const dt = (now - s.at) / H;
    fast += s.fast * Math.exp(-dt / TAU_SYSTEMIC_FAST_H);
    slow += s.slow * Math.exp(-dt / TAU_SYSTEMIC_SLOW_H);
  }
  return deficit(W_SYS_FAST * fast + W_SYS_SLOW * slow, SYS_SCALE);
}

/** sRPE (Foster CR-10) x duration is the validated field standard; when the user gives no
 *  sRPE we synthesise it from the set-level model so both live on one scale. */
export function sessionLoad(sets: SetFatigueResult[], durationMin: number, sRpe?: number): number {
  if (sRpe !== undefined) return sRpe * durationMin;
  const totalFU = sets.reduce((a, s) => a + s.deposits.reduce((b, d) => b + d.structural + d.metabolic, 0), 0);
  return totalFU * 11 * clamp(durationMin / 60, 0.5, 2);   // 1 FU ≈ 11 AU·min at 60 min
}

/** TrainingPeaks EWMA form: today = yesterday + (load - yesterday)/tau. */
export function ewma(series: number[], tauDays: number, seed = 0): number {
  let v = seed;
  for (const x of series) v = v + (x - v) / tauDays;
  return v;
}

export interface LoadModel { ctl: number; atl: number; tsb: number; acwrUncoupled: number; }

/**
 * CTL = 42-day EWMA, ATL = 7-day EWMA, TSB = CTL - ATL (Banister/Coggan).
 * ACWR is UNCOUPLED (chronic window excludes the acute week) because Lolli 2019 and
 * Impellizzeri 2020 showed the conventional coupled ratio is mathematically coupled and
 * produces spurious correlations. We use it ONLY as a soft ramp modifier and never present
 * it as an injury-risk number.
 */
export function loadModel(dailyLoads: number[]): LoadModel {
  const ctl = ewma(dailyLoads, 42);
  const atl = ewma(dailyLoads, 7);
  const last7 = dailyLoads.slice(-7);
  const prior21 = dailyLoads.slice(-28, -7);
  const acute = last7.reduce((a, b) => a + b, 0) / Math.max(1, last7.length);
  const chronic = prior21.length ? prior21.reduce((a, b) => a + b, 0) / prior21.length : acute;
  return { ctl, atl, tsb: ctl - atl, acwrUncoupled: chronic > 0 ? acute / chronic : 1 };
}

/** Gabbett's 0.8-1.3 band, softened: full credit inside, gentle taper outside. */
export function rampTerm(acwr: number): number {
  if (acwr >= 0.8 && acwr <= 1.3) return 1.0;
  if (acwr < 0.8) return clamp(0.88 + 0.15 * acwr, 0.85, 1.0);
  return clamp(1.0 - 0.32 * (acwr - 1.3), 0.70, 1.0);
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. DAILY CAPACITY SCORE (0-100) + CONFIDENCE
// ─────────────────────────────────────────────────────────────────────────────

export type Confidence = 'low' | 'moderate' | 'good' | 'high';

export interface CapacityScore {
  score: number; confidence: Confidence; confidenceValue: number;
  headline: string; subline: string;
  drivers: { label: string; delta: number; connected: boolean }[];
  components: { systemic: number; muscular: number; ramp: number };
  modifiers: { hrv: number; rhr: number; sleep: number; subjective: number };
}

export function capacityScore(
  state: ReadinessState, now: number, dailyLoads: number[], lifestyle: LifestyleInputs = {},
): CapacityScore {
  const sys = 1 - systemicFatigue(state, now);
  const readiness = allMuscleReadiness(state, now, lifestyle);

  // Muscular term weighted by each muscle's share of adaptive volume, so quads/back/chest
  // dominate the score and tibialis does not.
  const wsum = ALL_MUSCLES.reduce((a, m) => a + MUSCLES[m].mavHigh, 0);
  const muscular = readiness.reduce((a, r) => a + (r.pct / 100) * MUSCLES[r.muscle].mavHigh, 0) / wsum;

  const lm = loadModel(dailyLoads);
  const ramp = rampTerm(lm.acwrUncoupled);

  // Base score with NO wearables: purely the training-log model. With no recent training
  // this legitimately returns 100 — which is why the reference screenshot shows 100 while
  // HRV / RHR / sleep all read "Not connected".
  const base = 100 * (0.50 * sys + 0.35 * muscular + 0.15 * ramp);

  const drivers: CapacityScore['drivers'] = [];
  let confidenceValue = 0.45;

  // HRV: Ln rMSSD z-score of the 7-day rolling mean vs a 60-day baseline (Plews).
  let hrvMod = 1;
  if (lifestyle.rmssd7dEwma && lifestyle.lnRmssdBaselineMean && lifestyle.lnRmssdBaselineSd) {
    const z = (Math.log(lifestyle.rmssd7dEwma) - lifestyle.lnRmssdBaselineMean) / Math.max(0.05, lifestyle.lnRmssdBaselineSd);
    hrvMod = clamp(1 + 0.055 * z, 0.80, 1.08);
    confidenceValue += 0.30;
    drivers.push({ label: 'HRV', delta: Math.round(base * (hrvMod - 1)), connected: true });
  } else drivers.push({ label: 'HRV', delta: 0, connected: false });

  // Resting HR: ~3.5% capacity per bpm above the user's OWN baseline, floored at -18%.
  let rhrMod = 1;
  if (lifestyle.restingHr && lifestyle.restingHrBaseline) {
    rhrMod = clamp(1 - 0.035 * (lifestyle.restingHr - lifestyle.restingHrBaseline), 0.82, 1.05);
    confidenceValue += 0.12;
    drivers.push({ label: 'Resting HR', delta: Math.round(base * (rhrMod - 1)), connected: true });
  } else drivers.push({ label: 'Resting HR', delta: 0, connected: false });

  // Sleep: 3-night debt. Deliberately modest here (Craven 2022) — the bigger sleep effect
  // is on recoveryTauScale.
  let sleepMod = 1;
  if (lifestyle.sleepHours?.length) {
    const need = lifestyle.sleepNeed ?? 8;
    const debt = lifestyle.sleepHours.slice(0, 3).reduce((a, h) => a + Math.max(0, need - h), 0);
    sleepMod = clamp(1 - 0.030 * debt, 0.80, 1.03);
    confidenceValue += 0.10;
    drivers.push({ label: 'Sleep', delta: Math.round(base * (sleepMod - 1)), connected: true });
  } else drivers.push({ label: 'Sleep', delta: 0, connected: false });

  // Subjective check-in — cheap, and better validated than most consumer recovery
  // algorithms, none of which have RCT evidence of superiority over "how do you feel".
  let subjMod = 1;
  if (lifestyle.stress !== undefined) {
    subjMod *= clamp(1 - 0.035 * (lifestyle.stress - 3), 0.88, 1.04);
    confidenceValue += 0.08;
  }

  const score = clamp(Math.round(base * hrvMod * rhrMod * sleepMod * subjMod), 0, 100);
  confidenceValue = clamp(confidenceValue, 0, 1);
  const confidence: Confidence =
    confidenceValue >= 0.85 ? 'high' : confidenceValue >= 0.68 ? 'good' : confidenceValue >= 0.55 ? 'moderate' : 'low';
  const { headline, subline } = capacityCopy(score, readiness, lm);

  return { score, confidence, confidenceValue, headline, subline, drivers,
    components: { systemic: sys, muscular, ramp },
    modifiers: { hrv: hrvMod, rhr: rhrMod, sleep: sleepMod, subjective: subjMod } };
}

function capacityCopy(score: number, readiness: MuscleReadiness[], lm: LoadModel) {
  const notReady = readiness.filter(r => r.pct < 78 && MUSCLES[r.muscle].mev > 0);
  if (score >= 88 && notReady.length === 0) return { headline: 'Good to go', subline: 'Strong recovery today' };
  if (score >= 88) return { headline: 'Good to go', subline: `Everything ready except ${notReady.slice(0,2).map(r => MUSCLES[r.muscle].label.toLowerCase()).join(' and ')}` };
  if (score >= 62) return { headline: 'Ready to train', subline: notReady.length ? `Go easy on ${MUSCLES[notReady[0].muscle].label.toLowerCase()}` : 'Solid capacity' };
  if (score >= 55) return { headline: 'Train light', subline: lm.acwrUncoupled > 1.4 ? 'You ramped up fast this week' : 'Carrying fatigue from recent sessions' };
  if (score >= 38) return { headline: 'Recovery day', subline: 'Technique work, cardio or mobility' };
  return { headline: 'Rest', subline: 'Deep fatigue — a full day off pays back more than a session' };
}

/** "All muscles ready" banner on the Progress tab. */
export function allMusclesReadyBanner(readiness: MuscleReadiness[]): { ready: boolean; text: string } {
  const trained = readiness.filter(r => MUSCLES[r.muscle].mev > 0 || r.lastTrainedAt !== null);
  const worst = trained.reduce((a, b) => (a.pct <= b.pct ? a : b), trained[0]);
  if (!worst || worst.pct >= 85) return { ready: true, text: 'All muscles ready' };
  const n = trained.filter(r => r.pct < 85).length;
  return { ready: false, text: `${n} muscle group${n > 1 ? 's' : ''} still recovering` };
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. WEEKLY VOLUME LANDMARKS
// ─────────────────────────────────────────────────────────────────────────────

export interface WeeklyVolume { sets: Partial<Record<MuscleId, number>>; }
export type VolumeZone = 'below_mv' | 'maintenance' | 'productive' | 'peak' | 'over_mrv';

export function volumeZone(muscle: MuscleId, sets: number): VolumeZone {
  const m = MUSCLES[muscle];
  if (sets < m.mv) return 'below_mv';
  if (sets < m.mev) return 'maintenance';
  if (sets < m.mavHigh) return 'productive';
  if (sets <= m.mrv) return 'peak';
  return 'over_mrv';
}

/** Mesocycle-aware target: ramp MEV -> MRV across accumulation, then deload to MV. */
export function weeklyTarget(muscle: MuscleId, week: number, blockLength = 5): number {
  const m = MUSCLES[muscle];
  if (week >= blockLength) return Math.round(m.mv);
  const t = (week - 1) / Math.max(1, blockLength - 2);
  return Math.round(m.mev + t * (m.mrv - m.mev) * 0.85);
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. RECOMMENDATION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export interface SplitProfile {
  /** Historical probability the user trains each muscle on each weekday (0=Sun..6=Sat). */
  weekdayAffinity: Partial<Record<MuscleId, number[]>>;
  sessionsPerWeek: number;
  templates: { id: string; name: string; muscles: MuscleId[] }[];
}

export interface Recommendation {
  date: string;
  sessionId: string | null;
  sessionName: string;
  muscles: { muscle: MuscleId; score: number; readiness: number; setsThisWeek: number; target: number; zone: VolumeZone }[];
  rationale: string[];
  intensityGuidance: 'full' | 'moderate' | 'light' | 'rest';
}

const gaussian = (x: number, mu: number, sigma: number) => Math.exp(-0.5 * Math.pow((x - mu) / sigma, 2));

export function scoreMuscleForToday(
  r: MuscleReadiness, setsThisWeek: number, target: number,
  weekday: number, split: SplitProfile, now: number,
): number {
  const m = MUSCLES[r.muscle];

  // 1. Readiness, super-linear: training a 55% muscle is much worse than an 85% one.
  const readinessTerm = Math.pow(r.pct / 100, 1.6);

  // 2. Volume deficit vs this week's target. Hard block above MRV.
  const zone = volumeZone(r.muscle, setsThisWeek);
  const deficitSets = target - setsThisWeek;
  const volumeTerm = zone === 'over_mrv' ? 0.08
    : deficitSets <= 0 ? 0.30
    : clamp(0.35 + 0.65 * (deficitSets / Math.max(2, target)), 0.35, 1.0);

  // 3. Staleness: peak desire at the muscle's OWN optimal re-train interval, derived from
  //    its structural tau (~1.9*tau) capped by its target frequency.
  const idealH = Math.min(m.tauStructuralH * 1.9, (7 * 24) / m.targetFrequency);
  const sinceH = r.lastTrainedAt === null ? idealH * 1.4 : (now - r.lastTrainedAt) / H;
  const stalenessTerm = 0.35 + 0.85 * gaussian(sinceH, idealH, idealH * 0.75);

  // 4. Habit: the user's own split matters more than a theoretically perfect one.
  const affinity = split.weekdayAffinity[r.muscle]?.[weekday] ?? 0.4;
  const habitTerm = 0.55 + 0.75 * clamp(affinity, 0, 1);

  return readinessTerm * volumeTerm * stalenessTerm * habitTerm;
}

export function recommend(
  state: ReadinessState, now: number, weekSets: WeeklyVolume, split: SplitProfile,
  dailyLoads: number[], mesoWeek = 1, lifestyle: LifestyleInputs = {},
): { today: Recommendation; tomorrow: Recommendation } {
  const cap = capacityScore(state, now, dailyLoads, lifestyle);

  const build = (at: number, projectedState: ReadinessState): Recommendation => {
    const weekday = new Date(at).getDay();
    const readiness = allMuscleReadiness(projectedState, at, lifestyle);
    const scored = readiness.map(r => {
      const sets = weekSets.sets[r.muscle] ?? 0;
      const target = weeklyTarget(r.muscle, mesoWeek);
      return { muscle: r.muscle, readiness: r.pct, setsThisWeek: sets, target,
               zone: volumeZone(r.muscle, sets),
               score: scoreMuscleForToday(r, sets, target, weekday, split, at) };
    }).sort((a, b) => b.score - a.score);

    let best: { id: string; name: string; muscles: MuscleId[] } | null = null, bestScore = -1;
    for (const t of split.templates) {
      const s = t.muscles.reduce((a, m) => a + (scored.find(x => x.muscle === m)?.score ?? 0), 0) / t.muscles.length;
      if (s > bestScore) { bestScore = s; best = t; }
    }

    const intensityGuidance: Recommendation['intensityGuidance'] =
      cap.score >= 80 ? 'full' : cap.score >= 62 ? 'moderate' : cap.score >= 45 ? 'light' : 'rest';

    const rationale: string[] = [];
    const top = scored.slice(0, 3);
    if (intensityGuidance === 'rest') {
      rationale.push(`Capacity ${cap.score}/100 — a rest day now protects the whole week.`);
    } else {
      rationale.push(`${MUSCLES[top[0].muscle].label} is ${top[0].readiness}% recovered and ${Math.max(0, top[0].target - top[0].setsThisWeek)} sets under target this week.`);
      const blocked = scored.filter(s => s.readiness < 62).slice(0, 2);
      if (blocked.length) rationale.push(`Avoid ${blocked.map(b => MUSCLES[b.muscle].label.toLowerCase()).join(' and ')} — still under 62% recovered.`);
      const overMrv = scored.filter(s => s.zone === 'over_mrv');
      if (overMrv.length) rationale.push(`${overMrv.map(o => MUSCLES[o.muscle].label).join(', ')} already past MRV this week — no more direct sets.`);
    }

    return {
      date: new Date(at).toISOString().slice(0, 10),
      sessionId: intensityGuidance === 'rest' ? null : best?.id ?? null,
      sessionName: intensityGuidance === 'rest' ? 'Rest day' : (best?.name ?? `${MUSCLES[top[0].muscle].label} focus`),
      muscles: scored.slice(0, 8), rationale, intensityGuidance,
    };
  };

  const today = build(now, state);

  // Project tomorrow: decay 24h AND simulate today's recommended session as a
  // median-volume block on each of its muscles, so "tomorrow" is a real plan.
  const projected: ReadinessState = { deposits: [...state.deposits], systemic: [...state.systemic] };
  if (today.sessionId) {
    const muscles = split.templates.find(t => t.id === today.sessionId)?.muscles
      ?? today.muscles.slice(0, 3).map(m => m.muscle);
    for (const mid of muscles) {
      const m = MUSCLES[mid];
      projected.deposits.push({ muscle: mid, at: now, structural: 3.2, metabolic: 2.6,
        tauStructuralH: m.tauStructuralH * recoveryTauScale(lifestyle),
        tauMetabolicH: m.tauMetabolicH * recoveryTauScale(lifestyle) });
      projected.systemic.push({ at: now, fast: 1.4 * m.systemicShare, slow: 0.8 * m.systemicShare });
    }
  }
  return { today, tomorrow: build(now + 24 * H, projected) };
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. COLD START + PERSONALISATION
// ─────────────────────────────────────────────────────────────────────────────

export interface UserCalibration {
  tauMultiplier: Partial<Record<MuscleId, number>>;
  observations: Partial<Record<MuscleId, number>>;
  familiarity: Partial<Record<MuscleId, number>>;
  sessionsLogged: number;
}

export function coldStart(experience: 'never' | 'beginner' | 'intermediate' | 'advanced'): UserCalibration {
  const fam = { never: 0.05, beginner: 0.20, intermediate: 0.55, advanced: 0.85 }[experience];
  // Untrained lifters take dramatically more damage from the same relative work and stay
  // sore longer (Damas: early-training MPS is dominated by damage repair). Lengthen tau,
  // then let feedback pull it back.
  const tauMul = { never: 1.30, beginner: 1.18, intermediate: 1.02, advanced: 0.94 }[experience];
  const out: UserCalibration = { tauMultiplier: {}, observations: {}, familiarity: {}, sessionsLogged: 0 };
  for (const m of ALL_MUSCLES) { out.tauMultiplier[m] = tauMul; out.observations[m] = 0; out.familiarity[m] = fam; }
  return out;
}

/** Day-0 UI contract: never show a fake precise number before there is any data. */
export function coldStartCapacity(cal: UserCalibration): CapacityScore | null {
  if (cal.sessionsLogged >= 2) return null;
  return {
    score: 100, confidence: 'low', confidenceValue: 0.25,
    headline: 'Ready when you are',
    subline: cal.sessionsLogged === 0 ? 'Log your first workout to start tracking recovery'
                                      : 'One more session and readiness goes live',
    drivers: [ { label:'HRV', delta:0, connected:false }, { label:'Resting HR', delta:0, connected:false }, { label:'Sleep', delta:0, connected:false } ],
    components: { systemic: 1, muscular: 1, ramp: 1 },
    modifiers: { hrv: 1, rhr: 1, sleep: 1, subjective: 1 },
  };
}

/**
 * Online personalisation. Two feedback channels:
 *  (a) soreness check-in at a known lag,
 *  (b) performance-on-repeat: reps achieved at the same load vs the model's prediction.
 * residual > 0 => user was MORE fatigued than predicted => lengthen tau.
 * Shrunk toward the population prior with k=6 pseudo-observations.
 */
export function updateCalibration(cal: UserCalibration, muscle: MuscleId, residual: number): UserCalibration {
  const n = (cal.observations[muscle] ?? 0) + 1;
  const prior = 1.0, k = 6;
  const step = Math.exp(0.10 * clamp(residual, -1, 1));
  const raw = (cal.tauMultiplier[muscle] ?? 1) * step;
  const shrunk = (n * raw + k * prior) / (n + k);
  return { ...cal,
    tauMultiplier: { ...cal.tauMultiplier, [muscle]: clamp(shrunk, 0.6, 1.6) },
    observations: { ...cal.observations, [muscle]: n } };
}

/** Familiarity grows with exposure and decays with layoff (detraining of the RBE). */
export function updateFamiliarity(cal: UserCalibration, muscle: MuscleId, daysSinceLast: number): number {
  const decay = Math.exp(-daysSinceLast / 120);   // RBE detectable up to ~24 weeks
  const cur = (cal.familiarity[muscle] ?? 0.15) * decay;
  return clamp(cur + (1 - cur) * 0.12, 0, 1);     // ~12% of the remaining gap per exposure
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. VERIFIED OUTPUT
// ─────────────────────────────────────────────────────────────────────────────
/*
Scenario: intermediate lifter, 20h after a hard leg day —
  2 warm-up squats, 140kg x6 @RIR2, 140x6 @RIR1, 140x5 to failure,
  RDL 110x10 @RIR2 x2 with 4s eccentrics, leg-extension drop set 70x12 -> 50x8 -> 35x7,
  2x calf raises. Sleep 7.5/8/6.5h (tauScale 1.11), soreness quads 2 / hams 2.

CAPACITY 70 moderate | "Ready to train - Go easy on lower back"
BANNER   6 muscle groups still recovering
READINESS (20h post):
  Quads         29%  not_ready  ready in 63h
  Hamstrings    45%  fatigued   ready in 53h
  Glutes        54%  fatigued   ready in 46h
  Lower back    61%  fatigued   ready in 43h
  Calves        81%  primed     ready in  6h
  Adductors     83%  primed     ready in  4h
  Forearms      91%  ready
  Traps         93%  ready
  Abs           96%  ready
WEEK SETS  quads 4.5, glutes 3.7, hamstrings 2.8, lower_back 2.6, calves 2.3,
           adductors 1.4, forearms 0.7, traps 0.6, abs 0.6
TODAY     Pull A  | moderate | "Lats is 100% recovered and 18 sets under target this week.
                               Avoid lower back and glutes — still under 62% recovered."
TOMORROW  Push A  | moderate | "Abs is 99% recovered and 13.4 sets under target this week."
72h projection quads: 81%   |   96h: 89%   |   calves at 28h: 87%

SANITY CHECKS
  warm-up-only chest readiness 2h later ....... 99%   (warm-ups must not read as "trained")
  no training + no wearables .................. 100 / low / "Good to go"
                                                (reproduces the reference screenshot:
                                                 score 100 while HRV/RHR/sleep "Not connected")
  cold start (beginner, 0 sessions) ........... 100 / low
                                                "Log your first workout to start tracking recovery"
*/

// ─────────────────────────────────────────────────────────────────────────────
// APPENDIX A — RP VOLUME LANDMARKS SOURCE TABLE (weekly hard sets)
// ─────────────────────────────────────────────────────────────────────────────
/*
  Muscle            MEV   MAV      MRV
  Chest              8    12-20    22+
  Back (width)       8    12-20    25+
  Back (thickness)   6    10-16    20+
  Side/rear delts    6    12-20    25+
  Front delts        0     0-6     12
  Biceps             6    10-16    20+
  Triceps            4     8-14    18+
  Quads              6    10-18    20+
  Hamstrings         4     8-14    16+
  Glutes             4     8-16    20+
  Calves             6    10-16    20+
  MV (maintenance) ≈ 6 sets/week for most muscles.
  (Table as published by RP-derived calculators; our MUSCLES constant nudges MEV up for
   chest/lats/quads to 8 to match RP's own muscle-specific guides.)
*/

// ─────────────────────────────────────────────────────────────────────────────
// REFERENCES
// ─────────────────────────────────────────────────────────────────────────────
/*
 [1]  MacDougall JD et al. The time course for elevated muscle protein synthesis following
      heavy resistance exercise. Can J Appl Physiol 1995;20(4):480-6. doi:10.1139/h95-038
      https://cdnsciencepub.com/doi/10.1139/h95-038
 [2]  Damas F, Phillips S, Vechin FC, Ugrinowitsch C. A review of resistance training-induced
      changes in skeletal muscle protein synthesis and their contribution to hypertrophy.
      Sports Med 2015;45(6):801-7. PMID 25739559
      https://link.springer.com/article/10.1007/s40279-015-0320-0
 [3]  Refalo MC et al. Influence of resistance training proximity-to-failure, determined by
      repetitions-in-reserve, on neuromuscular fatigue in resistance-trained males and
      females. Sports Med Open 2023. PMC9908800
      https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9908800/
 [4]  Refalo MC et al. The effect of resistance training proximity to failure on muscular
      adaptations and longitudinal fatigue in trained men. J Strength Cond (IUSCA) 2023.
      https://journal.iusca.org/index.php/Journal/article/download/393/507
 [5]  Havers T et al. Acute and chronic effects of drop-set training: a meta-analysis and
      systematic review. Sports Med Open 2026. PMC13043944
      https://pmc.ncbi.nlm.nih.gov/articles/PMC13043944/
 [6]  Nosaka K. Recent advances in the understanding of the repeated bout effect. PMID 12641640
      https://pubmed.ncbi.nlm.nih.gov/12641640/
 [7]  Hyldahl RD, Chen TC, Nosaka K. Mechanisms and mediators of the skeletal muscle repeated
      bout effect. Exerc Sport Sci Rev 2017.
 [8]  Johnson MA, Polgar J, Weightman D, Appleton D. Data on the distribution of fibre types
      in thirty-six human muscles. J Neurol Sci 1973;18(1):111-29
 [9]  Staron RS et al. Fiber type composition of the vastus lateralis muscle of young men and
      women. J Histochem Cytochem 2000;48(5):623-9
      https://journals.sagepub.com/doi/10.1177/002215540004800506
 [10] Banister EW et al. impulse-response model; Coggan/TrainingPeaks Performance Manager
      (CTL 42-day EWMA, ATL 7-day EWMA, TSB = CTL - ATL)
      https://www.trainingpeaks.com/learn/articles/the-science-of-the-performance-manager/
 [11] Haddad M, Stylianides G, Djaoui L, Dellal A, Chamari K. Session-RPE method for training
      load monitoring: validity, ecological usefulness, and influencing factors.
      Front Neurosci 2017;11:612. PMC5673663
 [12] Gabbett TJ. The training-injury prevention paradox: should athletes be training smarter
      and harder? Br J Sports Med 2016;50:273-80. PMID 26758673
 [13] Impellizzeri FM, Tenan MS, Kempton T, Novak A, Coutts AJ. Acute:chronic workload ratio:
      conceptual issues and fundamental pitfalls. Int J Sports Physiol Perform 2020;15(6):907-13
      https://journals.humankinetics.com/view/journals/ijspp/15/6/article-p907.xml
 [14] Lolli L et al. The acute-to-chronic workload ratio: an inaccurate scaling index for an
      unnecessary normalisation process? Br J Sports Med 2019
 [15] Schoenfeld BJ, Grgic J, Krieger J. How many times per week should a muscle be trained to
      maximize muscle hypertrophy? J Sports Sci 2019. PMID 30558493
 [16] Israetel M et al. Training volume landmarks for muscle growth. Renaissance Periodization.
      https://rpstrength.com/blogs/articles/training-volume-landmarks-muscle-growth
 [17] Craven J et al. Effects of acute sleep loss on physical performance: a systematic and
      meta-analytical review. Sports Med 2022;52:2669-2690. PMID 35708888
 [18] Plews DJ, Laursen PB, Stanley J, Kilding AE, Buchheit M. Training adaptation and HRV in
      elite endurance athletes: opening the door to effective monitoring. Sports Med 2013
      (Ln rMSSD 7-day rolling averages)
 [19] Javaloyes A, Sarabia JM, Lamberts RP, Moya-Ramon M. Training prescription guided by
      heart-rate variability in cycling. Int J Sports Physiol Perform 2018. PMID 29809080
 [20] Javaloyes A et al. Training prescription guided by HRV vs block periodization in
      well-trained cyclists. J Strength Cond Res 2020.
 [21] A weight-dependent 1RM prediction equation optimized on 303,494 near-failure sets across
      388 exercises. arXiv:2603.17495  https://arxiv.org/abs/2603.17495
 [22] Miller R et al. Validation of nocturnal resting heart rate and HRV in consumer wearables.
      PMC12367097 ; Cao R et al. WHOOP PPG validation, PMC8160717 ; Oura rMSSD, PMC11644394
 [23] Appropriateness of indirect markers of muscle damage following lower-limb eccentric-biased
      exercise: systematic review with meta-analysis. PLOS One 2022. PMC9282447
*/

## Risks

- The per-muscle tau values (20-40h) are inferred from fibre-type composition, upper-vs-lower-limb damage susceptibility and training-frequency research — no study directly measures a per-muscle-group recovery time constant, so these are defensible priors, not measured values. Ship the online personalisation (updateCalibration) from day one so real users pull them toward truth, and never present a tau as a fact in the UI.
- The capacity score has no outcome validation. Neither does Whoop's, Oura's or Garmin's — none has published an RCT showing its recovery score beats asking the user how they feel. Do not claim predictive validity in marketing; frame it as 'based on what you logged'.
- Fatigue Units are an internal scale with no physical meaning. If the set-type multipliers or FU_SCALE are tuned later, every historical readiness number silently changes. Version the constants and store the version on each deposit so old sessions replay against the constants they were scored with.
- Soreness self-report is capped at -12 points deliberately, which means the app will sometimes tell a visibly sore user they are ready. That is scientifically correct and commercially risky. Mitigate with copy ('sore is not the same as unrecovered') rather than by over-weighting soreness.
- The 'never trained before' cold start assigns familiarity 0.05 and a 1.30x tau, so a true beginner's first two weeks will show alarmingly low readiness. That matches the literature (untrained MPS is dominated by damage repair) but may read as discouraging — consider suppressing the numeric chip entirely for the first 2 sessions, which coldStartCapacity already supports.
- e1RM drives relative intensity, and relative intensity drives everything. On exercises where the user has never gone near failure, e1RM is estimated from the set itself, which biases relative intensity toward the reference 0.75 and flattens the model. Flag low-confidence e1RM per exercise and widen the readiness band shown for muscles dominated by those exercises.
- Exercise-to-muscle contribution coefficients are expert-assigned, not EMG-derived, and EMG amplitude is itself a poor proxy for hypertrophic stimulus. With 'every exercise in the world' in the library, the long tail will be auto-populated and noisy; build a review queue for any exercise whose contributions were inferred rather than authored.
