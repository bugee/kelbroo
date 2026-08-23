import { expect, test, type Page } from '@playwright/test';
import { GUEST_URL } from '../playwright.config';
import { ACCOUNTS } from '../fixtures/accounts';
import { blockTable, seedMenuAndTable } from '../fixtures/db';

async function logInAsWaiter(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(ACCOUNTS.owner.email);
  await page.getByLabel('Hasło', { exact: true }).fill(ACCOUNTS.owner.password);
  await page.getByRole('button', { name: 'Zaloguj' }).click();
  await expect(page).toHaveURL(/\/queue$/);
}

/**
 * Otwieranie stolika przez obsługę.
 *
 * Dwie drogi prowadzą do tego samego przycisku: zgłoszenie od gościa, który
 * trafił na zamknięty stolik, i sala, gdzie kelner sadza gości, zanim ktokolwiek
 * zeskanuje kod. Do tej pory nie było ani jednej — wizytę tworzył wyłącznie skan.
 */
test.describe('obsługa otwiera stolik', () => {
  test('prośba gościa trafia do kolejki i otwiera stolik jednym kliknięciem', async ({
    browser,
  }) => {
    const fixture = await seedMenuAndTable();
    const goscContext = await browser.newContext();

    try {
      await blockTable(fixture.tableId);

      const gosc = await goscContext.newPage();
      await gosc.goto(`${GUEST_URL}/t/${fixture.qrToken}`);
      await gosc.getByRole('button', { name: 'Poproś o otwarcie stolika' }).click();
      await expect(gosc.getByText(/Obsługa już wie/)).toBeVisible();

      // Zgłoszenie ląduje w tej samej kolejce co wołanie kelnera.
      const panel = await browser.newPage();
      await logInAsWaiter(panel);
      const zgloszenie = panel
        .locator('li')
        .filter({ hasText: `${fixture.tableLabel} · Prosi o otwarcie stolika` });
      await expect(zgloszenie).toBeVisible({ timeout: 15_000 });

      await zgloszenie.getByRole('button', { name: 'Otwórz stolik' }).click();
      await expect(zgloszenie).toHaveCount(0);

      // Gość nie ma nic odświeżać — ekran puszcza sam.
      await expect(gosc.getByText(fixture.dishName)).toBeVisible({ timeout: 20_000 });
      await panel.close();
    } finally {
      await goscContext.close();
      await fixture.cleanup();
    }
  });

  test('wolny stolik da się otworzyć z sali, zanim ktokolwiek zeskanuje kod', async ({ page }) => {
    const fixture = await seedMenuAndTable();

    try {
      await logInAsWaiter(page);
      await page.goto('/tables');

      // Stolik bez wizyty jest widoczny — wcześniej sala pokazywała wyłącznie
      // otwarte rachunki, więc nie było gdzie kliknąć.
      const karta = page.locator('article').filter({ hasText: fixture.tableLabel });
      await expect(karta).toBeVisible();
      await expect(karta).toContainText('wolny');

      await karta.getByRole('button', { name: 'Otwórz stolik' }).click();

      // Wizyta istnieje: karta pokazuje numer rachunku zamiast „wolny".
      await expect(karta.getByText(/^#\d+$/)).toBeVisible({ timeout: 15_000 });
      await expect(karta.getByRole('button', { name: 'Otwórz stolik' })).toHaveCount(0);
    } finally {
      await fixture.cleanup();
    }
  });
});
