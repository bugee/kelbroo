'use client';

import { useState } from 'react';
import {
  createItem,
  updateItem,
  uploadItemImage,
  type AdminItem,
  type AdminMenu,
  type AdminModifierGroup,
  type Translation,
} from '@/lib/api';
import { ItemImage } from './ItemImage';

interface Props {
  menu: AdminMenu;
  categoryId: string;
  item: AdminItem | null;
  /** Zdjęcia dań są funkcją planu — bez niej cała sekcja znika z formularza. */
  photosEnabled: boolean;
  onClose: () => void;
  onSaved: () => void;
  /**
   * Zdjęcie zapisanej pozycji idzie na serwer od razu, bez „Zapisz" — lista pod
   * spodem musi się o tym dowiedzieć, bo inaczej po „Anuluj" pokazuje stan
   * sprzed wgrania.
   */
  onItemChanged: () => void;
}

const emptyGroup = (locales: string[]): AdminModifierGroup => ({
  minSelect: 0,
  maxSelect: 1,
  isRequired: false,
  translations: locales.map((locale) => ({ locale, name: '' })),
  modifiers: [],
});

export function ItemEditor({
  menu,
  categoryId,
  item,
  photosEnabled,
  onClose,
  onSaved,
  onItemChanged,
}: Props) {
  const locales = menu.supportedLocales;

  const [translations, setTranslations] = useState<Translation[]>(
    locales.map((locale) => {
      const existing = item?.translations.find((t) => t.locale === locale);
      return { locale, name: existing?.name ?? '', description: existing?.description ?? '' };
    }),
  );
  const [priceZl, setPriceZl] = useState(item ? (item.priceCents / 100).toFixed(2) : '');
  const [vatPercent, setVatPercent] = useState(String(item?.vatPercent ?? 8));
  const [prepTime, setPrepTime] = useState(String(item?.prepTimeMinutes ?? ''));
  const [allergens, setAllergens] = useState((item?.allergens ?? []).join(', '));
  const [dietaryTags, setDietaryTags] = useState((item?.dietaryTags ?? []).join(', '));
  const [groups, setGroups] = useState<AdminModifierGroup[]>(item?.modifierGroups ?? []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * Zdjęcie wybrane dla **nowego** dania, które czeka na jego identyfikator.
   * Przy edycji zapisanej pozycji zostaje `null` — tam plik idzie na serwer
   * od razu po wybraniu.
   */
  const [zdjecieDoWgrania, setZdjecieDoWgrania] = useState<Blob | null>(null);
  /**
   * Identyfikator pozycji założonej w tym oknie.
   *
   * Potrzebny na jedną ścieżkę: danie zapisało się, a wgranie zdjęcia padło.
   * Bez tego drugie kliknięcie „Zapisz" założyłoby **drugie takie samo danie**
   * zamiast poprawić pierwsze.
   */
  const [utworzoneId, setUtworzoneId] = useState<string | null>(null);

  const setTranslation = (locale: string, field: 'name' | 'description', value: string) =>
    setTranslations((current) =>
      current.map((entry) => (entry.locale === locale ? { ...entry, [field]: value } : entry)),
    );

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      // Cena w groszach liczona z tekstu — nigdy nie wysyłamy liczby
      // zmiennoprzecinkowej, bo 32.10 * 100 potrafi dać 3209.999...
      const priceCents = Math.round(Number(priceZl.replace(',', '.')) * 100);
      if (!Number.isFinite(priceCents) || priceCents < 0) {
        throw new Error('Nieprawidłowa cena.');
      }

      const payload = {
        categoryId,
        priceCents,
        vatPercent: Number(vatPercent),
        prepTimeMinutes: prepTime ? Number(prepTime) : undefined,
        allergens: splitList(allergens),
        dietaryTags: splitList(dietaryTags),
        // Wysyłamy wyłącznie języki z wypełnioną nazwą; puste zostawiłyby
        // gościowi pustą pozycję zamiast fallbacku na język domyślny.
        translations: translations
          .filter((entry) => entry.name.trim().length > 0)
          .map((entry) => ({
            locale: entry.locale,
            name: entry.name.trim(),
            description: entry.description?.trim() || undefined,
          })),
        modifierGroups: groups,
      };

      let id = item?.id ?? utworzoneId;
      if (id) {
        await updateItem(id, payload);
      } else {
        id = (await createItem(payload)).id;
        setUtworzoneId(id);
      }

      if (zdjecieDoWgrania) {
        try {
          await uploadItemImage(id, zdjecieDoWgrania);
          setZdjecieDoWgrania(null);
        } catch (cause) {
          // Danie **jest** zapisane — mówimy to wprost, żeby nikt nie zaczynał
          // od nowa. Okno zostaje otwarte, a kolejny „Zapisz" ponowi wgranie.
          const powod = cause instanceof Error ? cause.message : 'nieznany błąd';
          throw new Error(`Danie zapisane, ale zdjęcia nie udało się wgrać: ${powod}`);
        }
      }

      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zapisać.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-[var(--radius-card)] bg-[var(--surface)] p-5">
        <h2 className="text-lg">{item ? 'Edycja dania' : 'Nowe danie'}</h2>

        {locales.map((locale) => {
          const entry = translations.find((t) => t.locale === locale);
          const isDefault = locale === menu.defaultLocale;
          return (
            <fieldset
              key={locale}
              className="mt-4 rounded-[var(--radius-control)] border border-[var(--line)] p-3"
            >
              <legend className="mono px-1 text-xs uppercase text-[var(--muted)]">
                {locale}
                {isDefault && <span className="text-[var(--orange)]"> · wymagany</span>}
              </legend>
              <input
                value={entry?.name ?? ''}
                onChange={(event) => setTranslation(locale, 'name', event.target.value)}
                placeholder="Nazwa dania"
                className="min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--line)] px-3"
              />
              <input
                value={entry?.description ?? ''}
                onChange={(event) => setTranslation(locale, 'description', event.target.value)}
                placeholder="Opis"
                className="mt-2 min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--line)] px-3"
              />
            </fieldset>
          );
        })}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label={`Cena (${menu.currency})`}>
            <input
              inputMode="decimal"
              value={priceZl}
              onChange={(event) => setPriceZl(event.target.value)}
              className="mono min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--line)] px-3"
            />
          </Field>
          <Field label="VAT %">
            <input
              inputMode="numeric"
              value={vatPercent}
              onChange={(event) => setVatPercent(event.target.value)}
              className="mono min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--line)] px-3"
            />
          </Field>
          <Field label="Czas (min)">
            <input
              inputMode="numeric"
              value={prepTime}
              onChange={(event) => setPrepTime(event.target.value)}
              className="mono min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--line)] px-3"
            />
          </Field>
          <Field label="Tagi diety">
            <input
              value={dietaryTags}
              onChange={(event) => setDietaryTags(event.target.value)}
              placeholder="vege, vegan"
              className="min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--line)] px-3"
            />
          </Field>
        </div>

        {/*
          Przy zapisanej pozycji zdjęcie leci osobnym żądaniem od razu po
          wybraniu pliku — nie czeka na „Zapisz". Przy nowym daniu nie ma jeszcze
          czego opisać zdjęciem, więc plik czeka w przeglądarce i wgrywamy go
          zaraz po utworzeniu pozycji (patrz `save`).
        */}
        {photosEnabled && (
          <Field label="Zdjęcie dania">
            <ItemImage
              itemId={item?.id ?? utworzoneId}
              imageUrl={item?.imageUrl ?? null}
              onPending={setZdjecieDoWgrania}
              onChanged={onItemChanged}
            />
          </Field>
        )}

        <Field label="Alergeny (po przecinku)">
          <input
            value={allergens}
            onChange={(event) => setAllergens(event.target.value)}
            placeholder="gluten, mleko"
            className="min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--line)] px-3"
          />
        </Field>

        <section className="mt-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Grupy modyfikatorów</h3>
            <button
              type="button"
              onClick={() => setGroups((current) => [...current, emptyGroup(locales)])}
              className="mono min-h-9 text-xs text-[var(--teal)]"
            >
              + grupa
            </button>
          </div>

          {groups.map((group, groupIndex) => (
            <div
              key={groupIndex}
              className="mt-2 rounded-[var(--radius-control)] border border-[var(--line)] p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                {locales.map((locale) => (
                  <input
                    key={locale}
                    value={group.translations.find((t) => t.locale === locale)?.name ?? ''}
                    onChange={(event) =>
                      setGroups((current) =>
                        current.map((g, i) =>
                          i === groupIndex
                            ? {
                                ...g,
                                translations: locales.map((code) => ({
                                  locale: code,
                                  name:
                                    code === locale
                                      ? event.target.value
                                      : (g.translations.find((t) => t.locale === code)?.name ?? ''),
                                })),
                              }
                            : g,
                        ),
                      )
                    }
                    placeholder={`Nazwa grupy (${locale})`}
                    className="min-h-11 flex-1 rounded-[var(--radius-control)] border border-[var(--line)] px-3 text-sm"
                  />
                ))}
                <button
                  type="button"
                  onClick={() => setGroups((current) => current.filter((_, i) => i !== groupIndex))}
                  className="mono min-h-11 px-2 text-xs text-[var(--muted)]"
                >
                  usuń
                </button>
              </div>

              <div className="mt-2 flex items-center gap-3 text-xs text-[var(--muted)]">
                <label className="flex items-center gap-1">
                  min
                  <input
                    inputMode="numeric"
                    value={group.minSelect}
                    onChange={(event) =>
                      setGroups((current) =>
                        current.map((g, i) =>
                          i === groupIndex ? { ...g, minSelect: Number(event.target.value) } : g,
                        ),
                      )
                    }
                    className="mono min-h-9 w-14 rounded border border-[var(--line)] px-2"
                  />
                </label>
                <label className="flex items-center gap-1">
                  max
                  <input
                    inputMode="numeric"
                    value={group.maxSelect}
                    onChange={(event) =>
                      setGroups((current) =>
                        current.map((g, i) =>
                          i === groupIndex ? { ...g, maxSelect: Number(event.target.value) } : g,
                        ),
                      )
                    }
                    className="mono min-h-9 w-14 rounded border border-[var(--line)] px-2"
                  />
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={group.isRequired ?? false}
                    onChange={(event) =>
                      setGroups((current) =>
                        current.map((g, i) =>
                          i === groupIndex ? { ...g, isRequired: event.target.checked } : g,
                        ),
                      )
                    }
                  />
                  wymagana
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setGroups((current) =>
                      current.map((g, i) =>
                        i === groupIndex
                          ? {
                              ...g,
                              modifiers: [
                                ...g.modifiers,
                                {
                                  priceDeltaCents: 0,
                                  translations: locales.map((locale) => ({ locale, name: '' })),
                                },
                              ],
                            }
                          : g,
                      ),
                    )
                  }
                  className="mono ml-auto text-xs text-[var(--teal)]"
                >
                  + opcja
                </button>
              </div>

              {group.modifiers.map((modifier, modifierIndex) => (
                <div key={modifierIndex} className="mt-2 flex flex-wrap items-center gap-2 pl-4">
                  {locales.map((locale) => (
                    <input
                      key={locale}
                      value={modifier.translations.find((t) => t.locale === locale)?.name ?? ''}
                      onChange={(event) =>
                        setGroups((current) =>
                          current.map((g, i) =>
                            i === groupIndex
                              ? {
                                  ...g,
                                  modifiers: g.modifiers.map((m, j) =>
                                    j === modifierIndex
                                      ? {
                                          ...m,
                                          translations: locales.map((code) => ({
                                            locale: code,
                                            name:
                                              code === locale
                                                ? event.target.value
                                                : (m.translations.find((t) => t.locale === code)
                                                    ?.name ?? ''),
                                          })),
                                        }
                                      : m,
                                  ),
                                }
                              : g,
                          ),
                        )
                      }
                      placeholder={`Opcja (${locale})`}
                      className="min-h-11 flex-1 rounded-[var(--radius-control)] border border-[var(--line)] px-3 text-sm"
                    />
                  ))}
                  <input
                    inputMode="numeric"
                    value={modifier.priceDeltaCents}
                    onChange={(event) =>
                      setGroups((current) =>
                        current.map((g, i) =>
                          i === groupIndex
                            ? {
                                ...g,
                                modifiers: g.modifiers.map((m, j) =>
                                  j === modifierIndex
                                    ? { ...m, priceDeltaCents: Number(event.target.value) }
                                    : m,
                                ),
                              }
                            : g,
                        ),
                      )
                    }
                    title="Dopłata w groszach"
                    className="mono min-h-11 w-24 rounded-[var(--radius-control)] border border-[var(--line)] px-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setGroups((current) =>
                        current.map((g, i) =>
                          i === groupIndex
                            ? { ...g, modifiers: g.modifiers.filter((_, j) => j !== modifierIndex) }
                            : g,
                        ),
                      )
                    }
                    className="mono min-h-11 px-2 text-xs text-[var(--muted)]"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ))}
        </section>

        {error && <p className="mt-4 text-sm text-[var(--orange)]">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 flex-1 rounded-[var(--radius-control)] border border-[var(--line)] font-semibold"
          >
            Anuluj
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="min-h-12 flex-[2] rounded-[var(--radius-control)] bg-[var(--orange)] font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Zapisuję…' : 'Zapisz'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-3 block">
      <span className="mono block text-xs uppercase text-[var(--muted)]">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

const splitList = (value: string) =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
