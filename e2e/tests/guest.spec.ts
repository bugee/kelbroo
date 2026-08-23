import { expect, test } from '@playwright/test';
import { GUEST_URL } from '../playwright.config';
import { blockTable, seedMenuAndTable } from '../fixtures/db';

/**
 * Ścieżka gościa od skanu kodu QR.
 *
 * Ten plik istnieje, bo aplikacja gościa nie miała żadnego pokrycia i przepuściła
 * awarię wywracającą cały ekran — źle umieszczony hook, który przy pierwszym
 * renderze liczył się inaczej niż przy drugim. Samo otwarcie strony by ją złapało,
 * więc pierwszy test robi dokładnie to.
 */
test.describe('gość przy stoliku', () => {
  test('po zeskanowaniu kodu widzi menu, a nie pusty ekran', async ({ page }) => {
    const fixture = await seedMenuAndTable();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    try {
      await page.goto(`${GUEST_URL}/t/${fixture.qrToken}`);

      // Karta się wyrenderowała — czyli komponent przeżył wczytanie wizyty.
      await expect(page.getByText(fixture.dishName)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();

      // Żaden błąd wykonania nie może przejść niezauważony: React #310 objawiał
      // się właśnie tak — wyjątek w konsoli i biała strona.
      expect(errors).toEqual([]);
    } finally {
      await fixture.cleanup();
    }
  });

  test('dostaje znak rozpoznawczy jako samą ikonę, bez podpisu', async ({ page }) => {
    const fixture = await seedMenuAndTable();

    try {
      await page.goto(`${GUEST_URL}/t/${fixture.qrToken}`);
      await expect(page.getByText(fixture.dishName)).toBeVisible();

      // Sam kształt, bez podpisu pod obrazkiem.
      const naglowek = page.locator('header');
      const znak = naglowek.locator('svg[role="img"]');
      await expect(znak).toHaveCount(1);

      // Nazwa nie jest wypisana na ekranie, ale czytnik ekranu musi ją podać.
      await expect(znak).toHaveAttribute(
        'aria-label',
        /(gwiazdka|serce|kwadrat|trójkąt|koło|domek|strzałka|księżyc|romb|błyskawica)/,
      );
      await expect(
        naglowek.getByText(
          /(gwiazdka|serce|kwadrat|trójkąt|koło|domek|strzałka|księżyc|romb|błyskawica)/,
        ),
      ).toHaveCount(0);
    } finally {
      await fixture.cleanup();
    }
  });

  test('może zawołać kelnera i widzi, że zgłoszenie poszło', async ({ page }) => {
    const fixture = await seedMenuAndTable();

    try {
      await page.goto(`${GUEST_URL}/t/${fixture.qrToken}`);
      await expect(page.getByText(fixture.dishName)).toBeVisible();

      await page.getByRole('button', { name: 'Kelner', exact: true }).click();
      // „Wysłane", nie „idzie" — nikt jeszcze zgłoszenia nie przyjął.
      await expect(page.getByRole('button', { name: /Kelner — wysłane/ })).toBeVisible();
    } finally {
      await fixture.cleanup();
    }
  });

  test('przy zablokowanym stoliku widzi tylko prośbę o otwarcie', async ({ page }) => {
    const fixture = await seedMenuAndTable();

    try {
      await blockTable(fixture.tableId);
      await page.goto(`${GUEST_URL}/t/${fixture.qrToken}`);

      await expect(page.getByRole('button', { name: 'Poproś o otwarcie stolika' })).toBeVisible();
      // Karta nie może się pokazać: sugerowałaby, że da się zamówić, a nie da.
      await expect(page.getByText(fixture.dishName)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Menu' })).toHaveCount(0);

      await page.getByRole('button', { name: 'Poproś o otwarcie stolika' }).click();
      await expect(page.getByText(/Obsługa już wie/)).toBeVisible();
    } finally {
      await fixture.cleanup();
    }
  });
});
