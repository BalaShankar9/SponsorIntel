# 2.49.0 — daily education discovery

Known-employer refresh does not discover the wider market. This release adds a bounded daily Teaching Vacancies scout to the existing hourly business workflow. It checks original adverts and records private new-employer candidates, with separate automated attribution and retained evidence. It never publishes jobs or changes public sponsorship counts.

At most two education candidates, two search pages and four source requests per UTC day; the existing five-new-lead and shared 500-request allowances remain in force. Daily browser scouting must count these retained candidates before adding new LinkedIn/job-post leads. Master and separate discovery pause switches are available in Admin. Interrupted runs are held/uncertain, and replay cannot refetch. No AI, paid service, new credentials, email or social sends are added.

Migration `0032_teaching_scout.sql` adds two operational tables and a discovery switch to the existing business controls. Earlier code can ignore the additions; code rollback must preserve the new tables and retained history.

Validation: 477 tests pass, including a Cloudflare Workflow/D1 runtime test, concurrent reservation/replay, lost acknowledgements, private-only writes, exact source identity, conflicting wording, expiry, paused operations, source errors and owner API protections. Build, browser payload checks and Wrangler dry-run pass. The owner component was visually inspected with clearly labelled fictional local records. The live source parser was checked against a dated real original advert; that research observation is not an unattended production receipt.

Source access/reuse, attribution, evidence and remaining publication work: `docs/EDUCATION_DISCOVERY.md`. Existing five retained leads on 8 October mean the first production daily search should hold without new requests. First scheduled receipt and later genuine automatic candidate retention remain open until independently observed. No allowance reset or extra bootstrap pass is authorized by this release.

Live at 19:49 UTC on 8 October: Worker `7a5da86f-2251-4378-a83c-407646e1a793`, custom domains intact. Only migration 0032 was pending and applied. Read-only recovery inspection at 19:48:45.944 UTC matches all 131 schema objects across 32 migrations and confirms a current recovery point; no customer-data export or restore was performed. Code rollback target: prior Worker `5ca33c35-76fc-4394-b980-1192f6f809bf`; retain the added schema/history.

The signed-in live owner browser renders New employer discovery, its limits and awaiting-first-run state. The master and discovery controls are enabled. D1 confirms five leads already retained today and zero scout runs. The latest scheduled business-497635 completed at 19:46:32.322 UTC **before this deployment**, so it is not a receipt for the new step. The next hourly slot is 20:45 UTC; today's allowance should hold sourcing until 9 October. No run was forced. The public browser still shows 926 roles, 35 employers, 55 sponsorship-mentioned roles and 873 licence-linked roles. Screenshot: `outputs/sponsorintel-education-discovery-live.jpg` in the task workspace.

Hosted GitHub validation remains subject to the existing account billing lock. Local tests and deployment evidence do not establish passing hosted CI. The draft PR remains unmerged.
