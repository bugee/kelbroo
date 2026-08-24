import type { Metadata } from 'next';
import { DocumentPage } from '@/components/DocumentPage';
import { dokumentHtml } from '@/lib/dokumenty';

export const metadata: Metadata = {
  title: 'Polityka prywatności — kelbroo',
  description: 'Jakie dane przetwarza kelbroo, w jakiej roli i jak długo.',
};

export default async function PrivacyPage() {
  return <DocumentPage html={await dokumentHtml('polityka-prywatnosci')} />;
}
