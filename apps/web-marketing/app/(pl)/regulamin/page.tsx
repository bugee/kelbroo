import type { Metadata } from 'next';
import { dictionary } from '@kelbroo/i18n';
import { DocumentPage } from '@/components/DocumentPage';
import { dokumentHtml } from '@/lib/dokumenty';
import { alternatywy } from '@/lib/meta';

const pl = dictionary('pl');

export const metadata: Metadata = {
  title: pl.strony.regulamin.tytul,
  description: pl.strony.regulamin.opis,
  alternates: alternatywy('pl', '/regulamin'),
};

export default async function TermsPage() {
  return <DocumentPage html={await dokumentHtml('regulamin', 'pl')} locale="pl" />;
}
