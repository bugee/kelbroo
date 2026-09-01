import { expect, test, type Page } from '@playwright/test';
import { ACCOUNTS } from '../fixtures/accounts';

/**
 * Przełącznik sygnału dźwiękowego.
 *
 * Cała wartość tej preferencji leży w tym, **gdzie jest zapisana**: na koncie,
 * nie na urządzeniu. Kucharz staje przy tym tablecie, przy którym akurat jest
 * wolne miejsce, a kelner przechodzi między nimi w trakcie zmiany — wyciszenie
 * zapamiętane w przeglądarce trzeba by odtwarzać na każdym z osobna.
 *
 * Dlatego test nie kończy się na przeładowaniu strony: sprawdza **drugą,
 * czystą przeglądarkę**. Zapis w `localStorage` przeszedłby pierwszą próbę
 * i poległ na tej.
 */
async function zaloguj(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(ACCOUNTS.owner.email);
  await page.getByLabel('Hasło', { exact: true }).fill(ACCOUNTS.owner.password);
  await page.getByRole('button', { name: 'Zaloguj' }).click();
  await expect(page).toHaveURL(/\/queue$/);
}

const dzwonek = (page: Page) => page.getByRole('button', { name: /Dźwięk/ });

test.describe('sygnał dźwiękowy', () => {
  test('wyciszenie zostaje na koncie, nie na urządzeniu', async ({ browser }) => {
    const pierwszy = await browser.newContext();
    const drugi = await browser.newContext();

    try {
      const page = await pierwszy.newPage();
      await zaloguj(page);

      // Domyślnie gra: cichy ekran kuchni to zamówienie, którego nikt nie zauważył.
      await expect(dzwonek(page)).toHaveAttribute('aria-pressed', 'true');

      await dzwonek(page).click();
      await expect(dzwonek(page)).toHaveAttribute('aria-pressed', 'false');

      await page.reload();
      await expect(dzwonek(page)).toHaveAttribute('aria-pressed', 'false');

      // **Najważniejsza asercja w tym pliku.** Druga przeglądarka nie zna pamięci
      // pierwszej — jeśli wyciszenie tu widać, siedzi na koncie.
      const inne = await drugi.newPage();
      await zaloguj(inne);
      await expect(dzwonek(inne)).toHaveAttribute('aria-pressed', 'false');

      // Stan wyjściowy dla kolejnych testów: dźwięk włączony.
      await dzwonek(inne).click();
      await expect(dzwonek(inne)).toHaveAttribute('aria-pressed', 'true');
    } finally {
      await pierwszy.close();
      await drugi.close();
    }
  });

  test('kuchnia też ma dzwonek — to jej ekran najbardziej go potrzebuje', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(ACCOUNTS.kitchen.email);
    await page.getByLabel('Hasło', { exact: true }).fill(ACCOUNTS.kitchen.password);
    await page.getByRole('button', { name: 'Zaloguj' }).click();
    await expect(page).toHaveURL(/\/kds$/);

    await expect(dzwonek(page)).toBeVisible();
  });
});
