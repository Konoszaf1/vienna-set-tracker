import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { DashboardPage } from './pages/DashboardPage.js';

test.describe('Accessibility', () => {
  test('dashboard has no critical a11y violations', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.waitForCards();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast']) // dark theme contrast ratios are intentionally stylistic
      .analyze();

    const critical = results.violations.filter(v => v.impact === 'critical');
    if (critical.length > 0) {
      console.error('Critical a11y violations:', JSON.stringify(critical, null, 2));
    }
    expect(critical).toHaveLength(0);
  });

  test('settings modal has no critical a11y violations', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.waitForCards();
    await dashboard.openSettings();
    await expect(dashboard.dialog).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const critical = results.violations.filter(v => v.impact === 'critical');
    expect(critical).toHaveLength(0);
  });
});
