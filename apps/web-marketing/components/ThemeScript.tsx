/**
 * Ustawia paletę, zanim przeglądarka cokolwiek narysuje.
 *
 * Bez tego strona zapisana jako ciemna błyska najpierw na jasno: atrybut
 * pojawiłby się dopiero po hydratacji Reacta, czyli po pierwszym malowaniu.
 * Skrypt musi stać w `<head>` i wykonać się **synchronicznie**, więc jest
 * wstrzykiwany jako tekst, a nie ładowany osobnym żądaniem.
 *
 * Atrybut ustawiamy **wyłącznie wtedy, gdy wybór jest zapisany**. Brak wpisu
 * znaczy „jak w systemie" i wtedy paletę wybiera `prefers-color-scheme`
 * z arkusza — dopisanie tu `light` odcięłoby ciemny motyw wszystkim, którzy
 * nigdy nie dotknęli przełącznika.
 *
 * Moduł celowo nie jest komponentem klienckim: nie ma stanu i nie potrzebuje
 * hydratacji.
 */

/** Ten sam klucz co w panelu (`packages/ui`) — inny origin, ale jedna konwencja. */
export const KLUCZ_MOTYWU = 'kelbroo.theme';

export function ThemeScript() {
  const kod = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
    KLUCZ_MOTYWU,
  )});if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})()`;

  return <script dangerouslySetInnerHTML={{ __html: kod }} />;
}
