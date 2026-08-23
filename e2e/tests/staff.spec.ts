import { expect, test, type Page } from '@playwright/test';
import { ACCOUNTS } from '../fixtures/accounts';
import { createStaffAccount, deleteStaffAccount, uniqueEmail } from '../fixtures/db';

async function logIn(page: Page, account: { email: string; password: string }): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(account.email);
  await page.getByLabel('Hasło', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Zaloguj' }).click();
}

async function logInAsOwner(page: Page): Promise<void> {
  await logIn(page, ACCOUNTS.owner);
  await expect(page).toHaveURL(/\/queue$/);
}

async function addMember(
  page: Page,
  member: { name: string; email: string; role: string; password: string },
): Promise<void> {
  await page.goto('/staff');
  await page.getByRole('button', { name: 'Dodaj pracownika' }).click();
  await page.getByLabel('Imię i nazwisko').fill(member.name);
  await page.getByLabel('E-mail').fill(member.email);
  await page.getByLabel('Rola').selectOption(member.role);
  await page.getByLabel('Hasło tymczasowe').fill(member.password);
  await page.getByRole('button', { name: 'Załóż konto' }).click();
}

test.describe('zespół', () => {
  test('założone konto loguje się i trafia prosto na zmianę hasła', async ({ page }) => {
    const email = uniqueEmail('kelner');

    try {
      await logInAsOwner(page);
      await addMember(page, {
        name: 'Kelner Zespołowy',
        email,
        role: 'waiter',
        password: 'tymczasowe123',
      });

      await expect(page.getByText(`Konto ${email} zostało założone.`)).toBeVisible();
      // Wiersz listy, nie komunikat — adres pojawia się w obu miejscach.
      await expect(page.locator('li').filter({ hasText: email })).toBeVisible();

      // Hasło nadane przez kogoś innego jest tymczasowe z definicji.
      await page.getByRole('button', { name: 'Wyloguj' }).click();
      await logIn(page, { email, password: 'tymczasowe123' });
      await expect(page).toHaveURL(/\/password$/);
    } finally {
      await deleteStaffAccount(email);
    }
  });

  test('wyłączone konto przestaje się logować', async ({ page }) => {
    const email = uniqueEmail('wylaczony');

    try {
      await logInAsOwner(page);
      await addMember(page, {
        name: 'Do wyłączenia',
        email,
        role: 'kitchen',
        password: 'tymczasowe123',
      });

      const row = page.locator('li').filter({ hasText: email });
      await row.getByRole('button', { name: 'Wyłącz' }).click();
      await expect(page.getByText(`Konto ${email} zostało wyłączone.`)).toBeVisible();

      await page.getByRole('button', { name: 'Wyloguj' }).click();
      await logIn(page, { email, password: 'tymczasowe123' });
      await expect(page.getByText('Nieprawidłowy e-mail lub hasło.')).toBeVisible();
    } finally {
      await deleteStaffAccount(email);
    }
  });

  test('reset hasła przez właściciela nadaje nowe hasło tymczasowe', async ({ page }) => {
    const email = uniqueEmail('reset');

    try {
      await logInAsOwner(page);
      await addMember(page, {
        name: 'Do resetu',
        email,
        role: 'waiter',
        password: 'pierwsze123',
      });

      const row = page.locator('li').filter({ hasText: email });
      await row.getByRole('button', { name: 'Zresetuj hasło' }).click();
      await row.getByPlaceholder('nowe hasło tymczasowe').fill('nadane456');
      await row.getByRole('button', { name: 'Zapisz' }).click();
      await expect(page.getByText(new RegExp(`Hasło konta ${email}`))).toBeVisible();

      await page.getByRole('button', { name: 'Wyloguj' }).click();
      await logIn(page, { email, password: 'pierwsze123' });
      await expect(page.getByText('Nieprawidłowy e-mail lub hasło.')).toBeVisible();

      await logIn(page, { email, password: 'nadane456' });
      await expect(page).toHaveURL(/\/password$/);
    } finally {
      await deleteStaffAccount(email);
    }
  });

  test('własnego konta nie da się wyłączyć z listy', async ({ page }) => {
    await logInAsOwner(page);
    await page.goto('/staff');

    const own = page.locator('li').filter({ hasText: ACCOUNTS.owner.email });
    await expect(own.getByText('(to Ty)')).toBeVisible();
    // Panel nie pokazuje akcji, których API i tak by nie wykonało.
    await expect(own.getByRole('button', { name: 'Wyłącz' })).toHaveCount(0);
    await expect(own.getByRole('button', { name: 'Zresetuj hasło' })).toHaveCount(0);
  });

  test('zmiana własnego adresu e-mail przenosi logowanie na nowy', async ({ page }) => {
    const stary = uniqueEmail('stary');
    const nowy = uniqueEmail('nowy');

    try {
      await createStaffAccount({
        email: stary,
        password: 'wlasneHaslo123',
        role: 'manager',
        name: 'Do przeadresowania',
      });

      await logIn(page, { email: stary, password: 'wlasneHaslo123' });
      await expect(page).toHaveURL(/\/queue$/);

      // Lista zespołu celowo nie pozwala ruszyć samego siebie, więc własny adres
      // zmienia się tutaj — inaczej trzeba by wejść do bazy.
      await page.goto('/password');
      await page.getByLabel('Nowy adres e-mail').fill(nowy);
      await page.getByRole('button', { name: 'Zapisz dane' }).click();
      await expect(page.getByText(/Zapisano/)).toBeVisible();

      await page.getByRole('button', { name: 'Wyloguj' }).click();
      await logIn(page, { email: stary, password: 'wlasneHaslo123' });
      await expect(page.getByText('Nieprawidłowy e-mail lub hasło.')).toBeVisible();

      await logIn(page, { email: nowy, password: 'wlasneHaslo123' });
      await expect(page).toHaveURL(/\/queue$/);
    } finally {
      await deleteStaffAccount(stary);
      await deleteStaffAccount(nowy);
    }
  });

  test('kuchnia nie widzi zespołu w nawigacji', async ({ page }) => {
    await logIn(page, ACCOUNTS.kitchen);
    await expect(page).toHaveURL(/\/kds$/);
    await expect(page.getByRole('link', { name: 'Zespół' })).toHaveCount(0);
  });
});
