import type { Metadata } from 'next';
import { RegistrationForm } from '@/components/RegistrationForm';

export const metadata: Metadata = {
  title: 'Załóż konto — kelbroo',
  description: '14 dni planu Pro bez opłat i bez podawania karty.',
  // Strona nie jest jeszcze podlinkowana i rejestracja jest zamknięta — nie ma
  // powodu, żeby wchodziła do wyników wyszukiwania przed otwarciem.
  robots: { index: false, follow: false },
};

export default function RegistrationPage() {
  return (
    <main className="section" style={{ minHeight: '100dvh' }}>
      <div className="wrap" style={{ maxWidth: '520px' }}>
        <a
          href="/"
          className="mono"
          style={{ color: 'var(--muted)', fontSize: 'var(--fs-sm)', textDecoration: 'none' }}
        >
          ← kelbroo
        </a>

        <h1 style={{ fontSize: 'var(--fs-h2)', fontWeight: 700, margin: '18px 0 10px' }}>
          Załóż konto
        </h1>
        <p className="lede" style={{ marginBottom: '28px' }}>
          14 dni planu Pro bez opłat i bez podawania karty. Konto zakładasz dla jednego lokalu —
          kolejne dodasz później.
        </p>

        <RegistrationForm />
      </div>
    </main>
  );
}
