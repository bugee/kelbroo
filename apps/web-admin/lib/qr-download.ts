import QRCode from 'qrcode';

/**
 * Pobranie kodu stolika jako pliku graficznego.
 *
 * Kod generujemy **na nowo**, a nie zapisujemy tego, który widać na ekranie:
 * tamten ma zerowy margines, bo leży na białej karcie wydruku, która sama jest
 * dla niego jasnym otoczeniem. Plik trafia na cudzą grafikę, w nieznane tło —
 * a kod bez wolnego marginesu (norma mówi o czterech modułach) potrafi się nie
 * zeskanować. Cztery moduły kosztują tu kilka pikseli i ratują wydruk, którego
 * i tak nikt nie sprawdzi przed rozwieszeniem.
 */
const MARGINES_MODULOW = 4;

/**
 * Bok pliku PNG. 2048 px starcza na naklejkę wielkości kartki przy 300 dpi
 * i na wszystko mniejsze — a kod jest czarno-biały, więc plik zostaje lekki.
 */
const BOK_PNG = 2048;

/** `Stolik 12 · Taras` → `stolik-12-taras`. Nazwa pliku ma przeżyć każdy system. */
export function nazwaPliku(label: string, rozszerzenie: 'png' | 'svg'): string {
  const slug = label
    .normalize('NFD')
    // Znaki diakrytyczne po rozłożeniu są osobnymi znakami — usuwamy je, a nie
    // całe litery, więc „Zaplecze" zostaje „zaplecze", a nie „zplcz".
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/gi, 'l')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `kelbroo-${slug || 'stolik'}.${rozszerzenie}`;
}

function zapisz(blob: Blob, nazwa: string): void {
  const adres = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = adres;
  link.download = nazwa;
  link.click();
  // Bez tego adres `blob:` żyje do końca życia karty razem z całym plikiem.
  URL.revokeObjectURL(adres);
}

export async function pobierzPng(adresGoscia: string, label: string): Promise<void> {
  const dataUrl = await QRCode.toDataURL(adresGoscia, {
    width: BOK_PNG,
    margin: MARGINES_MODULOW,
    errorCorrectionLevel: 'M',
  });
  zapisz(await (await fetch(dataUrl)).blob(), nazwaPliku(label, 'png'));
}

export async function pobierzSvg(adresGoscia: string, label: string): Promise<void> {
  const svg = await QRCode.toString(adresGoscia, {
    type: 'svg',
    margin: MARGINES_MODULOW,
    errorCorrectionLevel: 'M',
  });
  zapisz(new Blob([svg], { type: 'image/svg+xml' }), nazwaPliku(label, 'svg'));
}
