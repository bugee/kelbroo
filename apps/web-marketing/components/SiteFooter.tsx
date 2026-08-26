/**
 * Stopka, wspólna dla strony głównej i podstron.
 *
 * Odnośniki segmentowe prowadzą do kotwic jednej strony `/dla-kogo`, a nie do
 * pięciu osobnych podstron. Jedna strona z sekcjami jest tańsza w utrzymaniu
 * i nie rozprasza treści; ceną jest słabsze pozycjonowanie pod pojedyncze
 * hasła w wyszukiwarce.
 */
export function SiteFooter() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <a className="brand" href="/#top">
              <svg viewBox="0 0 120 180" fill="none" aria-hidden="true">
                <defs>
                  <linearGradient
                    id="lg-t2"
                    x1="10"
                    y1="10"
                    x2="110"
                    y2="170"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#5FC9BE" />
                    <stop offset="1" stopColor="#2A8F8C" />
                  </linearGradient>
                  <linearGradient
                    id="lg-o2"
                    x1="26"
                    y1="44"
                    x2="96"
                    y2="94"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#F7A85C" />
                    <stop offset="1" stopColor="#E8722F" />
                  </linearGradient>
                </defs>
                <rect
                  x="10"
                  y="10"
                  width="100"
                  height="160"
                  rx="23"
                  stroke="url(#lg-t2)"
                  strokeWidth="9"
                />
                <path d="M48 12h24v5a5 5 0 0 1-5 5H53a5 5 0 0 1-5-5z" fill="url(#lg-t2)" />
                <circle cx="60" cy="45" r="4.5" fill="url(#lg-o2)" />
                <path d="M31 80a29 29 0 0 1 58 0z" fill="url(#lg-o2)" />
                <rect x="24" y="84" width="72" height="9" rx="4.5" fill="url(#lg-o2)" />
                <path
                  d="M34 128c0-19 16-24 33-24"
                  stroke="url(#lg-t2)"
                  strokeWidth="9"
                  strokeLinecap="round"
                />
                <path d="M62 116l6-18 14 12z" fill="url(#lg-t2)" />
                <rect
                  x="23"
                  y="130"
                  width="23"
                  height="23"
                  rx="4"
                  stroke="url(#lg-t2)"
                  strokeWidth="6"
                />
                <rect x="31" y="138" width="7" height="7" rx="1.5" fill="url(#lg-t2)" />
              </svg>
              <span>kelbroo</span>
            </a>
            <p>Zamawianie przy stoliku dla restauracji, kawiarni i barów w Polsce.</p>
          </div>
          <div>
            <h4>Produkt</h4>
            <ul>
              <li>
                <a href="/#jak">Jak to działa</a>
              </li>
              <li>
                <a href="/#modele">Modele płatności</a>
              </li>
              <li>
                <a href="/#funkcje">Funkcje</a>
              </li>
              <li>
                <a href="/#cennik">Cennik</a>
              </li>
              <li>
                <a href="/#demo">Demo menu</a>
              </li>
            </ul>
          </div>
          <div>
            <h4>Dla kogo</h4>
            <ul>
              <li>
                <a href="/dla-kogo#restauracje">Restauracje</a>
              </li>
              <li>
                <a href="/dla-kogo#kawiarnie">Kawiarnie</a>
              </li>
              <li>
                <a href="/dla-kogo#bary">Bary i puby</a>
              </li>
              <li>
                <a href="/dla-kogo#hotele">Hotele</a>
              </li>
              <li>
                <a href="/dla-kogo#sieci">Sieci i food courty</a>
              </li>
            </ul>
          </div>
          <div>
            <h4>Pomoc</h4>
            <ul>
              <li>
                <a href="/pomoc">Baza wiedzy</a>
              </li>
              <li>
                <a href="/#kontakt">Kontakt</a>
              </li>
              <li>
                <a href="/regulamin">Regulamin</a>
              </li>
              <li>
                <a href="/prywatnosc">Prywatność</a>
              </li>
              {/*
                Obowiązek informacyjny RODO wypełnia polityka prywatności — §1
                opisuje role, §8 prawa i drogę zgłaszania żądań. Osobny dokument
                powtarzałby to samo i rozjechałby się przy pierwszej zmianie.
              */}
              <li>
                <a href="/prywatnosc#par-8">RODO</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="foot-base">
          <span>© 2026 kelbroo</span>
          <span>Self-service dining · Made in Poland</span>
        </div>
      </div>
    </footer>
  );
}
