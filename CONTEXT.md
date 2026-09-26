# Toddler Routine Tracker

A local-first mobile app for tracking a toddler's daily routine — feeds, diapers, sleep, medical events, growth, and food introductions — for one or more caregivers.

## Language

**Child**:
The profile every Entry hangs off: name, birthdate, sex (required for growth charts), optional photo. The data model supports multiple children; the MVP UI assumes one. Carries no allergy field — allergies are derived from the meal tracker's Reaction data.
_Avoid_: Profile, kid, baby, patient

**Entry**:
One logged occurrence in a tracker. Every Entry has a timestamp and can be edited and deleted after logging. The seven Entry kinds are Feed, Diaper Change, Sleep Session, Medical Entry, Growth Measurement, Meal, and Reaction.
_Avoid_: Event, log, record, activity

**Feed**:
An Entry recording one breastfeeding. A counter plus timestamp; side (left/right) and duration are optional fields.
_Avoid_: Breastfeeding event, nursing session

**Diaper Change**:
An Entry recording one change: type (wet / dirty / both) plus an optional free-text note.
_Avoid_: Diaper event, nappy log

**Sleep Session**:
An Entry with a start and end time, logged via a start/stop timer and editable afterwards. Carries a 3-point quality rating (poor / okay / great) and zero or more Sleep Quality Factors. No nap/night category — derivable from timestamps.
_Avoid_: Nap, sleep event, rest

**Sleep Quality Factor**:
A tag on a Sleep Session marking a suspected cause of poor sleep (seeded: many wakeups, illness, fussiness/cries, long awake time). User-extensible: parents can add their own factors.
_Avoid_: Sleep disturbance, sleep tag

**Medical Entry**:
An Entry in one of four categories — medication, vaccine, symptom, temperature — with a note. Lightly structured: medication entries carry name + dose; temperature entries carry a numeric value.
_Avoid_: Health record, doctor visit

**Growth Measurement**:
An Entry recording weight, height, and/or head circumference at a point in time. Each of the three is optional per Entry.
_Avoid_: Measurement, weigh-in, percentile entry

**Meal**:
An Entry recording one eating occasion: timestamp, one or more Foods, a 5-point amount-eaten scale, and an optional note. No meal-type category — derivable from timestamp. Logging a Meal containing an untried Food starts that Food's Watch Period; the Meal log is the exposure.
_Avoid_: Feeding log, food entry

**Food**:
A first-class entity: a name plus zero or more Allergen Tags. Ships as a seeded database of a few hundred common foods with pre-set tags; parents can add custom Foods with manual tags. Carries a per-child Food Status.
_Avoid_: Ingredient, dish

**Allergen Tag**:
A marker on a Food naming one of the big-9 allergens (milk, egg, peanut, tree nuts, soy, wheat, fish, shellfish, sesame). Informational grouping only: a Reaction flags the Food, never the whole category.
_Avoid_: Allergy category, allergen group

**Food Status**:
A Food's per-child state: untried / trying / safe / avoid. Flips to trying on first log; derived lazily to safe when the Watch Period ends with no Reaction; set to avoid by any logged Reaction. Re-challenging an avoided Food is allowed and restarts the Watch Period.
_Avoid_: Food state, tolerance

**Watch Period**:
The 3 days after a Food's first log, during which the child is watched for Reactions. Guidance is gentle everywhere: overlapping introductions and first tries of allergen-flagged Foods surface dismissible heads-ups, never blocks.
_Avoid_: Observation window, trial period

**Reaction**:
An Entry logging an adverse response to a single Food: timestamp, 3-point severity (mild / moderate / severe), a seeded symptom checklist (rash/hives, vomiting, diarrhea, swelling, breathing issues), and an optional note. Any Reaction moves the Food to avoid and adds it to the Child's derived suspected allergies.
_Avoid_: Allergic event, incident
