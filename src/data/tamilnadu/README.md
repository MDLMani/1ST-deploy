# Tamil Nadu location seed

Reference data for invite / user-management cascading pickers:
**district → taluk → city / municipality / town panchayat / village** (search by **name or pincode**).

## Coverage (this dump)

| Level | Count | Notes |
| --- | ---: | --- |
| Districts | **38** | Current TN list, including Mayiladuthurai, Tenkasi, Chengalpattu, Kallakurichi, Ranipet, Tirupathur |
| Taluks (LGD sub-districts) | **317** | All revenue taluks in the dump |
| Villages | **16,332** | Every LGD village with English + Tamil name and pincode |
| India Post offices | **11,795** | Full Tamil Nadu postal directory (HO / SO / BO) |
| Unique pincodes | **2,047** | Every PIN found in India Post TN + LGD village extras |
| Places in MongoDB | **~24,900** | LGD places + postal localities not already in the village tree |

Urban local bodies remain matched onto the village/taluk tree when possible. Postal offices that are not already LGD villages are inserted so **pincode search can find localities that were not in the village list**.

## Sources

1. **Villages / districts / taluks** — Local Government Directory (LGD), Ministry of Panchayati Raj, Government of India, dump dated **13 Jul 2026**. Packaged by [mchittineni/india-village-finder v1.3.0](https://github.com/mchittineni/india-village-finder/releases/tag/v1.3.0) (`tamil_nadu_villages.csv`). File: `tamil_nadu_villages.csv.gz`.
2. **Urban local bodies** — LGD `urban_local_bodies.30Apr2026.csv` via [ramSeraph/opendata lgd-latest](https://github.com/ramSeraph/opendata/releases/tag/lgd-latest), filtered to Tamil Nadu. File: `urban_local_bodies_tn.csv`.
3. **All Tamil Nadu pincodes / post offices** — India Post *All India Pincode Directory* (Department of Posts / data.gov.in mirror), filtered to `StateName = Tamil Nadu` (**11,795** offices, **2,040** unique PINs). Taluk names merged from an older directory dump when the office+PIN matched. File: `tamil_nadu_pincodes.csv.gz`.
4. **Tamil district / taluk names** — LGD native-script map from the same village-finder bundle (`regions_native.json`), with official Tamil district names overlaid in `districts-ta.json`.
5. **Name aliases** — common English / postal spellings in `district-aliases.json`.

Data is used under **GODL-India** / NDSAP. Canonical live checks: https://lgdirectory.gov.in and https://www.data.gov.in

## Load into MongoDB

```bash
npm run seed:tn-locations
```

Upserts the `TnLocation` collection. The API also auto-seeds (and re-seeds when postal coverage is missing) when the server starts.

## City / village picker

- Type a **place name** → search within the selected district + taluk.
- Type a **3–6 digit pincode** → returns matching village/town/office names as `Name · 600001`, preferring the selected taluk, then the district, then statewide.
