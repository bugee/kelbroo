import { expect, test } from '@playwright/test';
import { GUEST_URL } from '../playwright.config';
import { acknowledgeCallAt, blockTable, seedMenuAndTable, setHostApproval } from '../fixtures/db';

/**
 * Ścieżka gościa od skanu kodu QR.
 *
 * Ten plik istnieje, bo aplikacja gościa nie miała żadnego pokrycia i przepuściła
 * awarię wywracającą cały ekran — źle umieszczony hook, który przy pierwszym
 * renderze liczył się inaczej niż przy drugim. Samo otwarcie strony by ją złapało,
 * więc pierwszy test robi dokładnie to.
 */
test.describe('gość przy stoliku', () => {
  test('po zeskanowaniu kodu widzi menu, a nie pusty ekran', async ({ page }) => {
    const fixture = await seedMenuAndTable();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    try {
      await page.goto(`${GUEST_URL}/t/${fixture.qrToken}`);

      // Karta się wyrenderowała — czyli komponent przeżył wczytanie wizyty.
      await expect(page.getByText(fixture.dishName)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();

      // Żaden błąd wykonania nie może przejść niezauważony: React #310 objawiał
      // się właśnie tak — wyjątek w konsoli i biała strona.
      expect(errors).toEqual([]);
    } finally {
      await fixture.cleanup();
    }
  });

  test('dostaje znak rozpoznawczy jako samą ikonę, bez podpisu', async ({ page }) => {
    const fixture = await seedMenuAndTable();

    try {
      await page.goto(`${GUEST_URL}/t/${fixture.qrToken}`);
      await expect(page.getByText(fixture.dishName)).toBeVisible();

      // Sam kształt, bez podpisu pod obrazkiem.
      const naglowek = page.locator('header');
      const znak = naglowek.locator('svg[role="img"]');
      await expect(znak).toHaveCount(1);

      // Nazwa nie jest wypisana na ekranie, ale czytnik ekranu musi ją podać.
      await expect(znak).toHaveAttribute(
        'aria-label',
        /(gwiazdka|serce|kwadrat|trójkąt|koło|domek|strzałka|samochodzik|romb|błyskawica)/,
      );
      await expect(
        naglowek.getByText(
          /(gwiazdka|serce|kwadrat|trójkąt|koło|domek|strzałka|samochodzik|romb|błyskawica)/,
        ),
      ).toHaveCount(0);
    } finally {
      await fixture.cleanup();
    }
  });

  test('może zawołać kelnera i widzi, że zgłoszenie poszło', async ({ page }) => {
    const fixture = await seedMenuAndTable();

    try {
      await page.goto(`${GUEST_URL}/t/${fixture.qrToken}`);
      await expect(page.getByText(fixture.dishName)).toBeVisible();

      await page.getByRole('button', { name: 'Kelner', exact: true }).click();
      // „Wysłane", nie „idzie" — nikt jeszcze zgłoszenia nie przyjął.
      await expect(page.getByRole('button', { name: /Kelner — wysłane/ })).toBeVisible();
    } finally {
      await fixture.cleanup();
    }
  });

  test('drugie stuknięcie wycofuje wezwanie kelnera', async ({ page }) => {
    const fixture = await seedMenuAndTable();

    try {
      await page.goto(`${GUEST_URL}/t/${fixture.qrToken}`);
      await expect(page.getByText(fixture.dishName)).toBeVisible();

      const przycisk = page.getByRole('button', { name: /^Kelner/ });
      await przycisk.click();
      await expect(page.getByRole('button', { name: /Kelner — wysłane/ })).toBeVisible();

      // To samo miejsce, ta sama decyzja: „jednak nie".
      await page.getByRole('button', { name: /Kelner — wysłane/ }).click();
      await expect(page.getByRole('button', { name: 'Kelner', exact: true })).toBeVisible();

      // Stan pochodzi z serwera, nie z pamięci komponentu — po przeładowaniu
      // przycisk nie może wrócić do „wysłane".
      await page.reload();
      await expect(page.getByRole('button', { name: 'Kelner', exact: true })).toBeVisible();
    } finally {
      await fixture.cleanup();
    }
  });

  test('nie wycofa wezwania, po które kelner już wstał', async ({ page }) => {
    const fixture = await seedMenuAndTable();

    try {
      await page.goto(`${GUEST_URL}/t/${fixture.qrToken}`);
      await expect(page.getByText(fixture.dishName)).toBeVisible();

      await page.getByRole('button', { name: /^Kelner/ }).click();
      await expect(page.getByRole('button', { name: /Kelner — wysłane/ })).toBeVisible();

      await acknowledgeCallAt(fixture.tableId);
      await page.reload();

      // Kelner idzie przez salę — zniknięcie zgłoszenia byłoby kłamstwem.
      const idzie = page.getByRole('button', { name: 'Kelner idzie' });
      await expect(idzie).toBeVisible();
      await expect(idzie).toBeDisabled();
    } finally {
      await fixture.cleanup();
    }
  });

  test('przy zablokowanym stoliku widzi tylko prośbę o otwarcie', async ({ page }) => {
    const fixture = await seedMenuAndTable();

    try {
      await blockTable(fixture.tableId);
      await page.goto(`${GUEST_URL}/t/${fixture.qrToken}`);

      await expect(page.getByRole('button', { name: 'Poproś o otwarcie stolika' })).toBeVisible();
      // Karta nie może się pokazać: sugerowałaby, że da się zamówić, a nie da.
      await expect(page.getByText(fixture.dishName)).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Menu' })).toHaveCount(0);

      await page.getByRole('button', { name: 'Poproś o otwarcie stolika' }).click();
      await expect(page.getByText(/Obsługa już wie/)).toBeVisible();
    } finally {
      await fixture.cleanup();
    }
  });
});

/**
 * Wpuszczanie gości przez hosta.
 *
 * Kod QR leży na stoliku na widoku, więc bez tej bramki do rachunku dopisze się
 * każdy, kto go zobaczy. Test przechodzi całą pętlę na dwóch osobnych
 * przeglądarkach, bo pamięć wizyty jest per urządzenie.
 */
test.describe('host wpuszcza do stolika', () => {
  test('drugi gość czeka, aż host go wpuści', async ({ browser }) => {
    const fixture = await seedMenuAndTable();
    await setHostApproval(true);

    const hostContext = await browser.newContext();
    const goscContext = await browser.newContext();

    try {
      // Host — pierwszy skan otwiera wizytę i nie czeka na nikogo.
      const host = await hostContext.newPage();
      await host.goto(`${GUEST_URL}/t/${fixture.qrToken}`);
      await expect(host.getByText(fixture.dishName)).toBeVisible();

      // Drugie urządzenie: menu widać, ale zamówić nie można.
      const gosc = await goscContext.newPage();
      await gosc.goto(`${GUEST_URL}/t/${fixture.qrToken}`);
      await expect(gosc.getByText(/musi Cię wpuścić/)).toBeVisible();

      // Kolejka pojawia się u hosta sama. Bez przeładowania — bo host trzyma
      // telefon w ręce i nie ma powodu go odświeżać, a wcześniej właśnie tego
      // wymagał: wejście gościa nie wysyłało żadnego sygnału.
      await expect(host.getByText(/chce dołączyć do stolika/)).toBeVisible({ timeout: 20_000 });
      await host.getByRole('button', { name: 'Wpuść' }).click();

      // Ekran czekającego odblokowuje się bez odświeżania strony.
      await expect(gosc.getByText(/musi Cię wpuścić/)).toHaveCount(0, { timeout: 15_000 });
      await expect(gosc.getByText(fixture.dishName)).toBeVisible();
    } finally {
      await setHostApproval(false);
      await hostContext.close();
      await goscContext.close();
      await fixture.cleanup();
    }
  });
});

/**
 * Trzech gości przy jednym stoliku, dwóch czeka na wpuszczenie.
 *
 * Ten test istnieje przez konkretną awarię: sygnał o oczekującym gościu był
 * wysyłany przy **każdym** wczytaniu wizyty, a nie przy dołączeniu. Każdy sygnał
 * kazał wszystkim telefonom wczytać wizytę od nowa, co wysyłało sygnał ponownie —
 * ekrany migotały, aż baza przestawała wyrabiać i zwracała 500.
 */
test('dwóch czekających gości nie zapętla ekranów przy stoliku', async ({ browser }) => {
  const fixture = await seedMenuAndTable();
  await setHostApproval(true);

  const konteksty = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);

  try {
    const [host, drugi, trzeci] = await Promise.all(konteksty.map((k) => k.newPage()));

    await host!.goto(`${GUEST_URL}/t/${fixture.qrToken}`);
    await expect(host!.getByText(fixture.dishName)).toBeVisible();

    // Liczymy wczytania wizyty u hosta. W pętli szło ich kilkadziesiąt na sekundę.
    let wczytania = 0;
    host!.on('request', (request) => {
      if (request.url().includes('/t/')) wczytania += 1;
    });

    await drugi!.goto(`${GUEST_URL}/t/${fixture.qrToken}`);
    await trzeci!.goto(`${GUEST_URL}/t/${fixture.qrToken}`);

    // Obaj pojawiają się u hosta sami.
    await expect(host!.getByText(/Chętni do stolika/)).toBeVisible({ timeout: 20_000 });
    await expect(
      host!.locator('section', { hasText: 'Chętni do stolika' }).locator('li'),
    ).toHaveCount(2);

    // Cztery sekundy ciszy: bez pętli wczytań jest garstka, nie dziesiątki.
    const poDolaczeniu = wczytania;
    await host!.waitForTimeout(4000);
    expect(wczytania - poDolaczeniu).toBeLessThan(5);

    // Wpuszczenie jednego też nie rozkręca lawiny.
    await host!.getByRole('button', { name: 'Wpuść' }).first().click();
    await expect(drugi!.getByText(/musi Cię wpuścić/)).toHaveCount(0, { timeout: 20_000 });

    const poWpuszczeniu = wczytania;
    await host!.waitForTimeout(4000);
    expect(wczytania - poWpuszczeniu).toBeLessThan(5);
  } finally {
    await setHostApproval(false);
    await Promise.all(konteksty.map((k) => k.close()));
    await fixture.cleanup();
  }
});

