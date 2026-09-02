'use client';

import { useEffect, useRef, useState } from 'react';
import { imageSrc, removeItemImage, uploadItemImage } from '@/lib/api';

/**
 * Najdłuższy bok zdjęcia po zmniejszeniu.
 *
 * Karta jest oglądana na telefonie, a zdjęcie zajmuje na niej pas szerokości
 * ekranu. 1400 px starcza na ekran o podwójnej gęstości i zostawia zapas na
 * powiększenie; 4000 px z aparatu telefonu byłoby kilkoma megabajtami, które
 * gość pobiera na komórkowym internecie w restauracji.
 */
const MAX_BOK = 1400;

/** Kompromis między wagą a wyglądem jedzenia. Niżej widać artefakty na sosach. */
const JAKOSC = 0.82;

/**
 * Zmniejsza zdjęcie w przeglądarce, zanim pójdzie na serwer.
 *
 * Robimy to tutaj, a nie na serwerze, świadomie: przeskalowanie po stronie API
 * wymagałoby biblioteki natywnej w obrazie Dockera, a zysk jest ten sam. Serwer
 * i tak sprawdza rozmiar oraz **rzeczywisty typ pliku po jego zawartości** —
 * przeglądarka przygotowuje plik, ale niczego nie autoryzuje.
 */
async function zmniejsz(plik: File): Promise<Blob> {
  const bitmapa = await createImageBitmap(plik);
  const skala = Math.min(1, MAX_BOK / Math.max(bitmapa.width, bitmapa.height));
  const szerokosc = Math.round(bitmapa.width * skala);
  const wysokosc = Math.round(bitmapa.height * skala);

  const plotno = document.createElement('canvas');
  plotno.width = szerokosc;
  plotno.height = wysokosc;
  const kontekst = plotno.getContext('2d');
  if (!kontekst) throw new Error('Przeglądarka nie pozwoliła przygotować zdjęcia.');
  kontekst.drawImage(bitmapa, 0, 0, szerokosc, wysokosc);
  bitmapa.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    plotno.toBlob(resolve, 'image/jpeg', JAKOSC),
  );
  if (!blob) throw new Error('Nie udało się przygotować zdjęcia.');
  return blob;
}

/**
 * Jedno zdjęcie dania.
 *
 * Jedno, nie galeria: gość przegląda kartę, żeby wybrać, a nie żeby oglądać
 * album. Wgranie nowego zastępuje poprzednie — nie ma czego „dodawać".
 *
 * **Dwa tryby, bo danie ma zdjęcie, zanim ma identyfikator.** Przy edycji
 * zapisanej pozycji plik idzie na serwer od razu po wybraniu: nie ma powodu,
 * żeby czekał na „Zapisz", a formularz nie musi trzymać megabajtów w pamięci.
 * Przy nowym daniu nie ma jeszcze czego opisać zdjęciem, więc plik czeka
 * w przeglądarce i wgrywa go edytor zaraz po utworzeniu pozycji.
 */
export function ItemImage({
  itemId,
  imageUrl,
  onChanged,
  onPending,
}: {
  /** `null` dla nowego dania — wtedy zdjęcie czeka na zapis. */
  itemId: string | null;
  imageUrl: string | null;
  /** Sygnał dla listy pod spodem — **nie** zamyka edytora. */
  onChanged?: () => void;
  /** Plik czekający na wgranie (albo `null`, gdy zdjęcie wycofano). */
  onPending?: (plik: Blob | null) => void;
}) {
  const wejscie = useRef<HTMLInputElement>(null);
  // Podgląd trzymamy lokalnie: wgranie zdjęcia nie ma przeładowywać formularza,
  // w którym ktoś właśnie poprawia opis dania.
  const [zapisane, setZapisane] = useState(imageUrl);
  // Adres `blob:` dla pliku, który jeszcze nie pojechał na serwer.
  const [lokalny, setLokalny] = useState<string | null>(null);
  const [pracuje, setPracuje] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  // Adresy `blob:` żyją do końca życia karty, dopóki się ich nie zwolni —
  // wybranie dziesięciu zdjęć po kolei zostawiłoby w pamięci dziesięć plików.
  useEffect(
    () => () => {
      if (lokalny) URL.revokeObjectURL(lokalny);
    },
    [lokalny],
  );

  const podglad = lokalny ?? (zapisane ? imageSrc(zapisane) : null);

  const wybrano = async (plik: File | undefined) => {
    if (!plik) return;
    setPracuje(true);
    setBlad(null);
    try {
      const zmniejszone = await zmniejsz(plik);

      if (itemId) {
        const wynik = await uploadItemImage(itemId, zmniejszone);
        setZapisane(wynik.imageUrl);
        setLokalny(null);
        onPending?.(null);
        onChanged?.();
      } else {
        setLokalny(URL.createObjectURL(zmniejszone));
        onPending?.(zmniejszone);
      }
    } catch (przyczyna) {
      setBlad(przyczyna instanceof Error ? przyczyna.message : 'Nie udało się wgrać zdjęcia.');
    } finally {
      setPracuje(false);
      // Bez tego wybranie tego samego pliku drugi raz nie wywołałoby zdarzenia.
      if (wejscie.current) wejscie.current.value = '';
    }
  };

  const usun = async () => {
    // Plik, który nigdzie nie pojechał, wystarczy odpiąć — kasowanie na serwerze
    // dotyczyłoby wtedy poprzedniego zdjęcia, a nie tego, które widać na ekranie.
    if (lokalny) {
      setLokalny(null);
      onPending?.(null);
      return;
    }
    if (!itemId || !zapisane) return;

    setPracuje(true);
    setBlad(null);
    try {
      await removeItemImage(itemId);
      setZapisane(null);
      onChanged?.();
    } catch (przyczyna) {
      setBlad(przyczyna instanceof Error ? przyczyna.message : 'Nie udało się usunąć zdjęcia.');
    } finally {
      setPracuje(false);
    }
  };

  return (
    <div className="flex items-start gap-3">
      {podglad ? (
        <img
          src={podglad}
          alt=""
          className="size-20 shrink-0 rounded-[var(--radius-control)] object-cover"
        />
      ) : (
        <div className="mono flex size-20 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-dashed border-[var(--line-strong)] text-[10px] text-[var(--muted)]">
          bez zdjęcia
        </div>
      )}

      <div className="flex flex-col items-start gap-1">
        <input
          ref={wejscie}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(zdarzenie) => void wybrano(zdarzenie.target.files?.[0])}
          className="hidden"
        />
        <button
          type="button"
          disabled={pracuje}
          onClick={() => wejscie.current?.click()}
          className="mono min-h-9 rounded-[var(--radius-control)] bg-[var(--teal-wash)] px-3 text-xs font-semibold text-[var(--teal)] disabled:opacity-50"
        >
          {pracuje ? 'Pracuję…' : podglad ? 'Zmień zdjęcie' : 'Dodaj zdjęcie'}
        </button>

        {podglad && (
          <button
            type="button"
            disabled={pracuje}
            onClick={() => void usun()}
            className="mono min-h-8 px-1 text-xs text-[var(--muted)] underline disabled:opacity-50"
          >
            Usuń zdjęcie
          </button>
        )}

        <p className="text-[10px] text-[var(--muted)]">
          Jedno zdjęcie na danie. Zmniejszymy je przed wysłaniem.
          {lokalny && ' Wgramy je razem z zapisem dania.'}
        </p>

        {blad && (
          <p role="alert" className="text-xs text-[var(--orange)]">
            {blad}
          </p>
        )}
      </div>
    </div>
  );
}
