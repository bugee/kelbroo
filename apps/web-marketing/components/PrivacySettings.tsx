'use client';

import { ZDARZENIE_USTAWIENIA } from './Analytics';

/**
 * Odnośnik do zmiany decyzji o analityce.
 *
 * Istnieje, bo **zgodę trzeba dać się wycofać równie łatwo, jak się ją dało**.
 * Baner znika po pierwszej decyzji i bez tego odnośnika nie byłoby jak wrócić.
 */
export function PrivacySettings() {
  return (
    <button
      type="button"
      className="foot-link-button"
      onClick={() => window.dispatchEvent(new Event(ZDARZENIE_USTAWIENIA))}
    >
      Statystyki i zgoda
    </button>
  );
}
