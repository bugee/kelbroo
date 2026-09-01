import { dictionary, isLocale } from '@kelbroo/i18n';
import { LandingPage } from '@/components/LandingPage';

export default async function StronaGlownaJezyk({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <LandingPage dict={dictionary(locale)} locale={isLocale(locale) ? locale : 'pl'} />;
}
