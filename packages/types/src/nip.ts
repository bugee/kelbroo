/**
 * NIP — numer identyfikacji podatkowej.
 *
 * Usługa jest wyłącznie B2B (regulamin §2), a faktury VAT wymagają numeru, więc
 * zbieramy go przy zakładaniu konta. Sprawdzamy sumę kontrolną, nie samą długość:
 * literówka w NIP-ie wychodzi dopiero przy wystawianiu faktury, czyli miesiąc
 * później i po stronie księgowości.
 */

/** Wagi z rozporządzenia; ostatnia cyfra jest cyfrą kontrolną, więc nie ma wagi. */
const WAGI = [6, 5, 7, 2, 3, 4, 5, 6, 7] as const;

/** Zostawia same cyfry — ludzie wpisują NIP z myślnikami i spacjami. */
export function normalizeNip(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidNip(value: string): boolean {
  const cyfry = normalizeNip(value);
  if (cyfry.length !== 10) return false;

  // Same zera przechodzą sumę kontrolną, a nie są niczyim numerem.
  if (/^0+$/.test(cyfry)) return false;

  const suma = WAGI.reduce((acc, waga, i) => acc + waga * Number(cyfry[i]), 0);
  const kontrolna = suma % 11;

  // Reszta 10 nie daje się zapisać jedną cyfrą — takie numery nie są wydawane.
  if (kontrolna === 10) return false;
  return kontrolna === Number(cyfry[9]);
}

/** Zapis do pokazania: `522-226-93-66`. */
export function formatNip(value: string): string {
  const c = normalizeNip(value);
  if (c.length !== 10) return value;
  return `${c.slice(0, 3)}-${c.slice(3, 6)}-${c.slice(6, 8)}-${c.slice(8)}`;
}
