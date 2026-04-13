import { test, expect } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage.js';

// Fixture: 10 jobs → 8 companies after normalizeCompanyName collapse
// (ÖBB-Konzern + ÖBB → 1, RINGANA × 2 → 1)

test.beforeEach(async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.goto();
});

test('homepage loads with exactly 8 company cards from fixture', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.waitForCards();
  await expect(dashboard.cards).toHaveCount(8);
});

test('search filters to matching company', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.waitForCards();
  await dashboard.search('Dynatrace');
  await expect(dashboard.cards).toHaveCount(1);
  await expect(dashboard.cards.first().locator('h3')).toHaveText('Dynatrace Austria GmbH');
});

test('map view toggle shows map container', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.switchToMap();
  await expect(dashboard.mapContainer).toBeVisible();
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10000 });
});

test('salary min filter reduces visible cards and clearing restores them', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await expect(dashboard.cards).toHaveCount(8);

  await dashboard.setSalaryMin(70);
  await expect(dashboard.cards).toHaveCount(2);

  await dashboard.clearSalaryMin();
  await expect(dashboard.cards).toHaveCount(8);
});

test('pressing Escape closes settings modal', async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.openSettings();
  await expect(dashboard.dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dashboard.dialog).not.toBeVisible();
});
