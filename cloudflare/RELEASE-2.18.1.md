# Sponsor Intel 2.18.1 — preserve pay evidence

The Android-engineer advert sampled from Monzo quotes both £85,000–£110,000 and £78,000–£110,000 as yearly base pay. The old role facts showed only the first statement. Role pages now derive up to four distinct quotations from the full stored advert, explain multiple statements without choosing a correct amount, and preserve OTE/commission and pro-rata terms. Bare GBP ranges are detected without assigning an unsupported pay period. Duplicate header/footer summaries are collapsed while retaining the fuller quotation. Funding, revenue, loan repayments and specified benefit budgets are excluded. Shortened quotations are disclosed.

The server and client use the same pure parser. Existing role detail pages benefit immediately; list pay markers update through the next successful scheduled source ingestion. There is no database migration or backfill and no change to freshness timestamps, source permissions, sponsorship labels, quotas, or model execution.

## Validation

- 227 local tests passed, including contrasting pay/benefit examples, conflicting ranges, OTE/pro-rata, standalone ranges, duplicate/bounded output, and safe server-rendered text.
- Production typecheck/build and 17 public prerenders passed. Wrangler deployment packaging passed.
- The frozen 50-advert review has 42 single-label provisional agreements and eight ambiguous positive-label boundaries; all still need independent human adjudication and real-advert Cloudflare model evaluation. One identical-body pair means 49 independent description texts at most. Freeze SHA256: `4276e3753a2840ea9abb38ddcca109f70de7aa7e11043438320e9e213584bb7e`.
- Expanded private audit report and reproducible notebook retain the original report, historical source metadata and annotations. Canonical report packaging passed structural verification; browser rendering verification was unavailable in the report tool.

## External state and recovery

The owner-created Google project `sponsorintel-search` is verified. Its search-reader credential and Restricted property access remain pending the separate confirmation; project creation is not a connected Search Console integration.

Deployed Worker `fcbe54a3-7461-417e-8ed6-98ff94090908`; live health confirms 2.18.1. The Android, internship and sales pages return both ranges, the pro-rata explanation and the OTE explanation respectively. The Android page was inspected in the real browser at desktop and 390px; its mobile facts card has equal content/scroll widths of 348px and both quotations. Temporary viewport override restored. Initial Python HTTP probing received 403; subsequent curl and real-browser reads succeeded. Verification receipt: `outputs/pay-evidence-release-2.18.1.json` in the task workspace.

GitHub hosted checks previously could not start because of account billing; local tests do not resolve that blocker. No paid AI calls or new social posts were made for this release. Roll back Worker code to 2.18.0 if needed; no database change is involved.
