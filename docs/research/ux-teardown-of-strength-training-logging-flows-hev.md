# UX teardown of strength-training logging flows (Hevy, Strong, Boostcamp, Fitbod, Liftin', Alpha Progression, JEFIT, Setgraph, Apple Fitness) — and a testable interaction spec for Stronger 2.0's active-workout screen

## Summary

The logging screen is a two-tap machine operated by a distracted person with wet hands. Every app that wins has converged on the same physical layout — a per-exercise card with a set table whose columns are Set | Previous | Weight | Reps | ✓ — and the differences that decide the winner are (a) how much of the row is pre-filled, (b) how the numeric keyboard behaves, and (c) whether the app survives being backgrounded. Hevy is the current benchmark: logging a set is "two taps: enter weight, enter reps, done" (RepReturn), set types are applied by tapping the set number in the SET column (warm-up / normal / failure / drop set, drop set rendering as a blue "D"), a swipe-left on a set deletes it, the plate calculator is a button that lives on the keyboard accessory bar for barbell lifts, and the rest timer explicitly does NOT auto-start when the next set is tagged as a drop set — the single best micro-detail I found anywhere. Strong's equivalents: default rest timer is exactly 2:00, fires immediately on set completion, and can have a separate duration for warm-up vs working sets per exercise; supersets render as a vertical line down the left edge and a "Next" button walks across exercises in superset order; warm-up sets are excluded from charts and metrics.

The rage is almost entirely about persistence and platform behaviour, not features. Boostcamp reviewers: "the app resets when you change apps", "App closes anytime you get out of it or close your phone, negating the timer", "I used the app solid for a year and then I updated and lost all my data". Setgraph: "App CRASHES every time the app is minimized", "Bug found — timer feature causes app to crash when reopening from lock screen", "No Transfer?" (lost everything moving phones). JEFIT: "shuts down half way thru work out", "the rest time keeps resetting to 45 seconds and the reps are automatically at 15 reps". Strong's own data-loss article reveals the architecture flaw that causes most "lost workouts": people accidentally create a second account with a different auth provider, and workouts live in the cloud tied to credentials rather than on the device. Boostcamp's destructive-action design is a cautionary tale: "If you accidentally deleted an exercise mid workout there is no way to restore it unless you click undo within a 3 second timer… Has completely messed up my workouts on 3 occasions".

Second-order lessons: prefill must be optional (a Strong reviewer: "Pre loads wt and reps lame… I want to input those manually"), AI suggestions are actively hated when they override the user's numbers (JEFIT: "Recommend set and reps by AI is not great"; Hevy: "the ai really kills me"), redesigns of the logging screen destroy trust ("Less Intuitive With Every Update", "all of the buttons are moved around"), onboarding questionnaires kill activation ("approximately 15 million questions before you can even get into the actual app"; "I had to decline six offers before it let me start logging"), and the finish screen's most-loved element is already the thing the brief asks for — Hevy generates a shareable card saying "You lifted a total of 13 264 kg. That's like lifting a truck!"

## Findings

### Hevy's set table is the industry-standard layout and logging a set is two taps

Columns are SET | PREVIOUS | KG/LBS | REPS | (RPE, optional) | ✓. Hevy prefills: "when you add an activity you've done before, the number of sets, the weight, and the reps you've done previously are also added." RepReturn's 2026 comparison: "Logging a set takes two taps: enter weight, enter reps, done." A '+ Add Set' button sits under each exercise; swipe-left on a set row reveals delete. A Calculator button appears above the keyboard for barbell exercises.

Source: https://www.hevyapp.com/features/track-workouts/ ; https://repreturn.com/best-workout-tracking-app/

### Set types are assigned by tapping the SET NUMBER — not a long-press, not a menu button

Hevy: "tap the number next to the set under the SET column to reveal the menu" → Normal / Warm Up / Failure / Drop Set. Drop sets display as a blue 'D' on the left. Strong is identical: "tap the Set Number (e.g. 1,2,3) in the 'Set' column to bring up this menu", and tapping the tag again removes it, reverting to the plain set number. This is the single most-copied interaction in the category and we should not invent a different one.

Source: https://www.hevyapp.com/features/workout-set-types/ ; https://help.strongapp.io/article/166-set-tags

### Drop sets suppress the rest timer — the best micro-detail in the category

Hevy: "The automatic rest timer doesn't start if the next set is labeled as a Drop Set." Because a drop set by definition has no rest, firing a 2-minute timer there is a bug the user has to dismiss mid-burn. Same logic should apply to myo-rep back-off sets and to the second exercise of a superset.

Source: https://www.hevyapp.com/features/workout-set-types/

### Warm-up sets must be excluded from stats — and that exclusion must be a user toggle

Strong: warm-up sets "will not be included in charts or metrics." Hevy exposes it as a setting, 'Warm Up Sets' — "Toggle whether warm-up sets are included in your workout statistics and performance calculations." If you silently include warm-ups in total volume, every power user notices and your volume numbers become untrusted.

Source: https://help.strongapp.io/article/166-set-tags ; https://www.hevyapp.com/features/workout-settings/

### Rest-timer defaults: Strong = 2:00 fixed, Hevy = configurable 5s–5min, both auto-start on the checkmark

Strong: "The default Rest Timer for all exercises is 2:00 and triggers immediately after a set is completed"; visible top-left of the workout screen; tapping it expands to a Full Screen mode where you change duration or skip; you can "set a different duration for Warm-up Sets and Working (Regular) Sets" per exercise. Hevy: default set in Profile > Settings > Workouts > Default Rest Timer, range 5 seconds to 5 minutes, per-exercise override, +15/−15 buttons during the rest, tap the timer to change it for all remaining sets, and can be switched off per exercise for supersets/circuits. Hevy's default does NOT apply retroactively to exercises already in saved routines.

Source: https://help.strongapp.io/article/231-rest-timer ; https://www.hevyapp.com/features/workout-rest-timer/

### Live Activity / Dynamic Island is now table stakes, and Hevy lets you complete a SET from the lock screen

Hevy's Live Activity shows current exercise, set count, prescribed weight and reps, next exercise, total duration, and that exercise's previous performance — and "allows you to mark sets as complete directly from the lock screen without opening the app or unlocking your phone", plus ±15s and skip. Strong shipped Live Activity + Dynamic Island for rest timers in v6.5.0 (Aug 2026). Setgraph has it with an explicit 'Cancel' button on the Lock Screen and Dynamic Island. This is the correct answer to 'phone is in my pocket / across the gym'.

