/**
 * Doba biznesowa restauracji.
 *
 * Numeracja zamówień i wizyt musi iść za zmianą, nie za kalendarzem: serwis
 * przechodzi przez północ, a zamówienie złożone o 00:30 należy do wieczoru,
 * który się jeszcze nie skończył. Przełom doby wyznacza
 * `Restaurant.businessDayStartHour` w strefie czasowej lokalu.
 */

/** Data w formacie YYYY-MM-DD — klucz numeracji, nie moment w czasie. */
export type BusinessDate = string;

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
}

function localParts(instant: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);

  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value;
    if (value === undefined) {
      throw new Error(`Nie udało się odczytać składowej "${type}" dla strefy ${timeZone}.`);
    }
    return Number(value);
  };

  return { year: read('year'), month: read('month'), day: read('day'), hour: read('hour') };
}

/**
 * Wyznacza dobę biznesową, do której należy dany moment.
 *
 * @param startHour godzina otwarcia doby w strefie lokalu (0-23); wszystko
 *                  wcześniejsze tego dnia liczy się do doby poprzedniej
 */
export function businessDateFor(instant: Date, timeZone: string, startHour: number): BusinessDate {
  if (!Number.isInteger(startHour) || startHour < 0 || startHour > 23) {
    throw new Error(`businessDayStartHour poza zakresem 0-23: ${startHour}`);
  }

  const { year, month, day, hour } = localParts(instant, timeZone);

  // Operujemy na samej dacie kalendarzowej, nigdy na momencie w czasie —
  // dzięki temu zmiana czasu letniego nie przesuwa doby biznesowej.
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (hour < startHour) {
    calendar.setUTCDate(calendar.getUTCDate() - 1);
  }

  return calendar.toISOString().slice(0, 10);
}

/** Data biznesowa jako `Date` o północy UTC — postać oczekiwana przez kolumnę DATE. */
export function toDateColumn(businessDate: BusinessDate): Date {
  return new Date(`${businessDate}T00:00:00.000Z`);
}
