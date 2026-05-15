import { test, expect } from '@playwright/test';
import { DashboardPage } from './pages/DashboardPage.js';

test.describe('Filter interactions', () => {
  let dashboard;

  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.waitForCards();
  });

  test('search + clear round-trip restores all cards', async () => {
    await expect(dashboard.cards).toHaveCount(8);
    await dashboard.search('Dynatrace');
    await expect(dashboard.cards).toHaveCount(1);
    await dashboard.clearSearch();
    await expect(dashboard.cards).toHaveCount(8);
  });

  test('salary min + max combined narrows results', async () => {
    await dashboard.setSalaryMin(60);
    await dashboard.setSalaryMax(65);
    // Mid-level (63k) companies survive; Senior (71k) and Junior (48k) excluded
    const count = await dashboard.cards.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(8);
    // Verify a known mid-salary company is visible and a senior-salary one is not
    const names = await dashboard.cards.locator('h3').allTextContents();
    expect(names.some(n => n.includes('Wiener Stadtwerke'))).toBe(true);
    expect(names.some(n => n.includes('Dynatrace'))).toBe(false);

    await dashboard.clearSalaryMin();
    await dashboard.clearSalaryMax();
    await expect(dashboard.cards).toHaveCount(8);
  });

  test('language filter narrows results', async () => {
    await dashboard.filterByLang('de-fluent');
    const fluent = await dashboard.cards.count();
    expect(fluent).toBeGreaterThan(0);
    expect(fluent).toBeLessThan(8);
    // PKE and Wiener Stadtwerke are de-fluent; Dynatrace (en-only) should be hidden
    const names = await dashboard.cards.locator('h3').allTextContents();
    expect(names.some(n => n.includes('PKE'))).toBe(true);
    expect(names.some(n => n.includes('Dynatrace'))).toBe(false);

    await dashboard.filterByLang('all');
    await expect(dashboard.cards).toHaveCount(8);
  });

  test('language "accessible" filter excludes fluent-German-only', async () => {
    await dashboard.filterByLang('accessible');
    const accessible = await dashboard.cards.count();
    expect(accessible).toBeGreaterThan(0);
    expect(accessible).toBeLessThan(8);
  });

  test('sort by salary reorders cards', async () => {
    await dashboard.sortBy('salary');
    const names = await dashboard.getCardNames();
    expect(names.length).toBe(8);
    // First cards should be the highest salary (Senior → 71k): Dynatrace and PKE
    expect(names[0]).toMatch(/Dynatrace|PKE/);
    // Last card should be lowest salary (Junior → 48k): CoolPeople
    expect(names[names.length - 1]).toMatch(/CoolPeople/);
  });

  test('sort by name produces alphabetical order', async () => {
    await dashboard.sortBy('name');
    const names = await dashboard.getCardNames();
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  test('combined search + salary filter', async () => {
    await dashboard.search('a');
    const afterSearch = await dashboard.cards.count();
    await dashboard.setSalaryMin(70);
    const afterBoth = await dashboard.cards.count();
    expect(afterBoth).toBeLessThanOrEqual(afterSearch);
  });
});
