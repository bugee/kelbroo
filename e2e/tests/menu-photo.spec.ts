import { expect, test, type Page } from '@playwright/test';
import { ACCOUNTS } from '../fixtures/accounts';
import { seedMenuAndTable, setMenuPhotos } from '../fixtures/db';

/**
 * Zdjęcia dań w panelu.
 *
 * Test pilnuje jednej rzeczy, której nie widać w testach API: **zdjęcie wybrane
 * przy zakładaniu dania ma na nim wylądować**. Nowa pozycja nie ma jeszcze
 * identyfikatora w chwili wyboru pliku, więc plik czeka w przeglądarce i wgrywa
 * się dopiero po utworzeniu dania — czyli w miejscu, w którym cicha pomyłka
 * kończy się daniem bez zdjęcia i nikt tego nie zauważa aż do stolika.
 *
 * Drugi test to droga powrotna: zdjęcie da się usunąć i wgrać inne.
 */

/** Najmniejszy dekodowalny PNG. `createImageBitmap` w panelu musi go otworzyć. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function zalogujJakoWlasciciel(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(ACCOUNTS.owner.email);
  await page.getByLabel('Hasło', { exact: true }).fill(ACCOUNTS.owner.password);
  await page.getByRole('button', { name: 'Zaloguj' }).click();
  await expect(page).toHaveURL(/\/queue$/);
}

/** Wiersz listy z daniem o tej nazwie. */
const wiersz = (page: Page, nazwa: string) => page.locator('li').filter({ hasText: nazwa }).first();

async function wybierzZdjecie(page: Page): Promise<void> {
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: 'danie.png', mimeType: 'image/png', buffer: PNG });
  // Zmniejszanie idzie przez canvas i jest asynchroniczne — bez czekania na
  // podgląd klikalibyśmy „Zapisz", zanim plik w ogóle trafi do formularza.
  await expect(page.locator('img[src^="blob:"]')).toBeVisible();
}

test.describe('zdjęcia dań', () => {
  test('zdjęcie wybrane przy zakładaniu dania trafia na zapisaną pozycję', async ({ page }) => {
    const fixture = await seedMenuAndTable();
    await setMenuPhotos(true);
    const nazwa = `Danie ze zdjęciem ${Date.now()}`;

    try {
      await zalogujJakoWlasciciel(page);
      await page.goto('/menu');

      await page.getByRole('button', { name: '+ danie' }).first().click();
      await expect(page.getByRole('heading', { name: 'Nowe danie' })).toBeVisible();

      await page.getByPlaceholder('Nazwa dania').first().fill(nazwa);
      await page.getByLabel(/^Cena/).fill('42,50');
      await wybierzZdjecie(page);

      await page.getByRole('button', { name: 'Zapisz' }).click();
      await expect(page.getByRole('heading', { name: 'Nowe danie' })).toBeHidden();

      // Sedno testu: miniatura w wierszu dania, czyli zdjęcie **na serwerze**,
      // a nie tylko podgląd, który przeglądarka trzymała w pamięci.
      const miniatura = wiersz(page, nazwa).locator('img');
      await expect(miniatura).toBeVisible();
      await expect(miniatura).toHaveAttribute('src', /\/media\/menu\/[0-9a-f-]+\.(jpg|png|webp)$/);
    } finally {
      await fixture.cleanup();
    }
  });

  test('zdjęcie da się usunąć i wgrać nowe', async ({ page }) => {
    const fixture = await seedMenuAndTable();
    await setMenuPhotos(true);
    const nazwa = `Danie do podmiany ${Date.now()}`;

    try {
      await zalogujJakoWlasciciel(page);
      await page.goto('/menu');

      await page.getByRole('button', { name: '+ danie' }).first().click();
      await page.getByPlaceholder('Nazwa dania').first().fill(nazwa);
      await page.getByLabel(/^Cena/).fill('19,00');
      await wybierzZdjecie(page);
      await page.getByRole('button', { name: 'Zapisz' }).click();
      await expect(wiersz(page, nazwa).locator('img')).toBeVisible();

      // Wejście w edycję: tu zdjęcie leci na serwer od razu, bez „Zapisz".
      await wiersz(page, nazwa).getByRole('button', { name: 'edytuj' }).click();
      await expect(page.getByRole('heading', { name: 'Edycja dania' })).toBeVisible();

      await page.getByRole('button', { name: 'Usuń zdjęcie' }).click();
      await expect(page.getByRole('button', { name: 'Dodaj zdjęcie' })).toBeVisible();

      await page
        .locator('input[type="file"]')
        .setInputFiles({ name: 'inne.png', mimeType: 'image/png', buffer: PNG });
      await expect(page.getByRole('button', { name: 'Zmień zdjęcie' })).toBeVisible();

      await page.getByRole('button', { name: 'Anuluj' }).click();
      // Anulowanie zamyka formularz, ale zdjęcie zostaje — poszło osobnym
      // żądaniem, a nie razem z resztą pól.
      await page.reload();
      await expect(wiersz(page, nazwa).locator('img')).toBeVisible();
    } finally {
      await fixture.cleanup();
    }
  });
});
