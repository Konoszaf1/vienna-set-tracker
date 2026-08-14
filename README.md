# Vienna SET/SDET Tracker

A daily-scraped job board for Vienna SDET/QA positions, served as a static single-page app with an interactive map.

[![CI](https://github.com/Konoszaf1/vienna-set-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/Konoszaf1/vienna-set-tracker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://konoszaf1.github.io/vienna-set-tracker/)

## What it does

A GitHub Actions pipeline scrapes Vienna QA/SDET listings daily from karriere.at, kununu, devjobs.at, and JobSpy (LinkedIn, Indeed, Google Jobs), geocodes office addresses, and publishes a validated `jobs.json`. The frontend searches individual vacancies before grouping them by company, shows data freshness and source status, and provides filterable cards, clustered map pins, analytics, and clearly labelled heuristic salary estimates.

Feed updates are reconciled instead of replaced wholesale. Listings receive stable IDs and server-owned `firstSeenAt` / `lastSeenAt` timestamps, partial source failures retain the last known good rows, and missing or dead jobs require two successful checks before they close. Writes are atomic and the workflow validates lifecycle fields, uniqueness, coordinates, freshness, and a deterministic dataset hash before deployment.

## Quick start

```bash
git clone https://github.com/Konoszaf1/vienna-set-tracker.git
cd vienna-set-tracker
npm install
npm run dev
```

Run tests with `npm test` (unit) and `npm run e2e` (Playwright against a production build).

## Project structure

```
scripts/
  search-jobs.mjs       # karriere.at + kununu + devjobs.at scraper
  discoverJobs.py       # JobSpy pipeline (LinkedIn, Indeed, Google Jobs)
  jobLifecycle.mjs      # stable identity, canonicalization, merge + close rules
  atomicJson.mjs        # crash-safe JSON publication helper
  validateFeed.mjs      # final feed contract and freshness gate
  geocodeCompanies.mjs  # Nominatim geocoding for office addresses
  verify-jobs.mjs       # liveness checks, probation, and closed-job archive
  updateJobHistory.mjs  # appends daily active-job counts after verification
  jobValidator.mjs      # URL + title validation
src/
  App.jsx               # fetch, group by company, filter/sort, view toggle
  constants.js          # profile storage key
  utils/
    salaryEstimate.js   # seniority-only salary estimate (Senior/Mid/Junior)
    filterSort.js       # role-level search, language/salary filters, sort
    feedHealth.js       # fresh/partial/stale feed state
    normalizeTech.js    # canonical tech-tag vocabulary
    escape.js           # HTML escape + URL validation for map popups
  components/
    CompanyCard.jsx     # company card with salary, tech stack, open roles
    MapView.jsx         # Leaflet map with clustered markers, commute rings
    SettingsModal.jsx   # home address + profile settings
    StarRating.jsx      # star rating display
    Badge.jsx           # tag badges
    Modal.jsx           # reusable modal
  data/
    defaultProfile.json # seed profile (home address, commute prefs)
public/
  jobs.json             # scraped job feed (updated daily by CI)
  job-archive.json      # closed listings retained for lifecycle history
  job-history.json      # daily active listing snapshots for analytics
```

## Job validator

`scripts/jobValidator.mjs` runs a three-stage title filter on every scraped listing:

1. **Domain exclusion** — hard-rejects pharma, electrical, customer service, payroll, food safety, and manufacturing "quality" roles that share keywords but aren't software testing positions.
2. **Role-type whitelist** — title must positively match an SDET/QA engineer pattern (`test automation engineer`, `qa engineer`, `software test`, `testingenieur`, etc.). Generic titles like "QA Specialist" or "Test Coordinator" are dropped.
3. **Management filter** — rejects `Head of`, `Testmanager`, `Projektmanager`, `Coordinator`, etc. unless the title also contains a hands-on signal (`engineer`, `developer`, `architect`). Controlled by the `REJECT_MANAGEMENT` flag at the top of the file (default: `true`).

The same filter logic is ported to `scripts/discoverJobs.py` for JobSpy discoveries.

## Company ratings

`scripts/fetchCompanyRatings.mjs` runs after the job scraper in CI and queries kununu.com for each company's overall score. Results are cached in `public/company-ratings.json` with a 14-day TTL.

Glassdoor ratings can't be scraped from CI (Cloudflare). Instead, `public/company-ratings-manual.json` is a user-maintained overlay file — add entries like `{ "Company Name": { "glassdoor": 3.8 } }` and they'll merge into the ratings cache on the next pipeline run.

## Testing

The project has a comprehensive test suite spanning unit, integration, and end-to-end layers. See [TESTING.md](TESTING.md) for full details.

```bash
npm test              # unit + integration (vitest, ~6s)
npm run test:coverage # unit + coverage report
npm run e2e           # Playwright across 5 browser targets
```

**Unit tests** (322 tests, 27 files) cover utilities, components, script-layer lifecycle/reconciliation logic, source location and availability boundaries, feed validation, and the JSON schema contract. All tests use deterministic fixtures via MSW — no live network calls.

**E2E tests** (27 scenarios across 5 browser targets = 135 tests) run against a production build with fixture data, covering filters, settings persistence, network error recovery, external link safety, WCAG AA contrast/accessibility, and keyboard navigation.

**Coverage thresholds** are enforced in CI: >=80% for `src/utils/`, >=80% statements / >=60% branches for `src/components/` (MapView excluded — covered by e2e + extracted helpers).

## Tech stack

React 18, Vite 5, Leaflet 1.9 with MarkerCluster, CSS Modules, Vitest + React Testing Library, Playwright, ESLint.

## License

MIT
