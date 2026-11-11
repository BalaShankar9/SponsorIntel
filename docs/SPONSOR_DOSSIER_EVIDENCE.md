# Retained evidence in company dossiers

The offline atlas can carry a bounded packet of historical business observations beside its complete register baseline. This connects useful retained research to each exact entry without converting old observations into current business approval. It is not a replacement owner desk, a network collector or a live integration.

The initial supplied packet is `docs/data/sponsor-atlas-historical-evidence-2026-11-11.json`: **two entries, 13 field claims and six observations** from retained 20, 23 and 30 October receipts. Animal Trust has an operating name, relationship, website, activity, practice examples, public identifier and careers link. Numan has an operating name, relationship, website, activity, service-location context and public identifier. These are historical observations requiring rechecking; **zero businesses are newly verified**. The Numan and Animal Trust prior follow-ups remain **27 and 30 October**, respectively. No old date is advanced.

Only short public factual summaries and source links are selected. The six observations are paraphrases of earlier agent-assisted inspections, not retained raw primary pages or verbatim quotations. A receipt digest identifies the retained repository record; it is not the digest of the original website and does not establish that website's current content. CQC attribution is retained without its ratings, logo or endorsement. Registered location, service location and example workplaces remain distinct.

## Packet and binding

`build-sponsor-dossiers.py --evidence <packet.json>` adds an optional evidence section. Existing builds without the option retain their original register-only behavior. The packet is bound to the exact supplied register SHA-256 and, for every subject, its full research key, exact name/town/county tuple and complete source-record references. A renamed entry, altered row set, different snapshot or similar name must not inherit evidence automatically.

Input contains `schema_version`, the fixed `kind`, `register_sha256`, an actual packet `prepared_at` time, `observations` and `subjects`. Preparing a packet is not a fresh source observation. Each observation carries an ID, public HTTPS URL, original `observed_at`, `retained_operator_observation` kind, supporting summary, repository receipt reference/digest and attribution. Each field claim names its value and supporting observation IDs. The prior follow-up may be null when unknown; otherwise preserve it exactly.

### Version 2: dated reviews with unknown source-observation times

Some retained reviews establish public facts and a review date but do not retain the original page-observation clock. Do not borrow a source-approval, workflow, download, report-generation or later review timestamp. A recorded calendar day must not be converted to midnight and described as an actual visit.

Version 2 accepts the unchanged timestamped observation shape above and a separate `retained_operator_review` shape. The latter requires **`observed_at: null`** and **`reviewed_on: YYYY-MM-DD`**, plus the common identifier, source URL, short factual summary, retained receipt reference/hash and attribution. `reviewed_on` is the date of the retained review record, not a claim that the page was visited at a known time. The supporting receipt or dated review document must establish that date; explain its basis in the dated curation record. A future or impossible calendar date, non-null observation time, wrong kind/version or extra date field is rejected. Version 1 continues requiring its original exact timestamp format.

Display these records as **Retained review dated [date]; original source observation time not recorded**. Mixed evidence keeps exact source observations and dated review records separately labelled. Export the null and calendar date without conversion. No review date supplies freshness, source rights, approval or a current business value. The existing hard bounds, exact snapshot/subject binding, URL rules, unknown fields and immutable older editions remain unchanged.

The expanded packet is a new file rather than an overwrite of the first two-pilot packet. Existing pilot claims, observations and overdue business-review dates must remain exact. A discovery follow-up, source approval or advert hold is not a business-profile follow-up; where no such business review exists, its due date stays unknown. Old vacancy counts and sponsorship wording do not enter business fields.

Supported fields match the existing business-identity vocabulary: `business_name`, `relationship`, `website`, `activity`, `locations`, `official_identifier` and `careers_url`. Relationships retain the existing trading-name, website-operator, operating-organisation, subsidiary and group choices. Different values for a field remain competing supplied claims; the builder cannot choose or approve a winner. Current vacancies and role-level sponsorship are outside this packet.

Validation rejects unknown/private control fields, mismatched subjects, duplicate identities, missing observation references, malformed dates, unbounded content and unsafe links. This initial historical format accepts canonical public DNS HTTPS links without credentials, ports, queries or fragments. Receipt references are bounded public repository document/evidence paths, with no traversal. No URL or referenced file is fetched automatically. These checks validate structure and provenance binding; they do not establish semantic truth, source rights or current legal identity.

The packet is capped at **500 subjects**, independently of the complete atlas baseline. This local bound does not seed, expand or bypass the production identity desk's 500-record insertion ceiling. The original observation times and supplied receipt declarations survive the build and dossier export. There is no production sponsor ID, approval state, actor, request key or revision in the imported packet.

## Reading and reviewing

Historical fields must appear beside an explicit recheck notice, their actual source-observation date, supporting summary and original source link. The overview reports retained-evidence coverage separately from the complete register count and newly verified businesses. A missing field remains unknown. An old careers URL is not proof of current intake; a company or regulator identifier is not evidence that a particular role sponsors. Unreviewed names do not silently widen the register search.

The downloaded dossier carries the supplied evidence and its original dates for further review. It does not save to an account, approve an identity, contact an organisation or submit an application. Keep private notes, rights assessments, customer information and application material out of this research pack.

After the existing operational gates pass, reopen the current original sources, exact register entry and existing owner record. Use the authenticated **Sources → Business identities** desk for an agent-assisted, reasoned review, retaining its request replay, concurrency protection and immutable history. The historical packet cannot supply a new approval or override a later owner hold. Feed admission, the legal employer of a vacancy and role-specific sponsorship remain separate decisions.

This is an extension of Stage A in `SPONSOR_COMPANY_ATLAS_PLAN.md`. Stage B's fresh, reviewed business sample and the broader live directory remain unfinished. See the dated atlas acceptance record for what was actually generated and tested.
