# Research: WHO growth reference data for percentile charts

Resolves GitHub issue #3 (part of wayfinder map #1). Research date: 2026-09-24.

**Question:** Is WHO (or CDC) child growth reference data available in a bundleable,
permissively-licensed machine-readable form (LMS tables/JSON), how large is it, and
what would plotting percentile curves in a React Native app require? Outcome decides
whether the growth tracker gets percentile charts or stays a plain measurement log.

## Verdict (gist)

**Viable, at low cost — data is tiny (≤ ~100 KB of JSON for everything the app needs),
plotting is a standard RN line-chart problem, and there is even a ready-made MIT npm
package that bundles the WHO LMS tables. The one real decision is licensing: CDC data
is public domain (zero friction) but is clinically the US 2-years-and-older reference;
WHO data is the preferred 0–5 standard but is copyrighted WHO material whose site terms
exclude commercial use without written permission.** For a free, non-commercial app,
WHO data with attribution is fine; for a commercial app, either request WHO permission,
or ship CDC data (which covers birth–36 months in CSV form anyway).

## Data availability

### WHO Child Growth Standards (0–5 years)

- WHO publishes per-indicator, per-sex tables on the Child Growth Standards site, as
  PDF **and Excel** downloads, in both z-score and percentile form. Indicators include
  weight-for-age, length/height-for-age, weight-for-length/height, BMI-for-age, and
  head-circumference-for-age — exactly the set this app tracks (weight / height / head
  circumference).
  [Source](https://www.who.int/tools/child-growth-standards/standards) ·
  [Source (weight-for-age page with Excel links)](https://www.who.int/tools/child-growth-standards/standards/weight-for-age)
- Verified by downloading the girls weight-for-age percentile Excel table
  (`tab_wfa_girls_p_0_5.xlsx`, 16.7 KB): each row carries **Month, L, M, S** (the LMS
  parameters) plus percentile values P1–P99, monthly from 0–60 months (a companion
  table covers 0–13 weeks at weekly resolution). The LMS triples are sufficient both
  to plot any percentile curve and to compute an exact z-score for a given measurement
  via the standard LMS formula `z = ((value/M)^L − 1) / (L·S)` from WHO's methods
  report.
  [Source (methods & development publication)](https://www.who.int/publications/i/item/924154693X)

### CDC growth chart data (birth–20 years)

- CDC publishes machine-readable data files (CSV) for its growth charts, containing
  `Sex, Agemos, L, M, S, P3, P5, P10, P25, P50, P75, P90, P95, P97` per row. Verified
  by fetching `wtageinf.csv` (weight-for-age, birth–36 months): 5.3 KB, LMS columns
  included. Sibling files exist for length/stature, head circumference, BMI, etc.
  [Source (CDC percentile data files page, archived)](https://web.archive.org/web/2024/https://www.cdc.gov/growthcharts/percentile_data_files.htm) ·
  [Source (wtageinf.csv, archived)](https://web.archive.org/web/2024id_/https://www.cdc.gov/growthcharts/data/zscore/wtageinf.csv)
- Clinical context: CDC's own growth charts page directs "Infants and children ages 0
  to 2 years → WHO Growth Standards; Children ages 2 years and older → CDC Growth
  Charts". So for a toddler app (0–5), WHO is the clinically preferred reference; CDC
  data is the licensing-safe fallback and is a superset age-range-wise.
  [Source (CDC growth charts page, archived)](https://web.archive.org/web/2024/https://www.cdc.gov/growthcharts/)

## Licensing / redistribution terms

- **WHO:** The WHO website copyright notice states content "may be reviewed,
  reproduced or translated for research or private study but **not for sale or for use
  in conjunction with commercial purposes**"; any use "other than for educational or
  other non-commercial purposes require[s] explicit, prior authorization in writing."
  The 2006 standards report itself carries plain "Copyright World Health
  Organization". Attribution to WHO as source is required in all cases.
  [Source](https://www.who.int/about/policies/terms-of-use) ·
  [Source](https://www.who.int/publications/i/item/924154693X)
  - Practical read: bundling WHO tables verbatim in a _free_ app with attribution is
    defensible; bundling them in a _paid/commercial_ app needs a WHO permissions
    request (WHO has a permissions form; licenses for apps are granted case-by-case).
    [Source (permissions)](https://www.who.int/about/policies/publishing/permissions)
- **CDC:** US federal government work — "Most of the information on the CDC and ATSDR
  websites is not subject to copyright, is in the public domain, and may be freely
  used or reproduced without obtaining copyright permission." Attribution requested,
  no permission needed, commercial use fine (with the usual caveat that some
  third-party-contributed items on CDC pages are excluded — the growth chart data
  files are NCHS-produced government work).
  [Source (CDC Use of Agency Materials policy, archived)](https://web.archive.org/web/2024id_/https://www.cdc.gov/other/agencymaterials.html)

## Data size (measured, not estimated)

Converting the WHO girls weight-for-age 0–5 y percentile table to JSON:

| Content                                     | Size   |
| ------------------------------------------- | ------ |
| Full table (month, L, M, S, P1–P99) as JSON | 7.3 KB |
| LMS triples only (for computing z-scores)   | 3.3 KB |
| 5 plotting curves (P3/P15/P50/P85/P97) only | 2.1 KB |

So the app's whole reference set — 3 indicators (weight, height/length, head
circumference) × 2 sexes, monthly + weekly-resolution tables — lands at roughly
**40–90 KB of JSON**, depending on whether you keep LMS triples (recommended: they let
you compute the child's exact percentile, not just draw curves) or only curve points.
Even all six WHO indicators both sexes stays well under ~150 KB. Negligible against a
typical RN bundle.

Corroborating data point: the npm package `who-growth-standards@1.0.1` bundles all 12
WHO LMS tables (6 indicators × 2 sexes) at **daily** resolution — ~17,000 LMS triples —
plus the computation code in a **528 KB dist** with zero runtime dependencies and zero
network calls. Its code is MIT-licensed; its NOTICE explicitly notes the underlying
reference data remains WHO's work (mirroring the licensing nuance above).
[Source](https://www.npmjs.com/package/who-growth-standards)

## Plotting in React Native

Percentile charts are a solved UI shape: 3–7 smooth reference line series + a scatter
of the child's measurements. Credible, MIT-licensed options:

- **victory-native** (v42, MIT): current flagship RN charting library; renders via
  `@shopify/react-native-skia` with `react-native-reanimated` + gesture-handler as
  peers; includes d3-scale/d3-shape for smooth curves. Best fit for polished,
  interactive charts; heaviest dependency set (Skia + Reanimated). Works with Expo.
  [Source](https://www.npmjs.com/package/victory-native)
- **react-native-svg** (MIT) + hand-rolled paths (d3-shape is plain JS): lightest
  option, full control, no extra native deps beyond svg (already common in Expo apps).
- **react-native-gifted-charts** (MIT, actively maintained) / **react-native-chart-kit**
  (MIT): simpler APIs; gifted-charts is built on react-native-svg and supports curved
  line charts out of the box.

Effort estimate: trim the 6 tables you need to LMS/curve JSON (a one-off script, an
afternoon), one chart component rendering reference curves + measurement scatter,
plus the ~10-line LMS z-score function. **Roughly 1–2 days of implementation**, or
hours if built on the `who-growth-standards` package for the math.

## Cost summary

| Path                           | Data work                      | Licensing                                                         | Charting                                         | Total    |
| ------------------------------ | ------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------ | -------- |
| WHO tables, self-trimmed       | Convert 6 xlsx → JSON (script) | OK for free app w/ attribution; written permission for commercial | victory-native or react-native-svg, ~1 component | 1–2 days |
| `who-growth-standards` npm pkg | None (bundled)                 | Same WHO nuance (code MIT, data WHO)                              | Same                                             | <1 day   |
| CDC CSVs                       | Convert 3–4 CSVs → JSON        | Public domain, attribution only                                   | Same                                             | 1–2 days |

**Bottom line for the map:** percentile charts are cheap enough to keep on the table.
The blocking sub-decision is licensing posture (free vs commercial app; WHO vs CDC
reference), not engineering effort.
