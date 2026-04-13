# Vienna SET/SDET Tracker

A scraped-feed dashboard for Vienna SDET/QA job opportunities with client-side salary estimation, match scoring, and an interactive map.

[![CI](https://github.com/Konoszaf1/vienna-set-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/Konoszaf1/vienna-set-tracker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://konoszaf1.github.io/vienna-set-tracker/)

## What it does

The tracker scrapes Vienna QA/SDET job listings daily from karriere.at, kununu.com, and JobSpy (LinkedIn, Indeed, Google Jobs), then runs them through two client-side analytical models:

- **Salary estimation** starts from a Vienna SDET baseline and applies additive adjustments for language requirement friction, tech stack modernity, CV alignment, employer reputation, and any advertised salary data. Adjustments only fire when real data is present -- a `dataPoints` counter tells the UI how much signal backed the estimate. When a company has curated overlay data (industry sector, culture tags), those adjustments activate too.
- **Match scoring** produces a 0-100 weighted score across tech stack overlap, language accessibility, culture fit, employer reputation, and salary alignment. Each factor carries a `hasData` flag so the UI can distinguish real scores from neutral placeholders.

Data refreshes daily via GitHub Actions. The scraper extracts tech stacks and language requirements from karriere.at detail pages using keyword matching, geocodes office addresses through Nominatim, and deduplicates across sources.

## Architecture

The app follows a hybrid data model:

- **Scraped layer** (automated daily): jobs arrive with `url`, `title`, `company`, `source`, `address`, `city`, `zip`, `lat/lng`, and optionally `techStack`, `langReq`, `kununuScore`.
- **Overlay layer** (hand-maintained `public/company-overlay.json`): supplies fields that scrapers can't reliably produce -- `industry`, `cultureTags`, `notes` (may contain advertised salary text), `authorOverride`. Optional; the app works without it.
- **Projection**: `useCompanies` groups scraped jobs by company name, merges any overlay data, and feeds the enriched entries to the salary and match models.

All shared data shapes are defined as JSDoc `@typedef` declarations in `src/domain/schema.js` -- the single source of truth for what a job, company, profile, and model output look like.

## Quick start

```bash
git clone https://github.com/Konoszaf1/vienna-set-tracker.git
cd vienna-set-tracker
npm install
npm run dev
```

Run tests with `npm test` (unit) and `npm run e2e` (Playwright end-to-end against a production build).

## Project structure

```
scripts/
  search-jobs.mjs       # karriere.at + kununu scraper (tech/lang extraction, geocoding)
  discoverJobs.py       # JobSpy pipeline for LinkedIn, Indeed, Google Jobs
  jobValidator.mjs      # source-agnostic job validation (karriere, kununu, jobspy URLs)
  jobValidator.test.mjs # validator unit tests
  geocodeCompanies.mjs  # batch Nominatim geocoding with cache
  verify-jobs.mjs       # weekly liveness checker -- prunes expired listings
e2e/
  smoke.spec.js         # Playwright smoke tests (load, search, map, settings)
src/
  domain/
    schema.js           # JSDoc @typedef definitions -- canonical type source
  hooks/
    useJobFeed.js       # fetch jobs.json, loading/error/retry state
    useFirstSeen.js     # track first-seen dates per job URL (localStorage)
    useCompanies.js     # group jobs into companies, run salary+match models
  utils/
    salaryModel.js      # additive salary estimation (null-aware, skips missing data)
    matchModel.js       # weighted match scoring (hasData flags per factor)
    filterSort.js       # search, filter, sort pipeline
    nominatim.js        # shared Nominatim client with 1 req/s rate limiting
    escape.js           # HTML escape + URL validation for map popups
  components/
    CompanyCard.jsx     # card with salary/match breakdown, limited-data indicators
    MapView.jsx         # Leaflet map with clustered markers, commute rings
    SettingsModal.jsx   # profile settings with Nominatim address lookup
    StarRating.jsx      # star rating display
    Badge.jsx           # tag badges
    Modal.jsx           # reusable modal
    FieldGroup.jsx      # form field wrapper
    ErrorBoundary.jsx   # React error boundary
  data/
    defaultProfile.json # seed profile (salary targets, German level, home)
    defaultCv.json      # seed CV (primary/secondary skills)
  App.jsx               # main app shell -- UI state, filtering, view dispatch
  constants.js          # profile storage key, culture options, defaults
public/
  jobs.json             # scraped job feed (updated daily by CI)
```

## Data pipeline

```
karriere.at ──→ search-jobs.mjs ──→ jobValidator.mjs ──→ public/jobs.json
kununu.com  ──→ search-jobs.mjs ──→ jobValidator.mjs ──↗
LinkedIn    ──→ discoverJobs.py ──→ (inline validation) ──↗
Indeed      ──→ discoverJobs.py ──→ (inline validation) ──↗
Google Jobs ──→ discoverJobs.py ──→ (inline validation) ──↗
                                                             │
                                    geocodeCompanies.mjs ────┤
                                    verify-jobs.mjs (weekly) ┘
```

`jobValidator.mjs` is the canonical validation gate -- title length, test-keyword check, blocklisted companies, known URL domains. `discoverJobs.py` mirrors these rules for its inline pre-filter (documented sync point in both files).

## Testing

Unit tests cover the salary model (parsing, adjustments, clamping, overrides, null-awareness, spot-checks), match model (factor weighting, grade thresholds, hasData flags), filter/sort logic, XSS escape helpers, and job validation across all URL sources. A component smoke test verifies card rendering with the updated model output shapes. Playwright E2E tests run against a production build covering loading, search, map view, salary filtering, and settings modal.

## Tech stack

React 18, Vite 5, Leaflet 1.9 with MarkerCluster, CSS Modules, Vitest + React Testing Library, Playwright, ESLint.

## License

MIT
