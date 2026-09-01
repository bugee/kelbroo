import { expect, test, type Page } from '@playwright/test';
import { createStaffAccount, deleteStaffAccount, uniqueEmail, type Account } from '../fixtures/db';

/**
 * Każdy test zakłada własne konto: zmiana hasła jest operacją niszczącą,
 * a pliki i testy chodzą równolegle.
 */
async function throwawayAccount(
  options: { password: string; mustChangePassword?: boolean } = { password: 'startoweHaslo123' },
): Promise<Account> {
  return createStaffAccount({
    email: uniqueEmail('haslo'),
    password: options.password,
    role: 'waiter',
    name: 'Kelner Testowy',
    mustChangePassword: options.mustChangePassword,
  });
}

/**
 * Samo wypełnienie formularza i kliknięcie — **bez czekania na wynik**.
 *
 * Wołający musi doczekać spodziewanego ekranu (`toHaveURL`), zanim gdziekolwiek
 * przejdzie. Token trafia do pamięci przeglądarki dopiero z odpowiedzią API,
 * a nawigacja wykonana wcześniej zastaje panel bez sesji i wraca na `/login` —
 * test pada wtedy z komunikatem, który wygląda na cokolwiek innego niż wyścig.
 *
 * Czekanie nie jest tu wbudowane celowo: część testów loguje się **spodziewając
 * się niepowodzenia** albo przekierowania na zmianę hasła, więc twarde
 * oczekiwanie na `/queue` zepsułoby im sens.
 */
async function logIn(page: Page, account: Pick<Account, 'email' | 'password'>): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(account.email);
  await page.getByLabel('Hasło', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Zaloguj' }).click();
}

/**
 * Logowanie zakończone wejściem do panelu. Czekanie na przekierowanie nie jest
 * kosmetyką: token trafia do `localStorage` dopiero po odpowiedzi z API, a
 * nawigacja wykonana wcześniej zastaje `StaffShell` bez sesji i wraca na /login.
 */
async function logInToPanel(
  page: Page,
  account: Pick<Account, 'email' | 'password'>,
): Promise<void> {
  await logIn(page, account);
  await expect(page).toHaveURL(/\/queue$/);
}

test.describe('zmiana hasła', () => {
  test('nowe hasło działa, a stare przestaje', async ({ page }) => {
    const account = await throwawayAccount();
    const nowe = 'zmienioneHaslo456';

    try {
      await logInToPanel(page, account);
      await page.goto('/password');
      await page.getByLabel('Aktualne hasło').fill(account.password);
      await page.getByLabel('Nowe hasło', { exact: true }).fill(nowe);
      await page.getByLabel('Powtórz nowe hasło').fill(nowe);
      await page.getByRole('button', { name: 'Zmień hasło' }).click();

      await expect(page.getByText('Hasło zostało zmienione.')).toBeVisible();

      await page.getByRole('button', { name: 'Wyloguj' }).click();
      await expect(page).toHaveURL(/\/login$/);

      await logIn(page, { email: account.email, password: account.password });
      await expect(page.getByText('Nieprawidłowy e-mail lub hasło.')).toBeVisible();

      await logInToPanel(page, { email: account.email, password: nowe });
    } finally {
      await deleteStaffAccount(account.email);
    }
  });

  test('błędne aktualne hasło zostaje odrzucone przez API', async ({ page }) => {
    const account = await throwawayAccount();

    try {
      await logInToPanel(page, account);
      await page.goto('/password');

      await page.getByLabel('Aktualne hasło').fill('to-nie-jest-moje-haslo');
      await page.getByLabel('Nowe hasło', { exact: true }).fill('inneHaslo789');
      await page.getByLabel('Powtórz nowe hasło').fill('inneHaslo789');
      await page.getByRole('button', { name: 'Zmień hasło' }).click();

      // Ważne, że komunikat jest konkretny: ważna sesja nie wystarcza,
      // bo token leży w pamięci wspólnego tabletu.
      await expect(page.getByText('Nieprawidłowe aktualne hasło.')).toBeVisible();

      // Hasło ma zostać nietknięte.
      await page.getByRole('button', { name: 'Wyloguj' }).click();
      await logInToPanel(page, account);
    } finally {
      await deleteStaffAccount(account.email);
    }
  });

  test('niezgodne powtórzenie zatrzymuje się w przeglądarce', async ({ page }) => {
    const account = await throwawayAccount();

    try {
      await logInToPanel(page, account);
      await page.goto('/password');

      await page.getByLabel('Aktualne hasło').fill(account.password);
      await page.getByLabel('Nowe hasło', { exact: true }).fill('pierwszeHaslo123');
      await page.getByLabel('Powtórz nowe hasło').fill('drugieHaslo123');
      await page.getByRole('button', { name: 'Zmień hasło' }).click();

      await expect(page.getByText('Nowe hasło i powtórzenie różnią się.')).toBeVisible();
    } finally {
      await deleteStaffAccount(account.email);
    }
  });

  test('za krótkie hasło zostaje odrzucone przed wysłaniem', async ({ page }) => {
    const account = await throwawayAccount();

    try {
      await logInToPanel(page, account);
      await page.goto('/password');

      await page.getByLabel('Aktualne hasło').fill(account.password);
      await page.getByLabel('Nowe hasło', { exact: true }).fill('krotkie');
      await page.getByLabel('Powtórz nowe hasło').fill('krotkie');
      await page.getByRole('button', { name: 'Zmień hasło' }).click();

      await expect(page.getByText('Nowe hasło musi mieć co najmniej 8 znaków.')).toBeVisible();
    } finally {
      await deleteStaffAccount(account.email);
    }
  });

  test('hasło tymczasowe prowadzi prosto do zmiany', async ({ page }) => {
    const account = await throwawayAccount({
      password: 'tymczasowe123',
      mustChangePassword: true,
    });

    try {
      await logIn(page, account);

      // Konto założone ręcznie w bazie startuje z wymuszoną zmianą hasła.
      await expect(page).toHaveURL(/\/password$/);
      await expect(page.getByText('hasło tymczasowe', { exact: false })).toBeVisible();

      await page.getByLabel('Aktualne hasło').fill(account.password);
      await page.getByLabel('Nowe hasło', { exact: true }).fill('juzWlasneHaslo123');
      await page.getByLabel('Powtórz nowe hasło').fill('juzWlasneHaslo123');
      await page.getByRole('button', { name: 'Zmień hasło' }).click();

      // Po zmianie wpada tam, gdzie miał trafić od początku.
      await expect(page).toHaveURL(/\/queue$/);
    } finally {
      await deleteStaffAccount(account.email);
    }
  });
});
