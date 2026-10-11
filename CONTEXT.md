# Toddler Routine Tracker

A local-first mobile app for tracking a toddler's daily routine — feeds, diapers, sleep, medical events, growth, and food introductions — for one or more caregivers.

## Language

**Child**:
The profile every Entry hangs off: name, birthdate, sex (required for growth charts), optional photo. The data model supports multiple children; the MVP UI assumes one. Carries no allergy field — allergies are derived from the meal tracker's Reaction data.
_Avoid_: Profile, kid, baby, patient

**Entry**:
One logged occurrence in a tracker. Every Entry has a timestamp and can be edited and deleted after logging. The eight Entry kinds are Feed, Diaper Change, Sleep Session, Medical Entry, Growth Measurement, Meal, Introduction, and Reaction.
_Avoid_: Event, log, record, activity

**Deleted**:
The end state of an Entry after a confirmed delete: content fields are wiped for good, leaving only the row's id and `deleted_at` as a scrubbed tombstone so future sync can propagate the deletion. There is no Recently Deleted view and no restore — the confirm dialog is the only guard.
_Avoid_: archived, soft delete, trash, bin

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
An Entry in one of four categories — medication, vaccine, symptom, temperature — with a timestamp and an optional note on every category. Medication entries carry a required name (free text, autocompleted from the Child's medication history) and an optional free-text dose combining amount and unit ("5 ml"). Vaccine entries carry a required name with the same history autocomplete; there is no seeded vaccine list. Symptom entries carry a required short free-text description and cover illness and observation only — allergy symptoms belong to Reaction. Temperature entries carry a required numeric value with its unit (°C or °F) stored per Entry, defaulting from the app's temperature-unit setting; no measurement site is captured.
_Avoid_: Health record, doctor visit

**Growth Measurement**:
An Entry recording weight, height, and/or head circumference at a point in time. Each of the three is optional per Entry.
_Avoid_: Measurement, weigh-in, percentile entry

**Meal**:
An Entry recording one eating occasion: timestamp, a 5-point amount-eaten scale, an optional note, and what was eaten as two independent manual multi-select flag sets — Food Category flags and Allergen Tag flags — with no named Foods. A Meal carries no exposure semantics: it never changes Food Status and never starts a Watch Period. Both flag sets are optional (a Meal may have neither); Allergen Tag flags use the same big-9 vocabulary as Foods. The amount is always present and defaults to 4 of 5. Optionally carries a multi-select Texture (purée / mashed / soft finger food / firm finger food) and a multi-select Feeding Style (spoon-fed / self-fed with hands / self-fed with utensils); both default to the Child's latest non-Deleted Meal by occurred_at. A Meal is never linked to an Introduction; an Introduction offers an "Also log a meal" shortcut that pre-fills a new Meal (timestamp, the Food's category and allergen flags, and the Introduction's texture replacing the remembered texture). No meal-type category — derivable from timestamp.
_Avoid_: Feeding log, food entry

**Food Category**:
A fixed enum grouping Foods: fruit, vegetables, grains & cereals, proteins, dairy, nuts & seeds, fish & shellfish, compound. Assigned per Food in the seed database; also recordable directly on a Meal as a manual flag noting what kinds of food were served. Carries no exposure semantics and claims nothing about which specific Foods were eaten.
_Avoid_: food group, food type

**Introduction**:
An Entry recording one exposure of a named Food: timestamp, exactly one Food, an optional note, and an optional single-select Texture (purée / mashed / soft finger food / firm finger food). The Introduction is the only exposure record: logging one flips an untried Food to trying and starts its Watch Period, and logging one for an avoided Food re-challenges it (back to trying, Watch Period restarts). Texture is informational only — Food Status is tracked per Food, not per texture. An optional first-tried date supports backfilling foods introduced before the app was in use; every Food Status change traces to an Introduction (or Reaction) Entry.
_Avoid_: first taste event, trial, exposure log

**Food**:
A first-class entity: a name plus zero or more Allergen Tags. Ships as a seeded database of a few hundred common foods with pre-set tags; parents can add custom Foods with manual tags. Carries a per-child Food Status.
_Avoid_: Ingredient, dish

**Allergen Tag**:
A marker on a Food naming one of the big-9 allergens (milk, egg, peanut, tree nuts, soy, wheat, fish, shellfish, sesame). Informational grouping only: a Reaction flags the Food, never the whole category.
_Avoid_: Allergy category, allergen group

**Food Status**:
A Food's per-child state: untried / trying / safe / avoid. Always derived from the current set of non-Deleted Entries — deleting a Food's only Introduction returns it to untried, and editing an Introduction's date moves the Watch Period window. An Introduction flips untried to trying; trying derives lazily to safe when the Watch Period ends with no Reaction, or can be marked safe manually from the Food detail view (ending the Watch Period early); any Reaction sets avoid. Re-challenging an avoided Food happens only by logging a new Introduction, which restarts the Watch Period.
_Avoid_: Food state, tolerance

**Watch Period**:
The 3 days after a Food's first Introduction, during which the child is watched for Reactions. Guidance is gentle everywhere: overlapping introductions and first tries of allergen-flagged Foods surface dismissible heads-ups, never blocks.
_Avoid_: Observation window, trial period

**Reaction**:
An Entry logging an adverse response to one or more suspected Foods: timestamp (when the symptoms appeared, backdateable, with no link to any Introduction), at least one Food (any Food may be flagged; the picker sorts trying Foods first), a required 3-point severity (mild / moderate / severe), an optional multi-select from a seeded symptom checklist (rash/hives, vomiting, diarrhea, swelling, breathing issues — seed-only, the note covers anything else), and an optional note. A Reaction is a terminal override: it ends any active Watch Period and moves every flagged Food to avoid from any status — including untried, which covers reactions to foods tried before the app was in use — adding them to the Child's derived suspected allergies.
_Avoid_: Allergic event, incident