/**
 * Skład stolika na ekranie gościa.
 *
 * Rachunek jest wspólny, więc gość musi wiedzieć, z kim go dzieli — także z kimś,
 * kto jeszcze nic nie zamówił i przez to nie pojawia się przy żadnej pozycji.
 */
test('gość widzi, kto jeszcze siedzi przy jego stoliku', async ({ browser }) => {
  const fixture = await seedMenuAndTable();
  const konteksty = await Promise.all([browser.newContext(), browser.newContext()]);

  try {
    const [host, drugi] = await Promise.all(konteksty.map((k) => k.newPage()));

    await host!.goto(`${GUEST_URL}/t/${fixture.qrToken}`);
    await expect(host!.getByText(fixture.dishName)).toBeVisible();

    // Sam przy stoliku — nie ma czego rozwijać.
    await expect(host!.getByRole('button', { name: /Przy stoliku/ })).toHaveCount(0);

    // Host jest oznaczony przy swojej nazwie w nagłówku.
    await expect(host!.locator('header').getByText('host')).toBeVisible();

    await drugi!.goto(`${GUEST_URL}/t/${fixture.qrToken}`);
    await expect(drugi!.getByText(fixture.dishName)).toBeVisible();

    // Licznik u hosta rośnie sam, bez przeładowania strony.
    const licznik = host!.getByRole('button', { name: 'Przy stoliku: 2' });
    await expect(licznik).toBeVisible({ timeout: 20_000 });

    await licznik.click();
    const lista = host!.getByRole('dialog', { name: 'Przy stoliku' });
    // Widać drugiego gościa, a siebie nie — własny znak stoi w nagłówku obok.
    await expect(lista.locator('li')).toHaveCount(1);

    // Drugi gość hostem nie jest, więc przy swojej nazwie tej etykiety nie ma.
    // Sprawdzamy przed rozwinięciem listy: lista wychodzi z tego samego nagłówka
    // i sama zawiera etykietę hosta — przy kimś innym.
    await expect(drugi!.locator('header').getByText('host')).toHaveCount(0);

    // Po rozwinięciu widzi hosta, oznaczonego jako host.
    await drugi!.getByRole('button', { name: 'Przy stoliku: 2' }).click();
    const listaDrugiego = drugi!.getByRole('dialog', { name: 'Przy stoliku' });
    await expect(listaDrugiego.locator('li')).toHaveCount(1);
    await expect(listaDrugiego.getByText('host')).toBeVisible();
  } finally {
    await Promise.all(konteksty.map((k) => k.close()));
    await fixture.cleanup();
  }
});

