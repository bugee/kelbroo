'use client';

import { useState } from 'react';
import { formatMoney, type CartLine, type Dish, type Modifier } from '@/lib/api';

interface Props {
  dish: Dish;
  onAdd: (line: CartLine) => void;
  onClose: () => void;
}

export function DishSheet({ dish, onAdd, onClose }: Props) {
  const [selected, setSelected] = useState<Modifier[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');

  const unit = dish.priceCents + selected.reduce((sum, m) => sum + m.priceDeltaCents, 0);

  const toggle = (group: { maxSelect: number }, modifier: Modifier) => {
    setSelected((current) => {
      const has = current.some((m) => m.id === modifier.id);
      if (has) return current.filter((m) => m.id !== modifier.id);
      // Wybór ponad limit grupy odrzucamy w UI, żeby gość nie dostał
      // błędu z serwera po kliknięciu „Dodaj".
      const inGroup = current.filter((m) =>
        dish.modifierGroups
          .find((g) => g.modifiers.some((x) => x.id === modifier.id))
          ?.modifiers.some((x) => x.id === m.id),
      );
      if (inGroup.length >= group.maxSelect) {
        return [...current.filter((m) => !inGroup.includes(m)), modifier];
      }
      return [...current, modifier];
    });
  };

  const missingRequired = dish.modifierGroups.some(
    (group) =>
      group.isRequired &&
      !group.modifiers.some((modifier) => selected.some((m) => m.id === modifier.id)),
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="max-h-[88dvh] overflow-y-auto rounded-t-[var(--radius-card)] bg-[var(--surface)] p-5 pb-8"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--line-strong)]" />

        <h2 className="text-xl">{dish.name}</h2>
        {dish.description && <p className="mt-1 text-sm text-[var(--muted)]">{dish.description}</p>}

        {dish.allergens.length > 0 && (
          <p className="mono mt-3 text-xs text-[var(--muted)]">
            Alergeny: {dish.allergens.join(', ')}
          </p>
        )}

        {dish.modifierGroups.map((group) => (
          <section key={group.id} className="mt-5">
            <h3 className="text-sm font-semibold">
              {group.name}
              {group.isRequired && <span className="text-[var(--orange)]"> *</span>}
              <span className="mono ml-2 text-xs font-normal text-[var(--muted)]">
                max {group.maxSelect}
              </span>
            </h3>
            <div className="mt-2 flex flex-col gap-2">
              {group.modifiers.map((modifier) => {
                const active = selected.some((m) => m.id === modifier.id);
                return (
                  <button
                    key={modifier.id}
                    type="button"
                    disabled={!modifier.isAvailable}
                    onClick={() => toggle(group, modifier)}
                    aria-pressed={active}
                    className={`flex min-h-12 items-center justify-between rounded-[var(--radius-control)] border px-4 text-left disabled:opacity-40 ${
                      active
                        ? 'border-[var(--teal)] bg-[var(--teal-wash)]'
                        : 'border-[var(--line)] bg-[var(--surface)]'
                    }`}
                  >
                    <span>{modifier.name}</span>
                    <span className="mono text-sm">
                      +{formatMoney(modifier.priceDeltaCents, dish.currency)}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        <label className="mt-5 block">
          <span className="text-sm font-semibold">Uwagi do dania</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={200}
            placeholder="np. bez cebuli"
            className="mt-2 min-h-12 w-full rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] px-4"
          />
        </label>

        <div className="mt-5 flex items-center gap-4">
          <div className="flex items-center gap-1 rounded-[var(--radius-control)] border border-[var(--line)]">
            <button
              type="button"
              aria-label="Mniej"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="mono h-12 w-12 text-lg"
            >
              −
            </button>
            <span className="mono w-8 text-center">{quantity}</span>
            <button
              type="button"
              aria-label="Więcej"
              onClick={() => setQuantity((q) => Math.min(99, q + 1))}
              className="mono h-12 w-12 text-lg"
            >
              +
            </button>
          </div>

          <button
            type="button"
            disabled={missingRequired}
            onClick={() => onAdd({ dish, quantity, modifiers: selected, note })}
            className="flex min-h-12 flex-1 items-center justify-between rounded-[var(--radius-control)] bg-[var(--orange)] px-4 font-semibold text-white disabled:opacity-40"
          >
            <span>Dodaj</span>
            <span className="mono">{formatMoney(unit * quantity, dish.currency)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
