import { dictionary } from '@kelbroo/i18n';
import { LandingPage } from '@/components/LandingPage';

export default function StronaGlowna() {
  return <LandingPage dict={dictionary('pl')} locale="pl" />;
}
