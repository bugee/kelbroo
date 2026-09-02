'use client';

import { useCallback, useEffect, useState } from 'react';
import { StaffShell } from '@/components/StaffShell';
import { ItemEditor } from '@/components/ItemEditor';
import {
  archiveCategory,
  archiveItem,
  createCategory,
  fetchAdminMenu,
  fetchSubscription,
  imageSrc,
  money,
  setItemAvailability,
  type AdminCategory,
  type AdminItem,
  type AdminMenu,
  type SubscriptionState,
} from '@/lib/api';

export default function MenuPage() {
  return <StaffShell>{() => <MenuEditor />}</StaffShell>;
}

const nameIn = (translations: { locale: string; name: string }[], locale: string) =>
  translations.find((t) => t.locale === locale)?.name ?? translations[0]?.name ?? '—';

function MenuEditor() {
  const [menu, setMenu] = useState<AdminMenu | null>(null);
  // Zdjęcia dań są funkcją planu. Pytamy o abonament raz przy wejściu na ekran —
  // plan nie zmienia się w trakcie edytowania karty.
  const [abonament, setAbonament] = useState<SubscriptionState | null>(null);
  const photosEnabled = abonament?.menuPhotosEnabled ?? false;
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{
    category: AdminCategory;
    item: AdminItem | null;
  } | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setMenu(await fetchAdminMenu());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się wczytać menu.');
    }
  }, []);

  useEffect(() => {
    void refresh();
    fetchSubscription()
      .then(setAbonament)
      // Brak odpowiedzi o abonamencie nie ma blokować edycji karty — sekcja
      // zdjęć po prostu się nie pokaże.
      .catch(() => setAbonament(null));
  }, [refresh]);

  const run = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Operacja się nie powiodła.');
    }
  };

  if (error && !menu) return <p className="text-[var(--orange)]">{error}</p>;
  if (!menu) return <p className="mono text-sm text-[var(--muted)]">Wczytuję…</p>;

  const locale = menu.defaultLocale;
  // Wycofane pozycje zostają w bazie dla historycznych rachunków, ale nie ma ich
  // w karcie — i nie zajmują miejsca w planie.
  const pozycjiWKarcie = menu.categories.reduce(
    (suma, kategoria) => suma + kategoria.items.filter((item) => !item.isArchived).length,
    0,
  );

  return (
    <>
      {error && <p className="mb-3 text-[var(--orange)]">{error}</p>}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() =>
            void run(async () => {
              const name = window.prompt('Nazwa kategorii (język domyślny):');
              if (!name) return;
              // Komplet tłumaczeń jest wymagany, więc na start powielamy nazwę —
              // manager podmieni ją przy edycji, ale karta nie zostanie pusta.
              await createCategory(menu.supportedLocales.map((code) => ({ locale: code, name })));
            })
          }
          className="min-h-11 rounded-[var(--radius-control)] bg-[var(--teal)] px-4 text-sm font-semibold text-white"
        >
          Nowa kategoria
        </button>

        <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
          />
          Pokaż wycofane
        </label>

        <span className="mono ml-auto text-xs text-[var(--muted)]">
          {pozycjiWKarcie} z{' '}
          {abonament?.menuItemLimit && abonament.menuItemLimit < 9999
            ? `${abonament.menuItemLimit} w planie`
            : 'bez limitu'}{' '}
          · języki: {menu.supportedLocales.join(', ')} · domyślny {menu.defaultLocale}
        </span>
      </div>

      {menu.categories
        .filter((category) => showArchived || !category.isArchived)
        .map((category) => (
          <section key={category.id} className="mb-6">
            <header className="flex items-center gap-3 border-b border-[var(--line)] pb-2">
              <h2 className="text-base">
                {nameIn(category.translations, locale)}
                {category.isArchived && (
                  <span className="mono ml-2 text-xs text-[var(--muted)]">wycofana</span>
                )}
              </h2>

              <button
                type="button"
                onClick={() => setEditing({ category, item: null })}
                className="mono ml-auto min-h-9 px-2 text-xs text-[var(--teal)]"
              >
                + danie
              </button>
              <button
                type="button"
                onClick={() => void run(() => archiveCategory(category.id, !category.isArchived))}
                className="mono min-h-9 px-2 text-xs text-[var(--muted)]"
              >
                {category.isArchived ? 'przywróć' : 'wycofaj'}
              </button>
            </header>

            <ul className="divide-y divide-[var(--line)]">
              {category.items
                .filter((item) => showArchived || !item.isArchived)
                .map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-3 py-2">
                    {/* Miniatura tylko tam, gdzie zdjęcia w ogóle działają.
                        Bez niej z listy nie widać, którym daniom go jeszcze
                        brakuje — a to pierwsze pytanie po wgraniu kilku. */}
                    {photosEnabled && (
                      <span
                        aria-hidden="true"
                        className="hidden shrink-0 sm:block"
                        title={item.imageUrl ? undefined : 'Bez zdjęcia'}
                      >
                        {item.imageUrl ? (
                          <img
                            src={imageSrc(item.imageUrl)}
                            alt=""
                            className="size-9 rounded-[var(--radius-control)] object-cover"
                          />
                        ) : (
                          <span className="block size-9 rounded-[var(--radius-control)] border border-dashed border-[var(--line-strong)]" />
                        )}
                      </span>
                    )}

                    <span className="min-w-0 flex-1">
                      <span className={item.isArchived ? 'line-through opacity-60' : ''}>
                        {nameIn(item.translations, locale)}
                      </span>
                      <span className="mono ml-2 text-xs text-[var(--muted)]">
                        VAT {item.vatPercent}%
                        {item.translations.length < menu.supportedLocales.length && (
                          <span className="text-[var(--orange)]"> · brak tłumaczeń</span>
                        )}
                      </span>
                    </span>

                    <span className="mono w-24 text-right font-semibold">
                      {money(item.priceCents, menu.currency)}
                    </span>

                    {/* Wyłączanie dostępności to czynność w trakcie serwisu —
                        musi być jednym kliknięciem, bez wchodzenia w edycję. */}
                    <button
                      type="button"
                      onClick={() =>
                        void run(() => setItemAvailability(item.id, !item.isAvailable))
                      }
                      className={`mono min-h-11 w-28 rounded-[var(--radius-control)] text-xs font-semibold ${
                        item.isAvailable
                          ? 'bg-[var(--teal-wash)] text-[var(--teal)]'
                          : 'bg-[var(--orange-wash)] text-[var(--orange)]'
                      }`}
                    >
                      {item.isAvailable ? 'dostępne' : 'niedostępne'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditing({ category, item })}
                      className="mono min-h-11 px-2 text-xs text-[var(--teal)]"
                    >
                      edytuj
                    </button>
                    <button
                      type="button"
                      onClick={() => void run(() => archiveItem(item.id, !item.isArchived))}
                      className="mono min-h-11 px-2 text-xs text-[var(--muted)]"
                    >
                      {item.isArchived ? 'przywróć' : 'wycofaj'}
                    </button>
                  </li>
                ))}

              {category.items.length === 0 && (
                <li className="py-4 text-sm text-[var(--muted)]">Brak pozycji w tej kategorii.</li>
              )}
            </ul>
          </section>
        ))}

      {editing && (
        <ItemEditor
          menu={menu}
          categoryId={editing.category.id}
          item={editing.item}
          photosEnabled={photosEnabled}
          onClose={() => setEditing(null)}
          onItemChanged={() => void refresh()}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      )}
    </>
  );
}
