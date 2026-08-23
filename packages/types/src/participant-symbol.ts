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
  'moon',
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
  moon: 'księżyc',
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
  moon: 'm',
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
