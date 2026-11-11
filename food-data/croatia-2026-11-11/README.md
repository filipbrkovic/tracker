# Croatia food import — 11 November 2026

Import **croatia-foods-1000.csv** into LocalCal using the food CSV import and review its preview before confirming. This file has not been imported into your database.

## Contents

1,000 distinct name-and-brand records:

| Source | Foods |
| --- | ---: |
| Podravka Group Croatian product pages | 454 |
| Kraš Croatian product pages | 113 |
| Vindija Croatian product pages | 26 |
| ANSES Ciqual 2025 reference foods | 407 |

The selection covers everyday ingredients, raw and cooked meat and fish, dairy, eggs, grains, legumes, fruit, vegetables, nuts, oils, preserves, seasonings, sweets, and packaged meals. Manufacturer brands include Podravka, Eva, Lino, Dolcela, Vegeta, Zlato polje, Kraš and 'z bregov Protein.

This is a curated selection for use in Croatia, not a statistically ranked list of Croatia's most consumed foods. Brand coverage is concentrated in these three manufacturers. It does not cover every supermarket brand or provide invented standard values for homemade burek, sarma, ćevapi or restaurant meals. A matching manufacturer product applies only to that product, not every dish with a similar name.

Generic food names retain the source's English description, including cut, skin, cooking state and draining instructions. Croatian search aliases are supplied for the reference foods. Manufacturer products retain their Croatian package names for identification. Different preparations remain separate records. Categories and aliases are editorial search aids, not nutritional classifications.

## Format and units

UTF-8 with BOM, semicolon delimiter, quoted fields, decimal point, one header and 1,000 food rows. Header matches LocalCal's current import template:

`name;brand;aliases;basis;kcal;p;g;c;piece;source;cat`

- `kcal`: source energy in kilocalories.
- `p`: protein in grams; `g`: fat in grams; `c`: carbohydrate in grams.
- `basis`: 987 records use `100g`; 13 use `100ml`. Nutrients always apply to the stated basis.
- All Ciqual records, including drinks and oils, are **per 100g edible portion**. Do not log their millilitres as grams. No density conversion was invented.
- `piece` is blank: no guessed portion weights or serving conversions.
- `aliases` uses a pipe separator. Source links and essential qualification notes are in `source` on every row.

All 1,000 foods have source energy. **930 have all three numeric macros. Seventy have one blank macro** because the source reports traces, a less-than limit, or missing data. The original statement is retained in `source`; blank never means measured zero. Of these 70 fields, 20 are traces, 49 are less-than values, and one is unavailable. LocalCal preserves these as unknown, so affected diary macro totals can be incomplete. No unknown quantity was filled with an invented number.

## Sources and attribution

Manufacturer values were extracted from public nutrition tables on 11 November 2026. Each branded row links to its individual product page:

- [Podravka Group](https://podravkagrupa.com/hr/proizvodi/)
- [Kraš](https://www.kras.hr/hr/proizvodi)
- [Vindija](https://www.vindija.hr/hr/proizvodi)

Reference values: **ANSES, Table de composition nutritionnelle des aliments Ciqual 2025**, [doi:10.57745/RDMHWY](https://doi.org/10.57745/RDMHWY), distributed under [Licence Ouverte / Etalab 2.0](https://spdx.org/licenses/etalab-2.0.html). Every reference row includes its Ciqual food code. The selection adds aliases and categories and leaves non-numeric limits blank; it does not change numeric source nutrients.

Ciqual fields used: energy under EU Regulation 1169/2011 in kcal, protein N×6.25, carbohydrate, and total fat. These are reference composition values, not laboratory measurements of an individual Croatian purchase. Source energy is retained rather than recomputed from three macros; fibre, organic acids and other energy-bearing components can explain differences.

## Quality checks

- Checked every exported numeric value against its retained source row or nutrition panel.
- Removed duplicate pages with the same name, brand and nutrition. Omitted conflicting panels for the same identity instead of choosing an arbitrary value.
- Excluded suspicious manufacturer energy values, kJ/kcal disagreements, implausible values, and ambiguous dry-versus-prepared soup panels. No suspicious source number was silently corrected.
- Excluded plant-drink pages with ambiguous website mass/volume labelling pending package verification.
- Applied a 1,000-record cap with round-robin brand coverage after reference-food selection. Fifty-three otherwise eligible branded records were left out by that cap.
- Ran the actual LocalCal CSV parser and import preview: **1,000 added, zero rejected, zero warnings**. Repeating the same import: **zero added, zero updated, 1,000 skipped** in an isolated test. Existing foods with matching names and brands may be updated in your actual database; check the preview.
- Verified Croatian diacritics, regional alias search, distinct identities, blank preservation and portion scaling.
- Existing application checks passed: **34 JavaScript tests** and **Go tests**. The initial JavaScript run lacked Go on PATH; rerunning with the installed Go toolchain passed.

`quality-audit.json` records excluded pages and reasons. `validation-results.json` records the import checks and the CSV SHA-256 checksum. Retained source extracts are available locally in `sources/`.

The structured inputs needed by curation and validation are versioned for use on
another machine. Run `node food-data/croatia-2026-11-11/verify-dataset.mjs` from the
repository root to check the delivered CSV without network access. Downloaded
HTML, unrelated reference downloads, per-page crawl caches and preview images
are ignored. Collection scripts can refetch the manufacturer pages; a new crawl
is a new snapshot and may contain different labels. Rebuilding the CSV with
`build-csv.mjs` requires the `@oai/artifact-tool` authoring runtime used to create
it; importing or validating the delivered CSV does not.

Manufacturer recipes and labels can change. For a branded food, the nutrition panel on the package you actually have is the deciding reference. This dataset is a one-time snapshot, with no recurring update scheduled.
