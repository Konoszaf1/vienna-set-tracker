import { test, expect } from '@playwright/test';
import fs from 'fs';
import { DashboardPage } from './pages/DashboardPage.js';

const fixture = JSON.parse(fs.readFileSync('src/test/fixtures/jobs.sample.json', 'utf-8'));

test.describe('Settings modal', () => {
  let dashboard;

  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.waitForCards();
  });

  test('settings modal opens and closes via Escape', async ({ page }) => {
    await dashboard.openSettings();
    await expect(dashboard.dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dashboard.dialog).not.toBeVisible();
  });

  test('settings modal opens and closes via Cancel button', async ({ page }) => {
    await dashboard.openSettings();
    await expect(dashboard.dialog).toBeVisible();
    await page.getByText('Cancel').click();
    await expect(dashboard.dialog).not.toBeVisible();
  });
});

test.describe('Settings persistence', () => {
  test('Save persists profile to localStorage across reload', async ({ page }) => {
    // Route fixture WITHOUT addInitScript so localStorage survives reload
    await page.route('**/jobs.json*', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(fixture) })
    );
    await page.goto('/vienna-set-tracker/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const dashboard = new DashboardPage(page);
    await dashboard.waitForCards();
    await dashboard.openSettings();
    await expect(dashboard.dialog).toBeVisible();

    const expInput = page.getByLabel(/years of experience/i);
    await expInput.clear();
    await expInput.fill('10');

    await page.getByText('Save').click();
    await expect(dashboard.dialog).not.toBeVisible();

    // Reload — route persists, localStorage NOT cleared
    await page.reload();
    await dashboard.waitForCards();
    await dashboard.openSettings();
    await expect(dashboard.dialog).toBeVisible();
    const value = await page.getByLabel(/years of experience/i).inputValue();
    expect(value).toBe('10');
  });
});
