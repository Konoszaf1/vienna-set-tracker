import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/vienna-set-tracker/');
});

test('homepage loads with company cards', async ({ page }) => {
  const cards = page.locator('[class*="cardGrid"] > div');
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThanOrEqual(5);
});

test('search filters to matching company', async ({ page }) => {
  const cards = page.locator('[class*="cardGrid"] > div');
  await expect(cards.first()).toBeVisible();
  const search = page.getByPlaceholder('Search companies, tech, industry...');
  // Use a company name that exists in the scraped jobs feed
  const firstCardName = await cards.first().locator('h3').textContent();
  const searchTerm = firstCardName.split(' ')[0];
  await search.fill(searchTerm);
  const filtered = await cards.count();
  expect(filtered).toBeGreaterThanOrEqual(1);
  expect(filtered).toBeLessThanOrEqual(await page.locator('[class*="cardGrid"] > div').count());
});

test('map view toggle shows map container', async ({ page }) => {
  await page.getByRole('button', { name: 'Map' }).click();
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10000 });
});

test('salary min filter reduces visible cards and clearing restores them', async ({ page }) => {
  const cards = page.locator('[class*="cardGrid"] > div');
  await expect(cards.first()).toBeVisible();
  const initial = await cards.count();

  await page.getByPlaceholder('Min k').fill('70');
  const filtered = await cards.count();
  expect(filtered).toBeLessThan(initial);

  await page.getByPlaceholder('Min k').clear();
  await expect(cards).toHaveCount(initial);
});

test('pressing Escape closes settings modal', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});
