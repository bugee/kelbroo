import { localePath, type Dictionary, type Locale } from '@kelbroo/i18n';
import { RegistrationForm } from '@/components/RegistrationForm';

export function RegistrationPage({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  return (
    <main className="section" style={{ minHeight: '100dvh' }}>
      <div className="wrap" style={{ maxWidth: '520px' }}>
        <a
          href={localePath(locale, '/')}
          className="mono"
          style={{ color: 'var(--muted)', fontSize: 'var(--fs-sm)', textDecoration: 'none' }}
        >
          ← kelbroo
        </a>

        <h1 style={{ fontSize: 'var(--fs-h2)', fontWeight: 700, margin: '18px 0 10px' }}>
          {dict.rejestracjaStrona.naglowek}
        </h1>
        <p className="lede" style={{ marginBottom: '28px' }}>
          {dict.rejestracjaStrona.lede}
        </p>

        <RegistrationForm dict={dict} locale={locale} />
      </div>
    </main>
  );
}
