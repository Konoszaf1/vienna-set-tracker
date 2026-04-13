# Testing Guide

## Architecture

```
src/test/
  fixtures/jobs.sample.json   # 10 jobs → 8 companies, deterministic fixture
  handlers.js                 # MSW request handlers (intercept jobs.json)
  server.js                   # MSW server setup for vitest
  setup.js                    # vitest setup: MSW lifecycle, jest-dom matchers

src/**/*.test.{js,jsx}        # unit + integration tests (vitest + jsdom)
scripts/**/*.test.mjs         # script-layer tests

e2e/
  pages/DashboardPage.js      # Page Object Model
  smoke.spec.js               # core smoke tests
  filters.spec.js             # search, salary, language, sort filters
  settings.spec.js            # modal open/close, persistence across reload
  network.spec.js             # HTTP error + retry, empty state
  links.spec.js               # target="_blank", rel="noopener noreferrer"
  a11y.spec.js                # axe-core WCAG 2.0 AA scan
  keyboard.spec.js            # Tab navigation, focus trap, keyboard interaction
```

## Running tests

```bash
# Unit + integration
npm test                          # all vitest tests (~6s)
npm run test:coverage             # with v8 coverage report
npx vitest run src/utils/         # specific directory
npx vitest run --watch            # watch mode

# E2E (requires build)
npm run e2e                       # all 5 browser projects
npx playwright test --project=desktop-chromium   # single project
npx playwright test e2e/smoke.spec.js            # single file
npx playwright test --ui                          # interactive UI mode

# Lint
npm run lint
```

## Fixture data

All tests use `src/test/fixtures/jobs.sample.json` — a hand-crafted 10-job feed that exercises:

- Company name normalization (OBB-Konzern + OBB collapse to 1)
- Duplicate merging (RINGANA x2 collapse to 1)
- XSS payload in company name (`<img src=x onerror=alert(1)>`)
- All three language requirement levels (en, de-basic, de-fluent)
- Seniority tiers (Senior, Junior, Mid-level)
- Companies with/without ratings, coordinates, tech stacks, and open roles

Unit tests mock `fetch` via MSW (`src/test/handlers.js`). E2e tests intercept via `page.route()` in the `DashboardPage` POM.

## Conventions

- **Selectors**: Use `data-testid` attributes, never CSS class selectors (classes are hashed by CSS Modules).
- **No `test.skip`**: Every test must pass or be deleted.
- **Deterministic**: No live network calls. All data comes from the fixture.
- **Fast**: Unit suite targets <10s. Current: ~6s.
- **POM for e2e**: All e2e specs use `DashboardPage` from `e2e/pages/` for common selectors and actions.

## Coverage thresholds

Enforced in `vitest.config.js` and checked in CI:

| Directory | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| `src/utils/**` | 80% | 80% | 80% | 80% |
| `src/components/**` | 80% | 60% | 70% | 80% |

`MapView.jsx` is excluded from coverage — it requires browser Leaflet. Its logic is covered by:
- `src/utils/mapHelpers.js` (100% coverage) — haversine, salaryColor, buildPopupHtml
- E2e tests that exercise the map view in real browsers

## Browser matrix

Playwright runs against 5 projects:

| Project | Device |
|---|---|
| desktop-chromium | Desktop Chrome |
| desktop-firefox | Desktop Firefox |
| desktop-webkit | Desktop Safari |
| mobile-chromium | Pixel 5 |
| mobile-webkit | iPhone 13 |

CI splits these into parallel jobs: `e2e-desktop` and `e2e-mobile`.

## Adding tests

**Unit test for a new utility**: Create `src/utils/myUtil.test.js`, import the function, write cases. It auto-discovers via the `src/**/*.test.{js,jsx}` glob.

**Unit test for a new component**: Create `src/components/MyComponent.test.jsx`. Use `render()` from `@testing-library/react`. MSW handles fetch calls automatically via `src/test/setup.js`.

**E2e test for a new flow**: Create `e2e/myflow.spec.js`. Import `DashboardPage`, call `dashboard.goto()` in `beforeEach`. The POM handles fixture routing and localStorage cleanup.

**Script test**: Create `scripts/myScript.test.mjs`. Add to the `scripts/**/*.test.mjs` glob (already configured).
