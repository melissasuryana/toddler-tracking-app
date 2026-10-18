# Hybrid meal and food introduction flow

Use a hybrid of variants B and C: the food logging form has Meal and Introduction tabs, while the Home screen's active Watch Card offers contextual quick actions. This keeps meal and introduction logging together when starting a food entry, while making follow-up actions for an ongoing food introduction readily available from Home.

## Meal name requirements

Confirmed requirements for implementation; this section records the agreed design, not implemented behavior.

### Name and display

- Add an optional free-text Meal name describing the dish, separate from notes and named Foods.
- Trim surrounding whitespace; treat whitespace-only input as unnamed. The maximum name length is 100 characters.
- Show the name in timeline summaries and Meal details. Support editing and clearing it.
- Existing unnamed Meals retain their current display and remain valid.

### Autocomplete

- Derive suggestions only from the current Child's non-Deleted Meals with nonblank names.
- A new Meal starts with a blank name. Show recent names when the field receives focus, then filter as the caregiver types.
- Match case-insensitive substrings and collapse duplicate names case-insensitively after trimming.
- Show up to 10 suggestions, ordered by most recent use. Use the latest matching Meal by occurrence time as each suggestion's source.
- Allow a new name at any time. Never automatically select a suggestion.

### Suggestion prefill

- Explicitly selecting a suggestion fills the name and prefills Food Category flags, Allergen Tag flags, Texture, and Feeding Style from its source Meal.
- Prefill only fields the caregiver has not already changed; preserve deliberate edits.
- Leave the current timestamp, amount eaten, and notes unchanged.
- Typing a matching name alone does not trigger prefill.
- Support autocomplete when editing a Meal and when using the Introduction's "Also log a meal" shortcut.
- Preserve fields supplied by the Introduction shortcut rather than replacing them with suggestion values.

### Compatibility and acceptance

- Opening an existing Meal leaves all its values unchanged.
- Existing defaults remain in effect unless explicit suggestion selection replaces an untouched field, subject to the Introduction-shortcut protection above.
- Naming or reusing a Meal never changes Food Status, creates or changes an Introduction, or starts or changes a Watch Period.
- The Meal name is a descriptive label, not a meal-type category or a link to a Food.
- Verification must cover blank and whitespace-only names, the length limit, saving/editing/clearing names, and unchanged unnamed-Meal display.
- Verification must also cover Child isolation, exclusion of Deleted Meals, duplicate-name collapse, substring matching, the 10-suggestion limit, occurrence-time ordering, explicit-selection-only prefill, preservation of edited fields and Introduction shortcut values, and unchanged exposure behavior.
