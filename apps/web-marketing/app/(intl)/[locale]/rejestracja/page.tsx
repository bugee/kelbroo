import type { Metadata } from 'next';
import { dictionary, isLocale, type Locale } from '@kelbroo/i18n';
import { RegistrationPage } from '@/components/RegistrationPage';

const jezyk = (locale: string): Locale => (isLocale(locale) ? locale : 'pl');

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const dict = dictionary((await params).locale);
  return {
    title: dict.strony.rejestracja.tytul,
    description: dict.strony.rejestracja.opis,
    robots: { index: false, follow: false },
  };
}

export default async function Rejestracja({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <RegistrationPage dict={dictionary(locale)} locale={jezyk(locale)} />;
}
