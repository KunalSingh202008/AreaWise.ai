# AreaWise AI

AreaWise AI is an evidence-based locality research application for India. It uses React and Vite for the client, Express for the API, and PostgreSQL with PostGIS for geography and persistence. India-wide place and PIN search, coverage by state, union territory, and publisher district, proximity maps, comparisons, and printable evidence briefs run from imported GeoNames data. Account features use Firebase Authentication. The Copilot can use Gemini when configured, with a source-only response when Gemini is unavailable.

The current catalogue contains geographic points and postal entries. Check **Data coverage** in the app to see where reviewed observations are available. The approved AreaScore methodology is `v1.3.0-evidence-grounded`. Eligibility includes at least 50% indicator coverage and 60% active category weight. Confidence is calculated separately from source quality and freshness.

## Run locally

Use Node.js 26, Bun 1.4.5, and a new, dedicated PostgreSQL database with PostGIS. The initial migration expects the database administrator to have enabled `postgis`. Use a localhost binding for local use. Set `DATABASE_URL` in a local `.env` from `.env.example` before running the migration and the catalogue imports.

```sh
bun install --frozen-lockfile
cp .env.example .env
npm run db:migrate -- --apply
npm run data:geography -- gazetteer /path/to/gazetteer/IN.txt --apply
npm run data:geography -- postal /path/to/postal/IN.txt --apply
npm run dev
```

Use the [GeoNames India gazetteer](https://download.geonames.org/export/dump/IN.zip) and the [GeoNames India postal code index](https://download.geonames.org/export/zip/IN.zip). Save them separately because both archives contain `IN.txt`. The importer records the publisher, source URL, licence, time of import, row count, and unpacked file SHA-256. Reimporting the same snapshot is idempotent. Use a fresh database before evaluating the migration or importing both feeds. See the [licence and attribution](https://creativecommons.org/licenses/by/4.0/) and the [release report](docs/release-readiness.md) before publishing data.

For the production runtime locally, run `npm run build` followed by `npm start`. `/api/v1/health` checks the running process. `/api/v1/ready` also requires PostGIS, the application schema, and both active geography snapshots. A multi-stage `Dockerfile` builds and serves the same app on port 8080 by default. Apply approved database migrations as a separate operation before deploying.

## Review and publish locality evidence

Sign in to `/admin` with the Firebase administrator claim. Under **Review locality evidence**, select the catalogue record by its name, ID, and coordinates. Enter the measurement as the source reports it, along with its date, publisher, public evidence and licensing links, geographic scope, and limitations. Confirm the geographic match and commercial reuse terms before publishing. The observation then appears on the place profile, in printable reports, and in Copilot’s available evidence. Coverage counts update when an observation is published or withdrawn.

To correct a publication, withdraw it with a reason and submit the revised observation. AreaWise retains the publication and withdrawal history in the admin audit log. To use an observation in AreaScore, it must separately qualify under the published scoring methodology.

## Verify

```sh
npm run lint
npm test
npm run build
npm run test:http
PG_TEST_URL=postgresql://USER@127.0.0.1:55432/postgres npm run test:db
```

`test:db` creates its own disposable database on local PostgreSQL. `test:product` requires a loopback Firebase Auth emulator, a local PostgreSQL administrative connection, and a disposable template database populated with the real India catalogue. It clones that template and runs in the clone. See the [verification setup, results, and launch gates](docs/release-readiness.md). Legacy test fixtures are used only by the isolated database test runner.

The [repository audit](docs/repository-audit.md) records the baseline, the AI Studio sync gap, and the scope of the changes. Runtime and build-time configuration is documented in [.env.example](.env.example).
