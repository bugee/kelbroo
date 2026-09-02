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

      // Czekanie na przekierowanie **nie jest kosmetyką**: token trafia do pamięci
      // przeglądarki dopiero z odpowiedzią API, a nawigacja wykonana wcześniej
      // zastaje panel bez sesji i wraca na `/login`. Ten sam wyścig opisuje
      // `password.spec.ts`; tutaj go brakowało i test przechodził wyłącznie
      // dzięki temu, że logowanie zdążyło się skończyć.
      await expect(page).toHaveURL(/\/queue$/);
      await page.goto('/qr');

      const karta = page.locator('article').filter({ hasText: fixture.tableLabel });
      const link = karta.getByRole('link', { name: 'otwórz menu gościa' });

      // Ten sam adres, który niesie kod QR.
      await expect(link).toHaveAttribute('href', `${GUEST_URL}/t/${fixture.qrToken}`);
      await expect(link).toHaveAttribute('target', '_blank');

      // Karta z ekranu **w ogóle nie idzie na papier** — wydruk składa osobny
      // arkusz do wycięcia. Naklejka ma prowadzić skanowaniem, więc odnośnik,
      // przyciski i cała karta zarządzania przy druku znikają.
      await page.emulateMedia({ media: 'print' });
      await expect(link).toBeHidden();
      await expect(karta).toBeHidden();
    } finally {
      await fixture.cleanup();
    }
  });

  test('arkusz do wycięcia drukuje się w wybranym formacie', async ({ page }) => {
    const fixture = await seedMenuAndTable();

    try {
      await page.goto('/login');
      await page.getByLabel('E-mail').fill(ACCOUNTS.owner.email);
      await page.getByLabel('Hasło', { exact: true }).fill(ACCOUNTS.owner.password);
      await page.getByRole('button', { name: 'Zaloguj' }).click();
      await expect(page).toHaveURL(/\/queue$/);
      await page.goto('/qr');

      // Okno drukowania zatrzymałoby test — sprawdzamy sam układ, który
      // przycisk ustawia przed jego otwarciem.
      await page.addInitScript(() => {
        window.print = () => undefined;
      });
      await page.reload();

      const arkusz = page.locator('.arkusz');
      const kafel = arkusz.locator('.kafel').filter({ hasText: fixture.tableLabel });

      await page.getByRole('button', { name: /Drukuj A5/ }).click();
      await expect(arkusz).toHaveClass(/arkusz-a5/);

      await page.getByRole('button', { name: /Drukuj A6/ }).click();
      await expect(arkusz).toHaveClass(/arkusz-a6/);

      // Arkusz istnieje wyłącznie na papierze — na ekranie nie ma go widać.
      await expect(arkusz).toBeHidden();

      await page.emulateMedia({ media: 'print' });
      // Strona A4 przy druku ma 1123 px — dokładnie tyle, ile rozwija się `dvh`.
      await page.setViewportSize({ width: 794, height: 1123 });

      /**
       * Nic nie może sięgać niżej niż ostatni kafel.
       *
       * Element rozciągnięty na wysokość okna (`min-h-dvh` z ramy panelu)
       * wychodził przy druku o ułamek milimetra poza stronę i drukarka dokładała
       * za to **pustą kartkę na końcu** — przy każdym arkuszu, w obu formatach.
       * Liczba stron w PDF-ie tego nie pokazuje, bo generator dobiera okno
       * dokładnie do strony; widać to dopiero na wysokości treści.
       */
      const ponizejArkusza = await page.evaluate(() => {
        const dol = document.querySelector('.arkusz')!.getBoundingClientRect().bottom;
        return Math.round(document.body.getBoundingClientRect().bottom - dol);
      });
      expect(ponizejArkusza).toBeLessThanOrEqual(1);

      await expect(kafel).toBeVisible();
      await expect(kafel.getByText('Zeskanuj i zamów')).toBeVisible();

      /**
       * Naklejka A5 jest **pionowa**, choć pasek na stronie jest poziomy.
       * Sprawdzamy to porównaniem własnej szerokości karty z tą, którą zajmuje
       * na stronie: obrót o ćwierć obrotu zamienia je miejscami. Napis „obrót"
       * w arkuszu stylów niczego by nie dowiódł — liczy się, co wychodzi na
       * papier, a bez tego cięcie wzdłuż daje naklejkę położoną na boku.
       */
      const wymiary = () =>
        kafel.locator('.kafel-karta').evaluate((el) => ({
          wlasna: (el as HTMLElement).offsetWidth,
          naStronie: Math.round(el.getBoundingClientRect().width),
        }));

      const a6 = await wymiary();
      expect(Math.abs(a6.naStronie - a6.wlasna)).toBeLessThan(4);

      await page.emulateMedia({ media: 'screen' });
      await page.getByRole('button', { name: /Drukuj A5/ }).click();
      await expect(arkusz).toHaveClass(/arkusz-a5/);
      await page.emulateMedia({ media: 'print' });

      const a5 = await wymiary();
      expect(a5.naStronie).toBeGreaterThan(a5.wlasna * 1.3);
      // Wersja wydruku ma być na kaflu, bo kafle idą pod nożyczki osobno.
      await expect(kafel.getByText('wydruk v1')).toBeVisible();

      // Zachęta większa od wersji wydruku — po to była ta zmiana.
      const zacheta = await kafel
        .getByText('Zeskanuj i zamów')
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      const stopka = await kafel
        .getByText('wydruk v1')
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(zacheta).toBeGreaterThan(stopka * 2);
    } finally {
      await fixture.cleanup();
    }
  });

  test('numer i strefa stolika są edytowalne, a kod zostaje ten sam', async ({ page }) => {
    const fixture = await seedMenuAndTable();
    const nowyNumer = `${fixture.tableLabel} bis`;

    try {
      await page.goto('/login');
      await page.getByLabel('E-mail').fill(ACCOUNTS.owner.email);
      await page.getByLabel('Hasło', { exact: true }).fill(ACCOUNTS.owner.password);
      await page.getByRole('button', { name: 'Zaloguj' }).click();
      await expect(page).toHaveURL(/\/queue$/);
      await page.goto('/qr');

      const karta = page.locator('article').filter({ hasText: fixture.tableLabel });
      await karta.getByRole('button', { name: 'edytuj' }).click();

      await karta.getByLabel('Numer stolika').fill(nowyNumer);
      await karta.getByLabel('Strefa').fill('Taras');
      await karta.getByRole('button', { name: 'Zapisz' }).click();

      const poZmianie = page.locator('article').filter({ hasText: nowyNumer });
      await expect(poZmianie.getByRole('heading', { name: nowyNumer })).toBeVisible();
      await expect(poZmianie.getByText('Taras')).toBeVisible();

      // Sedno: zmiana opisu **nie unieważnia naklejki**. Token zostaje ten sam,
      // więc kod wydrukowany wczoraj dalej prowadzi do tego stolika.
      await expect(poZmianie.getByRole('link', { name: 'otwórz menu gościa' })).toHaveAttribute(
        'href',
        `${GUEST_URL}/t/${fixture.qrToken}`,
      );
      await expect(poZmianie.getByText('wydruk v1')).toBeVisible();
    } finally {
      await fixture.cleanup();
    }
  });
});
