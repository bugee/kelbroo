import type { Metadata } from 'next';
import { dictionary } from '@kelbroo/i18n';
import { DocumentPage } from '@/components/DocumentPage';
import { dokumentHtml } from '@/lib/dokumenty';
import { alternatywy } from '@/lib/meta';

const pl = dictionary('pl');

export const metadata: Metadata = {
  title: pl.strony.prywatnosc.tytul,
  description: pl.strony.prywatnosc.opis,
  alternates: alternatywy('pl', '/prywatnosc'),
};

export default async function PrivacyPage() {
  return <DocumentPage html={await dokumentHtml('polityka-prywatnosci', 'pl')} locale="pl" />;
}
