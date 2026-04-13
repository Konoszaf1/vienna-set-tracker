# Vienna SET/SDET Tracker

A daily-scraped job board for Vienna SDET/QA positions, served as a static single-page app with an interactive map.

[![CI](https://github.com/Konoszaf1/vienna-set-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/Konoszaf1/vienna-set-tracker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://konoszaf1.github.io/vienna-set-tracker/)

## What it does

A GitHub Actions pipeline scrapes Vienna QA/SDET listings daily from karriere.at, kununu, and JobSpy (LinkedIn, Indeed, Google Jobs), geocodes office addresses, and writes `jobs.json`. The frontend groups jobs by company, shows them as filterable cards or clustered map pins, and adds a rough salary estimate based on the job title seniority level.

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
  search-jobs.mjs       # karriere.at + kununu scraper
  discoverJobs.py       # JobSpy pipeline (LinkedIn, Indeed, Google Jobs)
  geocodeCompanies.mjs  # Nominatim geocoding for office addresses
  verify-jobs.mjs       # weekly liveness checker — prunes expired listings
  jobValidator.mjs      # URL + title validation
src/
  App.jsx               # fetch, group by company, filter/sort, view toggle
  constants.js          # profile storage key
  utils/
    salaryEstimate.js   # seniority-only salary estimate (Senior/Mid/Junior)
    filterSort.js       # search, language filter, salary range, sort
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

## Tech stack

React 18, Vite 5, Leaflet 1.9 with MarkerCluster, CSS Modules, Vitest + React Testing Library, Playwright, ESLint.

## License

MIT
