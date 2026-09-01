import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { dictionary, isLocale, LOCALE_TAGS, PREFIXED_LOCALES } from '@kelbroo/i18n';
import { Analytics } from '@/components/Analytics';
import { ThemeScript } from '@/components/ThemeScript';
import { alternatywy } from '@/lib/meta';
import '../../landing.css';

/**
 * Korzeń wersji obcojęzycznych: `/en`, `/de`, `/es`.
 *
 * Bliźniak `(pl)/layout.tsx` — ta sama treść `<head>`, inny `lang`. Rozdzielenie
 * bierze się stąd, że `<html>` żyje w korzeniu drzewa, a korzeń nie dostaje
 * parametrów trasy; Next dopuszcza kilka korzeni, o ile każdy siedzi we własnej
 * grupie tras.
 *
 * `generateStaticParams` wymienia **wyłącznie** języki z przedrostkiem —
 * `/pl/...` nigdy nie powstaje, bo polski stoi w korzeniu.
 */
export function generateStaticParams() {
  return PREFIXED_LOCALES.map((locale) => ({ locale }));
}

export const dynamicParams = false;

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dict = dictionary(locale);
  return {
    title: dict.meta.tytul,
    description: dict.meta.opis,
    metadataBase: new URL('https://kelbroo.com'),
    alternates: isLocale(locale) ? alternatywy(locale, '/') : undefined,
    openGraph: {
      title: dict.meta.tytul,
      description: dict.meta.ogOpis,
      url: `https://kelbroo.com/${locale}`,
      siteName: 'kelbroo',
      locale,
      type: 'website',
    },
  };
}

export default async function IntlLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === 'pl') notFound();

  return (
    <html lang={LOCALE_TAGS[locale]}>
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
        <Analytics />
      </body>
    </html>
  );
}
