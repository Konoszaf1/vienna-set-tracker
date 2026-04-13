import { test, expect } from '@playwright/test';
import fs from 'fs';

const fixture = JSON.parse(fs.readFileSync('src/test/fixtures/jobs.sample.json', 'utf-8'));

test.beforeEach(async ({ page }) => {
  // Intercept jobs.json with the deterministic fixture
  await page.route('**/jobs.json*', route => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(fixture),
    });
  });
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/vienna-set-tracker/');
});

// Fixture: 10 jobs → 8 companies after normalizeCompanyName collapse
// (ÖBB-Konzern + ÖBB → 1, RINGANA × 2 → 1)

test('homepage loads with exactly 8 company cards from fixture', async ({ page }) => {
  const cards = page.locator('[data-testid="company-card"]');
  await expect(cards.first()).toBeVisible();
  await expect(cards).toHaveCount(8);
});

test('search filters to matching company', async ({ page }) => {
  const cards = page.locator('[data-testid="company-card"]');
  await expect(cards.first()).toBeVisible();

  const search = page.locator('[data-testid="search-input"]');
  await search.fill('Dynatrace');
  await expect(cards).toHaveCount(1);
  await expect(cards.first().locator('h3')).toHaveText('Dynatrace Austria GmbH');
});

test('map view toggle shows map container', async ({ page }) => {
  await page.locator('[data-testid="view-toggle-map"]').click();
  await expect(page.locator('[data-testid="map-container"]')).toBeVisible();
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10000 });
});

test('salary min filter reduces visible cards and clearing restores them', async ({ page }) => {
  const cards = page.locator('[data-testid="company-card"]');
  await expect(cards).toHaveCount(8);

  // Min 70k → only Senior roles: Dynatrace (71k) and PKE (71k)
  const salaryMin = page.locator('[data-testid="salary-min"]');
  await salaryMin.fill('70');
  await expect(cards).toHaveCount(2);

  await salaryMin.clear();
  await expect(cards).toHaveCount(8);
});

test('pressing Escape closes settings modal', async ({ page }) => {
  await page.locator('[data-testid="settings-btn"]').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});
