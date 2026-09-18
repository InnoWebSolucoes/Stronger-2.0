/**
 * STRONGER 2.0 — design tokens (typed source of truth).
 * tokens.css is generated from this file. Components import from here or
 * read the CSS custom properties; never hard-code a hex anywhere else.
 *
 * All contrast ratios in comments were computed with WCAG 2.1 relative
 * luminance; all colour-vision-deficiency claims were computed with a
 * Vienot/Brettel/Mollon dichromat simulation + CIELAB deltaE.
 */

export const primitives = {
  neutral: {
    1000: '#070A11', 975: '#0B0F19', 950: '#121725', 900: '#1A2032',
    850: '#222A3D', 800: '#2B3348', 750: '#36405A', 700: '#4C5872',
    600: '#626E85', 500: '#7A8599', 400: '#8A94A8', 300: '#A7B1C4',
    200: '#C6CEDC', 150: '#DDE3EC', 100: '#EDF0F6', 75: '#F4F6FA',
    50: '#FFFFFF',
  },
  amber:  { 200:'#FFE3A3',300:'#FFC15E',400:'#F7B23B',500:'#F5A524',600:'#D98613',700:'#B26A00',800:'#8A5000',900:'#5A3505' },
  blue:   { 200:'#B9D6FF',300:'#6FB0FF',400:'#4C9DF0',500:'#2A6FE0',600:'#1F63D6',700:'#1257C9',800:'#0E3F92' },
  green:  { 200:'#A9F0C8',300:'#5FE39B',400:'#4ADE8B',500:'#22C55E',600:'#1FA95A',700:'#0F7A43',800:'#0A5730' },
  red:    { 200:'#FFC4C9',300:'#FF8A93',400:'#E5484D',500:'#D6293E',600:'#BE2438',700:'#9B1C2D' },
} as const;

/** Strength-standard tiers. Colour is ALWAYS redundant with a name + pips. */
export const tiers = ['Beginner','Novice','Intermediate','Advanced','Elite'] as const;
export type Tier = typeof tiers[number];

export const dark = {
  bg:      { canvas:'#070A11', app:'#0B0F19', sunken:'#0E1320', scrim:'rgba(4,7,13,.72)' },
  surface: { 1:'#121725', 2:'#1A2032', 3:'#222A3D', 4:'#2B3348' },
  edgeHighlight: 'inset 0 1px 0 0 rgba(255,255,255,.045)',
  fg: {
    primary:'#F2F5FA',    // 17.52 on bg.app / 16.35 on surface.1
    secondary:'#A7B1C4',  //  8.87 / 8.28
    tertiary:'#8A94A8',   //  6.28 / 5.86  (min 4.69 on surface.3)
    disabled:'#5C6679',   //  non-text only
    onAccent:'#120C02',   //  on amber fill = 9.53
    onAction:'#FFFFFF',   //  on blue.500  = 4.72
    inverse:'#0B0F19',
  },
  border: { subtle:'#1C2333', default:'#252E41', strong:'#36405A', interactive:'#626E85', focus:'#6FB0FF' },
  brand:  { base:'#F5A524', text:'#FFC15E', weak:'rgba(245,165,36,.14)', borderWeak:'rgba(245,165,36,.32)' },
  action: { fill:'#2A6FE0', hover:'#3479EC', press:'#205CC4', text:'#6FB0FF', weak:'rgba(42,111,224,.16)' },
  positive:{ text:'#4ADE8B', fill:'#22C55E', weak:'rgba(34,197,94,.15)' },
  negative:{ text:'#FF8A93', fill:'#D6293E', weak:'rgba(214,41,62,.16)' },
  warning: { text:'#FFC15E', fill:'#F5A524', weak:'rgba(245,165,36,.14)' },
  record:  { fill:'#FFC15E', fg:'#171004', border:'#F5A524',
             glow:'0 0 0 1px rgba(245,165,36,.45), 0 4px 16px rgba(245,165,36,.18)' },
  readiness:{ full:'#4ADE8B', partial:'#F7B23B', low:'#E5484D', rest:'#626E85' },
  tier: { Beginner:'#7C8AA0', Novice:'#4E9BE0', Intermediate:'#2FB98C', Advanced:'#F7B23B', Elite:'#FFE3A3' },
  viz: {
    categorical: ['#4C9DF0','#FFC15E','#D46FB0','#CBD5E6'], // max 4. deltaE p29.2/d20.6/t22.5
    up:'#5FE39B', down:'#E5484D', flat:'#7A8599',
    heat: ['#232B3D','#2C1F4A','#5A2465','#8E2F63','#C24A53','#EE7F4E','#FCB562','#FFE6A8'],
    activity: ['#151B29','#43300F','#6E4C0F','#A5731A','#D89A24','#FFC15E'],
    grid:'#1E2637', axis:'#2A3346', track:'#222A3D',
    band:'rgba(76,157,240,.12)', projection:'rgba(167,177,196,.5)',
    areaTop:'rgba(245,165,36,.22)', areaBottom:'rgba(245,165,36,0)',
  },
  shadow: {
    1:'0 1px 2px rgba(0,0,0,.36)',
    2:'0 4px 12px rgba(0,0,0,.44), 0 1px 2px rgba(0,0,0,.32)',
    3:'0 12px 32px rgba(0,0,0,.52), 0 2px 6px rgba(0,0,0,.36)',
    4:'0 24px 64px rgba(0,0,0,.60), 0 4px 12px rgba(0,0,0,.40)',
  },
} as const;

