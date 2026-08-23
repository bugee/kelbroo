/**
 * Znak rozpoznawczy gościa przy stoliku: prosty kształt w wyraźnym kolorze.
 *
 * Ma jedno zadanie — dać się **wypowiedzieć**. Gość mówi kelnerowi „czerwona
 * gwiazdka", a nie odczytuje identyfikator. Stąd zamknięty zestaw kształtów,
 * które każdy nazwie tak samo, i kolory, których nie da się pomylić.
 *
 * Zestaw jest współdzielony celowo: API losuje, panel i aplikacja gościa rysują.
 * Trzy kopie tej listy rozjechałyby się przy pierwszym dodaniu kształtu.
 */

export const PARTICIPANT_SYMBOLS = [
  'star',
  'heart',
  'square',
  'triangle',
  'circle',
  'house',
  'arrow',
  'car',
  'diamond',
  'bolt',
] as const;

export type ParticipantSymbol = (typeof PARTICIPANT_SYMBOLS)[number];

/** Nazwy, którymi gość i kelner posłużą się na głos. */
export const SYMBOL_LABEL: Record<ParticipantSymbol, string> = {
  star: 'gwiazdka',
  heart: 'serce',
  square: 'kwadrat',
  triangle: 'trójkąt',
  circle: 'koło',
  house: 'domek',
  arrow: 'strzałka',
  car: 'samochodzik',
  diamond: 'romb',
  bolt: 'błyskawica',
};

/**
 * Kolory dobrane pod wypowiadanie, nie pod paletę marki.
 *
 * Barwy marki (trzy odcienie teal) nie nadają się: gość nie odróżni ich od
 * siebie ani nie nazwie. Te są rozstrzelone po kole barw i mają jednoznaczne
 * polskie nazwy.
 */
export const PARTICIPANT_COLORS = [
  'red',
  'blue',
  'green',
  'yellow',
  'purple',
  'orange',
  'brown',
  'black',
] as const;

export type ParticipantColor = (typeof PARTICIPANT_COLORS)[number];

export const COLOR_LABEL: Record<ParticipantColor, string> = {
  red: 'czerwony',
  blue: 'niebieski',
  green: 'zielony',
  yellow: 'żółty',
  purple: 'fioletowy',
  orange: 'pomarańczowy',
  brown: 'brązowy',
  black: 'czarny',
};

/** Odcienie czytelne na jasnym i ciemnym tle — ikona bywa mała. */
export const COLOR_HEX: Record<ParticipantColor, string> = {
  red: '#D92D20',
  blue: '#1D6FD9',
  green: '#1F9254',
  yellow: '#E0A500',
  purple: '#8A3FC0',
  orange: '#E8722F',
  brown: '#8A5A2B',
  black: '#1A1A1A',
};

export function isParticipantSymbol(value: string): value is ParticipantSymbol {
  return (PARTICIPANT_SYMBOLS as readonly string[]).includes(value);
}

export function isParticipantColor(value: string): value is ParticipantColor {
  return (PARTICIPANT_COLORS as readonly string[]).includes(value);
}

/**
 * To, co gość mówi kelnerowi. Kolejność jak w polszczyźnie mówionej:
 * przymiotnik odmieniony do rodzaju kształtu.
 */
export function describeIdentity(symbol: string, color: string): string {
  if (!isParticipantSymbol(symbol) || !isParticipantColor(color)) return '';
  return `${adjective(color, GENDER[symbol])} ${SYMBOL_LABEL[symbol]}`;
}

type Gender = 'm' | 'f' | 'n';

const GENDER: Record<ParticipantSymbol, Gender> = {
  star: 'f',
  heart: 'n',
  square: 'm',
  triangle: 'm',
  circle: 'n',
  house: 'm',
  arrow: 'f',
  car: 'm',
  diamond: 'm',
  bolt: 'f',
};

/**
 * Polski wymaga zgodności rodzaju — „czerwona gwiazdka", ale „czerwony kwadrat".
 *
 * Przymiotniki twardotematowe kończą się na `-y` i mają rodzaj nijaki na `-e`
 * (czerwony → czerwone). Miękkotematowe kończą się na `-i` i biorą `-ie`
 * (niebieski → niebieskie, nie „niebieske"). Rodzaj żeński jest w obu wypadkach `-a`.
 */
function adjective(color: ParticipantColor, gender: Gender): string {
  const base = COLOR_LABEL[color];
  if (gender === 'm') return base;

  const stem = base.slice(0, -1);
  if (gender === 'f') return `${stem}a`;
  return base.endsWith('i') ? `${stem}ie` : `${stem}e`;
}

/**
 * Kształty w układzie 24×24, wyśrodkowane.
 *
 * Leżą obok listy symboli, a nie przy komponencie, z jednego powodu: symbol bez
 * kształtu to symbol niewidoczny, a rozdzielone listy nie dawały tego wykryć.
 * Tak właśnie zniknął półksiężyc — miał wpis w zestawie i ścieżkę, której łuk
 * powrotny był zbyt mały, żeby pokryć własną cięciwę. Przeglądarka skalowała mu
 * promień, obie połówki się pokrywały i figura miała zerowe pole. Gość dostawał
 * wtedy zapasowe kółko, nie do odróżnienia od gościa z symbolem „koło".
 *
 * Kształty są celowo proste i zwarte: ikona bywa wielkości paznokcia, a mimo to
 * ma być rozpoznawalna z drugiej strony stolika.
 */
export const SYMBOL_PATH: Record<ParticipantSymbol, string> = {
  star: 'M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6 6.1 20.7l1.2-6.6L2.5 9.5l6.6-.9z',
  heart:
    'M12 21l-1.45-1.32C5.4 15.36 2 12.28 2 8.5A4.5 4.5 0 016.5 4c1.74 0 3.41.81 4.5 2.09C12.09 4.81 13.76 4 15.5 4A4.5 4.5 0 0120 8.5c0 3.78-3.4 6.86-8.55 11.18z',
  square: 'M4 4h16v16H4z',
  triangle: 'M12 3l9 17H3z',
  circle: 'M12 3a9 9 0 100 18 9 9 0 000-18z',
  house: 'M12 3l9 8h-2.5v10h-5v-6h-3v6h-5V11H3z',
  arrow: 'M12 2l7 8h-4v12h-6V10H5z',
  // Promienie kół (2.2) z zapasem pokrywają swoje cięciwy (4.4) — łuk o promieniu
  // mniejszym niż połowa cięciwy jest niewykonalny i przeglądarka po cichu skaluje
  // go w górę. Na tym poległ półksiężyc.
  car: 'M2 14l1.8-4.6A3 3 0 0 1 6.6 7.5h10.8a3 3 0 0 1 2.8 1.9L22 14v3.5h-2.2a2.2 2.2 0 1 1-4.4 0H8.6a2.2 2.2 0 1 1-4.4 0H2z',
  diamond: 'M12 2l8 10-8 10-8-10z',
  bolt: 'M13 2L4 14h6l-1 8 9-12h-6z',
};
