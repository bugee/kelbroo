/**
 * Podstawienie wartości w szablon: `wstaw('Co najmniej {min} znaków.', { min: 8 })`.
 *
 * Słownik trzyma **napisy, nie funkcje**, i to nie jest kwestia gustu: cały
 * słownik przechodzi przez granicę serwer→klient, a React odmawia serializacji
 * funkcji. Zamiast tego wstawiamy wartości w miejscu użycia.
 *
 * Nieznany znacznik zostaje w tekście — widać go wtedy na ekranie, zamiast
 * cicho zniknąć razem ze zdaniem, którego dotyczył.
 */
export function wstaw(szablon: string, wartosci: Record<string, string | number>): string {
  return szablon.replace(/\{(\w+)\}/g, (calosc, klucz: string) =>
    klucz in wartosci ? String(wartosci[klucz]) : calosc,
  );
}
