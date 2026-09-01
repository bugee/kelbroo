import type { Metadata } from 'next';
import { dictionary } from '@kelbroo/i18n';
import { RegistrationPage } from '@/components/RegistrationPage';

const pl = dictionary('pl');

export const metadata: Metadata = {
  title: pl.strony.rejestracja.tytul,
  description: pl.strony.rejestracja.opis,
  // Strona nie jest jeszcze podlinkowana i rejestracja jest zamknięta — nie ma
  // powodu, żeby wchodziła do wyników wyszukiwania przed otwarciem.
  robots: { index: false, follow: false },
};

export default function Rejestracja() {
  return <RegistrationPage dict={pl} locale="pl" />;
}
