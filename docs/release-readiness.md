# AreaWise AI release readiness

**Verified 23 November 2026 (IST).** The current branch is ready for code review and isolated evaluation. A production release and a claim of nationwide locality intelligence remain gated by the items below.

## Repository and architecture

`origin/main` at `ec09428` and its full history were preserved in a verified Git bundle. Changes are on `codex/areawise-release-readiness`. The existing React/Vite frontend, Express API, PostgreSQL/PostGIS schema and AreaScore engine remain the foundation. The historical AI Studio text asset is preserved under `docs/aistudio-reference/`, outside the public asset tree. The [baseline audit](repository-audit.md) details which Git and AI Studio material was visible. A timestamped application export or access to the owning AI Studio account is required to reconcile unsynced app edits and compare deployment revisions.

## What works with real data

The local disposable catalogue was populated from both India extracts on 22 November 2026 (IST).

| Dataset | Imported records | SHA-256 of unpacked file |
| --- | ---: | --- |
| [GeoNames India gazetteer](https://download.geonames.org/export/dump/IN.zip) | 574,542 | `df2aefbd5525187e51ba1d9b9ad952e077912725bb973aea2e5ca5d14918fde3` |
| [GeoNames India postal code index](https://download.geonames.org/export/zip/IN.zip) | 155,546 | `9e214c14441e27a6536eb8a16d75a76b5af0f97e4d2fd83ff68f546bd11a0acc` |

The gazetteer count includes 565,745 searchable place records and 8,797 facility points. The postal snapshot contains 19,238 distinct PIN codes. The importer checks the country field for India (`IN`). Records can overlap and some administrative labels are missing. Totals describe these two snapshots. Verification against official address, district, ward, village, facility, and boundary registers is pending. GeoNames documents the [gazetteer format](https://download.geonames.org/export/dump/readme.txt) and the [postal format](https://download.geonames.org/export/zip/readme.txt). GeoNames data is attributed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

`/coverage` shows records in all 28 states and 8 union territories using the [Government of India’s region names](https://www.eoiukraine.gov.in/polity.php), along with publisher-level district breakdowns, reviewed-observation counts, and source snapshots. Coverage groups the publisher’s Leh and Kargil postal labels under Ladakh according to the [2019 reorganisation](https://www.indiacode.nic.in/bitstream/123456789/15875/1/the_jammu_and_kashmir_reorganisation_act_2019.pdf) and Peddapalli under [Telangana](https://peddapalli.telangana.gov.in/about-district/). District counts still follow publisher labels, including where [Ladakh’s district boundaries changed in 2026](https://ladakh.gov.in/ladakh-administration-notifies-creation-of-sankoo-as-new-district-of-ut-ladakh/). Unmatched region labels stay unassigned in coverage. The source labels and coordinates are preserved on place records. Place profiles distinguish the source record modification date, catalogue import date, and observation date. Proximity uses PostGIS straight-line distance to source points. Postal coordinates are approximate and nearby facilities are labelled unverified. The import contains **zero published reviewed locality observations**. The application continues to withhold unsupported AreaScores, category scores, personalised scores, and historical trends. Scoring code remains at `v1.3.0-evidence-grounded`.

The [Census of India 2011 Primary Census Abstract](https://censusindia.gov.in/nada/index.php/catalog/42565) was inspected as a candidate source. Its Varanasi municipal corporation, cantonment, district, and subdistrict rows describe different areas from the same historical census. Publishing observations requires written reuse permission under the [Census website’s copyright policy](https://censusindia.gov.in/census.website/node/288) and a documented crosswalk to the correct geography. Verified administrative boundaries, [Local Government Directory](https://lgdirectory.gov.in/) identifiers, official India Post verification, current environmental/civic measurements, and approved indicator transformations are outstanding.

## Phase checks and remaining release gates

| Phase | Verified or implemented | Outstanding before the requested release |
| --- | --- | --- |
| 0. Preserve and audit | Baseline bundle, safe branch, original migrations and scoring, uploaded master prompt reviewed, AI Studio reference moved intact. | Owning AI Studio project or a code export and deployment history for the sync review. |
| 1. Startup and core | Development and production startup, built static assets, API/asset 404s, navigable deep links, PostGIS search/maps, two-to-five-place comparison, saved places and comparisons, preferences. | Hosted routing and authentication in the actual deployment, device and accessibility testing across the supported interface. |
| 2. India data | Two reproducible national catalogue imports with attribution and row counts, locality provenance, state and district coverage, publication gate for source-backed observations. | Official administrative hierarchy, verified facility inventories, boundary provenance, source update and drift monitoring, and a reviewed measurement pipeline into scoring. |
| 3. Copilot | Server-side evidence retrieval, bounded model input and quotas, candidate citation validation, labelled evidence-only responses, opt-in history and deletion, reply-language options including English, Hindi, Hinglish and 21 additional scheduled languages. | A live Gemini request with existing authorised credentials, evaluation across languages and low-evidence prompts, broader interface localisation, browser voice validation, and provider quota/timeout telemetry. |
| 4. Decision tools | Attributed HTML evidence briefs that can be printed to PDF, CSV research export, scoped workspaces, validated community submissions, per-user votes, moderation and map publication. | Relocation Planner, Area Risk Radar, Area DNA, Daily Life Simulator and AreaWatch. Rich media moderation, market data, longitudinal outcomes, and research-quality evaluation remain open. |
| 5. Monetization | Server-gated Razorpay Test Mode, order and subscription configuration, signed webhook verification, event deduplication, refund and entitlement updates, scope-gated reports and workspace export, test billing history. | Provider-issued Test Mode credentials and plan IDs, end-to-end merchant checkout and webhook delivery tests, invoice and tax requirements, B2B billing and reconciliation. Live payments require separate approval. |
| 6. Production readiness | Role gates, request limits, response headers, redacted request logs, liveness/readiness checks, fresh-database migration tests, dependency audit, and a production container definition. | Container build and staging smoke, restored-copy upgrade and restore drills, verified secret and IAM configuration, load/cost/security/privacy review, and monitored rollout approval. |
| 7. Expansion | National discovery foundation and measurable coverage. | City-by-city evidence publication, data partnerships, operating procedures, and external API and commercial readiness. |

## Verification log

| Check | Result |
| --- | --- |
| Baseline Vitest on 22 November | 23 passed and 15 failed. PostgreSQL was inaccessible to this run. |
| `npm run lint` and `npm run build` | Both passed. |
| `npm test` | 18 passed, 0 failed. |
| `npm run test:db` | 20 passed, 0 failed on PostgreSQL 19.0 and PostGIS 3.7.0. Legacy fixtures were loaded only in the disposable database. |
| `npm run test:http` | 7 groups passed, including development and production startup, static assets, explicit 404s, invalid input and admin rejection, and DB-unavailable readiness. |
| `npm run test:product` | 10 groups passed with the real catalogue, isolated PostGIS, Firebase Auth emulator and synthetic payment events. Covered all 36 state and union territory groupings, district coverage, PIN and Bengali alias search, provenance, proximity, comparison, report, Copilot fallback, authentication, persistence, community, workspaces and payment-event reconciliation. |
| Browser on the built local app | Rendered India totals and the Uttar Pradesh/Varanasi breakdown, searched `221010`, opened Sigra and verified GeoNames attribution and the missing-score indicator. |
| `bun audit --audit-level=high` | Passed at the high-severity threshold. The audit still reported three below-threshold findings. |

The first product run exposed a PostgreSQL type inference error on `PUT /me/saved`. It was fixed and the suite rerun. The initial smoke invocation was denied permission to open a local IPC socket. The loopback-enabled run passed. The product suite exercised Firebase on the emulator, payment state using locally signed messages, and Copilot with the external provider disabled. No hosted Firebase, live Gemini, Razorpay-hosted checkout, container registry, or production environment was used by these tests.

## Reproducing the product checks

1. Create a fresh loopback-only PostgreSQL/PostGIS database, such as `areawise_preview`. Apply migrations to it and import both actual snapshots using the [README](../README.md). The app and other clients must disconnect before the runner clones this template.
2. Start a loopback Firebase Auth emulator on port 19099 with demo project `demo-areawise-local`.
3. Run the product test with the local administrative connection and the template database name. The bootstrap connection must be allowed to create disposable databases.

```sh
PG_TEST_URL=postgresql://USER@127.0.0.1:55432/postgres \
AREAWISE_CATALOGUE_TEST_TEMPLATE=areawise_preview \
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:19099 \
npm run test:product
```

The runner clones the template into its own randomly named database and cleans up that clone. Keep production connection variables out of test commands. Run `npm run build` and `npm start` with approved configuration for a production-mode local smoke check.

## Provider setup and approvals

- **Firebase.** Use an existing staging project, its web app configuration at build time, server project ID at runtime, and authorised server credentials or workload identity. Verify actual Google sign-in, authorised domains, roles and disabled-user behaviour. Issue moderator and administrator claims from an authorised admin environment.
- **Gemini.** Set `GEMINI_API_KEY` server-side on an approved project. The default model is `gemini-3.8-flash` and `GEMINI_MODEL` can select another approved model. The daily request budget defaults to 100, with per-account limits. Test multilingual grounding and inspect actual token usage before approving an increase.
- **Razorpay.** Configure an existing merchant’s Test Mode key pair and webhook signing secret for `/api/v1/billing/webhook`. The plan list is a JSON array. Report entries require `code`, `title`, `kind` equal to `report`, and `amountPaise`. Subscription entries require those fields with `kind` equal to `subscription`, plus `providerPlanId`, `cycles`, and `tier` (`plus`, `premium`, or `professional`). The price and duration must match the merchant’s actual Test Mode plan. Verify authorised checkout, duplicate and delayed webhooks, cancellation, refund and entitlement changes end to end. Live keys are rejected by the application.
- **Cloud and database.** Existing AI Studio/Cloud Run access and the owning Cloud SQL project are required for reconciliation. Confirm supported PostgreSQL/PostGIS, private connectivity, least-privilege runtime identity, secure secrets, service probe configuration, backups, and a restore to a separate database. The deployable container excludes `.env` and the AI Studio notes. Require a reviewed migration plan and founder approval before applying it to an existing development or production DB or deploying to production.

## Operating-cost assumptions

The local work used no new paid resources. At the published [Gemini API rates](https://ai.google.dev/gemini-api/docs/pricing), 1,000 text requests with 4,000 input and 500 output tokens per request would cost about US$10.50 in model usage at US$1.50 and US$9 per million input and output tokens, respectively, excluding retries, taxes, caching, and other charges. Validate rates and actual usage on the chosen provider account before setting a budget.

Prepare a separate estimate for [Cloud Run](https://cloud.google.com/run/pricing), [Cloud SQL](https://cloud.google.com/sql/pricing) and any map tile service using the chosen India region, database tier and storage, availability and backups, traffic, outbound transfer, and retention. If live payments are later approved, confirm [merchant pricing](https://razorpay.com/pricing/), applicable taxes, and refund and invoice requirements for the account before activation. The hosting, data licensing, model quota and production approvals remain open.
