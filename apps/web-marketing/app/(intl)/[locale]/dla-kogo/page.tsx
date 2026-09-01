import type { Metadata } from 'next';
import { dictionary, isLocale, type Locale } from '@kelbroo/i18n';
import { SegmentyPage } from '@/components/SegmentyPage';
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
    title: dict.strony.dlaKogo.tytul,
    description: dict.strony.dlaKogo.opis,
    alternates: alternatywy(jezyk(locale), '/dla-kogo'),
  };
}

export default async function Segmenty({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <SegmentyPage dict={dictionary(locale)} locale={jezyk(locale)} />;
}
