import { expect, test, type Page } from '@playwright/test';
import { GUEST_URL } from '../playwright.config';
import { seedMenuAndTable } from '../fixtures/db';

/**
 * Aplikacja gościa na wąskim telefonie.
 *
 * Gość otwiera ją na tym, co ma w kieszeni — a to bywa telefon o szerokości
 * **320 px**. Pilnujemy jednej rzeczy: nic nie może wystawać poza ekran.
 *
 * Powód jest konkretny. Dolny pasek miał przez chwilę cztery kontrolki: trzy
 * zakładki i przycisk wezwania kelnera, którego etykieta **rosła wraz ze stanem**
 * („Kelner" → „Kelner — wysłane" → „Spróbuj jeszcze raz"). Przy 360 px rząd
 * wystawał już przed stuknięciem, a po wezwaniu kelnera zakładka „Rachunek"
 * wypadała poza ekran. Test przechodzi te stany po kolei.
 */
const WASKI = { width: 320, height: 700 };

const przewijaSieWBok = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

test.describe('gość na wąskim telefonie', () => {
  test.use({ viewport: WASKI });

  test('nic nie wystaje poza ekran w żadnym stanie', async ({ page }) => {
    const fixture = await seedMenuAndTable();

    try {
      await page.goto(`${GUEST_URL}/t/${fixture.qrToken}`);
      await expect(page.getByText(fixture.dishName)).toBeVisible();
      expect(await przewijaSieWBok(page), 'menu').toBe(false);

      // Wszystkie trzy zakładki muszą być **klikalne**, nie tylko obecne —
      // wypchnięta poza ekran istnieje w drzewie i nic z tego nie wynika.
      for (const zakladka of ['Menu', 'Do zamówienia', 'Rachunek']) {
        await expect(page.getByRole('button', { name: new RegExp(zakladka) })).toBeInViewport();
      }

      // Wezwanie kelnera: stan, po którym pasek pękał.
      await page.getByRole('button', { name: /^Kelner\./ }).click();
      await expect(page.getByText(/Kelner wezwany/)).toBeVisible();
      expect(await przewijaSieWBok(page), 'po wezwaniu kelnera').toBe(false);
      await expect(page.getByRole('button', { name: /Rachunek/ })).toBeInViewport();

      // Pełny koszyk dokłada pasek „dokończ zamówienie" nad zakładkami.
      await page.getByText(fixture.dishName).first().click();
      await page.getByRole('button', { name: /^Dodaj/ }).click();
      await expect(page.getByRole('button', { name: /dokończ zamówienie/ })).toBeVisible();
      expect(await przewijaSieWBok(page), 'z pełnym koszykiem').toBe(false);

      // Ekran koszyka: dolny pasek pokazuje tam wyłącznie „Zamawiam", więc
      // wyjściem jest „Dodaj coś jeszcze" — bez niego gość utknąłby na tym
      // ekranie z jedyną opcją „zamów albo usuń wszystko".
      await page.getByRole('button', { name: /Do zamówienia/ }).click();
      expect(await przewijaSieWBok(page), 'widok koszyka').toBe(false);
      await page.getByRole('button', { name: 'Dodaj coś jeszcze' }).click();
      await expect(page.getByText(fixture.dishName).first()).toBeVisible();

      await page.getByRole('button', { name: /Rachunek/ }).click();
      expect(await przewijaSieWBok(page), 'widok rachunku').toBe(false);
    } finally {
      await fixture.cleanup();
    }
  });
});