export const light: typeof dark = {
  bg:      { canvas:'#EDF0F6', app:'#F4F6FA', sunken:'#EAEEF5', scrim:'rgba(11,15,25,.44)' },
  surface: { 1:'#FFFFFF', 2:'#EDF0F6', 3:'#E3E8F1', 4:'#FFFFFF' },
  edgeHighlight: 'none',
  fg: { primary:'#0B0F19', secondary:'#465163', tertiary:'#667184',
        disabled:'#98A1B2', onAccent:'#241703', onAction:'#FFFFFF', inverse:'#F2F5FA' },
  border: { subtle:'#E6EAF2', default:'#D6DCE8', strong:'#B9C2D2', interactive:'#7B8699', focus:'#1257C9' },
  brand:  { base:'#B26A00', text:'#8A5000', weak:'rgba(245,165,36,.16)', borderWeak:'rgba(178,106,0,.34)' },
  action: { fill:'#1257C9', hover:'#0F4EB4', press:'#0C4099', text:'#1257C9', weak:'rgba(18,87,201,.10)' },
  positive:{ text:'#0F7A43', fill:'#0F7A43', weak:'rgba(15,122,67,.12)' },
  negative:{ text:'#BE2438', fill:'#BE2438', weak:'rgba(190,36,56,.10)' },
  warning: { text:'#8A5000', fill:'#B26A00', weak:'rgba(178,106,0,.12)' },
  record:  { fill:'#F5A524', fg:'#1A1206', border:'#B26A00',
             glow:'0 0 0 1px rgba(178,106,0,.40), 0 4px 16px rgba(245,165,36,.28)' },
  readiness:{ full:'#0F7A43', partial:'#B26A00', low:'#BE2438', rest:'#7B8699' },
  tier: { Beginner:'#7A8496', Novice:'#2E71B8', Intermediate:'#0E7150', Advanced:'#8A5000', Elite:'#6B4A05' },
  viz: {
    categorical: ['#1E6FA8','#B5730B','#A44B86','#5B6779'],
    up:'#0F7A43', down:'#BE2438', flat:'#7B8699',
    heat: ['#DCE2EC','#FBE3C8','#F8BE86','#F0864F','#D2504F','#9E2F63','#5F2465','#2C1F4A'],
    activity: ['#ECEFF4','#FBE8C6','#F6CE87','#EDAE44','#D18A15','#9A6100'],
    grid:'#E9EDF4', axis:'#D6DCE8', track:'#E3E8F1',
    band:'rgba(18,87,201,.10)', projection:'rgba(70,81,99,.45)',
    areaTop:'rgba(178,106,0,.20)', areaBottom:'rgba(178,106,0,0)',
  },
  shadow: {
    1:'0 1px 2px rgba(11,15,25,.06)',
    2:'0 4px 12px rgba(11,15,25,.08), 0 1px 2px rgba(11,15,25,.05)',
    3:'0 12px 32px rgba(11,15,25,.12), 0 2px 6px rgba(11,15,25,.06)',
    4:'0 24px 64px rgba(11,15,25,.16), 0 4px 12px rgba(11,15,25,.08)',
  },
};

