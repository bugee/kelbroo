import { Suspense } from 'react';
import type { Metadata } from 'next';
import { EmailConfirmation } from '@/components/EmailConfirmation';

export const metadata: Metadata = {
  title: 'Potwierdzenie adresu — kelbroo',
  robots: { index: false, follow: false },
};

export default function ConfirmPage() {
  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: '520px' }}>
        <a
          href="/"
          className="mono"
          style={{ color: 'var(--muted)', fontSize: 'var(--fs-sm)', textDecoration: 'none' }}
        >
          ← kelbroo
        </a>
        {/* `useSearchParams` wymaga granicy Suspense — bez niej budowanie pada. */}
        <Suspense fallback={<p className="mono mt-4 text-sm">Sprawdzam odnośnik…</p>}>
          <EmailConfirmation />
        </Suspense>
      </div>
    </main>
  );
}
