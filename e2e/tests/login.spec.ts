import { expect, test } from '@playwright/test';
import { ACCOUNTS } from '../fixtures/accounts';

test.describe('logowanie do panelu', () => {
  test('złe hasło pokazuje komunikat z API', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(ACCOUNTS.owner.email);
    await page.getByLabel('Hasło', { exact: true }).fill('zupelnie-zle-haslo');
    await page.getByRole('button', { name: 'Zaloguj' }).click();

    // To jest strażnik regresji, a nie ozdobnik. Panel pokazuje generyczne
    // „Operacja się nie powiodła", gdy odpowiedź NIE pochodzi z API — dokładnie
    // to działo się, gdy pusty ARG w Dockerze zostawiał w bundlu adres bazowy ''
    // i przeglądarka pytała o /auth/login zamiast /api/auth/login.
    await expect(page.getByText('Nieprawidłowy e-mail lub hasło.')).toBeVisible();
    await expect(page.getByText('Operacja się nie powiodła.')).toHaveCount(0);
    await expect(page).toHaveURL(/\/login$/);
  });

  test('nieznany adres dostaje ten sam komunikat co złe hasło', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill('nikt-taki-nie-istnieje@e2e.test');
    await page.getByLabel('Hasło', { exact: true }).fill(ACCOUNTS.owner.password);
    await page.getByRole('button', { name: 'Zaloguj' }).click();

    // Rozróżnialny komunikat zamieniłby formularz logowania w listę pracowników.
    await expect(page.getByText('Nieprawidłowy e-mail lub hasło.')).toBeVisible();
  });

  test('właściciel ląduje w kolejce potwierdzeń', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(ACCOUNTS.owner.email);
    await page.getByLabel('Hasło', { exact: true }).fill(ACCOUNTS.owner.password);
    await page.getByRole('button', { name: 'Zaloguj' }).click();

    await expect(page).toHaveURL(/\/queue$/);
    await expect(page.getByText(/Ewa Właścicielka/)).toBeVisible();
  });

  test('kuchnia ląduje od razu na KDS', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(ACCOUNTS.kitchen.email);
    await page.getByLabel('Hasło', { exact: true }).fill(ACCOUNTS.kitchen.password);
    await page.getByRole('button', { name: 'Zaloguj' }).click();

    // Kuchnia nie ma po co oglądać kolejki potwierdzeń ani rachunków.
    await expect(page).toHaveURL(/\/kds$/);
    await expect(page.getByRole('link', { name: 'Powiadomienia' })).toHaveCount(0);
  });

  test('bez sesji panel przekierowuje na logowanie', async ({ page }) => {
    await page.goto('/queue');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('wylogowanie zamyka dostęp do panelu', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(ACCOUNTS.owner.email);
    await page.getByLabel('Hasło', { exact: true }).fill(ACCOUNTS.owner.password);
    await page.getByRole('button', { name: 'Zaloguj' }).click();
    await expect(page).toHaveURL(/\/queue$/);

    await page.getByRole('button', { name: 'Wyloguj' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto('/queue');
    await expect(page).toHaveURL(/\/login$/);
  });
});
