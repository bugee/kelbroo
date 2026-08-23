/**
 * Tożsamość uczestnika wizyty: nick i znak rozpoznawczy z zamkniętego zestawu.
 *
 * Losowanie jest ścieżką domyślną — jedno kliknięcie, zero wpisywania, zero
 * danych osobowych (docs/architecture.md §14.1). Generator celowo nie proponuje
 * imion: nick nie ma być danymi osobowymi w rozumieniu RODO.
 *
 * Wszystkie zwierzęta są rodzaju męskiego, żeby przymiotnik zawsze się zgadzał.
 *
 * Znak rozpoznawczy (kształt + kolor) jest osobną osią tożsamości: nick czyta się
 * z ekranu, a znak wypowiada kelnerowi. Zestawy mieszkają w `@kelbroo/types`,
 * bo rysują je oba fronty.
 */
import {
  PARTICIPANT_COLORS,
  PARTICIPANT_SYMBOLS,
  type ParticipantColor,
  type ParticipantSymbol,
} from '@kelbroo/types';

const ADJECTIVES = [
  'Wesoły',
  'Szybki',
  'Dzielny',
  'Głodny',
  'Cichy',
  'Śmiały',
  'Zwinny',
  'Sprytny',
  'Leniwy',
  'Ciekawski',
  'Uparty',
  'Roztargniony',
] as const;

const ANIMALS = [
  'Borsuk',
  'Jeż',
  'Ryś',
  'Żubr',
  'Bóbr',
  'Lis',
  'Sokół',
  'Wilk',
  'Łoś',
  'Zając',
  'Dzik',
  'Kruk',
] as const;

const pick = <T>(items: readonly T[]): T => {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) {
    throw new Error('Pusty zestaw do losowania.');
  }
  return item;
};

export interface GeneratedIdentity {
  displayName: string;
  symbol: ParticipantSymbol;
  color: ParticipantColor;
}

export interface TakenIdentity {
  displayName: string;
  symbol: string;
  color: string;
}

/**
 * Losuje tożsamość unikalną w obrębie wizyty.
 *
 * Nick nie może się powtórzyć, bo goście nie rozpoznaliby, czyja jest która
 * pozycja na rachunku. Znak rozpoznawczy tym bardziej: para symbol + kolor jest
 * tym, czym gość przedstawia się kelnerowi.
 *
 * Kształt trzymamy unikalny tak długo, jak starcza kształtów — samo „gwiazdka"
 * wystarcza do przedstawienia się i jest krótsze niż „czerwona gwiazdka".
 * Dopiero po wyczerpaniu kształtów zaczynamy je powtarzać w innym kolorze.
 */
export function generateIdentity(taken: readonly TakenIdentity[] = []): GeneratedIdentity {
  const usedNames = new Set(taken.map((identity) => identity.displayName));
  const usedSymbols = new Set(taken.map((identity) => identity.symbol));
  const usedPairs = new Set(taken.map((identity) => `${identity.symbol}:${identity.color}`));

  const freeSymbols = PARTICIPANT_SYMBOLS.filter((symbol) => !usedSymbols.has(symbol));
  const symbol = freeSymbols.length > 0 ? pick(freeSymbols) : pick(PARTICIPANT_SYMBOLS);

  const freeColors = PARTICIPANT_COLORS.filter((color) => !usedPairs.has(`${symbol}:${color}`));
  // 10 kształtów × 8 kolorów to 80 par — przy stoliku nie da się ich wyczerpać,
  // ale nie zostawiamy wyboru bez wyjścia.
  const color = freeColors.length > 0 ? pick(freeColors) : pick(PARTICIPANT_COLORS);

  for (let attempt = 0; attempt < 25; attempt++) {
    const displayName = `${pick(ADJECTIVES)} ${pick(ANIMALS)}`;
    if (!usedNames.has(displayName)) {
      return { displayName, symbol, color };
    }
  }

  // 144 kombinacje nicków wystarczają dla stolika, ale pętla musi mieć wyjście.
  return { displayName: `Gość ${usedNames.size + 1}`, symbol, color };
}
