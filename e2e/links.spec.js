import { test, expect } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage.js';

test.describe('External links', () => {
  test('all "View listing" links have target="_blank" and rel="noopener noreferrer"', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.waitForCards();

    const links = page.locator('a:has-text("View listing")');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const link = links.nth(i);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener/);
      await expect(link).toHaveAttribute('rel', /noreferrer/);
      const href = await link.getAttribute('href');
      expect(href).toMatch(/^https:\/\//);
    }
  });

  test('role links also have target="_blank"', async ({ page }) => {
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.waitForCards();

    // Role links are inside company cards with role titles
    const roleLinks = page.locator('[data-testid="company-card"] a[target="_blank"]');
    const count = await roleLinks.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const link = roleLinks.nth(i);
      await expect(link).toHaveAttribute('rel', /noopener/);
    }
  });
});
