import { expect, test, type Page } from '@playwright/test';
import { ACCOUNTS } from '../fixtures/accounts';
import { seedMenuAndTable, setSubscription } from '../fixtures/db';

async function logIn(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(ACCOUNTS.owner.email);
  await page.getByLabel('Hasło', { exact: true }).fill(ACCOUNTS.owner.password);
  await page.getByRole('button', { name: 'Zaloguj' }).click();
  await expect(page).toHaveURL(/\/queue$/);
}

/**
 * Wygaśnięcie abonamentu w panelu.
 *
 * Regulamin §7 obiecuje wstrzymanie zamawiania po wygaśnięciu. Do tej pory
 * dotyczyło to wyłącznie gościa — kelner mógł przyjmować zamówienia bez końca.
 */
test.describe('abonament', () => {
  test.afterEach(async () => {
    await setSubscription('aktywny');
  });

  test('wygasły wstrzymuje zamawianie i mówi o tym wprost', async ({ page }) => {
    const fixture = await seedMenuAndTable();

    try {
      await logIn(page);
      await setSubscription('wygasly');
      await page.reload();

      // Kelner ma wiedzieć, zanim stuknie w cokolwiek.
      await expect(page.getByText(/Abonament wygasł/)).toBeVisible({ timeout: 15_000 });

      await page.goto('/tables');
      await page
        .locator('article')
        .filter({ hasText: fixture.tableLabel })
        .getByRole('link', { name: 'Zamów', exact: true })
        .click();
      await page
        .locator('li')
        .filter({ hasText: fixture.dishName })
        .last()
        .getByRole('button', { name: 'Więcej' })
        .click();
      await page.getByRole('button', { name: 'Złóż zamówienie' }).click();

      await expect(page.getByText(/Abonament wygasł/).first()).toBeVisible();
      // Zamówienie nie powstało — nie ma ekranu potwierdzenia.
      await expect(page.getByRole('heading', { name: /Zamówienie #/ })).toHaveCount(0);
    } finally {
      await fixture.cleanup();
    }
  });

  test('kończący się okres próbny ostrzega, ale nie blokuje', async ({ page }) => {
    const fixture = await seedMenuAndTable();

    try {
      await logIn(page);
      await setSubscription('proba');
      await page.reload();

      await expect(page.getByText(/Okres próbny kończy się/)).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/Abonament wygasł/)).toHaveCount(0);
    } finally {
      await fixture.cleanup();
    }
  });
});
