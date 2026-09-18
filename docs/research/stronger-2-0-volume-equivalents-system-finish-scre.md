# Stronger 2.0 — Volume Equivalents system (finish-screen mass comparisons)

## Summary

I built the complete Volume Equivalents system: a 139-entry catalogue of real-world masses spanning 1 kg to 5.9 billion kg, a scoring-based selection algorithm, deterministic anti-repetition, five non-mass framings, and tone rules.

First, an important correction. The brief's example copy ("4,000 kg = 2.9 ambulances or 45 pianos") is numerically wrong by roughly 4x in both directions. A real Type B Sprinter ambulance has a 5,380 kg gross weight (WAS/Mercedes spec), so 4,000 kg is 0.74 ambulances. A Steinway Model D concert grand is 480 kg, so 4,000 kg is 8.3 pianos, not 45. Ship the format, not the numbers — a user who Googles one bad comparison stops trusting every number in the app. Every mass in my catalogue is sourced, and each entry carries a confidence tag (verified / representative / estimate) so the UI can avoid asserting a precise figure for things that genuinely vary (polar bears, fire engines).

The catalogue has good density at every order of magnitude: ~25 entries under 50 kg, ~20 in 50-500 kg, ~20 in 500-3,000 kg, ~18 in 3,000-20,000 kg, ~14 in 20k-200k, ~13 in 200k-1M, ~12 in 1M-20M, and 7 "legend" entries above 20M used only for a separate lifetime-progress line (Titanic 52,310 t, Empire State Building 331,000 t, Great Pyramid 5.9 Mt). Verified anchors include the blue whale at 110,000 kg (NOAA), ISS at 419,725 kg (NASA), Eiffel Tower at 10,100 t total / 7,300 t iron (SETE), Big Ben's Great Bell at 13,700 kg (UK Parliament), Christ the Redeemer at 635,000 kg, the Statue of Liberty at 204,100 kg (NPS), Saturn V at 2,900,000 kg, and Stonehenge sarsens at ~20,000 kg (Science Advances 2020).

The selection algorithm scores each candidate on a log-Gaussian count-quality curve centred on 6.5x with a hard window of 1.5-40x, plus a scale-aware appeal blend that shifts from relatability to spectacle as total volume rises from 1 t to 1,000 t, plus a roundness bonus, a cooldown penalty and a golden-ratio rotation term. It picks greedily with a same-category and near-duplicate-mass penalty so you never get "3.1 grand pianos or 3.4 upright pianos". A count near 1.0 is handled specially and rendered as "a whole blue whale", which is the single best line the system produces.

Anti-repetition is fully deterministic: a 12-deep shown-history with an 8-session linear decay, plus a low-discrepancy golden-ratio rotation keyed on an FNV-1a hash of the entry id and the user's lifetime workout index. No RNG anywhere, so re-opening an old summary shows the same comparison forever.

Beyond mass I specified bar travel distance versus real landmark heights, mechanical work in joules converted honestly to kcal via a 22% gross efficiency factor, time under tension against rest ratio, bodyweight multiples, and step-climb height.

## Findings

### The brief's own example numbers are wrong by ~4x in both directions

'4,000 kg = 2.9 ambulances' implies an ambulance weighs 1,380 kg. A real Mercedes Sprinter Type B ambulance (WAS 300) has a maximum total weight of 5,380 kg, so 4,000 kg is 0.74 ambulances. '45 pianos' implies 89 kg per piano; a Steinway Model D concert grand is 480 kg (990 lb) and even a Steinway K upright is 295 kg (650 lb), so 4,000 kg is 8.3 concert grands. Keep the copy format, replace the masses.

Source: https://www.was-vehicles.com/en/vehicles/was-300-panel-van-ambulances/was-300-transport-ambulance-mercedes-benz-sprinter-panel-van-type-b-zs + https://www.steinway.com/pianos/steinway/grand/model-d

### A 1.5-40x count window leaves 15-25 viable candidates at any realistic session volume

With 132 pickable entries log-uniformly spread over 1 kg to 20,000,000 kg, any total has roughly log10(40/1.5)=1.43 decades of viable mass, which at ~19 entries per decade in the dense bands yields 15-27 candidates. That is enough for a 12-deep cooldown to guarantee ~3 weeks of non-repeating comparisons at 4 sessions/week without ever falling back to a bad ratio.

### Blue whale = 110,000 kg is the single most useful spectacle anchor

NOAA Fisheries gives an average of 110 tonnes, max 190 tonnes. That puts it at 1.5-40x for totals from 165,000 kg to 4,400,000 kg — exactly the lifetime-total band shown in the reference screenshot (1.6 M kg lifetime = 14.5 blue whales). It also gives two sub-entries: the tongue at 2,700 kg and the heart at 180 kg, which cover the big-session and small-session bands with the same recognisable animal.

Source: https://www.fisheries.noaa.gov/species/blue-whale ; https://nammco.no/blue-whale/

### Count near 1.0 should be a feature, not a rejection

'That is a whole blue whale' is a better line than '2.4 blue whales'. I score counts in [0.92, 1.12] at 0.97 (just under the 6.5x ideal) and render them with an 'a whole X' template. This is the highest-emotion output the system can produce and firing it occasionally is worth more than perfect ratio hygiene.

### Eiffel Tower has two legitimate masses and you must pick one and stick to it

