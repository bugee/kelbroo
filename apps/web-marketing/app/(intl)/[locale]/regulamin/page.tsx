import type { Metadata } from 'next';
import { dictionary, isLocale, type Locale } from '@kelbroo/i18n';
import { DocumentPage } from '@/components/DocumentPage';
import { dokumentHtml } from '@/lib/dokumenty';
import { alternatywy } from '@/lib/meta';

const jezyk = (locale: string): Locale => (isLocale(locale) ? locale : 'pl');

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dict = dictionary(locale);
  return {
    title: dict.strony.regulamin.tytul,
    description: dict.strony.regulamin.opis,
    alternates: alternatywy(jezyk(locale), '/regulamin'),
  };
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <DocumentPage html={await dokumentHtml('regulamin', jezyk(locale))} locale={jezyk(locale)} />;
}
