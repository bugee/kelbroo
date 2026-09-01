import { expect, test, type Page } from '@playwright/test';
import { ACCOUNTS } from '../fixtures/accounts';

/**
 * Panel na telefonie.
 *
 * Kelner nie nosi tabletu — nosi telefon w kieszeni fartucha i obsługuje go
 * jedną ręką, w ruchu. Test pilnuje jednej rzeczy ponad wszystkie inne:
 * **żaden ekran nie może wymagać przewijania w poziomie**. Pasek nawigacji,
 * który trzeba przesuwać w bok, żeby dojść do „Sali", jest gorszy niż brak
 * paska — bo wygląda na kompletny i nie jest.
 */
const TELEFON = { width: 390, height: 844 };

async function zaloguj(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(ACCOUNTS.owner.email);
  await page.getByLabel('Hasło', { exact: true }).fill(ACCOUNTS.owner.password);
  await page.getByRole('button', { name: 'Zaloguj' }).click();
  await expect(page).toHaveURL(/\/queue$/);
}

/** Czy dokument jest szerszy niż okno — czyli czy trzeba przewijać w bok. */
const przewijaSieWBok = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

test.describe('panel na telefonie', () => {
  test.use({ viewport: TELEFON });

  test('żaden ekran obsługi nie przewija się w poziomie', async ({ page }) => {
    await zaloguj(page);

    for (const adres of ['/queue', '/kds', '/tables', '/menu', '/qr', '/staff']) {
      await page.goto(adres);
      await expect(page.locator('main')).toBeVisible();
      expect(await przewijaSieWBok(page), `ekran ${adres} przewija się w bok`).toBe(false);
    }
  });

  test('rozwinięte formularze mieszczą się także na wąskim telefonie', async ({ page }) => {
    await zaloguj(page);

    /**
     * 320 px, nie 390 — i to jest sedno tego testu.
     *
     * Reset hasła rozwija pole z przyciskiem obok. Przy 390 px mieści się mimo
     * braku zawijania, więc szerszy ekran **nie wykryłby** tej wady: dokument
     * miał 387 px przy oknie 320 px, czyli sześćdziesiąt kilka pikseli przewijania
     * w bok. Najwęższe telefony w obiegu mają dokładnie 320 px.
     */
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto('/staff');

    await page.getByRole('button', { name: 'Zresetuj hasło' }).first().click();
    await expect(page.getByPlaceholder('nowe hasło tymczasowe')).toBeVisible();

    expect(await przewijaSieWBok(page)).toBe(false);
  });

  test('nawigacja stoi na dole, w zasięgu kciuka', async ({ page }) => {
    await zaloguj(page);

    const pasek = page.getByRole('navigation', { name: 'Nawigacja główna' });
    await expect(pasek).toBeVisible();

    // Naprawdę na dole ekranu, nie tylko „gdzieś w dokumencie".
    const ramka = await pasek.boundingBox();
    expect(ramka!.y + ramka!.height).toBeGreaterThan(TELEFON.height - 100);

    await pasek.getByRole('link', { name: /Sala/ }).click();
    await expect(page).toHaveURL(/\/tables$/);
  });

  test('wylogowanie jest osiągalne bez paska nawigacji', async ({ page }) => {
    await zaloguj(page);

    // Na telefonie „Wyloguj" znika z paska — musi być w Ustawieniach, inaczej
    // nie ma jak wyjść z konta na cudzym telefonie.
    await page.getByRole('button', { name: 'Ustawienia' }).click();
    await page.getByRole('menuitem', { name: 'Wyloguj' }).click();

    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('panel na tablecie', () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test('nawigacja zostaje w nagłówku, bez paska na dole', async ({ page }) => {
    await zaloguj(page);

    // Pasek dolny zabierałby wysokość ekranowi kuchni, na którym liczy się
    // każdy wiersz bonu.
    await expect(page.getByRole('navigation', { name: 'Nawigacja główna' })).toBeHidden();
    await expect(page.getByRole('link', { name: /Sala/ })).toBeVisible();
  });
});
