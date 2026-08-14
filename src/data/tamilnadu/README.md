# Tamil Nadu location seed

Reference data for invite / user-management cascading pickers:
**district → taluk → city / municipality / town panchayat / village**.

## Coverage (this dump)

| Level | Count | Notes |
| --- | ---: | --- |
| Districts | **38** | Current TN list, including Mayiladuthurai, Tenkasi, Chengalpattu, Kallakurichi, Ranipet, Tirupathur |
| Taluks (LGD sub-districts) | **317** | All revenue taluks in the dump |
| Villages | **16,332** | Every LGD village with English + Tamil name and pincode |
| Places in MongoDB | **16,484** | 16,021 villages + 26 cities + 113 municipalities + 236 town panchayats + 88 taluk-HQ towns |
| Urban local bodies | **649** listed | 21 municipal corporations + 149 municipalities + 479 town panchayats (LGD type codes 4 / 5 / 7). Matched onto the village/taluk tree when the name is unique; leftover ULBs have no district in that extract and are not invented. |

ULB names are matched onto the village/taluk tree (type upgraded when the habitation already exists; otherwise inserted as an extra place under the best-matching taluk). Four corporations constituted after the April 2026 LGD ULB extract (Karaikudi, Namakkal, Pudukkottai, Tiruvannamalai) are marked `city` via `extra-corporations.json`. The **16,332 LGD villages + 317 taluks + 38 districts are complete** — nothing is sampled.

## Sources

1. **Villages / districts / taluks** — Local Government Directory (LGD), Ministry of Panchayati Raj, Government of India, dump dated **13 Jul 2026**. Packaged by [mchittineni/india-village-finder v1.3.0](https://github.com/mchittineni/india-village-finder/releases/tag/v1.3.0) (`tamil_nadu_villages.csv`). File: `tamil_nadu_villages.csv.gz`.
2. **Urban local bodies** — LGD `urban_local_bodies.30Apr2026.csv` via [ramSeraph/opendata lgd-latest](https://github.com/ramSeraph/opendata/releases/tag/lgd-latest), filtered to Tamil Nadu. File: `urban_local_bodies_tn.csv`.
3. **Tamil district / taluk names** — LGD native-script map from the same village-finder bundle (`regions_native.json`), with official Tamil district names overlaid in `districts-ta.json`.
4. **Name aliases** — common English spellings (Kanchipuram / Kancheepuram, Nilgiris / The Nilgiris, etc.) in `district-aliases.json`.

Data is used under **GODL-India**. Canonical live check: https://lgdirectory.gov.in

This is the most complete open dump that could be retrieved (full 38-district LGD village directory + statewide ULBs). It is not a sample. Census 2011-only directories (31 districts) were not used as the primary source.

## Load into MongoDB

```bash
npm run seed:tn-locations
```

Upserts the `TnLocation` collection. The API also auto-seeds if the collection is empty or incomplete when the server starts.
