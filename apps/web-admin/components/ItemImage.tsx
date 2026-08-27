'use client';

import { useRef, useState } from 'react';
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
 */
export function ItemImage({
  itemId,
  imageUrl,
  onChanged,
}: {
  itemId: string;
  imageUrl: string | null;
  /** Sygnał dla listy pod spodem — **nie** zamyka edytora. */
  onChanged?: () => void;
}) {
  const wejscie = useRef<HTMLInputElement>(null);
  // Podgląd trzymamy lokalnie: wgranie zdjęcia nie ma przeładowywać formularza,
  // w którym ktoś właśnie poprawia opis dania.
  const [aktualne, setAktualne] = useState(imageUrl);
  const [pracuje, setPracuje] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  const wybrano = async (plik: File | undefined) => {
    if (!plik) return;
    setPracuje(true);
    setBlad(null);
    try {
      const wynik = await uploadItemImage(itemId, await zmniejsz(plik));
      setAktualne(wynik.imageUrl);
      onChanged?.();
    } catch (przyczyna) {
      setBlad(przyczyna instanceof Error ? przyczyna.message : 'Nie udało się wgrać zdjęcia.');
    } finally {
      setPracuje(false);
      // Bez tego wybranie tego samego pliku drugi raz nie wywołałoby zdarzenia.
      if (wejscie.current) wejscie.current.value = '';
    }
  };

  const usun = async () => {
    setPracuje(true);
    setBlad(null);
    try {
      await removeItemImage(itemId);
      setAktualne(null);
      onChanged?.();
    } catch (przyczyna) {
      setBlad(przyczyna instanceof Error ? przyczyna.message : 'Nie udało się usunąć zdjęcia.');
    } finally {
      setPracuje(false);
    }
  };

  return (
    <div className="flex items-start gap-3">
      {aktualne ? (
        <img
          src={imageSrc(aktualne)}
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
          {pracuje ? 'Pracuję…' : aktualne ? 'Zmień zdjęcie' : 'Dodaj zdjęcie'}
        </button>

        {aktualne && (
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
