# Toddler Routine Tracker

A local-first mobile app for tracking a toddler's daily routine — feeds, diapers, sleep, medical events, growth, and food introductions — for one or more caregivers.

## Language

**Child**:
The profile every Entry hangs off: name, birthdate, sex (required for growth charts), optional photo. The data model supports multiple children; the MVP UI assumes one. Carries no allergy field — allergies are derived from the meal tracker's Reaction data.
_Avoid_: Profile, kid, baby, patient

**Entry**:
One logged occurrence in a tracker. Every Entry has a timestamp and can be edited and deleted after logging. The five Entry kinds are Feed, Diaper Change, Sleep Session, Medical Entry, and Growth Measurement.
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
