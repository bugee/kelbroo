/**
 * Pasek nawigacji, wspólny dla strony głównej i podstron.
 *
 * Kotwice są zapisane od korzenia (`/#cennik`, a nie `#cennik`) — z podstrony
 * samo `#cennik` szukałoby sekcji, której tam nie ma, i nie robiłoby nic.
 */
export function SiteHeader() {
  return (
    <header className="nav" id="nav">
      <div className="wrap nav-in">
        <a className="brand" href="/#top" aria-label="kelbroo — strona główna">
          <svg viewBox="0 0 120 180" fill="none" aria-hidden="true">
            <defs>
              <linearGradient
                id="lg-t"
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
                id="lg-o"
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
              stroke="url(#lg-t)"
              strokeWidth="9"
            />
            <path d="M48 12h24v5a5 5 0 0 1-5 5H53a5 5 0 0 1-5-5z" fill="url(#lg-t)" />
            <circle cx="60" cy="45" r="4.5" fill="url(#lg-o)" />
            <path d="M31 80a29 29 0 0 1 58 0z" fill="url(#lg-o)" />
            <rect x="24" y="84" width="72" height="9" rx="4.5" fill="url(#lg-o)" />
            <path
              d="M34 128c0-19 16-24 33-24"
              stroke="url(#lg-t)"
              strokeWidth="9"
              strokeLinecap="round"
            />
            <path d="M62 116l6-18 14 12z" fill="url(#lg-t)" />
            <rect
              x="23"
              y="130"
              width="23"
              height="23"
              rx="4"
              stroke="url(#lg-t)"
              strokeWidth="6"
            />
            <rect x="31" y="138" width="7" height="7" rx="1.5" fill="url(#lg-t)" />
            <g fill="url(#lg-t)">
              <rect x="72" y="130" width="6" height="6" rx="1" />
              <rect x="82" y="130" width="6" height="6" rx="1" />
              <rect x="92" y="134" width="6" height="6" rx="1" />
              <rect x="72" y="140" width="6" height="6" rx="1" />
              <rect x="86" y="142" width="6" height="6" rx="1" />
              <rect x="76" y="148" width="6" height="6" rx="1" />
              <rect x="90" y="152" width="6" height="6" rx="1" />
            </g>
          </svg>
          <span>kelbroo</span>
        </a>
        <nav className="nav-links">
          <a href="/#jak">Jak to działa</a>
          <a href="/#modele">Płatności</a>
          <a href="/#funkcje">Funkcje</a>
          <a href="/#cennik">Cennik</a>
          <a href="/#faq">FAQ</a>
        </nav>
        <div className="nav-cta">
          <a className="btn btn-ghost btn-sm" href="https://panel.kelbroo.com">
            Zaloguj się
          </a>
          <a className="btn btn-primary btn-sm" href="/rejestracja">
            Wypróbuj 14 dni
          </a>
        </div>
      </div>
    </header>
  );
}
