# Stronger 2.0 — Progress Photo & Bodyweight Tracking: capture flow, binding model, comparison UI, privacy architecture, storage engineering, smoothing/projection math, and eating-disorder safety

## Summary

Progress photos are the highest-trust, highest-churn-risk feature in the app: users will not adopt it unless the privacy story is structural, not a promise. The spec therefore inverts the normal default — photos live only in app-internal storage, encrypted with a Secure Enclave / StrongBox-wrapped per-photo key, excluded from iCloud/Android backup, never written to the OS photo library (we never even request add-to-library permission), and structurally unable to reach the Community tab because they live in a separate store with no API path to the post composer. Cloud backup is opt-in and end-to-end encrypted with a 12-word recovery code; "delete everything" is a crypto-shred of the vault key, which makes every ciphertext blob unrecoverable instantly rather than waiting on a server purge queue.

The capture flow is the product. Competitors (Hevy, MacroFactor) make you open Profile → Measures → + → Add Picture, one photo per day, no alignment help. Hevy explicitly limits you to one photo per day, so a front/side/back set takes three days — that is a bug presented as a feature. Our flow is a single sheet from the Log tab: on-device pose landmarks (Vision's 19-point body pose on iOS, MediaPipe's 33-point BlazePose on Android) score your live frame against the stored reference landmarks from your last session, a ghost overlay of the previous photo plus a Sobel edge silhouette shows framing, and the shutter fires automatically when alignment holds for 400 ms. Front → side → back with auto-advance lands at ~25 s. Critically, those landmarks are computed for framing only and are never persisted: under GDPR a photograph becomes Article 9 biometric data only when processed "through specific technical means allowing the unique identification" of a person, so we keep alignment strictly non-identifying and run zero face recognition.

The bodyweight math follows the Hacker's Diet lineage that Libra and TrendWeight already proved users trust, but implemented in continuous time so irregular weigh-ins are handled correctly: trend += (1 − e^(−Δt/τ))·(weight − trend) with τ = 10 days. At Δt = 1 day that yields α = 0.0952, which is exactly John Walker's "add one tenth of the difference" rule and matches fourmilab's stated ~20-day simple-moving-average equivalence (N = 2/α − 1 = 20.0), half-life 6.93 days. Two things nobody else does: we Huber-gate outliers against a MAD-derived residual scale so a post-carb-load 2 kg spike doesn't yank the line, and we expose lag correction — a first-order filter trailing a ramp sits r·τ behind, so at 0.5 kg/week the raw trend reads 0.71 kg high. Rate comes from weighted OLS on trend values over 28 days with a confidence interval, and the projection is shown as a date *band*, damped and capped at min(90 days, 2× history), never a single confident date.

Goal setting is where a fitness app can do real harm. 21.4% of 393 reviewed weight-loss apps have goal-setting at all, and 6.78% of one weight-loss app community wanted an underweight target. MyFitnessPal's warning is dismissible; ours is a hard floor at BMI 18.5, no weight goals at all under 18, loss capped at 1%/week, and a blind mode that shows trend direction and photos with the number hidden.

## Findings

### Hacker's Diet trend: α = 0.1/day, ≈20-day SMA equivalent, 6.93-day half-life

John Walker's Hacker's Diet trend line is an exponentially smoothed moving average with smoothing constant 0.9 (i.e. α = 0.1): the trend adjusts by taking one tenth of the difference between today's measurement and the existing trend. Fourmilab states this is "roughly equivalent to a 20 day simple moving average in terms of lagging the trend." This checks out analytically: for α = 0.1, equivalent SMA N = 2/α − 1 = 19.0; for the continuous-time form with τ = 10 days, the daily α = 1 − e^(−0.1) = 0.09516, giving N = 2/α − 1 = 20.02 and half-life = τ·ln2 = 6.93 days. Walker's own example shows an individual whose daily scale readings spanned 6 lb while true weight varied by 1 lb — a 6:1 noise-to-signal ratio, which is the entire justification for smoothing.

