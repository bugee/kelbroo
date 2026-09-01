import { Suspense } from 'react';
import { localePath, type Dictionary, type Locale } from '@kelbroo/i18n';
import { EmailConfirmation } from '@/components/EmailConfirmation';

export function ConfirmationPage({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: '520px' }}>
        <a
          href={localePath(locale, '/')}
          className="mono"
          style={{ color: 'var(--muted)', fontSize: 'var(--fs-sm)', textDecoration: 'none' }}
        >
          ← kelbroo
        </a>
        {/* `useSearchParams` wymaga granicy Suspense — bez niej budowanie pada. */}
        <Suspense fallback={<p className="mono mt-4 text-sm">{dict.potwierdzenie.sprawdzam}</p>}>
          <EmailConfirmation dict={dict} />
        </Suspense>
      </div>
    </main>
  );
}
