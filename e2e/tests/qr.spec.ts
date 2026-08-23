import { expect, test } from '@playwright/test';
import { GUEST_URL } from '../playwright.config';
import { ACCOUNTS } from '../fixtures/accounts';
import { seedMenuAndTable } from '../fixtures/db';

/**
 * Ekran „Stoliki i QR".
 *
 * Odnośnik do karty gościa jest tu po to, żeby obsługa sprawdziła menu bez
 * sięgania po telefon — musi więc prowadzić dokładnie tam, gdzie kod QR,
 * i nie może trafić na naklejkę.
 */
test.describe('stoliki i kody QR', () => {
  test('karta stolika prowadzi do menu gościa, ale nie na wydruk', async ({ page }) => {
    const fixture = await seedMenuAndTable();

    try {
      await page.goto('/login');
      await page.getByLabel('E-mail').fill(ACCOUNTS.owner.email);
      await page.getByLabel('Hasło', { exact: true }).fill(ACCOUNTS.owner.password);
      await page.getByRole('button', { name: 'Zaloguj' }).click();
      await page.goto('/qr');

      const karta = page.locator('article').filter({ hasText: fixture.tableLabel });
      const link = karta.getByRole('link', { name: 'otwórz menu gościa' });

      // Ten sam adres, który niesie kod QR.
      await expect(link).toHaveAttribute('href', `${GUEST_URL}/t/${fixture.qrToken}`);
      await expect(link).toHaveAttribute('target', '_blank');

      // Naklejka ma prowadzić skanowaniem, więc link znika przy druku.
      await page.emulateMedia({ media: 'print' });
      await expect(link).toBeHidden();
      await expect(karta.getByText('Zeskanuj i zamów')).toBeVisible();
    } finally {
      await fixture.cleanup();
    }
  });
});
