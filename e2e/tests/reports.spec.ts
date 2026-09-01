import { expect, test, type Page } from '@playwright/test';
import { ACCOUNTS } from '../fixtures/accounts';
import { seedMenuAndTable, seedSessionWithBill } from '../fixtures/db';

/**
 * Raport sprzedaży.
 *
 * Zamyka ostatnią obietnicę ze strony produktowej bez pokrycia w kodzie.
 * Test pilnuje dwóch rzeczy: że liczba na ekranie zgadza się z rachunkiem,
 * oraz że kuchnia tego ekranu **nie widzi** — obrót lokalu nie jest informacją
 * potrzebną do wydania talerza.
 */
async function zaloguj(page: Page, konto: { email: string; password: string }): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(konto.email);
  await page.getByLabel('Hasło', { exact: true }).fill(konto.password);
  await page.getByRole('button', { name: 'Zaloguj' }).click();
}

test.describe('raport sprzedaży', () => {
  test('pokazuje kwotę zgodną z rachunkiem', async ({ page }) => {
    const fixture = await seedMenuAndTable();

    try {
      await seedSessionWithBill({ tableId: fixture.tableId, totalCents: 12_300 });

      await zaloguj(page, ACCOUNTS.owner);
      await expect(page).toHaveURL(/\/queue$/);
      await page.goto('/raporty');

      await expect(page.getByRole('heading', { name: 'Sprzedaż' })).toBeVisible();
      // Raport ma się zgadzać z tym, co goście zapłacili — inaczej lepiej,
      // żeby go nie było.
      await expect(page.getByText('123,00 zł').first()).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Co się sprzedaje' })).toBeVisible();
    } finally {
      await fixture.cleanup();
    }
  });

  test('kuchnia nie ma do niego wejścia', async ({ page }) => {
    await zaloguj(page, ACCOUNTS.kitchen);
    await expect(page).toHaveURL(/\/kds$/);

    await expect(page.getByRole('button', { name: 'Ustawienia' })).toBeVisible();
    await page.getByRole('button', { name: 'Ustawienia' }).click();
    await expect(page.getByRole('menuitem', { name: 'Sprzedaż' })).toHaveCount(0);
  });
});
