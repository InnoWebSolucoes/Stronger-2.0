# Stronger 2.0 — visual design system: verified dark/light token set, CVD-safe data-viz language, typography, motion, components and haptics

## Summary

I built and empirically verified a complete token system for Stronger 2.0, writing it to C:\Users\rafam\Stronger-2.0\design\tokens.css (drop-in CSS custom properties, dark default + light override + base rules) and C:\Users\rafam\Stronger-2.0\design\tokens.ts (typed source of truth including type scale, motion and a haptics map). Nothing in it is recalled: I wrote a Node script implementing the WCAG 2.1 relative-luminance formula and a Vienot/Brettel/Mollon dichromat simulator with CIELAB deltaE, and iterated the palette against measured output.

The colour system is a blue-tinted near-black base (#0B0F19) with a four-step surface ramp (#121725 to #2B3348) where elevation comes from lightness plus a 1px inset top highlight rather than shadows, because shadows do nothing on near-black. Text runs #F2F5FA (17.52:1), #A7B1C4 (8.87:1), #8A94A8 (6.28:1). Accents are disciplined: amber #F5A524 is the brand, blue #2A6FE0 is the only action fill (verified 4.72:1 with white; the obvious #2F80F5 measures 3.80 and was rejected), green #22C55E takes ink not white labels (#1FA95A + white measures 3.05 and was rejected), red #D6293E for destructive. PR/record deliberately gets no new hue - it is the one place amber appears as a solid fill, so a filled amber pill means exactly one thing in the product.

Three findings changed the design. First, the obvious green/red delta pair simulates to a deuteranopic deltaE of 0.4 - literally the same colour - so text deltas always carry a triangle glyph and a signed number, and graphic-only deltas use a luminance-separated pair at deltaE 30.9. Second, no 7-colour categorical palette survives CVD on dark (min deltaE 9.0 deutan); the system caps categorical series at four (#4C9DF0 / #FFC15E / #D46FB0 / #CBD5E6, verified 29.2 / 20.6 / 22.5). Third, the magma-derived muscle heat ramp stays strictly luminance-monotonic under deuteranopia (L* 9 to 93), which is why perceptually uniform ramps are the only defensible body-map encoding.

Typography is Inter Variable v4 for UI with cv05 and cv08 enabled to kill the 1/l/I collision, plus Archivo Variable held at wdth 112 for exactly three display uses. Tabular figures are mandatory on every column, live counter, chart label and numeric input, and proportional in prose. Motion maps to Material 3's easing tokens with five sanctioned moments and a linear rest timer, since an eased countdown misrepresents remaining time. The deliverable also includes full component specs, an iconography rule (Lucide at 1.75 stroke, tab labels never removed), a haptics table budgeted around set-completion firing ~50 times per session, and a 15-row "AI slop tell to professional alternative" table.

## Findings

### WHOOP's semantic-colour discipline is the model to copy, and its exact recovery hexes are public

WHOOP assigns green #16EC06 (67-100% recovery), yellow #FFDE00 (34-66%), red #FF0026 (0-33%), blue #0093E7 for Strain, and #7BA1BB for Sleep, on a background gradient of #283339 → #101518. Critically, no hue is used decoratively — every colour carries functional meaning. Our palette adopts the discipline but not the values: #16EC06 is a fully-saturated neon that blooms on OLED and clips in sRGB photography; we use #22C55E/#4ADE8B instead, which measure 8.4:1 and 11.05:1 on our base and stay stable under scaling.

Source: https://developer.whoop.com/assets/files/WHOOP%20-%20Brand%20&%20Design%20Guidelines-bdea3554e94b4ea09e68695b1e8dc8e7.pdf , https://www.925studios.co/blog/whoop-design-breakdown

### Green-vs-red for gain/loss is literally invisible to deuteranopes at typical dark-UI brightness

I ran a Viénot/Brettel/Mollon dichromat simulation with CIELAB ΔE on the obvious pairing: #4ADE8B (positive) vs #FF8A93 (negative) simulates to a deuteranopic ΔE of 0.4 — the same colour. Protanopic ΔE is 27.2, so it only fails for deuteranopia, which is the most common CVD type (~6% of men). Fix: text deltas keep the high-contrast pair but ALWAYS carry a ▲/▼ glyph and a signed number; graphic-only deltas (bar fills, sparkline segments) use #5FE39B / #E5484D, whose deutan ΔE is 30.9 because they differ in luminance (L* 78 vs 62), not just hue.

Source: Computed: Viénot 1999 LMS dichromat simulation + CIE76 ΔE, script at scratchpad/cvd.js

### A 7-colour categorical palette cannot be made colour-blind safe on a dark background

Dark-tuned Okabe-Ito with 7 series measured min ΔE of 15.3 (protan), 9.0 (deutan), 6.0 (tritan) — two of three fail outright. Cutting to 4 and re-tuning gave #4C9DF0 / #FFC15E / #D46FB0 / #CBD5E6 at 29.2 / 20.6 / 22.5, passing all three above the ΔE>20 screening threshold. The design rule that follows is hard: the system has exactly four categorical colours, and any chart needing more (e.g. a 10-muscle training split) must use a sequential ramp with direct labels instead of a legend.

Source: Computed; Okabe-Ito baseline from https://jfly.uni-koeln.de/color/ ; deltaE threshold convention per Coloring in R's Blind Spot, arXiv:2303.04918

### Perceptually uniform ramps (magma/viridis/cividis) are the only body-map encoding that survives CVD

Cividis was purpose-built so protanopes and deuteranopes see essentially what trichromats see (Nuñez, Anderton & Renslow, PLOS ONE 2018, doi:10.1371/journal.pone.0199239). I derived the muscle-load ramp from magma and verified it: deutan-simulated L* runs 9→16→27→40→53→69→81→93, strictly monotonic, so a fully colour-blind user still reads intensity correctly. The light-theme inversion (#FBE3C8 → #2C1F4A) is equally monotonic at 0.796→0.020 relative luminance.

Source: https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0199239 ; computed simulation

### The obvious vivid blue for a primary button fails WCAG AA and most teams never check

#2F80F5 with a white label measures 3.80:1 — below the 4.5:1 AA threshold for a 15-17px button label. Walking the blue ramp: #2B74E0 = 4.49 (misses by 0.01), #2A6FE0 = 4.72 ✓, #1F63D6 = 5.51 ✓. #2A6FE0 is the brightest compliant option and still measures 3.79:1 against surface-1, satisfying WCAG 1.4.11 for the button's own boundary. Same trap on green: #1FA95A + white = 3.05 ✗, which is why green fills in this system take ink (#04140A on #22C55E = 8.31 ✓), not white.

Source: Computed per WCAG 2.1 relative-luminance formula

### Inter v4 has specific character variants that fix the 1/l/I collision that plagues weight logging

Inter v4 ships cv01-cv13 and ss01-ss08 plus tnum, zero and three variable axes (wght 100-900, wdth 75-125, opsz 14-32). cv05 (lowercase l with a tail) and cv08 (uppercase I with serifs) are the two that matter for a strength app, where strings like '1 x 12 lb' and 'Incline' appear at 13px. Slashed zero (`zero`) is available but should stay OFF — it reads as an engineering tool. This is a 4-token CSS change with outsized legibility return.

Source: https://rsms.me/inter/ , https://en.wikipedia.org/wiki/Inter_(typeface)

### Archivo is the right second face and it is OFL-licensed and variable

Archivo (Héctor Gatti / Omnibus-Type, SIL OFL 1.1, released 2012, variable since 2021) carries wght, wdth (62-125) and opsz axes across 641 glyphs and 200+ languages. Held at wdth 112 it gives hero numerals a scoreboard/grotesque presence that Inter alone cannot, while remaining free and self-hostable. Restricting it to three uses (hero metrics, rank name, finish headline) is what keeps the pairing from looking like a template.

Source: https://fonts.google.com/specimen/Archivo , https://www.omnibus-type.com/variable-fonts/

### Material 3's motion tokens give citable duration and easing values; only three curves are needed

Emphasized = cubic-bezier(0.2, 0.0, 0, 1.0); emphasized-decelerate = cubic-bezier(0.05, 0.7, 0.1, 1.0); emphasized-accelerate = cubic-bezier(0.3, 0.0, 0.8, 0.15). Duration tokens run short1-4 (50/100/150/200ms), medium1-4 (250/300/350/400ms), long1-2 (450/500ms). Our scale maps onto these: micro 120, short 180, standard 240, emphasized 320, long 420. The one deliberate deviation is the rest timer, which must use linear easing — an eased countdown misrepresents remaining time, which in a training app is a correctness bug, not a taste question.

Source: https://m3.material.io/styles/motion/easing-and-duration/tokens-specs

### Set completion fires roughly 50 times per session, which dictates the haptic budget

iOS offers .light/.medium/.heavy/.soft/.rigid impacts plus .success/.warning/.error notifications, and Apple explicitly recommends calling prepare() ahead of the event to avoid Taptic Engine latency. Because a 12-exercise, 4-set workout produces ~48 set-completion taps, that event must be .light; anything heavier causes users to disable haptics globally and lose the PR feedback too. Reserve .heavy + .success exclusively for a personal record, which fires 0-3 times per session.

Source: https://developer.apple.com/documentation/uikit/uiimpactfeedbackgenerator

### Pure black backgrounds and pure white text are a measurable defect, not a style choice

#FFFFFF on #000000 is 21:1, which produces halation (text edges bleeding) on OLED and forces users to squint in low light. The current consensus is a zinc/blue-tinted near-black around #09090B-#121212 with text at #FAFAFA rather than #FFFFFF. Our values: base #0B0F19 with text #F2F5FA measures 17.52:1 — comfortably above AA and AAA while eliminating the bloom. The blue tint (hue ~222) also makes the amber accent read warmer by simultaneous contrast, which is free brand equity.

Source: https://muz.li/blog/dark-mode-design-systems-a-complete-guide-to-patterns-tokens-and-hierarchy/ , https://uxmagic.ai/blog/dark-mode-ui-design-guide

### On dark surfaces, elevation must come from lightness plus a 1px inner highlight, not shadows

A drop shadow is a darkening operation; on a #0B0F19 canvas there is almost nothing left to darken, so shadowed cards read flat. The professional solution, visible in Linear, Arc and Vercel's UI, is a four-step surface ramp (#121725 → #1A2032 → #222A3D → #2B3348, each ~1.1x relative luminance) combined with `inset 0 1px 0 0 rgba(255,255,255,.045)` simulating a top light source. Shadows are then reserved for genuinely floating layers (sheets, menus, the rest-timer pill), where they do real work.

Source: Derived from measured luminance steps; pattern observed across Linear/Arc/Vercel dark UIs

### Rank tiers must never be encoded by colour alone, and the data says exactly why

The 5-tier ramp #7C8AA0 → #4E9BE0 → #2FB98C → #F7B23B → #FFE3A3 measures min ΔE 28.5 (protan) and 23.2 (deutan) — safe — but only 5.4 under tritanopia, where the blue/teal pair collapses. Rather than compromise the ramp (tritan-safe ordinal ramps force muddy mid-tones), the fix is redundancy: every rank badge carries the tier name in text AND 1-5 filled pips. Deutan-simulated L* of the ramp is 57→60→64→80→92, so the ordering itself still reads correctly with no colour perception at all.

Source: Computed dichromat simulation

### Tabular figures are non-negotiable and survive font-fallback

font-variant-numeric: tabular-nums forces uniform digit advance widths so a Reps column does not jitter between 8 and 11. Inter, Roboto, SF Pro and Segoe UI Variable all ship tabular sets, so the rule holds even if the webfont fails to load. The rule must be applied consistently — mixing tabular and proportional figures in one view is worse than using neither. Our split: tnum on every column, live counter, chart label and numeric input; proportional in prose sentences.

Source: https://www.carmenansio.com/articles/opentype-features-css/ , https://dev.to/alanwest/tabular-numbers-in-css-font-variant-numeric-vs-monospace-hacks-25cn

## Recommendations

- Import design/tokens.css once at the app root and forbid any hex literal elsewhere in the codebase — add a lint rule that fails on /#[0-9a-fA-F]{3,8}/ outside design/.

## Data

## FILES WRITTEN
- `C:\Users\rafam\Stronger-2.0\design\tokens.css` — drop-in CSS custom-property theme (dark default + light override + base rules)
- `C:\Users\rafam\Stronger-2.0\design\tokens.ts` — typed source of truth (same values, plus type scale, motion, haptics map)

---

# 1. `tokens.css` (complete, verbatim)

```css
/* ============================================================================
   STRONGER 2.0 — DESIGN TOKENS
   Every colour pair was verified with a WCAG 2.1 relative-luminance calculator
   and a Vienot/Brettel/Mollon dichromat simulator. Ratios are measured.
   Layer 1 = primitives (never referenced by components)
   Layer 2 = semantic aliases (the ONLY thing components may use)
   ========================================================================= */

:root {
  /* ---------- 1. PRIMITIVES: neutral ramp (blue-tinted, hue ~222) -------- */
  --n-1000:#070A11; --n-975:#0B0F19; --n-950:#121725; --n-900:#1A2032;
  --n-850:#222A3D;  --n-800:#2B3348; --n-750:#36405A; --n-700:#4C5872;
  --n-600:#626E85;  --n-500:#7A8599; --n-400:#8A94A8; --n-300:#A7B1C4;
  --n-200:#C6CEDC;  --n-150:#DDE3EC; --n-100:#EDF0F6; --n-75:#F4F6FA;
  --n-50:#FFFFFF;

  /* ---------- 1. PRIMITIVES: amber (brand) ------------------------------ */
  --amber-200:#FFE3A3; --amber-300:#FFC15E; --amber-400:#F7B23B;
  --amber-500:#F5A524; --amber-600:#D98613; --amber-700:#B26A00;
  --amber-800:#8A5000; --amber-900:#5A3505;

  /* ---------- 1. PRIMITIVES: blue (action) ------------------------------ */
  --blue-200:#B9D6FF; --blue-300:#6FB0FF; --blue-400:#4C9DF0;
  --blue-500:#2A6FE0; --blue-600:#1F63D6; --blue-700:#1257C9;
  --blue-800:#0E3F92;

  /* ---------- 1. PRIMITIVES: green (ready / positive) ------------------- */
  --green-200:#A9F0C8; --green-300:#5FE39B; --green-400:#4ADE8B;
  --green-500:#22C55E; --green-600:#1FA95A; --green-700:#0F7A43;
  --green-800:#0A5730;

  /* ---------- 1. PRIMITIVES: red (regression / destructive) ------------- */
  --red-200:#FFC4C9; --red-300:#FF8A93; --red-400:#E5484D;
  --red-500:#D6293E; --red-600:#BE2438; --red-700:#9B1C2D;

  /* ---------- 1. PRIMITIVES: rank tiers --------------------------------- */
  /* Luminance-monotonic slate -> blue -> teal -> amber -> gold.
     Verified CVD-safe: min deltaE protan 28.5 / deutan 23.2.
     Tritan is weak (5.4) -> rank is NEVER encoded by colour alone; the badge
     always carries the tier name AND 1-5 filled pips.                     */
  --tier-1:#7C8AA0; --tier-2:#4E9BE0; --tier-3:#2FB98C;
  --tier-4:#F7B23B; --tier-5:#FFE3A3;

  /* ---------- 2. SEMANTIC — DARK THEME (default) ------------------------ */
  color-scheme: dark;

  --bg-canvas:        var(--n-1000); /* behind sheets, status-bar bleed     */
  --bg-app:           var(--n-975);  /* screen background                   */
  --surface-1:        var(--n-950);  /* cards, list rows                    */
  --surface-2:        var(--n-900);  /* inputs, nested cards, set rows      */
  --surface-3:        var(--n-850);  /* sheets, popovers, active segment    */
  --surface-4:        var(--n-800);  /* menus, tooltips, toasts             */
  --surface-sunken:   #0E1320;       /* wells, chart plot areas             */
  --surface-scrim:    rgba(4,7,13,.72);

  /* 1px inner top highlight = "raised" on dark. Use INSTEAD of a shadow on
     cards. Single most important dark-mode detail.                        */
  --edge-highlight:   inset 0 1px 0 0 rgba(255,255,255,.045);

  --fg-primary:       #F2F5FA; /* 17.52:1 on bg-app, 16.35:1 on surface-1  */
  --fg-secondary:     #A7B1C4; /*  8.87:1 on bg-app,  8.28:1 on surface-1  */
  --fg-tertiary:      #8A94A8; /*  6.28:1 on bg-app,  4.69:1 on surface-3  */
  --fg-disabled:      #5C6679; /* disabled controls / non-text glyphs only */
  --fg-on-accent:     #120C02; /* ink on amber fill = 9.53:1               */
  --fg-on-action:     #FFFFFF; /* white on blue-500  = 4.72:1              */
  --fg-inverse:       #0B0F19;

  --border-subtle:      #1C2333;
  --border-default:     #252E41;
  --border-strong:      #36405A;
  --border-interactive: #626E85; /* 3.48:1 on surface-1 (WCAG 1.4.11)      */
  --border-focus:       #6FB0FF;

  --accent-brand:        var(--amber-500); /* 9.38:1 on bg-app             */
  --accent-brand-text:   var(--amber-300); /* 11.89:1 on bg-app            */
  --accent-brand-weak:   rgba(245,165,36,.14);
  --accent-brand-border: rgba(245,165,36,.32);

  --action-fill:       var(--blue-500);  /* white 4.72:1, 3.79:1 vs surf-1 */
  --action-fill-hover: #3479EC;
  --action-fill-press: #205CC4;
  --action-text:       var(--blue-300);  /* 8.51:1 on bg-app               */
  --action-weak:       rgba(42,111,224,.16);

  --positive-text:   var(--green-400);  /* 11.05:1 — ALWAYS with ▲ + sign  */
  --positive-fill:   var(--green-500);  /* ink label 8.31:1                */
  --positive-weak:   rgba(34,197,94,.15);
  --negative-text:   var(--red-300);    /*  8.49:1 — ALWAYS with ▼ + sign  */
  --negative-fill:   var(--red-500);    /* white label 4.95:1              */
  --negative-weak:   rgba(214,41,62,.16);
  --warning-text:    var(--amber-300);
  --warning-fill:    var(--amber-500);
  --warning-weak:    rgba(245,165,36,.14);

  /* PR / personal record. Deliberately NOT a new hue: a record IS the brand
     moment. The ONE place amber is a solid fill, so a filled amber pill
     means exactly one thing in the entire product.                       */
  --record-fill:   var(--amber-300);
  --record-fg:     #171004;   /* 11.72:1 */
  --record-border: var(--amber-500);
  --record-glow:   0 0 0 1px rgba(245,165,36,.45), 0 4px 16px rgba(245,165,36,.18);

  --ready-full:    var(--green-400); /* >= 90% recovered */
  --ready-partial: var(--amber-400); /* 50-89%           */
  --ready-low:     var(--red-400);   /* < 50%            */
  --ready-rest:    var(--n-600);     /* untrained / n/a  */

  /* ---------- 3. DATA VISUALISATION ------------------------------------- */
  /* Categorical: MAX 4 SERIES. Verified min deltaE protan 29.2 /
     deutan 20.6 / tritan 22.5. Past 4 categories switch to a sequential
     ramp with direct labels — a 5th categorical colour does not exist.   */
  --viz-cat-1:#4C9DF0; --viz-cat-2:#FFC15E;
  --viz-cat-3:#D46FB0; --viz-cat-4:#CBD5E6;

  /* Directional deltas drawn as pure graphics (no sign glyph present).
     Separated by LUMINANCE so they survive deuteranopia: deltaE 30.9.    */
  --viz-up:#5FE39B; --viz-down:#E5484D; --viz-flat:#7A8599;

  /* Muscle-load heat ramp (magma-derived, perceptually uniform).
     Deutan-simulated L*: 9-16-27-40-53-69-81-93 = strictly monotonic.    */
  --heat-0:#232B3D; /* muscle silhouette, untrained */
  --heat-1:#2C1F4A; --heat-2:#5A2465; --heat-3:#8E2F63; --heat-4:#C24A53;
  --heat-5:#EE7F4E; --heat-6:#FCB562; --heat-7:#FFE6A8;

  /* Training-consistency / activity heatmap (single-hue amber, 6 steps). */
  --act-0:#151B29; --act-1:#43300F; --act-2:#6E4C0F;
  --act-3:#A5731A; --act-4:#D89A24; --act-5:#FFC15E;

  --viz-grid:#1E2637;
  --viz-axis:#2A3346;
  --viz-label:var(--fg-tertiary);
  --viz-track:var(--surface-3);
  --viz-band:rgba(76,157,240,.12);
  --viz-projection:rgba(167,177,196,.5);
  --viz-area-top:rgba(245,165,36,.22);
  --viz-area-bottom:rgba(245,165,36,0);

  /* ---------- 4. TYPOGRAPHY --------------------------------------------- */
  --font-ui:'Inter Variable','Inter',-apple-system,'SF Pro Text',
            'Segoe UI Variable Text','Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
  --font-display:'Archivo Variable','Archivo','Inter Variable',
            -apple-system,'SF Pro Display','Segoe UI Variable Display',Roboto,sans-serif;
  --font-mono:ui-monospace,'SF Mono','JetBrains Mono','Cascadia Mono',
            'Roboto Mono',Menlo,Consolas,monospace;

  /* Inter v4: cv05 = l with tail, cv08 = I with serif (kills the 1/l/I
     collision in "1 x 12 lb"), ss03 = round quotes. Slashed zero OFF —
     it reads engineering, not athletic.                                  */
  --font-features-ui:'cv05' 1,'cv08' 1,'ss03' 1,'calt' 1;

  --fs-display-xl:56px; --lh-display-xl:56px; --ls-display-xl:-0.030em;
  --fs-display-l:44px;  --lh-display-l:44px;  --ls-display-l:-0.028em;
  --fs-display-m:34px;  --lh-display-m:36px;  --ls-display-m:-0.022em;
  --fs-display-s:28px;  --lh-display-s:32px;  --ls-display-s:-0.018em;
  --fs-title-l:22px;    --lh-title-l:28px;    --ls-title-l:-0.012em;
  --fs-title-m:19px;    --lh-title-m:24px;    --ls-title-m:-0.008em;
  --fs-title-s:17px;    --lh-title-s:22px;    --ls-title-s:-0.004em;
  --fs-body-l:16px;     --lh-body-l:24px;     --ls-body-l:0;
  --fs-body-m:15px;     --lh-body-m:22px;     --ls-body-m:0;
  --fs-body-s:13px;     --lh-body-s:18px;     --ls-body-s:0.004em;
  --fs-label-l:15px;    --lh-label-l:20px;    --ls-label-l:0;
  --fs-label-m:13px;    --lh-label-m:16px;    --ls-label-m:0.010em;
  --fs-label-s:11px;    --lh-label-s:14px;    --ls-label-s:0.060em; /* UPPER */
  --fs-num-l:20px;      --lh-num-l:24px;
  --fs-num-m:17px;      --lh-num-m:20px;
  --fs-num-s:13px;      --lh-num-s:16px;
  --fs-mono-s:12px;     --lh-mono-s:16px;

  --fw-regular:450; --fw-medium:520; --fw-semibold:600;
  --fw-bold:680;    --fw-black:800;
  --wdth-display:112; /* Archivo width axis for hero numerals (range 62-125) */

  /* ---------- 5. SPACING (4px base) ------------------------------------- */
  --sp-0:0;     --sp-1:2px;  --sp-2:4px;  --sp-3:6px;  --sp-4:8px;
  --sp-5:10px;  --sp-6:12px; --sp-7:16px; --sp-8:20px; --sp-9:24px;
  --sp-10:32px; --sp-11:40px; --sp-12:48px; --sp-13:64px; --sp-14:80px;

  --gutter:16px;       --gutter-wide:24px;
  --card-pad:14px;     --card-pad-lg:16px;
  --row-h:44px;        --row-h-set:48px;
  --tabbar-h:56px;     --appbar-h:52px;
  --stack-gap:10px;    --section-gap:28px;

  /* ---------- 6. RADIUS ------------------------------------------------- */
  --r-xs:4px;  --r-sm:6px;   --r-md:8px;   --r-lg:12px;
  --r-xl:16px; --r-2xl:20px; --r-3xl:28px; --r-pill:999px;
  /* Nesting rule: inner radius = outer radius - padding. */

  /* ---------- 7. ELEVATION ---------------------------------------------- */
  --shadow-0:none;
  --shadow-1:0 1px 2px rgba(0,0,0,.36);
  --shadow-2:0 4px 12px rgba(0,0,0,.44), 0 1px 2px rgba(0,0,0,.32);
  --shadow-3:0 12px 32px rgba(0,0,0,.52), 0 2px 6px rgba(0,0,0,.36);
  --shadow-4:0 24px 64px rgba(0,0,0,.60), 0 4px 12px rgba(0,0,0,.40);
  --ring-focus:0 0 0 2px var(--bg-app), 0 0 0 4px var(--border-focus);

  /* ---------- 8. MOTION ------------------------------------------------- */
  --dur-instant:0ms;
  --dur-micro:120ms;      /* press states, checkbox fill        */
  --dur-short:180ms;      /* chips, tooltips, crossfades        */
  --dur-standard:240ms;   /* sheets, expand/collapse            */
  --dur-emphasized:320ms; /* screen transitions, summary tiles  */
  --dur-long:420ms;       /* ring fill on first paint           */
  --dur-celebrate:700ms;  /* PR burst — fires once, never loops */

  --ease-standard:cubic-bezier(.2,0,0,1);
  --ease-decelerate:cubic-bezier(.05,.7,.1,1);
  --ease-accelerate:cubic-bezier(.3,0,.8,.15);
  --ease-linear:linear;                        /* timers ONLY   */
  --ease-spring:cubic-bezier(.34,1.42,.64,1);  /* set complete  */
  --stagger:60ms;

  /* ---------- 9. Z-INDEX ------------------------------------------------ */
  --z-base:0; --z-sticky:10; --z-tabbar:20; --z-resttimer:30;
  --z-sheet:40; --z-menu:50; --z-toast:60; --z-modal:70;
}

/* =========================== LIGHT THEME ================================ */
:root[data-theme="light"] {
  color-scheme: light;

  --bg-canvas:#EDF0F6; --bg-app:#F4F6FA;
  --surface-1:#FFFFFF; --surface-2:#EDF0F6; --surface-3:#E3E8F1;
  --surface-4:#FFFFFF; --surface-sunken:#EAEEF5;
  --surface-scrim:rgba(11,15,25,.44);
  --edge-highlight:none;

  --fg-primary:#0B0F19;   /* 19.15:1 on surface-1 */
  --fg-secondary:#465163; /*  8.02:1 */
  --fg-tertiary:#667184;  /*  4.93:1 */
  --fg-disabled:#98A1B2;
  --fg-on-accent:#241703; --fg-on-action:#FFFFFF; --fg-inverse:#F2F5FA;

  --border-subtle:#E6EAF2; --border-default:#D6DCE8;
  --border-strong:#B9C2D2; --border-interactive:#7B8699; /* 3.68:1 on white */
  --border-focus:#1257C9;

  --accent-brand:var(--amber-700);
  --accent-brand-text:var(--amber-800);   /* 6.51:1 on white */
  --accent-brand-weak:rgba(245,165,36,.16);
  --accent-brand-border:rgba(178,106,0,.34);

  --action-fill:var(--blue-700);          /* white label 6.50:1 */
  --action-fill-hover:#0F4EB4; --action-fill-press:#0C4099;
  --action-text:var(--blue-700); --action-weak:rgba(18,87,201,.10);

  --positive-text:var(--green-700);       /* 5.41:1 */
  --positive-fill:var(--green-700); --positive-weak:rgba(15,122,67,.12);
  --negative-text:var(--red-600);         /* 6.00:1 */
  --negative-fill:var(--red-600);   --negative-weak:rgba(190,36,56,.10);
  --warning-text:var(--amber-800);
  --warning-fill:var(--amber-700);  --warning-weak:rgba(178,106,0,.12);

  --record-fill:var(--amber-500); --record-fg:#1A1206;  /* 9.08:1 */
  --record-border:var(--amber-700);
  --record-glow:0 0 0 1px rgba(178,106,0,.40), 0 4px 16px rgba(245,165,36,.28);

  --ready-full:var(--green-700); --ready-partial:var(--amber-700);
  --ready-low:var(--red-600);    --ready-rest:#7B8699;

  --tier-1:#7A8496; --tier-2:#2E71B8; --tier-3:#0E7150;
  --tier-4:#8A5000; --tier-5:#6B4A05;  /* 3.77 / 5.04 / 6.01 / 6.51 / 8.06 */

  --viz-cat-1:#1E6FA8; --viz-cat-2:#B5730B;
  --viz-cat-3:#A44B86; --viz-cat-4:#5B6779;
  --viz-up:#0F7A43; --viz-down:#BE2438; --viz-flat:#7B8699;

  /* Sequential ramps invert: on light, dark = high value. */
  --heat-0:#DCE2EC;
  --heat-1:#FBE3C8; --heat-2:#F8BE86; --heat-3:#F0864F; --heat-4:#D2504F;
  --heat-5:#9E2F63; --heat-6:#5F2465; --heat-7:#2C1F4A;

  --act-0:#ECEFF4; --act-1:#FBE8C6; --act-2:#F6CE87;
  --act-3:#EDAE44; --act-4:#D18A15; --act-5:#9A6100;

  --viz-grid:#E9EDF4; --viz-axis:#D6DCE8; --viz-track:#E3E8F1;
  --viz-band:rgba(18,87,201,.10); --viz-projection:rgba(70,81,99,.45);
  --viz-area-top:rgba(178,106,0,.20); --viz-area-bottom:rgba(178,106,0,0);

  --shadow-1:0 1px 2px rgba(11,15,25,.06);
  --shadow-2:0 4px 12px rgba(11,15,25,.08), 0 1px 2px rgba(11,15,25,.05);
  --shadow-3:0 12px 32px rgba(11,15,25,.12), 0 2px 6px rgba(11,15,25,.06);
  --shadow-4:0 24px 64px rgba(11,15,25,.16), 0 4px 12px rgba(11,15,25,.08);
}

/* ================================ BASE ================================== */
html { -webkit-text-size-adjust:100%; }

body {
  margin:0; background:var(--bg-app); color:var(--fg-primary);
  font-family:var(--font-ui); font-size:var(--fs-body-m);
  line-height:var(--lh-body-m); font-weight:var(--fw-regular);
  font-feature-settings:var(--font-features-ui);
  -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility;
}

/* THE NUMERAL RULE — every digit that sits in a column, ticks live, or will
   be compared to another digit uses tabular figures. Prose numbers
   ("3 exercises") stay proportional. Apply via class, never ad hoc. */
.tnum, .stat-value, .set-row, .data-table, .metric, .timer, .chart-label,
input[inputmode="decimal"], input[inputmode="numeric"] {
  font-variant-numeric: tabular-nums;
  font-feature-settings: var(--font-features-ui), 'tnum' 1;
}

.display-metric {
  font-family: var(--font-display);
  font-variation-settings: 'wght' 700, 'wdth' var(--wdth-display);
  font-variant-numeric: tabular-nums;
  font-size: var(--fs-display-m); line-height: var(--lh-display-m);
  letter-spacing: var(--ls-display-m);
}

.eyebrow {
  font-size: var(--fs-label-s); line-height: var(--lh-label-s);
  letter-spacing: var(--ls-label-s); font-weight: var(--fw-bold);
  text-transform: uppercase; color: var(--fg-tertiary);
}

.card {
  background: var(--surface-1);
  border: 1px solid var(--border-subtle);
  border-radius: var(--r-lg);
  box-shadow: var(--edge-highlight);
  padding: var(--card-pad);
}

:focus-visible { outline:none; box-shadow:var(--ring-focus); border-radius:var(--r-sm); }

@media (prefers-reduced-motion: reduce) {
  :root { --dur-micro:0ms; --dur-short:0ms; --dur-standard:0ms;
          --dur-emphasized:0ms; --dur-long:0ms; --dur-celebrate:0ms; }
  *,*::before,*::after { animation-duration:.01ms!important;
    animation-iteration-count:1!important; transition-duration:.01ms!important;
    scroll-behavior:auto!important; }
}
```

---

# 2. Measured contrast table (WCAG 2.1, computed not guessed)

### Dark theme — text on surfaces
| token | hex | bg-app #0B0F19 | surface-1 #121725 | surface-2 #1A2032 | surface-3 #222A3D | surface-4 #2B3348 |
|---|---|---|---|---|---|---|
| fg-primary | #F2F5FA | 17.52 | 16.35 | 14.82 | 13.10 | 11.51 |
| fg-secondary | #A7B1C4 | 8.87 | 8.28 | 7.50 | 6.63 | 5.83 |
| fg-tertiary | #8A94A8 | 6.28 | 5.86 | 5.31 | 4.69 | 4.12 ⚠ |
| fg-disabled | #5C6679 | 3.31 | 3.09 | 2.80 | 2.48 | 2.17 |
| accent-brand-text #FFC15E | | 11.89 | 11.10 | 10.06 | 8.89 | 7.81 |
| accent-brand #F5A524 | | 9.38 | 8.76 | 7.94 | 7.02 | 6.16 |
| action-text #6FB0FF | | 8.51 | 7.94 | 7.20 | 6.36 | 5.59 |
| positive-text #4ADE8B | | 11.05 | 10.31 | 9.34 | 8.26 | 7.25 |
| negative-text #FF8A93 | | 8.49 | 7.92 | 7.18 | 6.35 | 5.57 |

⚠ = `fg-tertiary` on `surface-4` is 4.12 — only allowed at ≥18.66px or ≥14px bold. Use `fg-secondary` inside menus/tooltips.

### Dark theme — filled controls
| fill | label | ratio | fill vs surface-1 (needs ≥3.0) |
|---|---|---|---|
| action #2A6FE0 | #FFFFFF | **4.72** ✓ | 3.79 ✓ |
| brand/record #F5A524 | #120C02 | **9.53** ✓ | 8.76 ✓ |
| record #FFC15E | #171004 | **11.72** ✓ | 11.10 ✓ |
| positive #22C55E | #04140A | **8.31** ✓ | 7.84 ✓ |
| negative #D6293E | #FFFFFF | **4.95** ✓ | 3.61 ✓ |
| neutral #222A3D | #F2F5FA | **13.10** ✓ | 1.05 (needs 1px border) |
| border-interactive #626E85 | — | — | 3.48 ✓ (WCAG 1.4.11) |

Rejected during testing: `#2F80F5` + white = 3.80 ✗; `#1FA95A` + white = 3.05 ✗ (hence green fills take ink, not white).

### Light theme
| token | hex | on #FFFFFF | on #EDF0F6 |
|---|---|---|---|
| fg-primary #0B0F19 | | 19.15 | 16.78 |
| fg-secondary #465163 | | 8.02 | 7.03 |
| fg-tertiary #667184 | | 4.93 | 4.32 |
| brand text #8A5000 | | 6.51 | 5.70 |
| action #1257C9 (fill, white label) | | 6.50 | — |
| positive #0F7A43 | | 5.41 | 4.73 |
| negative #BE2438 | | 6.00 | 5.26 |
| border-interactive #7B8699 | | 3.68 | 3.22 |
| record fill #F5A524 + #1A1206 | | 9.08 | — |

### Rank tier ramp (dark)
| tier | hex | vs surface-1 | rel. luminance |
|---|---|---|---|
| Beginner | #7C8AA0 | 5.11 | .250 |
| Novice | #4E9BE0 | 6.03 | .304 |
| Intermediate | #2FB98C | 7.18 | .372 |
| Advanced | #F7B23B | 9.69 | .519 |
| Elite | #FFE3A3 | 14.27 | .788 |

Light: #7A8496 (3.77), #2E71B8 (5.04), #0E7150 (6.01), #8A5000 (6.51), #6B4A05 (8.06).

---

# 3. Colour-vision-deficiency verification (Viénot/Brettel/Mollon sim + CIELAB ΔE)

| palette | protan | deutan | tritan | verdict |
|---|---|---|---|---|
| Rank tiers (5) | ΔE 28.5 | ΔE 23.2 | ΔE 5.4 | safe for p/d; tritan covered by label + pips |
| Categorical 4 `#4C9DF0 #FFC15E #D46FB0 #CBD5E6` | **29.2** | **20.6** | **22.5** | **passes all three** |
| Naïve dark Okabe-Ito 7 | 15.3 | **9.0** | **6.0** | FAILS — do not use 7 series |
| Blue/amber/teal/pink 4 | 29.3 | 17.8 | 8.2 | fails tritan |
| pos `#4ADE8B` + neg `#FF8A93` | 27.2 | **0.4** | — | **invisible to deuteranopes** → text only, with ▲▼ + sign |
| viz-up `#5FE39B` + viz-down `#E5484D` | 41.7 | **30.9** | — | safe for graphic-only deltas |

Deutan-simulated L* of the muscle heat ramp: **9 → 16 → 27 → 40 → 53 → 69 → 81 → 93** (strictly monotonic — the ramp reads correctly with zero colour perception).

Deutan-simulated L* of the rank ramp: **57 → 60 → 64 → 80 → 92** (monotonic).

---

# 4. Type scale (exact)

| role | family | px | line-height | tracking | weight | tnum |
|---|---|---|---|---|---|---|
| display-xl | Archivo wdth 112 | 56 | 56 | −0.030em | 700 | yes |
| display-l | Archivo wdth 112 | 44 | 44 | −0.028em | 700 | yes |
| display-m | Archivo wdth 112 | 34 | 36 | −0.022em | 700 | yes |
| display-s | Archivo wdth 112 | 28 | 32 | −0.018em | 700 | yes |
| title-l | Inter | 22 | 28 | −0.012em | 680 | no |
| title-m | Inter | 19 | 24 | −0.008em | 600 | no |
| title-s | Inter | 17 | 22 | −0.004em | 600 | no |
| body-l | Inter | 16 | 24 | 0 | 450 | no |
| body-m | Inter | 15 | 22 | 0 | 450 | no |
| body-s | Inter | 13 | 18 | +0.004em | 450 | no |
| label-l | Inter | 15 | 20 | 0 | 520 | no |
| label-m | Inter | 13 | 16 | +0.010em | 520 | no |
| label-s (UPPERCASE eyebrow) | Inter | 11 | 14 | +0.060em | 680 | no |
| num-l | Inter | 20 | 24 | −0.006em | 600 | **yes** |
| num-m (set row reps/kg) | Inter | 17 | 20 | −0.004em | 600 | **yes** |
| num-s (Previous column) | Inter | 13 | 16 | 0 | 520 | **yes** |
| mono-s | ui-monospace | 12 | 16 | 0 | 450 | yes |

**Typefaces.** UI = **Inter Variable v4** (rsms.me/inter, SIL OFL; axes `wght` 100–900, `wdth` 75–125, `opsz` 14–32). Display numerals = **Archivo Variable** (Omnibus-Type, SIL OFL, 2021 variable release; `wght`, `wdth` 62–125, `opsz`) held at `wdth 112` — a slightly expanded grotesque that reads stadium-scoreboard, used for exactly three things: hero metric numbers, the rank name, and the finish-summary headline. Everything else is Inter. Two families, no more.

**Feature settings.** `font-feature-settings: 'cv05' 1, 'cv08' 1, 'ss03' 1, 'calt' 1` — `cv05` gives lowercase *l* a tail and `cv08` gives uppercase *I* serifs, which kills the `1 / l / I` collision that is everywhere in "1 x 12 lb". Slashed zero (`zero`) is deliberately **off**: it reads as engineering-tool, not athletic.

**The numeral rule.** `font-variant-numeric: tabular-nums` on: every set-row cell, every stat tile value, the live duration/volume/exercise counters, chart axis and tooltip labels, the Previous column, bodyweight entries, the e1RM cards, the percentile numbers, and every numeric input. **Not** on prose ("You trained 4 times this week") — proportional figures read better in a sentence. All three system fallbacks (SF Pro, Segoe UI Variable, Roboto) ship tabular sets, so the rule survives a font-load failure.

---

# 5. Data-visualisation language

**Sparkline** (e1RM cards, exercise list) — 64×28 to 96×32, stroke 1.5px, `--action-text` for neutral / `--viz-up` / `--viz-down` by trend of the last 3 points. Area fill = linear-gradient `--viz-area-top → --viz-area-bottom`. No axis, no grid, no dots except a 3px filled terminal dot at the last value. Monotone-cubic interpolation, never Bezier smoothing that overshoots real data. Minimum 4 points or render a "—" instead.

**Activity heatmap** (Profile, ~26 weeks; Bodyweight tracking-consistency) — 11×11px cells, 3px gap, 2px radius, 6-step `--act-*` ramp bucketed by *volume quintile* not by raw kg. `--act-0` for empty. Today gets a 1px `--border-interactive` ring, never a fill. Column labels = month initial only when the month changes, `label-s`. Legend: "Less ▢▢▢▢▢ More" at 9px — this is the one place a legend earns its keep.

**Bodyweight chart** — 2px monotone-cubic line in `--accent-brand`, 3 horizontal gridlines at `--viz-grid`, y-labels right-aligned tnum in `--viz-label`. 7-day EMA overlay: 1px `--fg-tertiary` solid. Projection: 1px dashed `--viz-projection`, dash 3/3. Points render only on scrub; scrub shows a 1px vertical `--border-strong` rule plus a tnum value chip on `--surface-4`. Range selector 1M/3M/6M/1Y/All = segmented control, never a dropdown.

**Distribution curve** (percentile vs other users) — kernel-density area at `--viz-band`, 1px `--border-strong` outline. The user's position is a 2px `--accent-brand` vertical rule from baseline to curve, capped with a 6px dot, and a left/right-flipping label "Top 20%". Shade only the region the user beats — one filled region, not a gradient across the whole curve.

**Progress / rank rings** — stroke 8px at Ø44–96, 10px at Ø120+, `stroke-linecap: round`, track `--viz-track`, start angle −90°, clockwise. Value arc uses the tier colour. **No gradient** on the arc except Elite, which gets a single 12° hue sweep from `--amber-300` to `--amber-200` — so a gradient itself signals "top tier". Centre holds one display-m number plus one label-s eyebrow, nothing else.

**Muscle body map** — front/back SVG silhouettes, base muscle fill `--heat-0`, 1px `--border-strong` separators between muscle polygons, heat applied from `--heat-1..7` bucketed on 7-day tonnage per muscle normalised to the user's own trailing 90-day max (not to a global max — global normalisation makes every beginner's map black). Untargeted muscles stay `--heat-0`, never blank. Tap any muscle → tnum percentage + sets count. Community-post renders use the same SVG exported at 2x.

**Global chart rules** — no 3D, no donut with more than 4 slices, no dual y-axes ever, zero baseline on every bar chart, y-axis may be non-zero on line charts only if the axis is explicitly labelled. Chart title is a `label-m` above-left, never centred.

---

# 6. Motion

| duration | ms | use |
|---|---|---|
| micro | 120 | press/active states, checkbox fill, chip toggle |
| short | 180 | tooltip, crossfade, rest-timer chip appear |
| standard | 240 | bottom sheet, accordion expand, exercise block insert |
| emphasized | 320 | screen push, finish-summary tile reveal |
| long | 420 | ring fill on first paint of Progress |
| celebrate | 700 | PR burst, once |

Easing: `standard cubic-bezier(.2,0,0,1)` · `decelerate cubic-bezier(.05,.7,.1,1)` (enters) · `accelerate cubic-bezier(.3,0,.8,.15)` (exits) · `spring cubic-bezier(.34,1.42,.64,1)` · `linear` for timers only.

**Motion that earns its place**
1. *Set completed* — checkmark path draws over 180ms `decelerate`; row background fades to `--positive-weak` over 120ms; row scales 0.97→1.0 with `spring`. Total 180ms. It confirms the tap without stealing the thumb.
2. *Rest timer* — ring drains **linear**, because easing would lie about remaining time. Last 5 seconds: the numeral steps up one weight and the ring colour crossfades to `--warning-fill` over 180ms per second.
3. *PR* — the set row's amber border sweeps once (700ms, `standard`), the PB pill scales in with `spring`, one haptic. No confetti, no loop, no sound.
4. *Finish summary* — tiles reveal bottom-up with 60ms stagger, 320ms `decelerate`, translateY 12px → 0 + opacity. The volume number counts up over 900ms with an ease-out on the *value*, not the element. This is the only count-up in the product.
5. *Sheet present* — 240ms `decelerate` up, 200ms `accelerate` down; scrim fades over the same window.

**Motion that is noise — banned**
List-item entrance animations on every scroll; parallax headers; skeleton shimmer looping more than twice (use a static `--surface-2` block after that); animated number count-ups anywhere except the finish summary; scale-on-page-transition; hover lift on touch targets; spinning loaders longer than 400ms (switch to a determinate bar); anything animating on the Log tab's first paint, which must feel instant.

---

# 7. Iconography

**Set: Lucide** (ISC licence, ~1,600 icons, consistent 24×24 grid, tree-shakeable). Stroke `1.75` at 24px, `1.5` at 20px, `1.5` at 16px — Lucide's default of 2 is too heavy against a near-black background, where strokes optically bloom. Sizes: **16** (inline with body-s, chip affordances), **20** (list rows, set-row controls, app bar), **24** (tab bar, primary actions). Nothing else.

Icon colour follows text colour, never its own hue, with three exceptions: the tab-bar active icon (`--accent-brand`), the done-check (`--positive-fill`), the record trophy (`--record-fg` on `--record-fill`).

**When an icon may replace a label:** only if all three hold — (a) it is in the universal twelve (close, back, chevron, search, plus, more/overflow, check, play, pause, settings, share, trash); (b) it sits in a persistent, learnable location (app bar, tab bar, row end); (c) it carries an `aria-label`/`accessibilityLabel`. Everything else keeps a label: swap, rest timer, set type, superset, warm-up, RPE, drop set. Tab-bar items **always** show their label — icon-only tab bars are a top-three cause of a product feeling anonymous.

**Emoji are never iconography.** They may appear only inside user-authored community text. The one sanctioned exception is the equivalence line in the finish summary, where a small illustrated glyph set (ambulance, piano, elephant, grand piano) is *commissioned line art in the Lucide stroke weight*, not 🚑.

---

# 8. Component specs

**Stat tile** — `--surface-1`, `--r-lg`, padding 14, `--edge-highlight`. Eyebrow (label-s uppercase, `--fg-tertiary`) → value (num-l or display-s, tnum, `--fg-primary`) → delta row (body-s, `--positive-text`/`--negative-text`, prefixed with ▲/▼ *and* a signed number). Unit sits inline after the value at label-m weight 520 in `--fg-tertiary`, never superscript. Min height 84. In a 2-up grid, gap 10.

**Workout history card** — `--surface-1`, `--r-lg`, padding 14, 1px `--border-subtle`. Row 1: title (title-s) + date (body-s `--fg-tertiary`), right-aligned repeat icon-button 32×32. Row 2: muscle chips, horizontally scrolling, max 4 visible then "+2". Row 3: three tnum metrics separated by a 1px × 12px `--border-default` divider — `12 exercises · 4,820 kg · 148 reps`. PB pill absolutely positioned top-right of row 1 when present. Whole card is one tap target; the repeat button is the only nested one, with a 44px hit slop.

**Set row** — height 48, grid `40px | 68px | 1fr | 1fr | 44px | 44px` = Set · Previous · Reps · KG · RPE · ✓. Background `--surface-2` normally, `--positive-weak` when complete with the numerals dropping to `--fg-secondary`. Set-type is shown *in the Set column*: `1` normal, `W` in `--warning-text`, `D` in `--action-text`, `F` in `--negative-text`, `M` for myo-rep — a letter, not a coloured dot, because the letter survives every CVD type. Previous column: num-s, `--fg-tertiary`, format `80 kg × 8`. Inputs are borderless, `--surface-2`, num-m tnum, centred, `inputMode="decimal"`. The ✓ is a 28×28 rounded square, `--border-interactive` outline when open, `--positive-fill` + ink glyph when done. Swipe-left reveals a `--negative-fill` delete at 72px.

**Muscle chip** — height 24, `--r-pill`, padding 0 10, label-m, `--surface-2` bg + `--fg-secondary` text at rest; when it doubles as a readiness indicator, a 6px dot in `--ready-*` leads the label and the label states the percentage.

**Segmented control** — height 34, `--surface-2` track, `--r-md`, 2px inset padding. Active segment `--surface-3` (dark) / `#FFFFFF` (light) with `--shadow-1`, `--r-sm`, label-l weight 600 `--fg-primary`; inactive weight 520 `--fg-tertiary`. Thumb slides 240ms `standard`. Max 5 segments; 6+ becomes a scrolling chip rail.

**Tab bar** — height 56 + `env(safe-area-inset-bottom)`, `--surface-1` with a 1px `--border-subtle` top hairline and a `backdrop-filter: blur(20px)` over `rgba(18,23,37,.86)`. Icon 24 + label-s (not uppercase here, 10px, weight 600). Active: icon and label `--accent-brand`. No pill, no background on the active item, no bounce.

**Rank ring** — Ø128, stroke 10, track `--viz-track`. Centre: tier name (title-m, tier colour), sub-rank roman numeral (display-s tnum), and "5.2 pts to Novice III" (body-s `--fg-tertiary`). Five pips below the ring, filled to the current tier in the tier colour, unfilled `--border-strong` — this is the redundancy that makes rank readable without colour.

**Buttons**
- *Primary*: `--action-fill`, `--fg-on-action`, height 48 (44 compact), `--r-md`, label-l weight 600. Press: `--action-fill-press` + scale .98 over 120ms. The "Start workout" CTA is the only full-bleed primary in the product.
- *Brand*: `--accent-brand` fill + `--fg-on-accent`. Reserved for Finish and for PR acknowledgement. Two instances max per screen.
- *Secondary*: transparent, 1px `--border-interactive`, `--fg-primary`. Hover/press fills `--surface-2`.
- *Tertiary / text*: `--action-text`, no border, 44px hit area.
- *Destructive*: `--negative-fill` + white, and it always sits behind a confirm for anything with logged sets.
- Disabled: `--surface-2` bg, `--fg-disabled` label, no opacity fade on the whole button (opacity fades wreck the label's contrast unpredictably).

**Empty states** — a 1px-stroke line illustration at 96×96 in `--border-strong` (never a 3D render, never an emoji), a title-m headline that states the situation in the user's terms ("No sets logged yet"), one body-m line of consequence, one primary button. Max 3 elements. The Progress tab's empty state shows the *real* chart chrome with a "3 more workouts to unlock trends" overlay rather than a blank card — showing the shape of the future is worth more than an apology.

---

# 9. Haptics map

| event | iOS | Android |
|---|---|---|
| Set completed | `UIImpactFeedbackGenerator(.light)` | `HapticFeedbackConstants.CONFIRM` |
| Set un-completed | `UISelectionFeedbackGenerator` | `CLOCK_TICK` |
| Set type changed (W/D/F) | `UISelectionFeedbackGenerator` | `CLOCK_TICK` |
| Rest timer started | `.soft` | `CONTEXT_CLICK` |
| Rest timer final 5s (1/sec) | `.soft` | `CLOCK_TICK` |
| Rest timer finished | `UINotificationFeedbackGenerator(.success)` | `CONFIRM` + system sound |
| **Personal record** | `.heavy` then `.success` 80ms later | `LONG_PRESS` + `CONFIRM` |
| Workout started | `.medium` | `CONFIRM` |
| Workout finished | `.success` | `CONFIRM` |
| Exercise added | `.light` | `CONFIRM` |
| Exercise deleted | `.medium` | `REJECT` |
| Destructive confirm shown | `.warning` | `REJECT` |
| Invalid input | `.error` | `REJECT` |
| Segmented control | `UISelectionFeedbackGenerator` | `CLOCK_TICK` |
| Pull-to-refresh armed | `.rigid` | `GESTURE_THRESHOLD_ACTIVATE` |
| Progress photo captured | `.rigid` | `CONTEXT_CLICK` |

**No haptic on:** scrolling, tab switching, chart scrubbing, digit entry on the numeric keypad, any list-item tap that navigates. Prepare the generator on `touchDown` per Apple's guidance so the Taptic Engine is warm. Set completion fires ~50× per session, which is why it stays `.light` — anything heavier turns the wrist numb and users disable haptics entirely. Honour the system reduce-motion/haptics setting and expose an in-app toggle in Profile → Preferences.

---

# 10. "Looks AI-generated" → the professional alternative

| tell | why it reads as slop | do this instead |
|---|---|---|
| Purple→blue gradient on the hero / buttons / headings | It is the default of every template. It also breaks contrast, because the ratio changes across the fill. | One flat `--action-fill`. Gradients appear in exactly two places in this product: the sparkline area fade and the Elite ring. |
| Glassmorphism on cards | Blur over a dark background destroys text contrast and costs a compositing layer per card. | `backdrop-filter` only on the tab bar and the sticky active-workout header. Cards use `--surface-1` + `--edge-highlight`. |
| Emoji as icons (💪🔥🏆) | No optical alignment, renders differently per platform, ages instantly. | Lucide at 1.75 stroke, plus commissioned line art for the volume-equivalence objects. |
| Six unrelated accent hues | Colour stops meaning anything. | Four semantic colours, and a capped 4-colour categorical set. Amber-as-fill means "record" and nothing else. |
| Centred hero with a giant rounded card and 64px of padding | Wastes the most valuable pixels; real athletic apps are dense. | Left-aligned, 16px gutter, 10px between cards, information on line one. |
| Every corner at 24px radius | Blobby, toy-like, and it makes nested elements impossible to align. | Radius scales with the element: 6 chips, 8 buttons/inputs, 12 cards, 16 sheets. Inner radius = outer − padding. |
| Drop shadows on a dark background | Shadows are invisible on near-black; the result is a flat mush. | Elevation by surface lightness (`--surface-1..4`) + a 1px top inner highlight. Shadows only for genuinely floating layers. |
| Pure `#000` background with pure `#FFF` text | 21:1 causes halation and ghosting on OLED; the UI looks cheap. | `#0B0F19` base, `#F2F5FA` text at 17.5:1. |
| Proportional figures in numeric columns | Digits jitter as reps change; instantly reads "prototype". | `tabular-nums` on every column, counter and axis. |
| Animating everything (list entrances, count-ups, page scale) | Motion without meaning; makes the app feel slow after the third session. | Five sanctioned moments (set complete, rest timer, PR, finish reveal, sheets). Everything else is instant. |
| Lorem-ipsum-shaped microcopy: "Track your fitness journey!" | Generic, exclamatory, says nothing. | State facts: "4,820 kg · 148 reps · 58 min". "Chest is 62% recovered — ready Thursday." |
| Stock-photo or 3D-render empty states | Instantly identifiable as filler. | 1px line illustration in `--border-strong`, or show the real chart chrome greyed with a concrete unlock condition. |
| Full-width gradient progress bars with a shine sweep | Decorative animation over a number people actually read. | Flat fill, tnum number adjacent, no sweep. |
| A rainbow legend on the muscle map | Encodes an ordinal quantity as unordered colour. | Perceptually-uniform magma ramp, monotonic under deuteranopia, with a two-stop legend and on-tap percentages. |
| Centred, all-caps, letter-spaced 32px headings | Poster typography in a data product. | title-l at 22/28 with −0.012em tracking, left aligned. Uppercase is reserved for 11px eyebrows. |


## Risks

- Archivo's tabular-figure support was not confirmed by a primary source — verify with `otfinfo -f Archivo[wdth,wght].ttf | grep tnum` before shipping hero numerals; if tnum is absent, fall back to Inter at wght 800 for display metrics rather than accepting jittering digits.
- The muscle heat ramp is magma-derived and therefore runs through magenta/purple, which is unusual for a fitness app and may read as 'injury' to some users in testing — validate the semantic reading before launch; the fallback is a single-hue amber ramp (--act-*) which is safer but carries less dynamic range.
- The 4-colour categorical cap will collide with the training-split breakdown, which naturally has 8-12 muscle groups; that view must be designed as a sorted horizontal bar chart with direct labels in a single hue, not a pie or a multi-series chart, or the CVD guarantee is void.
- fg-tertiary (#8A94A8) measures 4.12:1 on surface-4, below AA for small text — menus, tooltips and toasts must use fg-secondary, and this is easy to get wrong because it passes everywhere else.
- Two webfonts (Inter Variable + Archivo Variable) is ~180-260KB subset; on a cold mobile load this will cause FOUT on the hero metric unless both are preloaded with font-display: optional and the Archivo subset is restricted to digits, punctuation and Latin caps.
- prefers-color-scheme handling in tokens.css currently has an empty media block as a placeholder — the light values must be code-generated into it from tokens.ts at build time, or system-light users will get the dark theme.
- The amber-fill-means-PR rule is only as strong as its enforcement; if any other component ships with a solid amber background the semantic collapses, so it needs a code-review checklist item, not just documentation.
