# Applications, real businesses and sponsorship coverage

Owner-requested additions to the active Sponsor Intel objective, **20 October 2026**. These are implementation requirements; dated acceptance below identifies the first delivered slice. Codex leads implementation within the existing services, owner controls and budgets. Read `DAILY_OPERATOR.md` and the current checkpoint before execution.

The owner wants an autonomous tool that applies to all jobs a user chooses, real businesses behind sponsor-licence names, and substantially more genuine sponsorship opportunities. This request authorises building these capabilities. It does not supply any customer's answers, documents, consent to particular destinations, or authority to submit an application today. Existing restrictions on operator application submission remain until a specific applicant authorises a supported batch.

## 1. Real business identity behind each licence

Build on the existing official register, city directory and reviewed employer links. Retain the exact legal/register name while showing the evidenced trading name, official website, business activity, town/city, operating locations and careers link. Store company/charity/education identifiers when applicable; not every sponsor is a Companies House company. Only public business contact details belong in the directory.

Use dated, attributed relationships: legal entity → trading name → branch/practice/school → job's employing entity → exact current sponsor record. Model parent/subsidiary, franchise and joint ventures separately. A group website, shared address, similar name or ownership interest alone cannot prove that a specific appointment is covered by another entity's licence. Unknown and conflicting links stay explicitly unresolved; a sponsor's registered town does not describe every workplace.

Each relationship needs its primary evidence URL, supporting passage or identifier, observation date, reviewer/method, validity/recheck status and immutable corrections. Refresh register status separately from business identity. Withdrawal or stale evidence must remove an unsupported current-licence badge without deleting history. Candidate matching can prioritise review; it cannot approve itself.

First vertical slice: review one current employer with an ambiguous trading/legal name, implement the relationship and correction model, and display its evidence on sponsor and job pages. Then extend to held opportunities such as Bangor where a plausible brand/group match currently fails to establish the employing sponsor. Do not resolve these by similarity just to grow counts.

Acceptance: same-name companies remain distinct; one brand can map to several employers; one legal entity can have several brands/locations; conflicting evidence holds a link; removed/stale register records stop appearing current. Verify the public page and the next genuine refresh, not just fixture tests.

**20 October first slice delivered (2.88):** the append-only business identity desk, public sponsor/job cards, freshness/expiry/withdrawal rules and business-name search are live. One Numan relationship is recorded through the owner form with CQC evidence and agent-assisted attribution. This is not comprehensive mapping or proof of a specific vacancy's legal employer. The current register name already contains Numan, so unique-alias lookup is proven in isolated tests rather than by that pilot. Next genuine register-refresh acceptance and broader ambiguous-brand reviews remain open. See `BUSINESS_IDENTITIES.md` and `cloudflare/tests/evidence/business-identities-2026-10-20.json`.

## 2. More genuine sponsorship opportunities

The latest verified 20 October 13:45 UTC baseline is **54 sponsorship-worded adverts** (20 offered, 34 conditional), 1,021 current roles and 37 employers. Monzo supplies 31 of those 54 mentions. These are dated selected-catalogue counts; licence-linked roles are a separate category. Source concentration and limited employer admission explain why maintenance alone has not produced broad coverage.

Prioritise new employers that add explicit, current, role-level sponsorship across healthcare/veterinary, engineering, hospitality, education and early-career roles. Use LinkedIn jobs and ordinary recruiting posts as discovery leads, then follow to the exact employer original. Reuse the existing five-new-leads/day ledger, deduplicate before retention, and preserve all source-request ceilings. A budget increase or paid supplier remains a separate owner decision.

Work order: resolve overdue current reviews; rank remaining held leads by concrete admission blocker; use remaining daily slots for underrepresented sectors; implement permitted complete-source adapters where reusable coverage warrants it; verify first publication and subsequent genuine scheduled refresh. Keep rights, exact legal employer, original application destination, full-description consistency and withdrawal checks mandatory. Current private PortmanDentex data remains paused; it is not ready public inventory.

Report weekly: new positive roles gained/lost, newly admitted employers, sector/early-career distribution, largest-employer share, duplicates/refusals/expired leads, review age and sample evidence accuracy. First planning milestone is **100 current source-backed offered/conditional roles with lower concentration**, followed by broader coverage based on observed source yield. This is a target, not a delivery promise or permission to relabel unknowns. Net movement and independent sampled quality must accompany the headline total.

Acceptance: added roles have exact quotations and original links; refusal/qualification-funding noise stays excluded; expired/held duplicates cannot enter the count; at least one newly admitted employer passes repeated unattended refresh. Expired originals and changed visa wording found during today's private reviews illustrate why count growth must retain these controls.

