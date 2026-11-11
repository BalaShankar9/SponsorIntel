# Register history in company dossiers

This optional offline comparison adds two dated register observations to the company atlas. It is part of the complete sponsor-directory scope in `SPONSOR_COMPANY_ATLAS_PLAN.md`. Its purpose is to make record changes inspectable before later identity or job research. It does not discover licence grant/revocation dates, approve a business identity or update production.

## Source and matching contract

Supply both complete original CSV files with their exact official URLs, source dates and actual observation timestamps. The earlier source date must precede the later source date. Preserve the original bytes, digests, grouped entries and every source-record reference from each file; a source date is distinct from a download/import time. The builder makes no network requests.

Match only the existing research key: whitespace-normalized and casefolded organisation name, town and county. These are register-entry clues, not a legal-company identifier. A changed normalized name or location stays as two unmatched records. Similar names, a shared website or a plausible relocation cannot connect them automatically. Earlier observations or business reviews must never transfer to a different key.

Compare complete route/rating pairs and recorded spelling variants. Ordering of source rows or a different duplicate count alone is not a route, rating or spelling change. Preserve source-row and duplicate-count differences separately, with both original row-reference lists available for inspection. Overlapping change categories must not be added together as a unique company count.

## Presentation and export contract

The later snapshot remains the default directory and retains its own entry/row denominators. An earlier-only view is explicitly historical; it must not add those entries to the later register count. Filters should distinguish changed matched records, records found only in the later snapshot and records found only in the earlier snapshot. Every dossier identifies the selected snapshot and shows the applicable before/after record, exact pair differences and source provenance.

Use phrases such as **only in the earlier snapshot**, **only in the later snapshot** and **recorded route/rating difference**. Do not label these as revoked licences, newly licensed businesses, closures, relocations, current vacancies or changes in sponsorship willingness. Two snapshots do not reveal intervening events or why a row changed. An unchanged record is not a fresh employer review.

Downloads retain both provenance objects and the selected record/comparison without replacing the existing unknown business fields. Historical business claims remain attached only to the exact later snapshot for which their evidence packet was prepared. Earlier-only dossiers must not inherit the later packet. Spreadsheet exports remain formula-safe; JSON preserves normalized source text, original row references and exact route/rating associations.

This feature does not add saved-account storage, a new collector, an owner approval path or production sponsor IDs. The identity desk's 500-record ceiling, shared source limits and current recovery/capacity holds remain unchanged.

## Available retained pair

The complete **2 October 2026** file was actually downloaded **4 October at 07:58:43.247144 UTC**. Its SHA-256 is `67a7bcb01f31570fa906584ee429ed4d5a5fabf17e5b914b9bc42656c8743ac1`; the retained import metadata independently contains the same digest. Its later 08:08 import timestamp must not replace the download observation.

The complete **11 November 2026** file was actually downloaded that day at **15:46:45.099861 UTC**, SHA-256 `b47added0ad52e51af64b32319b7b8b463dddd0f04ce101eeb3ab427c0571682`. Both files were already retained locally before this comparison work; no second download is needed.

Independent raw-file reconciliation gives 143,138 earlier rows / 127,902 entries and 143,009 later rows / 127,873 entries. There are 125,951 matching keys, 1,951 earlier-only and 1,922 later-only keys. Among matched records, 160 have route/rating-pair or spelling-variant differences: 97 pair-set differences and 67 variant differences, with overlap. Another 124 have count-only differences. These are source-record observations, not verified business or licence events. Implementation/browser acceptance and delivered artifact hashes belong in the dated release receipt.
