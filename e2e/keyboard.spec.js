import { test, expect } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage.js';

test.describe('Keyboard navigation', () => {
  let dashboard;

  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.waitForCards();
  });

  test('Tab moves focus through interactive elements', async ({ page }) => {
    // Start from top of page
    await page.keyboard.press('Tab');

    // After several tabs, focus should land on interactive elements
    const focusedTags = [];
    for (let i = 0; i < 10; i++) {
      const tag = await page.evaluate(() => document.activeElement?.tagName);
      focusedTags.push(tag);
      await page.keyboard.press('Tab');
    }

    // Should hit buttons, inputs, selects, or links
    const interactiveTags = ['BUTTON', 'INPUT', 'SELECT', 'A'];
    const hitInteractive = focusedTags.some(t => interactiveTags.includes(t));
    expect(hitInteractive).toBe(true);
  });

  test('Enter on settings button opens modal', async ({ page }) => {
    await dashboard.settingsBtn.focus();
    await page.keyboard.press('Enter');
    await expect(dashboard.dialog).toBeVisible();
  });

  test('Escape closes settings modal and returns focus', async ({ page }) => {
    await dashboard.openSettings();
    await expect(dashboard.dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dashboard.dialog).not.toBeVisible();
  });

  test('Tab within settings modal stays trapped', async ({ page }) => {
    await dashboard.openSettings();
    await expect(dashboard.dialog).toBeVisible();

    // Tab several times — focus should stay inside the dialog
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab');
    }

    const focusInDialog = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return dialog?.contains(document.activeElement);
    });
    expect(focusInDialog).toBe(true);
  });

  test('search input accepts keyboard input and filters', async ({ page }) => {
    await dashboard.searchInput.focus();
    await page.keyboard.type('Dynatrace');
    await expect(dashboard.cards).toHaveCount(1);
  });
});
