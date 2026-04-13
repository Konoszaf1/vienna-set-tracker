import { test, expect } from '@playwright/test';
import fs from 'fs';

const fixture = JSON.parse(fs.readFileSync('src/test/fixtures/jobs.sample.json', 'utf-8'));

test.describe('Network failure and retry', () => {
  test('HTTP 500 shows error screen, retry recovers', async ({ page }) => {
    let callCount = 0;

    await page.route('**/jobs.json*', route => {
      callCount++;
      if (callCount === 1) {
        return route.fulfill({ status: 500, body: '' });
      }
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(fixture),
      });
    });
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/vienna-set-tracker/');

    // Error screen appears
    await expect(page.locator('[data-testid="error-screen"]')).toBeVisible();
    await expect(page.locator('[data-testid="retry-btn"]')).toBeVisible();

    // Click retry → success
    await page.locator('[data-testid="retry-btn"]').click();
    await expect(page.locator('[data-testid="company-card"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="company-card"]')).toHaveCount(8);
  });

  test('empty jobs array shows empty state', async ({ page }) => {
    await page.route('**/jobs.json*', route => {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ jobs: [], count: 0 }),
      });
    });
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/vienna-set-tracker/');

    await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();
  });
});
