import { expect, test, type Page } from '@playwright/test';
import { ACCOUNTS } from '../fixtures/accounts';
import { seedMenuAndTable, seedSessionWithBill } from '../fixtures/db';

async function logInAsOwner(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(ACCOUNTS.owner.email);
  await page.getByLabel('Hasło', { exact: true }).fill(ACCOUNTS.owner.password);
  await page.getByRole('button', { name: 'Zaloguj' }).click();
  await expect(page).toHaveURL(/\/queue$/);
}

test.describe('zamawianie przez kelnera', () => {
  test('od wyboru stolika do zamówienia w kuchni, z edycją i historią', async ({ page }) => {
    const fixture = await seedMenuAndTable();

    try {
      await logInAsOwner(page);

      // 1. Zamawianie zaczyna się na Sali, przy konkretnym stoliku — „Zamów"
      // nie ma już własnej pozycji w menu. Stolik bez wizyty też da się obsłużyć:
      // zamówienie samo ją otwiera.
      await page.goto('/tables');
      const karta = page.locator('article').filter({ hasText: fixture.tableLabel });
      await expect(karta).toContainText('wolny');
      await karta.getByRole('link', { name: 'Zamów' }).click();

      // Stolik jest już wybrany — kelner nie wskazuje go drugi raz.
      await expect(page.getByRole('heading', { name: fixture.tableLabel })).toBeVisible();

      // 2. Karta i koszyk.
      const danie = page.locator('li').filter({ hasText: fixture.dishName }).last();
      await danie.getByRole('button', { name: 'Więcej' }).click();
      await page.getByRole('button', { name: 'Złóż zamówienie' }).click();

      // 3. Zamówienie kelnera omija kolejkę potwierdzeń.
      await expect(page.getByRole('heading', { name: /Zamówienie #/ })).toBeVisible();
      await expect(page.getByText(/confirmed/)).toBeVisible();
      await expect(page.getByText(/Złożone przez obsługę/)).toBeVisible();

      // 4. Atrybucja pozycji jest widoczna wprost.
      await expect(page.getByText(/dodane przez obsługę/)).toBeVisible();

      // 5. Edycja ilości.
      const pozycja = page.locator('li').filter({ hasText: fixture.dishName }).first();
      await pozycja.getByRole('button', { name: 'Więcej' }).click();
      await expect(pozycja.getByText('2')).toBeVisible();

      // 6. Historia jest append-only i pokazuje, kto zmieniał.
      await page.getByRole('button', { name: 'Pokaż historię zmian' }).click();
      await expect(page.getByText(/utworzone/)).toBeVisible();
      await expect(page.getByText(/zmieniono ilość/)).toBeVisible();
    } finally {
      await fixture.cleanup();
    }
  });

  test('gościa wybiera się klikając w jego znak, nie z listy rozwijanej', async ({ page }) => {
    const fixture = await seedMenuAndTable();

    try {
      const { guests } = await seedSessionWithBill({ tableId: fixture.tableId, totalCents: 4000 });

      await logInAsOwner(page);
      await page.goto('/tables');
      await page
        .locator('article')
        .filter({ hasText: fixture.tableLabel })
        .getByRole('link', { name: 'Zamów' })
        .click();

      // Lista rozwijana zniknęła — kelner szuka wzrokiem znaku, który gość nazwał.
      await expect(page.locator('select')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Cały stolik' })).toBeVisible();

      for (const guest of guests) {
        const przycisk = page.getByRole('button', { name: new RegExp(guest.name) });
        await expect(przycisk).toBeVisible();
        // Znak jest podpisany tym, co gość wypowie: „czerwona gwiazdka".
        await expect(przycisk.locator('svg')).toHaveCount(1);
      }

      const pierwszy = page.getByRole('button', { name: new RegExp(guests[0]!.name) });
      await pierwszy.click();
      await expect(pierwszy).toHaveAttribute('aria-pressed', 'true');
    } finally {
      await fixture.cleanup();
    }
  });

  test('kuchnia nie ma drogi do zamawiania', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(ACCOUNTS.kitchen.email);
    await page.getByLabel('Hasło', { exact: true }).fill(ACCOUNTS.kitchen.password);
    await page.getByRole('button', { name: 'Zaloguj' }).click();
    await expect(page).toHaveURL(/\/kds$/);

    // Zamawianie wisi teraz przy stolikach na Sali, więc bariera jest tam.
    // Sprawdzenie samego „Zamów" nic by już nie znaczyło — tej pozycji nie ma
    // w menu nikt, także kelner.
    await expect(page.getByRole('link', { name: 'Sala' })).toHaveCount(0);
  });
});