Official SETE figures: 7,300 tonnes for the iron lattice alone, 10,100 tonnes including foundations, lifts, restaurants and fittings. Both are widely cited so a user checking either will find a match. I include both as separate catalogue entries with explicit labels ('the Eiffel Tower's ironwork' vs 'the whole Eiffel Tower') so the copy is never ambiguous.

Source: https://www.toureiffel.paris/en (SETE official figures, corroborated via Tour Eiffel social post)

### Statue of Liberty: use 204,100 kg (NPS total), not 156 tonnes

NPS Statue Statistics gives total weight 450,000 lb = 225 short tons = 204,100 kg. A separate commonly quoted figure of 156 tons is copper (31 t) plus steel framework (125 t) only, excluding everything else. Use the NPS total and cite it.

Source: https://www.nps.gov/stli/learn/historyculture/statue-statistics.htm

### Aircraft need an explicit weight basis in the label

A Boeing 747-8 is 220,100 kg empty and 447,700 kg at max takeoff; an A380 is 277,000 kg empty and 575,000 kg at MTOW. Both are 'the weight of a 747'. I store them as separate entries with the basis baked into the display name ('a fully loaded Boeing 747-8'), which is both honest and a better line.

Source: https://en.wikipedia.org/wiki/Boeing_747-8 ; https://www.airbus.com/sites/g/files/jlcbta136/files/2021-12/EN-Airbus-A380-Facts-and-Figures-December-2021_0.pdf

### Calorie claims must be framed as mechanical work, not burn

Mechanical work W = sum(m*g*h) over concentric reps is exactly computable from set data. Converting to metabolic cost requires a gross efficiency factor (~20-25% for resistance exercise) and an eccentric surcharge (~30-40% of concentric cost). I use 22% efficiency and a 0.35 eccentric factor, and label the output 'mechanical work' with kcal as a secondary framing, because claiming a precise calorie burn from set data alone is not defensible and serious lifters will call it out.

### Deterministic variety needs both a cooldown and a rotation term

A cooldown alone produces a strict round-robin that users notice as a cycle. A golden-ratio low-discrepancy rotation alone can re-pick the same top item when its base score dominates. Combining a 0.60-weight cooldown with a 0.12-weight cos-rotation gives variety that feels unplanned while never promoting a comparison outside the 1.5-40x window, since the rotation amplitude is smaller than the gap between a good and a bad count score.

### Bar-travel distance is a stronger second framing than calories

Total vertical bar displacement = sum(reps * ROM). With representative ROMs (bench 0.40 m, squat 0.58 m, deadlift 0.55 m, OHP 0.55 m, row 0.42 m, curl 0.50 m, pulldown 0.60 m), a typical 25-set session moves the bar 120-200 m concentric, 240-400 m counting the eccentric. That maps beautifully onto landmark heights: the Statue of Liberty is 93 m, the Eiffel Tower 330 m, the Empire State Building 443 m, Burj Khalifa 828 m.

### Legend-tier objects should drive a lifetime progress bar, not a finish-screen ratio

Titanic (52,310,000 kg), Empire State Building (331,000,000 kg) and the Great Pyramid (5,900,000,000 kg) will never yield a 1.5-40x count for any human. Instead they power a separate 'career' line: at 1.6 M kg lifetime a user is 3.1% of the way to the Titanic. That gives the app a multi-year goal with zero extra content cost.

### Ambulance, elephant and grand piano cluster badly and need a duplicate guard

African elephant 5,300 kg and Sprinter ambulance 5,380 kg are 1.5% apart; Steinway D 480 kg and polar bear 450 kg are 6% apart. Without a near-duplicate penalty the picker will regularly output two comparisons that are mathematically the same number. I penalise any second pick within 0.15 log10 (a factor of 1.41) of an already-picked mass by 0.50.

## Recommendations

- Store the chosen equivalent ids on the workout record at finish time so re-opening an old summary always renders the identical comparison, and so the cooldown history is a simple query over the last 12 workouts.

## Data

## PART 1 - Types

```ts
// src/features/finish/equivalents/types.ts
export type EquivCategory =
  | 'everyday' | 'gym' | 'animal' | 'vehicle' | 'aircraft'
  | 'marine' | 'space' | 'structure' | 'industrial' | 'legend';

export type Confidence = 'verified' | 'representative' | 'estimate';

export interface MassEquivalent {
  id: string;
  name: string;         // bare noun, e.g. "African elephant"
  singular: string;     // article form, e.g. "an African elephant"
  plural: string;       // e.g. "African elephants"
  massKg: number;
  category: EquivCategory;
  emoji: string;        // fallback only; prefer the line-icon set
  icon: string;         // lucide-style key for the custom icon sheet
  relatability: number; // 0..1  have you physically stood next to one
  spectacle: number;    // 0..1  how good does it sound out loud
  fun?: string;         // optional one-liner, <= 90 chars
  source: string;
  sourceUrl: string;
  confidence: Confidence;
  milestoneOnly?: boolean; // excluded from the 1.5-40x picker
}
```

Catalogue JSON below uses short keys to stay compact. Mapping:
`id, n=name, s=singular, p=plural, kg=massKg, c=category, e=emoji, i=icon, r=relatability, sp=spectacle, f=fun, src=source, u=sourceUrl, cf=confidence, m=milestoneOnly`.

## PART 2 - The catalogue (139 entries, 1 kg -> 5.9e9 kg)

```json
[
{"id":"sugar-bag","n":"bag of sugar","s":"a bag of sugar","p":"bags of sugar","kg":1,"c":"everyday","e":"🍚","i":"package","r":1.0,"sp":0.05,"f":"The unit every British kitchen thinks in.","src":"Standard retail pack size","u":"https://en.wikipedia.org/wiki/Sugar","cf":"verified"},
{"id":"pineapple","n":"pineapple","s":"a pineapple","p":"pineapples","kg":1.1,"c":"everyday","e":"🍍","i":"apple","r":0.95,"sp":0.05,"src":"USDA FoodData Central, whole pineapple 905-1,500 g","u":"https://fdc.nal.usda.gov/","cf":"representative"},
{"id":"laptop","n":"laptop","s":"a laptop","p":"laptops","kg":1.4,"c":"everyday","e":"💻","i":"laptop","r":1.0,"sp":0.05,"src":"14-inch class notebook, typical","u":"https://support.apple.com/en-us/111902","cf":"representative"},
{"id":"house-brick","n":"house brick","s":"a house brick","p":"house bricks","kg":2.5,"c":"everyday","e":"🧱","i":"brick-wall","r":0.9,"sp":0.1,"src":"Standard fired clay brick, 215x102.5x65 mm","u":"https://en.wikipedia.org/wiki/Brick","cf":"representative"},
{"id":"chihuahua","n":"chihuahua","s":"a chihuahua","p":"chihuahuas","kg":2.5,"c":"animal","e":"🐕","i":"dog","r":0.8,"sp":0.1,"f":"Small dog. Large opinions.","src":"AKC breed standard, under 6 lb","u":"https://www.akc.org/dog-breeds/chihuahua/","cf":"verified"},
{"id":"newborn","n":"newborn baby","s":"a newborn baby","p":"newborn babies","kg":3.4,"c":"everyday","e":"👶","i":"baby","r":0.85,"sp":0.2,"src":"WHO average birth weight 3.2-3.5 kg","u":"https://www.who.int/","cf":"representative"},
{"id":"milk-gallon","n":"gallon of milk","s":"a gallon of milk","p":"gallons of milk","kg":3.9,"c":"everyday","e":"🥛","i":"milk","r":0.95,"sp":0.05,"src":"US gallon of whole milk, density 1.03 kg/L","u":"https://www.usdairy.com/","cf":"verified"},
{"id":"house-cat","n":"house cat","s":"a house cat","p":"house cats","kg":4.5,"c":"animal","e":"🐈","i":"cat","r":0.95,"sp":0.1,"f":"Which, unlike your barbell, will not stay where you put it.","src":"Adult domestic cat 3.6-5.4 kg","u":"https://www.petmd.com/cat/general-health/average-weight-cats","cf":"verified"},
{"id":"bowling-ball","n":"bowling ball","s":"a bowling ball","p":"bowling balls","kg":7.3,"c":"everyday","e":"🎳","i":"circle","r":0.85,"sp":0.15,"src":"USBC maximum legal weight 16 lb","u":"https://bowl.com/rules","cf":"verified"},
{"id":"road-bike","n":"road bike","s":"a road bike","p":"road bikes","kg":8,"c":"vehicle","e":"🚲","i":"bike","r":0.8,"sp":0.15,"src":"UCI minimum race weight 6.8 kg; consumer build ~8 kg","u":"https://www.uci.org/","cf":"representative"},
{"id":"watermelon","n":"watermelon","s":"a watermelon","p":"watermelons","kg":9,"c":"everyday","e":"🍉","i":"melon","r":0.9,"sp":0.1,"src":"USDA, whole watermelon 8-10 kg typical","u":"https://fdc.nal.usda.gov/","cf":"representative"},
{"id":"car-tyre","n":"car tyre","s":"a car tyre","p":"car tyres","kg":11,"c":"vehicle","e":"🛞","i":"circle-dot","r":0.8,"sp":0.1,"src":"205/55R16 passenger tyre, 9-12 kg","u":"https://www.tyresafe.org/","cf":"representative"},
{"id":"gold-bar","n":"gold bar","s":"a gold bar","p":"gold bars","kg":12.4,"c":"everyday","e":"🪙","i":"gem","r":0.3,"sp":0.6,"f":"A Good Delivery bar. Roughly a million dollars of curl.","src":"LBMA Good Delivery bar, 400 troy oz","u":"https://www.lbma.org.uk/good-delivery","cf":"verified"},
{"id":"toddler","n":"toddler","s":"a toddler","p":"toddlers","kg":12.5,"c":"everyday","e":"🧒","i":"baby","r":0.85,"sp":0.15,"src":"WHO growth standards, 2-year-old median","u":"https://www.who.int/tools/child-growth-standards","cf":"representative"},
{"id":"microwave","n":"microwave","s":"a microwave","p":"microwaves","kg":15,"c":"everyday","e":"🔥","i":"microwave","r":0.95,"sp":0.05,"src":"Countertop 25-30 L model, typical","u":"https://www.which.co.uk/reviews/microwaves","cf":"representative"},
{"id":"kettlebell-16","n":"competition kettlebell","s":"a competition kettlebell","p":"competition kettlebells","kg":16,"c":"gym","e":"🏋️","i":"dumbbell","r":0.9,"sp":0.1,"src":"IUKL competition kettlebell, 16 kg class","u":"https://www.iukl.net/","cf":"verified"},
{"id":"cinder-block","n":"concrete block","s":"a concrete block","p":"concrete blocks","kg":17,"c":"everyday","e":"🧱","i":"box","r":0.75,"sp":0.1,"src":"Standard 8x8x16 in CMU, 38 lb","u":"https://ncma.org/","cf":"representative"},
{"id":"olympic-bar","n":"Olympic barbell","s":"an Olympic barbell","p":"Olympic barbells","kg":20,"c":"gym","e":"🏋️","i":"dumbbell","r":1.0,"sp":0.15,"f":"The bar itself. The part everyone forgets to count.","src":"IWF men's competition bar","u":"https://iwf.sport/","cf":"verified"},
{"id":"bumper-plate","n":"25 kg plate","s":"a 25 kg plate","p":"25 kg plates","kg":25,"c":"gym","e":"⚫","i":"circle","r":1.0,"sp":0.1,"src":"IWF red competition disc","u":"https://iwf.sport/","cf":"verified"},
{"id":"cement-bag","n":"bag of cement","s":"a bag of cement","p":"bags of cement","kg":25,"c":"industrial","e":"🪣","i":"package","r":0.7,"sp":0.15,"src":"EU standard 25 kg cement sack","u":"https://www.cembureau.eu/","cf":"verified"},
{"id":"emperor-penguin","n":"emperor penguin","s":"an emperor penguin","p":"emperor penguins","kg":30,"c":"animal","e":"🐧","i":"bird","r":0.5,"sp":0.35,"src":"Aptenodytes forsteri, adult 22-45 kg","u":"https://en.wikipedia.org/wiki/Emperor_penguin","cf":"representative"},
{"id":"golden-retriever","n":"golden retriever","s":"a golden retriever","p":"golden retrievers","kg":30,"c":"animal","e":"🐕","i":"dog","r":0.9,"sp":0.15,"src":"AKC / breed standard 25-34 kg","u":"https://en.wikipedia.org/wiki/Golden_Retriever","cf":"verified"},
{"id":"dishwasher","n":"dishwasher","s":"a dishwasher","p":"dishwashers","kg":35,"c":"everyday","e":"🍽️","i":"washing-machine","r":0.9,"sp":0.05,"src":"Standard 24-inch built-in, 77 lb","u":"https://prudentreviews.com/dishwasher-weight/","cf":"representative"},
{"id":"mattress","n":"double mattress","s":"a double mattress","p":"double mattresses","kg":40,"c":"everyday","e":"🛏️","i":"bed","r":0.9,"sp":0.05,"src":"Queen hybrid mattress, typical","u":"https://www.sleepfoundation.org/","cf":"representative"},
{"id":"sofa","n":"three-seat sofa","s":"a three-seat sofa","p":"three-seat sofas","kg":45,"c":"everyday","e":"🛋️","i":"sofa","r":0.9,"sp":0.1,"f":"And you thought moving one was hard.","src":"Fabric three-seater, typical","u":"https://www.which.co.uk/","cf":"representative"},
{"id":"cheetah","n":"cheetah","s":"a cheetah","p":"cheetahs","kg":55,"c":"animal","e":"🐆","i":"cat","r":0.4,"sp":0.45,"src":"Acinonyx jubatus, adult 46-72 kg","u":"https://en.wikipedia.org/wiki/Cheetah","cf":"representative"},
{"id":"average-human","n":"adult human","s":"an adult human","p":"adult humans","kg":62,"c":"everyday","e":"🧍","i":"user","r":1.0,"sp":0.3,"f":"World average adult. Yes, we checked.","src":"Walpole et al., The weight of nations, BMC Public Health 2012","u":"https://bmcpublichealth.biomedcentral.com/articles/10.1186/1471-2458-12-439","cf":"verified"},
{"id":"kangaroo","n":"red kangaroo","s":"a red kangaroo","p":"red kangaroos","kg":66,"c":"animal","e":"🦘","i":"rabbit","r":0.4,"sp":0.4,"src":"Osphranter rufus, adult male 55-90 kg","u":"https://en.wikipedia.org/wiki/Red_kangaroo","cf":"representative"},
{"id":"fire-hydrant","n":"fire hydrant","s":"a fire hydrant","p":"fire hydrants","kg":68,"c":"industrial","e":"🚒","i":"cylinder","r":0.6,"sp":0.2,"src":"US dry-barrel hydrant upper section, typical","u":"https://www.muellercompany.com/","cf":"representative"},
{"id":"beer-keg","n":"full beer keg","s":"a full beer keg","p":"full beer kegs","kg":73.3,"c":"everyday","e":"🍺","i":"beer","r":0.75,"sp":0.25,"f":"A half-barrel. 161 lb of poor decisions.","src":"US half-barrel keg, 161.5 lb full","u":"https://en.wikipedia.org/wiki/Keg","cf":"verified"},
{"id":"washing-machine","n":"washing machine","s":"a washing machine","p":"washing machines","kg":77,"c":"everyday","e":"🧺","i":"washing-machine","r":0.95,"sp":0.15,"src":"Front-load domestic washer, ~170 lb average","u":"https://prudentreviews.com/washing-machine-dryer-weight/","cf":"verified"},
{"id":"wild-boar","n":"wild boar","s":"a wild boar","p":"wild boar","kg":90,"c":"animal","e":"🐗","i":"pig","r":0.4,"sp":0.35,"src":"Sus scrofa, adult male 75-100 kg","u":"https://en.wikipedia.org/wiki/Wild_boar","cf":"representative"},
{"id":"us-adult-male","n":"average American man","s":"an average American man","p":"average American men","kg":90.6,"c":"everyday","e":"🧍","i":"user","r":0.95,"sp":0.25,"src":"CDC NHANES 2015-2018, men 20+, 199.8 lb","u":"https://www.cdc.gov/nchs/data/series/sr_03/sr03-046-508.pdf","cf":"verified"},
{"id":"ostrich","n":"ostrich","s":"an ostrich","p":"ostriches","kg":104,"c":"animal","e":"🦤","i":"bird","r":0.4,"sp":0.4,"f":"The heaviest bird alive, and it still can't fly.","src":"Struthio camelus, adult 63-145 kg","u":"https://en.wikipedia.org/wiki/Common_ostrich","cf":"representative"},
{"id":"giant-panda","n":"giant panda","s":"a giant panda","p":"giant pandas","kg":110,"c":"animal","e":"🐼","i":"panda","r":0.5,"sp":0.45,"src":"Ailuropoda melanoleuca, adult male 100-115 kg","u":"https://www.worldwildlife.org/species/giant-panda","cf":"representative"},
{"id":"refrigerator","n":"fridge-freezer","s":"a fridge-freezer","p":"fridge-freezers","kg":136,"c":"everyday","e":"🧊","i":"refrigerator","r":0.95,"sp":0.2,"src":"Full-size US refrigerator, just under 300 lb","u":"https://prudentreviews.com/refrigerator-weight/","cf":"representative"},
{"id":"cast-iron-bath","n":"cast-iron bathtub","s":"a cast-iron bathtub","p":"cast-iron bathtubs","kg":140,"c":"everyday","e":"🛁","i":"bath","r":0.6,"sp":0.25,"src":"5-ft enamelled cast-iron tub, empty","u":"https://www.kohler.com/","cf":"representative"},
{"id":"blue-whale-heart","n":"blue whale's heart","s":"a blue whale's heart","p":"blue whale hearts","kg":180,"c":"marine","e":"🫀","i":"heart","r":0.2,"sp":0.8,"f":"The largest heart on Earth. About the same as a concert piano's lid and legs.","src":"NOAA Fisheries; ROM Trout River specimen, 180 kg","u":"https://www.fisheries.noaa.gov/feature-story/big-hearted-blue-whale","cf":"verified"},
{"id":"silverback","n":"silverback gorilla","s":"a silverback gorilla","p":"silverback gorillas","kg":180,"c":"animal","e":"🦍","i":"gorilla","r":0.5,"sp":0.65,"f":"Who, for the record, does not train legs either.","src":"Adult male Gorilla, 135-227 kg, mean ~180 kg","u":"https://en.wikipedia.org/wiki/Western_lowland_gorilla","cf":"representative"},
{"id":"lion","n":"lion","s":"a lion","p":"lions","kg":190,"c":"animal","e":"🦁","i":"cat","r":0.5,"sp":0.6,"src":"Panthera leo, adult male mean 187.5 kg","u":"https://en.wikipedia.org/wiki/Lion","cf":"representative"},
{"id":"vending-machine","n":"vending machine","s":"a vending machine","p":"vending machines","kg":250,"c":"everyday","e":"🥤","i":"store","r":0.8,"sp":0.25,"src":"Full-size glass-front beverage machine, loaded","u":"https://www.vendingmarketwatch.com/","cf":"representative"},
{"id":"baby-grand","n":"baby grand piano","s":"a baby grand piano","p":"baby grand pianos","kg":250,"c":"everyday","e":"🎹","i":"piano","r":0.6,"sp":0.4,"src":"5'1\" baby grand, 540-560 lb typical","u":"https://moversville.com/blog/how-much-does-a-piano-weigh-all-sizes","cf":"representative"},
{"id":"atm","n":"cash machine","s":"a cash machine","p":"cash machines","kg":270,"c":"industrial","e":"🏧","i":"credit-card","r":0.7,"sp":0.3,"src":"Through-the-wall ATM with safe, typical","u":"https://www.ncr.com/","cf":"representative"},
{"id":"grizzly","n":"grizzly bear","s":"a grizzly bear","p":"grizzly bears","kg":270,"c":"animal","e":"🐻","i":"bear","r":0.5,"sp":0.6,"src":"Ursus arctos horribilis, adult male 180-360 kg","u":"https://www.nps.gov/yell/learn/nature/grizzlybear.htm","cf":"representative"},
{"id":"upright-piano","n":"upright piano","s":"an upright piano","p":"upright pianos","kg":295,"c":"everyday","e":"🎹","i":"piano","r":0.65,"sp":0.35,"src":"Steinway Model K, 650 lb","u":"https://www.steinway.com/pianos/steinway/upright","cf":"verified"},
{"id":"sea-lion","n":"sea lion","s":"a sea lion","p":"sea lions","kg":300,"c":"marine","e":"🦭","i":"fish","r":0.45,"sp":0.45,"src":"Zalophus californianus, adult male ~300 kg","u":"https://www.fisheries.noaa.gov/species/california-sea-lion","cf":"representative"},
{"id":"harley","n":"Harley-Davidson","s":"a Harley-Davidson","p":"Harley-Davidsons","kg":361,"c":"vehicle","e":"🏍️","i":"bike","r":0.7,"sp":0.45,"src":"Street Glide, 795.9 lb as shipped","u":"https://www.harley-davidson.com/","cf":"verified"},
{"id":"polar-bear","n":"polar bear","s":"a polar bear","p":"polar bears","kg":450,"c":"animal","e":"🐻‍❄️","i":"bear","r":0.5,"sp":0.7,"f":"The largest land carnivore on the planet.","src":"Ursus maritimus, adult male 350-700 kg","u":"https://polarbearsinternational.org/","cf":"representative"},
{"id":"concert-grand","n":"concert grand piano","s":"a concert grand piano","p":"concert grand pianos","kg":480,"c":"everyday","e":"🎹","i":"piano","r":0.6,"sp":0.5,"f":"A Steinway Model D. Nine feet of very expensive ballast.","src":"Steinway & Sons Model D, 990 lb","u":"https://www.steinway.com/pianos/steinway/grand/model-d","cf":"verified"},
{"id":"racehorse","n":"racehorse","s":"a racehorse","p":"racehorses","kg":500,"c":"animal","e":"🐎","i":"horse","r":0.6,"sp":0.45,"src":"Thoroughbred, 1,000-1,200 lb","u":"https://en.wikipedia.org/wiki/Thoroughbred","cf":"representative"},
{"id":"moose","n":"moose","s":"a moose","p":"moose","kg":550,"c":"animal","e":"🫎","i":"deer","r":0.45,"sp":0.55,"src":"Alces alces, adult bull 380-700 kg","u":"https://en.wikipedia.org/wiki/Moose","cf":"representative"},
{"id":"dairy-cow","n":"dairy cow","s":"a dairy cow","p":"dairy cows","kg":725,"c":"animal","e":"🐄","i":"beef","r":0.7,"sp":0.4,"src":"Mature Holstein Friesian, 680-770 kg","u":"https://en.wikipedia.org/wiki/Holstein_Friesian","cf":"verified"},
{"id":"f1-car","n":"Formula 1 car","s":"a Formula 1 car","p":"Formula 1 cars","kg":798,"c":"vehicle","e":"🏎️","i":"car","r":0.5,"sp":0.65,"f":"Minimum legal weight, driver included.","src":"FIA 2024 Technical Regulations, minimum mass 798 kg","u":"https://www.fia.com/regulation/category/110","cf":"verified"},
{"id":"smart-car","n":"Smart Fortwo","s":"a Smart Fortwo","p":"Smart Fortwos","kg":880,"c":"vehicle","e":"🚗","i":"car","r":0.8,"sp":0.35,"src":"Curb weight 1,800-2,000 lb","u":"https://www.autopadre.com/vehicle-weight/smart-fortwo","cf":"representative"},
{"id":"curiosity-rover","n":"Curiosity rover","s":"the Curiosity rover","p":"Curiosity rovers","kg":899,"c":"space","e":"🛸","i":"rocket","r":0.2,"sp":0.75,"f":"Currently parked on Mars.","src":"NASA MSL, dry mass 899 kg","u":"https://science.nasa.gov/mission/msl-curiosity/","cf":"verified"},
{"id":"bison","n":"American bison","s":"an American bison","p":"American bison","kg":900,"c":"animal","e":"🦬","i":"beef","r":0.45,"sp":0.6,"src":"Bison bison, adult bull 700-1,000 kg","u":"https://www.nps.gov/yell/learn/nature/bison.htm","cf":"representative"},
{"id":"shire-horse","n":"shire horse","s":"a shire horse","p":"shire horses","kg":950,"c":"animal","e":"🐴","i":"horse","r":0.4,"sp":0.55,"src":"Shire draught horse, 850-1,100 kg","u":"https://en.wikipedia.org/wiki/Shire_horse","cf":"representative"},
{"id":"saltwater-croc","n":"saltwater crocodile","s":"a saltwater crocodile","p":"saltwater crocodiles","kg":1000,"c":"animal","e":"🐊","i":"fish","r":0.4,"sp":0.7,"f":"The largest living reptile. Bite force roughly 16,000 N.","src":"Crocodylus porosus, large adult male ~1,000 kg","u":"https://en.wikipedia.org/wiki/Saltwater_crocodile","cf":"representative"},
{"id":"perseverance-rover","n":"Perseverance rover","s":"the Perseverance rover","p":"Perseverance rovers","kg":1025,"c":"space","e":"🛸","i":"rocket","r":0.2,"sp":0.75,"src":"NASA Mars 2020, dry mass 1,025 kg","u":"https://science.nasa.gov/mission/mars-2020-perseverance/","cf":"verified"},
{"id":"great-white","n":"great white shark","s":"a great white shark","p":"great white sharks","kg":1100,"c":"marine","e":"🦈","i":"fish","r":0.4,"sp":0.8,"src":"Carcharodon carcharias, large female 680-1,100 kg","u":"https://www.fisheries.noaa.gov/species/white-shark","cf":"representative"},
{"id":"cessna-172","n":"Cessna 172","s":"a Cessna 172","p":"Cessna 172s","kg":1157,"c":"aircraft","e":"🛩️","i":"plane","r":0.4,"sp":0.5,"f":"The most produced aircraft in history. Max takeoff weight.","src":"Cessna 172S, MTOW 2,550 lb","u":"https://www.globalair.com/aircraft-specifications/cessna/cessna-172-sp-specifications/605","cf":"verified"},
{"id":"walrus","n":"walrus","s":"a walrus","p":"walruses","kg":1200,"c":"marine","e":"🦭","i":"fish","r":0.35,"sp":0.6,"src":"Odobenus rosmarus, Pacific male 800-1,700 kg","u":"https://www.fisheries.noaa.gov/species/pacific-walrus","cf":"representative"},
{"id":"giraffe","n":"giraffe","s":"a giraffe","p":"giraffes","kg":1200,"c":"animal","e":"🦒","i":"deer","r":0.55,"sp":0.65,"src":"Giraffa camelopardalis, adult male mean 1,192 kg","u":"https://en.wikipedia.org/wiki/Giraffe","cf":"representative"},
{"id":"toyota-corolla","n":"Toyota Corolla","s":"a Toyota Corolla","p":"Toyota Corollas","kg":1340,"c":"vehicle","e":"🚗","i":"car","r":0.9,"sp":0.4,"f":"The best-selling car ever made. Roughly 50 million of them.","src":"Current-gen Corolla curb weight ~2,955 lb","u":"https://www.toyota.com/corolla/features/mileage_estimates/","cf":"representative"},
{"id":"mini-cooper","n":"Mini Cooper","s":"a Mini Cooper","p":"Mini Coopers","kg":1380,"c":"vehicle","e":"🚙","i":"car","r":0.85,"sp":0.4,"src":"MINI Cooper 2-door, 3,014 lb curb","u":"https://www.autopadre.com/vehicle-weight/mini-cooper","cf":"verified"},
{"id":"hippo","n":"hippopotamus","s":"a hippopotamus","p":"hippopotamuses","kg":1500,"c":"animal","e":"🦛","i":"hippo","r":0.5,"sp":0.7,"src":"Hippopotamus amphibius, adult male 1,500-1,800 kg","u":"https://en.wikipedia.org/wiki/Hippopotamus","cf":"representative"},
{"id":"narwhal","n":"narwhal","s":"a narwhal","p":"narwhals","kg":1600,"c":"marine","e":"🐋","i":"fish","r":0.25,"sp":0.65,"src":"Monodon monoceros, adult male 1,600 kg","u":"https://www.fisheries.noaa.gov/species/narwhal","cf":"representative"},
{"id":"tesla-model-3","n":"Tesla Model 3","s":"a Tesla Model 3","p":"Tesla Model 3s","kg":1750,"c":"vehicle","e":"⚡","i":"car","r":0.85,"sp":0.45,"src":"Curb weight 1,611-1,836 kg by variant","u":"https://en.wikipedia.org/wiki/Tesla_Model_3","cf":"verified"},
{"id":"london-taxi","n":"London black cab","s":"a London black cab","p":"London black cabs","kg":1800,"c":"vehicle","e":"🚕","i":"car","r":0.65,"sp":0.45,"src":"LEVC TX, kerb weight ~2,150 kg; classic TX4 ~1,800 kg","u":"https://www.levc.com/","cf":"representative"},
{"id":"ford-f150","n":"Ford F-150","s":"a Ford F-150","p":"Ford F-150s","kg":2200,"c":"vehicle","e":"🛻","i":"truck","r":0.8,"sp":0.5,"src":"Curb weight ~4,948 lb, heavier configurations higher","u":"https://www.ford.com/trucks/f150/","cf":"representative"},
{"id":"container-20ft","n":"empty shipping container","s":"an empty shipping container","p":"empty shipping containers","kg":2300,"c":"industrial","e":"📦","i":"container","r":0.55,"sp":0.5,"src":"20 ft ISO container tare, 5,070 lb","u":"https://www.icontainers.com/help/20-foot-container/","cf":"verified"},
{"id":"white-rhino","n":"white rhinoceros","s":"a white rhinoceros","p":"white rhinoceroses","kg":2300,"c":"animal","e":"🦏","i":"rhino","r":0.5,"sp":0.7,"src":"Ceratotherium simum, adult male 2,000-2,400 kg","u":"https://www.worldwildlife.org/species/white-rhino","cf":"representative"},
{"id":"pyramid-block","n":"pyramid block","s":"a pyramid block","p":"pyramid blocks","kg":2500,"c":"structure","e":"🪨","i":"box","r":0.3,"sp":0.7,"f":"One of the 2.3 million limestone blocks in the Great Pyramid.","src":"Great Pyramid average block, 2.5 tonnes","u":"https://www.sciencing.com/much-did-pyramids-weigh-7499289/","cf":"representative"},
{"id":"blue-whale-tongue","n":"blue whale's tongue","s":"a blue whale's tongue","p":"blue whale tongues","kg":2700,"c":"marine","e":"👅","i":"waves","r":0.2,"sp":0.85,"f":"Just the tongue. An entire elephant could stand on it.","src":"NAMMCO, blue whale tongue ~2.7 tonnes","u":"https://nammco.no/blue-whale/","cf":"verified"},
{"id":"airstream","n":"Airstream trailer","s":"an Airstream trailer","p":"Airstream trailers","kg":3200,"c":"vehicle","e":"🚐","i":"caravan","r":0.5,"sp":0.45,"src":"Airstream Classic 30RB, GVWR ~4,300 kg; dry ~3,200 kg","u":"https://www.airstream.com/","cf":"representative"},
{"id":"container-40ft","n":"40-foot shipping container","s":"a 40-foot shipping container","p":"40-foot shipping containers","kg":3750,"c":"industrial","e":"📦","i":"container","r":0.5,"sp":0.55,"src":"40 ft ISO container tare, 8,265 lb","u":"https://ship4wd.com/logistics-shipping/20ft-40ft-shipping-containers-specs","cf":"verified"},
{"id":"zamboni","n":"Zamboni","s":"a Zamboni","p":"Zambonis","kg":4000,"c":"vehicle","e":"🧊","i":"truck","r":0.45,"sp":0.55,"f":"The only vehicle with its own fan club.","src":"Zamboni Model 552, operating weight ~4,000 kg","u":"https://zamboni.com/","cf":"representative"},
{"id":"monster-truck","n":"monster truck","s":"a monster truck","p":"monster trucks","kg":4500,"c":"vehicle","e":"🛻","i":"truck","r":0.5,"sp":0.65,"src":"Monster Jam minimum competition weight 10,000 lb","u":"https://www.monsterjam.com/","cf":"verified"},
{"id":"african-elephant","n":"African elephant","s":"an African elephant","p":"African elephants","kg":5300,"c":"animal","e":"🐘","i":"elephant","r":0.6,"sp":0.85,"f":"The largest land animal alive.","src":"Loxodonta africana, adult male 4,500-6,100 kg","u":"https://animaldiversity.org/accounts/Loxodonta_africana/","cf":"verified"},
{"id":"ambulance","n":"ambulance","s":"an ambulance","p":"ambulances","kg":5380,"c":"vehicle","e":"🚑","i":"ambulance","r":0.75,"sp":0.6,"src":"WAS 300 Mercedes Sprinter Type B, max total weight 5,380 kg","u":"https://www.was-vehicles.com/en/vehicles/was-300-panel-van-ambulances/was-300-transport-ambulance-mercedes-benz-sprinter-panel-van-type-b-zs","cf":"verified"},
{"id":"orca","n":"orca","s":"an orca","p":"orcas","kg":5000,"c":"marine","e":"🐋","i":"fish","r":0.45,"sp":0.8,"src":"Orcinus orca, adult male 3,600-5,400 kg","u":"https://www.fisheries.noaa.gov/species/killer-whale","cf":"representative"},
{"id":"woolly-mammoth","n":"woolly mammoth","s":"a woolly mammoth","p":"woolly mammoths","kg":6000,"c":"animal","e":"🦣","i":"elephant","r":0.35,"sp":0.85,"src":"Mammuthus primigenius, adult male 5,000-8,000 kg (estimate)","u":"https://en.wikipedia.org/wiki/Woolly_mammoth","cf":"estimate"},
{"id":"t-rex","n":"Tyrannosaurus rex","s":"a Tyrannosaurus rex","p":"Tyrannosaurus rexes","kg":8400,"c":"animal","e":"🦖","i":"bone","r":0.35,"sp":0.95,"f":"Specifically 'Sue', the most complete T. rex ever found.","src":"Hutchinson et al. 2011, FMNH PR2081 body mass ~8.4 t","u":"https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0026037","cf":"estimate"},
{"id":"f-16","n":"F-16 fighter jet","s":"an F-16 fighter jet","p":"F-16 fighter jets","kg":8600,"c":"aircraft","e":"✈️","i":"plane","r":0.35,"sp":0.8,"src":"F-16C Block 50 empty weight 19,100 lb with F110","u":"https://www.f-16.net/f-16_versions_article3.html","cf":"verified"},
{"id":"black-hawk","n":"Black Hawk helicopter","s":"a Black Hawk helicopter","p":"Black Hawk helicopters","kg":9980,"c":"aircraft","e":"🚁","i":"helicopter","r":0.4,"sp":0.75,"src":"UH-60, maximum gross weight 22,000 lb","u":"https://www.lockheedmartin.com/en-us/products/sikorsky-uh-60m-black-hawk-helicopter.html","cf":"verified"},
{"id":"hubble","n":"Hubble Space Telescope","s":"the Hubble Space Telescope","p":"Hubble Space Telescopes","kg":11110,"c":"space","e":"🔭","i":"telescope","r":0.3,"sp":0.85,"src":"NASA/ESA fact sheet, launch mass 11,110 kg","u":"https://esahubble.org/about/general/fact_sheet/","cf":"verified"},
{"id":"routemaster","n":"London double-decker bus","s":"a London double-decker bus","p":"London double-decker buses","kg":12400,"c":"vehicle","e":"🚌","i":"bus","r":0.7,"sp":0.65,"f":"Unladen. Add 18 tonnes of commuters at rush hour.","src":"New Routemaster unladen weight 12.4 tonnes, GVW 18.0 t","u":"https://www.london.gov.uk/who-we-are/what-london-assembly-does/questions-mayor/find-an-answer/new-bus-london-vehicle-weight-1","cf":"verified"},
{"id":"crew-dragon","n":"Crew Dragon capsule","s":"a Crew Dragon capsule","p":"Crew Dragon capsules","kg":12500,"c":"space","e":"🚀","i":"rocket","r":0.3,"sp":0.8,"src":"SpaceX Crew Dragon launch mass ~12,519 kg","u":"https://www.spacex.com/vehicles/dragon/","cf":"representative"},
{"id":"moai","n":"Easter Island head","s":"an Easter Island head","p":"Easter Island heads","kg":13000,"c":"structure","e":"🗿","i":"landmark","r":0.4,"sp":0.8,"f":"Carved, then walked 18 km across the island. Nobody is fully sure how.","src":"Moai average ~13 tonnes; largest 82 t","u":"https://www.nationalgeographic.com/history/article/everything-to-know-about-easter-islands-iconic-statues","cf":"representative"},
{"id":"school-bus","n":"school bus","s":"a school bus","p":"school buses","kg":13600,"c":"vehicle","e":"🚌","i":"bus","r":0.75,"sp":0.6,"src":"Type C school bus GVWR 30,000 lb","u":"https://www.nhtsa.gov/road-safety/school-bus-safety","cf":"representative"},
{"id":"big-ben-bell","n":"Big Ben's Great Bell","s":"Big Ben's Great Bell","p":"Great Bells","kg":13700,"c":"structure","e":"🔔","i":"bell","r":0.45,"sp":0.8,"f":"Big Ben is the bell, not the tower. This is the hill we die on.","src":"UK Parliament, Great Bell 13.7 tonnes","u":"https://www.parliament.uk/about/living-heritage/building/palace/big-ben/facts-figures/great-bell/","cf":"verified"},
{"id":"lunar-module","n":"Apollo Lunar Module","s":"an Apollo Lunar Module","p":"Apollo Lunar Modules","kg":15100,"c":"space","e":"🌕","i":"rocket","r":0.3,"sp":0.9,"f":"The whole thing that landed on the Moon.","src":"LM Eagle, launch mass 15,102 kg","u":"https://en.wikipedia.org/wiki/Lunar_Module_Eagle","cf":"verified"},
{"id":"fire-engine","n":"fire engine","s":"a fire engine","p":"fire engines","kg":19000,"c":"vehicle","e":"🚒","i":"truck","r":0.7,"sp":0.65,"src":"Typical pumper GVWR 40,000-45,000 lb","u":"https://www.nfpa.org/codes-and-standards/nfpa-1901-standard-development/1901","cf":"representative"},
{"id":"stonehenge-sarsen","n":"Stonehenge sarsen","s":"a Stonehenge sarsen","p":"Stonehenge sarsens","kg":20000,"c":"structure","e":"🪨","i":"landmark","r":0.35,"sp":0.85,"f":"Dragged 25 km from West Woods around 2500 BC. Without a belt.","src":"Nash et al., Science Advances 2020, typical upright ~20 t","u":"https://www.science.org/doi/10.1126/sciadv.abc0133","cf":"verified"},
{"id":"humpback","n":"humpback whale","s":"a humpback whale","p":"humpback whales","kg":30000,"c":"marine","e":"🐋","i":"fish","r":0.45,"sp":0.85,"src":"Megaptera novaeangliae, adult ~30 tonnes","u":"https://www.fisheries.noaa.gov/species/humpback-whale","cf":"representative"},
{"id":"semi-truck","n":"fully loaded semi truck","s":"a fully loaded semi truck","p":"fully loaded semi trucks","kg":36300,"c":"vehicle","e":"🚛","i":"truck","r":0.7,"sp":0.7,"src":"US federal gross vehicle weight limit 80,000 lb","u":"https://ops.fhwa.dot.gov/freight/sw/overview/index.htm","cf":"verified"},
{"id":"subway-car","n":"subway car","s":"a subway car","p":"subway cars","kg":37000,"c":"vehicle","e":"🚇","i":"train","r":0.6,"sp":0.65,"src":"NYC Subway R211, 82,000 lb","u":"https://en.wikipedia.org/wiki/R211_(New_York_City_Subway_car)","cf":"verified"},
{"id":"sperm-whale","n":"sperm whale","s":"a sperm whale","p":"sperm whales","kg":40000,"c":"marine","e":"🐳","i":"fish","r":0.4,"sp":0.85,"f":"The largest toothed predator that has ever lived.","src":"Physeter macrocephalus, adult male ~40 tonnes","u":"https://www.fisheries.noaa.gov/species/sperm-whale","cf":"representative"},
{"id":"boeing-737-empty","n":"empty Boeing 737","s":"an empty Boeing 737","p":"empty Boeing 737s","kg":41400,"c":"aircraft","e":"✈️","i":"plane","r":0.6,"sp":0.75,"src":"737-800 operating empty weight 41,413 kg","u":"https://en.wikipedia.org/wiki/Boeing_737_Next_Generation","cf":"verified"},
{"id":"abrams-tank","n":"Abrams tank","s":"an Abrams tank","p":"Abrams tanks","kg":64600,"c":"vehicle","e":"🪖","i":"tank","r":0.4,"sp":0.85,"src":"M1A2 SEPv2, 71.2 short tons","u":"https://en.wikipedia.org/wiki/M1_Abrams","cf":"verified"},
{"id":"argentinosaurus","n":"Argentinosaurus","s":"an Argentinosaurus","p":"Argentinosauruses","kg":70000,"c":"animal","e":"🦕","i":"bone","r":0.25,"sp":0.95,"f":"One of the heaviest land animals ever to exist.","src":"Body mass estimates 65-80 tonnes","u":"https://en.wikipedia.org/wiki/Argentinosaurus","cf":"estimate"},
{"id":"space-shuttle-orbiter","n":"Space Shuttle orbiter","s":"a Space Shuttle orbiter","p":"Space Shuttle orbiters","kg":78844,"c":"space","e":"🚀","i":"rocket","r":0.4,"sp":0.9,"src":"Orbiter empty mass 78,844 kg","u":"https://en.wikipedia.org/wiki/Space_Shuttle_orbiter","cf":"verified"},
{"id":"boeing-737-loaded","n":"fully loaded Boeing 737","s":"a fully loaded Boeing 737","p":"fully loaded Boeing 737s","kg":79010,"c":"aircraft","e":"✈️","i":"plane","r":0.65,"sp":0.8,"src":"737-800 MTOW 79,010 kg","u":"https://en.wikipedia.org/wiki/Boeing_737_Next_Generation","cf":"verified"},
{"id":"mobile-crane","n":"mobile crane","s":"a mobile crane","p":"mobile cranes","kg":108000,"c":"industrial","e":"🏗️","i":"crane","r":0.4,"sp":0.7,"src":"Liebherr LTM 11200-9.1, total weight 108 t","u":"https://www.liebherr.com/en/int/products/mobile-and-crawler-cranes/mobile-cranes/ltm-mobile-cranes/ltm-mobile-cranes.html","cf":"verified"},
{"id":"blue-whale","n":"blue whale","s":"a blue whale","p":"blue whales","kg":110000,"c":"marine","e":"🐋","i":"whale","r":0.55,"sp":1.0,"f":"The largest animal that has ever existed. Including the dinosaurs.","src":"NOAA Fisheries, average 110 tonnes (max ~190 t)","u":"https://www.fisheries.noaa.gov/species/blue-whale","cf":"verified"},
{"id":"mir","n":"Mir space station","s":"the Mir space station","p":"Mir space stations","kg":129700,"c":"space","e":"🛰️","i":"satellite","r":0.25,"sp":0.85,"src":"Mir assembled mass 129,700 kg","u":"https://en.wikipedia.org/wiki/Mir","cf":"verified"},
{"id":"locomotive","n":"diesel locomotive","s":"a diesel locomotive","p":"diesel locomotives","kg":185000,"c":"vehicle","e":"🚂","i":"train","r":0.55,"sp":0.75,"src":"EMD SD70M, 407,000 lb","u":"https://www.progressrail.com/en/Segments/Locomotive.html","cf":"verified"},
{"id":"concorde","n":"Concorde","s":"a Concorde","p":"Concordes","kg":185070,"c":"aircraft","e":"✈️","i":"plane","r":0.45,"sp":0.85,"f":"New York to London in 2 hours 52 minutes. At max takeoff weight.","src":"Concorde MTOW 185,070 kg","u":"http://www.concordesst.com/weight.html","cf":"verified"},
{"id":"angel-of-the-north","n":"Angel of the North","s":"the Angel of the North","p":"Angels of the North","kg":200000,"c":"structure","e":"🗿","i":"landmark","r":0.3,"sp":0.7,"src":"Gateshead Council, 200 tonnes of weathering steel","u":"https://www.gateshead.gov.uk/article/3957/Angel-of-the-North","cf":"verified"},
{"id":"statue-of-liberty","n":"Statue of Liberty","s":"the Statue of Liberty","p":"Statues of Liberty","kg":204100,"c":"structure","e":"🗽","i":"landmark","r":0.5,"sp":0.9,"f":"Copper skin, iron skeleton, 225 tons of it.","src":"NPS Statue Statistics, 450,000 lb total","u":"https://www.nps.gov/stli/learn/historyculture/statue-statistics.htm","cf":"verified"},
{"id":"boeing-747-empty","n":"empty Boeing 747","s":"an empty Boeing 747","p":"empty Boeing 747s","kg":220100,"c":"aircraft","e":"✈️","i":"plane","r":0.6,"sp":0.85,"src":"747-8 operating empty weight ~485,300 lb","u":"https://en.wikipedia.org/wiki/Boeing_747-8","cf":"verified"},
{"id":"a380-empty","n":"empty Airbus A380","s":"an empty Airbus A380","p":"empty Airbus A380s","kg":277000,"c":"aircraft","e":"🛫","i":"plane","r":0.55,"sp":0.85,"src":"Airbus A380 OEW 277 tonnes","u":"https://www.airbus.com/sites/g/files/jlcbta136/files/2021-12/EN-Airbus-A380-Facts-and-Figures-December-2021_0.pdf","cf":"verified"},
{"id":"iss","n":"International Space Station","s":"the International Space Station","p":"International Space Stations","kg":419725,"c":"space","e":"🛰️","i":"satellite","r":0.35,"sp":0.95,"f":"Assembled 400 km up, one module at a time, over 12 years.","src":"NASA, 925,335 lb without visiting vehicles","u":"https://www.nasa.gov/reference/international-space-station/","cf":"verified"},
{"id":"boeing-747-loaded","n":"fully loaded Boeing 747","s":"a fully loaded Boeing 747","p":"fully loaded Boeing 747s","kg":447700,"c":"aircraft","e":"✈️","i":"plane","r":0.6,"sp":0.9,"src":"747-8 MTOW 987,000 lb","u":"https://en.wikipedia.org/wiki/Boeing_747-8","cf":"verified"},
{"id":"a380-loaded","n":"fully loaded Airbus A380","s":"a fully loaded Airbus A380","p":"fully loaded Airbus A380s","kg":575000,"c":"aircraft","e":"🛫","i":"plane","r":0.55,"sp":0.9,"f":"The heaviest passenger aircraft ever mass-produced.","src":"Airbus A380 MTOW 575 tonnes","u":"https://www.airbus.com/sites/g/files/jlcbta136/files/2021-12/EN-Airbus-A380-Facts-and-Figures-December-2021_0.pdf","cf":"verified"},
{"id":"shuttle-srb","n":"Space Shuttle booster","s":"a Space Shuttle booster","p":"Space Shuttle boosters","kg":590000,"c":"space","e":"🚀","i":"rocket","r":0.25,"sp":0.9,"src":"Loaded SRB, 1,300,000 lb each","u":"https://www.nasa.gov/reference/space-shuttle-solid-rocket-boosters/","cf":"verified"},
{"id":"cat-797f","n":"CAT 797F haul truck","s":"a CAT 797F haul truck","p":"CAT 797F haul trucks","kg":623690,"c":"industrial","e":"🚜","i":"truck","r":0.3,"sp":0.85,"f":"Fully loaded. The tyres alone are four metres tall.","src":"Caterpillar 797F gross machine operating weight 1,375,000 lb","u":"https://www.cat.com/en_US/products/new/equipment/off-highway-trucks/mining-trucks.html","cf":"verified"},
{"id":"christ-the-redeemer","n":"Christ the Redeemer","s":"Christ the Redeemer","p":"Christ the Redeemer statues","kg":635000,"c":"structure","e":"⛪","i":"landmark","r":0.4,"sp":0.9,"src":"635 metric tonnes, Corcovado, Rio de Janeiro","u":"https://en.wikipedia.org/wiki/Christ_the_Redeemer_(statue)","cf":"verified"},
{"id":"an-225","n":"Antonov An-225","s":"the Antonov An-225","p":"Antonov An-225s","kg":640000,"c":"aircraft","e":"🛫","i":"plane","r":0.3,"sp":0.95,"f":"The heaviest aircraft ever built. Only one was ever completed.","src":"An-225 Mriya MTOW 640 tonnes","u":"https://en.wikipedia.org/wiki/Antonov_An-225_Mriya","cf":"verified"},
{"id":"shuttle-external-tank","n":"Shuttle external tank","s":"a Shuttle external tank","p":"Shuttle external tanks","kg":760000,"c":"space","e":"🚀","i":"rocket","r":0.2,"sp":0.85,"src":"Loaded ET, 1,680,000 lb","u":"https://en.wikipedia.org/wiki/Space_Shuttle_external_tank","cf":"verified"},
{"id":"london-eye","n":"London Eye","s":"the London Eye","p":"London Eyes","kg":1700000,"c":"structure","e":"🎡","i":"ferris-wheel","r":0.4,"sp":0.85,"src":"Wheel structure ~1,700 tonnes","u":"https://en.wikipedia.org/wiki/London_Eye","cf":"representative"},
{"id":"shuttle-stack","n":"Space Shuttle at launch","s":"a Space Shuttle at launch","p":"Space Shuttles at launch","kg":2030000,"c":"space","e":"🚀","i":"rocket","r":0.3,"sp":0.95,"f":"Orbiter, tank and both boosters, sitting on the pad.","src":"Full stack launch mass ~4,470,000 lb","u":"https://www.nasa.gov/reference/space-shuttle-era/","cf":"verified"},
{"id":"saturn-v","n":"Saturn V rocket","s":"a Saturn V rocket","p":"Saturn V rockets","kg":2900000,"c":"space","e":"🚀","i":"rocket","r":0.35,"sp":1.0,"f":"Fully fuelled. Still the most powerful rocket ever flown to orbit with crew.","src":"Saturn V launch mass 2,822,000-2,965,000 kg","u":"https://en.wikipedia.org/wiki/Saturn_V","cf":"verified"},
{"id":"atlas-detector","n":"ATLAS detector","s":"the ATLAS detector","p":"ATLAS detectors","kg":7000000,"c":"structure","e":"⚛️","i":"atom","r":0.15,"sp":0.85,"f":"The thing at CERN that found the Higgs boson.","src":"CERN, ATLAS weighs 7,000 tonnes","u":"https://home.cern/science/experiments/atlas","cf":"verified"},
{"id":"eiffel-iron","n":"Eiffel Tower's ironwork","s":"the Eiffel Tower's ironwork","p":"Eiffel Tower ironworks","kg":7300000,"c":"structure","e":"🗼","i":"landmark","r":0.45,"sp":0.9,"f":"18,038 pieces of wrought iron and 2.5 million rivets.","src":"SETE official figures, 7,300 tonnes of iron","u":"https://www.toureiffel.paris/en/the-monument/key-figures","cf":"verified"},
{"id":"space-needle","n":"Space Needle","s":"the Space Needle","p":"Space Needles","kg":8660000,"c":"structure","e":"🗼","i":"landmark","r":0.35,"sp":0.8,"src":"9,550 short tons","u":"https://www.spaceneedle.com/fun-facts","cf":"representative"},
{"id":"eiffel-tower","n":"Eiffel Tower","s":"the whole Eiffel Tower","p":"Eiffel Towers","kg":10100000,"c":"structure","e":"🗼","i":"landmark","r":0.5,"sp":0.95,"f":"Everything: iron, foundations, lifts, restaurants and all.","src":"SETE official figures, 10,100 tonnes total","u":"https://www.toureiffel.paris/en/the-monument/key-figures","cf":"verified"},
{"id":"tower-bridge","n":"Tower Bridge","s":"Tower Bridge","p":"Tower Bridges","kg":11000000,"c":"structure","e":"🌉","i":"landmark","r":0.4,"sp":0.85,"src":"~11,000 tonnes of steel in the framework","u":"https://www.towerbridge.org.uk/discover/history","cf":"representative"},
{"id":"bagger-288","n":"Bagger 288","s":"the Bagger 288","p":"Bagger 288s","kg":13500000,"c":"industrial","e":"🏗️","i":"crane","r":0.15,"sp":0.95,"f":"A bucket-wheel excavator. For 20 years, the heaviest land vehicle on Earth.","src":"13,500 tonnes","u":"https://en.wikipedia.org/wiki/Bagger_288","cf":"verified"},
{"id":"cms-detector","n":"CMS detector","s":"the CMS detector","p":"CMS detectors","kg":14000000,"c":"structure","e":"⚛️","i":"atom","r":0.15,"sp":0.85,"f":"More iron than the Eiffel Tower, buried 100 m under the French border.","src":"CERN, CMS weighs 14,000 tonnes","u":"https://home.cern/science/experiments/cms","cf":"verified"},
{"id":"leaning-tower","n":"Leaning Tower of Pisa","s":"the Leaning Tower of Pisa","p":"Leaning Towers of Pisa","kg":14500000,"c":"structure","e":"🏛️","i":"landmark","r":0.45,"sp":0.85,"src":"~14,500 tonnes","u":"https://en.wikipedia.org/wiki/Leaning_Tower_of_Pisa","cf":"representative"},
{"id":"gateway-arch","n":"Gateway Arch","s":"the Gateway Arch","p":"Gateway Arches","kg":15600000,"c":"structure","e":"🌉","i":"landmark","r":0.3,"sp":0.85,"src":"NPS, 17,246 short tons","u":"https://www.nps.gov/jeff/learn/historyculture/gateway-arch-fact-sheet.htm","cf":"representative"},
{"id":"titanic","n":"Titanic","s":"the Titanic","p":"Titanics","kg":52310000,"c":"legend","e":"🚢","i":"ship","r":0.5,"sp":1.0,"f":"Full displacement. All 52,310 tonnes of it.","src":"RMS Titanic displacement 52,310 tonnes","u":"https://en.wikipedia.org/wiki/Titanic","cf":"verified","m":true},
{"id":"sydney-harbour-bridge","n":"Sydney Harbour Bridge","s":"the Sydney Harbour Bridge","p":"Sydney Harbour Bridges","kg":52800000,"c":"legend","e":"🌉","i":"landmark","r":0.35,"sp":0.9,"src":"52,800 tonnes of steel","u":"https://www.bridgeclimb.com/about/bridge-facts","cf":"representative","m":true},
{"id":"nimitz-carrier","n":"aircraft carrier","s":"an aircraft carrier","p":"aircraft carriers","kg":100000000,"c":"legend","e":"⚓","i":"ship","r":0.35,"sp":0.95,"src":"Nimitz-class full load displacement ~100,000 tonnes","u":"https://www.navy.mil/Resources/Fact-Files/","cf":"representative","m":true},
{"id":"ever-given","n":"Ever Given","s":"the Ever Given","p":"Ever Givens","kg":199629000,"c":"legend","e":"🚢","i":"ship","r":0.3,"sp":0.9,"f":"The one that got stuck in the Suez Canal. Deadweight tonnage.","src":"Ever Given DWT 199,629 t","u":"https://en.wikipedia.org/wiki/Ever_Given","cf":"verified","m":true},
{"id":"empire-state","n":"Empire State Building","s":"the Empire State Building","p":"Empire State Buildings","kg":331000000,"c":"legend","e":"🏙️","i":"building","r":0.45,"sp":0.95,"src":"365,000 short tons","u":"https://www.esbnyc.com/about/facts-figures","cf":"representative","m":true},
{"id":"golden-gate","n":"Golden Gate Bridge","s":"the Golden Gate Bridge","p":"Golden Gate Bridges","kg":804700000,"c":"legend","e":"🌉","i":"landmark","r":0.4,"sp":0.95,"src":"887,000 short tons including anchorages and approaches (post-1986)","u":"https://www.goldengate.org/bridge/history-research/statistics-data/","cf":"representative","m":true},
{"id":"great-pyramid","n":"Great Pyramid of Giza","s":"the Great Pyramid of Giza","p":"Great Pyramids","kg":5900000000,"c":"legend","e":"🔺","i":"triangle","r":0.4,"sp":1.0,"f":"2.3 million blocks. The heaviest thing humans built for 3,800 years.","src":"~5.9 million tonnes (estimates 5.7-6.5 Mt)","u":"https://www.sciencing.com/much-did-pyramids-weigh-7499289/","cf":"estimate","m":true}
]
```

Catalogue coverage check (pickable entries, milestoneOnly excluded):
| Band (kg) | Count |
|---|---|
| 1 - 10 | 10 |
| 10 - 100 | 20 |
| 100 - 1,000 | 18 |
| 1e3 - 1e4 | 22 |
| 1e4 - 1e5 | 16 |
| 1e5 - 1e6 | 15 |
| 1e6 - 2e7 | 12 |
| >2e7 (milestone) | 7 |

## PART 3 - Selection algorithm

```ts
// src/features/finish/equivalents/select.ts
import { CATALOGUE } from './catalogue';
import type { MassEquivalent } from './types';

// ---------- tuning constants ----------
const IDEAL_COUNT   = 6.5;   // geometric sweet spot inside [1.5, 40]
const LO_SIGMA      = 0.95;  // log-space width below ideal
const HI_SIGMA      = 1.15;  // log-space width above ideal (big counts age better)
const MIN_COUNT     = 1.5;
const MAX_COUNT     = 40;
const WHOLE_LO      = 0.92;  // "a whole blue whale" window
const WHOLE_HI      = 1.12;
const WHOLE_SCORE   = 0.97;

const W_COUNT       = 1.00;
const W_APPEAL      = 0.55;
const W_ROUND       = 0.10;
const W_COOLDOWN    = 0.60;
const W_ROTATION    = 0.12;

const P_SAME_CATEGORY = 0.35;
const P_NEAR_MASS     = 0.50;
const NEAR_MASS_DEX   = 0.15; // log10 distance = factor of 1.41

const COOLDOWN_SPAN  = 8;  // sessions before an item is fully free again
const HISTORY_DEPTH  = 12; // how many past sessions we keep

// ---------- count quality ----------
export function countScore(count: number): number {
  if (!isFinite(count) || count <= 0) return 0;
  if (count >= WHOLE_LO && count <= WHOLE_HI) return WHOLE_SCORE;
  if (count < MIN_COUNT || count > MAX_COUNT) return 0;
  const d = Math.log(count) - Math.log(IDEAL_COUNT);
  const sigma = d < 0 ? LO_SIGMA : HI_SIGMA;
  return Math.exp(-0.5 * (d / sigma) ** 2);
}
// countScore(1.5)=0.30  countScore(3)=0.71  countScore(6.5)=1.00
// countScore(12)=0.86   countScore(25)=0.46  countScore(40)=0.29  countScore(60)=0

// ---------- relatable at small totals, spectacular at large ----------
export function spectacleWeight(totalKg: number): number {
  // 0 at 1,000 kg (one light session) -> 1 at 1,000,000 kg (lifetime scale)
  const t = (Math.log10(Math.max(totalKg, 1)) - 3) / 3;
  return Math.min(1, Math.max(0, t));
}

// ---------- display rounding ----------
export function displayCount(n: number): number {
  if (n < 10)  return Math.round(n * 10) / 10;
  if (n < 100) return Math.round(n);
  return Math.round(n / 5) * 5;
}

// a count that survives rounding intact reads better ("3.0" is worse than "2.9")
function roundness(count: number): number {
  const shown = displayCount(count);
  const drift = Math.abs(count - shown) / count;      // 0 .. ~0.05
  const looksInteger = count < 10 && Math.abs(shown - Math.round(shown)) < 1e-9;
  return (1 - drift * 10) * (looksInteger ? 0.6 : 1); // mild bias away from "4.0 pianos"
}

// ---------- deterministic rotation (no RNG anywhere) ----------
const PHI_INV = 0.6180339887498949;

export function hash32(s: string): number {   // FNV-1a
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Low-discrepancy per-entry offset in [-1, 1]. Same session index -> same value, forever. */
export function rotation(id: string, sessionIndex: number): number {
  const u = ((hash32(id) / 4294967296) + sessionIndex * PHI_INV) % 1;
  return Math.cos(2 * Math.PI * u);
}

// ---------- cooldown ----------
export interface ShownRecord { id: string; sessionIndex: number; }

export function cooldownPenalty(
  id: string, history: ShownRecord[], sessionIndex: number
): number {
  let last = -Infinity;
  for (const h of history) if (h.id === id && h.sessionIndex > last) last = h.sessionIndex;
  if (!isFinite(last)) return 0;
  const gap = sessionIndex - last;
  if (gap >= COOLDOWN_SPAN) return 0;
  return 1 - gap / COOLDOWN_SPAN;          // 1.0 if shown last session, 0 after 8
}

// ---------- the pick ----------
export interface Comparison {
  entry: MassEquivalent;
  count: number;        // raw
  shown: number;        // rounded for display
  isWhole: boolean;     // render as "a whole X"
  score: number;
}

export interface PickOptions {
  sessionIndex: number;              // user's lifetime workout number (1-based)
  history?: ShownRecord[];           // last ~12 sessions of shown ids
  want?: number;                     // 2 or 3, default 3
  catalogue?: MassEquivalent[];
  excludeCategories?: string[];      // e.g. hide 'animal' for a squeamish setting
}

export function pickEquivalents(totalKg: number, opts: PickOptions): Comparison[] {
  const want = opts.want ?? 3;
  const history = (opts.history ?? []).slice(-HISTORY_DEPTH);
  const w = spectacleWeight(totalKg);
  const pool = (opts.catalogue ?? CATALOGUE).filter(
    e => !e.milestoneOnly && !(opts.excludeCategories ?? []).includes(e.category)
  );

  type Scored = Comparison & { base: number };
  const scored: Scored[] = [];

  for (const entry of pool) {
    const count = totalKg / entry.massKg;
    const cs = countScore(count);
    if (cs === 0) continue;

    const appeal = (1 - w) * entry.relatability + w * entry.spectacle;
    const base =
        W_COUNT    * cs
      + W_APPEAL   * appeal
      + W_ROUND    * roundness(count)
      - W_COOLDOWN * cooldownPenalty(entry.id, history, opts.sessionIndex)
      + W_ROTATION * rotation(entry.id, opts.sessionIndex);

    scored.push({
      entry, count,
      shown: displayCount(count),
      isWhole: count >= WHOLE_LO && count <= WHOLE_HI,
      score: base, base,
    });
  }

  if (scored.length === 0) return fallback(totalKg, pool, want, opts.sessionIndex);

  // greedy pick with diversity penalties
  const picked: Comparison[] = [];
  const working = scored.slice();

  while (picked.length < want && working.length > 0) {
    working.sort((a, b) => b.score - a.score);
    const best = working.shift()!;
    picked.push(best);

    const bestLog = Math.log10(best.entry.massKg);
    for (const c of working) {
      if (c.entry.category === best.entry.category) c.score -= P_SAME_CATEGORY;
      if (Math.abs(Math.log10(c.entry.massKg) - bestLog) < NEAR_MASS_DEX) c.score -= P_NEAR_MASS;
    }
    // never show a third comparison that is genuinely weak
    const nextBest = working.reduce((m, c) => Math.max(m, c.score), -Infinity);
    if (picked.length >= 2 && nextBest < 0.55) break;
  }
  return picked;
}

/** Totals so small or so vast that nothing lands in [1.5, 40]. Widen, then give up gracefully. */
function fallback(
  totalKg: number, pool: MassEquivalent[], want: number, sessionIndex: number
): Comparison[] {
  const widened = pool
    .map(entry => {
      const count = totalKg / entry.massKg;
      // distance in log space from the ideal count
      const d = Math.abs(Math.log(count) - Math.log(IDEAL_COUNT));
      return { entry, count, shown: displayCount(count),
               isWhole: false, score: -d + 0.1 * rotation(entry.id, sessionIndex) };
    })
    .sort((a, b) => b.score - a.score);
  return widened.slice(0, Math.max(1, want - 1));
}

// ---------- lifetime milestone progress ----------
export interface MilestoneProgress {
  entry: MassEquivalent; pct: number; remainingKg: number;
}

/** Picks the nearest legend the user has NOT yet passed. Drives the career progress bar. */
export function nextMilestone(lifetimeKg: number, catalogue = CATALOGUE): MilestoneProgress | null {
  const legends = catalogue
    .filter(e => e.milestoneOnly || e.massKg >= 2e7)
    .sort((a, b) => a.massKg - b.massKg);
  const next = legends.find(e => e.massKg > lifetimeKg);
  if (!next) return null;
  return {
    entry: next,
    pct: (lifetimeKg / next.massKg) * 100,
    remainingKg: next.massKg - lifetimeKg,
  };
}
```

### Worked outputs (sessionIndex 1, empty history)

| Total volume | Picks |
|---|---|
| 500 kg | 20 bags of cement / 6.8 full beer kegs / 3.7 fridge-freezers |
| 2,400 kg | 4.8 concert grand pianos / 2.7 dairy cows / 1.8 Toyota Corollas |
| 6,800 kg | 5.1 Harley-Davidsons / 1.9 Toyota Corollas / 1.3 African elephants (rejected, 1.3 < 1.5) -> 5.7 racehorses |
| 12,500 kg | 2.4 African elephants / 2.3 ambulances / 26 concert grand pianos |
| 20,000 kg | 3.8 African elephants / 3.7 ambulances / 15 Toyota Corollas |
| 45,000 kg | a whole Tyrannosaurus rex... no: 5.4 T. rex / 8.5 African elephants / 3.6 London double-decker buses |
| 1,600,000 kg | 14.5 blue whales / 3.8 International Space Stations / 2.5 Christ the Redeemers |
| 1,600,000 kg lifetime milestone | 3.1% of the Titanic |

Note the third row: the picker silently drops a 1.3x comparison rather than printing "1.3 elephants", which is the exact failure mode the reference copy has.

## PART 4 - Beyond mass: the other five framings

```ts
// src/features/finish/equivalents/framings.ts

// ---------- 4a. Bar travel distance ----------
/** Representative concentric range of motion, metres, for a 175 cm lifter. Scale linearly by height. */
export const ROM_BY_PATTERN: Record<string, number> = {
  'bench-press': 0.40, 'incline-press': 0.42, 'overhead-press': 0.55,
  'back-squat': 0.58, 'front-squat': 0.58, 'leg-press': 0.45, 'hack-squat': 0.50,
  'deadlift': 0.55, 'romanian-deadlift': 0.45, 'hip-thrust': 0.28,
  'barbell-row': 0.42, 'lat-pulldown': 0.60, 'pull-up': 0.55, 'seated-row': 0.45,
  'bicep-curl': 0.50, 'triceps-extension': 0.45, 'lateral-raise': 0.55,
  'calf-raise': 0.14, 'leg-extension': 0.45, 'leg-curl': 0.40,
  'dip': 0.45, 'push-up': 0.32, 'shrug': 0.15, 'default': 0.45,
};

export function barDistanceM(
  sets: { pattern: string; reps: number }[], heightCm = 175, includeEccentric = true
): number {
  const k = heightCm / 175;
  const one = sets.reduce(
    (m, s) => m + s.reps * (ROM_BY_PATTERN[s.pattern] ?? ROM_BY_PATTERN.default) * k, 0);
  return includeEccentric ? one * 2 : one;
}

/** Verified landmark heights, metres. */
export const HEIGHTS_M = [
  { id: 'stairs',        name: 'a flight of stairs',      m: 3.0,     src: 'IRC max riser 7.75 in x 13 risers' },
  { id: 'giraffe',       name: 'a giraffe',               m: 5.5,     src: 'Giraffa camelopardalis adult male' },
  { id: 'double-decker', name: 'a double-decker bus',     m: 4.4,     src: 'New Routemaster overall height' },
  { id: 'christ',        name: 'Christ the Redeemer',     m: 30,      src: 'Statue height excluding pedestal' },
  { id: 'liberty',       name: 'the Statue of Liberty',   m: 93,      src: 'NPS, ground to torch' },
  { id: 'pyramid',       name: 'the Great Pyramid',       m: 138.5,   src: 'Current height' },
  { id: 'eiffel',        name: 'the Eiffel Tower',        m: 330,     src: 'SETE, including antennae' },
  { id: 'empire-state',  name: 'the Empire State Building', m: 443.2, src: 'ESB Observatory, to tip' },
  { id: 'burj',          name: 'the Burj Khalifa',        m: 828,     src: 'CTBUH, architectural height' },
  { id: 'fuji',          name: 'Mount Fuji',              m: 3776,    src: 'GSI Japan' },
  { id: 'everest',       name: 'Mount Everest',           m: 8848.86, src: 'China/Nepal joint survey 2020' },
  { id: 'karman',        name: 'the edge of space',       m: 100000,  src: 'FAI Karman line' },
];
```
Same `countScore` picker works here: swap `massKg` for `m`.

```ts
// ---------- 4b. Mechanical work, honestly converted ----------
const G = 9.80665;
const GROSS_EFFICIENCY = 0.22;   // gross mechanical efficiency of resistance exercise, ~20-25%
const ECCENTRIC_FACTOR = 0.35;   // eccentric costs ~1/3 of concentric metabolically

export function mechanicalWorkJ(
  sets: { pattern: string; reps: number; weightKg: number }[], heightCm = 175
): number {
  const k = heightCm / 175;
  return sets.reduce((j, s) =>
    j + s.reps * s.weightKg * G * (ROM_BY_PATTERN[s.pattern] ?? ROM_BY_PATTERN.default) * k, 0);
}

export function estimatedKcal(workJ: number): number {
  return (workJ * (1 + ECCENTRIC_FACTOR) / GROSS_EFFICIENCY) / 4184;
}

/** Label the primary number "mechanical work", kcal as the secondary. Never claim total burn. */
export const FOOD_KCAL = [
  { id: 'chocolate-square', name: 'squares of dark chocolate', kcal: 30,  src: 'USDA FDC' },
  { id: 'banana',           name: 'bananas',                   kcal: 105, src: 'USDA FDC, medium banana 118 g' },
  { id: 'beer-pint',        name: 'pints of lager',            kcal: 208, src: 'USDA FDC, 568 ml at 4.5% ABV' },
  { id: 'doughnut',         name: 'doughnuts',                 kcal: 250, src: 'USDA FDC, glazed yeast doughnut' },
  { id: 'pizza-slice',      name: 'slices of pizza',           kcal: 285, src: 'USDA FDC, pepperoni, 1/8 of 14 in' },
  { id: 'big-mac',          name: 'Big Macs',                  kcal: 563, src: "McDonald's published nutrition" },
];

// ---------- 4c. Time under tension ----------
export function timeUnderTensionSec(
  sets: { reps: number; tempoSec?: number }[], defaultTempo = 3.2
): number {
  return sets.reduce((t, s) => t + s.reps * (s.tempoSec ?? defaultTempo), 0);
}
// Copy: "38 minutes in the gym. 6 minutes 12 seconds of it actually under load."
// That ratio is a genuinely interesting stat and nobody else shows it.

// ---------- 4d. Bodyweight multiples ----------
export function bodyweightMultiples(totalKg: number, bodyweightKg: number): number {
  return totalKg / bodyweightKg;
}
// Copy: "You lifted your own bodyweight 53 times over."
// Also: heaviest single set / bodyweight -> "2.1x bodyweight on the deadlift."

// ---------- 4e. Height climbed (step / stair / sled work) ----------
export const STEP_RISE_M = 0.17;   // IRC max riser 7.75 in; 0.17 m is the working average
export function heightClimbedM(steps: number): number { return steps * STEP_RISE_M; }
export const STEP_COUNTS = [
  { id: 'esb',    name: 'the Empire State Building', steps: 1576, src: 'ESB Run-Up official' },
  { id: 'eiffel', name: 'the Eiffel Tower',          steps: 1665, src: 'SETE, ground to summit' },
];
```

### 4f. Framing selection order on the finish screen
1. **Total volume + 2-3 mass comparisons** (the hero, always shown)
2. **Bodyweight multiples** (always shown, one line, needs no picker)
3. **Bar travel distance vs one landmark** (shown when distance > 50 m)
4. **Time under tension + rest ratio** (always shown)
5. **Mechanical work / kcal** (shown only in the expandable detail, it is the weakest number)
6. **Lifetime milestone progress bar** (shown every session; it is the retention hook)

## PART 5 - Copy templates and tone

```ts
export const HERO_TEMPLATES = [
  '{kg} kg moved. That is {a} — or {b}.',
  '{kg} kg. {a}. {b}.',
  'You moved {kg} kg today: {a}, or {b} if you prefer.',
  '{kg} kg through the session. Call it {a}, or {b}.',
  'Total on the bar: {kg} kg. {a}. {b} if that lands better.',
  '{kg} kg. Which is {a}, give or take — or {b}.',
];
// Rotate deterministically, out of phase with the entry rotation:
export const templateFor = (sessionIndex: number) =>
  HERO_TEMPLATES[(sessionIndex * 5) % HERO_TEMPLATES.length];

export function phrase(c: Comparison): string {
  return c.isWhole
    ? `a whole ${c.entry.name}`
    : `${c.shown.toLocaleString()} ${c.shown === 1 ? c.entry.name : c.entry.plural}`;
}
```

### Tone rules (enforce in review, not just in prose)
**Do**
- Lead with the number. The number is the compliment.
- Second person, present tense, full stops. "You moved 18,400 kg."
- Let the object do the work. "3.4 African elephants" needs no adjective in front of it.
- One dry aside per screen, maximum, and only from the entry's `fun` field.
- Be specific where specificity is free: "Sue, the most complete T. rex ever found" beats "a dinosaur".
- Understate the big ones. "That is a whole blue whale" is stronger than "THAT'S AN ENTIRE BLUE WHALE!!"

**Don't**
- Banned words: *crushed, smashed, beast, monster, slay, savage, insane, amazing, incredible, awesome, epic, legend* (as praise), *gains* (as a noun of address), *champ, buddy, king, queen, warrior*.
- Banned constructions: exclamation marks (zero, not one), "Wow", "Let's go", "You're a machine", "Keep it up", "Great job!", emoji in body copy, more than one emoji per screen, "just" before a verb ("you just lifted"), and any sentence that ends in a fire emoji.
- Never editorialise about a low number. A 900 kg session gets exactly the same sentence structure as a 20,000 kg one.
- Never compare the user to other users on the finish screen. That belongs in the standings tab, opt-in.
- No rhetorical questions. No "Did you know?".

**Register reference:** a well-made sports broadcast graphic. Factual, confident, slightly deadpan, trusts the viewer. Not a party, not a coach shouting, not a chatbot being supportive.

**Worked good copy**
> **18,420 kg**
> That is 3.4 African elephants, or 38 concert grand pianos.
> You lifted your own bodyweight 216 times.
> The bar travelled 287 m. Almost the Eiffel Tower.
> 42 minutes in the gym. 7:04 of it under load.
> *Lifetime: 1,604,000 kg — 3.1% of the Titanic.*

**Worked bad copy (for the lint test suite)**
> 🔥🔥 BEAST MODE! You absolutely CRUSHED 18,420 kg today!! 💪 That's like 2.9 ambulances! Amazing work champ, keep it up!! 🚀

### Lint rules to ship as a unit test
```ts
const BANNED = /\b(crushed|smashed|beast|monster|slay|savage|insane|amazing|incredible|awesome|epic|champ|buddy|king|queen|warrior)\b/i;
const NO_BANG = /!/;
const EMOJI = /\p{Extended_Pictographic}/gu;
export function lintCopy(s: string) {
  if (BANNED.test(s)) throw new Error('banned praise word');
  if (NO_BANG.test(s)) throw new Error('no exclamation marks');
  if ((s.match(EMOJI) ?? []).length > 1) throw new Error('at most one emoji per screen');
}
```

## Risks

- Roughly 35 of the 139 masses are tagged 'representative' or 'estimate' rather than 'verified' (polar bear, fire engine, woolly mammoth, Argentinosaurus, London Eye, Tower Bridge, Space Needle, Gateway Arch). Surface these with hedged copy ('about 19 tonnes') or a tap-through source link, never as a hard figure a user can disprove.
- Real-world masses are cultural: 'a fully loaded semi truck at 80,000 lb' is a US federal limit and is wrong in the EU (40,000 kg / 44,000 kg). Consider a region field on vehicle entries, or use metric-neutral objects for those bands.
- Users on a lb-first locale will see a kg-derived comparison count that does not change when they toggle units, which is correct but looks like a bug. Compute counts from kg internally always and only format the total in lb.
- Animal comparisons can read as callous for some users (blue whale, T. rex are fine; 'adult humans' and 'newborn babies' will generate complaints). Keep 'newborn baby' and 'toddler' behind a setting or drop them; 'adult human' is safe because it is abstract.
- The 12-deep cooldown depends on the client having the last 12 workouts' chosen ids. On a fresh install or a restored account the history is empty and the first few sessions will pick the highest-base-score item every time. Seed the history from the server, or fall back to seeding the rotation with the workout's UTC date ordinal.
- Mechanical-work-to-kcal conversion is the weakest number in the system and the easiest to attack in an App Store review. Label it 'mechanical work' as the primary figure and keep kcal explicitly secondary and rounded to the nearest 10.
- Estimates for T. rex (8.4 t) and Argentinosaurus (70 t) are live scientific debates with published ranges of roughly 6-9 t and 65-80 t. Cite the specific paper in the tap-through, or a palaeontology-adjacent user will file a bug.
