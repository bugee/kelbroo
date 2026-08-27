import { expect, test, type Page } from '@playwright/test';
import { GUEST_URL } from '../playwright.config';
import { ACCOUNTS } from '../fixtures/accounts';
import { seedMenuAndTable, seedTable, setStaffConfirmation } from '../fixtures/db';

/**
 * Przesiadka gości przy inny stolik.
 *
 * Ta funkcja rozciąga się na trzy aplikacje naraz — panel wykonuje operację,
 * API przepina wizytę, telefon gościa musi trafić pod nowy adres — a najtrudniejsza
 * część jest po stronie gościa: token wizyty leży w pamięci przeglądarki **pod
 * kluczem kodu QR**, a wizyta ma teraz inny kod. Test jednostkowy tego nie dosięgnie,
 * bo cała rzecz dzieje się w `localStorage` przeglądarki.
 *
 * Awaria wygląda tu niewinnie: gość widzi menu i pusty rachunek. Prawdziwy rachunek
 * leży dwa stoliki dalej i nikt się o tym nie dowie aż do płacenia.
 */

async function logInAsOwner(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(ACCOUNTS.owner.email);
  await page.getByLabel('Hasło', { exact: true }).fill(ACCOUNTS.owner.password);
  await page.getByRole('button', { name: 'Zaloguj' }).click();
  await expect(page).toHaveURL(/\/queue$/);
}

test.describe('kelner przesadza gości', () => {
  test.afterEach(async () => {
    await setStaffConfirmation(true);
  });

  test('rachunek idzie za gośćmi, a telefon sam trafia pod nowy stolik', async ({ browser }) => {
    const skad = await seedMenuAndTable();
    const dokad = await seedTable();
    await setStaffConfirmation(false);

    const goscContext = await browser.newContext();
    const panelContext = await browser.newContext();

    try {
      // Gość siada, zamawia i ma otwarty rachunek — bez tego przesiadka niczego
      // nie dowodzi, bo nie ma czego przenosić.
      const gosc = await goscContext.newPage();
      await gosc.goto(`${GUEST_URL}/t/${skad.qrToken}`);
      await expect(gosc.getByText(skad.dishName)).toBeVisible();
      await gosc.getByText(skad.dishName).first().click();
      await gosc.getByRole('button', { name: /^Dodaj/ }).click();
      await gosc.getByRole('button', { name: 'Koszyk' }).click();
      await gosc.getByRole('button', { name: /Zamawiam/ }).click();
      await gosc.getByRole('button', { name: 'Zamówienia' }).click();
      await expect(gosc.getByText(skad.dishName)).toBeVisible();

      // Nick zapamiętany **przed** przesiadką. To on rozstrzyga, czy gość wrócił
      // jako ten sam człowiek, czy jako ktoś nowy dopisany do tego samego rachunku —
      // sama widoczność zamówienia tego nie dowodzi, bo rachunek jest wspólny.
      const nick = await gosc
        .locator('header')
        .getByText(/\w+ \w+/)
        .first()
        .innerText();

      const panel = await panelContext.newPage();
      await logInAsOwner(panel);
      await panel.goto('/tables');

      /**
       * Kafel stolika wskazujemy po **nagłówku**, nie po dowolnym tekście.
       *
       * Rozwinięta lista przesiadki niesie nazwy wolnych stolików jako opcje,
       * więc `hasText` trafiałby w dwa kafle naraz — ten, przy którym siedzi
       * gość, i ten, który właśnie wybieramy. Nazwa stolika stoi w nagłówku
       * i nigdzie indziej.
       */
      const kafel = (etykieta: string) =>
        panel.locator('article').filter({ has: panel.locator('header', { hasText: etykieta }) });

      const zrodlo = kafel(skad.tableLabel);
      await expect(zrodlo).toBeVisible();
      await zrodlo.getByRole('button', { name: 'Przesadź gości' }).click();
      // Etykieta w opcji może nieść strefę po kropce — wybieramy po identyfikatorze.
      await zrodlo.getByRole('combobox').selectOption(dokad.tableId);

      // Wizyta stoi teraz przy nowym stoliku, a stary jest wolny.
      const cel = kafel(dokad.tableLabel);
      await expect(cel.getByRole('link', { name: 'Podgląd zamówienia' })).toBeVisible();
      await expect(zrodlo.getByText('Nikt jeszcze nie zeskanował')).toBeVisible();

      // **Najważniejsza część.** Gość odświeża kartę sprzed przesiadki — ten sam
      // adres, ten sam token w pamięci. Ma wylądować przy swoim rachunku, a nie
      // przy pustej wizycie na zwolnionym stoliku.
      await gosc.goto(`${GUEST_URL}/t/${skad.qrToken}`);
      await expect(gosc).toHaveURL(new RegExp(`/t/${dokad.qrToken}$`));

      await gosc.getByRole('button', { name: 'Zamówienia' }).click();
      await expect(gosc.getByText(skad.dishName)).toBeVisible();

      /**
       * Ta sama tożsamość, nie nowy gość przy tym samym rachunku.
       *
       * Sama widoczność zamówienia tego nie dowodzi — rachunek jest wspólny, więc
       * dopisany przez pomyłkę drugi gość widziałby je tak samo. Rozstrzyga liczba
       * osób przy stoliku, a widać ją w panelu: bez przeniesienia tokenu pod nowy
       * klucz przy stole pojawiłby się ktoś, kogo nikt nie zapraszał.
       */
      await panel.reload();
      const nowyPoPowrocie = panel.locator('article').filter({ hasText: dokad.tableLabel });
      await expect(
        nowyPoPowrocie.getByRole('button', { name: /^Usuń .* ze stolika$/ }),
      ).toHaveCount(1);
    } finally {
      await goscContext.close();
      await panelContext.close();
      await dokad.cleanup();
      await skad.cleanup();
    }
  });
});