**20 October discovery continuation:** the genuine 15:45 snapshot still has 54 positive-worded roles; two new held leads add no public jobs. Nu Quantum has explicit sponsorship for an early-career FPGA role and an exact current licence match. Its documented Workable syndication route needs complete-feed feasibility/membership validation; a bounded GET exceeded 2 MiB. Animal Trust adds a veterinary lead with ambiguous visa-support wording and an evidenced trading/legal name. Prioritise a permitted complete-source path over more unchanged holds; retain role-level wording and source approval gates. See `NU_QUANTUM_SOURCE_REVIEW.md`, `ANIMAL_TRUST_SOURCE_REVIEW.md` and the dated sourcing receipt.

## 3. Opt-in application agent and “apply to all selected”

Extend the existing account, Career Profile, Application Studio and tracker. Start with a batch preparation/review queue, then add provider-specific submission adapters where the provider permits automation. Do not advertise a universal submitter before actual coverage is verified. LinkedIn sign-in or a public jobs feed is not permission for bulk submission.

The user chooses jobs or saves a bounded search selection. “All” means an explicit, visible snapshot with a job count, destinations and selection time, not every future vacancy silently added to the batch. Show current sponsorship wording, location, requirements and possible mismatches. Let users exclude roles, cap a batch, pause or revoke pending submissions. New jobs require a new selection or a separately explicit standing preference.

Prepare a truthful document/answer pack from applicant-approved facts and pinned job evidence. Before enabling submission, the applicant approves the exact batch, employers/platforms receiving their documents, document versions, declared answers and any permissible routine reusable answers. Changing an answer, destination, attachment or material advert evidence invalidates the affected approval. Do not put CVs, answers or credentials in public receipts, analytics or marketing inputs.

Use durable per-user/per-job state: selected → preparing → needs information → ready for approval → authorised → submitting → confirmed / failed / outcome uncertain / withdrawn. Bind authorisation to document/answer/job versions. Use an atomic claim, per-provider pacing, idempotency and duplicate detection across batches. A click or disappearance of the form is not a submission receipt. Uncertain outcomes must reconcile the original provider application before retry; cancellation does not pretend to withdraw an already submitted application.

Unknown screening answers, eligibility decisions, sensitive disclosures, declarations requiring personal attestation, CAPTCHA, account creation/terms and new permissions require the appropriate user handoff. Never fabricate experience, qualifications, salary expectations, right-to-work status, convictions, health details or consent. Do not use sensitive traits to decide who deserves a job. The applicant remains the source of their facts and choices.

Build sequence:

1. Inventory supported application routes and existing HireStack code; write the adapter/consent contract and fictional failure cases.
2. Ship selected-batch preparation, missing-answer questions, exact-version approval, pause/revoke and clear tracking. No external submission in this first slice.
3. Add one permitted provider route; validate fictional/test-mode forms for duplicate dispatch, changed adverts, account isolation, attachments, lost acknowledgements and safe resumption. Do not send fictional applicants to live employers.
4. Run a small explicitly applicant-authorised real pilot, retain actual provider receipts privately and verify status in the user's account. Add further providers only after their own acceptance evidence.

Measure prepared, awaiting input, authorised, attempted, provider-confirmed, uncertain, duplicate-prevented, withdrawn and user-reported interview outcomes separately. Preparation or a model's judgment is not a submitted application, interview or hiring result. Public copy must name supported routes and limitations accurately.

## 4. Learn skills evidenced in sponsorship adverts

The owner's further 20 October addition is a job-to-learning pathway: match courses/tutorials to exact advert skills and show recurring skills across current sponsorship-worded roles. First deliver source excerpts and reviewed learning links on role pages, transparent current-catalogue counts across employers, and a small actionable learning plan with practice projects. Use free-to-read primary-provider resources first, with explicit prerequisites and separate certificate/software costs. Do not infer a person's skills, promise sponsorship or substitute short courses for professional registration. See `SKILLS_AND_LEARNING.md` for matching, sample bias, freshness and resource-review acceptance.

Then add applicant-chosen saved learning goals, broader sector/regulated-role pathways and measured feedback. Learning progress, completed qualifications, application submissions and hiring outcomes stay separate. This extends the active goal without altering other projects or increasing any external-service budget.

## Priority and continuing ownership

**20 October selected-batch foundation (2.89, acceptance in release receipt):** explicit saved-role selection, deterministic private evidence notes, missing-information/current-advert checks, version-change warnings, retained pause/end history and exact-request replay are implemented. No AI generation or employer submission is connected. This is the preparation portion of step 2, not applicant dispatch approval or an application pilot. Next work is the approved fact/answer pack and pinned destination/document approval contract, followed by one permitted provider. See `APPLICATION_BATCHES.md`.

Reliability, private-work protection and current evidence failures retain priority. The first business-identity relationship/approval slice is live. Next, observe its genuine register refresh, expand supported relationships and continue balanced sponsorship discovery within existing limits. Build the application batch foundation with submission disabled until its applicant-consent and provider gates pass. Maintain a dated acceptance receipt for every slice and update `OPERATOR_CHECKPOINT.md`; do not create overlapping schedules or quietly widen budgets. These additions extend the active objective and remain open until the stated outcomes are verified.