Source: https://www.fourmilab.ch/hackdiet/e4/signalnoise.html

### Libra uses a continuous-time EWMA that correctly handles irregular weigh-in gaps — copy this, not the naive daily version

Libra's documented formula is: smoothingDays = 7 (adjustable in advanced prefs); smoothingTime = smoothingDays * msPerDay; time = dateInMs − previousDateTime.inMs; power = 1 − e^(−time/smoothingTime); trend = previousTrend + power * (weight − previousTrend). Libra explicitly credits the Hacker's Diet formula. The Δt-aware exponent is the key engineering detail: it means a user who skips 10 days gets a trend that jumps appropriately instead of crawling, and it removes any need to impute missing days. Note the published page renders the exponent without the minus sign; the sign must be negative or `power` goes negative for all positive Δt.

Source: https://libra-app.eu/support/trend/

### Libra's forecast: linear regression on TREND values (not raw weights), 7-day window default, capped at 6 months

Libra computes a best-fit line using simple linear regression over the trend values for each entry in a configurable window (default 7 days), slope = rate of change; projections extend up to six months. Special cases: 2 points → direct extrapolation; 1 point → interpolate trend at window start then extrapolate. Regressing on the smoothed series rather than raw weights is what stops the forecast jumping every morning. Their 7-day window is too short for a stable slope (it re-fits over a series whose own time constant is 7 days); we should use 28 days.

Source: https://libra-app.eu/support/forecast/

### Real within-week weight fluctuation is ~0.35% of bodyweight, Monday heaviest / Friday lightest; Christmas costs ~1.35% (~1.10 kg)

PLOS ONE multi-centre European weight-loss-maintenance study: within-week fluctuations of 0.35% body weight, characterised by weekend gain and weekday reduction, heaviest day Monday and lightest day Friday (n=1,421 for the weekly analysis). Christmas period: mean increase of 1.35% (SD 1.74) body weight ≈ 1.10 kg (n=1,062), still elevated ~0.35% (<0.30 kg) above pre-Christmas levels through March. Annual fluctuation ~0.8%, driven mainly by the Christmas effect (n=1,242). These are the numbers to use for outlier-gate thresholds and for the copy that explains why the app shows a trend instead of the raw number.

Source: https://pmc.ncbi.nlm.nih.gov/articles/PMC7192384/

### GDPR: progress photos are health data under Art. 9, but only become BIOMETRIC data if processed for unique identification — this is a hard design constraint

A photograph is biometric data under Article 9 only when it is "processed through specific technical means allowing the unique identification or authentication of a natural person." Ordinary storage of a photo is not Art. 9 biometric processing; running it through facial recognition to identify someone is. Separately, health data (physical or mental health) is special-category regardless of whether a medical professional is involved, so a body photo tied to weight is Art. 9 health data either way. Consequence for us: we may run pose landmarks for framing (non-identifying, ephemeral, never stored) but must never run face recognition, face clustering, or identity matching on progress photos. Art. 9 also requires a cumulative lawful basis — an Art. 6 basis AND an Art. 9 exception, in practice Art. 9(2)(a) explicit consent, which must be a separate affirmative act from accepting the ToS.

Source: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-is-special-category-data/ and https://gdpr-info.eu/art-9-gdpr/

### A DPIA is mandatory (Art. 35(3)(b)) for large-scale special-category processing — health/wellness apps and wearables are named as a common trigger

Article 35 makes a DPIA mandatory for (a) systematic extensive automated evaluation/profiling with significant effects, (b) large-scale processing of special-category data, (c) large-scale systematic monitoring of public areas. Health or wellness data processing including apps and wearables is among the most common commercial DPIA triggers. Also binding: Art. 5(1)(c) data minimisation (collect only what is needed — for special-category data this is emphasised), Art. 5(1)(e) storage limitation (a standing obligation to delete or anonymise at the end of the retention period whether or not anyone asks), Art. 17 erasure, Art. 20 portability. Ship the DPIA before the feature, not after.

