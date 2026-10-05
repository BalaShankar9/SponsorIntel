# Reused code and open-source components

## HireStack AI

Source: https://github.com/BalaShankar9/hirestack-ai/tree/a1209058030e1d83b91bc19b0349abd540924e84

Sponsor Intel adapts the URL normalisation, business-day follow-up timing, follow-up drafting, evidence review and STAR + Reflection interview preparation from these source files:

- `backend/app/services/url_canonicalizer.py`
- `backend/app/services/cadence_engine.py`
- `backend/app/services/followup_drafter.py`
- `ai_engine/chains/gap_analyzer.py`
- `ai_engine/chains/interview_simulator.py`
- `ai_engine/chains/document_generator.py` (source-grounded tailored CV instructions)

The adaptations are in `worker/jobs.js`, `worker/career.js`, `worker/career-evidence.js` and `src/career-data.tsx`. They use the new Cloudflare workspace; no old credentials, accounts, CVs, databases or service dependencies are copied.

MIT License

Copyright (c) 2025 HireStack AI

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Runtime components

Versions are pinned in package-lock.json. Distributable notices are collected in `public/open-source-notices.txt` by `scripts/license-notices.mjs`.

- Better Auth — MIT, private sessions and password authentication.
- PDF.js — Apache-2.0, browser-local PDF text extraction.
- Mammoth — BSD-2-Clause, browser-local DOCX text extraction.
- docx — MIT, Word exports.
- jsPDF — MIT, text-based PDF exports.
- React, Lucide and their dependencies — see the collected notices.
- Noto Sans Regular — SIL Open Font License 1.1; unmodified font from https://github.com/notofonts/noto-fonts/blob/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf. License bundled beside the font. PDF export checks glyph coverage and directs unsupported scripts to Word/text rather than silently dropping characters.

JSON Resume is used as an interchange format, not copied implementation code: https://github.com/jsonresume/jsonresume.org/tree/master/packages/schema. Master CV text is preserved without inventing structured career dates.

## Data is separate from software licensing

The GOV.UK worker sponsor register remains the source of licence records. Vacancy data comes from explicitly configured public employer boards, links to the original employer advert and retains its check date. An open-source connector licence does not grant ownership of vacancy text or override provider terms. No unlicensed job-board scraping, employer logos or third-party personal profiles are bundled.

## Immigration Advice Authority directory

`worker/advisers-data.json` contains public sector information licensed under the Open Government Licence v3.0: https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/ . Source: Immigration Advice Authority, https://www.gov.uk/government/publications/register-of-currently-registered-immigration-advice-organisations . Snapshot 9 July 2026, published 25 September 2026. 2,274 non-empty unique organisation records; registration levels are not customer ratings. The source spreadsheet SHA-256 is recorded in the dataset. No licensed review-provider scores are copied.

## Cloudflare-hosted model attribution

CV and cover-letter evidence review: Built with Llama. Llama 3.3 is licensed under the Llama 3.3 Community License, Copyright © Meta Platforms, Inc. All Rights Reserved. Hosted inference is provided by Cloudflare; model weights are not redistributed in this repository. [Model documentation](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/) · [Llama 3.3 licence](https://github.com/meta-llama/llama-models/blob/main/models/llama3_3/LICENSE).
