# Vienna SET/SDET Tracker

A salary-modeling job-application tracker for Vienna SDET roles — built as a testbed for my own job search.

[![CI](https://github.com/Konoszaf1/vienna-set-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/Konoszaf1/vienna-set-tracker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://konoszaf1.github.io/vienna-set-tracker/)

<!-- TODO: add screenshot at docs/screenshot.png -->

## The problem

I was applying for Software Engineer in Test roles in Vienna and needed a way to compare companies across dimensions that matter for the decision: salary expectations, tech-stack fit, German language requirements, employer reputation, and commute distance. Existing job trackers treat all of this as free-text notes. I wanted something that actually models it.

This tracker takes structured company data — ratings from Kununu and Glassdoor, tech stacks, language requirements, culture tags — and runs it through a configurable salary estimation model and a weighted match-scoring model. Instead of guessing what a role might pay, I can see a computed estimate with a breakdown of how it got there, and compare it against my own salary targets.

The app ships with 40 Vienna companies pre-loaded. A stranger can fork it, edit the profile and CV seed data to match their own background, and get personalized estimates immediately.

## The salary model

Salary estimates are computed by a pure function that takes a company record, a candidate profile, and a CV, then returns a number with a human-readable breakdown. The model starts from a Vienna SDET baseline and applies additive adjustments for industry sector, language friction (a non-German speaker faces real negotiating headwinds on German-required roles), employer reputation, brand/company size, tech stack modernity, CV alignment, and any advertised salary data parsed from the company notes. When a company advertises a range, that signal dominates and the other factors become secondary corrections. The full logic lives in [`src/utils/salaryModel.js`](src/utils/salaryModel.js) and is tested extensively.

## Running locally

```bash
git clone https://github.com/Konoszaf1/vienna-set-tracker.git
cd vienna-set-tracker
npm install
npm run dev
```

Run the test suite with `npm test` for unit tests and `npm run e2e` for Playwright end-to-end tests.

## Architecture notes

The salary and match models are pure functions with no side effects, no React dependencies, and no DOM access. They take data in and return data out, which makes them trivial to unit-test and reason about. The profile (preferences, salary targets, location) is separated from the CV (skills, experience) so that the models have clean signatures and the two concerns don't blur together.

All state lives in localStorage with no backend. The app loads seed data from JSON files on first visit and merges it with any saved state on subsequent visits. This means you can fork the repo, swap out the seed files, and have a personalized tracker without touching any component code.

The Leaflet map uses a custom dark theme with CARTO tiles. Company markers are color-coded by salary estimate and show commute distance rings from the user's home location. Popups render rich company details with the same data the card view uses.

## Testing

The test suite covers the salary estimation model (parsing, adjustments, clamping, author overrides, and spot-check calibration against real companies), the match scoring model (factor weighting, grade thresholds, edge cases), the filter and sort logic (extracted as a pure function for testability), and the HTML escape and URL validation helpers that prevent XSS in the map view. A component smoke test verifies the card rendering pipeline, and Playwright end-to-end tests cover the critical user flows: loading, searching, adding and deleting companies, map view, settings propagation, and modal keyboard interaction.

This is a test-engineering project; the testing is the point.

## Tech stack

React 18, Vite 5, Leaflet 1.9, CSS Modules with a custom dark theme, Vitest with React Testing Library for unit and component tests, Playwright for end-to-end tests, ESLint for static analysis.

## What's next

- TypeScript migration for the models and components
- German language support (i18n)
- Date tracking for application stages (applied on, interviewed on, etc.)
- Distance-weighted match factor so commute time feeds into the score

## License

MIT
