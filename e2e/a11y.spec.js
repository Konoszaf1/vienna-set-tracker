import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { DashboardPage } from './pages/DashboardPage.js';

test.describe('Accessibility', () => {
  test('dashboard has no critical a11y violations', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.waitForCards();

    // Run full scan including color-contrast; filter to critical + serious contrast violations
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const critical = results.violations.filter(v => v.impact === 'critical');
    if (critical.length > 0) {
      console.error('Critical a11y violations:', JSON.stringify(critical, null, 2));
    }
    expect(critical).toHaveLength(0);

    // Dark-theme text and controls must also meet WCAG AA contrast.
    const contrastViolations = results.violations.filter(v => v.id === 'color-contrast');
    expect(contrastViolations).toHaveLength(0);
  });

  test('settings modal has no critical a11y violations', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.waitForCards();
    await dashboard.openSettings();
    await expect(dashboard.dialog).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const critical = results.violations.filter(v => v.impact === 'critical');
    expect(critical).toHaveLength(0);
    expect(results.violations.filter(v => v.id === 'color-contrast')).toHaveLength(0);
  });
});