/**
 * Prośba o rachunek: podział, forma płatności, faktura.
 *
 * Trzy pytania, bo kelner na podstawie odpowiedzi decyduje, co ze sobą zabrać.
 * Do tej pory pytaliśmy tylko o podział i wracał po terminal.
 */
test('prośba o rachunek pyta o podział, płatność i fakturę', async ({ page }) => {
  const fixture = await seedMenuAndTable();

  try {
    await page.goto(`${GUEST_URL}/t/${fixture.qrToken}`);
    await expect(page.getByText(fixture.dishName)).toBeVisible();
    await page.getByRole('button', { name: 'Zamówienia' }).click();

    await page.getByRole('button', { name: 'Poproś o rachunek' }).click();

    // 1. Podział. Jeden rachunek wyklucza „kartę i gotówkę" — nie ma czego dzielić.
    await expect(page.getByText('Jak chcecie zapłacić?')).toBeVisible();
    await page.getByRole('button', { name: 'Jeden rachunek' }).click();

    // 2. Forma płatności.
    await expect(page.getByText('Czym zapłacicie?')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Karta i gotówka' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Kartą' }).click();

    // 3. Faktura.
    await expect(page.getByText('Potrzebna faktura VAT?')).toBeVisible();
    await page.getByRole('button', { name: 'Tak, poproszę fakturę' }).click();

    // Potwierdzenie powtarza to, co gość wybrał — żeby mógł sprawdzić.
    await expect(page.getByText(/Kelner już wie/)).toBeVisible();
    await expect(page.getByText(/Kartą · faktura VAT/)).toBeVisible();
  } finally {
    await fixture.cleanup();
  }
});

test('karta i gotówka pojawia się dopiero przy dzielonym rachunku', async ({ page }) => {
  const fixture = await seedMenuAndTable();

  try {
    await page.goto(`${GUEST_URL}/t/${fixture.qrToken}`);
    await expect(page.getByText(fixture.dishName)).toBeVisible();
    await page.getByRole('button', { name: 'Zamówienia' }).click();

    await page.getByRole('button', { name: 'Poproś o rachunek' }).click();
    await page.getByRole('button', { name: 'Każdy za siebie' }).click();

    await expect(page.getByRole('button', { name: 'Karta i gotówka' })).toBeVisible();
  } finally {
    await fixture.cleanup();
  }
});
