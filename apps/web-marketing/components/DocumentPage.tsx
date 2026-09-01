import { localePath, type Locale } from '@kelbroo/i18n';

/**
 * Ramka dla dokumentu prawnego: powrót i treść.
 *
 * Wersji nie wypisujemy tutaj — stoi w samym dokumencie, tuż pod tytułem, i to
 * on jest źródłem prawdy. Dwa miejsca oznaczałyby dwie wersje do rozjechania.
 *
 * Węższa kolumna niż strona produktowa — to tekst do czytania, nie do skanowania
 * wzrokiem, a 65 znaków w wierszu jest granicą, za którą oko gubi początek linii.
 */
export function DocumentPage({ html, locale }: { html: string; locale: Locale }) {
  return (
    <main className="section">
      <div className="wrap" style={{ maxWidth: '68ch' }}>
        <a
          href={localePath(locale, '/')}
          className="mono"
          style={{ color: 'var(--muted)', fontSize: 'var(--fs-sm)', textDecoration: 'none' }}
        >
          ← kelbroo
        </a>

        <article className="dokument" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </main>
  );
}
