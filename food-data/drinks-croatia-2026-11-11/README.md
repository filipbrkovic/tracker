# Croatia drinks research — work in progress

This directory preserves unfinished drinks-data collection alongside the completed
1,000-food CSV in `../croatia-2026-11-11/`. There is no finished, validated drinks
import CSV here yet. Do not treat these intermediate records as a reviewed import.

The scripts and structured source extracts are versioned so the research can
continue on another machine. Downloaded HTML discovery/page caches are ignored;
the discovery and collection scripts can fetch them again. `curate-generics.mjs`
uses the versioned source records from the completed food dataset to avoid
repeating existing foods.

Before publishing an import, finish manufacturer/retailer review, confirm
per-100g versus per-100ml units, check duplicates and missing/bounded nutrients,
retain attribution, and run the resulting CSV through LocalCal's real importer.
The completed food dataset's README documents its ANSES Ciqual attribution and
licence; manufacturer/retailer records retain their individual source URLs.
