import fs from 'fs';

const fixture = JSON.parse(fs.readFileSync('src/test/fixtures/jobs.sample.json', 'utf-8'));

export class DashboardPage {
  constructor(page) {
    this.page = page;

    // Selectors
    this.cards = page.locator('[data-testid="company-card"]');
    this.searchInput = page.locator('[data-testid="search-input"]');
    this.langSelect = page.locator('[data-testid="lang-select"]');
    this.sortSelect = page.locator('[data-testid="sort-select"]');
    this.salaryMin = page.locator('[data-testid="salary-min"]');
    this.salaryMax = page.locator('[data-testid="salary-max"]');
    this.gridToggle = page.locator('[data-testid="view-toggle-grid"]');
    this.mapToggle = page.locator('[data-testid="view-toggle-map"]');
    this.settingsBtn = page.locator('[data-testid="settings-btn"]');
    this.mapContainer = page.locator('[data-testid="map-container"]');
    this.analyticsToggle = page.locator('[data-testid="view-toggle-analytics"]');
    this.analyticsView = page.locator('[data-testid="analytics-view"]');
    this.errorScreen = page.locator('[data-testid="error-screen"]');
    this.retryBtn = page.locator('[data-testid="retry-btn"]');
    this.emptyState = page.locator('[data-testid="empty-state"]');
    this.dialog = page.getByRole('dialog');
  }

  /** Route jobs.json to fixture, clear localStorage, navigate. */
  async goto() {
    await this.page.route('**/jobs.json*', route => {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(fixture),
      });
    });
    // Empty location overrides keep tests deterministic — the fixture
    // already provides per-job lat/lng for any company that needs it.
    await this.page.route('**/company-locations.json*', route => {
      route.fulfill({ contentType: 'application/json', body: '{}' });
    });
    await this.page.route('**/company-locations-manual.json*', route => {
      route.fulfill({ contentType: 'application/json', body: '{}' });
    });
    await this.page.addInitScript(() => localStorage.clear());
    await this.page.goto('/vienna-set-tracker/');
  }

  /** Wait for company cards to be rendered. */
  async waitForCards() {
    await this.cards.first().waitFor({ state: 'visible' });
  }

  /** Search by text. */
  async search(text) {
    await this.searchInput.fill(text);
  }

  /** Clear search. */
  async clearSearch() {
    await this.searchInput.clear();
  }

  /** Set language filter. */
  async filterByLang(value) {
    await this.langSelect.selectOption(value);
  }

  /** Set sort order. */
  async sortBy(value) {
    await this.sortSelect.selectOption(value);
  }

  /** Set salary min filter. */
  async setSalaryMin(value) {
    await this.salaryMin.fill(String(value));
  }

  /** Set salary max filter. */
  async setSalaryMax(value) {
    await this.salaryMax.fill(String(value));
  }

  /** Clear salary min. */
  async clearSalaryMin() {
    await this.salaryMin.clear();
  }

  /** Clear salary max. */
  async clearSalaryMax() {
    await this.salaryMax.clear();
  }

  /** Switch to map view. */
  async switchToMap() {
    await this.mapToggle.click();
  }

  /** Switch to grid view. */
  async switchToGrid() {
    await this.gridToggle.click();
  }

  /** Switch to analytics view. */
  async switchToAnalytics() {
    await this.analyticsToggle.click();
  }

  /** Open settings modal. */
  async openSettings() {
    await this.settingsBtn.click();
  }

  /** Get all card heading texts. */
  async getCardNames() {
    await this.waitForCards();
    return this.cards.locator('h3').allTextContents();
  }

  /** Route jobs.json to fail with given status. */
  async routeJobsError(status = 500) {
    await this.page.route('**/jobs.json*', route => {
      route.fulfill({ status, body: '' });
    });
  }
}
