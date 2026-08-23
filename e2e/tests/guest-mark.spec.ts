import { expect, test } from '@playwright/test';
import { PARTICIPANT_SYMBOLS, SYMBOL_PATH } from '@kelbroo/types';

/**
 * Znaki rozpoznawcze gości muszą być **widoczne**.
 *
 * Ten test istnieje przez półksiężyc, który przez cały czas nie rysował nic:
 * jego łuk powrotny miał promień 7, a musiał pokryć cięciwę 18. Przeglądarka
 * skalowała wtedy promień do 9, obie połówki się pokrywały i figura miała zerowe
 * pole. Gość dostawał zapasowe kółko — nie do odróżnienia od gościa z symbolem
 * „koło", więc dwie osoby przy stoliku mogły wyglądać identycznie.
 *
 * Sprawdzenie w kodzie tego nie łapie: zepsuta ścieżka była niepustym napisem
 * i domykała się poprawnie. Rozstrzyga dopiero policzenie pomalowanych pikseli.
 */
test.describe('kształty znaków gościa', () => {
  test('każdy kształt maluje widoczną figurę', async ({ page }) => {
    await page.setContent('<canvas id="c" width="64" height="64"></canvas>');

    for (const symbol of PARTICIPANT_SYMBOLS) {
      const wypelnienie = await page.evaluate((d: string) => {
        const canvas = document.getElementById('c') as HTMLCanvasElement;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, 64, 64);
        ctx.save();
        // Ścieżki są w układzie 24×24 — skalujemy je do rozmiaru płótna.
        ctx.scale(64 / 24, 64 / 24);
        ctx.fill(new Path2D(d));
        ctx.restore();

        const piksele = ctx.getImageData(0, 0, 64, 64).data;
        let pomalowane = 0;
        for (let i = 3; i < piksele.length; i += 4) if (piksele[i]! > 8) pomalowane += 1;
        return pomalowane / (64 * 64);
      }, SYMBOL_PATH[symbol]);

      // Najcieńszy kształt z zestawu (błyskawica) pokrywa ~15% pola. Zepsuty
      // półksiężyc pokrywał 0%. Próg 5% oddziela figurę od niczego, nie krojąc
      // miejsca na przyszłe smuklejsze kształty.
      expect(wypelnienie, `kształt „${symbol}" nie maluje nic`).toBeGreaterThan(0.05);
    }
  });
});
