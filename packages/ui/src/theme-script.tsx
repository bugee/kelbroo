/**
 * Ustawia motyw zanim przeglądarka cokolwiek narysuje.
 *
 * Bez tego strona zapisana jako ciemna błyska najpierw na jasno — atrybut
 * pojawiłby się dopiero po hydratacji Reacta. Skrypt musi stać w <head>
 * i wykonać się synchronicznie, więc jest tu wstrzykiwany jako tekst.
 *
 * Moduł celowo nie jest komponentem klienckim: nie ma stanu i nie potrzebuje
 * hydratacji.
 */
export const THEME_STORAGE_KEY = 'kelbroo.theme';

export function ThemeScript() {
  const code = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
    THEME_STORAGE_KEY,
  )});if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})()`;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
