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

test.describe('podział rachunku', () => {
  test('po pozycjach: kelner przypisuje pozycję dwóm osobom w częściach', async ({ page }) => {
    const fixture = await seedMenuAndTable();

    try {
      // 90,00 zł na jednej pozycji — dzieli się na trzy części bez reszty,
      // więc kwoty w teście są jednoznaczne: 60,00 i 30,00.
      const { sessionId, guests } = await seedSessionWithBill({
        tableId: fixture.tableId,
        totalCents: 9000,
      });

      await logInAsOwner(page);
      await page.goto(`/tables/${sessionId}`);
      await page.getByRole('button', { name: 'Po pozycjach' }).click();

      // Dopóki pozycja nie ma adresata, rachunku nie wolno rozliczyć.
      await expect(page.getByText(/Do przypisania: 1/)).toBeVisible();

      const pozycja = page.locator('li').filter({ hasText: 'Rachunek testowy' });
      await pozycja.getByRole('button', { name: new RegExp(guests[0]!.name) }).click();
      await pozycja.getByRole('button', { name: new RegExp(guests[1]!.name) }).click();

      // Dwie osoby po jednej części: 45,00 na głowę.
      await expect(page.getByText(/Do przypisania/)).toHaveCount(0);
      await expect(page.getByText('45,00 zł').first()).toBeVisible();

      // Plus przy pierwszym gościu robi z tego dwie części z trzech.
      await pozycja.getByRole('button', { name: `Więcej dla ${guests[0]!.name}` }).click();

      const doZaplaty = page.locator('li').filter({ hasText: 'Gotówka' });
      await expect(doZaplaty.filter({ hasText: '60,00 zł' })).toHaveCount(1);
      await expect(doZaplaty.filter({ hasText: '30,00 zł' })).toHaveCount(1);

      // Niezmiennik na ekranie: suma części równa się wartości pozycji.
      await expect(page.getByText('zostaje 90,00 zł')).toBeVisible();
    } finally {
      await fixture.cleanup();
    }
  });

  test('dzieli po równo i zamyka wizytę dopiero po ostatniej grupie', async ({ page }) => {
    const fixture = await seedMenuAndTable();

    try {
      // 100,01 zł na dwoje — grosza nie da się podzielić równo.
      const { sessionId } = await seedSessionWithBill({
        tableId: fixture.tableId,
        totalCents: 10001,
      });

      await logInAsOwner(page);
      await page.goto(`/tables/${sessionId}`);

      await page.getByRole('button', { name: 'Po równo' }).click();

      const grupy = page.locator('li').filter({ hasText: 'Gotówka' });
      await expect(grupy).toHaveCount(2);

      // Niezmiennik: 50,01 + 50,00 = 100,01. Nierozdzielony grosz idzie do hosta.
      await expect(page.getByText('50,01 zł')).toBeVisible();
      await expect(page.getByText('50,00 zł')).toBeVisible();

      await grupy.first().getByRole('button', { name: 'Gotówka' }).click();
      await expect(page.getByText('zapłacone')).toBeVisible();

      // Po pierwszej płatności podział jest zamrożony.
      await expect(page.getByText(/Ktoś już zapłacił/)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Każdy za siebie' })).toBeDisabled();

      await page
        .locator('li')
        .filter({ hasText: 'Terminal' })
        .first()
        .getByRole('button', { name: 'Terminal' })
        .click();

      await expect(page.getByText('zostaje 0,00 zł')).toBeVisible();
    } finally {
      await fixture.cleanup();
    }
  });

  test('grupami: kelner układa skład i nie może pominąć gościa', async ({ page }) => {
    const fixture = await seedMenuAndTable();

    try {
      const { sessionId, guests } = await seedSessionWithBill({
        tableId: fixture.tableId,
        totalCents: 8000,
      });

      await logInAsOwner(page);
      await page.goto(`/tables/${sessionId}`);
      await page.getByRole('button', { name: 'Grupami' }).click();

      // Nowa, pusta grupa blokuje zapis — grupa bez gości nie ma czego zapłacić.
      await page.getByRole('button', { name: 'Dodaj grupę' }).click();
      await expect(page.getByRole('button', { name: 'Zapisz podział' })).toBeDisabled();

      // Przenosimy drugiego gościa do grupy 2.
      const grupa2 = page.locator('li').filter({ hasText: 'Grupa 2' });
      await grupa2.getByRole('button', { name: new RegExp(guests[1]!.name) }).click();

      await page.getByRole('button', { name: 'Zapisz podział' }).click();

      await expect(page.getByText('40,00 zł').first()).toBeVisible();
      await expect(page.locator('li').filter({ hasText: 'Gotówka' })).toHaveCount(2);
    } finally {
      await fixture.cleanup();
    }
  });
});