Source: https://www.hevyapp.com/features/live-activity/ ; https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577

### The #1 rage category is the app dying when backgrounded — and it kills the rest timer too

Boostcamp 1★ "Downward spiral": "Now the timer is all but useless as the app resets when you change apps." Boostcamp 1★ "Used to be good": "App closes anytime you get out of it or close your phone, negating the timer and making the app restart each time." Setgraph 1★ "New update is terrible": "App CRASHES every time the app is minimized and has to be restarted." Setgraph 1★/3★: "Timer feature causes app to crash when reopening from lock screen." JEFIT 2★: "shuts down half way thru work out." The fix is architectural: the timer must be a wall-clock deadline persisted to disk + a scheduled local notification, never an in-memory countdown.

Source: https://itunes.apple.com/us/rss/customerreviews/page=1/id=1529354455/sortby=mostrecent/json ; .../id=1209781676/... ; .../id=449810000/...

### Update-time data loss is the trust-ending failure

Boostcamp 1★ "Lost all my progress": "I used the app solid for a year and then I updated and lost all my data." Boostcamp 4★ "Great But": "Spent a decent amount of time making a routine. It disappeared, but the title of it still shows when I search for it" (a dangling index — classic partial-migration bug). Setgraph 1★ "Set data lost": "Missing workouts." Setgraph 1★ "No Transfer?": lost all workout data switching phones despite paying for pro.

Source: https://itunes.apple.com/us/rss/customerreviews/page=1/id=1529354455/sortby=mostrecent/json

### Strong's 'lost data' is almost always a duplicate-account bug, not a crash

Strong's own troubleshooting article: the primary cause is "you have accidentally created a new account instead of logging into your existing Strong Account" — different auth provider (Apple/Google/Facebook/email), different email, or multiple Apple/Google IDs. Their model "maintains workouts in cloud storage tied to specific account credentials, not device-level persistence." Lesson: the local DB must be the source of truth and must survive re-auth; and account linking must detect 'this device already has 143 workouts, do you want to merge?'

Source: https://help.strongapp.io/article/217-lost-data

### Destructive actions with a 3-second undo are a design defect

Boostcamp 1★ "Terrible": "If you accidentally deleted an exercise mid workout there is no way to restore it unless you click undo within a 3 second timer. Has completely messed up my workouts on 3 occasions now, and even if you add the exercise back it doesn't track properly in following workouts. It is so easy to accidentally do." Deleting a logged exercise or a completed set must be soft-delete + persistent undo for the whole session, not a toast.

Source: https://itunes.apple.com/us/rss/customerreviews/page=1/id=1529354455/sortby=mostrecent/json

### Prefill is loved by most and hated by a vocal minority — make it a setting

