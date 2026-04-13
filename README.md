# Vienna SET/SDET Tracker

A scraped-feed dashboard for Vienna SDET/QA job opportunities with client-side salary estimation, match scoring, and an interactive map.

[![CI](https://github.com/Konoszaf1/vienna-set-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/Konoszaf1/vienna-set-tracker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://konoszaf1.github.io/vienna-set-tracker/)

## What it does

The tracker scrapes Vienna QA/SDET job listings daily from karriere.at, kununu.com, and JobSpy (LinkedIn, Indeed, Google Jobs), then runs them through two client-side analytical models:

- **Salary estimation** starts from a Vienna SDET baseline and applies additive adjustments for industry sector, language requirement friction, employer reputation (Kununu ratings), tech stack modernity, CV alignment, and any advertised salary data. The breakdown shows every adjustment that fired and why.
- **Match scoring** produces a 0-100 weighted score across tech stack overlap, language accessibility, culture fit, employer reputation, and salary alignment with the candidate's target.

Data refreshes daily via GitHub Actions. The scraper extracts tech stacks and language requirements from karriere.at detail pages using keyword matching, geocodes office addresses through Nominatim, and deduplicates across sources.

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
  verify-jobs.mjs       # weekly liveness checker — prunes expired listings
  jobValidator.mjs      # strict job validation (title, URL, keywords)
e2e/
  smoke.spec.js         # Playwright smoke tests (load, search, map, settings)
src/
  App.jsx               # main app shell — fetch, group, filter, route
  constants.js          # profile storage key, culture options, defaults
  utils/
    salaryModel.js      # additive salary estimation model
    matchModel.js       # weighted match scoring model
    filterSort.js       # search, filter, sort pipeline
    escape.js           # HTML escape + URL validation for map popups
  components/
    CompanyCard.jsx     # card with salary/match breakdown
    MapView.jsx         # Leaflet map with clustered markers, commute rings
    SettingsModal.jsx   # profile settings with Nominatim address lookup
    StarRating.jsx      # star rating display
    Badge.jsx           # tag badges
    Modal.jsx           # reusable modal
  data/
    defaultProfile.json # seed profile (salary targets, German level, home)
    defaultCv.json      # seed CV (primary/secondary skills)
public/
  jobs.json             # scraped job feed (updated daily by CI)
```

## Testing

Unit tests cover the salary model (parsing, adjustments, clamping, overrides, spot-checks), match model (factor weighting, grade thresholds), filter/sort logic, and XSS escape helpers. A component smoke test verifies card rendering. Playwright E2E tests run against a production build covering loading, search, map view, salary filtering, and settings modal.

## Tech stack

React 18, Vite 5, Leaflet 1.9 with MarkerCluster, CSS Modules, Vitest + React Testing Library, Playwright, ESLint.

## License

MIT
