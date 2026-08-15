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
    // A bounded market-target window should reduce the result set.
    const count = await dashboard.cards.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(8);
    const names = await dashboard.cards.locator('h3').allTextContents();
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
    // Senior automation roles should rank first and the junior role last.
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

  test('publication-age filter narrows roles and persists in the URL', async ({ page }) => {
    await dashboard.filterByRecency('3');
    const recent = await dashboard.cards.count();
    expect(recent).toBeGreaterThan(0);
    expect(recent).toBeLessThan(8);
    await expect(page).toHaveURL(/age=3/);

    await dashboard.filterByRecency('all');
    await expect(dashboard.cards).toHaveCount(8);
  });
});
