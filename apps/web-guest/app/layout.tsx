import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'kelbroo',
  description: 'Zamów przy stoliku ze swojego telefonu.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Gość skanuje kod i od razu czyta menu — pasek adresu ma zniknąć,
  // ale zoom zostaje dostępny (WCAG 2.1 AA).
  maximumScale: 5,
  // Interfejs jest jasny niezależnie od ustawienia systemu, więc pasek
  // przeglądarki też — inaczej rozjeżdża się z tłem strony.
  themeColor: '#F1F5F4',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