Strong 3★ "Pre loads wt and reps lame": "Hate that it preloads the weight and reps. I want to input those manually." Hevy resolves this with the 'Previous Workout Values' setting — choose whether previous values come from ALL workouts or only from the current routine — which also fixes the real problem (your Push day's bench shouldn't prefill from your Full Body day's bench).

Source: https://itunes.apple.com/us/rss/customerreviews/page=1/id=464254577/sortby=mostrecent/json ; https://www.hevyapp.com/features/workout-settings/

### Supersets: vertical rail + auto-advance across exercises

Strong: grouped exercises show "a vertical line on the left side"; the Next button "automatically selects the corresponding set from the appropriate exercise in sequence, rather than completing all sets of one movement before progressing." Hevy calls the same thing 'Smart Superset Scrolling' — "Automatically scrolls to the next exercise of a superset when you mark one as complete" — and it is a toggle, because some people superset with a station walk in between.

Source: https://help.strongapp.io/article/98-supersets-and-circuits ; https://www.hevyapp.com/features/workout-settings/

### Plate calculator lives on the keyboard, not in a menu

Strong: "activates by tapping the weight field during barbell or machine exercises, then selecting the plate calculator button on the keyboard"; bar defaults to Olympic 20 kg / 45 lb, changeable per exercise via the More menu; shows the most efficient plates per side; PRO-gated. Hevy: "A Calculator button appears above the keyboard for barbell exercises." A Strong reviewer explicitly asks for "custom bar weights" (trap bar, safety squat bar, 15 kg women's bar, 10 kg tech bar) — support them.

Source: https://help.strongapp.io/article/169-plate-calculator ; https://www.hevyapp.com/features/track-workouts/

### Boostcamp's logging pitch is the cleanest one-sentence statement of the ideal loop

"Tap a set, the timer starts. Hit your reps, the next session's weight is already there." It also logs RPE 5–10 AND RIR per set, has reusable customizable warm-up templates applied to any working weight, a plate calculator with per-exercise lb/kg, offline mode on the free tier, and autoregulation that "bumps the weight when you crush your reps and pulls back when you miss them." Pricing $14.99/mo or $59.99/yr; 4.8★ with 9,100+ App Store reviews; claims 1.3M lifters and 300M+ workouts logged.

Source: https://www.boostcamp.app/workout-tracker ; https://barbend.com/boostcamp-review/

### Setgraph's swipe gestures are the fastest logging interaction anyone ships

'Swipe to Log': swipe right on an exercise in the workout list → a set recording pad appears → enter reps and weight → save, without ever opening the exercise detail. 'Swipe to Repeat': swipe right on an already-logged set → instantly duplicates it as a new identical set below. Exercises are ordered by most recently completed. Offline-first with sync on reconnect. This is the right answer for the 'I did the same set again' case, which is most sets.

Source: https://setgraph.app/articles/fast-workout-tracking-with-swipe-actions-in-setgraph

### Strong's Focus Metric is the best lightweight progression feedback I found

Each exercise can have its own focus metric — Total Volume, Volume Increase, Weight/Rep, Total Reps, Reps/Set, Total Time, Average Time, Distance — compared against your last session with that exercise. "If you performed 1000 lbs of total volume the last workout and only performed 900 lbs today, Focus Metric will read -10%." One number per exercise card, chosen by the user. Not available on Apple Watch.

Source: https://help.strongapp.io/article/226-focus-metric

### AI/auto-prescription is the most-hated 'coach tip' pattern when it overwrites user intent

JEFIT 2★: "Recommend set and reps by AI is not great. Wish they'd leave it as is." JEFIT 3★: "I get frustrated when the next time I go to the gym my weights and reps change." JEFIT 3★: "The weight and rep recommendation doesn't make sense based on prior week numbers." JEFIT 3★ "It's frustrating": "The AI coach is strange — it repeats the same exercises but completely ignores others." Hevy 1★ "Ai Enablers": "i really do like this app but the ai really kills me do better." Fitbod 2★: "Bad weight/rep recommendations… company prioritizes AI commentary over fixing recommendation accuracy." Suggestions must be a ghost value you can accept, never a value that silently replaces what you typed last week.

Source: https://itunes.apple.com/us/rss/customerreviews/page=1/id=449810000/sortby=mostrecent/json ; .../id=1041517543/... ; .../page=4/id=1458862350/...

### Auto-advance without a skip button is a real complaint

Alpha Progression 3★ "Fav workout app, but….": dislikes "automatic progression to next exercise, lack of skip button, and workout completion scrolling issues." Alpha Progression 3★ "Buggy": "freezing issues where app doesn't register rep inputs; requires restart" — the worst possible failure, because the user believes the set was logged.

Source: https://itunes.apple.com/us/rss/customerreviews/page=1/id=1462277793/sortby=mostrecent/json

### Fitbod's muscle model is too coarse and its exercise search doesn't learn — both directly relevant to our muscle-readiness and add-exercise screens

Fitbod 4★ "Livewinter": "The muscle model is too coarse. Fitbod treats back as one unit, but lats, traps, rhomboids, and rear delts are trained by different movements"; wants to filter the exercise library by region; notes the algorithm ignores custom exercises despite documentation claiming otherwise. Fitbod 2★ "Pretty much done": "search doesn't prioritize most-used exercises." Our readiness model must split back into lats / traps / rhomboids / rear delts / erectors, and our exercise search must rank by personal frequency+recency before global popularity.

Source: https://itunes.apple.com/us/rss/customerreviews/page=2/id=1041517543/sortby=mostrecent/json

### Onboarding: every extra question and every paywall interstitial costs activation

Setgraph 1★ "DO NOT DOWNLOAD": "This app asks you approximately 15 million questions before you can even get into the actual app." Boostcamp 4★ "Good app, but too many hoops": "I swear I had to decline six offers before it let me start logging for free." JEFIT 1★: "The app shows way too many pop-ups before you can actually start to work out." Fitbod 1★: "Get all the way to the end of the sign ups… just to get hit with an $8 a month subscription to even see the app." Hevy's onboarding by contrast offers three doors: pick a template routine, build a routine, or 'start an empty workout and build it as you train.'

Source: https://itunes.apple.com/us/rss/customerreviews/page=1/id=1209781676/... ; .../id=1529354455/... ; .../id=449810000/... ; .../id=1041517543/... ; https://www.hevyapp.com/hevy-tutorial/

### The finish screen that works is a stack of shareable cards, and Hevy already ships the 'ambulances and pianos' idea

Hevy's post-workout shareables: workout summary (duration, weight lifted, number of sets), exercise list, personal records, muscle distribution chart, consistency/streak card, monthly stats — and a real-world comparison card whose published example reads "You lifted a total of 13 264 kg. That's like lifting a truck!" You can set the background to Transparent and Save Image. Hevy v3.1.14 (Sept 2026) added "Send workouts to ChatGPT & Claude directly from finish screen." Boostcamp 4★ "Bring it back": "Love this app but bring back the old workout summary!" — the summary is emotionally load-bearing; never regress it.

Source: https://www.hevyapp.com/features/shareable/ ; https://apps.apple.com/us/app/hevy-workout-tracker-gym-log/id1458862350

### Redesigning the logging screen is the highest-risk thing you can do

Boostcamp 1★ "New design sucks": "Why mess with a good thing? … custom workouts hard to find - workout UI less efficient, too much margin spacing - history exploration less evident." Boostcamp 3★ "Update is a Downgrade": "Curious UI choices, nothing intuitive, and all of the buttons are moved around." Boostcamp 2★ "Less Intuitive With Every Update": features increasingly buried, calendar view hidden. Hevy 3★: "They keep changing the settings and format like every 2/3 days… It's irritating to get used to a new layout just for it to change again against my will." Strong 3★ "Original was Better": "the interface isn't as user friendly as the original. Same functions just in different less convenient places." Muscle memory in a gym app is literal.

Source: https://itunes.apple.com/us/rss/customerreviews/page=1/id=1529354455/... ; .../page=1/id=1458862350/... ; .../page=1/id=464254577/...

### Exercise library gaps and no custom exercises are a top-3 recurring complaint for Strong

Strong 3★: "Very limited library of exercises to choose from. When you write a note within the exercise you can't ever find it again!"; 3★: "Please add more exercises with different variations or allow us to create custom ones"; 1★: "Can't put your own machines in detail. They get to use photos for their exercises but when you make your own you can't? … Really hard to find your exercises unless you search the machine you use." Hevy 4★: "the ability to create custom exercises… there are a few missing that I do." For reference library sizes: Hevy 400–500+ with videos, Alpha Progression 795 with form videos, JEFIT's "massive exercise database with detailed instructions and animations" is its main remaining advantage.

Source: https://itunes.apple.com/us/rss/customerreviews/page=1/id=464254577/... ; https://alphaprogression.com/en/ ; https://setgraph.app/ai-blog/best-app-for-tracking-workouts

### Data export is a loyalty tripwire

Setgraph 1★ "Avoid!": "They don't let you export data." Setgraph 1★ "No data export feature": user cancelling membership over it. Hevy 4★: "the ability to download my workout history and routines to excel." Strong ships CSV export and it is listed as a headline feature. Strong 3★: "the inability to import workouts and lack of Ai comparability is about to make me jump ship." Ship CSV + JSON export and a Hevy/Strong CSV importer on day one.

Source: https://itunes.apple.com/us/rss/customerreviews/page=1/id=1209781676/... ; https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577

### Apple Fitness does not log sets at all — this is our free moat on Watch

Apple Watch's Traditional Strength Training workout records duration, heart rate and calories but never sets, reps or weight; Apple Fitness+ likewise records no reps/sets/weight. The gap was only filled in 2026 by third parties — 'Reps & Sets 26', iOS/iPadOS/watchOS 26-exclusive, ships "a fully stand-alone watchOS app, so you can leave your iPhone in your locker" where you "check off sets and start rest timers with a single tap." Strong's own users complain the reverse: 1★ "Strong Apple Watch App is no longer supported or works"; 3★ "Having to start the workout on the watch and then carrying it over to the phone is a drawback."

Source: https://www.gymnoteplus.com/blog/how-to-track-strength-workouts-on-apple-watch ; https://www.cultofmac.com/news/reps-and-sets-strength-training-app

### Touch-target minimums, and why they are not enough in a gym

Apple HIG minimum is 44×44 pt; Material Design is 48×48 dp (~9 mm physical); general guidance for touchscreen elements is 7–10 mm. In a gym the user is one-handed, thumb-only, sweaty (sweat causes capacitive false-touches and misses), sometimes gloved (gloves reduce capacitance and effectively enlarge the contact patch). Treat 48 pt as the floor and 56 pt as the target for the done-checkmark, and never place a destructive action within 8 pt of it.

Source: https://m3.material.io/foundations/designing/structure ; https://blog.logrocket.com/ux-design/all-accessible-touch-target-sizes/

### Pricing and free-tier limits shape the complaint profile

Hevy Pro $2.99–3.99/mo, $23.99/yr, $74.99 lifetime — App Store 4.9★ / 93K US ratings, #29 Health & Fitness; its free tier is the most praised thing about it ("generous free version without aggressive paywalls"). Strong free tier caps at 3 (some reviewers say 4) custom templates: 2★ "not allowing users to create more than 3 diy workout templates unless they pay a subscription should be borderline illegal." Boostcamp $59.99/yr, Alpha Progression ~$9.99/mo with a 14-day Pro trial, Liftin' 5 free workouts/month then $24.99/yr with a lifetime option, JEFIT criticised at "$70/year", Fitbod subscription-only with no free tier and heavy billing complaints. The pattern: gate analytics and programming, never gate the act of logging.

Source: https://apps.apple.com/us/app/hevy-workout-tracker-gym-log/id1458862350 ; https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577 ; https://barbend.com/boostcamp-review/

### Hevy's full workout settings list — a ready-made checklist for our settings screen

1 Sounds (timer sound, timer volume off/low/normal/high, set-completion sound, PR notification volume); 2 Default Rest Timer; 3 Previous Workout Values (all workouts vs current routine only); 4 Warm-up Calculator (percentage-based, adjustable formula, plate rounding); 5 Warm Up Sets (include in stats or not); 6 Keep Awake During Workout; 7 Plate Calculator; 8 RPE Tracking (adds an RPE column while logging); 9 Smart Superset Scrolling; 10 Inline Timer (built-in stopwatch for time-based exercises); 11 Live Personal Record Notification; 12 units/general. Note #6 — 'Keep Awake During Workout' — is a screen-lock override that removes an entire class of friction.

Source: https://www.hevyapp.com/features/workout-settings/

## Recommendations

- Persist the active workout to local storage on every single mutation (keystroke-debounced at 300ms, immediate on set-complete/add/delete), and restore it on cold launch with zero prompts — the session banner should reappear as if nothing happened.
- Model the rest timer as a persisted wall-clock deadline plus a scheduled local notification, never an in-memory countdown, so it survives backgrounding, lock, and process death.
- Ship the set table with exactly the columns Set | Previous | Weight | Reps | RPE(optional) | ✓, and assign set types by tapping the set number, because every competitor's users already have that muscle memory.
- Suppress the auto rest timer when the next set is tagged drop set or myo-rep, and when the exercise is inside a superset that has its own transition rule.
- Make 'previous' both a display and a one-tap prefill action, and expose a setting for prefill scope (all workouts vs this routine only) plus an off switch for the users who want to type every number.
- Give every destructive action session-long undo with a visible 'Recently removed' drawer instead of a 3-second toast.
- Keep the numeric entry on a custom in-app keypad with a persistent accessory bar carrying plate calculator, ±2.5/±5 increment steppers, prev/next field arrows and Done, so the OS keyboard never covers the row being edited.
- Rank exercise search by the user's own frequency and recency first, then muscle/equipment match, then global popularity, and show a Recents row above the search field.
- Support swapping an exercise while preserving already-logged sets, with an explicit 'keep logged sets / start fresh' choice and a note recording the swap.
- Split the muscle model finer than Fitbod's — lats, traps, rhomboids, rear delts, erectors as separate entities — because readiness and the world-standings tab both depend on it.
- Build the finish screen as a swipeable deck of shareable cards with the real-world volume equivalence card first, and never redesign it once shipped.
- Show at most one coach tip per exercise, derived from the user's own last-session numbers (a Focus-Metric-style single delta), and never mutate a user-entered value automatically.
- Get to a first logged set in under 60 seconds with a 'Start empty workout' door that requires no account, no questionnaire and no paywall, and defer sign-up until the first Finish.
- Ship CSV and JSON export plus a Hevy/Strong CSV importer in v1, and put the export button where a churning user will find it.
- Keep the whole logging screen functional offline and treat the local database as the source of truth, with sync as a background reconciler that can never delete local rows.
- Enforce a 48pt minimum and 56pt target for the done-checkmark, with at least 8pt of dead space between it and any destructive control.
- Add the 'Keep screen awake during workout' setting and default it on for an active session.

## Data

# STRONGER 2.0 — ACTIVE-WORKOUT LOGGING SPEC
## Prioritised, testable interaction rules. P0 = ship-blocking. P1 = launch quality. P2 = differentiator.

---

## A. PERSISTENCE & CRASH SAFETY (P0 — highest priority, this is what kills competitors)

- **A1 (P0)** Every mutation to the active workout MUST be written to durable local storage before the UI animates the change. Debounce free-text/number fields at 300 ms; write immediately and synchronously on: set completed, set added, set deleted, exercise added, exercise removed, set type changed, workout started, workout finished.
- **A2 (P0)** After a hard process kill at any point during a workout, relaunching the app MUST restore: every logged set value (including values typed but not yet checked off), scroll position to the last-touched exercise, elapsed duration computed from the persisted `startedAt` wall-clock timestamp, and the rest-timer state. No confirmation dialog — restore silently and show a one-line "Workout restored" toast.
- **A3 (P0)** Elapsed duration MUST be derived as `now − startedAt`, never accumulated by a ticking counter. Test: start a workout, kill the app, wait 10 real minutes, relaunch → duration reads 10:00±2s.
- **A4 (P0)** The local database is the source of truth. A sync operation MUST NEVER delete or overwrite a local row that has not been confirmed as server-acknowledged. Conflicts resolve last-write-wins per *field*, with the local device winning ties.
- **A5 (P0)** Signing in on a device that already holds local workouts MUST show a merge prompt naming the counts: "This device has 143 workouts. Your account has 0. Upload them?" Never silently swap datasets. (Direct fix for Strong's documented #1 data-loss cause.)
- **A6 (P0)** Every schema migration MUST (a) write a full backup snapshot to disk before running, (b) assert post-migration row counts ≥ pre-migration for workouts/sets/exercises, (c) roll back and restore the snapshot on assertion failure, (d) never delete the previous snapshot until the next successful launch.
- **A7 (P0)** The entire logging screen MUST be fully functional with the network disabled. Test: airplane mode → complete a full 6-exercise workout → finish → summary renders with correct numbers → re-enable network → workout appears server-side within 30 s.
- **A8 (P0)** Deleting a set or an exercise during an active workout is a soft delete. An "Undo" affordance remains available for the entire session via a "Recently removed" sheet reachable from the overflow menu. No time-limited toast is an acceptable sole undo. (Direct fix for Boostcamp's 3-second undo.)
- **A9 (P1)** "Discard workout" requires a typed/held confirmation and states exactly what will be lost: "Discard 14 sets and 4,820 kg?"
- **A10 (P1)** Export: CSV and JSON of all workouts/sets, reachable in ≤3 taps from Profile, working offline, no Pro gate.
- **A11 (P1)** Import: accept Hevy CSV and Strong CSV exports, with a preview screen showing rows parsed and exercises unmatched.

---

## B. THE SET TABLE (P0)

- **B1 (P0)** Column order is fixed left→right: `SET | PREVIOUS | KG | REPS | [RPE] | ✓`. RPE renders only when the RPE setting is on. Unit column header changes to LBS with the unit setting.
- **B2 (P0)** The done-checkmark is the right-most element, minimum hit area 48×48 pt, target 56×56 pt, with ≥8 pt clear space to any other interactive element.
- **B3 (P0)** Tapping the **set number** in the SET column opens the set-type menu: Normal · Warm-up · Drop set · To failure · Myo-rep · Cluster. Selecting the currently-applied type removes it and reverts to the plain number. Long-press is NOT required and MUST NOT be the only path.
- **B4 (P0)** Set-type rendering in the SET column: Warm-up = amber `W`; Drop set = blue `D`; Failure = red `F`; Myo-rep = purple `M`; Cluster = teal `C`; Normal = the ordinal number. Each glyph carries a text accessibility label ("Warm-up set").
- **B5 (P0)** Numbering: only Normal/Failure/Myo/Cluster sets consume an ordinal. Warm-up and drop sets never renumber the working sets. Test: W, 1, 2, D, 3 renders exactly as `W 1 2 D 3`.
- **B6 (P0)** Tapping the weight or reps *value* focuses that field and selects the entire existing value, so the first digit typed replaces it. Test: field shows 100, tap, type 9 → field shows 9, not 1009.
- **B7 (P0)** Tapping the **PREVIOUS** cell copies that previous set's weight AND reps into the current row and does not steal focus. Haptic light impact confirms. Test: previous reads "100 kg × 8", tap → row reads 100 / 8.
- **B8 (P0)** The PREVIOUS cell shows the matching set index from the most recent session containing this exercise, formatted `{weight}{unit} × {reps}`, plus the set-type glyph if that historical set was tagged. If no history exists, it shows an em-dash, never blank and never "0".
- **B9 (P0)** PREVIOUS scope is user-configurable: **All workouts** (default) or **This routine only**. Setting is global, per-user.
- **B10 (P0)** Completing a set (tapping ✓) MUST: fill the row background with the accent-tinted "done" state, commit to storage, start the rest timer per rule C1, fire a light haptic, and move focus to the next incomplete field in reading order.
- **B11 (P0)** Un-completing a set (tapping ✓ again) reverses the done state, cancels the rest timer if it was started by that set, and keeps all typed values.
- **B12 (P0)** A set with an empty weight or empty reps MAY still be completed; empty weight is treated as bodyweight-or-zero for the exercise's equipment type and is flagged in the row with a subtle dot. Never block the checkmark with a validation dialog.
- **B13 (P0)** Swipe-left on a set row reveals Delete. Swipe-right on a completed set row duplicates it as a new identical set immediately below (Setgraph's "Swipe to Repeat"). Both have 48 pt minimum action widths.
- **B14 (P1)** "+ Add Set" under each exercise creates a new row pre-filled from the last completed set of that exercise in this session; if none, from PREVIOUS; if none, empty.
- **B15 (P1)** Long-press-drag on the exercise name reorders exercises. Long-press-drag on a set row reorders sets within the exercise.
- **B16 (P1)** A drop set row is visually indented 12 pt and connected to the set above with a vertical hairline, so the reader sees it belongs to the previous working set.
- **B17 (P1)** Myo-rep sets render as a compact chain: the activation set plus mini-set rep counts entered on a single row (`12 + 5 + 4 + 3`), not as four separate rows.
- **B18 (P2)** RPE entry is a horizontal chip row (6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10) shown in the keyboard accessory, not a free-text field.

---

## C. REST TIMER (P0)

- **C1 (P0)** Completing a set auto-starts the rest timer using, in precedence order: (1) this set's explicit override, (2) this exercise's configured rest, (3) the global default. Global default is user-set from 0:00–10:00 in 5-second steps; ship default 2:00 (matching Strong).
- **C2 (P0)** The timer MUST NOT auto-start when: the *next* set of this exercise is tagged Drop set or Myo-rep, or the exercise is in a superset and the next target is a different exercise in that superset (use the superset transition rest instead, default 0:00).
- **C3 (P0)** Separate configurable rest durations for warm-up sets vs working sets, per exercise.
- **C4 (P0)** The running timer is persisted as an absolute `endsAt` timestamp. On relaunch the remaining time MUST be recomputed from the wall clock. Test: start a 2:00 rest, force-quit, relaunch after 90 s → timer reads ~0:30 and is still running.
- **C5 (P0)** When the timer starts, schedule a local notification for `endsAt`. If the app is foregrounded at expiry, cancel the notification and play the in-app sound instead so the user never gets both.
- **C6 (P0)** Timer expiry fires: sound (respecting the volume setting: off/low/normal/high), haptic (success pattern), and — if backgrounded — the local notification. Silent-switch behaviour: haptic still fires.
- **C7 (P0)** A persistent timer chip sits in the workout header. Tapping it opens a full-screen timer with −15s / +15s / Skip / "Set for all remaining sets".
- **C8 (P0)** Live Activity (iOS) / ongoing notification (Android) MUST show: rest remaining, current exercise, the next set's target weight × reps, and a ✓ button that completes that set without unlocking. Also ±15 s and Skip/Cancel.
- **C9 (P1)** "Keep screen awake during workout" setting, default ON while a workout is active, reverted on finish.
- **C10 (P1)** Timer accuracy on resume must be within ±1 s of real elapsed time regardless of how long the app was suspended.
- **C11 (P2)** Watch app mirrors the timer with haptic-only expiry.

---

## D. KEYBOARD & NUMERIC ENTRY (P0)

- **D1 (P0)** Use a custom in-app numeric keypad, not the system keyboard. It MUST include `0–9`, `.`, backspace, and a persistent accessory bar.
- **D2 (P0)** The focused row MUST remain visible above the keypad at all times; the scroll view insets by the keypad height plus 16 pt. Test: focus the last set of the last exercise → the row and its ✓ are both fully visible.
- **D3 (P0)** Accessory bar contents, left→right: `[Plate calc] [−] [+] [◀ prev field] [next field ▶] [Done]`. The `−`/`+` steppers adjust by the exercise's increment (default 2.5 kg / 5 lb for barbell, 2 kg / 5 lb for dumbbell — configurable per exercise).
- **D4 (P0)** `next field ▶` walks weight → reps → RPE → next set's weight, and inside a superset it walks across exercises in superset order (Strong's Next-button behaviour).
- **D5 (P0)** The ✓ for the focused set MUST be reachable without dismissing the keypad.
- **D6 (P0)** Weight accepts decimals; reps accept integers only; the keypad's `.` key is disabled on the reps field.
- **D7 (P1)** Plate calculator opens from the accessory bar for barbell/machine exercises, defaults to a 20 kg / 45 lb Olympic bar, supports custom bar weights per exercise (15 kg women's, 10 kg tech, trap bar, safety squat bar), a user-editable plate inventory, and shows plates **per side**.
- **D8 (P1)** Typing a weight that cannot be made from the user's plate inventory shows a non-blocking hint with the nearest loadable weight.
- **D9 (P2)** Voice entry: a mic button in the accessory bar accepting "one hundred by eight".

---

## E. ADDING, SWAPPING & GROUPING EXERCISES (P0/P1)

- **E1 (P0)** "Add exercise" is reachable from the bottom of the exercise list AND from the workout header overflow, both while the keypad is open.
- **E2 (P0)** The picker opens with the search field focused and a **Recents** row above it (last 10 distinct exercises, most-recent first).
- **E3 (P0)** Search ranking: (1) exact prefix match on the user's own top-20 most-frequent exercises, (2) exact prefix match global, (3) token match on name + aliases (e.g. "ohp" → Overhead Press, "rdl" → Romanian Deadlift, "bb bench" → Barbell Bench Press), (4) muscle/equipment match. Results MUST update within 50 ms of a keystroke at 1,500+ exercises.
- **E4 (P0)** Multi-select in the picker: selecting 2+ exercises and tapping "Add as superset" creates a superset group.
- **E5 (P0)** Supersets render with a coloured vertical rail down the left edge of the grouped cards and a letter badge (A1/A2/B1/B2).
- **E6 (P0)** "Smart superset scrolling" setting: when ON, completing a set auto-scrolls to the next exercise in the group. Default ON, must be toggleable.
- **E7 (P0)** **Swap exercise** from the exercise overflow opens the picker filtered to the same primary muscle + equipment, and on selection presents two options: "Keep my logged sets" (default; sets transfer, PREVIOUS re-resolves to the new exercise's history, a swap note is recorded) or "Start fresh".
- **E8 (P1)** Custom exercises can be created inline from the picker when the search returns nothing, capturing name, primary/secondary muscles, equipment, increment, default rest, and an optional user photo/video. Custom exercises MUST appear in search, in stats, and in any programming suggestions.
- **E9 (P1)** The picker offers an anatomical body-map filter and equipment chips, and shows each exercise's last-performed date and best e1RM inline.
- **E10 (P2)** Every exercise has a looping demonstration animation, lazily loaded so it never delays search results, with a static first-frame thumbnail rendered immediately.

---

## F. WORKOUT HEADER & LIVE COUNTERS (P0)

- **F1 (P0)** The header shows, always visible while scrolling: workout name (tap to rename), date, and three live counters — **Duration**, **Volume (kg)**, **Sets** — with Exercises and Reps available on tap/expand.
- **F2 (P0)** Volume = Σ(weight × reps) over completed sets only. Warm-up sets included or excluded per the user's setting (default: excluded). Bodyweight exercises contribute `(bodyweight × multiplier + added load) × reps` with a documented multiplier per movement; assisted movements subtract assistance.
- **F3 (P0)** Counters update within one frame of a set being completed.
- **F4 (P0)** "Finish" sits top-right and is always tappable. The collapse chevron sits top-left and minimises the workout to a persistent bottom banner from which any other tab can be used and the workout re-opened in one tap.
- **F5 (P0)** Tapping Finish with incomplete sets shows one sheet: "3 sets weren't completed — Discard them / Keep them as planned / Cancel". It MUST NOT block finishing.
- **F6 (P1)** A per-exercise "focus metric" delta chip (Strong's Focus Metric): user picks Total Volume / Volume Increase % / Top Set Weight / Total Reps / e1RM per exercise, shown against the last session.

---

## G. COACH TIPS & PROGRESSION SUGGESTIONS (P1)

- **G1 (P0)** A suggestion MUST never write a value into a field automatically. It renders as ghost text inside the empty field or as a single accept-chip ("Suggest 102.5 × 8 ↑"). One tap accepts.
- **G2 (P0)** Once a user types a value, no system process may change it — not on relaunch, not on sync, not on program regeneration.
- **G3 (P1)** At most ONE coach tip visible per exercise, dismissible, and dismissals are remembered per exercise for 30 days.
- **G4 (P1)** Tips must be grounded in the user's own data and state the evidence: "Last time you hit 3×8 at 100 kg with RPE 8. Try 102.5 kg." Generic form cues are shown only in the exercise detail view, never in the set table.
- **G5 (P1)** Progression rule is transparent and editable: double progression by default (fill the rep range across all sets → increase by the exercise's increment), with the active rule named on the tip.
- **G6 (P2)** A "why" disclosure on every suggestion showing the last 3 sessions' top sets.

---

## H. FINISH / SUMMARY SCREEN (P1)

- **H1 (P0)** The summary appears in under 500 ms of tapping Finish; the workout is already saved before the screen renders.
- **H2 (P0)** Card 1 — **Session headline**: duration, total volume, sets, reps, exercises; plus the volume-equivalence line ("You lifted 4,120 kg — that's 2.9 ambulances, or 45 upright pianos"). The equivalence object set must be deterministic per volume band and rotate so the same user does not see "truck" every session.
- **H3 (P0)** Card 2 — **PRs**: every new record with old → new and the delta. Types: heaviest weight, best e1RM, best set volume, most reps at a weight, session volume for the exercise. If no PR, this card is replaced by "closest to a PR" rather than shown empty.
- **H4 (P1)** Card 3 — **Muscle map**: rendered anatomical front/back image with volume-weighted shading and a ranked list of muscles worked with set counts.
- **H5 (P1)** Card 4 — **Comparison**: this session vs your average session and vs the same routine last time (volume ±%, duration ±%, tonnage per minute).
- **H6 (P1)** Card 5 — **Readiness forecast**: which muscles are now fatigued and when each returns to ready ("Chest ready Thursday, Back ready tomorrow").
- **H7 (P1)** Card 6 — **Lifetime journey delta**: total workouts, cumulative volume with the new total crossing a milestone if applicable.
- **H8 (P1)** Every card is individually shareable as an image with a transparent-background option and a one-tap save.
- **H9 (P1)** The deck is horizontally swipeable with a page indicator; the user can reorder/hide cards in settings.
- **H10 (P0)** The finish flow must never require network. If offline, all cards render from local data and sharing still works.

---

## I. ONBOARDING — TIME TO FIRST LOGGED SET (P0)

- **I1 (P0)** A brand-new install MUST be able to log its first set within 60 seconds and ≤5 taps, with **no account, no questionnaire, and no paywall**.
- **I2 (P0)** First screen offers exactly three doors: **Start empty workout** (primary), **Pick a routine**, **Build a routine**. Nothing else.
- **I3 (P0)** Account creation is requested only at the first Finish, framed as "Save this workout to your account", and skipping it keeps the workout locally.
- **I4 (P0)** Maximum ONE paywall presentation in the first session, and never before the first Finish.
- **I5 (P1)** Units, bodyweight and experience level are asked inline at the moment they are first needed, not upfront.
- **I6 (P1)** A first-run coach-mark appears on exactly two things: the PREVIOUS cell (tap to copy) and the ✓ (completes the set and starts rest). Dismissed permanently after one workout.
- **I7 (P2)** Import-from-Hevy/Strong offered on the empty history state, not during onboarding.

---

## J. PHYSICAL / ENVIRONMENTAL CONSTRAINTS (P0)

- **J1 (P0)** All primary controls in the set row are reachable within a right-thumb arc from the bottom-right of a 6.1" phone held one-handed. Add-exercise and Finish are the only controls allowed in the top zone.
- **J2 (P0)** Minimum hit target 48×48 pt everywhere in the active-workout screen; 56×56 pt for the ✓.
- **J3 (P0)** No destructive action within 8 pt of the ✓, and no destructive action triggerable by a single tap without undo.
- **J4 (P0)** Contrast ≥ 4.5:1 for all set-table text against the near-black background, tested under simulated bright gym lighting; numeric values use a tabular-figures font so columns never jitter as digits change.
- **J5 (P1)** Every state change the user cares about (set complete, PR, timer end) is confirmed by haptics as well as visuals, because the user may be looking at the bar.
- **J6 (P1)** The screen must remain legible and operable at the largest Dynamic Type setting, with the set table degrading to a two-line-per-set layout rather than truncating numbers.

---

## K. ANTI-REGRESSION RULES (P1)

- **K1** The set-table layout is frozen. Any future change ships behind a per-user "New logging layout" opt-in with a permanent revert.
- **K2** No new interstitial, popup, rating prompt, streak celebration or upsell may appear while a workout is active. Zero exceptions.
- **K3** Nothing that is part of *logging a set* may ever move behind a paywall after having been free.
- **K4** Performance budget: the active-workout screen renders in <16 ms per frame with 12 exercises and 60 sets; cold launch to restored workout <1.5 s.

---

## L. EVIDENCE INDEX (what each rule is defending against)

| Rule | Defends against (verbatim user complaint) | App |
|---|---|---|
| A1–A4, C4 | "the app resets when you change apps" / "App closes anytime you get out of it or close your phone, negating the timer" | Boostcamp |
| A2, C4 | "App CRASHES every time the app is minimized" / "timer feature causes app to crash when reopening from lock screen" | Setgraph |
| A6 | "I used the app solid for a year and then I updated and lost all my data" | Boostcamp |
| A5 | "you have accidentally created a new account instead of logging into your existing Strong Account" | Strong (official) |
| A8 | "no way to restore it unless you click undo within a 3 second timer… messed up my workouts on 3 occasions" | Boostcamp |
| A10 | "They don't let you export data" / "No data export feature" | Setgraph |
| B9 | "Pre loads wt and reps lame. I want to input those manually" | Strong |
| C1, C3 | "The rest time keeps resetting to 45 seconds and the reps are automatically at 15 reps" | JEFIT |
| E3 | "search doesn't prioritize most-used exercises" | Fitbod |
| E8 | "Please add more exercises with different variations or allow us to create custom ones" | Strong |
| G1, G2 | "Recommend set and reps by AI is not great" / "the next time I go to the gym my weights and reps change" | JEFIT |
| E7, F6 | "The muscle model is too coarse… treats back as one unit" | Fitbod |
| H1–H9 | "Love this app but bring back the old workout summary!" | Boostcamp |
| I1–I4 | "approximately 15 million questions before you can even get into the actual app" / "I had to decline six offers before it let me start logging" | Setgraph, Boostcamp |
| K1, K2 | "all of the buttons are moved around" / "They keep changing the settings and format like every 2/3 days" | Boostcamp, Hevy |
| K3 | "not allowing users to create more than 3 diy workout templates unless they pay should be borderline illegal" | Strong |

---

## M. TOP 15 COMPLAINTS (ranked by frequency + severity across all nine apps)

1. App dies or resets when backgrounded / phone locks, taking the rest timer with it. (Boostcamp, Setgraph, JEFIT)
2. Workout or full history lost after an app update or a phone migration. (Boostcamp, Setgraph)
3. Crash on resume from lock screen mid-workout. (Setgraph)
4. Sync failures and silent data divergence between devices/platforms. (JEFIT, Boostcamp, Strong)
5. Redesigns that move controls and bury features. (Boostcamp, Hevy, Strong, JEFIT)
6. AI/auto recommendations that change the user's numbers without consent. (JEFIT, Fitbod, Hevy, Alpha Progression)
7. Paywalls in front of basic logging; free tiers capped at 3–4 templates. (Strong, Fitbod, JEFIT, Alpha Progression)
8. Onboarding questionnaire and upsell gauntlet before the first set. (Setgraph, Fitbod, Boostcamp, JEFIT)
9. Exercise library gaps and weak/absent custom-exercise support (no images, unfindable). (Strong, Hevy, Fitbod)
10. No data export / no import. (Setgraph, Hevy, Strong)
11. Accidental destructive actions with no real undo. (Boostcamp)
12. Apple Watch app broken, unsupported, or requiring a phone-first start. (Strong)
13. Coarse muscle taxonomy producing bad recommendations and bad analytics. (Fitbod)
14. Input not registering — frozen fields that silently drop reps. (Alpha Progression, JEFIT)
15. Billing opacity: subscriptions not visible in the OS subscription list, charges after cancellation. (Fitbod)

## N. TOP 10 THINGS USERS LOVE

1. Two-tap set logging with previous values already on screen. (Hevy, Strong, Setgraph, Boostcamp)
2. The PREVIOUS column itself — "your exact sets and reps from the last session" is the core progressive-overload mechanic. (Boostcamp, Hevy)
3. Automatic rest timer that starts the instant you tick a set. (all)
4. Generous free tier with no aggressive upselling. (Hevy — repeatedly the single most-praised attribute)
5. Progress graphs and PR notifications fired live during the workout. (Hevy, Strong, Alpha Progression)
6. Apple Watch logging that lets you leave the phone in the locker. (Strong at its best, Reps & Sets 26, Liftin')
7. Plate calculator and warm-up calculator. (Strong, Boostcamp, Hevy)
8. Shareable post-workout cards, especially the real-world volume comparison. (Hevy)
9. Exercise demonstration videos/animations attached to every movement. (Hevy 400–500+, Alpha Progression 795, JEFIT)
10. A responsive developer who ships requested features and a lifetime purchase option instead of a subscription. (Liftin')

## O. SOURCES

- https://www.hevyapp.com/features/track-workouts/
- https://www.hevyapp.com/features/workout-set-types/
- https://www.hevyapp.com/features/workout-rest-timer/
- https://www.hevyapp.com/features/workout-settings/
- https://www.hevyapp.com/features/exercise-programming-options/
- https://www.hevyapp.com/features/live-activity/
- https://www.hevyapp.com/features/shareable/
- https://www.hevyapp.com/hevy-tutorial/
- https://help.hevyapp.com/hc/en-us/articles/33882110558743-Workout-Settings-Preferences-Timer-Warm-up-calculator-Plate-Calculator-Smart-Superset-Scrolling
- https://help.hevyapp.com/hc/en-us/articles/35650286563095-The-Complete-Guide-to-Supersets-and-Smart-Superset-Scrolling
- https://help.strongapp.io/article/229-my-first-workout
- https://help.strongapp.io/article/231-rest-timer
- https://help.strongapp.io/article/166-set-tags
- https://help.strongapp.io/article/98-supersets-and-circuits
- https://help.strongapp.io/article/169-plate-calculator
- https://help.strongapp.io/article/226-focus-metric
- https://help.strongapp.io/article/217-lost-data
- https://www.boostcamp.app/workout-tracker
- https://barbend.com/boostcamp-review/
- https://www.garagegymreviews.com/boostcamp-review
- https://setgraph.app/articles/fast-workout-tracking-with-swipe-actions-in-setgraph
- https://setgraph.app/ai-blog/best-app-for-tracking-workouts
- https://repreturn.com/best-workout-tracking-app/
- https://apps.apple.com/us/app/hevy-workout-tracker-gym-log/id1458862350
- https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577
- iTunes customer-review RSS feeds (verbatim reviews): id=1458862350 (Hevy), 464254577 (Strong), 1041517543 (Fitbod), 1529354455 (Boostcamp), 1209781676 (Setgraph), 1462277793 (Alpha Progression), 1445041669 (Liftin'), 449810000 (JEFIT)
- https://www.gymnoteplus.com/blog/how-to-track-strength-workouts-on-apple-watch
- https://www.cultofmac.com/news/reps-and-sets-strength-training-app
- https://m3.material.io/foundations/designing/structure
- https://blog.logrocket.com/ux-design/all-accessible-touch-target-sizes/

## Risks

- Rewriting the local schema between versions is how Boostcamp lost a year of a user's data — every migration needs a pre-migration backup file the app can roll back to, and a post-migration row-count assertion.
- Cloud-first identity is how Strong loses workouts: if a user signs in with a different provider they get an empty account. Local-first with an explicit merge prompt is the only safe model.
- Auto-progression and AI 'coach tips' generate more 1-star reviews than any other feature when they override user numbers; ship them as accept-able ghost values only.
- Any redesign of the set table after launch will generate 'the update ruined it' reviews; version the logging screen and keep a 'classic layout' toggle if you ever change it.
- iOS Live Activity has a hard budget (8 hours, plus system-imposed update throttling) and Android background restrictions vary wildly by OEM (Xiaomi/Huawei/Samsung aggressive killers) — the timer must be correct on resume even if no background execution happened at all.
- Claiming 'every exercise that exists' means the search must stay fast and precise at 1,500+ entries; an unranked fuzzy search over a huge library is worse than a small curated one.
- Gating any part of the act of logging behind a paywall reproduces Strong's '3 templates should be illegal' and Fitbod's 'scam' review clusters.
- Animated demo GIFs for every exercise are a large asset payload; if they block the exercise picker from rendering, you have made search slower to win a nice-to-have.
