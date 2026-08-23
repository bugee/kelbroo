import type { Metadata, Viewport } from 'next';
import './landing.css';

export const metadata: Metadata = {
  title: 'kelbroo — self-service dining',
  description:
    'Goście zamawiają z telefonu po zeskanowaniu kodu QR przy stoliku. Zamówienie trafia prosto do kuchni i do kelnera. Stały abonament, bez prowizji od zamówień.',
  metadataBase: new URL('https://kelbroo.com'),
  openGraph: {
    title: 'kelbroo — self-service dining',
    description:
      'Goście zamawiają z telefonu po zeskanowaniu kodu QR przy stoliku. Bez prowizji od zamówień.',
    url: 'https://kelbroo.com',
    siteName: 'kelbroo',
    locale: 'pl_PL',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
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
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
