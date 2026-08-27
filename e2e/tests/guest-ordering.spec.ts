import { expect, test, type Page } from '@playwright/test';
import { GUEST_URL } from '../playwright.config';
import { ACCOUNTS } from '../fixtures/accounts';
import { seedMenuAndTable, setStaffConfirmation } from '../fixtures/db';

/**
 * Zamawianie — pełna droga od skanu kodu QR do rozliczonego rachunku.
 *
 * To jedyna ścieżka, za którą klienci płacą, i najdroższa awaria, jaką mamy:
 * regresja tutaj oznacza lokal, który w środku serwisu nie przyjmuje zamówień.
 * Do tej pory była potwierdzona **ręcznie, jednorazowo** — reszta plików pokrywa
 * wejście, wezwania kelnera i podział rachunku, ale nie samo zamówienie.
 *
 * Testy sprawdzają obie strony **bramki do kuchni**: zamówienie niepotwierdzone
 * nie ma prawa pojawić się na ekranie kuchni, bo kuchnia gotowałaby coś,
 * co może jeszcze zniknąć.
 */

async function logInAsOwner(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(ACCOUNTS.owner.email);
  await page.getByLabel('Hasło', { exact: true }).fill(ACCOUNTS.owner.password);
  await page.getByRole('button', { name: 'Zaloguj' }).click();
  await expect(page).toHaveURL(/\/queue$/);
}

/** Dokłada danie do koszyka: otwiera je, ustawia ilość i notatkę, zatwierdza. */
async function dodajDoKoszyka(
  page: Page,
  danie: string,
  opcje: { ilosc?: number; notatka?: string } = {},
): Promise<void> {
  await page.getByText(danie).first().click();
  if (opcje.notatka) await page.getByPlaceholder('np. bez cebuli').fill(opcje.notatka);
  // Przyciski ilości mają nazwy dostępne („Więcej"/„Mniej"), a nie znaki + i −:
  // czytnik ekranu przeczytałby „plus" jako nazwę przycisku i nic by to nie znaczyło.
  for (let i = 1; i < (opcje.ilosc ?? 1); i++) {
    await page.getByRole('button', { name: 'Więcej' }).click();
  }
  await page.getByRole('button', { name: /^Dodaj/ }).click();
}

