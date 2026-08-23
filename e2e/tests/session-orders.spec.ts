import { expect, test, type Page } from '@playwright/test';
import { ACCOUNTS } from '../fixtures/accounts';
import { seedMenuAndTable } from '../fixtures/db';

async function logInAsOwner(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(ACCOUNTS.owner.email);
  await page.getByLabel('Hasło', { exact: true }).fill(ACCOUNTS.owner.password);
  await page.getByRole('button', { name: 'Zaloguj' }).click();
  await expect(page).toHaveURL(/\/queue$/);
}

/**
 * Podgląd zamówień stolika.
 *
 * Kelner dostaje przy stoliku pytanie „co u nas z zupą?" i do tej pory musiał
 * iść do kuchni albo zgadywać. Dwa widoki, bo pytania są dwa: o konkretnego
 * gościa i o konkretne danie.
 */
test.describe('podgląd zamówień stolika', () => {
  test('pokazuje pozycje ze statusem w obu widokach', async ({ page }) => {
    const fixture = await seedMenuAndTable();

    try {
      await logInAsOwner(page);

      // Zamówienie składamy tą samą drogą co kelner na zmianie.
      await page.goto('/tables');
      const karta = page.locator('article').filter({ hasText: fixture.tableLabel });
      await karta.getByRole('link', { name: 'Zamów', exact: true }).click();
      await page
        .locator('li')
        .filter({ hasText: fixture.dishName })
        .last()
        .getByRole('button', { name: 'Więcej' })
        .click();
      await page.getByRole('button', { name: 'Złóż zamówienie' }).click();
      await expect(page.getByRole('heading', { name: /Zamówienie #/ })).toBeVisible();

      await page.goto('/tables');
      await page
        .locator('article')
        .filter({ hasText: fixture.tableLabel })
        .getByRole('link', { name: 'Podgląd zamówienia' })
        .click();

      // Widok po gościach jest pierwszy: najczęstsze pytanie pada od gościa.
      await expect(page.getByRole('tab', { name: 'Po gościach' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(page.getByText(fixture.dishName)).toBeVisible();

      // Status ten sam, który gość widzi u siebie — zamówienie kelnera jest przyjęte.
      await expect(page.getByText('Przyjęte').first()).toBeVisible();

      // Drugi widok: kategoria, a w niej danie.
      await page.getByRole('tab', { name: 'Po kategoriach' }).click();
      await expect(page.getByRole('heading', { name: 'Karta testowa' })).toBeVisible();
      await expect(page.getByText(`1× ${fixture.dishName}`)).toBeVisible();
    } finally {
      await fixture.cleanup();
    }
  });

  test('stolik bez zamówień mówi to wprost', async ({ page }) => {
    const fixture = await seedMenuAndTable();

    try {
      await logInAsOwner(page);
      await page.goto('/tables');
      await page
        .locator('article')
        .filter({ hasText: fixture.tableLabel })
        .getByRole('button', { name: 'Otwórz stolik' })
        .click();

      await page
        .locator('article')
        .filter({ hasText: fixture.tableLabel })
        .getByRole('link', { name: 'Podgląd zamówienia' })
        .click();

      await expect(page.getByText(/nie ma jeszcze żadnego zamówienia/)).toBeVisible();
    } finally {
      await fixture.cleanup();
    }
  });
});