export const type = {
  family: {
    ui:      `'Inter Variable','Inter',-apple-system,'SF Pro Text','Segoe UI Variable Text','Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif`,
    display: `'Archivo Variable','Archivo','Inter Variable',-apple-system,'SF Pro Display','Segoe UI Variable Display',Roboto,sans-serif`,
    mono:    `ui-monospace,'SF Mono','JetBrains Mono','Cascadia Mono','Roboto Mono',Menlo,Consolas,monospace`,
  },
  features: `'cv05' 1,'cv08' 1,'ss03' 1,'calt' 1`,
  weight: { regular:450, medium:520, semibold:600, bold:680, black:800 },
  scale: {
    displayXl:{ size:56, lh:56, ls:'-0.030em', weight:700, family:'display', tnum:true },
    displayL: { size:44, lh:44, ls:'-0.028em', weight:700, family:'display', tnum:true },
    displayM: { size:34, lh:36, ls:'-0.022em', weight:700, family:'display', tnum:true },
    displayS: { size:28, lh:32, ls:'-0.018em', weight:700, family:'display', tnum:true },
    titleL:   { size:22, lh:28, ls:'-0.012em', weight:680, family:'ui' },
    titleM:   { size:19, lh:24, ls:'-0.008em', weight:600, family:'ui' },
    titleS:   { size:17, lh:22, ls:'-0.004em', weight:600, family:'ui' },
    bodyL:    { size:16, lh:24, ls:'0',        weight:450, family:'ui' },
    bodyM:    { size:15, lh:22, ls:'0',        weight:450, family:'ui' },
    bodyS:    { size:13, lh:18, ls:'0.004em',  weight:450, family:'ui' },
    labelL:   { size:15, lh:20, ls:'0',        weight:520, family:'ui' },
    labelM:   { size:13, lh:16, ls:'0.010em',  weight:520, family:'ui' },
    labelS:   { size:11, lh:14, ls:'0.060em',  weight:680, family:'ui', uppercase:true },
    numL:     { size:20, lh:24, ls:'-0.006em', weight:600, family:'ui', tnum:true },
    numM:     { size:17, lh:20, ls:'-0.004em', weight:600, family:'ui', tnum:true },
    numS:     { size:13, lh:16, ls:'0',        weight:520, family:'ui', tnum:true },
    monoS:    { size:12, lh:16, ls:'0',        weight:450, family:'mono', tnum:true },
  },
} as const;

export const space = [0,2,4,6,8,10,12,16,20,24,32,40,48,64,80] as const;
export const layout = {
  gutter:16, gutterWide:24, cardPad:14, cardPadLg:16,
  rowH:44, rowHSet:48, tabbarH:56, appbarH:52, stackGap:10, sectionGap:28,
} as const;

export const radius = { xs:4, sm:6, md:8, lg:12, xl:16, xxl:20, xxxl:28, pill:9999 } as const;

export const motion = {
  duration: { instant:0, micro:120, short:180, standard:240, emphasized:320, long:420, celebrate:700 },
  easing: {
    standard:   'cubic-bezier(.2,0,0,1)',
    decelerate: 'cubic-bezier(.05,.7,.1,1)',
    accelerate: 'cubic-bezier(.3,0,.8,.15)',
    linear:     'linear',
    spring:     'cubic-bezier(.34,1.42,.64,1)',
  },
  stagger: 60,
} as const;

/** Haptic weight per event. Web: map to navigator.vibrate fallbacks. */
export const haptics = {
  setCompleted:        'impact.light',        // the ~50x/session event — stays light
  setUncompleted:      'selection',
  setTypeChanged:      'selection',
  restTimerStarted:    'impact.soft',
  restTimerLastFive:   'impact.soft',         // once per second, final 5s
  restTimerFinished:   'notification.success',
  personalRecord:      'impact.heavy + notification.success',
  workoutStarted:      'impact.medium',
  workoutFinished:     'notification.success',
  exerciseAdded:       'impact.light',
  exerciseDeleted:     'impact.medium',
  destructiveConfirm:  'notification.warning',
  invalidInput:        'notification.error',
  segmentedControl:    'selection',
  pullToRefreshArmed:  'impact.rigid',
  photoCaptured:       'impact.rigid',
  none: ['scroll','tab switch','chart scrub start','keyboard digit entry'],
} as const;

export const theme = { primitives, dark, light, type, space, layout, radius, motion, haptics, tiers };
export default theme;
