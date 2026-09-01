import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { dictionary } from '@kelbroo/i18n';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { pomocHtml } from '@/lib/dokumenty';
import { ARTYKULY, znajdzArtykul } from '@/lib/pomoc';

/** Wszystkie artykuły renderują się przy budowaniu — strona jest statyczna. */
export function generateStaticParams() {
  return ARTYKULY.map((artykul) => ({ slug: artykul.slug }));
}

/** Adres spoza spisu nie ma prawa zwrócić pustej strony ani błędu serwera. */
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const artykul = znajdzArtykul(slug);
  if (!artykul) return {};

  return { title: `${artykul.tytul} — pomoc kelbroo`, description: artykul.opis };
}

export default async function ArtykulPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const artykul = znajdzArtykul(slug);
  if (!artykul) notFound();

  return (
    <>
      <SiteHeader dict={dictionary('pl')} locale="pl" sciezka={`/pomoc/${slug}`} />

      <main className="section">
        {/* Węższa kolumna niż strona produktowa: to tekst do czytania, a nie
            do skanowania wzrokiem. */}
        <div className="wrap" style={{ maxWidth: '68ch' }}>
          <a
            href="/pomoc"
            className="mono"
            style={{ color: 'var(--muted)', fontSize: 'var(--fs-sm)', textDecoration: 'none' }}
          >
            ← Baza wiedzy
          </a>

          <article
            className="dokument"
            dangerouslySetInnerHTML={{ __html: await pomocHtml(slug) }}
          />
        </div>
      </main>

      <SiteFooter dict={dictionary('pl')} locale="pl" />
    </>
  );
}