Source: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/data-protection-impact-assessments-dpias/when-do-we-need-to-do-a-dpia/

### Competitor gap: Hevy caps you at ONE progress photo per day and tells users to spread a front/side/back set across three days

Hevy's own docs: "As of now, you can upload one progress photo per day, along with other information like your body weight, body fat, and circumference measurements" — users wanting three photos are told to "upload a photo per entry for three days in a row." Flow is Profile → Measures → + → Add Picture, then log weight/body fat/14 circumference sites. Comparison is: tap a photo, position it side-by-side with another. Privacy stance: "Even if your profile is public, progress photos are private" — they are never shown to other users. No ghost overlay, no pose guidance, no slider, no timeline. This is the bar to clear and it is low.

Source: https://www.hevyapp.com/features/progress-photos/ and https://help.hevycoach.com/en/articles/9148649-progress-pictures

### Competitor gap: MacroFactor has front/side/back + before-after + auto-generated share card, but no alignment guidance and no stated encryption

MacroFactor's Body Metrics release supports front, side and back views, upload-or-capture in-app, a gallery that shows each photo alongside the body metrics recorded that day, dynamic theming that tints the gallery chrome to the photo, a Before/After comparison tool, and an auto-generated share image you can save, send, or publish to social. Their privacy notice distinguishes progress photos from other account data (support-team access toggle explicitly excludes progress photos). But the announcement gives no detail on storage location, encryption, or retention — and there is no ghost overlay or pose guidance at all. Their share-card generation is the one thing worth matching directly.

Source: https://macrofactor.com/body-metrics/ and https://macrofactorapp.com/app-personal-data-protection-information/

### Ghost-overlay is table stakes in the dedicated progress-photo app category — but nobody has combined it with pose-landmark auto-capture

Metamorph: "every time you take a new photo, an alignment overlay shows a ghost of your previous shot so you can match your position, distance, and angle before you capture anything." Progress Pics (Photo Then & Now): ghost overlays, body silhouette templates for front/back/side, voice-activated timer for hands-free capture, pinch-to-zoom. Body Tracker – Photo Journey: "Ghost Mode" plus thirds grid, selfie lines, body templates, optional countdowns. MatchFrame / EZ Progress: semi-transparent anchor photo over the live camera with adjustable opacity. All of these are manual eyeball alignment. None score alignment automatically or fire the shutter on a match — that is our differentiator and it is what makes a three-pose set fit in under 30 seconds.

Source: https://tinyideas.net/metamorph/blog/best-before-and-after-photo-app/ and https://apps.apple.com/us/app/progress-pics-photo-then-now/id6758411454

### On-device pose: Apple Vision gives 19 body points (iOS 14+), MediaPipe BlazePose gives 33 landmarks with z-depth and per-landmark visibility scores

VNDetectHumanBodyPoseRequest detects 19 2D points across face, torso, arms and legs, on-device since iOS 14; points are retrieved via recognizedPoints(forGroupKey:) with VNRecognizedPointGroupKeyAll or per-group. MediaPipe Pose Landmarker returns 33 keypoints; BlazePose provides x,y normalised to [0,1] plus relative depth z and a visibility score per landmark. Both run real-time on mid-range phones. For alignment we only need shoulders, hips and ankles — the intersection of both APIs — so the same alignment scorer works cross-platform against a 6-point subset. Visibility scores let us reject frames where the subject is partially out of frame before scoring.

Source: https://developer.apple.com/videos/play/wwdc2020/10653/ and https://developer.android.com/ai/mediapipe

### iOS Data Protection classes: use NSFileProtectionComplete, and know that it is a no-op without a device passcode

