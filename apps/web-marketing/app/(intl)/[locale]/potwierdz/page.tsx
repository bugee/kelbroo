import type { Metadata } from 'next';
import { dictionary, isLocale, type Locale } from '@kelbroo/i18n';
import { ConfirmationPage } from '@/components/ConfirmationPage';

const jezyk = (locale: string): Locale => (isLocale(locale) ? locale : 'pl');

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return {
    title: dictionary((await params).locale).strony.potwierdz.tytul,
    robots: { index: false, follow: false },
  };
}

export default async function Potwierdzenie({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <ConfirmationPage dict={dictionary(locale)} locale={jezyk(locale)} />;
}