test.describe('gość składa zamówienie', () => {
  test.afterEach(async () => {
    // Domyślny stan restauracji testowej — kolejne pliki na nim polegają.
    await setStaffConfirmation(true);
  });

  test('od koszyka, przez kolejkę potwierdzeń, na ekran kuchni', async ({ browser }) => {
    const fixture = await seedMenuAndTable();
    await setStaffConfirmation(true);

    const goscContext = await browser.newContext();
    const panelContext = await browser.newContext();

    try {
      const gosc = await goscContext.newPage();
      await gosc.goto(`${GUEST_URL}/t/${fixture.qrToken}`);
      await expect(gosc.getByText(fixture.dishName)).toBeVisible();

      await dodajDoKoszyka(gosc, fixture.dishName, { ilosc: 2, notatka: 'bez cebuli' });

      // Koszyk liczy to, co gość wybrał. Danie kosztuje 25,00 zł.
      await gosc.getByRole('button', { name: 'Koszyk' }).click();
      await expect(gosc.getByText(/2×/)).toBeVisible();
      await expect(gosc.getByText('bez cebuli')).toBeVisible();
      await expect(gosc.getByRole('button', { name: /Zamawiam/ })).toContainText('50,00');

      await gosc.getByRole('button', { name: /Zamawiam/ }).click();

      // Gość widzi swoje zamówienie u siebie, zanim ktokolwiek je potwierdzi.
      await gosc.getByRole('button', { name: 'Zamówienia' }).click();
      await expect(gosc.getByText(fixture.dishName)).toBeVisible();

      const panel = await panelContext.newPage();
      await logInAsOwner(panel);

      // Najpierw kolejka potwierdzeń: zamówienie istnieje i dotarło do panelu.
      // Ta asercja jest **warunkiem sensu następnej** — bez niej „nie ma go
      // na kuchni" byłoby prawdą także wtedy, gdyby nie było go nigdzie.
      await expect(panel.getByText(fixture.tableLabel)).toBeVisible({ timeout: 20_000 });
      await expect(panel.getByText(fixture.dishName)).toBeVisible();
      await expect(panel.getByText('bez cebuli')).toBeVisible();

      // Dopiero teraz bramka: kuchnia nie ma prawa go widzieć.
      await panel.goto('/kds');
      // Czekamy, aż ekran się wczyta. Sprawdzenie „nie ma" tuż po nawigacji
      // przechodzi na pustej stronie i nie dowodzi niczego — ta pułapka
      // wpuściła tu raz zieloną wersję testu przy **zepsutej** bramce.
      await expect(panel.getByText('Wczytuję…')).toHaveCount(0, { timeout: 20_000 });
      await expect(panel.getByRole('heading', { name: 'W przygotowaniu' })).toBeVisible();
      await expect(panel.getByText(fixture.dishName)).toHaveCount(0);

      await panel.goto('/queue');
      await panel
        .getByRole('button', { name: /Potwierdź/ })
        .first()
        .click();

      // Dopiero teraz kuchnia ma co gotować.
      await panel.goto('/kds');
      await expect(panel.getByText(fixture.dishName)).toBeVisible({ timeout: 20_000 });
    } finally {
      await goscContext.close();
      await panelContext.close();
      await fixture.cleanup();
    }
  });

  test('przy wyłączonym potwierdzaniu idzie prosto na kuchnię', async ({ browser }) => {
    const fixture = await seedMenuAndTable();
    // Lokal bez kelnera przy stoliku — zamówienie ma nie czekać na nikogo.
    await setStaffConfirmation(false);

    const goscContext = await browser.newContext();
    const panelContext = await browser.newContext();

    try {
      const gosc = await goscContext.newPage();
      await gosc.goto(`${GUEST_URL}/t/${fixture.qrToken}`);
      await expect(gosc.getByText(fixture.dishName)).toBeVisible();

      await dodajDoKoszyka(gosc, fixture.dishName);
      await gosc.getByRole('button', { name: 'Koszyk' }).click();
      await gosc.getByRole('button', { name: /Zamawiam/ }).click();

      const panel = await panelContext.newPage();
      await logInAsOwner(panel);
      await panel.goto('/kds');

      await expect(panel.getByText(fixture.dishName)).toBeVisible({ timeout: 20_000 });
    } finally {
      await goscContext.close();
      await panelContext.close();
      await fixture.cleanup();
    }
  });

  test('pusty koszyk nie da się wysłać', async ({ page }) => {
    const fixture = await seedMenuAndTable();

    try {
      await page.goto(`${GUEST_URL}/t/${fixture.qrToken}`);
      await expect(page.getByText(fixture.dishName)).toBeVisible();

      await page.getByRole('button', { name: 'Koszyk' }).click();

      // Nie ma czego zamawiać i nie ma o tym co negocjować.
      await expect(page.getByText('Koszyk jest pusty.')).toBeVisible();
      await expect(page.getByRole('button', { name: /Zamawiam/ })).toHaveCount(0);
    } finally {
      await fixture.cleanup();
    }
  });
});

/**
 * Rozliczenie stolika.
 *
 * Koniec tej samej drogi: kelner zamyka rachunek na ekranie Sala i stolik wraca
 * do obiegu. Bez tego testu ostatni krok ścieżki — ten, po którym pieniądze są
 * w kasie — nie ma żadnego pokrycia.
 */
test('kelner rozlicza stolik i wizyta się zamyka', async ({ browser }) => {
  const fixture = await seedMenuAndTable();
  await setStaffConfirmation(false);

  const goscContext = await browser.newContext();
  const panelContext = await browser.newContext();

  try {
    const gosc = await goscContext.newPage();
    await gosc.goto(`${GUEST_URL}/t/${fixture.qrToken}`);
    await expect(gosc.getByText(fixture.dishName)).toBeVisible();

    await dodajDoKoszyka(gosc, fixture.dishName);
    await gosc.getByRole('button', { name: 'Koszyk' }).click();
    await gosc.getByRole('button', { name: /Zamawiam/ }).click();
    // Po złożeniu zamówienia aplikacja sama przechodzi na „Zamówienia" —
    // gość ma zobaczyć, że jego zamówienie istnieje, a nie pusty koszyk.
    await expect(gosc.getByText('Rachunek stolika')).toBeVisible({ timeout: 20_000 });

    const panel = await panelContext.newPage();
    await logInAsOwner(panel);
    await panel.goto('/tables');

    // Stolik pokazuje kwotę do zapłaty — to po niej kelner poznaje, co zamykać.
    const stolik = panel.locator('div', { hasText: fixture.tableLabel }).last();
    await expect(stolik.getByText('Do zapłaty')).toBeVisible({ timeout: 20_000 });
    await expect(stolik.getByText('25,00')).toBeVisible();

    await stolik.getByRole('button', { name: 'Gotówka' }).click();

    // Po rozliczeniu stolik nie ma już nic do zapłaty.
    await expect(panel.getByText('Do zapłaty')).toHaveCount(0, { timeout: 20_000 });
  } finally {
    await setStaffConfirmation(true);
    await goscContext.close();
    await panelContext.close();
    await fixture.cleanup();
  }
});
