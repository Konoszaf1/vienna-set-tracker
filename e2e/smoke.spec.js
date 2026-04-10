import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/vienna-set-tracker/');
});

test('homepage loads with at least 10 company cards', async ({ page }) => {
  const cards = page.locator('[class*="cardGrid"] > div');
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThanOrEqual(10);
});

test('search filters to matching company', async ({ page }) => {
  const search = page.getByPlaceholder('Search companies, tech, industry...');
  await search.fill('Dynatrace');
  const cards = page.locator('[class*="cardGrid"] > div');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText('Dynatrace');
});

test('add and delete a company', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add Company' }).click();
  await page.getByPlaceholder('e.g. Bitpanda').fill('Playwright Test Co');
  await page.getByPlaceholder('e.g. FinTech').fill('QA Testing');
  await page.getByRole('button', { name: 'Save Company' }).click();

  const grid = page.locator('[class*="cardGrid"]');
  const newCard = grid.locator('> div').filter({ hasText: 'Playwright Test Co' });
  await expect(newCard).toBeVisible();

  page.on('dialog', dialog => dialog.accept());
  await newCard.getByRole('button', { name: 'Delete company' }).click();
  await expect(newCard).not.toBeVisible();
});

test('map view toggle shows map container', async ({ page }) => {
  await page.getByRole('button', { name: 'Map' }).click();
  await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 10000 });
});

test('changing german level in settings changes salary estimates', async ({ page }) => {
  const firstSalary = page.locator('[class*="modelValue"]').first();
  await expect(firstSalary).toBeVisible();
  const before = await firstSalary.textContent();

  await page.getByRole('button', { name: /Settings/ }).click();
  const germanSelect = page.locator('select').filter({ has: page.locator('option[value="fluent"]') });
  await germanSelect.selectOption('fluent');
  await page.getByRole('button', { name: 'Save' }).click();

  const after = await firstSalary.textContent();
  expect(before).not.toBe(after);
});

test('salary min filter reduces visible cards and clearing restores them', async ({ page }) => {
  const cards = page.locator('[class*="cardGrid"] > div');
  await expect(cards.first()).toBeVisible();
  const initial = await cards.count();

  await page.getByPlaceholder('Min €k').fill('70');
  const filtered = await cards.count();
  expect(filtered).toBeLessThan(initial);
  expect(filtered).toBeGreaterThan(0);

  await page.getByPlaceholder('Min €k').clear();
  await expect(cards).toHaveCount(initial);
});

test('pressing Escape closes an open modal', async ({ page }) => {
  await page.getByRole('button', { name: '+ Add Company' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});
