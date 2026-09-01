import type { Metadata, Viewport } from 'next';
import { dictionary } from '@kelbroo/i18n';
import { Analytics } from '@/components/Analytics';
import { ThemeScript } from '@/components/ThemeScript';
import { alternatywy } from '@/lib/meta';
import '../landing.css';

/**
 * Korzeń polskiej wersji strony.
 *
 * Dwa korzenie zamiast jednego z parametrem `[locale]`, bo `<html lang>` musi
 * znać język, a układ w korzeniu drzewa nie dostaje parametrów trasy. Polski
 * siedzi w `(pl)` **bez przedrostka w adresie** — `kelbroo.com/regulamin` widnieje
 * w wysłanych wiadomościach i w zgodach, na które klienci już się zgodzili.
 */
const pl = dictionary('pl');

export const metadata: Metadata = {
  title: pl.meta.tytul,
  description: pl.meta.opis,
  metadataBase: new URL('https://kelbroo.com'),
  alternates: alternatywy('pl', '/'),
  openGraph: {
    title: pl.meta.tytul,
    description: pl.meta.ogOpis,
    url: 'https://kelbroo.com',
    siteName: 'kelbroo',
    locale: 'pl_PL',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Dwie wartości, nie jedna: pasek adresu przeglądarki na telefonie maluje się
  // tym kolorem i przy jednej wartości ciemna strona dostawała jasny pasek.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F1F5F4' },
    { media: '(prefers-color-scheme: dark)', color: '#0A1716' },
  ],
};

export default function PolishLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <head>
        {/* Przed pierwszym malowaniem — inaczej ciemna strona błyska na jasno. */}
        <ThemeScript />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        {children}
        {/* Analityka siedzi za zgodą i wyłącznie tutaj — patrz komponent. */}
        <Analytics />
      </body>
    </html>
  );
}
