import type { Metadata } from 'next';
import { dictionary } from '@kelbroo/i18n';
import { SegmentyPage } from '@/components/SegmentyPage';
import { alternatywy } from '@/lib/meta';

const pl = dictionary('pl');

export const metadata: Metadata = {
  title: pl.strony.dlaKogo.tytul,
  description: pl.strony.dlaKogo.opis,
  alternates: alternatywy('pl', '/dla-kogo'),
};

export default function Segmenty() {
  return <SegmentyPage dict={pl} locale="pl" />;
}
