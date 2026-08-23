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

test.describe('zamawianie przez kelnera', () => {
  test('od wyboru stolika do zamówienia w kuchni, z edycją i historią', async ({ page }) => {
    const fixture = await seedMenuAndTable();

    try {
      await logInAsOwner(page);
      await page.goto('/order');

      // 1. Stolik bez otwartej wizyty — zamówienie ma ją otworzyć.
      const stolik = page.getByRole('button', { name: new RegExp(fixture.tableLabel) });
      await expect(stolik).toContainText('wolny');
      await stolik.click();

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

  test('kuchnia nie może zamawiać za gościa', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(ACCOUNTS.kitchen.email);
    await page.getByLabel('Hasło', { exact: true }).fill(ACCOUNTS.kitchen.password);
    await page.getByRole('button', { name: 'Zaloguj' }).click();
    await expect(page).toHaveURL(/\/kds$/);

    await expect(page.getByRole('link', { name: 'Zamów' })).toHaveCount(0);
  });
});
