/**
 * Szablony wiadomości.
 *
 * Poczta to nie przeglądarka: klienty pocztowe wycinają `<style>`, nie znają
 * flexboksa ani grida, a Outlook renderuje silnikiem Worda. Stąd układ na
 * tabelach i style w atrybutach `style` — to nie zaniedbanie, tylko jedyny
 * zapis, który wygląda tak samo w Gmailu, Outlooku i na telefonie.
 *
 * Paleta i typografia pochodzą z jasnego motywu systemu (CLAUDE.md): teal na
 * treść, pomarańcz **wyłącznie** na wezwanie do działania.
 */

const TEAL = '#2A8F8C';
const ORANGE = '#E8722F';
const INK = '#0F2422';
const MUTED = '#6B807E';
const GROUND = '#F1F5F4';
const LINE = '#D8E4E2';

/** Krój systemowy: własnych fontów poczta i tak nie wczyta. */
const FONT = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export interface Ramka {
  adresStrony: string;
  naglowek: string;
  akapity: string[];
  przycisk?: { etykieta: string; href: string };
  /** Drobny druk pod przyciskiem — np. termin ważności odnośnika. */
  stopka?: string[];
}

/**
 * Ucieczka dla tekstu wstawianego w HTML wiadomości.
 *
 * Wyeksportowana, bo `akapity` trafiają do szablonu **surowo** — niosą własne
 * `<strong>` i `<code>`. Wszystko, co pochodzi od gościa albo klienta (nick,
 * nazwa dania, notatka do zamówienia), musi przejść przez to wywołanie po
 * stronie wołającego; szablon już tego nie zrobi.
 */
export const escapeHtml = (tekst: string): string =>
  tekst.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Wspólna ramka: logo, treść, przycisk, stopka.
 *
 * Obrazy bywają domyślnie blokowane, więc logo ma `alt` z nazwą marki — przy
 * zablokowanych obrazkach wiadomość nadal przedstawia nadawcę.
 */
export function ramka(dane: Ramka): string {
  const akapity = dane.akapity
    .map(
      (tekst) =>
        `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:${INK}">${tekst}</p>`,
    )
    .join('');

  const przycisk = dane.przycisk
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0">
         <tr><td style="border-radius:11px;background:${ORANGE}">
           <a href="${escapeHtml(dane.przycisk.href)}"
              style="display:inline-block;padding:15px 28px;font-family:${FONT};font-size:16px;
                     font-weight:700;color:#FFFFFF;text-decoration:none">${escapeHtml(dane.przycisk.etykieta)}</a>
         </td></tr>
       </table>
       <!-- Przycisk bywa niedostępny: obrazy zablokowane, klient tekstowy, przekleja
            do innej przeglądarki. Adres w postaci jawnej jest tu ratunkiem. -->
       <p style="margin:0 0 6px;font-size:13px;color:${MUTED}">
         Gdyby przycisk nie działał, skopiuj ten adres do przeglądarki:
       </p>
       <p style="margin:0 0 20px;font-size:13px;line-height:1.5;word-break:break-all">
         <a href="${escapeHtml(dane.przycisk.href)}" style="color:${TEAL}">${escapeHtml(dane.przycisk.href)}</a>
       </p>`
    : '';

  const stopka = (dane.stopka ?? [])
    .map(
      (tekst) =>
        `<p style="margin:0 0 6px;font-size:13px;line-height:1.5;color:${MUTED}">${tekst}</p>`,
    )
    .join('');

  return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${GROUND};font-family:${FONT}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${GROUND}">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:560px;background:#FFFFFF;border:1px solid ${LINE};border-radius:18px">
        <tr><td style="padding:32px 32px 0">
          <img src="${escapeHtml(dane.adresStrony)}/kelbroo-logo.png" alt="kelbroo"
               width="150" style="display:block;border:0;height:auto">
        </td></tr>
        <tr><td style="padding:24px 32px 32px">
          <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:800;color:${INK}">
            ${escapeHtml(dane.naglowek)}
          </h1>
          ${akapity}
          ${przycisk}
          ${stopka}
        </td></tr>
      </table>
      <p style="margin:18px 0 0;font-size:12px;color:${MUTED}">
        kelbroo — self-service dining · <a href="${escapeHtml(dane.adresStrony)}" style="color:${MUTED}">kelbroo.com</a>
      </p>
    </td></tr>
  </table>
</body></html>`;
}

/** Wersja tekstowa. Nie ozdobnik: część klientów nigdy nie pokaże HTML-a. */
export function tekstem(dane: Ramka): string {
  const linie = [dane.naglowek, '', ...dane.akapity.map(bezZnacznikow), ''];
  if (dane.przycisk) {
    linie.push(`${dane.przycisk.etykieta}:`, dane.przycisk.href, '');
  }
  linie.push(...(dane.stopka ?? []).map(bezZnacznikow), '', 'kelbroo — self-service dining');
  return linie.join('\n');
}

const bezZnacznikow = (tekst: string): string =>
  tekst
    // Łamanie wiersza jest treścią, nie ozdobnikiem: bez tego adres nabywcy
    // skleja się w wersji tekstowej w jedną nieczytelną linię.
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
