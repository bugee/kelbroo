import type { Metadata } from 'next';
import { dictionary } from '@kelbroo/i18n';
import { ConfirmationPage } from '@/components/ConfirmationPage';

const pl = dictionary('pl');

export const metadata: Metadata = {
  title: pl.strony.potwierdz.tytul,
  robots: { index: false, follow: false },
};

export default function Potwierdzenie() {
  return <ConfirmationPage dict={pl} locale="pl" />;
}
