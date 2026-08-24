import type { Metadata } from 'next';
import { DocumentPage } from '@/components/DocumentPage';
import { dokumentHtml } from '@/lib/dokumenty';

export const metadata: Metadata = {
  title: 'Regulamin — kelbroo',
  description: 'Warunki świadczenia usługi kelbroo dla lokali gastronomicznych.',
};

export default async function TermsPage() {
  return <DocumentPage html={await dokumentHtml('regulamin')} />;
}