Four classes: NSFileProtectionComplete (Class A — key discarded ~10 s after lock, file inaccessible while locked); NSFileProtectionCompleteUnlessOpen (Class B — ECC-based, allows background writes to an already-open file); NSFileProtectionCompleteUntilFirstUserAuthentication (Class C — the DEFAULT for third-party app data, key stays in memory after lock, roughly equivalent to full-volume encryption); NSFileProtectionNone (Class D). Critical caveat: Data Protection relies on the device passcode — on the Simulator or a device with no passcode, the attribute is reported but files remain readable. That is exactly why we add our own app-layer AES-256-GCM on top rather than trusting the OS class alone.

Source: https://support.apple.com/guide/security/data-protection-classes-secb010e978a/web

### Android: EncryptedFile uses Streaming AEAD (AES256-GCM, chunked, reorder-resistant); app-internal filesDir is never media-scanned; .nomedia is the belt-and-braces for anything external

Jetpack Security's EncryptedFile encrypts with Streaming AEAD following the OAE2 definition — data is split into chunks encrypted with AES256-GCM such that chunks cannot be reordered — and exposes ordinary FileInputStream/FileOutputStream. For gallery exclusion: an empty `.nomedia` file in a directory causes MediaScannerService to skip that directory and everything beneath it before opening any files. Since Android 10's scoped storage, app-private internal storage (context.filesDir) is not indexed by MediaStore at all, so `.nomedia` is only needed if you ever touch external dirs — which we should not. Note that some third-party gallery apps ignore `.nomedia`, which is another reason to stay in internal storage.

Source: https://android-developers.googleblog.com/2020/02/data-encryption-on-android-with-jetpack-security/ and https://developer.android.com/jetpack/androidx/releases/security

### Eating-disorder risk is measurable and app design is implicated — 30% of surveyed ED patients who used MyFitnessPal believed it contributed to their disorder

A University of Louisville survey of 105 diagnosed eating-disorder patients found 30% of participants used MyFitnessPal and believed it contributed to their eating disorder. MyFitnessPal shows a pop-up when a weight goal would put the user at an underweight BMI — but allows users to dismiss it and continue; its 1,200 kcal floor is documented as easily evaded. In one weight-loss app community, 6.78% (1,261/18,601) wanted to be underweight, most identifying as female. A scoping review of 393 weight-loss apps found goal-setting present in only 21.4% (84/393), and commercial weight apps broadly lack evidence-based features, do not involve health-care experts in development, and have not been rigorously tested. Longitudinal and cross-sectional work links diet/fitness app self-monitoring to higher prevalence of disordered weight-control behaviours (fasting, purging).

Source: https://mhealth.jmir.org/2017/10/e150/ , https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4978862/ , https://pmc.ncbi.nlm.nih.gov/articles/PMC8832499/

### Safe-rate guidance to hard-code: CDC 1–2 lb/week; NHS/NICE 0.5–1 kg/week

CDC: people who lose weight at a gradual steady pace of about 1 to 2 pounds a week are more likely to keep it off. NHS England, supported by NICE, gives 0.5–1 kg per week as the sustainable range for most adults. The two ranges overlap almost exactly (1–2 lb = 0.45–0.9 kg). This corresponds to roughly a 500–1,000 kcal/day deficit. Use these as the citable basis for the app's rate cap and for the copy shown when a user's requested rate is rejected — the app must show its source, which also satisfies Apple's Guideline 1.4.1 requirement that health calculations disclose data and methodology.

Source: https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html and NHS/NICE weight-management guidance

### Apple Guideline 1.4.1 requires disclosed methodology for health calculations; apps have been rejected for BMI/RMR maths without sources

Apps must clearly disclose data and methodology to support accuracy claims relating to health measurements, and if accuracy or methodology cannot be validated Apple will reject the app. A real-world rejection cited in developer forums: a fitness app rejected under 1.4.1 for providing health/medical calculations (customer BMI and RMR) without including sources. Apps should also remind users to check with a doctor before making medical decisions. Practical consequence: every derived number we show — trend, projected date, BMI floor, rate cap — needs an in-app "how this is calculated" disclosure with the citation, or the feature is a submission risk.

Source: https://developer.apple.com/app-store/review/guidelines/

### UK Online Safety Act 2023 classes eating-disorder-promoting content as primary priority content harmful to children — this reaches our Community tab, not just the photo feature

Under the OSA, content which encourages, promotes or provides instructions for an eating disorder or behaviours associated with one is "primary priority content that is harmful to children." User-to-user services must ensure children are not exposed to it, including highly effective age assurance where such content is not prohibited outright. Beat notes the Act does not cover ordinary diet and fitness content, which can still harm people with eating disorders particularly when algorithmically targeted. Since Stronger 2.0 has a Community feed with user posts, the cleanest posture is: prohibit ED-promoting content outright in the T&Cs and moderate for it, which avoids the age-assurance obligation, and never let the recommender optimise for leanness or weight-loss engagement.

Source: https://www.legislation.gov.uk/ukpga/2023/50/section/61/enacted and https://www.beateatingdisorders.org.uk/news/protecting-people-from-eating-disorder-content-the-online-safety-act/

### Compression targets: AVIF ~50% smaller than JPEG and 20–30% smaller than WebP; HEIF ~50% smaller than JPEG; AVIF q50 ≈ JPEG q75 at half the size

AVIF cuts large photographic images from 200–500 KB JPEG down to 60–150 KB with no visible difference; a 2 MB hero drops to ~400 KB with no perceptible loss. HEIF is ~50% smaller than JPEG at equivalent quality; WebP lands 25–35% smaller. AVIF at quality 50 is comparable to JPEG at 75. For a 1600px-long-edge full-body indoor photo this puts a realistic p50 at ~200–250 KB in AVIF/HEIC. Platform split: HEIC is native and hardware-accelerated on iOS; AVIF encode is available on Android 12+ / via libavif but is slow on older hardware, so WebP q80 is the Android fallback (≈ +30% size).

Source: https://cloudinary.com/blog/advanced-image-formats-and-when-to-use-them and https://shortpixel.com/blog/avif-vs-webp/

### Kalman smoothing is not worth it over EWMA for bodyweight, and imputation systematically understates variability

A JMIR simulation/validation study on smart-scale data found structural modelling with a Kalman smoother and EWMA both imputed effectively, but imputations produced large underestimations of body-weight variability due to regression toward the mean. Separately, EWMA is documented as a viable alternative to the Kalman filter, giving similar accuracy with improved robustness and dynamic response at substantially lower computational cost. Two engineering conclusions: (1) ship EWMA, not a Kalman filter — the extra machinery buys nothing users can see; (2) never impute missing weigh-ins into the stored series, because it corrupts any variability statistic you later compute. Gaps should be handled by the Δt-aware exponent, which is exactly what Libra does.

Source: https://www.sciencedirect.com/org/science/article/pii/S2291522220005446

### Health Connect and HealthKit both give a clean weight path, and Health Connect keeps data on-device encrypted by default

Health Connect supports 50+ data types including body measurements (weight, height, body fat percentage, bone mass); writing is WeightRecord with Mass.kilograms(value) via healthConnectClient.insertRecords. Permissions are granular per-app and per-data-type and revocable, with a user-visible access log and a data-source priority list. All Health Connect data stays on the device in encrypted form with no automatic cloud sync. HealthKit gives the equivalent HKQuantityTypeIdentifier.bodyMass with separate read and write authorisation. Recommendation: two-way sync bodyweight only, never photos or measurements-with-photos, and treat the platform store as a peer source with our own first-of-day de-duplication.

Source: https://developer.android.com/health-and-fitness/health-connect/data-types

## Recommendations

- Implement the trend line as a continuous-time EWMA, trend += (1 − e^(−Δt/τ))·(w − trend) with τ = 10 days, so irregular weigh-ins are handled without imputation and the daily case reproduces the Hacker's Diet α = 0.1 exactly.

## Data

TODO

## Risks

- Photo capture is a permissions cliff: if the first-run sheet asks for camera + notifications + Health at once, adoption collapses. Ask for camera only, at the moment of first capture, with the on-device-only promise on the same screen.
